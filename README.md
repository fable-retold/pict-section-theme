# pict-section-theme

A Pict section that gives every Pict / Retold web application the same
out-of-the-box chrome: branded top bar, branded bottom bar, theme picker,
mode toggle, scale select, and a deterministic project-name → SVG logo
generator. One `addProvider` call wires it all together.

The point: **stop rewriting the same boilerplate in every app**. Branding,
navigation chrome, theme switching, dark-mode handling, and favicons are
solved problems — this module is the solved version.

---

## Install

```bash
npm install pict-section-theme
```

`pict-section-modal` is an optional peer dependency. The Theme-Button uses
it for the popup menu, and Theme-TopBar / Theme-BottomBar are designed to
mount inside its `shell()` panels — but every other view works without it.

---

## Quick start

In your application bootstrap:

```js
const libPictApplication = require('pict-application');
const libPictSectionTheme = require('pict-section-theme');
const libBrand = require('./MyApp-Brand.js');  // see "Brand precompute" below

class MyApplication extends libPictApplication
{
    constructor(pFable, pOptions, pServiceHash)
    {
        super(pFable, pOptions, pServiceHash);

        // Register the standard chrome + theme machinery in one call.
        // Self-bootstraps: theme runtime, catalog, views, persistence,
        // brand, and the shared TopBar/BottomBar all wired up.
        this.pict.addProvider('Theme-Section',
        {
            ApplyDefault: 'retold-default',
            DefaultMode:  'system',
            DefaultScale: 1.0,
            Brand:        libBrand,
            Views:        ['Picker', 'ModeToggle', 'ScaleSelect', 'Button',
                           'BrandMark', 'TopBar', 'BottomBar'],
            ViewOptions:
            {
                TopBar:    { NavView: 'MyApp-TopBar-Nav', UserView: 'MyApp-TopBar-User', Height: 56 },
                BottomBar: { StatusView: 'MyApp-StatusBar', Height: 32 }
            }
        }, libPictSectionTheme);
    }
}
```

After this, the rest of your app provides:

- A small **NavView** that fills `#Theme-TopBar-Nav` (your action buttons /
  links / breadcrumbs).
- A small **UserView** that fills `#Theme-TopBar-User` (account widgets,
  log toggles, custom indicators).
- A small **StatusView** that fills `#Theme-BottomBar-Status` (status
  text).
- A layout view that drops the Theme-TopBar / Theme-BottomBar destinations
  somewhere in the DOM (typically inside `pict-section-modal`'s
  `shell()` panels).

That's it. The brand mark, theme button, light/dark mode, and the
brand-tinted top + bottom stripes are all handled.

---

## Brand precompute

Every app has a brand: a name, a tagline, two colors, an icon, and
favicons. **Don't generate these at runtime.** Precompute them at build
time and persist into `package.json` under `retold.brand`. The runtime
brand module is then 5 lines and the `LogoGenerator` never enters your
production bundle.

The bundled CLI does this:

```bash
# manifest-driven (Retold-ecosystem apps with a Retold-Modules-Manifest.json)
npx pict-section-theme-brand \
    --manifest ../../Retold-Modules-Manifest.json \
    --module   my-app \
    --favicons web-application/favicons

# standalone (any Pict app — uses package.json's `name` + flags)
npx pict-section-theme-brand \
    --palette ocean \
    --display-name "My App" \
    --favicons public/favicons
```

Both modes write into the target package.json:

```json
{
    "retold": {
        "brand": {
            "Hash": "my-app",
            "Name": "My App",
            "Tagline": "Description from package.json",
            "Palette": "ocean",
            "Icon": "<svg>...</svg>",
            "IconType": "svg",
            "Favicon": "<svg>...</svg>",
            "FaviconDark": "<svg>...</svg>",
            "Colors": {
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

…and (when `--favicons` is supplied) a directory of `favicon.svg`,
`favicon-{16,32,48,64}.png`, `apple-touch-icon.png`, `favicon-{192,512}.png`.

The runtime brand module then becomes:

```js
// MyApp-Brand.js
module.exports = require('../../package.json').retold.brand;
```

Wire it into your build script:

```json
{
    "scripts": {
        "brand":    "pict-section-theme-brand --palette ocean --favicons web-application/favicons",
        "prebuild": "npm run brand",
        "build":    "npx quack build"
    }
}
```

`prebuild` is an npm convention — it runs automatically before `build`.

### Manifest mode vs. standalone mode

| | Manifest | Standalone |
|---|---|---|
| Used by | Retold-ecosystem apps | Any Pict app |
| Source of truth | `Retold-Modules-Manifest.json` `Branding` block | package.json `name` + CLI flags |
| Required flags | `--manifest`, `--module` | none |
| Optional overrides | (Branding block) | `--palette`, `--display-name`, `--tagline` |
| Default palette | (none — must specify in Branding) | `mix` |

Standalone mode also reads optional defaults from `package.json` under
`retold.brandConfig`:

```json
{
    "retold": {
        "brandConfig": {
            "Palette": "ocean",
            "DisplayName": "My App",
            "Tagline": "What it does"
        }
    }
}
```

CLI flags always win over `brandConfig` over package defaults. Re-running
the CLI with no flags reproduces the same brand.

### Curated palettes

`mix` (default), `default`, `desert`, `ocean`, `forest`, `synthwave`,
`twilight`, `cosmos`, `carnival`. `mix` deterministically picks one of
synthwave/ocean/desert per project — every project is internally
cohesive, the ecosystem feels varied.

---

## Chrome views

### Theme-TopBar

Renders into `#Theme-TopBar` by default. Standard layout:

```
┌────────────────────────────────────────────────────────────────────┐
│ [Brand-Mark]  [── Nav slot (flex-grow) ──]  [User-slot] [⚙ Theme]  │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ brand-primary stripe ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ brand-secondary hairline ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ │
└────────────────────────────────────────────────────────────────────┘
```

The brand stripes at the bottom are how you tell six tabs of different
apps apart at a glance — every app gets a unique color combination from
its deterministic logo.

**Slots**

- `#Theme-TopBar-Nav` — host fills via `NavView` option
- `#Theme-TopBar-User` — host fills via `UserView` option

**Options**

| Option | Default | Notes |
|---|---|---|
| `NavView` | `null` | Identifier of the host's nav slot view |
| `UserView` | `null` | Identifier of the host's user-area slot view |
| `Height` | `56` | px; match this to your panel `Size` |
| `NavAlign` | `'right'` | `'left'`, `'right'`, or `'center'` |
| `CompactBreakpoint` | `900` | px viewport width below which nav + user-slot collapse into a burger menu. `0` disables. Convention: ~1024 nav-heavy, ~900 default, ~768 minimal-nav, ~600 mobile-only |
| `MountBrandMark` | `true` | Set false to skip the auto Theme-Brand-Mark mount |
| `MountThemeButton` | `true` | Set false to skip the auto Theme-Button mount |

**Per-route swapping**

```js
// In your router callback
this.pict.views['Theme-TopBar'].setNavView('MyApp-Editor-Nav');
this.pict.views['Theme-TopBar'].setUserView('MyApp-Account-Widget');
```

### Theme-BottomBar

Renders into `#Theme-BottomBar` by default. Three slots:

```
┌────────────────────────────────────────────────────────────────────┐
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ brand-secondary hairline ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ brand-primary thin line ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │
│ Status text          [── Info slot (flex) ──]      [actions]       │
└────────────────────────────────────────────────────────────────────┘
```

**Slots**

- `#Theme-BottomBar-Status` — host fills via `StatusView` option
- `#Theme-BottomBar-Info` — host fills via `InfoView` option (centered)
- `#Theme-BottomBar-Actions` — host fills via `ActionsView` option

**Options**

| Option | Default | Notes |
|---|---|---|
| `StatusView` | `null` | Identifier of the host's status slot view |
| `InfoView` | `null` | Identifier of the host's info slot view |
| `ActionsView` | `null` | Identifier of the host's actions slot view |
| `Height` | `32` | px |

**Per-route swapping**: `setStatusView()`, `setInfoView()`, `setActionsView()`.

---

## Active-route indicator

Mark the current nav button with the W3C-standard `aria-current="page"`.
Theme-TopBar's CSS keys off the attribute selector and applies a
brand-tinted highlight automatically:

```html
<!-- In your NavView template -->
<button aria-current="{~D:Record.IsActive~}"
        onclick="...navigateTo('/foo')">Foo</button>
```

```js
// In your NavView's onBeforeRender
onBeforeRender()
{
    return Object.assign({}, this.pict.AppData.MyApp,
    {
        IsActive: (this.pict.AppData.MyApp.CurrentRoute === 'foo') ? 'page' : ''
    });
}
```

The empty string is fine — only `aria-current="page"` matches the
selector, blank/missing renders un-styled.

---

## Compact / responsive

Two responsive breakpoints handle the typical "this app got too narrow"
cases without the host writing any code:

**Below 720px** (default — the brand-mark breakpoint):
`.pict-theme-brand-mark-name` collapses to icon-only. The deterministic
logo is recognisable on its own.

**Below 900px** (default — the `CompactBreakpoint` option on Theme-TopBar):
The nav slot and user-slot hide; a burger button (`☰`) appears in their
place. Clicking the burger opens a `pict-section-modal` popup containing
a clone of the original nav + user DOM, so every action remains
reachable. Inline `onclick="..."` handlers on the cloned buttons keep
working because they resolve `_Pict` at click time.

900px is the conventional "narrow desktop window" breakpoint — a docked
window next to another app or a half-screen split typically lands in this
range. Most desktop users will hit it while shrinking, where 600px is
mobile-only territory most desktops never reach.

**Coordinate with the shell — `ResponsiveDrawer` on side panels.**
If your layout uses `pict-section-modal`'s `shell()` API with a sidebar
or other side panel, the topbar's burger breakpoint won't actually
trigger unless the sidebar gets out of the way too — the sidebar's
`MinSize` plus the workspace's min-content width pins the page
horizontally and the browser window can't shrink past that point.

Pass `ResponsiveDrawer: <breakpoint>` to the side panel's
`addPanel()` call. The shell registers a matchMedia listener and
**flips the middle row's layout from row to column** at that
viewport width — the side panel stretches to full width and becomes
a top drawer above the workspace (mirroring retold-remote's
content-editor pattern). Above the breakpoint it snaps back into the
docked column. The user's collapse / expand keeps working in both
modes: collapsed in drawer mode just gives the panel `height: 0`
(only the collapse tab is visible), expanded restores the drawer to
its `DrawerHeight` (default `33vh`).

```js
// Sidebar — flips to top drawer at the same threshold as the topbar
this._shell.addPanel({
    Hash: 'sidebar',
    Side: 'left',
    Mode: 'resizable',
    Size: 280,
    ResponsiveDrawer: 900,    // matches Theme-TopBar's CompactBreakpoint
    DrawerHeight: '33vh',     // optional; CSS units (px/vh/%) accepted
    // ... other options
});
```

This is the conventional "responsive sidebar" pattern: at narrow
widths the sidebar moves above the workspace (giving content full
width when collapsed, full height when the user opts to see the
sidebar), instead of pinching the workspace into uselessness.

Override per-app from the recommended ladder:

```js
ViewOptions:
{
    // Nav-heavy app with 6+ buttons + a brand mark — earlier collapse
    TopBar: { ..., CompactBreakpoint: 1024 }

    // Minimal nav, less crowded — later collapse
    TopBar: { ..., CompactBreakpoint: 768 }

    // Mobile-only collapse — only triggers at true phone widths
    TopBar: { ..., CompactBreakpoint: 600 }

    // Disable compact mode entirely (desktop-only app)
    TopBar: { ..., CompactBreakpoint: 0 }
}
```

Pass `0` to disable compact mode entirely (the burger stays hidden and
the nav + user-slot always show — useful for desktop-only apps that
don't need a mobile layout).

**Between 600–720px** (or whatever your breakpoints are), the nav slot
scrolls horizontally instead of clipping. This is silent degradation —
fine for moderately-overflowed nav rows but if you have a *lot* of
buttons, consider an in-template "More ▾" button:

```html
<!-- in your NavView template -->
<button class="action" onclick="document.querySelector('#my-more-menu').classList.toggle('open')">More ▾</button>
<div id="my-more-menu" class="more-popup">
    <!-- low-priority items go here -->
</div>
```

True priority+ overflow detection (auto-detect which buttons fit and
roll the rest into a "More ▾" menu at runtime) is not currently built
in — call it out as a future enhancement if you need it.

### Customising the burger popup

The default `openBurgerMenu()` clones the existing nav + user DOM into
the popup. If you want different content (e.g. a richer in-app menu,
auth widgets, a search box), override the method on the instance:

```js
this.pict.views['Theme-TopBar'].openBurgerMenu = function ()
{
    let tmpModal = this.pict.views['Pict-Section-Modal'];
    return tmpModal.show({
        title:   'Menu',
        content: this.pict.parseTemplateByHash('MyApp-BurgerMenu', {}),
        width:   '320px',
        closeable: true,
        buttons: [],
        onOpen:  () => this.pict.views['MyApp-BurgerMenu-Content'].render()
    });
};
```

---

## API reference

### `require('pict-section-theme')`

The default export is the `PictSectionThemeProvider` class, ready for
`addProvider()`.

Named exports:

| Export | Type | What it is |
|---|---|---|
| `default_configuration` | object | Provider config defaults |
| `Provider` | class | The underlying `pict-provider-theme` runtime |
| `PictSectionThemeProvider` | class | Same as default export, named |
| `PickerView` | class | Theme-Picker view |
| `ModeToggleView` | class | Theme-ModeToggle view |
| `ScaleSelectView` | class | Theme-ScaleSelect view |
| `ButtonView` | class | Theme-Button view |
| `BrandStripView` | class | Theme-BrandStrip view (multi-row stripe chrome) |
| `BrandMarkView` | class | Theme-Brand-Mark view (inline icon+name) |
| `TopBarView` | class | Theme-TopBar view |
| `BottomBarView` | class | Theme-BottomBar view |
| `Catalog` | object | Theme registry singleton |
| `Brand` | object | Theme-Brand helper |
| `Scale` | object | Theme-Scale helper |
| `Persistence` | object | Theme-Persistence helper |
| `registerCatalog(pict)` | function | Push registry themes into the runtime |
| `listCatalog()` | function | Picker-friendly metadata for every registered theme |
| `install(pict, options)` | function | Legacy bootstrap (delegates to provider) |
| `clearPersistence(pict)` | function | Wipe the saved theme/mode/scale entry |

The deterministic logo generator lives at
`pict-section-theme/source/Theme-Logo.js` — require it directly when
you need it (the build CLI does), but it's intentionally kept out of
the main exports so app bundles don't ship the generator code.

### Provider options (passed to `addProvider`)

| Option | Default | Notes |
|---|---|---|
| `ApplyDefault` | `null` | Theme hash to apply at boot |
| `DefaultMode` | `null` | `'light'` / `'dark'` / `'system'` / `null` |
| `DefaultScale` | `null` | `0.75`–`2.0` |
| `Persistence` | `true` | Persist theme/mode/scale to localStorage |
| `PersistenceKey` | `null` | Storage scope; null → window.location.hostname |
| `RegisterCatalog` | `true` | Register every bundled theme |
| `Views` | `null` | Array of view shortnames; null → all |
| `ViewOptions` | `null` | Per-view option overrides |
| `Brand` | `null` | The `retold.brand` block from your package.json |
| `ProviderOptions` | `null` | `pict-provider-theme` overrides |

---

## CLI reference

### `pict-section-theme-brand`

Precompute brand into a target package.json. See **Brand precompute** above.

### `pict-section-theme-favicons`

Standalone favicon writer; takes a brand JS or JSON file and writes the
favicon set. Useful when the brand is defined inline rather than coming
from package.json.

```bash
pict-section-theme-favicons \
    --brand path/to/MyBrand.js \
    --out   public/favicons \
    [--print-tags]
```

`--print-tags` prints the recommended `<link rel="icon">` snippet for
your `index.html`.

---

## Migration from a hand-rolled topbar

You probably have something like this today:

```
PictView-MyApp-TopBar.js          ← combined brand + nav + theme button (200+ lines)
PictView-MyApp-StatusBar.js       ← combined status text (50 lines)
MyApp-Brand.js                    ← hardcoded SVG / colors (60 lines)
public/favicons/                  ← hand-edited
css/myapp-themes.css              ← hand-rolled --color-* tokens
```

After migration:

```
PictView-MyApp-TopBar-Nav.js      ← just nav buttons (30 lines)
PictView-MyApp-TopBar-User.js     ← user widgets (20 lines)
PictView-MyApp-StatusBar.js       ← status text (15 lines)
MyApp-Brand.js                    ← 1 require + 1 module.exports (5 lines)
public/favicons/                  ← generated by CLI
                                  ← theme tokens come from pict-section-theme
```

Concrete pilot: see retold-manager's bootstrap in
`source/retold-manager/source/web/client/pict-app/Pict-Application-RetoldManager.js`.

---

## License

MIT — Steven Velozo
