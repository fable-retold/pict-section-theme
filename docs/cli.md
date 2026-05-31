# CLI Reference

`pict-section-theme` ships two build-time command-line tools. Both are registered as package `bin` entries, so they run via `npx` from any project that has the package installed.

| Command | Purpose |
|---|---|
| `pict-section-theme-brand` | Precompute a deterministic brand (logo + palette + favicons) and persist it into a target `package.json`. |
| `pict-section-theme-favicons` | Write the favicon file set from an existing brand block. |

The point of precomputing is to keep the logo generator out of the runtime bundle. Build pushes a fully-resolved JSON brand into `package.json`; the app's runtime brand module is then a one-line `require`, with no SVG generation in the browser and no per-page-load hash work.

---

## pict-section-theme-brand

Generates a brand block via the deterministic logo generator and writes it into the target `package.json` under `retold.brand`. Optionally writes the favicon files to disk.

### Modes

There are two modes. Verified against `bin/pict-section-theme-brand.js`.

**Manifest-driven** -- for Retold-ecosystem apps that have a `Retold-Modules-Manifest.json`. Looks up the module entry by `Name` and reads its `Branding.{ Palette, DisplayName, Tagline }` block.

```bash
npx pict-section-theme-brand \
    --manifest ../../Retold-Modules-Manifest.json \
    --module   my-app \
    --favicons web-application/favicons
```

**Standalone** -- for any Pict app. Reads the target `package.json` and uses its `name` field as the brand hash and monogram source. No `--manifest` / `--module` required.

```bash
npx pict-section-theme-brand \
    --palette ocean \
    --display-name "My App" \
    --favicons public/favicons
```

`--manifest` and `--module` must be supplied together; omit both for standalone mode.

### Flags

| Flag | Mode | Notes |
|---|---|---|
| `--manifest <path>` | Manifest | Path to the modules manifest (relative to cwd). |
| `--module <name>` | Manifest | Module `Name` to look up in the manifest. |
| `--package <path>` | Both | Target `package.json` to write into. See resolution order below. |
| `--palette <key>` | Standalone (override in manifest) | Curated palette key; defaults to `mix` in standalone mode. |
| `--display-name <text>` | Standalone (override in manifest) | Brand display name; defaults to the humanized package name. |
| `--tagline <text>` | Standalone (override in manifest) | Brand tagline; defaults to the package `description`. |
| `--favicons <dir>` | Both | Directory to write the favicon set into. Skipped when not supplied. |
| `--quiet` | Both | Suppress non-error output. |
| `--help`, `-h` | Both | Print usage and exit. |

In manifest mode, any `--palette` / `--display-name` / `--tagline` flags supplied on the command line override the manifest's `Branding` block.

### Standalone defaults from package.json

Standalone mode also reads optional defaults from the target `package.json` under `retold.brandConfig`:

```json
{
	"retold":
	{
		"brandConfig":
		{
			"Palette": "ocean",
			"DisplayName": "My App",
			"Tagline": "What it does"
		}
	}
}
```

Resolution precedence is: **CLI flags** win over **`brandConfig`** over **package defaults** (`name` / `description`). Re-running the CLI with no flags reproduces the same brand, because the logo generator is deterministic for a given name + palette.

### Target package.json resolution

The `package.json` written into is resolved in this order:

1. `--package <path>` if supplied (relative to cwd).
2. Manifest mode: `<manifest dir>/<module Path>/package.json`.
3. Standalone: `<cwd>/package.json`.

### Curated palettes

The available palette keys, verified from the root README: `mix` (default), `default`, `desert`, `ocean`, `forest`, `synthwave`, `twilight`, `cosmos`, `carnival`. `mix` deterministically picks one of synthwave / ocean / desert per project, so each project is internally cohesive while the ecosystem feels varied.

### What it writes

Into the target `package.json` under `retold.brand`:

```json
{
	"retold":
	{
		"brand":
		{
			"Hash": "my-app",
			"Name": "My App",
			"Tagline": "Description from package.json",
			"Palette": "ocean",
			"Icon": "<svg>...</svg>",
			"IconType": "svg",
			"Favicon": "<svg>...</svg>",
			"FaviconDark": "<svg>...</svg>",
			"Colors":
			{
				"Primary":        "#2f97b4",
				"Secondary":      "#e07e40",
				"PrimaryLight":   "#2f97b4",
				"PrimaryDark":    "#6dbcd2",
				"SecondaryLight": "#e07e40",
				"SecondaryDark":  "#e9b493"
			}
		}
	}
}
```

The runtime brand module is then a one-liner:

```javascript
// MyApp-Brand.js
module.exports = require('../../package.json').retold.brand;
```

Wire it into your build so it runs before the bundle is built. `prebuild` is an npm convention that runs automatically before `build`:

```json
{
	"scripts":
	{
		"brand":    "pict-section-theme-brand --palette ocean --favicons web-application/favicons",
		"prebuild": "npm run brand",
		"build":    "npx quack build"
	}
}
```

---

## pict-section-theme-favicons

A standalone favicon writer. It reads a brand block (the same shape `Theme-Brand` consumes) and writes the favicon set to a target directory. Useful when the brand is defined in its own file rather than coming from `package.json`.

```bash
npx pict-section-theme-favicons \
    --brand path/to/MyBrand.js \
    --out   public/favicons \
    --print-tags
```

### Flags

Verified against `bin/pict-section-theme-favicons.js`.

| Flag | Notes |
|---|---|
| `--brand <path>` | Required. The brand source; a `.json` file (parsed) or a `.js` / `.cjs` file (required). |
| `--out <dir>` | Required. Output directory; created if it does not exist. |
| `--print-tags` | Print the recommended `<link rel="icon">` snippet for your `index.html` to stdout. |
| `--quiet` | Suppress non-error output. |
| `--help`, `-h` | Print usage and exit. |

### What it writes

The SVG sources are always written. PNG raster sizes are progressive enhancement -- every modern browser can use an SVG favicon directly.

- `favicon.svg` -- primary, scalable.
- `favicon-light.svg` and `favicon-dark.svg` -- written only when the brand supplies a paired dark favicon (`FaviconDark`).
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon-64.png` -- raster fallbacks.
- `apple-touch-icon.png` -- 180×180, iOS home screen.
- `favicon-192.png`, `favicon-512.png` -- PWA manifest / Android home screen.

### PNG rasterization and retold-sharp

PNG output requires the `retold-sharp` package (a wrapper around the `sharp` native binding). `retold-sharp` is **not** in this module's dependency tree, because apps that only consume the theme runtime should not have to pull a native binary they never run.

If `retold-sharp` is not resolvable when you run either CLI with `--favicons` / `--out`, the command degrades to **SVG-only output** and prints a one-time hint. The SVG favicon is sufficient for all modern browsers; install `retold-sharp` yourself only if you need the PNG sizes (older browsers, iOS home-screen icons):

```bash
npm install --save-dev retold-sharp
```

> The retold-sharp behavior is opt-in: neither CLI auto-installs it. A header comment in `bin/pict-section-theme-brand.js` still describes an older auto-install policy, but the current `ensureSharp` implementation only resolves an already-installed copy and otherwise falls through to SVG-only. (Flagged as a stale comment to the maintainer.)

### Suggested `<link>` tags

With `--print-tags`, the favicons CLI prints the head snippet:

```html
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="favicon-512.png">
```
