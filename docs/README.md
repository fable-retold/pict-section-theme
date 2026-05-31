# pict-section-theme

A Pict section that bundles every Retold-ecosystem theme and exposes a small set of reusable, drop-in views: a theme-picker dropdown, a light / dark / system mode toggle, a viewport-scale select, and an embeddable SVG topbar button that pops a theme submenu via [pict-section-modal](https://fable-retold.github.io/pict-section-modal/). It wraps the [pict-provider-theme](https://fable-retold.github.io/pict-provider-theme/) runtime and self-bootstraps from a single `addProvider` call.

The point: stop rewriting theme switching, dark-mode handling, brand chrome, and favicon generation in every app. These are solved problems -- this module is the solved version.

## What It Does

`pict-section-theme` gives any Pict / Retold web application a consistent, out-of-the-box theming layer:

- **Bundles every Retold theme** -- a starter catalog of framework defaults, app-extracted palettes, paired light/dark themes, period/fun palettes, and retro workstation skins, all registered with the theme runtime in one step.
- **Theme picker** -- a custom dropdown listing every registered theme, grouped by category, with inline SVG mode-capability glyphs.
- **Mode toggle** -- a three-segment Light / Dark / System control that disables itself for single-mode themes.
- **Scale select** -- a viewport-zoom dropdown that is independent of the active theme.
- **Topbar button** -- an embeddable SVG button that opens a modal hosting the picker, mode toggle, and scale select.
- **Brand chrome** -- per-app icon + two-color brand signature views, driven by a precomputed brand block.
- **Persistence** -- remembers the user's theme, mode, and scale in `localStorage`, scoped per host.
- **Build-time CLIs** -- precompute a deterministic brand (logo + palette + favicons) into `package.json`, keeping the logo generator out of the runtime bundle.

## Architecture at a Glance

The default export is a Pict provider. Registering it ensures the [pict-provider-theme](https://fable-retold.github.io/pict-provider-theme/) runtime exists, registers every bundled theme, adds the requested views, hydrates persisted choices (falling back to your configured defaults), wires the save-on-change handler, and applies the supplied brand.

```mermaid
graph TD
    A[Your Application] --> B[PictSectionThemeProvider]
    B --> C[pict-provider-theme runtime]
    B --> D[Theme Catalog registry]
    B --> E[Views: Picker / ModeToggle / ScaleSelect / Button / Brand]
    B --> F[Persistence localStorage]
    B --> G[Theme-Brand CSS variables]

    C --> H[Single style#pict-theme element]
    E --> I[pict-section-modal popup/dropdown]

    style A fill:#e8f5e9,stroke:#42b983,color:#333
    style B fill:#e3f2fd,stroke:#42a5f5,color:#333
    style C fill:#fff3e0,stroke:#ffa726,color:#333
    style D fill:#fff3e0,stroke:#ffa726,color:#333
    style E fill:#fff3e0,stroke:#ffa726,color:#333
    style F fill:#fff3e0,stroke:#ffa726,color:#333
    style G fill:#fff3e0,stroke:#ffa726,color:#333
    style H fill:#fce4ec,stroke:#ef5350,color:#333
    style I fill:#fce4ec,stroke:#ef5350,color:#333
```

See [Architecture](architecture.md) for the bootstrap sequence, the theme runtime relationship, and the persistence model.

## Quick Example

```javascript
const libPictApplication = require('pict-application');
const libPictSectionTheme = require('pict-section-theme');

class MyApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// One call wires the runtime, catalog, views, persistence, and apply.
		this.pict.addProvider('Theme-Section',
			{
				ApplyDefault: 'retold-default',
				DefaultMode:  'system',
				DefaultScale: 1.0
			}, libPictSectionTheme);
	}
}
```

After this returns, `this.pict.views['Theme-Picker']`, `Theme-ModeToggle`, `Theme-ScaleSelect`, and `Theme-Button` are all live and ready to render into their destination elements.

## Learn More

- **[Quick Start](quickstart.md)** -- Install the package, register the provider, and render your first theme controls.
- **[Architecture](architecture.md)** -- The provider bootstrap, theme catalog, persistence, scale, and brand helpers.
- **[Views](views.md)** -- The theme picker, mode toggle, and SVG topbar button, with their verified options.
- **[CLI Reference](cli.md)** -- The `pict-section-theme-brand` and `pict-section-theme-favicons` build-time commands.

## Related Modules

- [pict](https://fable-retold.github.io/pict/) -- Core MVC application framework.
- [pict-view](https://fable-retold.github.io/pict-view/) -- The view base class every theme view extends.
- [pict-provider](https://fable-retold.github.io/pict-provider/) -- The provider base class the section provider extends.
- [pict-provider-theme](https://fable-retold.github.io/pict-provider-theme/) -- The runtime theme manager this module wraps.
- [pict-section-modal](https://fable-retold.github.io/pict-section-modal/) -- Optional peer dependency; powers the picker dropdown and the topbar button popup.

## License

MIT -- Steven Velozo
