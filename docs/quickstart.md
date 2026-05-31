# Quick Start

This guide walks you through adding theme switching to a Pict application: installing the package, registering the provider, rendering the controls, and persisting the user's choice.

## Prerequisites

- A Pict application (or willingness to create one).
- [pict-section-modal](https://fable-retold.github.io/pict-section-modal/) registered in the application if you want the theme-picker dropdown or the topbar button popup -- both open through the modal section. The picker and the button render without it, but clicking them logs a warning and no-ops.

## Installation

```bash
npm install pict-section-theme
```

`pict-section-modal` is an optional peer dependency:

```bash
npm install pict-section-modal
```

## Step 1: Register the Provider

The default export is a Pict provider. Add it during your application bootstrap. It self-bootstraps synchronously inside its constructor, so the views are usable as soon as `addProvider` returns.

```javascript
const libPictApplication = require('pict-application');
const libPictSectionTheme = require('pict-section-theme');

class MyApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.pict.addProvider('Theme-Section',
			{
				ApplyDefault: 'retold-default',
				DefaultMode:  'system',
				DefaultScale: 1.0
			}, libPictSectionTheme);
	}
}
```

That single call:

- Ensures `pict.providers.Theme` (the [pict-provider-theme](https://fable-retold.github.io/pict-provider-theme/) runtime) exists.
- Registers every bundled theme in the runtime registry.
- Adds the theme views to `pict.views[...]`.
- Hydrates persisted choices from `localStorage`; otherwise applies `ApplyDefault` / `DefaultMode` / `DefaultScale`.
- Wires the save-on-change handler so subsequent user picks persist.

> By default all eight bundled views are registered. To register only the ones you use, pass a `Views` array -- see [Views](views.md) and the provider options table below.

## Step 2: Add Destination Elements

Each view renders into a single destination element identified by its default id. Drop the destinations into your layout markup where you want each control to appear.

```html
<!-- Anywhere in your app's layout template -->
<div id="Theme-Picker"></div>
<div id="Theme-ModeToggle"></div>
<div id="Theme-ScaleSelect"></div>

<!-- Or just the topbar button, which hosts all three in a popup -->
<div id="Theme-Button"></div>
```

| View | Default destination |
|---|---|
| Theme-Picker | `#Theme-Picker` |
| Theme-ModeToggle | `#Theme-ModeToggle` |
| Theme-ScaleSelect | `#Theme-ScaleSelect` |
| Theme-Button | `#Theme-Button` |

## Step 3: Render the Controls

The theme views do not auto-render (`AutoRender: false`), so call `render()` once the destination elements exist in the DOM -- typically from your application's or layout view's `onAfterRender`.

```javascript
onAfterRender(pRenderable)
{
	this.pict.views['Theme-Picker'].render();
	this.pict.views['Theme-ModeToggle'].render();
	this.pict.views['Theme-ScaleSelect'].render();
	return super.onAfterRender(pRenderable);
}
```

Each control wires its own behavior through inline handlers and stays in sync with theme changes from elsewhere (it subscribes to the runtime's apply event), so you do not need to re-render manually when a different control changes the theme.

## Step 4: The Topbar Button (Optional)

If you would rather expose a single compact entry point, render only the `Theme-Button`. Clicking it opens a `pict-section-modal` popup containing the picker, the mode toggle, and the scale select.

```javascript
onAfterRender(pRenderable)
{
	this.pict.views['Theme-Button'].render();
	return super.onAfterRender(pRenderable);
}
```

The button mounts the picker / toggle / scale into the modal DOM when it opens. Do not also render those three views into their own standalone destinations at the same time -- two hosts for the same destination id produces duplicate ids and undefined behavior. Pick one host per view.

## Step 5: Persistence

Persistence is on by default. The active theme, mode, and scale are saved to `localStorage` under a key scoped to `window.location.hostname`, so apps on different hosts keep independent state.

- A saved entry takes precedence over `ApplyDefault` -- once a user picks a theme, reloads honor that pick.
- If the saved theme hash is no longer in the registry (theme removed, app downgraded), the bootstrap falls back to `ApplyDefault`, then to the catalog's canonical default.

Override the storage scope with `PersistenceKey`, or disable it entirely:

```javascript
this.pict.addProvider('Theme-Section',
	{
		ApplyDefault:   'retold-default',
		Persistence:    true,
		PersistenceKey: 'my-app'   // scope key; null -> hostname
	}, libPictSectionTheme);
```

To wipe the saved entry (for a "reset to defaults" affordance):

```javascript
const libPictSectionTheme = require('pict-section-theme');
libPictSectionTheme.clearPersistence(this.pict);
```

## Provider Options

Passed as the options object to `addProvider`. Verified against `source/Pict-Section-Theme.js`.

| Option | Default | Notes |
|---|---|---|
| `ApplyDefault` | `null` | Theme hash to apply at boot. |
| `DefaultMode` | `null` | `'light'` / `'dark'` / `'system'` / `null` (theme's own default). |
| `DefaultScale` | `null` | Viewport scale multiplier; a number such as `1.0`. |
| `Persistence` | `true` | Persist theme / mode / scale to `localStorage`. |
| `PersistenceKey` | `null` | Storage scope; `null` -> `window.location.hostname`. |
| `RegisterCatalog` | `true` | Register every bundled theme with the runtime. |
| `Views` | `null` | Array of view short-names; `null` -> all views. |
| `ViewOptions` | `null` | Per-view option overrides, keyed by view short-name. |
| `Brand` | `null` | The brand block to apply (see [CLI Reference](cli.md)). |
| `ProviderOptions` | `null` | Overrides forwarded to [pict-provider-theme](https://fable-retold.github.io/pict-provider-theme/). |

> The view short-names accepted by `Views` and `ViewOptions` are: `Picker`, `ModeToggle`, `ScaleSelect`, `Button`, `BrandStrip`, `BrandMark`, `TopBar`, `BottomBar`.

## Next Steps

- **[Views](views.md)** -- Verified options for the picker, mode toggle, and topbar button.
- **[Architecture](architecture.md)** -- How the provider bootstrap, runtime, persistence, and scale fit together.
- **[CLI Reference](cli.md)** -- Precompute a brand and favicons at build time.
