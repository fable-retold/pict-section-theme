/**
 * Theme-Scale — viewport scale (zoom) selector independent of theme bundles.
 *
 * Scale is a *user preference*, not a property of any particular theme:
 * the user might want Cyberpunk-at-1.25x or Retold-Manager-at-0.85x.
 * Pict-provider-theme is intentionally bundle-shaped (Tokens / SVG /
 * Image), so scale lives here at the section layer alongside Mode.
 *
 * # Apply mechanism
 *
 * Two outputs feed cooperating CSS:
 *
 *   1. `html { zoom: <scale>; }` — works for legacy stylesheets that
 *      use `px` everywhere (most Retold apps including retold-manager).
 *      Browsers (Chromium-based + Firefox 126+ + Safari) all honour
 *      `zoom` on root.
 *
 *   2. `:root { --theme-scale: <scale>; }` — exposed for stylesheets
 *      that want to opt into explicit `calc(... * var(--theme-scale))`
 *      sizing. Keeps the value addressable from JS too via
 *      `getComputedStyle(document.documentElement).getPropertyValue(...)`.
 *
 * Both are written into a single `<style id="pict-theme-scale">` element
 * appended to `<head>` after the theme provider's own style element so
 * scale wins last. Re-applying just rewrites this one element's text.
 *
 * # Listener pattern
 *
 * Mirrors pict-provider-theme.onApply(): subscribers receive the new
 * scale value plus the previous value and a return-able `dispose`
 * function. The persistence wiring in pict-section-theme.install()
 * uses this to autosave whenever the scale changes.
 *
 * # Stateless across instances
 *
 * No singleton state — each browser window has one DOM, so the module
 * tracks active scale via a module-level variable, but exposes
 * `getActive()` for callers that want to query it. `applyScale()` is
 * idempotent: applying the same value re-injects the same CSS (cheap
 * no-op).
 */

const STYLE_ELEMENT_ID = 'pict-theme-scale';
const CSS_VAR_NAME = '--theme-scale';
const DEFAULT_SCALE = 1.0;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;

// Curated list of presets. Hosts that want a different range can pass
// a custom `Presets` array to the ScaleSelect view; this default covers
// the readability common cases without overwhelming the dropdown.
const PRESETS =
[
	{ Value: 0.75, Label: 'Tiny (75%)' },
	{ Value: 0.85, Label: 'Small (85%)' },
	{ Value: 1.00, Label: 'Default (100%)' },
	{ Value: 1.15, Label: 'Comfortable (115%)' },
	{ Value: 1.25, Label: 'Large (125%)' },
	{ Value: 1.50, Label: 'Huge (150%)' },
	{ Value: 1.75, Label: 'Extra Huge (175%)' },
	{ Value: 2.00, Label: 'Massive (200%)' }
];

let _activeScale = DEFAULT_SCALE;
let _listeners = [];

function _clamp(pValue)
{
	let tmpNum = Number(pValue);
	if (!isFinite(tmpNum) || tmpNum <= 0) return DEFAULT_SCALE;
	if (tmpNum < MIN_SCALE) return MIN_SCALE;
	if (tmpNum > MAX_SCALE) return MAX_SCALE;
	return tmpNum;
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

function _buildCSS(pScale)
{
	// `zoom` on <html> scales everything (px + rem + layout). The
	// `--theme-scale` custom property exposes the same value to any CSS
	// that wants to react explicitly via calc().
	return ':root {\n'
		+ '\t' + CSS_VAR_NAME + ': ' + pScale + ';\n'
		+ '}\n'
		+ 'html {\n'
		+ '\tzoom: ' + pScale + ';\n'
		+ '}\n';
}

/**
 * Apply a viewport scale.
 *
 * @param {number} pScale - desired multiplier (e.g. 1.0, 1.25). Values
 *   outside [MIN_SCALE, MAX_SCALE] are clamped; non-finite values
 *   reset to DEFAULT_SCALE.
 * @returns {number} the actually-applied scale (after clamping).
 */
function applyScale(pScale)
{
	let tmpPrev = _activeScale;
	let tmpNext = _clamp(pScale);
	_activeScale = tmpNext;
	_injectStyleElement(_buildCSS(tmpNext));
	if (tmpPrev !== tmpNext) { _fireChange(tmpNext, tmpPrev); }
	return tmpNext;
}

function getActive()
{
	return _activeScale;
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

function _fireChange(pNewScale, pOldScale)
{
	for (let i = 0; i < _listeners.length; i++)
	{
		try { _listeners[i](pNewScale, pOldScale); }
		catch (pErr) { /* listener failures must not break callers */ }
	}
}

/**
 * Reset to default scale and remove the injected style element. Useful
 * for tests + "reset to defaults" affordances.
 */
function reset()
{
	_activeScale = DEFAULT_SCALE;
	if (typeof document !== 'undefined')
	{
		let tmpStyleEl = document.getElementById(STYLE_ELEMENT_ID);
		if (tmpStyleEl && tmpStyleEl.parentNode) tmpStyleEl.parentNode.removeChild(tmpStyleEl);
	}
	_listeners = [];
}

module.exports =
{
	applyScale: applyScale,
	getActive:  getActive,
	onChange:   onChange,
	offChange:  offChange,
	reset:      reset,

	PRESETS:        PRESETS,
	DEFAULT_SCALE:  DEFAULT_SCALE,
	MIN_SCALE:      MIN_SCALE,
	MAX_SCALE:      MAX_SCALE,
	STYLE_ELEMENT_ID: STYLE_ELEMENT_ID,
	CSS_VAR_NAME:     CSS_VAR_NAME
};
