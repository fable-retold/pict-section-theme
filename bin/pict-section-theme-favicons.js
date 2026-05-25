#!/usr/bin/env node
/**
 * pict-section-theme-favicons — write static favicon assets from a Brand spec.
 *
 * Reads a Brand block (the same shape Theme-Brand consumes) and writes
 * the standard suite of favicon files to a target directory:
 *
 *   favicon.svg               — primary, scalable; light/dark blends to one
 *   favicon-light.svg         — light-mode source SVG (when paired)
 *   favicon-dark.svg          — dark-mode source SVG (when paired)
 *   favicon-16.png            — small fallback for older browsers / chrome tabs
 *   favicon-32.png            — standard browser-tab size
 *   favicon-48.png            — Windows tile / older shortcut icons
 *   favicon-64.png            — high-DPI tab fallback
 *   apple-touch-icon.png      — 180×180, iOS home screen
 *   favicon-192.png           — PWA manifest, Android home screen
 *   favicon-512.png           — PWA manifest, splash screens
 *
 * The "light" SVG is preferred as the primary favicon when paired
 * variants are supplied (most browsers default to light tab chrome,
 * with dark mode as the override). PNG raster sizes are produced from
 * the light variant so they look right against most browser chrome.
 *
 * Hosts paste a snippet like the following into their <head>:
 *
 *   <link rel="icon" type="image/svg+xml" href="/favicon.svg">
 *   <link rel="icon" sizes="32x32" href="/favicon-32.png">
 *   <link rel="icon" sizes="16x16" href="/favicon-16.png">
 *   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
 *
 * The CLI prints the snippet to stdout when run with --print-tags so
 * build scripts can pipe it into a template.
 *
 * Usage:
 *
 *   node pict-section-theme-favicons.js \
 *       --brand path/to/RetoldManager-Brand.js \
 *       --out  source/retold-manager/web-application/favicons \
 *       [--print-tags] [--quiet]
 *
 * --brand accepts either a `.js` file (require()'d) or a `.json` file.
 * --out is created if it doesn't exist.
 *
 * Rasterization uses retold-sharp (a thin wrapper around the sharp
 * library) so SVG → PNG works without a system libvips dependency.
 */

'use strict';

const libFs = require('fs');
const libPath = require('path');

// ── Argument parsing ─────────────────────────────────────────────────────
function parseArgs(pArgv)
{
	let tmpArgs = { brand: null, out: null, printTags: false, quiet: false };
	for (let i = 2; i < pArgv.length; i++)
	{
		let tmpA = pArgv[i];
		if (tmpA === '--brand')         { tmpArgs.brand = pArgv[++i]; }
		else if (tmpA === '--out')      { tmpArgs.out = pArgv[++i]; }
		else if (tmpA === '--print-tags'){ tmpArgs.printTags = true; }
		else if (tmpA === '--quiet')    { tmpArgs.quiet = true; }
		else if (tmpA === '--help' || tmpA === '-h')
		{
			console.log('Usage: pict-section-theme-favicons --brand <path> --out <dir> [--print-tags] [--quiet]');
			process.exit(0);
		}
	}
	return tmpArgs;
}

function loadBrand(pPath)
{
	if (!pPath) throw new Error('--brand is required');
	let tmpAbs = libPath.resolve(process.cwd(), pPath);
	if (!libFs.existsSync(tmpAbs)) throw new Error(`brand file not found: ${tmpAbs}`);
	if (tmpAbs.endsWith('.json'))
	{
		return JSON.parse(libFs.readFileSync(tmpAbs, 'utf8'));
	}
	if (tmpAbs.endsWith('.js') || tmpAbs.endsWith('.cjs'))
	{
		// Clear require cache so re-runs pick up edits.
		delete require.cache[require.resolve(tmpAbs)];
		return require(tmpAbs);
	}
	throw new Error('--brand must be .json, .js, or .cjs');
}

function ensureDir(pDir)
{
	libFs.mkdirSync(pDir, { recursive: true });
}

// ── SVG → PNG rasterization via retold-sharp ─────────────────────────────
async function rasterize(pSharp, pSVGString, pSize)
{
	let tmpBuffer = Buffer.from(pSVGString, 'utf8');
	// Sharp accepts SVG input natively. `density` scales the SVG to the
	// target raster size cleanly without losing fidelity. We feed the
	// SVG with a fixed 96-unit viewBox so density = pSize gets us the
	// requested raster resolution.
	return pSharp(tmpBuffer, { density: pSize * 4 })
		.resize(pSize, pSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png({ compressionLevel: 9 })
		.toBuffer();
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main()
{
	let tmpArgs = parseArgs(process.argv);
	let tmpBrand = loadBrand(tmpArgs.brand);
	if (!tmpArgs.out) throw new Error('--out is required');

	let tmpOutDir = libPath.resolve(process.cwd(), tmpArgs.out);
	ensureDir(tmpOutDir);

	let tmpFaviconLight = tmpBrand.Favicon || tmpBrand.Icon;
	let tmpFaviconDark  = tmpBrand.FaviconDark || null;
	if (!tmpFaviconLight)
	{
		throw new Error('Brand has no Favicon or Icon field — nothing to render');
	}

	let tmpResults = [];

	// Always write the SVG sources verbatim — every modern browser
	// (Chrome 80+, Safari 16+, Firefox 41+) can use an SVG favicon
	// directly, so the SVG is sufficient by itself. The PNG raster
	// sizes below are progressive enhancement for older browsers /
	// PWA / iOS home-screen contexts.
	libFs.writeFileSync(libPath.join(tmpOutDir, 'favicon.svg'), tmpFaviconLight, 'utf8');
	tmpResults.push('favicon.svg');

	if (tmpFaviconDark)
	{
		libFs.writeFileSync(libPath.join(tmpOutDir, 'favicon-light.svg'), tmpFaviconLight, 'utf8');
		libFs.writeFileSync(libPath.join(tmpOutDir, 'favicon-dark.svg'), tmpFaviconDark, 'utf8');
		tmpResults.push('favicon-light.svg', 'favicon-dark.svg');
	}

	// PNG rasterization needs retold-sharp (a sharp wrapper). When it's
	// not installed we skip the raster sizes with a warning rather than
	// failing — the SVG alone is enough for modern browsers.
	//
	// Try resolving retold-sharp first from the CLI's own context (in
	// case it's a direct dep of pict-section-theme), then from the host
	// project's directory, then from process.cwd() — so a host that
	// installed retold-sharp in its own node_modules tree can use the
	// CLI without setting NODE_PATH or symlinks.
	let tmpSharp = null;
	let tmpSearchPaths = [
		__dirname,
		libPath.dirname(libPath.resolve(process.cwd(), tmpArgs.brand)),
		process.cwd()
	];
	for (let i = 0; i < tmpSearchPaths.length; i++)
	{
		try
		{
			let tmpResolved = require.resolve('retold-sharp', { paths: [tmpSearchPaths[i]] });
			let tmpCandidate = require(tmpResolved);
			// retold-sharp exports a throwing stub when the underlying
			// `sharp` native binary failed to resolve.  Use its
			// `checkAvailable()` diagnostic to skip the stub so the
			// SVG-only fall-through fires instead of crashing later
			// in rasterize().
			if (tmpCandidate && typeof tmpCandidate.checkAvailable === 'function')
			{
				let tmpStatus = tmpCandidate.checkAvailable();
				if (!tmpStatus || !tmpStatus.available)
				{
					continue;
				}
			}
			tmpSharp = tmpCandidate;
			break;
		}
		catch (pErr) { /* try next */ }
	}
	if (!tmpSharp && !tmpArgs.quiet)
	{
		console.warn('Warning: retold-sharp not available — skipping PNG raster sizes.');
		console.warn('         Install retold-sharp to generate 16/32/48/64/180/192/512 PNGs:');
		console.warn('             npm install retold-sharp');
		console.warn('         The SVG favicon is sufficient for all modern browsers.');
	}

	if (tmpSharp)
	{
		// Standard PNG raster sizes. The light variant is the primary
		// because most browser tabs use light chrome by default; modern
		// browsers that support SVG favicons will pick those up first
		// and respect prefers-color-scheme via the SVG's own queries.
		const SIZES = [16, 32, 48, 64, 180, 192, 512];
		for (let i = 0; i < SIZES.length; i++)
		{
			let tmpSize = SIZES[i];
			let tmpName = (tmpSize === 180) ? 'apple-touch-icon.png' : `favicon-${tmpSize}.png`;
			let tmpBytes = await rasterize(tmpSharp, tmpFaviconLight, tmpSize);
			libFs.writeFileSync(libPath.join(tmpOutDir, tmpName), tmpBytes);
			tmpResults.push(tmpName);
		}
	}

	if (!tmpArgs.quiet)
	{
		console.log(`Wrote ${tmpResults.length} favicon files to ${tmpOutDir}`);
		for (let i = 0; i < tmpResults.length; i++)
		{
			console.log(`  ${tmpResults[i]}`);
		}
	}

	if (tmpArgs.printTags)
	{
		console.log('');
		console.log('Suggested <link> tags for index.html:');
		console.log('');
		console.log('<link rel="icon" type="image/svg+xml" href="favicon.svg">');
		console.log('<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">');
		console.log('<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">');
		console.log('<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">');
		console.log('<link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png">');
		console.log('<link rel="icon" type="image/png" sizes="512x512" href="favicon-512.png">');
	}
}

main().catch((pError) =>
{
	console.error('pict-section-theme-favicons failed:', pError.message);
	if (process.env.DEBUG) console.error(pError.stack);
	process.exit(1);
});
