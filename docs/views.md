# Views

`pict-section-theme` ships several drop-in views. This page documents the three core user-facing controls -- the **theme picker**, the **mode toggle**, and the **SVG topbar button** -- with options verified against their source in `source/views/`.

Every theme view shares the same conventions:

- `AutoInitialize: true`, `AutoRender: false` -- they initialize automatically but you call `render()` once their destination element exists.
- Each has a single default destination id; rendering writes there.
- Each subscribes to the theme runtime's `onApply` event (the picker and toggle) or the scale's `onChange` (the scale select), so they stay in sync when the theme changes from anywhere.
- Per-view options are set through the provider's `ViewOptions` block, keyed by the view's short-name.

```javascript
this.pict.addProvider('Theme-Section',
	{
		ApplyDefault: 'retold-default',
		ViewOptions:
		{
			Picker: { ShowModeIcons: false },
			Button: { ModalTitle: 'Appearance', ModalWidth: '360px' }
		}
	}, libPictSectionTheme);
```

---

## Theme-Picker

A custom dropdown that lists every theme registered with the runtime, grouped by category. It renders as a trigger button showing the active theme name and a chevron. Clicking opens a [pict-section-modal](https://fable-retold.github.io/pict-section-modal/) dropdown where each row is the theme name plus an inline SVG glyph indicating the modes the theme supports -- a sun for light-only, a moon for dark-only, a combined glyph for paired themes.

> A native `<select>` was deliberately rejected here: `<option>` elements can only render plain text, not the SVG mode glyphs.

**Short-name:** `Picker` - **Destination:** `#Theme-Picker` - **View hash:** `Theme-Picker`

### Modal dependency

The dropdown popover is a [pict-section-modal](https://fable-retold.github.io/pict-section-modal/) feature, not a hand-rolled DOM widget. The modal view must be registered (under the hash `Pict-Section-Modal` by default). If it is not, the trigger button still renders but clicking it logs a `console.warn` and no-ops.

### Options

Verified against `PictView-Theme-Picker.js`.

| Option | Default | Notes |
|---|---|---|
| `ProviderHash` | `'Theme'` | Hash of the theme runtime provider to drive. |
| `ModalViewHash` | `'Pict-Section-Modal'` | Hash of the modal view used for the dropdown. |
| `Categories` | `null` | Array describing the category (optgroup) order. When omitted, categories are discovered from the registered themes in first-seen order. |
| `ShowModeIcons` | `true` | Show the per-row sun / moon / sun+moon mode-capability glyph, and the leading glyph on the trigger button. Pass `false` for a plainer menu. |
| `OnPick` | (none) | Optional callback invoked with the picked theme hash after a successful apply. |

### Driving it programmatically

The `pick(hash)` method is public, so hotkeys or tests can drive the picker directly. It preserves the current mode where the new theme supports it (single-mode themes clamp internally):

```javascript
this.pict.views['Theme-Picker'].pick('synthwave');
```

---

## Theme-ModeToggle

A three-segment toggle for **Light / Dark / System** mode. Clicking a segment calls the runtime's `setMode(...)`. When the active theme is single-mode, the whole group becomes non-interactive: the segments the theme cannot switch to are greyed and struck through, while the active segment keeps normal styling so the user can still see which mode the theme uses. A small lock note explains why, naming the theme.

Like the picker, it subscribes to the runtime's apply event so the active-segment highlight stays in sync with theme changes from elsewhere.

**Short-name:** `ModeToggle` - **Destination:** `#Theme-ModeToggle` - **View hash:** `Theme-ModeToggle`

### Options

Verified against `PictView-Theme-ModeToggle.js`.

| Option | Default | Notes |
|---|---|---|
| `ProviderHash` | `'Theme'` | Hash of the theme runtime provider to drive. |
| `Labels` | `{ Light: 'Light', Dark: 'Dark', System: 'System' }` | Relabel the three buttons (for i18n). The order is fixed. |
| `ShowIcons` | `true` | Show the inline sun / moon / monitor SVG icons next to the labels. |
| `OnModeChange` | (none) | Optional callback invoked with the chosen mode after a successful change. |

### Driving it programmatically

The `pickMode(mode)` method is public:

```javascript
this.pict.views['Theme-ModeToggle'].pickMode('dark');
```

Single-mode themes silently ignore the change (and the toggle is shown disabled in that case anyway). If the change is rejected, the view forces a re-render so the UI state stays consistent.

---

## Theme-Button

An embeddable SVG button (a sun glyph) sized to drop into an application top bar. Clicking it opens a [pict-section-modal](https://fable-retold.github.io/pict-section-modal/) popup containing the **Theme-Picker**, the **Theme-ModeToggle**, and the **Theme-ScaleSelect**, each under a labelled row. The button itself picks its color from the theme via `currentColor`, so it inherits the surrounding text color.

**Short-name:** `Button` - **Destination:** `#Theme-Button` - **View hash:** `Theme-Button`

### Modal dependency

Requires [pict-section-modal](https://fable-retold.github.io/pict-section-modal/) (under the hash `Pict-Section-Modal` by default). If it is not registered, clicking the button logs a `console.warn` and no-ops.

### Sub-view mounting

When the popup opens, the button mounts the picker / toggle / scale into the freshly-created modal DOM by calling `render()` on each. Each sub-view is optional -- if one is not registered, its row is silently skipped (no broken placeholders).

> Because the popup hosts the picker / toggle / scale at their default destination ids, do not also render those three views into standalone destinations elsewhere at the same time. Two hosts for the same id produces duplicate ids and undefined behavior. Use either the topbar button **or** the standalone controls, not both.

### Options

Verified against `PictView-Theme-Button.js`.

| Option | Default | Notes |
|---|---|---|
| `ProviderHash` | `'Theme'` | Hash of the theme runtime provider. |
| `ModalViewHash` | `'Pict-Section-Modal'` | Hash of the modal view used for the popup. |
| `PickerViewHash` | `'Theme-Picker'` | Hash of the picker view to mount in the popup. |
| `ModeToggleViewHash` | `'Theme-ModeToggle'` | Hash of the mode-toggle view to mount. |
| `ScaleSelectViewHash` | `'Theme-ScaleSelect'` | Hash of the scale-select view to mount. |
| `Title` | `'Theme'` | Button tooltip text. |
| `AriaLabel` | `'Open theme menu'` | Accessible label for the button. |
| `ModalTitle` | `'Theme'` | Title shown on the modal popup. |
| `ModalWidth` | `'320px'` | Width of the modal popup (CSS). |

### Driving it programmatically

The `openMenu()` method is public:

```javascript
this.pict.views['Theme-Button'].openMenu();
```

---

## Other Bundled Views

The provider also registers these views (see [Architecture](architecture.md) for the full export list):

- **Theme-ScaleSelect** (`ScaleSelect`, `#Theme-ScaleSelect`) -- a `<select>` of viewport-scale presets. Independent of the active theme; reads presets from the Theme-Scale helper or a host-supplied `Presets` array, and stays in sync via the scale's `onChange` listener.
- **Theme-BrandStrip** (`BrandStrip`, `#Theme-BrandStrip`) -- the per-app brand signature.
- **Theme-Brand-Mark** (`BrandMark`, `#Theme-Brand-Mark`) -- an inline icon + name brand mark.
- **Theme-TopBar** (`TopBar`, `#Theme-TopBar`) and **Theme-BottomBar** (`BottomBar`, `#Theme-BottomBar`) -- app chrome bars with host-fillable slots and brand stripes.

To register only a subset of views, pass a `Views` array of short-names to the provider:

```javascript
this.pict.addProvider('Theme-Section',
	{
		ApplyDefault: 'retold-default',
		Views:        ['Picker', 'ModeToggle', 'ScaleSelect', 'Button']
	}, libPictSectionTheme);
```
