/**
 * Theme-Button — an embeddable SVG button (sun/moon glyph) suitable for
 * application top bars. Clicking it opens a pict-section-modal popup
 * containing the Theme-Picker dropdown and the Theme-ModeToggle.
 *
 * Drop-in destination: `<div id="Theme-Button"></div>`. The button itself
 * is a tiny self-contained SVG that picks its color from the theme via
 * `currentColor` so it inherits the surrounding text color.
 *
 * Requires `pict-section-modal` to be registered (under the view hash
 * `Pict-Section-Modal` by default). If it isn't, clicking the button
 * falls back to a `console.warn` and a no-op.
 */

const libPictView = require('pict-view');
const libThemeIcons = require('../Theme-Icons.js');

const _ViewConfiguration =
{
	ViewIdentifier: 'Theme-Button',
	AutoInitialize: true,
	AutoRender: false,

	DefaultDestinationAddress: '#Theme-Button',
	DefaultRenderable: 'Theme-Button-Renderable',

	ProviderHash: 'Theme',
	ModalViewHash: 'Pict-Section-Modal',

	// Identifiers of the picker / toggle / scale views that the popup
	// will mount. Each one is optional — if a view isn't registered the
	// matching row is silently skipped (no broken DOM placeholders).
	PickerViewHash: 'Theme-Picker',
	ModeToggleViewHash: 'Theme-ModeToggle',
	ScaleSelectViewHash: 'Theme-ScaleSelect',

	// Visible button label / title (tooltip).
	Title: 'Theme',
	AriaLabel: 'Open theme menu',

	// Modal title.
	ModalTitle: 'Theme',

	// Modal width (CSS).
	ModalWidth: '320px',

	Templates:
	[
		{
			Hash: 'Theme-Button-Template',
			// SVG sourced from the shared Theme-Icons module so the
			// topbar glyph matches the picker + mode toggle exactly.
			Template: /*html*/`
<button type="button"
        class="pict-theme-button"
        aria-label="{~D:AppData.PictSectionTheme.Button.AriaLabel~}"
        title="{~D:AppData.PictSectionTheme.Button.Title~}"
        onclick="_Pict.views['Theme-Button'].openMenu();">
	${libThemeIcons.iconSun(16)}
</button>`
		},
		{
			Hash: 'Theme-Button-Modal-Template',
			Template: /*html*/`
<div class="pict-theme-button-menu">
	<div class="pict-theme-button-menu-row">
		<label class="pict-theme-button-menu-label">Theme</label>
		<div id="Theme-Picker"></div>
	</div>
	<div class="pict-theme-button-menu-row">
		<label class="pict-theme-button-menu-label">Mode</label>
		<div id="Theme-ModeToggle"></div>
	</div>
	<div class="pict-theme-button-menu-row">
		<label class="pict-theme-button-menu-label">Scale</label>
		<div id="Theme-ScaleSelect"></div>
	</div>
</div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'Theme-Button-Renderable',
			TemplateHash: 'Theme-Button-Template',
			ContentDestinationAddress: '#Theme-Button',
			RenderMethod: 'replace'
		}
	],

	CSS: /*css*/`
.pict-theme-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	/* Sized to match a typical 12px-font / 6px-12px-padding text button
	   (~28px tall) so this drops cleanly into a topbar row alongside
	   action buttons without standing taller and crashing the row's
	   visual rhythm. Squareish — width matches height for the icon. */
	width: 28px;
	height: 28px;
	padding: 0;
	border-radius: 6px;
	border: 1px solid var(--theme-color-border-default, #cfd5dd);
	background: var(--theme-color-background-secondary, #fbfbfc);
	color: var(--theme-color-text-secondary, #4a5568);
	cursor: pointer;
	transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}
.pict-theme-button:hover {
	background: var(--theme-color-background-hover, #f0f0f0);
	color: var(--theme-color-brand-primary, #2563eb);
	border-color: var(--theme-color-brand-primary, #2563eb);
}
.pict-theme-button-icon { width: 16px; height: 16px; }
.pict-theme-button-menu { display: flex; flex-direction: column; gap: 14px; }
.pict-theme-button-menu-row { display: flex; flex-direction: column; gap: 6px; }
.pict-theme-button-menu-label {
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.4px;
	text-transform: uppercase;
	color: var(--theme-color-text-muted, #6b6b6b);
}`,
	CSSPriority: 500
};

class PictViewThemeButton extends libPictView
{
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
	 * onclick handler — open the theme menu in a modal.
	 */
	openMenu()
	{
		let tmpModal = this._modal();
		if (!tmpModal)
		{
			if (typeof console !== 'undefined')
			{
				console.warn('Theme-Button: pict-section-modal view not found at "'
					+ (this.options.ModalViewHash || 'Pict-Section-Modal')
					+ '" — cannot open theme menu.');
			}
			return null;
		}

		let tmpHTML = this.pict.parseTemplateByHash('Theme-Button-Modal-Template', {});

		let tmpSelf = this;
		return tmpModal.show(
		{
			title: this.options.ModalTitle || 'Theme',
			content: tmpHTML,
			width: this.options.ModalWidth || '320px',
			closeable: true,
			buttons: [],
			onOpen: function ()
			{
				// Mount the picker + toggle into the freshly-created
				// modal DOM. The views look up their own destinations
				// so a simple render() is enough.
				tmpSelf._mountSubViews();
			}
		});
	}

	// ================================================================
	// Internals
	// ================================================================

	_modal()
	{
		let tmpHash = this.options.ModalViewHash || 'Pict-Section-Modal';
		return this.pict && this.pict.views && this.pict.views[tmpHash];
	}

	_mountSubViews()
	{
		let tmpPicker = this.pict.views[this.options.PickerViewHash || 'Theme-Picker'];
		if (tmpPicker)
		{
			tmpPicker.render();
		}
		let tmpToggle = this.pict.views[this.options.ModeToggleViewHash || 'Theme-ModeToggle'];
		if (tmpToggle)
		{
			tmpToggle.render();
		}
		let tmpScale = this.pict.views[this.options.ScaleSelectViewHash || 'Theme-ScaleSelect'];
		if (tmpScale)
		{
			tmpScale.render();
		}
	}

	_refreshAppData()
	{
		this.pict.AppData.PictSectionTheme = this.pict.AppData.PictSectionTheme || {};
		this.pict.AppData.PictSectionTheme.Button =
		{
			Title: this.options.Title || 'Theme',
			AriaLabel: this.options.AriaLabel || 'Open theme menu'
		};
	}
}

PictViewThemeButton.default_configuration = _ViewConfiguration;

module.exports = PictViewThemeButton;
