/**
 * pict-section-theme — entry point.
 *
 * Bundles every Retold-ecosystem theme and exposes five reusable views:
 *
 *   - Theme-Picker      : a custom dropdown listing every registered theme,
 *                         grouped by category, with inline SVG mode-glyphs.
 *                         Switches the active theme on change.
 *   - Theme-ModeToggle  : a 3-button toggle for Light / Dark / System mode.
 *                         Disables itself when the active theme is single-mode.
 *   - Theme-ScaleSelect : a dropdown of viewport scale presets (75% – 200%).
 *                         Independent of theme bundles — applied via CSS
 *                         `zoom` on <html> + a `--theme-scale` custom prop.
 *   - Theme-Button      : an embeddable SVG topbar button that, when clicked,
 *                         opens a pict-section-modal containing the picker,
 *                         the mode toggle, and the scale select. Designed to
 *                         drop into any application chrome.
 *   - Theme-BrandStrip  : the per-app brand signature (icon + name + two
 *                         color stripes). Driven by libThemeBrand which the
 *                         host configures via the `Brand` option.
 *
 * # Recommended consumption (Pict provider)
 *
 * Add the section as a Pict provider — it self-bootstraps on construction:
 *
 *     const libPictSectionTheme = require('pict-section-theme');
 *
 *     pict.addProvider('Theme-Section',
 *     {
 *         ApplyDefault: 'pict-default',
 *         DefaultMode:  'system',
 *         DefaultScale: 1.0,
 *         Brand:        libRetoldManagerBrand
 *     }, libPictSectionTheme);
 *
 * That single addProvider call:
 *   - Ensures `pict.providers.Theme` (the underlying pict-provider-theme
 *     runtime) exists.
 *   - Registers every theme in the runtime registry — bundled starter set
 *     plus anything the host registered via `Catalog.register()`.
 *   - Adds Theme-Picker / Theme-ModeToggle / Theme-ScaleSelect /
 *     Theme-Button / Theme-BrandStrip to `pict.views[...]`.
 *   - Hydrates persisted choices from localStorage; otherwise applies the
 *     supplied `ApplyDefault` / `DefaultMode` / `DefaultScale`.
 *   - Wires the `onApply` save handler so subsequent user picks persist.
 *   - Applies the supplied Brand block if one was provided.
 *
 * # Runtime theme registration
 *
 * The bundled starter set lives in `themes/_catalog.js`. To add custom
 * themes (e.g. a host app's own brand palette, or a remote bundle from
 * a "theme garden") use the registry:
 *
 *     const libCatalog = require('pict-section-theme').Catalog;
 *     libCatalog.register({ Hash: 'my-theme', Bundle: require('./mine.json'), Category: 'App' });
 *     // Or, async, from a URL:
 *     await libCatalog.registerFromURL('https://garden.example.com/themes/foo.json');
 *
 * Themes registered before `addProvider()` runs are picked up
 * automatically. Themes registered after must be manually pushed via
 * `pict.providers.Theme.registerTheme(bundle)`.
 *
 * # Persistence
 *
 * Persisting active theme + mode + scale to localStorage is on by
 * default. Storage key is scoped to `window.location.hostname` so apps
 * on different hosts keep independent state. Override with
 * `PersistenceKey: 'my-app'`. Pass `Persistence: false` to disable.
 *
 * A saved entry takes precedence over `ApplyDefault` — once a user has
 * picked a theme, reloads honour that pick instead of the host's
 * default. If the saved theme hash is no longer in the registry (theme
 * removed, app downgraded), the bootstrap falls back to `ApplyDefault`
 * cleanly.
 *
 * # Legacy API
 *
 * `install(pict, options)` and `registerCatalog(pict)` are still
 * exported as thin shims that delegate to the provider — existing apps
 * keep working without changes.
 */

'use strict';

const libPictProvider = require('pict-provider');
const libPictProviderTheme = require('pict-provider-theme');

const libPickerView = require('./views/PictView-Theme-Picker.js');
const libModeToggleView = require('./views/PictView-Theme-ModeToggle.js');
const libScaleSelectView = require('./views/PictView-Theme-ScaleSelect.js');
const libButtonView = require('./views/PictView-Theme-Button.js');
const libBrandStripView = require('./views/PictView-Theme-BrandStrip.js');
const libBrandMarkView = require('./views/PictView-Theme-Brand-Mark.js');
const libTopBarView = require('./views/PictView-Theme-TopBar.js');
const libBottomBarView = require('./views/PictView-Theme-BottomBar.js');

const libThemePersistence = require('./Theme-Persistence.js');
const libThemeScale = require('./Theme-Scale.js');
const libThemeBrand = require('./Theme-Brand.js');
// Theme-Logo (the deterministic name → SVG generator) is intentionally
// NOT required here. It's a build-time tool used by
// `pict-section-theme-brand` to precompute brand blocks into a host's
// package.json — there's no reason for it to ride along in the runtime
// bundle every host ships. Hosts that want runtime generation can
// `require('pict-section-theme/source/Theme-Logo.js')` directly; that
// keeps the import explicit and the cost opt-in.

const libCatalog = require('./themes/_catalog.js');

// View registry: short-name → { lib, hash } where hash is the
// ViewIdentifier the view registers under in pict.views[...].
const _Views =
{
	Picker:      { lib: libPickerView,      hash: 'Theme-Picker' },
	ModeToggle:  { lib: libModeToggleView,  hash: 'Theme-ModeToggle' },
	ScaleSelect: { lib: libScaleSelectView, hash: 'Theme-ScaleSelect' },
	Button:      { lib: libButtonView,      hash: 'Theme-Button' },
	BrandStrip:  { lib: libBrandStripView,  hash: 'Theme-BrandStrip' },
	BrandMark:   { lib: libBrandMarkView,   hash: 'Theme-Brand-Mark' },
	TopBar:      { lib: libTopBarView,      hash: 'Theme-TopBar' },
	BottomBar:   { lib: libBottomBarView,   hash: 'Theme-BottomBar' }
};

const _ProviderConfiguration =
{
	ProviderIdentifier: 'Theme-Section',

	// Don't auto-fire the standard pict-provider initialize chain — we do
	// our setup work synchronously in the constructor so consumers can
	// use the views immediately after addProvider() returns.
	AutoInitialize: false,

	// Bootstrap config — same shape as the legacy install() options.
	ApplyDefault:    null,    // theme hash to apply at boot
	DefaultMode:     null,    // 'light' | 'dark' | 'system' | null (theme's default)
	DefaultScale:    null,    // 0.75 .. 2.0 — viewport scale
	Persistence:     true,
	PersistenceKey:  null,    // null → window.location.hostname
	RegisterCatalog: true,
	Views:           null,    // null → all views; or array of short-names
	ViewOptions:     null,    // { Picker: { ... }, ... } per-view overrides
	Brand:           null,    // { Name, Icon, Colors: { Primary, ... } }
	ProviderOptions: null     // pict-provider-theme overrides if a host wants them
};

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Iterate the runtime registry and call provider.registerTheme() for each
 * entry. Safe to call before or after addProvider — the runtime's
 * registerTheme is idempotent on repeat hashes.
 *
 * @param {object} pPict - a Pict instance with the Theme runtime attached
 * @returns {number} count of themes registered
 */
function registerCatalog(pPict)
{
	if (!pPict || !pPict.providers || !pPict.providers.Theme)
	{
		if (pPict && pPict.log && pPict.log.warn)
		{
			pPict.log.warn('pict-section-theme.registerCatalog: pict.providers.Theme not found — register the runtime first');
		}
		return 0;
	}
	let tmpProvider = pPict.providers.Theme;
	let tmpEntries = libCatalog.list();
	let tmpCount = 0;
	for (let i = 0; i < tmpEntries.length; i++)
	{
		if (tmpProvider.registerTheme(tmpEntries[i].Bundle))
		{
			tmpCount++;
		}
	}
	return tmpCount;
}

/**
 * Return the registry as picker-friendly metadata (no Bundle payload).
 *
 * @returns {Array<{Hash, Name, Category, Strategy, DefaultMode, IsDefault}>}
 */
function listCatalog()
{
	let tmpEntries = libCatalog.list();
	let tmpList = [];
	for (let i = 0; i < tmpEntries.length; i++)
	{
		let tmpEntry = tmpEntries[i];
		let tmpBundle = tmpEntry.Bundle || {};
		let tmpModes = tmpBundle.Modes || {};
		tmpList.push(
		{
			Hash: tmpEntry.Hash,
			Name: tmpBundle.Name || tmpEntry.Hash,
			Category: tmpEntry.Category || 'Other',
			Strategy: tmpModes.Strategy || 'single',
			DefaultMode: tmpModes.Default || 'light',
			IsDefault: !!tmpEntry.IsDefault
		});
	}
	return tmpList;
}

// ── Bootstrap routine ────────────────────────────────────────────────────
// Shared between the provider class (new path) and the install() function
// (legacy path). Performs the actual wiring against a Pict instance.
function _bootstrap(pPict, pOptions)
{
	if (!pPict || typeof pPict.addProvider !== 'function')
	{
		throw new Error('pict-section-theme: requires a Pict instance');
	}
	let tmpOptions = pOptions || {};

	// 1. Theme runtime — only add if not already attached (hosts with
	//    a custom runtime, e.g. retold-remote's V2 bridge, pre-register).
	if (!pPict.providers || !pPict.providers.Theme)
	{
		let tmpRuntimeOpts = Object.assign({},
			libPictProviderTheme.default_configuration, tmpOptions.ProviderOptions || {});
		pPict.addProvider('Theme', tmpRuntimeOpts, libPictProviderTheme);
	}

	// 2. Catalog — every entry from the runtime registry, unless the host
	//    asked to skip (RegisterCatalog: false).
	if (tmpOptions.RegisterCatalog !== false)
	{
		registerCatalog(pPict);
	}

	// 3. Views — default all five; pass an array to subset.
	let tmpViewNames = Array.isArray(tmpOptions.Views) ? tmpOptions.Views : Object.keys(_Views);
	for (let i = 0; i < tmpViewNames.length; i++)
	{
		let tmpEntry = _Views[tmpViewNames[i]];
		if (!tmpEntry)
		{
			if (pPict.log && pPict.log.warn)
			{
				pPict.log.warn('pict-section-theme: unknown view name "' + tmpViewNames[i] + '" — skipped');
			}
			continue;
		}
		if (pPict.views && pPict.views[tmpEntry.hash])
		{
			// Already registered — skip silently.
			continue;
		}
		let tmpViewOpts = Object.assign({},
			tmpEntry.lib.default_configuration,
			(tmpOptions.ViewOptions && tmpOptions.ViewOptions[tmpViewNames[i]]) || {});
		pPict.addView(tmpEntry.hash, tmpViewOpts, tmpEntry.lib);
	}

	// 4. Persistence + initial apply.
	let tmpProvider = pPict.providers.Theme;
	let tmpPersistenceEnabled = (tmpOptions.Persistence !== false);
	let tmpPersistenceKey = null;

	let tmpBootHash  = tmpOptions.ApplyDefault || null;
	let tmpBootMode  = tmpOptions.DefaultMode  || null;
	let tmpBootScale = (typeof tmpOptions.DefaultScale === 'number') ? tmpOptions.DefaultScale : null;

	if (tmpPersistenceEnabled && tmpProvider)
	{
		tmpPersistenceKey = libThemePersistence.resolveKey(tmpOptions.PersistenceKey);

		let tmpSaved = libThemePersistence.load(tmpPersistenceKey);
		if (tmpSaved
			&& tmpSaved.ThemeHash
			&& typeof tmpProvider.getTheme === 'function'
			&& tmpProvider.getTheme(tmpSaved.ThemeHash))
		{
			tmpBootHash = tmpSaved.ThemeHash;
			if (tmpSaved.Mode)  { tmpBootMode  = tmpSaved.Mode; }
			if (tmpSaved.Scale) { tmpBootScale = tmpSaved.Scale; }
		}
		else if (tmpSaved && tmpSaved.Scale)
		{
			tmpBootScale = tmpSaved.Scale;
		}

		// Single save snapshot — both the provider listener and the scale
		// listener call this so any change persists the full set.
		let tmpSaveCurrent = function ()
		{
			let tmpActive = (typeof tmpProvider.getActiveTheme === 'function')
				? tmpProvider.getActiveTheme() : { Hash: null, Mode: null };
			libThemePersistence.save(tmpPersistenceKey,
			{
				ThemeHash: tmpActive.Hash,
				Mode:      tmpActive.Mode,
				Scale:     libThemeScale.getActive()
			});
		};

		tmpProvider.onApply(tmpSaveCurrent);
		libThemeScale.onChange(tmpSaveCurrent);
	}

	if (tmpBootHash && tmpProvider)
	{
		tmpProvider.applyTheme(tmpBootHash, tmpBootMode);
	}
	if (tmpBootScale !== null)
	{
		libThemeScale.applyScale(tmpBootScale);
	}

	// 5. Brand — host-supplied app identity. Apply LAST so the BrandStrip
	//    view's first paint sees the CSS custom properties.
	if (tmpOptions.Brand)
	{
		libThemeBrand.applyBrand(tmpOptions.Brand);
	}

	// Stash the resolved key on the provider for debugging + so the host
	// can clear it via clearPersistence() for a "reset to defaults"
	// affordance.
	if (tmpProvider && tmpPersistenceKey)
	{
		tmpProvider._persistenceKey = tmpPersistenceKey;
	}

	return tmpProvider;
}

// ── PictProvider class ───────────────────────────────────────────────────
// The recommended entry point. `pict.addProvider('Theme-Section',
// options, PictSectionThemeProvider)` self-bootstraps the whole module
// (runtime + catalog + views + persistence + apply + brand) inside the
// constructor — no follow-up install() call required.
class PictSectionThemeProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.serviceType = 'PictSectionTheme';

		// pict-provider sets `this.pict` for us via super() above. Run the
		// bootstrap synchronously so the views, theme runtime, and applied
		// theme are all in place before addProvider() returns.
		_bootstrap(this.pict, this.options);
	}

	/**
	 * Embed theme controls into a host-supplied container.
	 *
	 * The Theme-Button view ships a popover that hosts the picker + mode
	 * toggle + scale select — convenient for "drop a theme menu in the
	 * topbar" but not for apps that already have a settings surface and
	 * want the controls inline there. `mount()` writes the destination
	 * divs each theme view expects into the supplied container, then
	 * calls render() on each requested view.
	 *
	 * Important: each theme view has a SINGLE default destination id
	 * (e.g. `#Theme-Picker`). Mounting overrides where the view paints —
	 * once mount() is called, the picker / toggle / scale destinations
	 * live inside the supplied container. Combining a mount() with a
	 * Theme-Button popover that ALSO hosts these views causes duplicate
	 * destination ids and undefined behaviour; pick one host per view.
	 *
	 * @param {object} pOptions
	 * @param {string|HTMLElement} pOptions.Container - CSS selector or element
	 * @param {Array<string>} [pOptions.Views] - short names; default ['Picker','ModeToggle','ScaleSelect']
	 * @param {string} [pOptions.WrapperClass] - class added to the outer wrapper div
	 * @returns {object|null} { container, viewsRendered } on success, null if the container can't be resolved
	 */
	mount(pOptions)
	{
		let tmpOpts = pOptions || {};
		let tmpContainer = tmpOpts.Container;
		if (!tmpContainer) { return null; }
		let tmpEl = (typeof tmpContainer === 'string')
			? (this.pict && this.pict.ContentAssignment
				? this.pict.ContentAssignment.getElement(tmpContainer)
				: document.querySelector(tmpContainer))
			: tmpContainer;
		// ContentAssignment.getElement returns an array-like; normalise to one node.
		if (tmpEl && tmpEl.length && !tmpEl.tagName) { tmpEl = tmpEl[0]; }
		if (!tmpEl)
		{
			if (this.pict && this.pict.log && this.pict.log.warn)
			{
				this.pict.log.warn('pict-section-theme.mount: container not found for ' + tmpContainer);
			}
			return null;
		}

		let tmpRequested = Array.isArray(tmpOpts.Views) && tmpOpts.Views.length
			? tmpOpts.Views
			: ['Picker', 'ModeToggle', 'ScaleSelect'];

		// Build a wrapper that carries one row per requested view; each row
		// contains the destination div the view's render() will write into.
		let tmpRows = [];
		let tmpRendered = [];
		for (let i = 0; i < tmpRequested.length; i++)
		{
			let tmpEntry = _Views[tmpRequested[i]];
			if (!tmpEntry) { continue; }
			let tmpDestSel = tmpEntry.lib.default_configuration.DefaultDestinationAddress || '';
			let tmpDestId = tmpDestSel.replace(/^#/, '');
			if (!tmpDestId) { continue; }
			tmpRows.push(
				'<div class="pict-theme-mount-row pict-theme-mount-row-' + tmpEntry.hash.toLowerCase() + '">'
					+ '<div id="' + tmpDestId + '"></div>'
				+ '</div>');
			tmpRendered.push(tmpEntry.hash);
		}

		let tmpWrapperClass = 'pict-theme-mount' + (tmpOpts.WrapperClass ? ' ' + tmpOpts.WrapperClass : '');
		tmpEl.innerHTML = '<div class="' + tmpWrapperClass + '">' + tmpRows.join('') + '</div>';

		// Render each requested view. Each render() targets the destination
		// id we just stamped into the wrapper.
		for (let i = 0; i < tmpRendered.length; i++)
		{
			let tmpView = this.pict.views[tmpRendered[i]];
			if (tmpView && typeof tmpView.render === 'function')
			{
				try { tmpView.render(); }
				catch (pErr) { /* a view render failure shouldn't break the host */ }
			}
		}

		return { container: tmpEl, viewsRendered: tmpRendered };
	}
}

// ── Legacy install() ─────────────────────────────────────────────────────
// Thin shim for apps that already call install(); delegates to the same
// bootstrap routine the provider runs.
function install(pPict, pOptions)
{
	if (!pPict || typeof pPict.addProvider !== 'function')
	{
		throw new Error('pict-section-theme.install: first arg must be a Pict instance');
	}
	return _bootstrap(pPict, pOptions || {});
}

/**
 * Drop the saved theme state for this app's storage key. The next
 * install() (or page reload / addProvider) falls back to ApplyDefault.
 *
 * @param {object} pPict - the pict instance
 * @returns {boolean} true if anything was cleared
 */
function clearPersistence(pPict)
{
	let tmpKey = (pPict && pPict.providers && pPict.providers.Theme && pPict.providers.Theme._persistenceKey)
		|| libThemePersistence.resolveKey(null);
	return libThemePersistence.clear(tmpKey);
}

// ── Exports ──────────────────────────────────────────────────────────────
// Default export = the provider class so apps can do:
//   pict.addProvider('Theme-Section', { ... }, libPictSectionTheme);
//
// Named exports preserved so legacy callers keep working unchanged.
module.exports = PictSectionThemeProvider;
module.exports.default_configuration = _ProviderConfiguration;

module.exports.Provider = libPictProviderTheme;             // the runtime class
module.exports.PictSectionThemeProvider = PictSectionThemeProvider;
module.exports.PickerView = libPickerView;
module.exports.ModeToggleView = libModeToggleView;
module.exports.ButtonView = libButtonView;
module.exports.ScaleSelectView = libScaleSelectView;
module.exports.BrandStripView = libBrandStripView;
module.exports.BrandMarkView = libBrandMarkView;
module.exports.TopBarView = libTopBarView;
module.exports.BottomBarView = libBottomBarView;
module.exports.Catalog = libCatalog;                        // the registry singleton
module.exports.Brand = libThemeBrand;                       // the brand helper module
module.exports.Scale = libThemeScale;                       // the scale helper module
module.exports.Persistence = libThemePersistence;           // the persistence helper module
// Theme-Logo is exposed as a sub-module path, not a top-level field —
// see the comment near the imports above.
module.exports.registerCatalog = registerCatalog;
module.exports.listCatalog = listCatalog;
module.exports.install = install;
module.exports.clearPersistence = clearPersistence;
