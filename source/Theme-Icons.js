/**
 * Theme-Icons — single source of truth for the inline SVG glyphs the
 * theme section uses (sun, moon, system / monitor, plus a chevron for
 * dropdown triggers).
 *
 * Every icon:
 *   - Is a self-contained SVG string suitable for direct DOM insertion
 *     (innerHTML, template substitution, or pict-section-modal's
 *     `Icon: <html>` field on dropdown items).
 *   - Uses `currentColor` for stroke so it picks up the surrounding
 *     text colour from the active theme (light + dark both look right
 *     without per-mode swaps).
 *   - Has `aria-hidden="true"` so screen readers ignore the decorative
 *     glyph and rely on the surrounding label / aria-label instead.
 *
 * The shapes are intentionally line-art (stroke-based, fill="none") so
 * they read at very small sizes (12–16 px) without going muddy. The
 * "system" icon is a stylised display (rectangle + stand) rather than
 * the unicode 🖥 to keep visual weight consistent with sun + moon.
 *
 * Need a different size? Pass `pSizePx` to any of the iconXxx() helpers
 * and the wrapper SVG's width/height are emitted with that value. The
 * default is 14 px which matches the mode toggle's existing visual.
 */

const _DEFAULT_SIZE_PX = 14;

function _wrap(pSizePx, pInner)
{
	let tmpSize = (typeof pSizePx === 'number' && pSizePx > 0) ? pSizePx : _DEFAULT_SIZE_PX;
	return '<svg class="pict-theme-icon"'
		+ ' width="' + tmpSize + '" height="' + tmpSize + '"'
		+ ' viewBox="0 0 24 24" fill="none"'
		+ ' stroke="currentColor" stroke-width="2"'
		+ ' stroke-linecap="round" stroke-linejoin="round"'
		+ ' aria-hidden="true">'
		+ pInner
		+ '</svg>';
}

/**
 * Sun glyph — central disc + 8 radial rays. Communicates "light mode"
 * universally. Slightly chunkier disc than the typical Feather sun so
 * it still reads at 12 px.
 */
function iconSun(pSizePx)
{
	return _wrap(pSizePx,
		'<circle cx="12" cy="12" r="4"/>'
		+ '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>');
}

/**
 * Moon glyph — clean crescent (one continuous filled-look path drawn
 * as a stroke). Avoids the brittle thin-crescent unicode characters
 * that fall back to weird outline glyphs in some system fonts.
 */
function iconMoon(pSizePx)
{
	return _wrap(pSizePx,
		'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');
}

/**
 * System / display glyph — a small monitor with a stand. Communicates
 * "follow the OS preference" without ambiguity (a monitor is universal
 * UI for system settings, more than the gear icon would be).
 */
function iconSystem(pSizePx)
{
	return _wrap(pSizePx,
		'<rect x="2" y="4" width="20" height="14" rx="2"/>'
		+ '<path d="M8 21h8M12 18v3"/>');
}

/**
 * Composite: a sun + moon side-by-side, sized so the two icons fit in
 * the same horizontal footprint as a single icon. Used in the picker
 * to indicate a paired (Light + Dark) theme without needing two
 * separate visual columns.
 */
function iconPaired(pSizePx)
{
	let tmpSize = (typeof pSizePx === 'number' && pSizePx > 0) ? pSizePx : _DEFAULT_SIZE_PX;
	// Each half uses currentColor; the sun is rendered slightly smaller
	// in the left half and the moon in the right half by abusing the
	// viewBox width.
	return '<svg class="pict-theme-icon pict-theme-icon-paired"'
		+ ' width="' + (tmpSize * 1.6) + '" height="' + tmpSize + '"'
		+ ' viewBox="0 0 38 24" fill="none"'
		+ ' stroke="currentColor" stroke-width="2"'
		+ ' stroke-linecap="round" stroke-linejoin="round"'
		+ ' aria-hidden="true">'
		// Sun on the left (centred at 8,12, radius 3)
		+ '<circle cx="8" cy="12" r="3"/>'
		+ '<path d="M8 4v1.5M8 18.5V20M2.5 12H4M12 12h1.5M4.1 7.1l1 1M11.1 7.1l-1 1M4.1 16.9l1-1M11.1 16.9l-1-1"/>'
		// Moon on the right (mirrored crescent, centred near x=28)
		+ '<path d="M33 13.5A6.5 6.5 0 1 1 26 6a5 5 0 0 0 7 7.5z"/>'
		+ '</svg>';
}

/**
 * Down-chevron used by dropdown triggers. Sized to sit alongside body
 * text (10 px default).
 */
function iconChevronDown(pSizePx)
{
	let tmpSize = (typeof pSizePx === 'number' && pSizePx > 0) ? pSizePx : 10;
	return '<svg class="pict-theme-icon pict-theme-icon-chevron"'
		+ ' width="' + tmpSize + '" height="' + tmpSize + '"'
		+ ' viewBox="0 0 12 12" fill="none"'
		+ ' stroke="currentColor" stroke-width="1.6"'
		+ ' stroke-linecap="round" stroke-linejoin="round"'
		+ ' aria-hidden="true">'
		+ '<path d="M3 4.5l3 3 3-3"/>'
		+ '</svg>';
}

/**
 * Pick the right capability icon for a theme based on its mode strategy.
 * Returns the composite paired glyph for paired themes, sun for light-only,
 * moon for dark-only.
 *
 * @param {string} pStrategy - 'single' or 'system'/'paired'
 * @param {string} pDefaultMode - 'light' or 'dark' (only consulted for single)
 * @param {number} [pSizePx]
 */
function iconForTheme(pStrategy, pDefaultMode, pSizePx)
{
	if (pStrategy === 'single')
	{
		return (pDefaultMode === 'dark') ? iconMoon(pSizePx) : iconSun(pSizePx);
	}
	return iconPaired(pSizePx);
}

module.exports =
{
	iconSun:         iconSun,
	iconMoon:        iconMoon,
	iconSystem:      iconSystem,
	iconPaired:      iconPaired,
	iconChevronDown: iconChevronDown,
	iconForTheme:    iconForTheme,
	DEFAULT_SIZE_PX: _DEFAULT_SIZE_PX
};
