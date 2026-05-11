/**
 * Theme-Brand-Mark — single-row inline brand mark (icon + name).
 *
 * The drop-in counterpart to Theme-BrandStrip for apps that put the
 * brand wordmark *inside* their topbar (next to action buttons) rather
 * than as a multi-row chrome below the nav.
 *
 * Layout:
 *
 *   ┌─────────────────────────┐
 *   │ [icon]  App Name        │
 *   └─────────────────────────┘
 *
 * Colors come from the brand's primary/secondary; the icon (when SVG
 * with `stroke="currentColor"`) inherits `--brand-color-primary-mode`,
 * which auto-swaps between PrimaryLight (default mode) and PrimaryDark
 * (`.theme-dark`).
 *
 * Reads from libThemeBrand and re-renders on `onChange`. Renders an
 * empty span when no brand is registered.
 *
 * Drop-in destination: `<div id="Theme-Brand-Mark"></div>`.
 */

const libPictView = require('pict-view');
const libThemeBrand = require('../Theme-Brand.js');

const _ViewConfiguration =
{
	ViewIdentifier: 'Theme-Brand-Mark',
	AutoInitialize: true,
	AutoRender: false,

	DefaultDestinationAddress: '#Theme-Brand-Mark',
	DefaultRenderable: 'Theme-Brand-Mark-Renderable',

	// Optional: when false the icon is omitted (text-only wordmark).
	ShowIcon: true,
	// Optional: when false the name is omitted (icon-only mark).
	ShowName: true,

	Templates:
	[
		{
			Hash: 'Theme-Brand-Mark-Template',
			Template: /*html*/`{~TS:Theme-Brand-Mark-Body-Template:AppData.PictSectionTheme.BrandMark.BodySlot~}`
		},
		{
			Hash: 'Theme-Brand-Mark-Body-Template',
			Template: /*html*/`
<span class="pict-theme-brand-mark" title="{~D:Record.Tooltip~}">
	{~TS:Theme-Brand-Mark-IconSVG-Template:Record.IconSVGSlot~}
	{~TS:Theme-Brand-Mark-IconImg-Template:Record.IconImgSlot~}
	{~TS:Theme-Brand-Mark-Name-Template:Record.NameSlot~}
</span>`
		},
		{
			// Inline SVG: trusted markup; let it ride. SVG icons that
			// reference `currentColor` inherit `--brand-color-primary-mode`.
			Hash: 'Theme-Brand-Mark-IconSVG-Template',
			Template: /*html*/`<span class="pict-theme-brand-mark-icon">{~D:Record.IconHTML~}</span>`
		},
		{
			Hash: 'Theme-Brand-Mark-IconImg-Template',
			Template: /*html*/`<span class="pict-theme-brand-mark-icon"><img src="{~D:Record.IconURL~}" alt=""></span>`
		},
		{
			Hash: 'Theme-Brand-Mark-Name-Template',
			Template: /*html*/`<span class="pict-theme-brand-mark-name">{~D:Record.Name~}</span>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'Theme-Brand-Mark-Renderable',
			TemplateHash: 'Theme-Brand-Mark-Template',
			ContentDestinationAddress: '#Theme-Brand-Mark',
			RenderMethod: 'replace'
		}
	],

	CSS: /*css*/`
.pict-theme-brand-mark {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	/* line-height: 1 collapses the inherited ~1.2 line-box around the
	   name glyphs. Without this the inline-flex container is taller
	   than its visible content, the line-box adds asymmetric space
	   above the caps, and the whole mark looks pushed up vs.
	   neighbouring buttons that sit on standard 12px-text baselines. */
	line-height: 1;
	color: var(--brand-color-primary-mode, var(--theme-color-text-primary, #1a1a1a));
	user-select: none;
}
.pict-theme-brand-mark-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	color: currentColor;
}
.pict-theme-brand-mark-icon img,
.pict-theme-brand-mark-icon svg {
	width: 100%;
	height: 100%;
	display: block;
}
.pict-theme-brand-mark-name {
	/* Font size dropped from 15 → 14 so the brand name reads closer
	   to the typical 12px action-button text height; bigger glyphs
	   reaching higher into the row are why the mark looked optically
	   high. The 2px brand-secondary underline keeps the mark feeling
	   distinctly branded; padding-bottom: 1px was an asymmetric nudge
	   that shifted the visual center up — removed. */
	font-size: 14px;
	font-weight: 600;
	letter-spacing: 0.4px;
	border-bottom: 2px solid var(--brand-color-secondary-mode, transparent);
	white-space: nowrap;
}
/* Compact form — at narrow viewports the brand mark collapses to
   icon-only. The icon alone still reads as the brand (the deterministic
   logo is designed to be recognisable without the wordmark) and freeing
   up the wordmark's width keeps the nav buttons reachable on tablet /
   small-laptop widths. The threshold matches the topbar's compact
   breakpoint in Theme-TopBar. */
@media (max-width: 720px) {
	.pict-theme-brand-mark-name {
		display: none;
	}
}`,
	CSSPriority: 500
};

class PictViewThemeBrandMark extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this._unsubscribeFromBrand = null;
	}

	onAfterInitialize()
	{
		this._subscribeToBrand();
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

	_subscribeToBrand()
	{
		if (this._unsubscribeFromBrand) return;
		let tmpSelf = this;
		this._unsubscribeFromBrand = libThemeBrand.onChange(function ()
		{
			tmpSelf.render();
		});
	}

	_refreshAppData()
	{
		let tmpBrand = libThemeBrand.getActive();
		this.pict.AppData.PictSectionTheme = this.pict.AppData.PictSectionTheme || {};

		if (!tmpBrand)
		{
			this.pict.AppData.PictSectionTheme.BrandMark = { BodySlot: [] };
			return;
		}

		// Single-element array slot drives the {~TS:~} render. Empty
		// slots for icon-img/icon-svg/name suppress those sub-templates.
		let tmpShowIcon = (this.options.ShowIcon !== false);
		let tmpShowName = (this.options.ShowName !== false);

		let tmpIconSVGSlot = (tmpShowIcon && tmpBrand.IconType === 'svg' && tmpBrand.Icon)
			? [{ IconHTML: tmpBrand.Icon }] : [];
		let tmpIconImgSlot = (tmpShowIcon && tmpBrand.IconType === 'image' && tmpBrand.Icon)
			? [{ IconURL: tmpBrand.Icon }] : [];
		let tmpNameSlot = (tmpShowName && tmpBrand.Name)
			? [{ Name: tmpBrand.Name }] : [];

		this.pict.AppData.PictSectionTheme.BrandMark =
		{
			BodySlot:
			[{
				Tooltip: tmpBrand.Tagline || tmpBrand.Name || '',
				IconSVGSlot: tmpIconSVGSlot,
				IconImgSlot: tmpIconImgSlot,
				NameSlot:    tmpNameSlot
			}]
		};
	}
}

module.exports = PictViewThemeBrandMark;
module.exports.default_configuration = _ViewConfiguration;
