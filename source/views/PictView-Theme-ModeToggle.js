/**
 * Theme-ModeToggle — three-segment toggle for Light / Dark / System mode.
 *
 * Calls `provider.setMode(...)` on click. Greys itself out (and the
 * Dark / System buttons) when the active theme is single-mode (since
 * single-mode themes ignore mode requests internally).
 *
 * Like the Picker, subscribes to `provider.onApply` so the active button
 * highlight stays in sync with theme changes from elsewhere.
 *
 * Drop-in destination: `<div id="Theme-ModeToggle"></div>`.
 */

const libPictView = require('pict-view');
const libThemeIcons = require('../Theme-Icons.js');

const _ViewConfiguration =
{
	ViewIdentifier: 'Theme-ModeToggle',
	AutoInitialize: true,
	AutoRender: false,

	DefaultDestinationAddress: '#Theme-ModeToggle',
	DefaultRenderable: 'Theme-ModeToggle-Renderable',

	ProviderHash: 'Theme',

	// Allow hosts to relabel buttons (i18n). Order is fixed.
	Labels:
	{
		Light:  'Light',
		Dark:   'Dark',
		System: 'System'
	},

	// Show the inline sun / moon / monitor SVG icons next to the labels.
	ShowIcons: true,

	Templates:
	[
		{
			Hash: 'Theme-ModeToggle-Template',
			Template: /*html*/`
<div class="pict-theme-modetoggle-wrap">
	<div class="pict-theme-modetoggle{~NE:AppData.PictSectionTheme.ModeToggle.Disabled^ pict-theme-modetoggle-disabled~}"
	     role="group" aria-label="Color mode"
	     title="{~D:AppData.PictSectionTheme.ModeToggle.WrapTitle~}">
		{~TS:Theme-ModeToggle-Button-Template:AppData.PictSectionTheme.ModeToggle.Buttons~}
	</div>
	{~TS:Theme-ModeToggle-LockedNote-Template:AppData.PictSectionTheme.ModeToggle.LockedNoteSlot~}
</div>`
		},
		{
			Hash: 'Theme-ModeToggle-Button-Template',
			Template: /*html*/`
<button type="button"
        class="pict-theme-modetoggle-btn{~NE:Record.Active^ pict-theme-modetoggle-btn-active~}{~NE:Record.LockedOut^ pict-theme-modetoggle-btn-lockedout~}"
        title="{~D:Record.Title~}"
        aria-pressed="{~D:Record.Active~}"
        aria-disabled="{~D:Record.LockedOut~}"
        onclick="_Pict.views['Theme-ModeToggle'].pickMode('{~D:Record.Mode~}');">
	{~TS:Theme-ModeToggle-Icon-Light:Record.IconLight~}{~TS:Theme-ModeToggle-Icon-Dark:Record.IconDark~}{~TS:Theme-ModeToggle-Icon-System:Record.IconSystem~}<span class="pict-theme-modetoggle-label">{~D:Record.Label~}</span>
</button>`
		},
		{
			Hash: 'Theme-ModeToggle-LockedNote-Template',
			Template: /*html*/`
<div class="pict-theme-modetoggle-locked-note" role="note">
	<svg class="pict-theme-modetoggle-locked-icon" viewBox="0 0 24 24" fill="none"
	     stroke="currentColor" stroke-width="2" stroke-linecap="round"
	     stroke-linejoin="round" aria-hidden="true">
		<rect x="4" y="11" width="16" height="9" rx="2"/>
		<path d="M8 11V7a4 4 0 0 1 8 0v4"/>
	</svg>
	<span>{~D:Record.Message~}</span>
</div>`
		},
		// Icon templates pull SVG markup from the shared Theme-Icons
		// module so the picker, toggle, and topbar button stay visually
		// consistent — change the glyph in one place, every consumer
		// updates.
		{
			Hash: 'Theme-ModeToggle-Icon-Light',
			Template: libThemeIcons.iconSun()
		},
		{
			Hash: 'Theme-ModeToggle-Icon-Dark',
			Template: libThemeIcons.iconMoon()
		},
		{
			Hash: 'Theme-ModeToggle-Icon-System',
			Template: libThemeIcons.iconSystem()
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'Theme-ModeToggle-Renderable',
			TemplateHash: 'Theme-ModeToggle-Template',
			ContentDestinationAddress: '#Theme-ModeToggle',
			RenderMethod: 'replace'
		}
	],

	CSS: /*css*/`
.pict-theme-modetoggle-wrap { display: inline-flex; flex-direction: column; gap: 6px; }
.pict-theme-modetoggle {
	display: inline-flex;
	border: 1px solid var(--theme-color-border-default, #cfd5dd);
	border-radius: 6px;
	overflow: hidden;
	background: var(--theme-color-background-secondary, #fbfbfc);
	font-size: 12px;
}
.pict-theme-modetoggle-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 10px;
	border: 0;
	background: transparent;
	color: var(--theme-color-text-secondary, #4a5568);
	cursor: pointer;
	border-right: 1px solid var(--theme-color-border-default, #cfd5dd);
	transition: background-color 120ms ease, color 120ms ease;
}
.pict-theme-modetoggle-btn:last-child { border-right: 0; }
.pict-theme-modetoggle-btn:hover {
	background: var(--theme-color-background-hover, #f0f0f0);
	color: var(--theme-color-text-primary, #1f2933);
}
.pict-theme-modetoggle-btn-active {
	background: var(--theme-color-brand-primary, #2563eb);
	color: var(--theme-color-text-on-brand, #ffffff);
}
.pict-theme-modetoggle-btn-active:hover {
	background: var(--theme-color-brand-primary-hover, #1e54cc);
	color: var(--theme-color-text-on-brand, #ffffff);
}
/* When the active theme is single-mode the entire group becomes
   non-interactive. The locked-out buttons (the ones the theme cannot
   switch to) get a strikethrough so the cause is unmistakable; the
   active button stays styled normally so users can still see which
   mode the theme IS using. */
.pict-theme-modetoggle-disabled .pict-theme-modetoggle-btn {
	pointer-events: none;
	cursor: not-allowed;
}
.pict-theme-modetoggle-disabled .pict-theme-modetoggle-btn-lockedout {
	opacity: 0.45;
	text-decoration: line-through;
	text-decoration-thickness: 1.5px;
}
/* Icons come from Theme-Icons.js with explicit width/height baked into
   the <svg>. We only need to nudge their vertical alignment with the
   button label. */
.pict-theme-modetoggle .pict-theme-icon {
	display: inline-block; vertical-align: -2px;
}
.pict-theme-modetoggle-label { line-height: 1; }
.pict-theme-modetoggle-locked-note {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 11px;
	line-height: 1.3;
	color: var(--theme-color-text-muted, #6b6b6b);
	padding: 0 2px;
}
.pict-theme-modetoggle-locked-icon {
	width: 12px; height: 12px;
	flex: 0 0 12px;
	color: var(--theme-color-text-muted, #6b6b6b);
}`,
	CSSPriority: 500
};

// The icon SVGs themselves live as templates above (Theme-ModeToggle-Icon-*).
// Per CLAUDE.md "AppData stores data, not HTML" — we drive icon selection
// with one-or-zero element arrays (`Record.IconLight = [{}]` to render the
// Light icon, `[]` to skip it). Each template is keyed off `Record.Mode`.

class PictViewThemeModeToggle extends libPictView
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
	 * onclick handler — flip mode on the active theme. Single-mode themes
	 * silently ignore (the toggle is shown disabled in that case anyway).
	 */
	pickMode(pMode)
	{
		let tmpProvider = this._provider();
		if (!tmpProvider) return false;
		let tmpOk = tmpProvider.setMode(pMode);

		if (tmpOk && typeof this.options.OnModeChange === 'function')
		{
			try { this.options.OnModeChange(pMode); }
			catch (pErr) { /* host hook failure */ }
		}

		// setMode fires onApply listeners which trigger our own re-render.
		// If single-mode rejected the change, force a re-render so the UI
		// state is still consistent.
		if (!tmpOk)
		{
			this.render();
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

	_refreshAppData()
	{
		let tmpProvider = this._provider();
		let tmpActive = tmpProvider ? tmpProvider.getActiveTheme() : null;
		let tmpActiveMode = (tmpActive && tmpActive.Mode) || 'light';

		// Detect single-mode (Strategy === 'single') so we can lock the
		// toggle and surface the reason the buttons aren't responding.
		let tmpDisabled = false;
		let tmpLockedToMode = null;
		let tmpThemeName = null;
		if (tmpActive && tmpActive.Hash && tmpProvider && typeof tmpProvider.getTheme === 'function')
		{
			let tmpBundle = tmpProvider.getTheme(tmpActive.Hash);
			let tmpStrategy = (tmpBundle && tmpBundle.Modes && tmpBundle.Modes.Strategy) || 'single';
			tmpDisabled = (tmpStrategy === 'single');
			if (tmpDisabled)
			{
				tmpLockedToMode = (tmpBundle.Modes && tmpBundle.Modes.Default) || tmpActiveMode || 'light';
				tmpThemeName = tmpBundle.Name || tmpBundle.Hash || 'this theme';
			}
		}

		let tmpLabels = this.options.Labels || _ViewConfiguration.Labels;
		let tmpShowIcons = (this.options.ShowIcons !== false);

		// Use one-or-zero element arrays to drive each icon template so
		// the icon SVG never gets stuffed into AppData as a raw string.
		let tmpModeRows =
		[
			{ Mode: 'light',  Label: tmpLabels.Light  || 'Light' },
			{ Mode: 'dark',   Label: tmpLabels.Dark   || 'Dark' },
			{ Mode: 'system', Label: tmpLabels.System || 'System' }
		];
		let tmpButtons = [];
		for (let i = 0; i < tmpModeRows.length; i++)
		{
			let tmpRow = tmpModeRows[i];
			let tmpIsActive = (tmpActiveMode === tmpRow.Mode);
			// "Locked out" = single-mode theme AND this button is not the
			// mode the theme is fixed to. The active button keeps normal
			// styling so users can still see which mode is in use.
			let tmpLockedOut = tmpDisabled && (tmpRow.Mode !== tmpLockedToMode);
			let tmpTitle;
			if (tmpLockedOut)
			{
				let tmpLockedLabel = tmpLockedToMode.charAt(0).toUpperCase() + tmpLockedToMode.slice(1);
				tmpTitle = tmpThemeName + ' is fixed to ' + tmpLockedLabel + ' mode — pick a different theme to switch.';
			}
			else
			{
				tmpTitle = tmpRow.Label + ' mode';
			}
			tmpButtons.push(
			{
				Mode: tmpRow.Mode,
				Label: tmpRow.Label,
				Title: tmpTitle,
				Active: tmpIsActive,
				LockedOut: tmpLockedOut,
				IconLight:  (tmpShowIcons && tmpRow.Mode === 'light')  ? [{}] : [],
				IconDark:   (tmpShowIcons && tmpRow.Mode === 'dark')   ? [{}] : [],
				IconSystem: (tmpShowIcons && tmpRow.Mode === 'system') ? [{}] : []
			});
		}

		// One-or-zero element array drives the locked-note template
		// (per CLAUDE.md "single-element-array trick"). Empty array →
		// note skipped entirely.
		let tmpLockedNoteSlot = [];
		let tmpWrapTitle = '';
		if (tmpDisabled)
		{
			let tmpLockedLabel = tmpLockedToMode.charAt(0).toUpperCase() + tmpLockedToMode.slice(1);
			let tmpMessage = tmpThemeName + ' is fixed to ' + tmpLockedLabel + ' mode';
			tmpLockedNoteSlot = [{ Message: tmpMessage }];
			tmpWrapTitle = tmpMessage + ' — pick a different theme to switch modes.';
		}

		this.pict.AppData.PictSectionTheme = this.pict.AppData.PictSectionTheme || {};
		this.pict.AppData.PictSectionTheme.ModeToggle =
		{
			ActiveMode: tmpActiveMode,
			Disabled: tmpDisabled,
			LockedToMode: tmpLockedToMode,
			ThemeName: tmpThemeName,
			Buttons: tmpButtons,
			LockedNoteSlot: tmpLockedNoteSlot,
			WrapTitle: tmpWrapTitle
		};
	}
}

PictViewThemeModeToggle.default_configuration = _ViewConfiguration;

module.exports = PictViewThemeModeToggle;
