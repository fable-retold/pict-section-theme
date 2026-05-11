/**
 * Theme-Logo — deterministic project-name → SVG logo generator.
 *
 * Hashes a project name and derives:
 *   - A two-color brand palette (primary + analogous secondary), each
 *     with `LightTheme` (deep) and `DarkTheme` (lifted) tones.
 *   - A monogram from the first letter of every hyphen-segment, capped
 *     at four characters.
 *   - A *composition* — one of a small set of deliberate two-shape
 *     arrangements (intersect, concentric, eclipse, bisect, etc.) — that
 *     carries the primary + secondary brand colors as the visual mark.
 *   - A frame variant that the composition lives inside.
 *
 * Renders four variants per project (light/dark × filled/outline) plus a
 * dedicated favicon-grade simplified render path that drops accent details
 * for legibility at 32px.
 *
 * The compositions are hand-designed for visual coherence: each one is
 * built from two named geometric primitives in a deliberate spatial
 * relationship, not a pile of corner-decorations. The hash picks which
 * composition + minor parameter choices.
 *
 * Synchronous, deterministic. Same name → same logo.
 *
 * Re-exported from pict-section-theme as `LogoGenerator`. Use from a
 * Brand block to generate the topbar mark + favicons in one shot:
 *
 *     const libPictSectionTheme = require('pict-section-theme');
 *     const tmpLogo = libPictSectionTheme.LogoGenerator.generate(
 *         'retold-manager', { Palette: 'ocean' });
 *     module.exports = {
 *         Hash:        'retold-manager',
 *         Name:        'Retold Manager',
 *         Icon:        tmpLogo.Variants['filled-light'],
 *         IconType:    'svg',
 *         Favicon:     tmpLogo.Favicons.light,
 *         FaviconDark: tmpLogo.Favicons.dark,
 *         Colors:
 *         {
 *             Primary:        tmpLogo.Brand.Primary.LightTheme,
 *             Secondary:      tmpLogo.Brand.Secondary.LightTheme,
 *             PrimaryLight:   tmpLogo.Brand.Primary.LightTheme,
 *             PrimaryDark:    tmpLogo.Brand.Primary.DarkTheme,
 *             SecondaryLight: tmpLogo.Brand.Secondary.LightTheme,
 *             SecondaryDark:  tmpLogo.Brand.Secondary.DarkTheme
 *         }
 *     };
 *
 * @author retold-logo-harness
 */

// ── Hashing ──────────────────────────────────────────────────────────────
function hashString(pString)
{
	let tmpHash = 0x811c9dc5;
	for (let i = 0; i < pString.length; i++)
	{
		tmpHash ^= pString.charCodeAt(i);
		tmpHash = Math.imul(tmpHash, 0x01000193);
	}
	let tmpBytes = new Array(8);
	let tmpState = tmpHash >>> 0;
	for (let i = 0; i < 8; i++)
	{
		tmpState ^= tmpState << 13;
		tmpState ^= tmpState >>> 17;
		tmpState ^= tmpState << 5;
		tmpState >>>= 0;
		tmpBytes[i] = tmpState & 0xff;
	}
	return tmpBytes;
}

// ── Color helpers ────────────────────────────────────────────────────────
function hslToHex(pHue, pSat, pLight)
{
	let tmpH = ((pHue % 360) + 360) % 360 / 360;
	let tmpS = Math.max(0, Math.min(1, pSat / 100));
	let tmpL = Math.max(0, Math.min(1, pLight / 100));
	let tmpQ = tmpL < 0.5 ? tmpL * (1 + tmpS) : tmpL + tmpS - tmpL * tmpS;
	let tmpP = 2 * tmpL - tmpQ;
	let fHue2RGB = (pP, pQ, pT) =>
	{
		let tmpT = pT;
		if (tmpT < 0) tmpT += 1;
		if (tmpT > 1) tmpT -= 1;
		if (tmpT < 1 / 6) return pP + (pQ - pP) * 6 * tmpT;
		if (tmpT < 1 / 2) return pQ;
		if (tmpT < 2 / 3) return pP + (pQ - pP) * (2 / 3 - tmpT) * 6;
		return pP;
	};
	let tmpR = Math.round(fHue2RGB(tmpP, tmpQ, tmpH + 1 / 3) * 255);
	let tmpG = Math.round(fHue2RGB(tmpP, tmpQ, tmpH) * 255);
	let tmpB = Math.round(fHue2RGB(tmpP, tmpQ, tmpH - 1 / 3) * 255);
	return '#' + [tmpR, tmpG, tmpB].map((pV) => pV.toString(16).padStart(2, '0')).join('');
}

// ── Palette definitions ──────────────────────────────────────────────────
// Each palette is a curated constraint set on hue ranges, saturation,
// and lightness. Feeding the same hash through different palettes gives
// the SAME projects different (but cohesive) brand colors. The `Default`
// palette preserves the original free-hue behavior.
//
// Each palette's `Derive` function consumes hash bytes and returns the
// six values needed to construct a brand pair:
//   { primaryHue, primarySat, primaryLight,
//     secondaryHue, secondarySat, secondaryLight }
//
// LightTheme tones use the returned values directly. DarkTheme tones
// are computed by lifting lightness +18 and trimming saturation -6 so
// the same hue reads on dark backgrounds.
//
// Bytes used: [0]+[1] for primary hue (16-bit spread within range);
// [2]+[3] for secondary hue or arc selection; [4] for primary sat;
// [5] for primary lightness; [6] for secondary sat; [7] for secondary
// lightness. Bytes [4..7] still leave [6]/[7] available for composition
// frame rotation — the frame variant uses [4]%4 and the composition
// uses [5]%12, so there's overlap. That overlap is fine because both
// downstream consumers index modulo their array sizes; the brand
// derivation samples the same bytes through different lerp ranges.
function _lerp(pMin, pMax, pT)
{
	let tmpClamped = Math.max(0, Math.min(1, pT));
	return pMin + (pMax - pMin) * tmpClamped;
}

function _byte01(pByte)
{
	return pByte / 255;
}

function _twoBytes01(pHi, pLo)
{
	return (pHi * 256 + pLo) / 65535;
}

const PALETTES = [
	{
		Key: 'mix',
		Label: 'Ecosystem mix',
		Description: 'Each project deterministically picks one of synthwave, ocean, or desert based on its hash. Each project stays cohesive within its own palette; across the ecosystem you get all three for variety. The recommended default.',
		// `MixOf` is the list of palette keys to pick from; the picker
		// uses one hash byte to select. Self-references are resolved in
		// `deriveBrand` after PALETTE_BY_KEY has been built.
		MixOf: ['synthwave', 'ocean', 'desert'],
		// Derive is a no-op marker — the real work happens in deriveBrand
		// when it sees Palette.MixOf and recurses into the picked palette.
		Derive: null
	},
	{
		Key: 'default',
		Label: 'Free spectrum',
		Description: 'No hue constraint — every project picks anywhere on the wheel. Secondary is an analogous offset (±30-49°). Yields high variety but the ecosystem feels noisy when seen all at once.',
		Derive: function (pBytes)
		{
			let tmpPrimaryHue = (pBytes[0] * 256 + pBytes[1]) % 360;
			let tmpDirection = (pBytes[2] & 1) ? 1 : -1;
			let tmpOffset = 30 + (pBytes[3] % 20);
			let tmpSecondaryHue = (tmpPrimaryHue + tmpDirection * tmpOffset + 360) % 360;
			return {
				primaryHue: tmpPrimaryHue,
				primarySat: 62 + (pBytes[4] % 18),
				primaryLight: 46,
				secondaryHue: tmpSecondaryHue,
				secondarySat: 56 + (pBytes[5] % 18),
				secondaryLight: 52
			};
		}
	},
	{
		Key: 'desert',
		Label: 'Desert',
		Description: 'Warm earth tones — sand, terracotta, ochre — with sage / teal accents. Primary hues stay in the 18-55° band; secondary is a complementary cool-side accent at 160-200°. Saturations stay muted so nothing screams.',
		Derive: function (pBytes)
		{
			return {
				primaryHue:     _lerp(18, 55, _twoBytes01(pBytes[0], pBytes[1])),
				primarySat:     _lerp(48, 72, _byte01(pBytes[4])),
				primaryLight:   _lerp(44, 54, _byte01(pBytes[5])),
				secondaryHue:   _lerp(160, 200, _twoBytes01(pBytes[2], pBytes[3])),
				secondarySat:   _lerp(34, 56, _byte01(pBytes[6])),
				secondaryLight: _lerp(48, 60, _byte01(pBytes[7]))
			};
		}
	},
	{
		Key: 'ocean',
		Label: 'Ocean',
		Description: 'Cool blue-greens (180-235°) with warm coral / amber punctuation (5-30°). Saturated primaries and warm secondaries — feels like sea + sun on the horizon.',
		Derive: function (pBytes)
		{
			return {
				primaryHue:     _lerp(180, 235, _twoBytes01(pBytes[0], pBytes[1])),
				primarySat:     _lerp(55, 78, _byte01(pBytes[4])),
				primaryLight:   _lerp(40, 54, _byte01(pBytes[5])),
				secondaryHue:   _lerp(5, 30, _twoBytes01(pBytes[2], pBytes[3])),
				secondarySat:   _lerp(60, 80, _byte01(pBytes[6])),
				secondaryLight: _lerp(54, 64, _byte01(pBytes[7]))
			};
		}
	},
	{
		Key: 'forest',
		Label: 'Forest',
		Description: 'Greens and warm wood-earth tones. Primary is a cool-to-warm green (95-150°); secondary picks from warm earth (25-55°) for trunk/leaf-litter accents. Lower lightness reads as deeper / shaded.',
		Derive: function (pBytes)
		{
			return {
				primaryHue:     _lerp(95, 150, _twoBytes01(pBytes[0], pBytes[1])),
				primarySat:     _lerp(40, 68, _byte01(pBytes[4])),
				primaryLight:   _lerp(36, 50, _byte01(pBytes[5])),
				secondaryHue:   _lerp(25, 55, _twoBytes01(pBytes[2], pBytes[3])),
				secondarySat:   _lerp(48, 72, _byte01(pBytes[6])),
				secondaryLight: _lerp(48, 60, _byte01(pBytes[7]))
			};
		}
	},
	{
		Key: 'synthwave',
		Label: 'Synthwave',
		Description: 'Bipolar neon — half the projects land on hot pink/magenta (280-330°), half on electric cyan (180-205°), and the secondary always opposes. High saturation, mid-high lightness. Apply with both eyes open.',
		Derive: function (pBytes)
		{
			// Hash byte 2 picks which pole the primary takes; secondary
			// goes to the opposite pole. The 16-bit hue draw still happens
			// inside the chosen pole's arc.
			let tmpPolePink = (pBytes[2] & 1) === 0;
			let tmpPrimaryHue = tmpPolePink
				? _lerp(280, 330, _twoBytes01(pBytes[0], pBytes[1]))
				: _lerp(180, 205, _twoBytes01(pBytes[0], pBytes[1]));
			let tmpSecondaryHue = tmpPolePink
				? _lerp(180, 205, _twoBytes01(pBytes[3], pBytes[6]))
				: _lerp(280, 330, _twoBytes01(pBytes[3], pBytes[6]));
			return {
				primaryHue:     tmpPrimaryHue,
				primarySat:     _lerp(72, 92, _byte01(pBytes[4])),
				primaryLight:   _lerp(48, 60, _byte01(pBytes[5])),
				secondaryHue:   tmpSecondaryHue,
				secondarySat:   _lerp(68, 88, _byte01(pBytes[6])),
				secondaryLight: _lerp(56, 68, _byte01(pBytes[7]))
			};
		}
	},
	{
		Key: 'twilight',
		Label: 'Twilight',
		Description: 'Deep dusk purples (240-290°) accented by magenta (305-345°). Like the sky 20 minutes after sunset on a clear night.',
		Derive: function (pBytes)
		{
			return {
				primaryHue:     _lerp(240, 290, _twoBytes01(pBytes[0], pBytes[1])),
				primarySat:     _lerp(50, 72, _byte01(pBytes[4])),
				primaryLight:   _lerp(40, 54, _byte01(pBytes[5])),
				secondaryHue:   _lerp(305, 345, _twoBytes01(pBytes[2], pBytes[3])),
				secondarySat:   _lerp(55, 78, _byte01(pBytes[6])),
				secondaryLight: _lerp(54, 66, _byte01(pBytes[7]))
			};
		}
	},
	{
		Key: 'cosmos',
		Label: 'Cosmos',
		Description: 'Deep space blues (215-260°) with golden / amber star-fall accents (38-58°). Cool primary, warm secondary — strong complementary tension.',
		Derive: function (pBytes)
		{
			return {
				primaryHue:     _lerp(215, 260, _twoBytes01(pBytes[0], pBytes[1])),
				primarySat:     _lerp(55, 78, _byte01(pBytes[4])),
				primaryLight:   _lerp(38, 52, _byte01(pBytes[5])),
				secondaryHue:   _lerp(38, 58, _twoBytes01(pBytes[2], pBytes[3])),
				secondarySat:   _lerp(60, 82, _byte01(pBytes[6])),
				secondaryLight: _lerp(52, 64, _byte01(pBytes[7]))
			};
		}
	},
	{
		Key: 'carnival',
		Label: 'Carnival',
		Description: 'Bright, festive, multi-hue. Picks from 8 bold poles around the wheel (red, orange, yellow, lime, teal, blue, purple, magenta) — siblings get distinctly different colors but every project is high-saturation and cheerful. Used by the example applications.',
		// 8-pole carnival hue picker. Hash byte 2 chooses a pole; bytes 0/1
		// add a small jitter (±8°) within the pole so two siblings on the
		// same pole still differ slightly. Secondary is +110° from primary
		// (split-complementary) for strong but balanced tension.
		Derive: function (pBytes)
		{
			const POLES = [10, 38, 55, 95, 175, 215, 275, 320];
			let tmpPole = POLES[pBytes[2] % POLES.length];
			let tmpJitter = (_twoBytes01(pBytes[0], pBytes[1]) - 0.5) * 16; // ±8°
			let tmpPrimary = (tmpPole + tmpJitter + 360) % 360;
			let tmpSecondary = (tmpPrimary + 110) % 360;
			return {
				primaryHue:     tmpPrimary,
				primarySat:     _lerp(78, 92, _byte01(pBytes[4])),
				primaryLight:   _lerp(50, 62, _byte01(pBytes[5])),
				secondaryHue:   tmpSecondary,
				secondarySat:   _lerp(72, 88, _byte01(pBytes[6])),
				secondaryLight: _lerp(56, 68, _byte01(pBytes[7]))
			};
		}
	}
];

const PALETTE_BY_KEY = (function ()
{
	let tmpMap = {};
	PALETTES.forEach((pP) => { tmpMap[pP.Key] = pP; });
	return tmpMap;
})();

// ── Brand color generation ───────────────────────────────────────────────
function deriveBrand(pBytes, pPaletteKey)
{
	let tmpRequestedKey = pPaletteKey || 'mix';
	let tmpPalette = PALETTE_BY_KEY[tmpRequestedKey] || PALETTE_BY_KEY['default'];

	// Mix palettes resolve to one of their MixOf members based on a hash
	// byte. We keep the requested key separate from the resolved key so
	// the UI can show both ("ocean (via mix)").
	let tmpResolvedKey = tmpPalette.Key;
	if (Array.isArray(tmpPalette.MixOf) && tmpPalette.MixOf.length > 0)
	{
		// Use byte[2] for the pick — independent of the hue-deriving
		// bytes (0/1) and saturation/lightness bytes (4-7), so the pick
		// is reliably spread regardless of which palette is chosen.
		let tmpPickIdx = pBytes[2] % tmpPalette.MixOf.length;
		tmpResolvedKey = tmpPalette.MixOf[tmpPickIdx];
		tmpPalette = PALETTE_BY_KEY[tmpResolvedKey] || PALETTE_BY_KEY['default'];
	}

	let tmpV = tmpPalette.Derive(pBytes);

	let tmpDarkSat = Math.max(0, tmpV.primarySat - 6);
	let tmpDarkSecondarySat = Math.max(0, tmpV.secondarySat - 6);
	let tmpDarkLight = Math.min(80, tmpV.primaryLight + 18);
	let tmpDarkSecondaryLight = Math.min(80, tmpV.secondaryLight + 18);

	return {
		Palette: tmpRequestedKey,
		ResolvedPalette: tmpResolvedKey,
		Primary:
		{
			Hue: Math.round(tmpV.primaryHue),
			LightTheme: hslToHex(tmpV.primaryHue, tmpV.primarySat, tmpV.primaryLight),
			DarkTheme:  hslToHex(tmpV.primaryHue, tmpDarkSat, tmpDarkLight)
		},
		Secondary:
		{
			Hue: Math.round(tmpV.secondaryHue),
			LightTheme: hslToHex(tmpV.secondaryHue, tmpV.secondarySat, tmpV.secondaryLight),
			DarkTheme:  hslToHex(tmpV.secondaryHue, tmpDarkSecondarySat, tmpDarkSecondaryLight)
		}
	};
}

// ── Monogram ─────────────────────────────────────────────────────────────
function extractMonogram(pName)
{
	let tmpSegments = String(pName || '').split('-').filter((pSeg) => pSeg.length > 0);
	let tmpInitials = tmpSegments.map((pSeg) => pSeg.charAt(0).toUpperCase());
	if (tmpInitials.length > 4) tmpInitials = tmpInitials.slice(0, 4);
	return tmpInitials.join('') || '?';
}

function monogramFontSize(pMonogram)
{
	switch (pMonogram.length)
	{
		case 1: return 56;
		case 2: return 38;
		case 3: return 28;
		case 4: return 22;
		default: return 20;
	}
}

// ── Frame variants ───────────────────────────────────────────────────────
const FRAME_VARIANTS = [
	(pBox) => `M ${pBox.x + pBox.r} ${pBox.y}
		H ${pBox.x + pBox.w - pBox.r}
		Q ${pBox.x + pBox.w} ${pBox.y} ${pBox.x + pBox.w} ${pBox.y + pBox.r}
		V ${pBox.y + pBox.h - pBox.r}
		Q ${pBox.x + pBox.w} ${pBox.y + pBox.h} ${pBox.x + pBox.w - pBox.r} ${pBox.y + pBox.h}
		H ${pBox.x + pBox.r}
		Q ${pBox.x} ${pBox.y + pBox.h} ${pBox.x} ${pBox.y + pBox.h - pBox.r}
		V ${pBox.y + pBox.r}
		Q ${pBox.x} ${pBox.y} ${pBox.x + pBox.r} ${pBox.y} Z`,
	(pBox) =>
	{
		let tmpCx = pBox.x + pBox.w / 2;
		let tmpCy = pBox.y + pBox.h / 2;
		let tmpR = Math.min(pBox.w, pBox.h) / 2;
		return `M ${tmpCx - tmpR} ${tmpCy}
			A ${tmpR} ${tmpR} 0 1 0 ${tmpCx + tmpR} ${tmpCy}
			A ${tmpR} ${tmpR} 0 1 0 ${tmpCx - tmpR} ${tmpCy} Z`;
	},
	(pBox) =>
	{
		let tmpCx = pBox.x + pBox.w / 2;
		let tmpCy = pBox.y + pBox.h / 2;
		let tmpR = Math.min(pBox.w, pBox.h) / 2;
		let tmpPts = [];
		for (let i = 0; i < 6; i++)
		{
			let tmpAng = (Math.PI / 3) * i - Math.PI / 2;
			tmpPts.push((tmpCx + tmpR * Math.cos(tmpAng)).toFixed(2)
				+ ' ' + (tmpCy + tmpR * Math.sin(tmpAng)).toFixed(2));
		}
		return 'M ' + tmpPts[0] + ' L ' + tmpPts.slice(1).join(' L ') + ' Z';
	},
	(pBox) =>
	{
		let tmpCx = pBox.x + pBox.w / 2;
		let tmpCy = pBox.y + pBox.h / 2;
		let tmpA = pBox.w / 2;
		let tmpB = pBox.h / 2;
		let tmpC = 0.55228;
		let tmpK = tmpC * 1.18;
		return `M ${tmpCx - tmpA} ${tmpCy}
			C ${tmpCx - tmpA} ${tmpCy - tmpK * tmpB}, ${tmpCx - tmpK * tmpA} ${tmpCy - tmpB}, ${tmpCx} ${tmpCy - tmpB}
			C ${tmpCx + tmpK * tmpA} ${tmpCy - tmpB}, ${tmpCx + tmpA} ${tmpCy - tmpK * tmpB}, ${tmpCx + tmpA} ${tmpCy}
			C ${tmpCx + tmpA} ${tmpCy + tmpK * tmpB}, ${tmpCx + tmpK * tmpA} ${tmpCy + tmpB}, ${tmpCx} ${tmpCy + tmpB}
			C ${tmpCx - tmpK * tmpA} ${tmpCy + tmpB}, ${tmpCx - tmpA} ${tmpCy + tmpK * tmpB}, ${tmpCx - tmpA} ${tmpCy} Z`;
	}
];

// ── Mark compositions ────────────────────────────────────────────────────
// Each composition is a deliberate two-shape arrangement (or one shape
// with a bold geometric move) that uses primary + secondary colors. The
// mark sits behind the monogram. Hash bytes 6 and 7 select minor
// variations (offsets, rotations, sizing).
//
// Each function returns:
//   { Inside, OutlineInside, Favicon }
// where:
//   Inside        — the mark to draw INSIDE the frame for filled variants
//                   (uses secondary for the "second shape" so both brand
//                   colors show)
//   OutlineInside — a stroke-only version for outline variants
//   Favicon       — a dramatically simplified version (single shape,
//                   higher contrast) for tiny rendering
//
// Each composition's spatial relationship: shape A and shape B in some
// deliberate arrangement, not "primary mark + corner decoration."
const COMPOSITIONS = [
	// ── 0: Eclipse — two circles offset, secondary partially overlapping primary
	{
		Name: 'eclipse',
		Build: (pBytes, pColors) =>
		{
			let tmpDir = (pBytes[6] & 1) ? 1 : -1;
			let tmpOff = 14 + (pBytes[7] % 8);  // 14..21
			let tmpR = 30;
			let tmpAx = 48 + tmpDir * (-tmpOff / 2);
			let tmpBx = 48 + tmpDir * (tmpOff / 2);
			return {
				Inside: `<circle cx="${tmpBx}" cy="48" r="${tmpR}" fill="${pColors.Secondary}" opacity="0.85"/>
					<circle cx="${tmpAx}" cy="48" r="${tmpR}" fill="${pColors.PrimaryDeep}" opacity="0.95"/>`,
				OutlineInside: `<circle cx="${tmpBx}" cy="48" r="${tmpR}" fill="none" stroke="${pColors.Secondary}" stroke-width="2.5"/>
					<circle cx="${tmpAx}" cy="48" r="${tmpR}" fill="none" stroke="${pColors.Primary}" stroke-width="3"/>`,
				Favicon: `<circle cx="${tmpBx}" cy="48" r="${tmpR + 4}" fill="${pColors.Secondary}"/>
					<circle cx="${tmpAx}" cy="48" r="${tmpR + 4}" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 1: Concentric — three rings (or two rings + central disk)
	{
		Name: 'concentric',
		Build: (pBytes, pColors) =>
		{
			let tmpStyle = pBytes[6] % 3;  // 0=all rings, 1=disk + rings, 2=ring + disk
			let tmpInner = 14 + (pBytes[7] % 4);
			let tmpMid = tmpInner + 11;
			let tmpOuter = tmpMid + 11;
			let tmpInside = '';
			if (tmpStyle === 0)
			{
				tmpInside = `<circle cx="48" cy="48" r="${tmpOuter}" fill="none" stroke="${pColors.Secondary}" stroke-width="3"/>
					<circle cx="48" cy="48" r="${tmpMid}" fill="none" stroke="${pColors.Primary}" stroke-width="3.5"/>
					<circle cx="48" cy="48" r="${tmpInner}" fill="${pColors.Secondary}"/>`;
			}
			else if (tmpStyle === 1)
			{
				tmpInside = `<circle cx="48" cy="48" r="${tmpOuter}" fill="${pColors.Secondary}" opacity="0.85"/>
					<circle cx="48" cy="48" r="${tmpMid}" fill="${pColors.Primary}"/>`;
			}
			else
			{
				tmpInside = `<circle cx="48" cy="48" r="${tmpOuter}" fill="none" stroke="${pColors.Primary}" stroke-width="4"/>
					<circle cx="48" cy="48" r="${tmpInner + 4}" fill="${pColors.Secondary}"/>`;
			}
			return {
				Inside: tmpInside,
				OutlineInside: `<circle cx="48" cy="48" r="${tmpOuter}" fill="none" stroke="${pColors.Primary}" stroke-width="3"/>
					<circle cx="48" cy="48" r="${tmpInner}" fill="none" stroke="${pColors.Secondary}" stroke-width="3"/>`,
				Favicon: `<circle cx="48" cy="48" r="${tmpOuter + 4}" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 2: Bisect — chord cuts a circle, two halves get two colors
	{
		Name: 'bisect',
		Build: (pBytes, pColors) =>
		{
			let tmpAng = (pBytes[6] / 255) * Math.PI * 2;
			let tmpR = 36;
			let tmpDx = Math.cos(tmpAng) * tmpR;
			let tmpDy = Math.sin(tmpAng) * tmpR;
			let tmpX1 = (48 - tmpDx).toFixed(2);
			let tmpY1 = (48 - tmpDy).toFixed(2);
			let tmpX2 = (48 + tmpDx).toFixed(2);
			let tmpY2 = (48 + tmpDy).toFixed(2);
			let tmpHalfA = `M ${tmpX1} ${tmpY1} A ${tmpR} ${tmpR} 0 0 1 ${tmpX2} ${tmpY2} Z`;
			let tmpHalfB = `M ${tmpX1} ${tmpY1} A ${tmpR} ${tmpR} 0 0 0 ${tmpX2} ${tmpY2} Z`;
			return {
				Inside: `<path d="${tmpHalfA}" fill="${pColors.Primary}" opacity="0.95"/>
					<path d="${tmpHalfB}" fill="${pColors.Secondary}" opacity="0.95"/>`,
				OutlineInside: `<circle cx="48" cy="48" r="${tmpR}" fill="none" stroke="${pColors.Primary}" stroke-width="3"/>
					<line x1="${tmpX1}" y1="${tmpY1}" x2="${tmpX2}" y2="${tmpY2}" stroke="${pColors.Secondary}" stroke-width="2.5"/>`,
				Favicon: `<circle cx="48" cy="48" r="${tmpR + 4}" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 3: Stack — two stacked shapes, primary (square) + secondary (smaller square offset)
	{
		Name: 'stack',
		Build: (pBytes, pColors) =>
		{
			let tmpDir = (pBytes[6] & 1) ? 1 : -1;
			let tmpOff = 8 + (pBytes[7] % 6);
			let tmpSize = 48;
			let tmpR = 8;
			let tmpAx = 24 - tmpOff * tmpDir / 2;
			let tmpAy = 24 - tmpOff / 2;
			let tmpBx = 24 + tmpOff * tmpDir / 2;
			let tmpBy = 24 + tmpOff / 2;
			return {
				Inside: `<rect x="${tmpBx}" y="${tmpBy}" width="${tmpSize}" height="${tmpSize}" rx="${tmpR}" fill="${pColors.Secondary}" opacity="0.9"/>
					<rect x="${tmpAx}" y="${tmpAy}" width="${tmpSize}" height="${tmpSize}" rx="${tmpR}" fill="${pColors.Primary}"/>`,
				OutlineInside: `<rect x="${tmpBx}" y="${tmpBy}" width="${tmpSize}" height="${tmpSize}" rx="${tmpR}" fill="none" stroke="${pColors.Secondary}" stroke-width="2.5"/>
					<rect x="${tmpAx}" y="${tmpAy}" width="${tmpSize}" height="${tmpSize}" rx="${tmpR}" fill="none" stroke="${pColors.Primary}" stroke-width="3"/>`,
				Favicon: `<rect x="${tmpAx - 2}" y="${tmpAy - 2}" width="${tmpSize + 4}" height="${tmpSize + 4}" rx="${tmpR + 1}" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 4: Aperture — outer ring with primary fill, central disk in secondary forming a "viewport"
	{
		Name: 'aperture',
		Build: (pBytes, pColors) =>
		{
			let tmpOuterR = 38;
			let tmpInnerR = 18 + (pBytes[6] % 6);
			return {
				Inside: `<circle cx="48" cy="48" r="${tmpOuterR}" fill="${pColors.Primary}"/>
					<circle cx="48" cy="48" r="${tmpInnerR}" fill="${pColors.Secondary}"/>`,
				OutlineInside: `<circle cx="48" cy="48" r="${tmpOuterR}" fill="none" stroke="${pColors.Primary}" stroke-width="4"/>
					<circle cx="48" cy="48" r="${tmpInnerR}" fill="none" stroke="${pColors.Secondary}" stroke-width="2.5"/>`,
				Favicon: `<circle cx="48" cy="48" r="${tmpOuterR + 4}" fill="${pColors.Primary}"/>
					<circle cx="48" cy="48" r="${tmpInnerR}" fill="${pColors.Secondary}"/>`
			};
		}
	},

	// ── 5: Crescent — circle with another circle subtracted
	{
		Name: 'crescent',
		Build: (pBytes, pColors) =>
		{
			let tmpDir = (pBytes[6] & 1) ? 1 : -1;
			let tmpOff = 14 + (pBytes[7] % 6);
			let tmpR = 32;
			let tmpAx = 48 + tmpDir * tmpOff;
			let tmpClipID = '_cr_' + (pBytes[6] * 256 + pBytes[7]);
			return {
				Inside: `<defs><mask id="${tmpClipID}"><rect x="0" y="0" width="96" height="96" fill="#fff"/>
						<circle cx="${tmpAx}" cy="48" r="${tmpR}" fill="#000"/></mask></defs>
					<circle cx="48" cy="48" r="${tmpR}" fill="${pColors.Primary}" mask="url(#${tmpClipID})"/>
					<circle cx="${tmpAx}" cy="48" r="${tmpR - 6}" fill="${pColors.Secondary}" opacity="0.7"/>`,
				OutlineInside: `<circle cx="48" cy="48" r="${tmpR}" fill="none" stroke="${pColors.Primary}" stroke-width="3"/>
					<circle cx="${tmpAx}" cy="48" r="${tmpR}" fill="none" stroke="${pColors.Secondary}" stroke-width="2.5" opacity="0.7"/>`,
				Favicon: `<circle cx="48" cy="48" r="${tmpR + 4}" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 6: Hexcircle — primary hexagon, secondary circle inside (or vice versa)
	{
		Name: 'hexcircle',
		Build: (pBytes, pColors) =>
		{
			let tmpInverted = pBytes[6] & 1;
			let tmpR = 36;
			let tmpInnerR = 24;
			let tmpHexPts = [];
			for (let i = 0; i < 6; i++)
			{
				let tmpA = (Math.PI / 3) * i - Math.PI / 2;
				tmpHexPts.push((48 + tmpR * Math.cos(tmpA)).toFixed(2)
					+ ',' + (48 + tmpR * Math.sin(tmpA)).toFixed(2));
			}
			let tmpHexD = 'M ' + tmpHexPts.join(' L ') + ' Z';
			let tmpFillA = tmpInverted ? pColors.Secondary : pColors.Primary;
			let tmpFillB = tmpInverted ? pColors.Primary : pColors.Secondary;
			return {
				Inside: `<path d="${tmpHexD}" fill="${tmpFillA}"/>
					<circle cx="48" cy="48" r="${tmpInnerR}" fill="${tmpFillB}"/>`,
				OutlineInside: `<path d="${tmpHexD}" fill="none" stroke="${tmpFillA}" stroke-width="3" stroke-linejoin="round"/>
					<circle cx="48" cy="48" r="${tmpInnerR}" fill="none" stroke="${tmpFillB}" stroke-width="2.5"/>`,
				Favicon: `<path d="${tmpHexD}" fill="${tmpFillA}"/>`
			};
		}
	},

	// ── 7: Chevron — two triangles meeting in V/peak
	{
		Name: 'chevron',
		Build: (pBytes, pColors) =>
		{
			let tmpUp = pBytes[6] & 1;
			let tmpA = tmpUp
				? `M 16 70 L 48 30 L 80 70 Z`
				: `M 16 26 L 48 66 L 80 26 Z`;
			let tmpB = tmpUp
				? `M 24 80 L 48 52 L 72 80 Z`
				: `M 24 16 L 48 44 L 72 16 Z`;
			return {
				Inside: `<path d="${tmpA}" fill="${pColors.Primary}"/>
					<path d="${tmpB}" fill="${pColors.Secondary}" opacity="0.9"/>`,
				OutlineInside: `<path d="${tmpA}" fill="none" stroke="${pColors.Primary}" stroke-width="3" stroke-linejoin="round"/>
					<path d="${tmpB}" fill="none" stroke="${pColors.Secondary}" stroke-width="2.5" stroke-linejoin="round"/>`,
				Favicon: `<path d="${tmpA}" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 8: Squarediag — primary square + secondary diamond inside
	{
		Name: 'squarediag',
		Build: (pBytes, pColors) =>
		{
			return {
				Inside: `<rect x="20" y="20" width="56" height="56" rx="8" fill="${pColors.Primary}"/>
					<path d="M 48 30 L 70 48 L 48 66 L 26 48 Z" fill="${pColors.Secondary}"/>`,
				OutlineInside: `<rect x="20" y="20" width="56" height="56" rx="8" fill="none" stroke="${pColors.Primary}" stroke-width="3"/>
					<path d="M 48 30 L 70 48 L 48 66 L 26 48 Z" fill="none" stroke="${pColors.Secondary}" stroke-width="2.5" stroke-linejoin="round"/>`,
				Favicon: `<rect x="16" y="16" width="64" height="64" rx="10" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 9: Orbit — small disk traveling around a primary disk
	{
		Name: 'orbit',
		Build: (pBytes, pColors) =>
		{
			let tmpAng = (pBytes[6] / 255) * Math.PI * 2;
			let tmpOrbitR = 36;
			let tmpDiskR = 22;
			let tmpDotR = 9;
			let tmpDx = (48 + tmpOrbitR * Math.cos(tmpAng)).toFixed(2);
			let tmpDy = (48 + tmpOrbitR * Math.sin(tmpAng)).toFixed(2);
			return {
				Inside: `<circle cx="48" cy="48" r="${tmpOrbitR}" fill="none" stroke="${pColors.Secondary}" stroke-width="2" opacity="0.45"/>
					<circle cx="48" cy="48" r="${tmpDiskR}" fill="${pColors.Primary}"/>
					<circle cx="${tmpDx}" cy="${tmpDy}" r="${tmpDotR}" fill="${pColors.Secondary}"/>`,
				OutlineInside: `<circle cx="48" cy="48" r="${tmpOrbitR}" fill="none" stroke="${pColors.Secondary}" stroke-width="2" opacity="0.5"/>
					<circle cx="48" cy="48" r="${tmpDiskR}" fill="none" stroke="${pColors.Primary}" stroke-width="3"/>
					<circle cx="${tmpDx}" cy="${tmpDy}" r="${tmpDotR}" fill="${pColors.Secondary}"/>`,
				Favicon: `<circle cx="48" cy="48" r="${tmpDiskR + 6}" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 10: Slabs — two thick parallel bars, primary + secondary
	{
		Name: 'slabs',
		Build: (pBytes, pColors) =>
		{
			let tmpVertical = pBytes[6] & 1;
			let tmpThick = 18;
			let tmpGap = 8;
			let tmpA, tmpB;
			if (tmpVertical)
			{
				tmpA = `<rect x="${48 - tmpThick - tmpGap / 2}" y="14" width="${tmpThick}" height="68" rx="4" fill="${pColors.Primary}"/>`;
				tmpB = `<rect x="${48 + tmpGap / 2}" y="14" width="${tmpThick}" height="68" rx="4" fill="${pColors.Secondary}"/>`;
			}
			else
			{
				tmpA = `<rect x="14" y="${48 - tmpThick - tmpGap / 2}" width="68" height="${tmpThick}" rx="4" fill="${pColors.Primary}"/>`;
				tmpB = `<rect x="14" y="${48 + tmpGap / 2}" width="68" height="${tmpThick}" rx="4" fill="${pColors.Secondary}"/>`;
			}
			return {
				Inside: tmpA + tmpB,
				OutlineInside: tmpA.replace(`fill="${pColors.Primary}"`, `fill="none" stroke="${pColors.Primary}" stroke-width="2.5"`)
					+ tmpB.replace(`fill="${pColors.Secondary}"`, `fill="none" stroke="${pColors.Secondary}" stroke-width="2.5"`),
				Favicon: tmpVertical
					? `<rect x="20" y="14" width="56" height="68" rx="4" fill="${pColors.Primary}"/>`
					: `<rect x="14" y="20" width="68" height="56" rx="4" fill="${pColors.Primary}"/>`
			};
		}
	},

	// ── 11: Triadic — three concentric arcs forming a stylized burst
	{
		Name: 'triadic',
		Build: (pBytes, pColors) =>
		{
			let tmpPhase = (pBytes[6] / 255) * Math.PI * 2;
			let tmpR = 32;
			let tmpArcs = '';
			for (let i = 0; i < 3; i++)
			{
				let tmpA1 = tmpPhase + (i * Math.PI * 2) / 3;
				let tmpA2 = tmpA1 + (Math.PI * 2) / 3 * 0.55;
				let tmpX1 = (48 + tmpR * Math.cos(tmpA1)).toFixed(2);
				let tmpY1 = (48 + tmpR * Math.sin(tmpA1)).toFixed(2);
				let tmpX2 = (48 + tmpR * Math.cos(tmpA2)).toFixed(2);
				let tmpY2 = (48 + tmpR * Math.sin(tmpA2)).toFixed(2);
				let tmpC = (i % 2 === 0) ? pColors.Primary : pColors.Secondary;
				tmpArcs += `<path d="M ${tmpX1} ${tmpY1} A ${tmpR} ${tmpR} 0 0 1 ${tmpX2} ${tmpY2}" fill="none" stroke="${tmpC}" stroke-width="6" stroke-linecap="round"/>`;
			}
			return {
				Inside: `<circle cx="48" cy="48" r="14" fill="${pColors.Primary}"/>` + tmpArcs,
				OutlineInside: `<circle cx="48" cy="48" r="14" fill="none" stroke="${pColors.Primary}" stroke-width="3"/>` + tmpArcs,
				Favicon: `<circle cx="48" cy="48" r="${tmpR + 4}" fill="${pColors.Primary}"/>`
			};
		}
	}
];

const VARIANT_KEYS = ['filled-light', 'filled-dark', 'outline-light', 'outline-dark'];

// ── Variant rendering ────────────────────────────────────────────────────
function renderVariant(pVariant, pSpec)
{
	let tmpClipID = 'frame-' + pSpec.IDSafe + '-' + pVariant;
	let tmpBg, tmpFg, tmpStroke, tmpStrokeWidth = 0;
	let tmpInside;

	switch (pVariant)
	{
		case 'filled-light':
			tmpBg = pSpec.Brand.Primary.LightTheme;
			tmpFg = '#ffffff';
			// On a primary-colored background, the mark needs lighter
			// shapes — use the secondary color and a translucent white
			// for readable contrast against the bg.
			tmpInside = pSpec.Composition.Build(pSpec.HashBytes,
			{
				Primary: 'rgba(255,255,255,0.18)',  // soft "primary" silhouette
				Secondary: pSpec.Brand.Secondary.LightTheme,
				PrimaryDeep: 'rgba(255,255,255,0.32)'
			}).Inside;
			break;
		case 'filled-dark':
			tmpBg = pSpec.Brand.Primary.DarkTheme;
			tmpFg = '#101418';
			tmpInside = pSpec.Composition.Build(pSpec.HashBytes,
			{
				Primary: 'rgba(0,0,0,0.18)',
				Secondary: pSpec.Brand.Secondary.DarkTheme,
				PrimaryDeep: 'rgba(0,0,0,0.32)'
			}).Inside;
			break;
		case 'outline-light':
			tmpBg = 'transparent';
			tmpFg = pSpec.Brand.Primary.LightTheme;
			tmpStroke = pSpec.Brand.Primary.LightTheme;
			tmpStrokeWidth = 4;
			tmpInside = pSpec.Composition.Build(pSpec.HashBytes,
			{
				Primary: pSpec.Brand.Primary.LightTheme,
				Secondary: pSpec.Brand.Secondary.LightTheme,
				PrimaryDeep: pSpec.Brand.Primary.LightTheme
			}).OutlineInside;
			break;
		case 'outline-dark':
			tmpBg = 'transparent';
			tmpFg = pSpec.Brand.Primary.DarkTheme;
			tmpStroke = pSpec.Brand.Primary.DarkTheme;
			tmpStrokeWidth = 4;
			tmpInside = pSpec.Composition.Build(pSpec.HashBytes,
			{
				Primary: pSpec.Brand.Primary.DarkTheme,
				Secondary: pSpec.Brand.Secondary.DarkTheme,
				PrimaryDeep: pSpec.Brand.Primary.DarkTheme
			}).OutlineInside;
			break;
	}

	let tmpFrameAttrs = (tmpStrokeWidth > 0)
		? `fill="${tmpBg}" stroke="${tmpStroke}" stroke-width="${tmpStrokeWidth}"`
		: `fill="${tmpBg}"`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${pSpec.Size}" height="${pSpec.Size}">
		<defs>
			<clipPath id="${tmpClipID}">
				<path d="${pSpec.FrameD}"/>
			</clipPath>
		</defs>
		<path d="${pSpec.FrameD}" ${tmpFrameAttrs}/>
		<g clip-path="url(#${tmpClipID})">${tmpInside}</g>
		<text x="48" y="50" text-anchor="middle" dominant-baseline="central"
			font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
			font-size="${pSpec.FontSize}" font-weight="${pSpec.FontWeight}"
			fill="${tmpFg}" letter-spacing="-1">${escapeXML(pSpec.Monogram)}</text>
	</svg>`;
}

// ── Favicon-grade simplified rendering ───────────────────────────────────
// At 32-px the layered compositions become noise. Drop everything except:
//   - the frame in the primary color
//   - a single-character monogram (first letter only) in white
//   - a single bold accent shape (the composition's `Favicon` payload)
// Result is high-contrast and reads cleanly at 16x16, too.
function renderFavicon(pSpec, pTheme)
{
	let tmpBg, tmpFg, tmpAccentColor;
	if (pTheme === 'dark')
	{
		tmpBg = pSpec.Brand.Primary.DarkTheme;
		tmpFg = '#101418';
		tmpAccentColor = pSpec.Brand.Secondary.DarkTheme;
	}
	else
	{
		tmpBg = pSpec.Brand.Primary.LightTheme;
		tmpFg = '#ffffff';
		tmpAccentColor = pSpec.Brand.Secondary.LightTheme;
	}

	let tmpFavInside = pSpec.Composition.Build(pSpec.HashBytes,
	{
		Primary: 'rgba(255,255,255,0.22)',
		Secondary: tmpAccentColor,
		PrimaryDeep: 'rgba(255,255,255,0.36)'
	}).Favicon;

	// Single-letter monogram for legibility at small size.
	let tmpFaviconLetter = pSpec.Monogram.charAt(0);
	let tmpClipID = 'fav-' + pSpec.IDSafe + '-' + pTheme;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${pSpec.Size}" height="${pSpec.Size}">
		<defs>
			<clipPath id="${tmpClipID}">
				<path d="${pSpec.FrameD}"/>
			</clipPath>
		</defs>
		<path d="${pSpec.FrameD}" fill="${tmpBg}"/>
		<g clip-path="url(#${tmpClipID})">${tmpFavInside}</g>
		<text x="48" y="50" text-anchor="middle" dominant-baseline="central"
			font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
			font-size="60" font-weight="800"
			fill="${tmpFg}" letter-spacing="-1">${escapeXML(tmpFaviconLetter)}</text>
	</svg>`;
}

// ── Main generator ───────────────────────────────────────────────────────
function generateLogo(pName, pOptions)
{
	let tmpOptions = pOptions || {};
	let tmpSize = tmpOptions.Size || 96;

	let tmpBytes = hashString(pName);
	let tmpBrand = deriveBrand(tmpBytes, tmpOptions.Palette);

	let tmpFrameIdx = tmpBytes[4] % FRAME_VARIANTS.length;
	let tmpFrameD = FRAME_VARIANTS[tmpFrameIdx]({ x: 2, y: 2, w: 92, h: 92, r: 22 });

	let tmpCompIdx = tmpBytes[5] % COMPOSITIONS.length;
	let tmpComposition = COMPOSITIONS[tmpCompIdx];

	let tmpMonogram = tmpOptions.Monogram || extractMonogram(pName);
	let tmpFontSize = monogramFontSize(tmpMonogram);
	let tmpFontWeight = (tmpBytes[6] & 1) ? 700 : 600;

	let tmpIDSafe = String(pName).replace(/[^a-zA-Z0-9_-]/g, '_');

	let tmpSpec =
	{
		FrameD: tmpFrameD,
		Composition: tmpComposition,
		HashBytes: tmpBytes,
		Monogram: tmpMonogram,
		FontSize: tmpFontSize,
		FontWeight: tmpFontWeight,
		Brand: tmpBrand,
		IDSafe: tmpIDSafe,
		Size: tmpSize
	};

	let tmpVariants = {};
	VARIANT_KEYS.forEach((pKey) =>
	{
		tmpVariants[pKey] = renderVariant(pKey, tmpSpec);
	});

	let tmpFavicons =
	{
		light: renderFavicon(tmpSpec, 'light'),
		dark: renderFavicon(tmpSpec, 'dark')
	};

	return {
		Name: pName,
		Brand: tmpBrand,
		Monogram: tmpMonogram,
		FrameIndex: tmpFrameIdx,
		CompositionIndex: tmpCompIdx,
		CompositionName: tmpComposition.Name,
		Hash: tmpBytes.map((pB) => pB.toString(16).padStart(2, '0')).join(''),
		Variants: tmpVariants,
		Favicons: tmpFavicons,
		SVG: tmpVariants['filled-light']
	};
}

// ── PNG export (browser-only) ────────────────────────────────────────────
function svgToPNGBlob(pSVG, pPixelSize)
{
	if (typeof document === 'undefined' || typeof Image === 'undefined')
	{
		return Promise.reject(new Error('svgToPNGBlob requires a browser environment'));
	}
	return new Promise((pResolve, pReject) =>
	{
		let tmpBlob = new Blob([pSVG], { type: 'image/svg+xml' });
		let tmpURL = URL.createObjectURL(tmpBlob);
		let tmpImg = new Image();
		tmpImg.onload = function ()
		{
			let tmpCanvas = document.createElement('canvas');
			tmpCanvas.width = pPixelSize;
			tmpCanvas.height = pPixelSize;
			let tmpCtx = tmpCanvas.getContext('2d');
			tmpCtx.drawImage(tmpImg, 0, 0, pPixelSize, pPixelSize);
			URL.revokeObjectURL(tmpURL);
			tmpCanvas.toBlob((pBlob) =>
			{
				if (pBlob) pResolve(pBlob);
				else pReject(new Error('canvas.toBlob returned null'));
			}, 'image/png');
		};
		tmpImg.onerror = function (pError)
		{
			URL.revokeObjectURL(tmpURL);
			pReject(pError);
		};
		tmpImg.src = tmpURL;
	});
}

function downloadBlob(pBlob, pFilename)
{
	if (typeof document === 'undefined') throw new Error('downloadBlob requires a browser');
	let tmpURL = URL.createObjectURL(pBlob);
	let tmpAnchor = document.createElement('a');
	tmpAnchor.href = tmpURL;
	tmpAnchor.download = pFilename;
	document.body.appendChild(tmpAnchor);
	tmpAnchor.click();
	document.body.removeChild(tmpAnchor);
	setTimeout(() => URL.revokeObjectURL(tmpURL), 1000);
}

function downloadSVG(pSVG, pFilename)
{
	downloadBlob(new Blob([pSVG], { type: 'image/svg+xml' }), pFilename);
}

async function downloadPNG(pSVG, pFilename, pPixelSize)
{
	let tmpBlob = await svgToPNGBlob(pSVG, pPixelSize);
	downloadBlob(tmpBlob, pFilename);
}

async function downloadFaviconSet(pName, pVariant, pOptions)
{
	let tmpResult = generateLogo(pName, pOptions || {});
	let tmpPaletteSuffix = (pOptions && pOptions.Palette && pOptions.Palette !== 'default')
		? '-' + pOptions.Palette : '';
	let tmpBase = String(pName).replace(/[^a-zA-Z0-9_-]/g, '_') + tmpPaletteSuffix;
	// SVG uses the favicon-grade simplified mark.
	downloadSVG(tmpResult.Favicons.light, `${tmpBase}-favicon.svg`);
	const SIZES = [16, 32, 48, 64, 180, 192, 512];
	for (let i = 0; i < SIZES.length; i++)
	{
		await downloadPNG(tmpResult.Favicons.light, `${tmpBase}-favicon-${SIZES[i]}.png`, SIZES[i]);
		await new Promise((pR) => setTimeout(pR, 80));
	}
}

function escapeXML(pStr)
{
	return String(pStr).replace(/[&<>"']/g, (pCh) => (
	{
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	})[pCh]);
}

const _Module =
{
	generate: generateLogo,
	hash: hashString,
	hslToHex: hslToHex,
	extractMonogram: extractMonogram,
	deriveBrand: deriveBrand,
	downloadSVG: downloadSVG,
	downloadPNG: downloadPNG,
	downloadFaviconSet: downloadFaviconSet,
	svgToPNGBlob: svgToPNGBlob,
	FRAME_VARIANTS: FRAME_VARIANTS,
	COMPOSITIONS: COMPOSITIONS,
	VARIANT_KEYS: VARIANT_KEYS,
	PALETTES: PALETTES
};

if (typeof globalThis !== 'undefined')
{
	globalThis.RetoldLogoGenerator = _Module;
}

module.exports = _Module;
