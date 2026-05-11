/**
 * Theme-Scale + scale-aware persistence — Unit Tests
 *
 * Verifies:
 *   - applyScale() clamps invalid input, fires listeners on change,
 *     no-ops re-applying the same value (no listener fire).
 *   - The injected <style id="pict-theme-scale"> contains both
 *     `html { zoom: <n>; }` and `:root { --theme-scale: <n>; }`.
 *   - Persistence load/save round-trips the Scale field; old entries
 *     without Scale load as Scale: null; out-of-range values are
 *     treated as missing.
 *   - install() reads saved Scale and applies it at boot.
 *   - install() persists scale changes alongside theme + mode.
 *   - DefaultScale option applies when no saved Scale exists.
 *
 * Uses a hand-rolled in-memory document stub to capture style-element
 * mutations without touching a real browser.
 */

const libAssert = require('assert');
const libPict = require('pict');

const libPictSectionTheme = require('../source/Pict-Section-Theme.js');
const libThemePersistence = require('../source/Theme-Persistence.js');
const libThemeScale = require('../source/Theme-Scale.js');

// ────────────────────────────────────────────────────────────────────
//  Stubs
// ────────────────────────────────────────────────────────────────────

function createMemoryStorage(pInitial)
{
	let tmpStore = Object.assign({}, pInitial || {});
	return {
		getItem: function (pKey) { return Object.prototype.hasOwnProperty.call(tmpStore, pKey) ? tmpStore[pKey] : null; },
		setItem: function (pKey, pVal) { tmpStore[pKey] = String(pVal); },
		removeItem: function (pKey) { delete tmpStore[pKey]; }
	};
}

function createDocumentStub()
{
	let tmpElements = {};
	let tmpDoc =
	{
		createElement: function (pTag)
		{
			return { tagName: pTag, id: '', textContent: '', parentNode: null };
		},
		getElementById: function (pId) { return tmpElements[pId] || null; },
		head:
		{
			appendChild: function (pEl) { tmpElements[pEl.id] = pEl; pEl.parentNode = this; }
		},
		_dump: function () { return tmpElements; }
	};
	return tmpDoc;
}

function withBrowser(pShape, pFn)
{
	let tmpHadW = (typeof global.window !== 'undefined');
	let tmpHadD = (typeof global.document !== 'undefined');
	let tmpPrevW = global.window;
	let tmpPrevD = global.document;
	if (pShape.window) global.window = pShape.window;
	if (pShape.document) global.document = pShape.document;
	try { pFn(); }
	finally
	{
		if (tmpHadW) { global.window = tmpPrevW; } else { delete global.window; }
		if (tmpHadD) { global.document = tmpPrevD; } else { delete global.document; }
	}
}

// ────────────────────────────────────────────────────────────────────
//  Tests
// ────────────────────────────────────────────────────────────────────

suite('Theme-Scale', () =>
{
	setup(() => { libThemeScale.reset(); });

	suite('applyScale()', () =>
	{
		test('returns clamped value for in-range input', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				libAssert.strictEqual(libThemeScale.applyScale(1.25), 1.25);
				libAssert.strictEqual(libThemeScale.getActive(), 1.25);
			});
		});

		test('clamps below MIN_SCALE', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				let tmpApplied = libThemeScale.applyScale(0.1);
				libAssert.strictEqual(tmpApplied, libThemeScale.MIN_SCALE);
			});
		});

		test('clamps above MAX_SCALE', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				let tmpApplied = libThemeScale.applyScale(99);
				libAssert.strictEqual(tmpApplied, libThemeScale.MAX_SCALE);
			});
		});

		test('non-finite / non-positive input falls back to DEFAULT_SCALE', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				libAssert.strictEqual(libThemeScale.applyScale(NaN), libThemeScale.DEFAULT_SCALE);
				libAssert.strictEqual(libThemeScale.applyScale('not a number'), libThemeScale.DEFAULT_SCALE);
				libAssert.strictEqual(libThemeScale.applyScale(0), libThemeScale.DEFAULT_SCALE);
				libAssert.strictEqual(libThemeScale.applyScale(-1), libThemeScale.DEFAULT_SCALE);
			});
		});

		test('injects <style> with both zoom and --theme-scale', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				libThemeScale.applyScale(1.5);
				let tmpEl = tmpDoc.getElementById('pict-theme-scale');
				libAssert.ok(tmpEl, 'style element should be created');
				libAssert.ok(tmpEl.textContent.indexOf('zoom: 1.5') >= 0,
					'CSS should set html { zoom: 1.5 }');
				libAssert.ok(tmpEl.textContent.indexOf('--theme-scale: 1.5') >= 0,
					'CSS should set --theme-scale: 1.5');
			});
		});

		test('re-applying the same value does not fire listener', () =>
		{
			let tmpDoc = createDocumentStub();
			let tmpFires = 0;
			withBrowser({ document: tmpDoc }, () =>
			{
				libThemeScale.onChange(() => { tmpFires++; });
				libThemeScale.applyScale(1.25);
				libThemeScale.applyScale(1.25);
				libThemeScale.applyScale(1.25);
				libAssert.strictEqual(tmpFires, 1, 'listener should fire only on actual change');
			});
		});

		test('listener receives new + old values', () =>
		{
			let tmpDoc = createDocumentStub();
			let tmpHistory = [];
			withBrowser({ document: tmpDoc }, () =>
			{
				libThemeScale.onChange((p_new, p_old) => { tmpHistory.push([p_new, p_old]); });
				libThemeScale.applyScale(1.25);
				libThemeScale.applyScale(0.85);
				libAssert.deepStrictEqual(tmpHistory, [[1.25, 1.0], [0.85, 1.25]]);
			});
		});

		test('offChange / dispose stops further notifications', () =>
		{
			let tmpDoc = createDocumentStub();
			let tmpFires = 0;
			withBrowser({ document: tmpDoc }, () =>
			{
				let tmpDispose = libThemeScale.onChange(() => { tmpFires++; });
				libThemeScale.applyScale(1.25);
				tmpDispose();
				libThemeScale.applyScale(1.5);
				libAssert.strictEqual(tmpFires, 1);
			});
		});
	});

	suite('Persistence Scale field', () =>
	{
		test('save() then load() round-trips the Scale field', () =>
		{
			let tmpStorage = createMemoryStorage();
			withBrowser({ window: { localStorage: tmpStorage, location: { hostname: 'host' } } }, () =>
			{
				let tmpKey = libThemePersistence.resolveKey('app');
				libThemePersistence.save(tmpKey, { ThemeHash: 'cyberpunk', Mode: 'light', Scale: 1.25 });

				let tmpLoaded = libThemePersistence.load(tmpKey);
				libAssert.deepStrictEqual(tmpLoaded, { ThemeHash: 'cyberpunk', Mode: 'light', Scale: 1.25 });
			});
		});

		test('older entries without a Scale field load Scale: null', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host':
					JSON.stringify({ Version: 1, ThemeHash: 'cyberpunk', Mode: 'light' })
			});
			withBrowser({ window: { localStorage: tmpStorage, location: { hostname: 'host' } } }, () =>
			{
				let tmpLoaded = libThemePersistence.load('pict-section-theme:host');
				libAssert.deepStrictEqual(tmpLoaded, { ThemeHash: 'cyberpunk', Mode: 'light', Scale: null });
			});
		});

		test('invalid Scale (non-finite, zero, negative) loads as null', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host':
					JSON.stringify({ Version: 1, ThemeHash: 'cyberpunk', Mode: 'light', Scale: -1 })
			});
			withBrowser({ window: { localStorage: tmpStorage, location: { hostname: 'host' } } }, () =>
			{
				let tmpLoaded = libThemePersistence.load('pict-section-theme:host');
				libAssert.strictEqual(tmpLoaded.Scale, null);
			});
		});
	});

	suite('install() scale integration', () =>
	{
		test('saved Scale is applied at boot', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host':
					JSON.stringify({ Version: 1, ThemeHash: 'retold-manager', Mode: 'dark', Scale: 1.5 })
			});
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: tmpStorage, location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict);
					libAssert.strictEqual(libThemeScale.getActive(), 1.5,
						'saved Scale should be applied during install()');
				});
		});

		test('DefaultScale applies when no saved Scale exists', () =>
		{
			let tmpStorage = createMemoryStorage();
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: tmpStorage, location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager', DefaultScale: 1.25 });
					libAssert.strictEqual(libThemeScale.getActive(), 1.25);
				});
		});

		test('scale changes persist alongside theme + mode', () =>
		{
			let tmpStorage = createMemoryStorage();
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: tmpStorage, location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager', DefaultMode: 'dark' });

					libThemeScale.applyScale(1.5);

					let tmpRaw = JSON.parse(tmpStorage.getItem('pict-section-theme:host'));
					libAssert.strictEqual(tmpRaw.Scale, 1.5);
					libAssert.strictEqual(tmpRaw.ThemeHash, 'retold-manager');
					libAssert.strictEqual(tmpRaw.Mode, 'dark');
				});
		});

		test('changing theme keeps the active scale in the saved record', () =>
		{
			let tmpStorage = createMemoryStorage();
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: tmpStorage, location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager', DefaultScale: 1.25 });

					tmpPict.providers.Theme.applyTheme('cyberpunk');

					let tmpRaw = JSON.parse(tmpStorage.getItem('pict-section-theme:host'));
					libAssert.strictEqual(tmpRaw.ThemeHash, 'cyberpunk');
					libAssert.strictEqual(tmpRaw.Scale, 1.25,
						'switching theme should not reset scale');
				});
		});

		test('orphaned theme + valid scale: scale survives, theme falls back to ApplyDefault', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host':
					JSON.stringify({ Version: 1, ThemeHash: 'theme-that-does-not-exist', Mode: 'dark', Scale: 1.5 })
			});
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: tmpStorage, location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager' });

					libAssert.strictEqual(tmpPict.providers.Theme.getActiveTheme().Hash, 'retold-manager',
						'orphaned theme should fall back to ApplyDefault');
					libAssert.strictEqual(libThemeScale.getActive(), 1.5,
						'scale should survive even when the saved theme is orphaned');
				});
		});
	});

	suite('ScaleSelect view', () =>
	{
		test('exports a default_configuration with ScaleSelect identifier', () =>
		{
			let tmpView = libPictSectionTheme.ScaleSelectView;
			libAssert.strictEqual(typeof tmpView, 'function');
			libAssert.strictEqual(tmpView.default_configuration.ViewIdentifier, 'Theme-ScaleSelect');
		});

		test('install() registers the ScaleSelect view by default', () =>
		{
			let tmpStorage = createMemoryStorage();
			withBrowser({ window: { localStorage: tmpStorage, location: { hostname: 'host' } } }, () =>
			{
				let tmpPict = new libPict();
				libPictSectionTheme.install(tmpPict);
				libAssert.ok(tmpPict.views['Theme-ScaleSelect'],
					'Theme-ScaleSelect view should be registered');
			});
		});
	});
});
