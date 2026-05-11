/**
 * Theme-BottomBar — standard application footer row.
 *
 * The bottom-row counterpart to Theme-TopBar: a thin status / chrome bar
 * that sits at the absolute bottom of the application shell. Three
 * zones — status text on the left, info indicators in the middle, and
 * action buttons / toggles on the right.
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ Status text          [── Info slot (flex) ──]      [actions]   │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Renders into `#Theme-BottomBar` by default.
 *
 * Three slots host views drop content into:
 *   - `#Theme-BottomBar-Status`  — short status / state line (left)
 *   - `#Theme-BottomBar-Info`    — center info: connection, version,
 *                                  ambient indicators
 *   - `#Theme-BottomBar-Actions` — log toggle, debug controls, etc.
 *
 * Top border uses `--brand-color-secondary-mode` so the bottombar gets
 * a brand-tinted edge that's visually distinct from the topbar's
 * primary-color stripe.
 */

const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: 'Theme-BottomBar',
	AutoInitialize: true,
	AutoRender: false,

	DefaultDestinationAddress: '#Theme-BottomBar',
	DefaultRenderable: 'Theme-BottomBar-Renderable',

	// ViewIdentifier of a host view that fills #Theme-BottomBar-Status.
	StatusView: null,
	// ViewIdentifier of a host view that fills #Theme-BottomBar-Info.
	InfoView: null,
	// ViewIdentifier of a host view that fills #Theme-BottomBar-Actions.
	ActionsView: null,

	// Height of the bar in pixels. Drives the min-height on the chrome
	// row so it fills the panel cleanly even when the parent chain
	// (pict-section-modal shell uses min-height: 100% on its panel
	// content destination, which doesn't resolve through plain
	// height: 100% chains) doesn't establish a determinate height.
	// Hosts should match this to whatever Size they use on the panel
	// addPanel() call so the chrome and panel agree on the row size.
	Height: 32,

	Templates:
	[
		{
			Hash: 'Theme-BottomBar-Template',
			Template: /*html*/`
<div class="pict-theme-bottombar">
	<div class="pict-theme-bottombar-status" id="Theme-BottomBar-Status"></div>
	<div class="pict-theme-bottombar-info" id="Theme-BottomBar-Info"></div>
	<div class="pict-theme-bottombar-actions" id="Theme-BottomBar-Actions"></div>
</div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'Theme-BottomBar-Renderable',
			TemplateHash: 'Theme-BottomBar-Template',
			ContentDestinationAddress: '#Theme-BottomBar',
			RenderMethod: 'replace'
		}
	],

	CSS: /*css*/`
.pict-theme-bottombar {
	display: flex;
	align-items: center;
	gap: 14px;
	/* The min-height is rewritten per-instance in onAfterRender from the
	   Height option (default 32). A fixed px value avoids the
	   percent-height resolution trap the pict-section-modal shell sets
	   up — see the comment on Theme-TopBar's CSS for the full story. */
	min-height: 32px;
	padding: 0 14px;
	box-sizing: border-box;
	background: var(--theme-color-background-secondary, transparent);
	font-size: var(--theme-typography-size-xs, 12px);
	color: var(--theme-color-text-secondary, #4a5568);
	/* Single medium brand-primary stripe at the top of the bottombar.
	   The topbar carries the full two-stripe identifier; on the
	   bottombar (which is only 32px tall) a single 2px primary line is
	   enough to seat the brand colour at the bottom of the page
	   without competing for visual weight against the content row. */
	border-top: 2px solid var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
}
.pict-theme-bottombar-status {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 50%;
}
.pict-theme-bottombar-info {
	flex: 1 1 auto;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
	min-width: 0;
	overflow: hidden;
}
.pict-theme-bottombar-actions {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	gap: 6px;
}`,
	CSSPriority: 500
};

class PictViewThemeBottomBar extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender(pRenderable, pAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();

		// Apply the configured Height to the rendered .pict-theme-bottombar
		// — see the matching block in Theme-TopBar's onAfterRender for why.
		if (typeof document !== 'undefined' && this.options.Height)
		{
			let tmpRoot = document.querySelector('.pict-theme-bottombar');
			if (tmpRoot) { tmpRoot.style.minHeight = this.options.Height + 'px'; }
		}

		let tmpRenderSlot = (pIdentifier) =>
		{
			if (!pIdentifier) return;
			let tmpView = this.pict.views[pIdentifier];
			if (tmpView) { tmpView.render(); }
			else if (this.log && this.log.warn)
			{
				this.log.warn('Theme-BottomBar: slot view "' + pIdentifier + '" not registered');
			}
		};
		tmpRenderSlot(this.options.StatusView);
		tmpRenderSlot(this.options.InfoView);
		tmpRenderSlot(this.options.ActionsView);

		return super.onAfterRender ? super.onAfterRender(pRenderable, pAddress, pRecord, pContent) : undefined;
	}

	// ─── Per-route slot swapping ──────────────────────────────────────────
	// Mirrors Theme-TopBar's setNavView / setUserView — call from a
	// router callback to swap the bottom bar's slot content as the
	// route changes (different status formats per page, etc.).

	setStatusView(pViewIdentifier)  { this._setSlotView('StatusView',  '#Theme-BottomBar-Status',  pViewIdentifier); }
	setInfoView(pViewIdentifier)    { this._setSlotView('InfoView',    '#Theme-BottomBar-Info',    pViewIdentifier); }
	setActionsView(pViewIdentifier) { this._setSlotView('ActionsView', '#Theme-BottomBar-Actions', pViewIdentifier); }

	_setSlotView(pOptionKey, pDestSelector, pViewIdentifier)
	{
		this.options[pOptionKey] = pViewIdentifier || null;
		if (typeof document !== 'undefined')
		{
			let tmpDest = document.querySelector(pDestSelector);
			if (tmpDest) { tmpDest.innerHTML = ''; }
		}
		if (!pViewIdentifier) { return; }
		let tmpView = this.pict.views[pViewIdentifier];
		if (tmpView) { tmpView.render(); }
		else if (this.log && this.log.warn)
		{
			this.log.warn('Theme-BottomBar: view "' + pViewIdentifier + '" not registered');
		}
	}
}

module.exports = PictViewThemeBottomBar;
module.exports.default_configuration = _ViewConfiguration;
