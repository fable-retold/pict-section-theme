/**
 * Theme-Picker — a custom dropdown that lists every theme registered
 * with the Theme provider, grouped by category.
 *
 * Renders as a trigger button showing the active theme name + a chevron.
 * Click → opens a `pict-section-modal` dropdown menu where each row is
 * the theme name plus an inline SVG glyph indicating the modes the
 * theme supports (sun for light-only, moon for dark-only, sun+moon for
 * paired). This is why we ditched the native <select>: option elements
 * can't render SVG, only plain text, and the unicode crescent
 * substitutes that earlier looked like dental glyphs.
 *
 * Subscribes to `provider.onApply` so a theme switch from elsewhere
 * (the modal-tucked picker, a hotkey, persistence restore) keeps the
 * trigger button in sync.
 *
 * Drop-in destination: `<div id="Theme-Picker"></div>`.
 *
 * # Modal section dependency
 *
 * Requires pict-section-modal to be registered (the dropdown popover
 * is a modal-section feature, not a hand-rolled DOM widget). When
 * pict-section-theme.install() is used, the host always has the modal
 * section available because Theme-Button needs it too. If you add this
 * view manually without the modal section, the trigger button will
 * still render but clicking it logs a warning and no-ops.
 */

const libPictView = require('pict-view');
const libThemeIcons = require('../Theme-Icons.js');

// AppData address used to surface picker state to templates.
const APPDATA_ADDRESS = 'PictSectionTheme.Picker';

const _ViewConfiguration =
{
	ViewIdentifier: 'Theme-Picker',
	AutoInitialize: true,
	AutoRender: false,

	DefaultDestinationAddress: '#Theme-Picker',
	DefaultRenderable: 'Theme-Picker-Renderable',

	ProviderHash: 'Theme',
	ModalViewHash: 'Pict-Section-Modal',

	// Optional categories block — array describing the optgroup order.
	// If omitted we discover categories from the provider's themes in
	// first-seen order.
	Categories: null,

	// Show the per-row mode-capability glyph (sun / moon / sun+moon) as
	// the leading icon on each dropdown item. Default on. Pass false if
	// you want a plainer menu.
	ShowModeIcons: true,

	Templates:
	[
		{
			Hash: 'Theme-Picker-Template',
			// Trigger button that mirrors a native <select>'s look but
			// can carry SVG content. Clicking opens the modal dropdown.
			Template: /*html*/`
<button type="button" class="pict-theme-picker"
        title="{~D:AppData.PictSectionTheme.Picker.TriggerTooltip~}"
        onclick="_Pict.views['Theme-Picker'].openMenu(this);">
	{~TS:Theme-Picker-Trigger-Glyph:AppData.PictSectionTheme.Picker.TriggerGlyphSlot~}
	<span class="pict-theme-picker-name">{~D:AppData.PictSectionTheme.Picker.ActiveLabel~}</span>
	<span class="pict-theme-picker-chevron">{~D:AppData.PictSectionTheme.Picker.ChevronHTML~}</span>
</button>`
		},
		{
			// Wrapped in a 1-or-0 element array so the trigger glyph is
			// optional (ShowModeIcons: false → empty slot, no leading
			// icon). Per CLAUDE.md "AppData stores data, not HTML".
			Hash: 'Theme-Picker-Trigger-Glyph',
			Template: /*html*/`<span class="pict-theme-picker-trigger-glyph">{~D:Record.IconHTML~}</span>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'Theme-Picker-Renderable',
			TemplateHash: 'Theme-Picker-Template',
			ContentDestinationAddress: '#Theme-Picker',
			RenderMethod: 'replace'
		}
	],

	CSS: /*css*/`
.pict-theme-picker {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	min-width: 200px;
	max-width: 100%;
	padding: 6px 10px;
	border-radius: 6px;
	font: inherit;
	font-size: 13px;
	background: var(--theme-color-background-secondary, #fbfbfc);
	color: var(--theme-color-text-primary, #1f2933);
	border: 1px solid var(--theme-color-border-default, #cfd5dd);
	cursor: pointer;
	text-align: left;
	transition: border-color 120ms ease, box-shadow 120ms ease;
}
.pict-theme-picker:hover { border-color: var(--theme-color-text-muted, #6b6b6b); }
.pict-theme-picker:focus, .pict-theme-picker:focus-visible {
	outline: none;
	border-color: var(--theme-color-brand-primary, #2563eb);
	box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.pict-theme-picker .pict-theme-picker-name {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.pict-theme-picker .pict-theme-picker-chevron {
	color: var(--theme-color-text-muted, #6b6b6b);
	display: inline-flex;
	align-items: center;
}
.pict-theme-picker-trigger-glyph {
	display: inline-flex; align-items: center;
	color: var(--theme-color-text-muted, #6b6b6b);
}

/* Skin the modal-dropdown items with cleaner spacing for our glyphs. */
.pict-theme-picker-menu .pict-modal-dropdown-item-icon {
	width: 28px;
	display: inline-flex;
	align-items: center;
	justify-content: flex-start;
	color: var(--theme-color-text-muted, #6b6b6b);
}
.pict-theme-picker-menu .pict-modal-dropdown-item--active {
	background: var(--theme-color-background-selected, #e0eaff);
	color: var(--theme-color-brand-primary, #2563eb);
}
.pict-theme-picker-menu .pict-modal-dropdown-item--active .pict-modal-dropdown-item-icon {
	color: var(--theme-color-brand-primary, #2563eb);
}`,
	CSSPriority: 500
};

class PictViewThemePicker extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this._unsubscribeFromProvider = null;
	}

	onAfterInitialize()
	{
		this._subscribeToProvider();
		return super.onAfterInitialize ? super.onAfterInitialize() : undefined;
	}

	onBeforeRender(pRenderable)
	{
		this._refreshAppData();
		return super.onBeforeRender ? super.onBeforeRender(pRenderable) : undefined;
	}

	onAfterRender(pRenderable, pAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();
		return super.onAfterRender
			? super.onAfterRender(pRenderable, pAddress, pRecord, pContent)
			: undefined;
	}

	/**
	 * onclick handler — open the rich dropdown menu via pict-section-modal.
	 * @param {HTMLElement} pAnchor - the trigger button (click target)
	 */
	openMenu(pAnchor)
	{
		let tmpModal = this._modal();
		if (!tmpModal)
		{
			if (typeof console !== 'undefined' && console.warn)
			{
				console.warn('Theme-Picker: pict-section-modal not registered — cannot open menu.');
			}
			return null;
		}

		let tmpItems = this._buildMenuItems();
		let tmpSelf = this;
		return tmpModal.dropdown(pAnchor,
		{
			items: tmpItems,
			align: 'left',
			minWidth: '260px',
			maxHeight: '60vh',
			className: 'pict-theme-picker-menu',
			closeOnSelect: true,
			onSelect: function (pHash) { tmpSelf.pick(pHash); }
		});
	}

	/**
	 * Apply the picked theme. Public so external callers can drive the
	 * picker programmatically too (hotkeys, tests, etc.).
	 */
	pick(pHash)
	{
		let tmpProvider = this._provider();
		if (!tmpProvider) return false;

		// Preserve the current user-facing mode if the new theme
		// supports modes. Single-mode themes will clamp internally.
		let tmpActive = tmpProvider.getActiveTheme();
		let tmpMode = tmpActive ? tmpActive.Mode : null;

		let tmpOk = tmpProvider.applyTheme(pHash, tmpMode);

		if (tmpOk && typeof this.options.OnPick === 'function')
		{
			try { this.options.OnPick(pHash); }
			catch (pErr) { /* host hook failure */ }
		}
		return tmpOk;
	}

	// ================================================================
	// Internals
	// ================================================================

	_subscribeToProvider()
	{
		if (this._unsubscribeFromProvider) return;
		let tmpProvider = this._provider();
		if (!tmpProvider || typeof tmpProvider.onApply !== 'function') return;
		let tmpSelf = this;
		this._unsubscribeFromProvider = tmpProvider.onApply(function ()
		{
			tmpSelf.render();
		});
	}

	_provider()
	{
		let tmpHash = this.options.ProviderHash || 'Theme';
		return this.pict && this.pict.providers && this.pict.providers[tmpHash];
	}

	_modal()
	{
		let tmpHash = this.options.ModalViewHash || 'Pict-Section-Modal';
		return this.pict && this.pict.views && this.pict.views[tmpHash];
	}

	/**
	 * Build the modal-dropdown `items` array from the registered themes
	 * + the catalog's category metadata. One Header row per category,
	 * one item per theme with a leading SVG capability glyph.
	 */
	_buildMenuItems()
	{
		let tmpProvider = this._provider();
		let tmpThemes = tmpProvider ? tmpProvider.listThemes() : [];
		let tmpActive = tmpProvider ? tmpProvider.getActiveTheme() : { Hash: null };
		let tmpActiveHash = (tmpActive && tmpActive.Hash) || null;

		let tmpCatalog = this._loadCatalog();
		let tmpCategoryByHash = {};
		let tmpCategoryOrder = [];
		if (Array.isArray(this.options.Categories))
		{
			tmpCategoryOrder = this.options.Categories.slice();
		}
		for (let i = 0; i < tmpCatalog.length; i++)
		{
			let tmpEntry = tmpCatalog[i];
			let tmpCat = tmpEntry.Category || 'Other';
			tmpCategoryByHash[tmpEntry.Hash] = tmpCat;
			if (tmpCategoryOrder.indexOf(tmpCat) < 0) tmpCategoryOrder.push(tmpCat);
		}

		let tmpBuckets = {};
		for (let i = 0; i < tmpThemes.length; i++)
		{
			let tmpTheme = tmpThemes[i];
			let tmpCat = tmpCategoryByHash[tmpTheme.Hash] || 'Other';
			if (!tmpBuckets[tmpCat])
			{
				tmpBuckets[tmpCat] = [];
				if (tmpCategoryOrder.indexOf(tmpCat) < 0) tmpCategoryOrder.push(tmpCat);
			}
			tmpBuckets[tmpCat].push(tmpTheme);
		}

		let tmpShowIcons = (this.options.ShowModeIcons !== false);
		let tmpItems = [];
		for (let i = 0; i < tmpCategoryOrder.length; i++)
		{
			let tmpCat = tmpCategoryOrder[i];
			if (!tmpBuckets[tmpCat] || tmpBuckets[tmpCat].length === 0) continue;
			tmpItems.push({ Header: tmpCat });
			for (let j = 0; j < tmpBuckets[tmpCat].length; j++)
			{
				let tmpTheme = tmpBuckets[tmpCat][j];
				let tmpIcon = tmpShowIcons
					? libThemeIcons.iconForTheme(tmpTheme.Strategy, tmpTheme.DefaultMode, 14)
					: '';
				tmpItems.push(
				{
					Hash: tmpTheme.Hash,
					Label: tmpTheme.Name || tmpTheme.Hash,
					Icon: tmpIcon,
					Style: (tmpTheme.Hash === tmpActiveHash) ? 'active' : null,
					Tooltip: this._capabilityLabel(tmpTheme)
				});
			}
		}

		return tmpItems;
	}

	_capabilityLabel(pTheme)
	{
		let tmpStrategy = pTheme.Strategy || 'single';
		if (tmpStrategy === 'single')
		{
			let tmpMode = pTheme.DefaultMode || 'light';
			return (pTheme.Name || pTheme.Hash) + ' — '
				+ (tmpMode === 'dark' ? 'dark only' : 'light only');
		}
		return (pTheme.Name || pTheme.Hash) + ' — light + dark';
	}

	_refreshAppData()
	{
		let tmpProvider = this._provider();
		let tmpThemes = tmpProvider ? tmpProvider.listThemes() : [];
		let tmpActive = tmpProvider ? tmpProvider.getActiveTheme() : { Hash: null };
		let tmpActiveHash = (tmpActive && tmpActive.Hash) || null;

		// Find the active theme's metadata for the trigger glyph.
		let tmpActiveTheme = null;
		for (let i = 0; i < tmpThemes.length; i++)
		{
			if (tmpThemes[i].Hash === tmpActiveHash) { tmpActiveTheme = tmpThemes[i]; break; }
		}

		let tmpShowIcons = (this.options.ShowModeIcons !== false);
		let tmpTriggerGlyphSlot = [];
		if (tmpShowIcons && tmpActiveTheme)
		{
			tmpTriggerGlyphSlot = [{
				IconHTML: libThemeIcons.iconForTheme(tmpActiveTheme.Strategy, tmpActiveTheme.DefaultMode, 14)
			}];
		}

		this.pict.AppData.PictSectionTheme = this.pict.AppData.PictSectionTheme || {};
		this.pict.AppData.PictSectionTheme.Picker =
		{
			ActiveHash: tmpActiveHash,
			ActiveLabel: tmpActiveTheme ? (tmpActiveTheme.Name || tmpActiveTheme.Hash) : 'Choose a theme',
			TriggerTooltip: tmpActiveTheme
				? this._capabilityLabel(tmpActiveTheme) + ' — click to change'
				: 'Choose a theme',
			TriggerGlyphSlot: tmpTriggerGlyphSlot,
			ChevronHTML: libThemeIcons.iconChevronDown(10)
		};
		this.pict.AppData.PictSectionTheme.AllThemes = tmpThemes;
	}

	_loadCatalog()
	{
		try { return require('../themes/_catalog.js'); }
		catch (pError) { return []; }
	}
}

PictViewThemePicker.default_configuration = _ViewConfiguration;
PictViewThemePicker.APPDATA_ADDRESS = APPDATA_ADDRESS;

module.exports = PictViewThemePicker;
