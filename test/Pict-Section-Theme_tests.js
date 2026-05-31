/**
 * pict-section-theme — Unit Tests
 *
 * Verifies:
 *   - The catalog loads cleanly and every entry resolves to a valid theme
 *     bundle (Hash + Tokens).
 *   - The install() helper wires the provider, registers the catalog, and
 *     adds the three views.
 *   - listCatalog() returns metadata without bundle payloads.
 *   - registerCatalog() can be called independently (without install).
 *
 * No DOM is exercised here — view rendering is covered by the playground
 * integration smoke tests, not by unit tests.
 */

const libAssert = require('assert');
const libPict = require('pict');

const libPictSectionTheme = require('../source/Pict-Section-Theme.js');
const _Catalog = require('../source/themes/_catalog.js');

// Each install() test gets a fresh Pict instance — install() mutates
// pict.providers / pict.views and registers CSS/templates, so reusing one
// pict across tests would leak state.
function createPict()
{
	return new libPict();
}

suite('pict-section-theme', () =>
{
	suite('Catalog', () =>
	{
		test('catalog is a non-empty registry of well-formed entries', () =>
		{
			// The registry is array-like (length + numeric index) for legacy
			// callers, with a .list() method for the canonical API.
			libAssert.strictEqual(typeof _Catalog.list, 'function', 'registry exposes list()');
			libAssert.ok(_Catalog.length > 0, 'registry must not be empty');

			let tmpEntries = _Catalog.list();
			libAssert.ok(Array.isArray(tmpEntries), 'list() returns an array');
			libAssert.strictEqual(tmpEntries.length, _Catalog.length,
				'list() length matches registry length');

			for (let i = 0; i < tmpEntries.length; i++)
			{
				let tmpEntry = tmpEntries[i];
				libAssert.strictEqual(typeof tmpEntry.Hash, 'string',
					'entry must have a string Hash');
				libAssert.ok(tmpEntry.Bundle && typeof tmpEntry.Bundle === 'object',
					'entry must have a Bundle object: ' + tmpEntry.Hash);
				libAssert.strictEqual(tmpEntry.Bundle.Hash, tmpEntry.Hash,
					'entry Hash must match Bundle.Hash for ' + tmpEntry.Hash);
				libAssert.ok(tmpEntry.Bundle.Tokens && typeof tmpEntry.Bundle.Tokens === 'object',
					'bundle must have Tokens for ' + tmpEntry.Hash);
				// Round-trip lookup: get(hash) returns the same entry shape.
				libAssert.strictEqual(_Catalog.get(tmpEntry.Hash).Hash, tmpEntry.Hash,
					'get(hash) round-trips for ' + tmpEntry.Hash);
				libAssert.strictEqual(_Catalog.has(tmpEntry.Hash), true,
					'has(hash) is true for registered entry ' + tmpEntry.Hash);
				// Numeric-index legacy API also returns the same entry.
				libAssert.strictEqual(_Catalog[i].Hash, tmpEntry.Hash,
					'numeric index matches list() at i=' + i);
			}
		});

		test('catalog hashes are unique', () =>
		{
			let tmpSeen = {};
			let tmpEntries = _Catalog.list();
			for (let i = 0; i < tmpEntries.length; i++)
			{
				let tmpHash = tmpEntries[i].Hash;
				libAssert.strictEqual(tmpSeen[tmpHash], undefined,
					'duplicate hash in catalog: ' + tmpHash);
				tmpSeen[tmpHash] = true;
			}
		});

		test('listCatalog() returns metadata without bundle payloads', () =>
		{
			let tmpList = libPictSectionTheme.listCatalog();
			libAssert.strictEqual(tmpList.length, _Catalog.length,
				'listCatalog must include every catalog entry');
			for (let i = 0; i < tmpList.length; i++)
			{
				let tmpItem = tmpList[i];
				libAssert.strictEqual(typeof tmpItem.Hash, 'string');
				libAssert.strictEqual(typeof tmpItem.Name, 'string');
				libAssert.strictEqual(typeof tmpItem.Category, 'string');
				libAssert.ok(['single', 'paired', 'system'].indexOf(tmpItem.Strategy) >= 0,
					'unknown strategy ' + tmpItem.Strategy + ' for ' + tmpItem.Hash);
				libAssert.strictEqual(typeof tmpItem.IsDefault, 'boolean');
				libAssert.strictEqual(tmpItem.Bundle, undefined,
					'metadata must not leak the Bundle');
			}
		});

		test('exactly one default theme is flagged', () =>
		{
			let tmpDefaults = libPictSectionTheme.listCatalog()
				.filter((p) => p.IsDefault);
			libAssert.strictEqual(tmpDefaults.length, 1,
				'expected exactly one IsDefault entry; got ' + tmpDefaults.length);
			libAssert.strictEqual(tmpDefaults[0].Hash, 'retold-default');
		});
	});

	suite('install()', () =>
	{
		test('throws when not given a pict-shaped first argument', () =>
		{
			libAssert.throws(() => libPictSectionTheme.install(null));
			libAssert.throws(() => libPictSectionTheme.install({}));
		});

		test('registers provider, all three views, and the full catalog by default', () =>
		{
			let tmpPict = createPict();
			libPictSectionTheme.install(tmpPict);

			libAssert.ok(tmpPict.providers.Theme,
				'Theme provider must be registered');
			libAssert.ok(tmpPict.views['Theme-Picker'],
				'Theme-Picker view must be registered');
			libAssert.ok(tmpPict.views['Theme-ModeToggle'],
				'Theme-ModeToggle view must be registered');
			libAssert.ok(tmpPict.views['Theme-Button'],
				'Theme-Button view must be registered');

			let tmpThemes = tmpPict.providers.Theme.listThemes();
			libAssert.strictEqual(tmpThemes.length, _Catalog.length,
				'every catalog entry must be registered with the provider');
		});

		test('honours Views subset', () =>
		{
			let tmpPict = createPict();
			libPictSectionTheme.install(tmpPict, { Views: ['Picker'] });

			libAssert.ok(tmpPict.views['Theme-Picker']);
			libAssert.strictEqual(tmpPict.views['Theme-ModeToggle'], undefined);
			libAssert.strictEqual(tmpPict.views['Theme-Button'], undefined);
		});

		test('honours RegisterCatalog: false', () =>
		{
			let tmpPict = createPict();
			libPictSectionTheme.install(tmpPict, { RegisterCatalog: false });

			let tmpThemes = tmpPict.providers.Theme.listThemes();
			libAssert.strictEqual(tmpThemes.length, 0,
				'no themes must be registered when RegisterCatalog is false');
		});

		test('does not double-register existing provider', () =>
		{
			let tmpPict = createPict();
			// First install to set up provider.
			libPictSectionTheme.install(tmpPict);
			let tmpFirstProvider = tmpPict.providers.Theme;

			// Second install should detect the existing provider and reuse it.
			libPictSectionTheme.install(tmpPict);
			libAssert.strictEqual(tmpPict.providers.Theme, tmpFirstProvider,
				'install must not replace an existing provider instance');
		});

		test('ApplyDefault triggers an initial applyTheme call', () =>
		{
			let tmpPict = createPict();
			libPictSectionTheme.install(tmpPict, { ApplyDefault: 'pict-default', DefaultMode: 'light' });

			let tmpActive = tmpPict.providers.Theme.getActiveTheme();
			libAssert.strictEqual(tmpActive.Hash, 'pict-default');
			libAssert.strictEqual(tmpActive.Mode, 'light');
		});
	});

	suite('registerCatalog()', () =>
	{
		test('returns 0 and warns when provider is missing', () =>
		{
			let tmpPict = createPict();
			let tmpCount = libPictSectionTheme.registerCatalog(tmpPict);
			libAssert.strictEqual(tmpCount, 0);
		});

		test('returns the registered count when provider is present', () =>
		{
			let tmpPict = createPict();
			tmpPict.addProvider('Theme', libPictSectionTheme.Provider.default_configuration,
				libPictSectionTheme.Provider);

			let tmpCount = libPictSectionTheme.registerCatalog(tmpPict);
			libAssert.strictEqual(tmpCount, _Catalog.length);
		});
	});

	suite('Exports', () =>
	{
		test('exports the three view classes and provider', () =>
		{
			libAssert.strictEqual(typeof libPictSectionTheme.Provider, 'function');
			libAssert.strictEqual(typeof libPictSectionTheme.PickerView, 'function');
			libAssert.strictEqual(typeof libPictSectionTheme.ModeToggleView, 'function');
			libAssert.strictEqual(typeof libPictSectionTheme.ButtonView, 'function');
			libAssert.ok(libPictSectionTheme.PickerView.default_configuration);
			libAssert.ok(libPictSectionTheme.ModeToggleView.default_configuration);
			libAssert.ok(libPictSectionTheme.ButtonView.default_configuration);
		});
	});
});
