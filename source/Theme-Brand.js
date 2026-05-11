/**
 * Theme-Brand — app-level brand identity (icon + colors) that overlays
 * the active theme.
 *
 * # What this is for
 *
 * The active *theme* describes how UI surfaces look (panel colors,
 * borders, text, status). The active *brand* describes which APP the
 * user is in. retold-facto, retold-manager, and ultravisor can share
 * the same theme but each carries its own visual signature: a small
 * icon and two brand colors that show up in a stripe under the nav
 * (and optionally tinge link underlines, header accents, etc. when
 * the active theme opts to reference them).
 *
 * Brand is host-supplied (passed to pict-section-theme.install() as
 * `Brand: {...}` or applied later via this module's `applyBrand()`)
 * and NOT user-pickable — it's the app's wordmark. It's also not
 * persisted; the host config drives it on every boot.
 *
 * # Brand shape
 *
 * Two equivalent forms — pick whichever reads better in your app.
 *
 * ## Recommended: nested form
 *
 *   {
 *     Hash:    'retold-manager',
 *     Name:    'Retold Manager',
 *     Icon:    '<svg ...>...</svg>',
 *     Colors: {
 *       Primary:   { Light: '#0044cc', Dark: '#6b8eff' },   // both required
 *       Secondary: { Light: '#c75033', Dark: '#ff8a6b' }    // both required
 *     },
 *     Tagline: 'Optional short tagline'
 *   }
 *
 * This mirrors how theme JSONs already structure their Tokens.Color.*
 * trees, makes the "explicit light + dark variants" contract obvious,
 * and means your brand and your theme look consistent in source.
 *
 * ## Legacy: flat form
 *
 *   {
 *     Hash:    'retold-manager',
 *     Name:    'Retold Manager',
 *     Icon:    '<svg ...>...</svg>',
 *     Colors: {
 *       Primary:        '#0066ff',                // required
 *       Secondary:      '#ff6600',                // required
 *       PrimaryLight:   '#3388ff',                // optional, light-mode tint
 *       PrimaryDark:    '#0044cc',                // optional, dark-mode tint
 *       SecondaryLight: '#ff8833',
 *       SecondaryDark:  '#cc4400'
 *     }
 *   }
 *
 * The flat form's `Primary` / `Secondary` are mode-agnostic constants
 * (used for the `--brand-color-primary` / `-secondary` CSS variables);
 * the *Light / *Dark fields drive the mode-aware variants. When the
 * Light / Dark fields are omitted, the base Primary / Secondary
 * doubles for both modes. Both forms land on the same six output CSS
 * variables — see "CSS variables emitted" below.
 *
 * Icon shape: inline SVG markup, OR a data URL, OR a remote / app-served
 * URL. IconType is optional and auto-detected from the value.
 *
 * # CSS variables emitted
 *
 *   :root {
 *     --brand-color-primary:           <Primary>
 *     --brand-color-secondary:         <Secondary>
 *     --brand-color-primary-light:     <PrimaryLight or Primary>
 *     --brand-color-primary-dark:      <PrimaryDark or Primary>
 *     --brand-color-secondary-light:   <SecondaryLight or Secondary>
 *     --brand-color-secondary-dark:    <SecondaryDark or Secondary>
 *     --brand-color-primary-mode:      <Primary OR PrimaryLight in :root>
 *     --brand-color-secondary-mode:    <Secondary OR SecondaryLight in :root>
 *     --brand-name:                    "<Name>"
 *   }
 *   .theme-dark {
 *     --brand-color-primary-mode:      <PrimaryDark or Primary>
 *     --brand-color-secondary-mode:    <SecondaryDark or Secondary>
 *   }
 *
 * The `*-mode` variables are the ones theme/host CSS should reach for
 * when they want a brand color that automatically swaps for dark mode
 * (parallel to how --theme-color-* works). The plain Primary/Secondary
 * are constants that ignore the mode toggle — useful for the brand
 * stripe itself, where the brand should look the same in both modes.
 *
 * # Listener pattern
 *
 * Mirrors Theme-Scale: subscribe via `onBrandChange(cb)`, dispose by
 * calling the returned function. The BrandStrip view uses this to
 * re-render when the host changes brand at runtime (rare, but used by
 * test harnesses + multi-tenant hosts).
 */

const STYLE_ELEMENT_ID = 'pict-brand';
const FAVICON_LINK_ID = 'pict-brand-favicon';
const FAVICON_DARK_LINK_ID = 'pict-brand-favicon-dark';

let _activeBrand = null;
let _listeners = [];

function _isInlineSVG(pIcon)
{
	return (typeof pIcon === 'string') && /^\s*<svg[\s>]/i.test(pIcon);
}

function _isImageURL(pIcon)
{
	if (typeof pIcon !== 'string') return false;
	return /^(data:|https?:|\/|\.\.?\/)/.test(pIcon);
}

function _detectIconType(pBrand)
{
	if (pBrand && typeof pBrand.IconType === 'string') return pBrand.IconType;
	if (!pBrand || !pBrand.Icon) return null;
	if (_isInlineSVG(pBrand.Icon)) return 'svg';
	if (_isImageURL(pBrand.Icon)) return 'image';
	return null;
}

// Resolve a "color slot" to { Light, Dark, Base } regardless of input
// shape. Supported inputs:
//   - "string"                        → all three equal that string
//   - { Light, Dark }                 → Base = Light, others as given
//   - { Light, Dark, Base }           → Base explicit
//   - missing                         → null (caller decides how to fail)
function _resolveColorSlot(pSlot)
{
	if (typeof pSlot === 'string' && pSlot.length > 0)
	{
		return { Light: pSlot, Dark: pSlot, Base: pSlot };
	}
	if (pSlot && typeof pSlot === 'object')
	{
		let tmpLight = (typeof pSlot.Light === 'string' && pSlot.Light.length > 0) ? pSlot.Light : null;
		let tmpDark  = (typeof pSlot.Dark  === 'string' && pSlot.Dark.length  > 0) ? pSlot.Dark  : null;
		// Need at least one variant present.
		if (!tmpLight && !tmpDark) return null;
		// Fill missing variant from the other side. Base defaults to
		// the light variant (matches the legacy flat-form semantics).
		tmpLight = tmpLight || tmpDark;
		tmpDark  = tmpDark  || tmpLight;
		let tmpBase = (typeof pSlot.Base === 'string' && pSlot.Base.length > 0) ? pSlot.Base : tmpLight;
		return { Light: tmpLight, Dark: tmpDark, Base: tmpBase };
	}
	return null;
}

function _normalize(pBrand)
{
	if (!pBrand || typeof pBrand !== 'object') return null;
	let tmpColors = pBrand.Colors || {};

	// Brand colors accept TWO forms — flat or nested:
	//
	//   FLAT (legacy):
	//     Colors: {
	//       Primary:        '#e54b1e',     // required (the mode-agnostic value)
	//       Secondary:      '#1e9aa0',     // required
	//       PrimaryLight:   '#e54b1e',     // optional fallback to Primary
	//       PrimaryDark:    '#ff7a4a',     // optional fallback to Primary
	//       SecondaryLight: '#1e9aa0',     // optional fallback to Secondary
	//       SecondaryDark:  '#5fc5cb'      // optional fallback to Secondary
	//     }
	//
	//   NESTED (recommended):
	//     Colors: {
	//       Primary:   { Light: '#e54b1e', Dark: '#ff7a4a' },  // both required
	//       Secondary: { Light: '#1e9aa0', Dark: '#5fc5cb' }   // both required
	//     }
	//
	// The nested form mirrors how themes already structure their
	// Tokens.Color.* trees and makes the "this brand needs explicit
	// light + dark variants" contract obvious. Either form lands on
	// the same six --brand-color-* CSS variables.
	let tmpPriSlot = _resolveColorSlot(tmpColors.Primary);
	let tmpSecSlot = _resolveColorSlot(tmpColors.Secondary);
	if (!tmpPriSlot || !tmpSecSlot) return null;

	// Legacy flat-form fields override the resolved slot's Light/Dark
	// (so a host passing both forms gets the most explicit one).
	let tmpPriLight = tmpColors.PrimaryLight   || tmpPriSlot.Light;
	let tmpPriDark  = tmpColors.PrimaryDark    || tmpPriSlot.Dark;
	let tmpSecLight = tmpColors.SecondaryLight || tmpSecSlot.Light;
	let tmpSecDark  = tmpColors.SecondaryDark  || tmpSecSlot.Dark;

	return {
		Hash:    pBrand.Hash || 'brand',
		Name:    pBrand.Name || pBrand.Hash || 'Brand',
		Icon:    pBrand.Icon || null,
		IconType: _detectIconType(pBrand),
		Tagline: (typeof pBrand.Tagline === 'string') ? pBrand.Tagline : null,
		// Optional favicon assets. Each can be: inline `<svg>` markup, a
		// data URL, or a regular URL. When both Favicon and FaviconDark
		// are supplied, paired light/dark <link rel="icon"> tags are
		// emitted with prefers-color-scheme media queries; otherwise a
		// single <link> covers both modes.
		Favicon:     pBrand.Favicon     || null,
		FaviconDark: pBrand.FaviconDark || null,
		Colors:
		{
			Primary:        tmpPriSlot.Base,
			Secondary:      tmpSecSlot.Base,
			PrimaryLight:   tmpPriLight,
			PrimaryDark:    tmpPriDark,
			SecondaryLight: tmpSecLight,
			SecondaryDark:  tmpSecDark
		}
	};
}

// Encode an inline `<svg>` blob into a data URL safe for an <img src> /
// <link href> attribute. Falls through if the input already looks like
// a URL (data:, http:, /, ./, ../).
function _faviconHref(pIcon)
{
	if (!pIcon || typeof pIcon !== 'string') return null;
	if (_isInlineSVG(pIcon))
	{
		// percent-encode SVG markup. Don't encode '#' or '&' minimally;
		// the safe path is to encode aggressively then unescape spaces.
		let tmpEncoded = encodeURIComponent(pIcon).replace(/'/g, '%27').replace(/"/g, '%22');
		return 'data:image/svg+xml;charset=utf-8,' + tmpEncoded;
	}
	if (_isImageURL(pIcon)) return pIcon;
	return null;
}

function _removeFaviconLinks()
{
	if (typeof document === 'undefined') return;
	[FAVICON_LINK_ID, FAVICON_DARK_LINK_ID].forEach((pID) =>
	{
		let tmpEl = document.getElementById(pID);
		if (tmpEl && tmpEl.parentNode) tmpEl.parentNode.removeChild(tmpEl);
	});
}

function _injectFaviconLinks(pBrand)
{
	if (typeof document === 'undefined') return;
	_removeFaviconLinks();

	let tmpLight = _faviconHref(pBrand.Favicon);
	let tmpDark  = _faviconHref(pBrand.FaviconDark);
	if (!tmpLight && !tmpDark) return;

	let tmpHasPair = !!(tmpLight && tmpDark);

	if (tmpLight)
	{
		let tmpLink = document.createElement('link');
		tmpLink.id = FAVICON_LINK_ID;
		tmpLink.rel = 'icon';
		tmpLink.href = tmpLight;
		if (/^data:image\/svg\+xml/.test(tmpLight)) tmpLink.type = 'image/svg+xml';
		if (tmpHasPair) tmpLink.media = '(prefers-color-scheme: light)';
		document.head.appendChild(tmpLink);
	}

	if (tmpDark)
	{
		let tmpLink = document.createElement('link');
		tmpLink.id = FAVICON_DARK_LINK_ID;
		tmpLink.rel = 'icon';
		tmpLink.href = tmpDark;
		if (/^data:image\/svg\+xml/.test(tmpDark)) tmpLink.type = 'image/svg+xml';
		// If we have a light variant, the dark link's media query handles
		// the swap; otherwise it serves both modes.
		if (tmpHasPair) tmpLink.media = '(prefers-color-scheme: dark)';
		document.head.appendChild(tmpLink);
	}
}

function _injectStyleElement(pCSS)
{
	if (typeof document === 'undefined') return;
	let tmpStyleEl = document.getElementById(STYLE_ELEMENT_ID);
	if (!tmpStyleEl)
	{
		tmpStyleEl = document.createElement('style');
		tmpStyleEl.id = STYLE_ELEMENT_ID;
		document.head.appendChild(tmpStyleEl);
	}
	tmpStyleEl.textContent = pCSS;
}

// Escape so the brand name can ride along inside the CSS `content`-style
// `--brand-name` value as a quoted string.
function _cssQuote(pStr)
{
	return '"' + String(pStr || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function _buildCSS(pBrand)
{
	let tmpC = pBrand.Colors;
	let tmpRoot = ':root {\n'
		+ '\t--brand-color-primary:         ' + tmpC.Primary + ';\n'
		+ '\t--brand-color-secondary:       ' + tmpC.Secondary + ';\n'
		+ '\t--brand-color-primary-light:   ' + tmpC.PrimaryLight + ';\n'
		+ '\t--brand-color-primary-dark:    ' + tmpC.PrimaryDark + ';\n'
		+ '\t--brand-color-secondary-light: ' + tmpC.SecondaryLight + ';\n'
		+ '\t--brand-color-secondary-dark:  ' + tmpC.SecondaryDark + ';\n'
		+ '\t--brand-color-primary-mode:    ' + tmpC.PrimaryLight + ';\n'
		+ '\t--brand-color-secondary-mode:  ' + tmpC.SecondaryLight + ';\n'
		+ '\t--brand-name:                  ' + _cssQuote(pBrand.Name) + ';\n'
		+ '}\n';
	// Dark-mode overrides for the *-mode variables only.
	let tmpDark = '.theme-dark {\n'
		+ '\t--brand-color-primary-mode:    ' + tmpC.PrimaryDark + ';\n'
		+ '\t--brand-color-secondary-mode:  ' + tmpC.SecondaryDark + ';\n'
		+ '}\n';
	return tmpRoot + tmpDark;
}

/**
 * Apply (or replace) the active brand. Pass `null` to clear.
 *
 * @param {object|null} pBrand
 * @returns {object|null} the normalized active brand (or null on clear)
 */
function applyBrand(pBrand)
{
	let tmpPrev = _activeBrand;

	if (pBrand === null)
	{
		_activeBrand = null;
		if (typeof document !== 'undefined')
		{
			let tmpStyleEl = document.getElementById(STYLE_ELEMENT_ID);
			if (tmpStyleEl && tmpStyleEl.parentNode) tmpStyleEl.parentNode.removeChild(tmpStyleEl);
		}
		_removeFaviconLinks();
		_fireChange(null, tmpPrev);
		return null;
	}

	let tmpNorm = _normalize(pBrand);
	if (!tmpNorm)
	{
		// Bad input — keep current brand, no-op.
		if (typeof console !== 'undefined' && console.warn)
		{
			console.warn('Theme-Brand.applyBrand: bad brand object — needs Colors.Primary + Colors.Secondary as strings.');
		}
		return _activeBrand;
	}

	_activeBrand = tmpNorm;
	_injectStyleElement(_buildCSS(tmpNorm));
	_injectFaviconLinks(tmpNorm);
	_fireChange(tmpNorm, tmpPrev);
	return tmpNorm;
}

function getActive()
{
	return _activeBrand;
}

function onChange(fCallback)
{
	if (typeof fCallback !== 'function') return function () {};
	_listeners.push(fCallback);
	return function () { offChange(fCallback); };
}

function offChange(fCallback)
{
	let tmpIdx = _listeners.indexOf(fCallback);
	if (tmpIdx >= 0) _listeners.splice(tmpIdx, 1);
}

function _fireChange(pNew, pOld)
{
	for (let i = 0; i < _listeners.length; i++)
	{
		try { _listeners[i](pNew, pOld); }
		catch (pErr) { /* swallow — listener failure must not break callers */ }
	}
}

/**
 * Reset to no-brand state and detach the injected style. Tests use this;
 * runtime hosts rarely need it.
 */
function reset()
{
	applyBrand(null);
	_listeners = [];
}

module.exports =
{
	applyBrand:      applyBrand,
	getActive:       getActive,
	onChange:        onChange,
	offChange:       offChange,
	reset:           reset,
	STYLE_ELEMENT_ID:      STYLE_ELEMENT_ID,
	FAVICON_LINK_ID:       FAVICON_LINK_ID,
	FAVICON_DARK_LINK_ID:  FAVICON_DARK_LINK_ID
};
