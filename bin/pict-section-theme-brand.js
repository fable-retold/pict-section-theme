#!/usr/bin/env node
/**
 * pict-section-theme-brand — precompute a module's brand and persist it.
 *
 * Generates the deterministic logo / palette via LogoGenerator, writes
 * the resulting brand block into the module's package.json under
 * `retold.brand`, and (optionally) writes the favicon files to disk.
 *
 * The whole point: keep the runtime free of the LogoGenerator dependency.
 * Build pushes a fully-resolved JSON brand into package.json; the app's
 * Brand module does `require('../../package.json').retold.brand` at
 * runtime — no SVG generation in the browser, no expensive hash work on
 * every page load, the brand is auditable in source control, and the
 * package can be inspected by any tool that reads package.json.
 *
 * Two modes:
 *
 *   1. Manifest-driven (Retold-ecosystem style)
 *
 *      pict-section-theme-brand \
 *          --manifest ../../Retold-Modules-Manifest.json \
 *          --module   retold-manager \
 *          [--package package.json] \
 *          [--favicons web-application/favicons]
 *
 *      Looks up the module entry in the manifest by Name and reads
 *      Branding.{Palette, DisplayName, Tagline}.
 *
 *   2. Standalone (any Pict app, no manifest needed)
 *
 *      pict-section-theme-brand \
 *          [--package package.json] \
 *          [--palette ocean] \
 *          [--display-name "My App"] \
 *          [--tagline "What it does"] \
 *          [--favicons public/favicons]
 *
 *      Reads the target package.json and uses its `name` field as the
 *      brand hash + monogram source. No --manifest / --module required.
 *      `--palette` defaults to 'mix' (deterministic per name from
 *      synthwave/ocean/desert). `--display-name` defaults to the
 *      package name humanized; `--tagline` defaults to the package's
 *      `description` field.
 *
 *      An app's package.json can also pre-seed defaults under
 *      `retold.brandConfig`:
 *
 *          "retold": {
 *              "brandConfig": {
 *                  "Palette": "ocean",
 *                  "DisplayName": "My App",
 *                  "Tagline": "What it does"
 *              }
 *          }
 *
 *      so re-running the CLI without flags reproduces the same brand.
 *      CLI flags always win when both are supplied.
 *
 * Persists into the target package.json:
 *
 *   {
 *     "retold": {
 *       "brand": {
 *         "Hash":        "<package name>",
 *         "Name":        "<DisplayName | humanized name>",
 *         "Tagline":     "<Tagline | description>",
 *         "Palette":     "<Palette>",
 *         "Icon":        "<svg>...</svg>",
 *         "IconType":    "svg",
 *         "Favicon":     "<svg>...</svg>",
 *         "FaviconDark": "<svg>...</svg>",
 *         "Colors":      { Primary, Secondary, PrimaryLight, ... }
 *       }
 *     }
 *   }
 *
 * --favicons is skipped when not supplied; pass a dir to write the full
 * favicon set:
 *   - favicon.svg / favicon-light.svg / favicon-dark.svg
 *   - favicon-16.png / favicon-32.png / favicon-48.png / favicon-64.png
 *   - favicon-192.png / favicon-512.png
 *   - apple-touch-icon.png (180x180)
 *
 * PNG generation needs the `retold-sharp` package.  pict-section-theme
 * deliberately doesn't carry retold-sharp in its own dep tree — apps that
 * only consume the theme runtime shouldn't pull a native binary they
 * never run.  But when a developer invokes the brand CLI (typically via
 * `npm run brand` chained to `prebuild`), this script auto-installs
 * retold-sharp into the consuming app's devDependencies as a one-time
 * setup.  Every subsequent `npm install` then picks it up via the saved
 * dep entry — no second auto-install, no nag, no manual step.
 *
 * The auto-install only fires when --favicons is supplied AND retold-sharp
 * isn't already resolvable.  If the install fails (rare — platform
 * without sharp native-binary support), the script falls through to SVG
 * only, which is sufficient for every modern browser, and prints a
 * one-time retry hint.
 */

'use strict';

const libFs = require('fs');
const libPath = require('path');

const libThemeLogo = require('../source/Theme-Logo.js');

// ── Argument parsing ─────────────────────────────────────────────────────
function parseArgs(pArgv)
{
	let tmpArgs =
	{
		manifest:    null,
		module:      null,
		pkg:         null,
		palette:     null,
		displayName: null,
		tagline:     null,
		favicons:    null,
		quiet:       false
	};
	for (let i = 2; i < pArgv.length; i++)
	{
		let tmpA = pArgv[i];
		if      (tmpA === '--manifest')     { tmpArgs.manifest    = pArgv[++i]; }
		else if (tmpA === '--module')       { tmpArgs.module      = pArgv[++i]; }
		else if (tmpA === '--package')      { tmpArgs.pkg         = pArgv[++i]; }
		else if (tmpA === '--palette')      { tmpArgs.palette     = pArgv[++i]; }
		else if (tmpA === '--display-name') { tmpArgs.displayName = pArgv[++i]; }
		else if (tmpA === '--tagline')      { tmpArgs.tagline     = pArgv[++i]; }
		else if (tmpA === '--favicons')     { tmpArgs.favicons    = pArgv[++i]; }
		else if (tmpA === '--quiet')        { tmpArgs.quiet       = true; }
		else if (tmpA === '--help' || tmpA === '-h')
		{
			console.log('Usage:');
			console.log('  Manifest mode:');
			console.log('    pict-section-theme-brand --manifest <path> --module <name>');
			console.log('        [--package <path>] [--favicons <dir>] [--quiet]');
			console.log('  Standalone mode:');
			console.log('    pict-section-theme-brand [--package <path>]');
			console.log('        [--palette <key>] [--display-name <text>] [--tagline <text>]');
			console.log('        [--favicons <dir>] [--quiet]');
			console.log('');
			console.log('Favicons:');
			console.log('  When --favicons is supplied, the script writes:');
			console.log('    - favicon.svg / favicon-light.svg / favicon-dark.svg');
			console.log('    - favicon-16/32/48/64/192/512.png + apple-touch-icon.png');
			console.log('  PNG generation uses `retold-sharp`.  On the first run it is auto-');
			console.log('  installed into the consuming app as a devDependency so future');
			console.log('  `npm install` picks it up automatically — no per-developer setup.');
			console.log('  If the install fails (rare — platform without sharp binary support)');
			console.log('  the script falls through to SVG only and prints a retry hint.');
			process.exit(0);
		}
	}
	// Either fully-specified manifest mode, or anything-goes standalone.
	let tmpManifestMode = !!(tmpArgs.manifest || tmpArgs.module);
	if (tmpManifestMode && (!tmpArgs.manifest || !tmpArgs.module))
	{
		throw new Error('--manifest and --module must be supplied together (or omit both for standalone mode)');
	}
	return tmpArgs;
}

// ── Manifest lookup ──────────────────────────────────────────────────────
function findModule(pManifest, pModuleName)
{
	let tmpGroups = (pManifest && Array.isArray(pManifest.Groups)) ? pManifest.Groups : [];
	for (let i = 0; i < tmpGroups.length; i++)
	{
		let tmpModules = Array.isArray(tmpGroups[i].Modules) ? tmpGroups[i].Modules : [];
		for (let j = 0; j < tmpModules.length; j++)
		{
			if (tmpModules[j].Name === pModuleName)
			{
				return tmpModules[j];
			}
		}
	}
	return null;
}

// ── Display-name humanizer ───────────────────────────────────────────────
// 'retold-manager' → 'Retold Manager'
// '@scope/my-app'  → 'My App'
// 'app_v2'         → 'App V2'
function humanizeName(pName)
{
	let tmpRaw = String(pName || '').replace(/^@[^/]+\//, '');  // drop scope
	return tmpRaw
		.split(/[-_\s]+/)
		.filter((pSeg) => pSeg.length > 0)
		.map((pSeg) => pSeg.charAt(0).toUpperCase() + pSeg.slice(1))
		.join(' ') || tmpRaw;
}

// ── Brand block construction ─────────────────────────────────────────────
// pSpec: { Name, DisplayName?, Tagline?, Palette? } — Name is required.
function buildBrandBlock(pSpec)
{
	let tmpPalette = pSpec.Palette || 'mix';
	let tmpName = pSpec.DisplayName || humanizeName(pSpec.Name);
	let tmpTagline = pSpec.Tagline || '';

	let tmpLogo = libThemeLogo.generate(pSpec.Name, { Palette: tmpPalette });

	return {
		Hash:        pSpec.Name,
		Name:        tmpName,
		Tagline:     tmpTagline,
		Palette:     tmpPalette,
		Icon:        tmpLogo.Variants['filled-light'],
		IconType:    'svg',
		Favicon:     tmpLogo.Favicons.light,
		FaviconDark: tmpLogo.Favicons.dark,
		Colors:
		{
			Primary:        tmpLogo.Brand.Primary.LightTheme,
			Secondary:      tmpLogo.Brand.Secondary.LightTheme,
			PrimaryLight:   tmpLogo.Brand.Primary.LightTheme,
			PrimaryDark:    tmpLogo.Brand.Primary.DarkTheme,
			SecondaryLight: tmpLogo.Brand.Secondary.LightTheme,
			SecondaryDark:  tmpLogo.Brand.Secondary.DarkTheme
		}
	};
}

// ── Resolution: manifest mode → spec ─────────────────────────────────────
function specFromManifest(pManifestPath, pModuleName)
{
	if (!libFs.existsSync(pManifestPath))
	{
		throw new Error('Manifest not found: ' + pManifestPath);
	}
	let tmpManifest = readJSON(pManifestPath);
	let tmpModule = findModule(tmpManifest, pModuleName);
	if (!tmpModule)
	{
		throw new Error('Module "' + pModuleName + '" not found in manifest');
	}
	let tmpBranding = tmpModule.Branding || {};
	return {
		Name:        tmpModule.Name,
		Palette:     tmpBranding.Palette || null,
		DisplayName: tmpBranding.DisplayName || tmpModule.DisplayName || null,
		Tagline:     tmpBranding.Tagline || tmpModule.Description || null,
		Path:        tmpModule.Path || null
	};
}

// ── Resolution: standalone mode → spec ───────────────────────────────────
// Read package.json, use its `name` as the brand identity, layer in any
// `retold.brandConfig` defaults, then let CLI flags override.
function specFromPackage(pPkg, pCLI)
{
	let tmpConfig = (pPkg.retold && pPkg.retold.brandConfig) || {};
	if (!pPkg.name)
	{
		throw new Error('package.json has no "name" field — cannot derive brand');
	}
	return {
		Name:        pPkg.name,
		Palette:     pCLI.palette     || tmpConfig.Palette     || null,
		DisplayName: pCLI.displayName || tmpConfig.DisplayName || null,
		Tagline:     pCLI.tagline     || tmpConfig.Tagline     || pPkg.description || null
	};
}

// ── package.json read/write ──────────────────────────────────────────────
function readJSON(pPath)
{
	return JSON.parse(libFs.readFileSync(pPath, 'utf8'));
}

function writeJSONPretty(pPath, pData)
{
	// Tabs to match the rest of the codebase's package.json files;
	// trailing newline because every editor expects one.
	libFs.writeFileSync(pPath, JSON.stringify(pData, null, '\t') + '\n', 'utf8');
}

// ── Favicon writer (shared with pict-section-theme-favicons) ─────────────
async function rasterize(pSharp, pSVGString, pSize)
{
	let tmpBuffer = Buffer.from(pSVGString, 'utf8');
	return pSharp(tmpBuffer, { density: pSize * 4 })
		.resize(pSize, pSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png({ compressionLevel: 9 })
		.toBuffer();
}

function resolveSharp(pSearchPaths)
{
	for (let i = 0; i < pSearchPaths.length; i++)
	{
		try
		{
			let tmpResolved = require.resolve('retold-sharp', { paths: [pSearchPaths[i]] });
			let tmpModule = require(tmpResolved);
			// retold-sharp exports a throwing stub when the underlying
			// `sharp` native binary failed to resolve.  The stub carries
			// a `checkAvailable()` diagnostic that returns
			// `{ available: false, ... }` in that case.  Treating the
			// stub as a working sharp would crash `pSharp(buffer)` later;
			// returning null here lets ensureSharp attempt an install,
			// and if that also fails, the SVG-only fall-through fires
			// instead of detonating the consumer's build.
			if (tmpModule && typeof tmpModule.checkAvailable === 'function')
			{
				let tmpStatus = tmpModule.checkAvailable();
				if (!tmpStatus || !tmpStatus.available)
				{
					continue;
				}
			}
			return tmpModule;
		}
		catch (pErr) { /* try next */ }
	}
	return null;
}

/**
 * Resolve retold-sharp for PNG favicon rasterization, or print a one-time
 * "install retold-sharp manually if you want PNGs" message and return null.
 *
 * History: this used to auto-install retold-sharp into the consumer's
 * devDependencies on first run ("just works without manual setup").  In
 * practice the sharp native binary turned out to be a recurring source
 * of install/publish/CI breakage across machines — Synology NAS, fresh
 * Linux deploy boxes, alpine Docker, ARM CI runners, etc.  Auto-adding
 * a native-binding dep to apps that mostly don't need PNGs at all
 * (SVG favicons cover every modern browser) was net-negative.
 *
 * New policy: retold-sharp is opt-in.  Apps that genuinely want PNG
 * favicons install it themselves (`npm install --save-dev retold-sharp`).
 * Brand gracefully degrades to SVG-only output otherwise.  No more
 * unsolicited dep mutation, no more sharp install failures crashing
 * `npm publish` of unrelated apps.
 *
 * @param {string} pTargetPkgDir - absolute path to the consumer's package dir (unused; kept for signature compat)
 * @param {boolean} pQuiet - suppress non-error output
 * @returns {function|null} retold-sharp module if already present and working, null otherwise
 */
function ensureSharp(pSearchPaths, pTargetPkgDir, pQuiet)
{
	let tmpSharp = resolveSharp(pSearchPaths);
	if (tmpSharp) { return tmpSharp; }

	if (!pQuiet)
	{
		console.warn('Brand: retold-sharp not available — skipping PNG raster sizes.');
		console.warn('       SVG favicons were written and are sufficient for all modern browsers.');
		console.warn('       If you need PNGs (older browsers / iOS home-screen icons), install');
		console.warn('       retold-sharp manually in this package:');
		console.warn('           npm install --save-dev retold-sharp');
		console.warn('       This is opt-in because sharp is a native binding that has a history');
		console.warn('       of install/publish failures on certain platforms.');
	}
	return null;
}

async function writeFavicons(pBrand, pOutDir, pSearchPaths, pTargetPkgDir, pQuiet)
{
	libFs.mkdirSync(pOutDir, { recursive: true });

	let tmpFaviconLight = pBrand.Favicon || pBrand.Icon;
	let tmpFaviconDark  = pBrand.FaviconDark || null;
	if (!tmpFaviconLight)
	{
		throw new Error('Brand has no Favicon or Icon — nothing to render');
	}

	let tmpResults = [];

	libFs.writeFileSync(libPath.join(pOutDir, 'favicon.svg'), tmpFaviconLight, 'utf8');
	tmpResults.push('favicon.svg');

	if (tmpFaviconDark)
	{
		libFs.writeFileSync(libPath.join(pOutDir, 'favicon-light.svg'), tmpFaviconLight, 'utf8');
		libFs.writeFileSync(libPath.join(pOutDir, 'favicon-dark.svg'), tmpFaviconDark, 'utf8');
		tmpResults.push('favicon-light.svg', 'favicon-dark.svg');
	}

	// PNG raster output via retold-sharp.  On first run for a given app,
	// ensureSharp installs retold-sharp into the consumer's devDependencies
	// so subsequent `npm install` invocations pull it automatically — no
	// per-app setup required by the developer.  Falls through to SVG-only
	// when the install fails (rare; see ensureSharp comment for details).
	let tmpSharp = ensureSharp(pSearchPaths, pTargetPkgDir, pQuiet);

	if (tmpSharp)
	{
		const SIZES = [16, 32, 48, 64, 180, 192, 512];
		for (let i = 0; i < SIZES.length; i++)
		{
			let tmpSize = SIZES[i];
			let tmpName = (tmpSize === 180) ? 'apple-touch-icon.png' : `favicon-${tmpSize}.png`;
			let tmpBytes = await rasterize(tmpSharp, tmpFaviconLight, tmpSize);
			libFs.writeFileSync(libPath.join(pOutDir, tmpName), tmpBytes);
			tmpResults.push(tmpName);
		}
	}

	return tmpResults;
}

// ── Target package.json resolution ───────────────────────────────────────
// Order:
//   1. --package <path> if supplied (relative to cwd)
//   2. manifest-mode: <manifest dir>/<module Path>/package.json
//   3. standalone:    <cwd>/package.json
function resolvePackagePath(pCLI, pManifestPath, pSpec)
{
	if (pCLI.pkg)
	{
		return libPath.resolve(process.cwd(), pCLI.pkg);
	}
	if (pManifestPath && pSpec.Path)
	{
		return libPath.join(libPath.dirname(pManifestPath), pSpec.Path, 'package.json');
	}
	return libPath.resolve(process.cwd(), 'package.json');
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main()
{
	let tmpArgs = parseArgs(process.argv);
	let tmpManifestMode = !!(tmpArgs.manifest && tmpArgs.module);

	let tmpManifestPath = tmpManifestMode
		? libPath.resolve(process.cwd(), tmpArgs.manifest)
		: null;

	// Build a partial spec from the manifest (manifest mode) or skip
	// to a package.json read (standalone). Either way, we then need
	// to read the target package.json to write the brand into it.
	let tmpManifestSpec = tmpManifestMode
		? specFromManifest(tmpManifestPath, tmpArgs.module)
		: null;

	let tmpPkgPath = resolvePackagePath(tmpArgs, tmpManifestPath, tmpManifestSpec || {});

	if (!libFs.existsSync(tmpPkgPath))
	{
		throw new Error('Target package.json not found: ' + tmpPkgPath);
	}

	let tmpPkg = readJSON(tmpPkgPath);

	// Resolve the spec — manifest mode merges CLI flags as overrides
	// over the manifest; standalone mode uses package.json + CLI flags.
	let tmpSpec;
	if (tmpManifestMode)
	{
		tmpSpec = tmpManifestSpec;
		if (tmpArgs.palette)     { tmpSpec.Palette     = tmpArgs.palette; }
		if (tmpArgs.displayName) { tmpSpec.DisplayName = tmpArgs.displayName; }
		if (tmpArgs.tagline)     { tmpSpec.Tagline     = tmpArgs.tagline; }
	}
	else
	{
		tmpSpec = specFromPackage(tmpPkg, tmpArgs);
	}

	let tmpBrand = buildBrandBlock(tmpSpec);

	tmpPkg.retold = tmpPkg.retold || {};
	tmpPkg.retold.brand = tmpBrand;
	writeJSONPretty(tmpPkgPath, tmpPkg);

	if (!tmpArgs.quiet)
	{
		console.log('Updated brand for "' + tmpSpec.Name + '"');
		console.log('  package:  ' + tmpPkgPath);
		console.log('  source:   ' + (tmpManifestMode ? 'manifest' : 'package.json + CLI'));
		console.log('  palette:  ' + tmpBrand.Palette);
		console.log('  primary:  ' + tmpBrand.Colors.Primary);
		console.log('  secondary: ' + tmpBrand.Colors.Secondary);
	}

	if (tmpArgs.favicons)
	{
		let tmpFaviconsDir = libPath.resolve(process.cwd(), tmpArgs.favicons);
		// Search retold-sharp from CLI dir, target package dir, then cwd —
		// any of those covers a sane install pattern.  ensureSharp uses
		// the target package dir to npm install --save-dev if absent.
		let tmpTargetPkgDir = libPath.dirname(tmpPkgPath);
		let tmpSearchPaths =
		[
			__dirname,
			tmpTargetPkgDir,
			process.cwd()
		];
		let tmpWritten = await writeFavicons(tmpBrand, tmpFaviconsDir, tmpSearchPaths, tmpTargetPkgDir, tmpArgs.quiet);
		if (!tmpArgs.quiet)
		{
			console.log('Wrote ' + tmpWritten.length + ' favicon files to ' + tmpFaviconsDir);
			for (let i = 0; i < tmpWritten.length; i++)
			{
				console.log('  ' + tmpWritten[i]);
			}
		}
	}
}

main().catch((pError) =>
{
	console.error('pict-section-theme-brand failed:', pError.message);
	if (process.env.DEBUG) console.error(pError.stack);
	process.exit(1);
});
