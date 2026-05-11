/**
 * Theme-Brand + brand integration — Unit Tests
 *
 * Verifies:
 *   - applyBrand() emits CSS containing every --brand-color-* var,
 *     including the dark-mode override block.
 *   - Bad input (missing colors, null, non-object) is rejected
 *     without throwing.
 *   - getActive() reflects the latest applied brand, returns null
 *     after applyBrand(null).
 *   - onChange listeners fire on apply + clear; offChange detaches.
 *   - Icon type detection: SVG markup → 'svg', http/data URLs → 'image'.
 *   - install() with Brand option applies the brand at boot.
 *   - BrandStripView is registered when Views default applies.
 *   - Brand survives a theme switch (it's per-app, not per-theme).
 *
 * Uses an in-memory document stub so we can inspect injected style
 * elements without a real browser.
 */

const libAssert = require('assert');
const libPict = require('pict');

const libPictSectionTheme = require('../source/Pict-Section-Theme.js');
const libThemeBrand = require('../source/Theme-Brand.js');

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
	let tmpHead = {
		appendChild: function (pEl)
		{
			tmpElements[pEl.id] = pEl;
			pEl.parentNode = this;
		},
		removeChild: function (pEl)
		{
			if (pEl && pEl.id) delete tmpElements[pEl.id];
			pEl.parentNode = null;
		}
	};
	return {
		createElement: function (pTag)
		{
			return { tagName: pTag, id: '', textContent: '', parentNode: null };
		},
		getElementById: function (pId) { return tmpElements[pId] || null; },
		head: tmpHead,
		_dump: function () { return tmpElements; }
	};
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
		if (tmpHadW) global.window = tmpPrevW; else delete global.window;
		if (tmpHadD) global.document = tmpPrevD; else delete global.document;
	}
}

const _SAMPLE_BRAND =
{
	Hash: 'sample-brand',
	Name: 'Sample Brand',
	Tagline: 'Just for tests',
	Icon: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
	Colors:
	{
		Primary:        '#0066ff',
		Secondary:      '#ff6600',
		PrimaryLight:   '#3388ff',
		PrimaryDark:    '#0044cc',
		SecondaryLight: '#ff8833',
		SecondaryDark:  '#cc4400'
	}
};

suite('Theme-Brand', () =>
{
	setup(() => { libThemeBrand.reset(); });

	suite('applyBrand()', () =>
	{
		test('emits CSS with every --brand-color-* var', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				libThemeBrand.applyBrand(_SAMPLE_BRAND);
				let tmpEl = tmpDoc.getElementById('pict-brand');
				libAssert.ok(tmpEl);
				let tmpCSS = tmpEl.textContent;

				let tmpExpectVars =
				[
					'--brand-color-primary:         #0066ff',
					'--brand-color-secondary:       #ff6600',
					'--brand-color-primary-light:   #3388ff',
					'--brand-color-primary-dark:    #0044cc',
					'--brand-color-secondary-light: #ff8833',
					'--brand-color-secondary-dark:  #cc4400',
					'--brand-color-primary-mode:    #3388ff',
					'--brand-color-secondary-mode:  #ff8833',
					'--brand-name:                  "Sample Brand"'
				];
				for (let i = 0; i < tmpExpectVars.length; i++)
				{
					libAssert.ok(tmpCSS.indexOf(tmpExpectVars[i]) >= 0,
						'expected to find: ' + tmpExpectVars[i]);
				}
			});
		});

		test('emits .theme-dark override block for *-mode vars', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				libThemeBrand.applyBrand(_SAMPLE_BRAND);
				let tmpCSS = tmpDoc.getElementById('pict-brand').textContent;
				libAssert.ok(tmpCSS.indexOf('.theme-dark {') >= 0);
				libAssert.ok(tmpCSS.indexOf('--brand-color-primary-mode:    #0044cc') >= 0,
					'dark block must override primary-mode to PrimaryDark');
				libAssert.ok(tmpCSS.indexOf('--brand-color-secondary-mode:  #cc4400') >= 0,
					'dark block must override secondary-mode to SecondaryDark');
			});
		});

		test('falls back to base Primary/Secondary when light/dark variants omitted', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				libThemeBrand.applyBrand({
					Name: 'Minimal',
					Colors: { Primary: '#ff0000', Secondary: '#00ff00' }
				});
				let tmpCSS = tmpDoc.getElementById('pict-brand').textContent;
				libAssert.ok(tmpCSS.indexOf('--brand-color-primary-light:   #ff0000') >= 0);
				libAssert.ok(tmpCSS.indexOf('--brand-color-primary-dark:    #ff0000') >= 0);
				libAssert.ok(tmpCSS.indexOf('--brand-color-secondary-light: #00ff00') >= 0);
				libAssert.ok(tmpCSS.indexOf('--brand-color-secondary-dark:  #00ff00') >= 0);
			});
		});

		test('rejects null / non-object / missing colors without throwing', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				libAssert.doesNotThrow(() => libThemeBrand.applyBrand(undefined));
				libAssert.doesNotThrow(() => libThemeBrand.applyBrand({}));
				libAssert.doesNotThrow(() => libThemeBrand.applyBrand({ Colors: {} }));
				libAssert.doesNotThrow(() => libThemeBrand.applyBrand({ Colors: { Primary: '#fff' } }));
				libAssert.strictEqual(libThemeBrand.getActive(), null);
			});
		});

		test('applyBrand(null) clears the active brand and removes the style element', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				libThemeBrand.applyBrand(_SAMPLE_BRAND);
				libAssert.ok(libThemeBrand.getActive());
				libAssert.ok(tmpDoc.getElementById('pict-brand'));

				libThemeBrand.applyBrand(null);
				libAssert.strictEqual(libThemeBrand.getActive(), null);
				libAssert.strictEqual(tmpDoc.getElementById('pict-brand'), null);
			});
		});

		test('listener fires on apply and on clear with new+old payloads', () =>
		{
			let tmpDoc = createDocumentStub();
			let tmpHistory = [];
			withBrowser({ document: tmpDoc }, () =>
			{
				// Hash is null when there's no brand on either side of the change.
				let tmpHashOf = function (pBrand) { return pBrand ? pBrand.Hash : null; };
				libThemeBrand.onChange((p_new, p_old) => { tmpHistory.push([tmpHashOf(p_new), tmpHashOf(p_old)]); });
				libThemeBrand.applyBrand(_SAMPLE_BRAND);
				libThemeBrand.applyBrand({ Hash: 'b2', Name: 'B2', Colors: { Primary: '#111', Secondary: '#222' } });
				libThemeBrand.applyBrand(null);
				libAssert.deepStrictEqual(tmpHistory,
				[
					['sample-brand', null],        // first apply, no prior brand
					['b2', 'sample-brand'],
					[null, 'b2']                   // null clears
				]);
			});
		});
	});

	suite('icon type detection', () =>
	{
		test('inline <svg> markup → IconType svg', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				let tmpApplied = libThemeBrand.applyBrand({
					Name: 'X',
					Colors: { Primary: '#fff', Secondary: '#000' },
					Icon: '<svg width="10" height="10"><path d="M0 0L10 10"/></svg>'
				});
				libAssert.strictEqual(tmpApplied.IconType, 'svg');
			});
		});

		test('https / data / / paths → IconType image', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				let tmpExpect = function (pIcon)
				{
					let tmpApplied = libThemeBrand.applyBrand({
						Name: 'X',
						Colors: { Primary: '#fff', Secondary: '#000' },
						Icon: pIcon
					});
					libAssert.strictEqual(tmpApplied.IconType, 'image', 'should be image: ' + pIcon);
				};
				tmpExpect('https://example.com/icon.png');
				tmpExpect('http://example.com/icon.png');
				tmpExpect('data:image/png;base64,iVBORw0KG...');
				tmpExpect('/static/icon.png');
				tmpExpect('./local/icon.svg');
			});
		});

		test('explicit IconType wins over auto-detection', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser({ document: tmpDoc }, () =>
			{
				let tmpApplied = libThemeBrand.applyBrand({
					Name: 'X',
					Colors: { Primary: '#fff', Secondary: '#000' },
					Icon: '<svg/>',
					IconType: 'image'
				});
				libAssert.strictEqual(tmpApplied.IconType, 'image');
			});
		});
	});

	suite('install() brand integration', () =>
	{
		test('Brand option applies the brand at boot', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: createMemoryStorage(), location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict,
					{
						ApplyDefault: 'retold-manager',
						Brand: _SAMPLE_BRAND
					});
					libAssert.ok(libThemeBrand.getActive());
					libAssert.strictEqual(libThemeBrand.getActive().Hash, 'sample-brand');
					libAssert.ok(tmpDoc.getElementById('pict-brand'));
				});
		});

		test('install() registers the BrandStrip view by default', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: createMemoryStorage(), location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict);
					libAssert.ok(tmpPict.views['Theme-BrandStrip']);
				});
		});

		test('brand survives theme switches', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: createMemoryStorage(), location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict,
					{
						ApplyDefault: 'retold-manager',
						Brand: _SAMPLE_BRAND
					});

					// Switch theme — brand should be untouched.
					tmpPict.providers.Theme.applyTheme('cyberpunk');

					let tmpBrand = libThemeBrand.getActive();
					libAssert.ok(tmpBrand);
					libAssert.strictEqual(tmpBrand.Hash, 'sample-brand');
					libAssert.ok(tmpDoc.getElementById('pict-brand'),
						'brand style element must persist across theme apply');
				});
		});

		test('no Brand option leaves brand inactive', () =>
		{
			let tmpDoc = createDocumentStub();
			withBrowser(
				{ window: { localStorage: createMemoryStorage(), location: { hostname: 'host' } }, document: tmpDoc },
				() =>
				{
					let tmpPict = new libPict();
					libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager' });
					libAssert.strictEqual(libThemeBrand.getActive(), null);
					libAssert.strictEqual(tmpDoc.getElementById('pict-brand'), null);
				});
		});
	});

	suite('Exports', () =>
	{
		test('exports BrandStripView class with default_configuration', () =>
		{
			libAssert.strictEqual(typeof libPictSectionTheme.BrandStripView, 'function');
			libAssert.strictEqual(libPictSectionTheme.BrandStripView.default_configuration.ViewIdentifier,
				'Theme-BrandStrip');
		});

		test('exports the Brand helper module', () =>
		{
			libAssert.strictEqual(typeof libPictSectionTheme.Brand, 'object');
			libAssert.strictEqual(typeof libPictSectionTheme.Brand.applyBrand, 'function');
			libAssert.strictEqual(typeof libPictSectionTheme.Brand.getActive, 'function');
			libAssert.strictEqual(typeof libPictSectionTheme.Brand.onChange, 'function');
		});
	});
});
