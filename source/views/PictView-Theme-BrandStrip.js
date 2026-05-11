/**
 * Theme-BrandStrip — the subtle two-line brand signature that sits
 * under the application's navigation.
 *
 * Layout:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ [icon]  App Name                                            │
 *   │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  ← primary stripe (3× tall)
 *   │ ─────────────────────────────────────────────────────────── │  ← secondary stripe (1× tall)
 *   └─────────────────────────────────────────────────────────────┘
 *
 * The icon + name row is colored using the brand's primary color (and
 * the secondary as an underline accent on the name). Clicking the row
 * does nothing by default — hosts that want it to navigate or open a
 * dropdown can pass an `OnClickName` hook in the view options.
 *
 * Reads the active brand from libThemeBrand. Subscribes to
 * libThemeBrand.onChange so swapping the brand at runtime updates the
 * strip immediately. Renders nothing (an empty span) when no brand is
 * registered.
 *
 * Drop-in destination: `<div id="Theme-BrandStrip"></div>`.
 */

const libPictView = require('pict-view');
const libThemeBrand = require('../Theme-Brand.js');

const _ViewConfiguration =
{
	ViewIdentifier: 'Theme-BrandStrip',
	AutoInitialize: true,
	AutoRender: false,

	DefaultDestinationAddress: '#Theme-BrandStrip',
	DefaultRenderable: 'Theme-BrandStrip-Renderable',

	// Stripe heights in pixels. Primary is conventionally 3× secondary,
	// per the design brief, but exposed here so hosts can tune.
	PrimaryStripeHeight: 3,
	SecondaryStripeHeight: 1,

	// When false, the icon + name row is omitted and only the two
	// stripes render. Useful for very tight chrome where the brand
	// name is already in the topbar.
	ShowName: true,

	Templates:
	[
		{
			Hash: 'Theme-BrandStrip-Template',
			Template: /*html*/`
{~TS:Theme-BrandStrip-Body-Template:AppData.PictSectionTheme.BrandStrip.BodySlot~}`
		},
		{
			Hash: 'Theme-BrandStrip-Body-Template',
			Template: /*html*/`
<div class="pict-theme-brandstrip" title="{~D:Record.Tooltip~}">
	{~TS:Theme-BrandStrip-NameRow-Template:Record.NameRowSlot~}
	<div class="pict-theme-brandstrip-stripes">
		<div class="pict-theme-brandstrip-stripe pict-theme-brandstrip-stripe-primary"
		     style="height: {~D:Record.PrimaryHeight~}px;"></div>
		<div class="pict-theme-brandstrip-stripe pict-theme-brandstrip-stripe-secondary"
		     style="height: {~D:Record.SecondaryHeight~}px;"></div>
	</div>
</div>`
		},
		{
			Hash: 'Theme-BrandStrip-NameRow-Template',
			Template: /*html*/`
<div class="pict-theme-brandstrip-row">
	{~TS:Theme-BrandStrip-IconSVG-Template:Record.IconSVGSlot~}
	{~TS:Theme-BrandStrip-IconImg-Template:Record.IconImgSlot~}
	<span class="pict-theme-brandstrip-name">{~D:Record.Name~}</span>
</div>`
		},
		{
			// SVG icon: leading <svg> markup is trusted (host-supplied,
			// not user-supplied) so we let it through verbatim. Theme-Icons
			// SVGs use stroke="currentColor" so they pick up the brand
			// primary color from the row's `color: var(--brand-color-primary)`.
			Hash: 'Theme-BrandStrip-IconSVG-Template',
			Template: /*html*/`<span class="pict-theme-brandstrip-icon">{~D:Record.IconHTML~}</span>`
		},
		{
			// <img> icon: src can be a data URL or a regular URL.
			Hash: 'Theme-BrandStrip-IconImg-Template',
			Template: /*html*/`<span class="pict-theme-brandstrip-icon"><img src="{~D:Record.IconURL~}" alt=""></span>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'Theme-BrandStrip-Renderable',
			TemplateHash: 'Theme-BrandStrip-Template',
			ContentDestinationAddress: '#Theme-BrandStrip',
			RenderMethod: 'replace'
		}
	],

	CSS: /*css*/`
.pict-theme-brandstrip {
	display: flex;
	flex-direction: column;
	gap: 4px;
	user-select: none;
}
.pict-theme-brandstrip-row {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 6px 12px 4px;
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.4px;
	text-transform: uppercase;
	color: var(--brand-color-primary, var(--theme-color-text-muted, #6b6b6b));
}
.pict-theme-brandstrip-name {
	border-bottom: 2px solid var(--brand-color-secondary, transparent);
	padding-bottom: 1px;
}
.pict-theme-brandstrip-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 16px; height: 16px;
	color: var(--brand-color-primary, currentColor);
}
.pict-theme-brandstrip-icon img,
.pict-theme-brandstrip-icon svg {
	width: 100%; height: 100%;
	display: block;
}
.pict-theme-brandstrip-stripes {
	display: flex;
	flex-direction: column;
	width: 100%;
}
.pict-theme-brandstrip-stripe {
	width: 100%;
}
.pict-theme-brandstrip-stripe-primary {
	background: var(--brand-color-primary, transparent);
}
.pict-theme-brandstrip-stripe-secondary {
	background: var(--brand-color-secondary, transparent);
}`,
	CSSPriority: 500
};

class PictViewThemeBrandStrip extends libPictView
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

		// No brand → empty BodySlot → renderable emits nothing.
		if (!tmpBrand)
		{
			this.pict.AppData.PictSectionTheme.BrandStrip = { BodySlot: [] };
			return;
		}

		let tmpShowName = (this.options.ShowName !== false);

		// Pick the right per-icon-type slot. Only one of these will be
		// non-empty so the template renders the right element.
		let tmpIconSVGSlot = [];
		let tmpIconImgSlot = [];
		if (tmpBrand.IconType === 'svg' && tmpBrand.Icon)
		{
			tmpIconSVGSlot = [{ IconHTML: tmpBrand.Icon }];
		}
		else if (tmpBrand.IconType === 'image' && tmpBrand.Icon)
		{
			tmpIconImgSlot = [{ IconURL: tmpBrand.Icon }];
		}

		let tmpNameRowSlot = tmpShowName
			? [{
				Name: tmpBrand.Name,
				IconSVGSlot: tmpIconSVGSlot,
				IconImgSlot: tmpIconImgSlot
			}]
			: [];

		let tmpTooltip = tmpBrand.Name + (tmpBrand.Tagline ? ' — ' + tmpBrand.Tagline : '');

		this.pict.AppData.PictSectionTheme.BrandStrip =
		{
			BodySlot:
			[{
				Tooltip: tmpTooltip,
				NameRowSlot: tmpNameRowSlot,
				PrimaryHeight: this.options.PrimaryStripeHeight || 3,
				SecondaryHeight: this.options.SecondaryStripeHeight || 1
			}]
		};
	}
}

PictViewThemeBrandStrip.default_configuration = _ViewConfiguration;

module.exports = PictViewThemeBrandStrip;
