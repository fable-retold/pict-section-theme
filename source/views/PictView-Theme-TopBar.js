/**
 * Theme-TopBar — standard application chrome row.
 *
 * Provides the boilerplate every Pict / retold app remakes: a flex row
 * with three zones — brand mark on the left, navigation in the middle,
 * configuration / user widgets on the right (with the theme button
 * pinned at the far edge).
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ [Brand-Mark]   [── Nav slot (flex-grow) ──]   [User-slot] [⚙]  │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Auto-mounts:
 *   - Theme-Brand-Mark in the brand slot (skip via MountBrandMark: false)
 *   - Theme-Button at the far right of the user area (skip via
 *     MountThemeButton: false)
 *
 * Host fills two empty slots via standard Pict view destinations:
 *   - `#Theme-TopBar-Nav`  — primary navigation / action buttons
 *   - `#Theme-TopBar-User` — app-specific user-area widgets (account,
 *                            log toggle, custom indicators)
 *
 * Renders into `#Theme-TopBar` by default. The host's layout shell
 * provides that destination — typically the top panel of a
 * pict-section-modal Shell.
 *
 * The bottom border uses `--brand-color-primary-mode` so the topbar
 * carries a thin brand stripe that auto-swaps with light/dark mode.
 *
 * Each app's nav / user-area views can stay app-specific; this view
 * eliminates the chrome boilerplate around them.
 */

const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: 'Theme-TopBar',
	AutoInitialize: true,
	AutoRender: false,

	DefaultDestinationAddress: '#Theme-TopBar',
	DefaultRenderable: 'Theme-TopBar-Renderable',

	// When false, the host is responsible for mounting Theme-Brand-Mark
	// itself (or skipping the brand entirely).
	MountBrandMark: true,
	// When false, Theme-Button is not auto-mounted into the user slot.
	// Useful when the host wants to position the button somewhere else
	// or when no theme picker is desired.
	MountThemeButton: true,
	// ViewIdentifier of a host-supplied view that fills the nav slot
	// (#Theme-TopBar-Nav). Typical convention: a small per-app view
	// rendering primary action buttons / nav links / breadcrumbs.
	NavView: null,
	// ViewIdentifier of a host-supplied view that fills the user-area
	// slot (#Theme-TopBar-User). Theme-Button still auto-mounts at the
	// far edge — this view fills the slot before it.
	UserView: null,

	// Height of the bar in pixels. Drives the min-height on the
	// chrome row so it fills the panel cleanly even when the parent
	// chain (pict-section-modal shell uses min-height: 100% on its
	// panel content destination, which doesn't resolve through plain
	// height: 100% chains) doesn't establish a determinate height.
	// Hosts should match this to whatever Size they use on the panel
	// addPanel() call so the chrome and panel agree on the row size.
	Height: 56,

	// Horizontal alignment of items inside the nav slot. The slot
	// itself stretches (flex: 1) between brand mark and user area;
	// this option controls where the nav content sits within that
	// stretched space. Default 'right' so action buttons hug the
	// user-area / theme button cluster (the convention every
	// retold-* app converged on). Override to 'left' to put the nav
	// flush against the brand, or 'center' to centre it across the
	// row. Maps to justify-content: flex-end / flex-start / center.
	NavAlign: 'right',

	// Viewport width (px) below which the topbar collapses to compact
	// mode: nav + user-area widgets hide, a burger button shows in
	// their place. Clicking the burger opens a pict-section-modal
	// popup with a clone of the nav + user DOM, so every action stays
	// reachable.
	//
	// Default 900px — the conventional "narrow desktop / small laptop"
	// cut-off where a topbar with ~4 nav buttons + a brand mark + a
	// user-area cluster genuinely starts crowding. Most users will
	// resize a window to this range (drag a split-pane, dock a window
	// next to another app, etc.); 600px would only trigger at true
	// mobile widths most desktop users never hit.
	//
	// Conventional ladder for picking a value:
	//   ~1024px  large breakpoint — nav-heavy apps with 6+ buttons
	//    ~900px  default — "narrow desktop window" (recommended)
	//    ~768px  tablet portrait — minimal-nav apps
	//    ~600px  mobile-only — single-button toolbars
	//        0   disable compact mode entirely
	CompactBreakpoint: 900,

	Templates:
	[
		{
			Hash: 'Theme-TopBar-Template',
			// The burger button is hidden by default and the regular nav /
			// user-slot are visible — flipped by the media query in CSS
			// at the CompactBreakpoint (default 600px). On click the
			// burger opens a pict-section-modal popup containing a clone
			// of the existing #Theme-TopBar-Nav + #Theme-TopBar-User DOM
			// — host apps don't need to provide a separate burger view.
			Template: /*html*/`
<div class="pict-theme-topbar">
	<div class="pict-theme-topbar-mark"><div id="Theme-Brand-Mark"></div></div>
	<div class="pict-theme-topbar-nav" id="Theme-TopBar-Nav"></div>
	<div class="pict-theme-topbar-user">
		<div class="pict-theme-topbar-user-slot" id="Theme-TopBar-User"></div>
		<div class="pict-theme-topbar-user-button"><div id="Theme-Button"></div></div>
		<button type="button" class="pict-theme-topbar-burger"
			aria-label="More navigation"
			title="Menu"
			onclick="_Pict.views['Theme-TopBar'].openBurgerMenu();">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2"
				stroke-linecap="round" stroke-linejoin="round"
				aria-hidden="true">
				<path d="M3 6h18M3 12h18M3 18h18"/>
			</svg>
		</button>
	</div>
</div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'Theme-TopBar-Renderable',
			TemplateHash: 'Theme-TopBar-Template',
			ContentDestinationAddress: '#Theme-TopBar',
			RenderMethod: 'replace'
		}
	],

	CSS: /*css*/`
.pict-theme-topbar {
	display: flex;
	align-items: center;
	gap: 14px;
	/* The min-height is rewritten per-instance in onAfterRender from the
	   Height option (default 56). Avoids the percent-height resolution
	   trap: pict-section-modal's panel destination uses min-height: 100%
	   on its inner div, which means a child's height: 100% / min-height:
	   100% resolves against the parent's *property* (auto), not its
	   resolved size — and collapses the row to its content. A fixed px
	   value gives align-items: center real space to centre into. */
	min-height: 56px;
	padding: 0 14px;
	box-sizing: border-box;
	background: var(--theme-color-background-panel, transparent);
	/* Brand stripes are drawn by .pict-theme-topbar::after as an absolute
	   element overlaying the bottom 5px of the row. Using ::after rather
	   than border-bottom + box-shadow lets us put a transparent gap
	   between the two stripes (border / box-shadow can't draw gaps).
	   Position relative so the ::after positions to this row. */
	position: relative;
}
/* Two-stripe brand identifier at the bottom of the topbar:
     4px brand-primary (thicker — the dominant identifier)
     2px transparent gap (clearly readable separation)
     3px brand-secondary (thinner than primary but still substantial)
   Earlier iterations used 1–2px stripes; both read clearly at light
   mode but dark-mode secondary colors are often desaturated (lifted)
   so the eye can miss a thin band against a dark background. The
   current sizes push the secondary above the perception threshold
   regardless of palette. Stripes overlay the bottom 9px of the row;
   content (which centres in the full row via align-items: center)
   keeps its visual position. */
.pict-theme-topbar::after {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 9px;
	pointer-events: none;
	background: linear-gradient(
		to bottom,
		var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb)) 0,
		var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb)) 4px,
		transparent 4px,
		transparent 6px,
		var(--brand-color-secondary-mode, var(--theme-color-brand-secondary, transparent)) 6px,
		var(--brand-color-secondary-mode, var(--theme-color-brand-secondary, transparent)) 9px
	);
}
.pict-theme-topbar-mark {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
}
.pict-theme-topbar-nav {
	flex: 1 1 auto;
	display: flex;
	align-items: center;
	/* Default to right-aligning nav items inside the stretched slot —
	   the convention retold-* apps converged on. Overridden per-instance
	   from the NavAlign option in onAfterRender. */
	justify-content: flex-end;
	gap: 8px;
	min-width: 0;
	/* Horizontally scrollable when the nav overflows (narrow viewports
	   with many buttons) — better than overflow:hidden which would
	   silently clip buttons offscreen. The vertical axis stays clipped
	   so a tall accidental child doesn't blow up the row height. A
	   proper overflow menu is a future enhancement; this gets us safe
	   degradation today. */
	overflow-x: auto;
	overflow-y: hidden;
	/* Hide the scrollbar by default; modern browsers pick up the
	   trackpad scroll without it. Apps wanting a visible scrollbar
	   can override at higher specificity. */
	scrollbar-width: none;
}
.pict-theme-topbar-nav::-webkit-scrollbar { display: none; }
/* Active-route indicator. The convention every host app should follow:
   put aria-current="page" on the button (or anchor) representing the
   current route. The W3C-standard attribute reads correctly to screen
   readers and gets a brand-tinted highlight here. Apps that already
   ship their own active styling can override these rules — they're
   keyed off attribute selectors so no class collision is possible. */
.pict-theme-topbar-nav [aria-current="page"],
.pict-theme-topbar-user [aria-current="page"] {
	color: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	border-color: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	background: var(--theme-color-background-hover, rgba(37, 99, 235, 0.08));
}
.pict-theme-topbar-user {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	gap: 8px;
}
.pict-theme-topbar-user-slot {
	display: flex;
	align-items: center;
	gap: 8px;
}
.pict-theme-topbar-user-button {
	display: flex;
	align-items: center;
}
/* Burger button — hidden by default; the media query (or the inline
   per-instance JS that swaps it via CompactBreakpoint) shows it once
   the viewport drops below the host's compact threshold. Sized to
   match Theme-Button (28×28) so the row's rhythm is preserved. */
.pict-theme-topbar-burger {
	display: none;
	align-items: center;
	justify-content: center;
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
.pict-theme-topbar-burger:hover {
	background: var(--theme-color-background-hover, #f0f0f0);
	color: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
	border-color: var(--brand-color-primary-mode, var(--theme-color-brand-primary, #2563eb));
}
/* Burger menu popup — applied to the cloned nav + user DOM inside
   pict-section-modal. The cloned children inherit their original
   styling (action buttons, badges, etc.) so the popup looks visually
   consistent with what was on the topbar. */
.pict-theme-burger-menu {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.pict-theme-burger-menu-section {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
/* Cloned children render as a vertical stack inside the popup — flip
   the horizontal flex layouts to column so each button takes a full
   row instead of cramming side-by-side at narrow width. */
.pict-theme-burger-menu .rm-topbar-nav,
.pict-theme-burger-menu .rm-topbar-user,
.pict-theme-burger-menu [class*="-topbar-nav"],
.pict-theme-burger-menu [class*="-topbar-user"] {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 6px;
}
.pict-theme-burger-menu button { width: 100%; text-align: left; }
.pict-theme-burger-menu .rm-topbar-nav-divider,
.pict-theme-burger-menu [class*="divider"] { display: none; }
/* Compact mode — defaults to a 900px breakpoint. The onAfterRender
   handler injects a per-instance <style> rule when the host passes a
   different CompactBreakpoint, so this @media block is the fallback
   for hosts that accept the default. */
@media (max-width: 900px) {
	.pict-theme-topbar-nav            { display: none !important; }
	.pict-theme-topbar-user-slot      { display: none !important; }
	.pict-theme-topbar-burger         { display: inline-flex; }
	/* In wide mode the flex-1 nav slot pushes the user-area to the
	   right edge. With the nav hidden the user-area would collapse
	   left of the now-empty middle; the auto-margin re-creates the
	   "push right" effect so the theme button + burger stay flush
	   against the right edge of the topbar. */
	.pict-theme-topbar-user           { margin-left: auto; }
}`,
	CSSPriority: 500
};

class PictViewThemeTopBar extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender(pRenderable, pAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();

		// Apply the configured Height to the rendered .pict-theme-topbar.
		// Using inline style so each instance can carry its own size
		// (different apps will pick different heights) without us having
		// to inject per-instance <style> blocks.
		if (typeof document !== 'undefined' && this.options.Height)
		{
			let tmpRoot = document.querySelector('.pict-theme-topbar');
			if (tmpRoot) { tmpRoot.style.minHeight = this.options.Height + 'px'; }
		}

		// Per-instance CompactBreakpoint. CSS @media rules can't reference
		// JS option values, so when the host overrides the default 600px
		// we inject a single-rule <style> with the chosen breakpoint and
		// !important to win over the static media query. Set to 0 to
		// disable compact mode entirely (the burger stays hidden).
		this._applyCompactBreakpoint();

		// Translate NavAlign ('left' | 'right' | 'center') to the matching
		// justify-content. Right is the default (and already in the static
		// CSS), but the inline style wins so an explicit option always
		// takes precedence over the cached stylesheet.
		if (typeof document !== 'undefined' && this.options.NavAlign)
		{
			let tmpJustify = ({
				left:   'flex-start',
				right:  'flex-end',
				center: 'center'
			})[this.options.NavAlign];
			if (tmpJustify)
			{
				let tmpNav = document.querySelector('.pict-theme-topbar-nav');
				if (tmpNav) { tmpNav.style.justifyContent = tmpJustify; }
			}
		}

		// Auto-mount the standard pieces. Host can opt out via the view
		// options (MountBrandMark / MountThemeButton).
		if (this.options.MountBrandMark !== false)
		{
			let tmpBrandMark = this.pict.views['Theme-Brand-Mark'];
			if (tmpBrandMark) { tmpBrandMark.render(); }
		}
		if (this.options.NavView)
		{
			let tmpNavView = this.pict.views[this.options.NavView];
			if (tmpNavView) { tmpNavView.render(); }
			else if (this.log && this.log.warn)
			{
				this.log.warn('Theme-TopBar: NavView "' + this.options.NavView + '" not registered');
			}
		}
		if (this.options.UserView)
		{
			let tmpUserView = this.pict.views[this.options.UserView];
			if (tmpUserView) { tmpUserView.render(); }
			else if (this.log && this.log.warn)
			{
				this.log.warn('Theme-TopBar: UserView "' + this.options.UserView + '" not registered');
			}
		}
		if (this.options.MountThemeButton !== false)
		{
			let tmpThemeButton = this.pict.views['Theme-Button'];
			if (tmpThemeButton) { tmpThemeButton.render(); }
		}

		return super.onAfterRender ? super.onAfterRender(pRenderable, pAddress, pRecord, pContent) : undefined;
	}

	// ─── Per-route slot swapping ──────────────────────────────────────────
	// Apps with chrome that morphs between routes (e.g. breadcrumb-style
	// navigation that differs by section) call setNavView / setUserView
	// from their router callback. The new view is rendered into the
	// matching slot and the option is persisted so subsequent re-renders
	// of the topbar (theme switches, etc.) keep the new view mounted.

	/**
	 * Swap the NavView (slot at `#Theme-TopBar-Nav`) at runtime.
	 * @param {string|null} pViewIdentifier
	 *   View hash to mount, or null to clear the slot.
	 */
	setNavView(pViewIdentifier)
	{
		this.options.NavView = pViewIdentifier || null;
		this._mountSlot('#Theme-TopBar-Nav', this.options.NavView);
	}

	/**
	 * Swap the UserView (slot at `#Theme-TopBar-User`) at runtime.
	 * @param {string|null} pViewIdentifier
	 */
	setUserView(pViewIdentifier)
	{
		this.options.UserView = pViewIdentifier || null;
		this._mountSlot('#Theme-TopBar-User', this.options.UserView);
	}

	_mountSlot(pDestSelector, pViewIdentifier)
	{
		// Clear the slot first — handles both the clear-only case
		// (pViewIdentifier is null) and the swap case (gives the
		// new view a clean slate when its renderable doesn't use
		// `replace` mode).
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
			this.log.warn('Theme-TopBar: view "' + pViewIdentifier + '" not registered');
		}
	}

	// ─── Compact mode + burger menu ──────────────────────────────────────
	// At narrow widths the nav + user-area slots collapse into a single
	// burger button that opens a pict-section-modal popup with the
	// cloned nav + user DOM. The default breakpoint is 600px; hosts that
	// want a different value pass CompactBreakpoint in ViewOptions.

	_applyCompactBreakpoint()
	{
		if (typeof document === 'undefined') return;
		// Default value of 900 lives in the static CSS @media block; we
		// only need to inject when the host explicitly overrode it.
		let tmpBreakpoint = this.options.CompactBreakpoint;
		if (tmpBreakpoint === undefined || tmpBreakpoint === null) return;
		if (tmpBreakpoint === 900) return;  // matches default — no override needed

		let tmpStyleId = 'pict-theme-topbar-compact-' + this.UUID;
		let tmpStyleEl = document.getElementById(tmpStyleId);
		if (!tmpStyleEl)
		{
			tmpStyleEl = document.createElement('style');
			tmpStyleEl.id = tmpStyleId;
			document.head.appendChild(tmpStyleEl);
		}

		// 0 (or any non-positive value) disables compact mode by emitting
		// a never-matching media rule. The static CSS still has the 600px
		// rule, so we override it with a more-specific selector + the
		// chosen breakpoint. Specificity-wise the inline rule wins
		// because it's emitted after the static CSS and has !important
		// matching the static rule's importance.
		if (typeof tmpBreakpoint !== 'number' || tmpBreakpoint <= 0)
		{
			// Disable: force compact selectors to never apply by giving
			// the burger display: none unconditionally at all widths.
			tmpStyleEl.textContent =
				'.pict-theme-topbar-nav            { display: flex !important; }\n' +
				'.pict-theme-topbar-user-slot      { display: flex !important; }\n' +
				'.pict-theme-topbar-burger         { display: none !important; }\n' +
				'.pict-theme-topbar-user           { margin-left: 0 !important; }\n';
		}
		else
		{
			tmpStyleEl.textContent =
				'@media (max-width: ' + tmpBreakpoint + 'px) {\n' +
				'\t.pict-theme-topbar-nav            { display: none !important; }\n' +
				'\t.pict-theme-topbar-user-slot      { display: none !important; }\n' +
				'\t.pict-theme-topbar-burger         { display: inline-flex !important; }\n' +
				'\t.pict-theme-topbar-user           { margin-left: auto !important; }\n' +
				'}\n' +
				'@media (min-width: ' + (tmpBreakpoint + 1) + 'px) {\n' +
				'\t.pict-theme-topbar-nav            { display: flex !important; }\n' +
				'\t.pict-theme-topbar-user-slot      { display: flex !important; }\n' +
				'\t.pict-theme-topbar-burger         { display: none !important; }\n' +
				'\t.pict-theme-topbar-user           { margin-left: 0 !important; }\n' +
				'}\n';
		}
	}

	/**
	 * Open the burger / overflow menu. Clones the current contents of
	 * `#Theme-TopBar-Nav` and `#Theme-TopBar-User` into a
	 * pict-section-modal popup so every action stays reachable at narrow
	 * widths. The cloned buttons keep their inline `onclick` handlers
	 * (those reference globals like `_Pict.PictApplication.*`, which
	 * resolve at click-time regardless of where the DOM lives).
	 *
	 * Override on the instance (`view.openBurgerMenu = function() {...}`)
	 * to customise the popup contents — e.g. emit a per-app menu view
	 * instead of cloning the topbar DOM.
	 */
	openBurgerMenu()
	{
		if (typeof document === 'undefined') return null;
		let tmpModal = this.pict.views['Pict-Section-Modal'];
		if (!tmpModal || typeof tmpModal.show !== 'function')
		{
			if (typeof console !== 'undefined' && console.warn)
			{
				console.warn('Theme-TopBar: pict-section-modal not registered — burger menu unavailable.');
			}
			return null;
		}

		let tmpSections = [];
		let tmpNav = document.querySelector('#Theme-TopBar-Nav');
		let tmpUser = document.querySelector('#Theme-TopBar-User');
		if (tmpNav && tmpNav.innerHTML.trim())
		{
			tmpSections.push('<div class="pict-theme-burger-menu-section">' + tmpNav.innerHTML + '</div>');
		}
		if (tmpUser && tmpUser.innerHTML.trim())
		{
			tmpSections.push('<div class="pict-theme-burger-menu-section">' + tmpUser.innerHTML + '</div>');
		}
		if (tmpSections.length === 0)
		{
			tmpSections.push('<div class="pict-theme-burger-menu-empty">No menu items configured.</div>');
		}

		let tmpHTML = '<div class="pict-theme-burger-menu">' + tmpSections.join('') + '</div>';

		return tmpModal.show(
		{
			title:    'Menu',
			content:  tmpHTML,
			width:    '280px',
			closeable: true,
			buttons:  []
		});
	}
}

module.exports = PictViewThemeTopBar;
module.exports.default_configuration = _ViewConfiguration;
