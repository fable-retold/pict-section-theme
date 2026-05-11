/**
 * Theme-Persistence — Unit Tests
 *
 * Verifies:
 *   - resolveKey() honours user override, falls back to hostname,
 *     falls back to 'default' in non-browser contexts.
 *   - load() returns null for: missing storage, missing entry, invalid
 *     JSON, schema mismatch, missing required fields.
 *   - save() persists round-trip-cleanly and tolerates quota errors.
 *   - install() integration: a saved entry trumps ApplyDefault; an
 *     orphaned entry (theme no longer registered) falls back to
 *     ApplyDefault; the boot apply itself is persisted.
 *
 * Uses a hand-rolled in-memory localStorage stub installed onto
 * `global.window` for the duration of each test.
 */

const libAssert = require('assert');
const libPict = require('pict');

const libPictSectionTheme = require('../source/Pict-Section-Theme.js');
const libThemePersistence = require('../source/Theme-Persistence.js');

// In-memory localStorage stub.  Tracks every set/remove so tests can
// assert on persisted shape without touching the real browser API.
function createMemoryStorage(pInitial)
{
	let tmpStore = Object.assign({}, pInitial || {});
	return {
		getItem: function (pKey) { return Object.prototype.hasOwnProperty.call(tmpStore, pKey) ? tmpStore[pKey] : null; },
		setItem: function (pKey, pVal) { tmpStore[pKey] = String(pVal); },
		removeItem: function (pKey) { delete tmpStore[pKey]; },
		_dump: function () { return Object.assign({}, tmpStore); },
		_setQuotaExceeded: function () { this.setItem = function () { let tmpErr = new Error('quota'); tmpErr.name = 'QuotaExceededError'; throw tmpErr; }; }
	};
}

function withWindow(pWindowShape, pFn)
{
	let tmpHadWindow = (typeof global.window !== 'undefined');
	let tmpPrevWindow = global.window;
	global.window = pWindowShape;
	try { pFn(); }
	finally
	{
		if (tmpHadWindow) { global.window = tmpPrevWindow; }
		else { delete global.window; }
	}
}

suite('Theme-Persistence', () =>
{
	suite('resolveKey()', () =>
	{
		test('uses user-supplied scope when given', () =>
		{
			withWindow({ location: { hostname: 'should-not-use-this.example' } }, () =>
			{
				libAssert.strictEqual(
					libThemePersistence.resolveKey('my-app'),
					'pict-section-theme:my-app');
			});
		});

		test('falls back to window.location.hostname when no scope given', () =>
		{
			withWindow({ location: { hostname: 'manager.local' } }, () =>
			{
				libAssert.strictEqual(
					libThemePersistence.resolveKey(null),
					'pict-section-theme:manager.local');
				libAssert.strictEqual(
					libThemePersistence.resolveKey(''),
					'pict-section-theme:manager.local');
			});
		});

		test('falls back to "default" when no window is available', () =>
		{
			let tmpHad = (typeof global.window !== 'undefined');
			let tmpPrev = global.window;
			delete global.window;
			try
			{
				libAssert.strictEqual(libThemePersistence.resolveKey(null),
					'pict-section-theme:default');
			}
			finally { if (tmpHad) global.window = tmpPrev; }
		});
	});

	suite('load() / save()', () =>
	{
		test('save() then load() returns the same theme + mode', () =>
		{
			let tmpStorage = createMemoryStorage();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpKey = libThemePersistence.resolveKey(null);
				let tmpOK = libThemePersistence.save(tmpKey, { ThemeHash: 'cyberpunk', Mode: 'dark' });
				libAssert.strictEqual(tmpOK, true);

				let tmpLoaded = libThemePersistence.load(tmpKey);
				libAssert.deepStrictEqual(tmpLoaded,
					{ ThemeHash: 'cyberpunk', Mode: 'dark', Scale: null });
			});
		});

		test('persisted entry includes Version + SavedAt', () =>
		{
			let tmpStorage = createMemoryStorage();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpKey = libThemePersistence.resolveKey('app');
				libThemePersistence.save(tmpKey, { ThemeHash: 'twilight' });

				let tmpRaw = JSON.parse(tmpStorage.getItem(tmpKey));
				libAssert.strictEqual(tmpRaw.Version, libThemePersistence.SCHEMA_VERSION);
				libAssert.strictEqual(typeof tmpRaw.SavedAt, 'string');
				libAssert.ok(tmpRaw.SavedAt.length > 0);
			});
		});

		test('load() returns null when no entry stored', () =>
		{
			withWindow({ localStorage: createMemoryStorage(), location: { hostname: 'host' } }, () =>
			{
				libAssert.strictEqual(
					libThemePersistence.load('pict-section-theme:host'),
					null);
			});
		});

		test('load() returns null on JSON parse error', () =>
		{
			let tmpStorage = createMemoryStorage({ 'pict-section-theme:host': '{not valid json' });
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				libAssert.strictEqual(
					libThemePersistence.load('pict-section-theme:host'),
					null);
			});
		});

		test('load() returns null on schema version mismatch', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host': JSON.stringify({ Version: 99, ThemeHash: 'twilight', Mode: 'dark' })
			});
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				libAssert.strictEqual(
					libThemePersistence.load('pict-section-theme:host'),
					null);
			});
		});

		test('load() returns null when ThemeHash is missing', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host': JSON.stringify({ Version: 1, Mode: 'dark' })
			});
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				libAssert.strictEqual(
					libThemePersistence.load('pict-section-theme:host'),
					null);
			});
		});

		test('load() returns Mode: null when Mode wasn\'t saved', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host': JSON.stringify({ Version: 1, ThemeHash: 'twilight' })
			});
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpLoaded = libThemePersistence.load('pict-section-theme:host');
				libAssert.deepStrictEqual(tmpLoaded,
					{ ThemeHash: 'twilight', Mode: null, Scale: null });
			});
		});

		test('save() returns false on quota-exceeded — does not throw', () =>
		{
			let tmpStorage = createMemoryStorage();
			tmpStorage._setQuotaExceeded();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpOK = libThemePersistence.save('pict-section-theme:host', { ThemeHash: 'twilight' });
				libAssert.strictEqual(tmpOK, false);
			});
		});

		test('save() returns false when storage is unavailable', () =>
		{
			withWindow({ /* no localStorage */ location: { hostname: 'host' } }, () =>
			{
				let tmpOK = libThemePersistence.save('pict-section-theme:host', { ThemeHash: 'twilight' });
				libAssert.strictEqual(tmpOK, false);
			});
		});

		test('save() refuses entries without a ThemeHash', () =>
		{
			let tmpStorage = createMemoryStorage();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				libAssert.strictEqual(libThemePersistence.save('k', null), false);
				libAssert.strictEqual(libThemePersistence.save('k', {}), false);
				libAssert.strictEqual(libThemePersistence.save('k', { ThemeHash: '' }), false);
			});
		});

		test('clear() removes a stored entry', () =>
		{
			let tmpStorage = createMemoryStorage();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpKey = libThemePersistence.resolveKey(null);
				libThemePersistence.save(tmpKey, { ThemeHash: 'twilight', Mode: 'dark' });
				libAssert.ok(libThemePersistence.load(tmpKey));

				libThemePersistence.clear(tmpKey);
				libAssert.strictEqual(libThemePersistence.load(tmpKey), null);
			});
		});
	});

	suite('install() persistence integration', () =>
	{
		test('saved entry trumps ApplyDefault on install()', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host':
					JSON.stringify({ Version: 1, ThemeHash: 'cyberpunk', Mode: 'light' })
			});
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpPict = new libPict();
				libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager', DefaultMode: 'system' });

				let tmpActive = tmpPict.providers.Theme.getActiveTheme();
				libAssert.strictEqual(tmpActive.Hash, 'cyberpunk',
					'saved cyberpunk should win over ApplyDefault retold-manager');
			});
		});

		test('orphaned saved entry (unknown theme) falls back to ApplyDefault', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host':
					JSON.stringify({ Version: 1, ThemeHash: 'theme-that-does-not-exist', Mode: 'dark' })
			});
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpPict = new libPict();
				libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager', DefaultMode: 'light' });

				let tmpActive = tmpPict.providers.Theme.getActiveTheme();
				libAssert.strictEqual(tmpActive.Hash, 'retold-manager',
					'unknown saved theme should fall back to ApplyDefault');
			});
		});

		test('install() persists the boot apply so reloads stabilise', () =>
		{
			let tmpStorage = createMemoryStorage();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpPict = new libPict();
				libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager', DefaultMode: 'dark' });

				let tmpRaw = tmpStorage.getItem('pict-section-theme:host');
				libAssert.ok(tmpRaw, 'boot apply should have written an entry');

				let tmpParsed = JSON.parse(tmpRaw);
				libAssert.strictEqual(tmpParsed.ThemeHash, 'retold-manager');
				libAssert.strictEqual(tmpParsed.Mode, 'dark');
			});
		});

		test('Persistence: false skips both load and save', () =>
		{
			let tmpStorage = createMemoryStorage({
				'pict-section-theme:host':
					JSON.stringify({ Version: 1, ThemeHash: 'cyberpunk', Mode: 'light' })
			});
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpPict = new libPict();
				libPictSectionTheme.install(tmpPict,
					{ ApplyDefault: 'retold-manager', DefaultMode: 'dark', Persistence: false });

				// Saved cyberpunk is ignored; ApplyDefault wins.
				let tmpActive = tmpPict.providers.Theme.getActiveTheme();
				libAssert.strictEqual(tmpActive.Hash, 'retold-manager');

				// And the boot apply must NOT have overwritten the saved entry.
				let tmpRaw = JSON.parse(tmpStorage.getItem('pict-section-theme:host'));
				libAssert.strictEqual(tmpRaw.ThemeHash, 'cyberpunk',
					'Persistence: false must not write to localStorage');
			});
		});

		test('PersistenceKey override scopes storage to a custom name', () =>
		{
			let tmpStorage = createMemoryStorage();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'manager.local' } }, () =>
			{
				let tmpPict = new libPict();
				libPictSectionTheme.install(tmpPict,
					{ ApplyDefault: 'retold-manager', PersistenceKey: 'retold-manager-app' });

				libAssert.ok(tmpStorage.getItem('pict-section-theme:retold-manager-app'),
					'boot apply should have written under the custom scope');
				libAssert.strictEqual(tmpStorage.getItem('pict-section-theme:manager.local'), null,
					'must NOT write under the hostname when a custom PersistenceKey is given');
			});
		});

		test('subsequent setMode() calls update the saved entry', () =>
		{
			let tmpStorage = createMemoryStorage();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpPict = new libPict();
				libPictSectionTheme.install(tmpPict, { ApplyDefault: 'retold-manager', DefaultMode: 'dark' });

				tmpPict.providers.Theme.setMode('light');

				let tmpParsed = JSON.parse(tmpStorage.getItem('pict-section-theme:host'));
				libAssert.strictEqual(tmpParsed.Mode, 'light',
					'setMode() should propagate to the saved entry');
			});
		});

		test('clearPersistence(pict) wipes the entry', () =>
		{
			let tmpStorage = createMemoryStorage();
			withWindow({ localStorage: tmpStorage, location: { hostname: 'host' } }, () =>
			{
				let tmpPict = new libPict();
				libPictSectionTheme.install(tmpPict, { ApplyDefault: 'cyberpunk' });

				libAssert.ok(tmpStorage.getItem('pict-section-theme:host'));

				let tmpOK = libPictSectionTheme.clearPersistence(tmpPict);
				libAssert.strictEqual(tmpOK, true);
				libAssert.strictEqual(tmpStorage.getItem('pict-section-theme:host'), null);
			});
		});
	});
});
