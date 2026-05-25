// Application Code for the Theme playground.
//
// `Base` is the synthesized PictApplication wrapper.  pict-section-theme
// is unusual: its main export is a *provider* (PictSectionThemeProvider)
// that itself registers five views (Theme-Picker, Theme-ModeToggle,
// Theme-ScaleSelect, Theme-Button, Theme-BrandStrip) plus the underlying
// pict-provider-theme runtime under `pict.providers.Theme`.
//
// _playground.json picks `ApplicationGlobal: "PickerView"`, so `Base`
// wraps the Theme-Picker view class and registers it under viewName
// "Picker" at `#Section-Playground-Mount` — but a fresh Picker view
// on its own can't paint anything useful because the theme runtime
// hasn't been wired up yet.  We do that wiring here in onAfterInitialize,
// BEFORE the wrapper's render() pass, so the picker has themes to list.
//
// Bootstrap defaults (ApplyDefault / DefaultMode / DefaultScale) live at
// the top of pict.json so users can flip them in the Pict Config tab.
//
return class extends Base
{
	onAfterInitialize()
	{
		let tmpPictConfig = (this.pict && this.pict.pict_configuration) || {};

		// 1. Register the Theme-Section provider.  This installs the
		//    pict-provider-theme runtime under `pict.providers.Theme`,
		//    registers every theme from the bundled catalog, and adds
		//    the canonical Theme-Picker / Theme-ModeToggle /
		//    Theme-ScaleSelect views (they target `#Theme-Picker` etc.
		//    in the playground topbar so the user can switch themes
		//    while the section is mounted below).
		if (!this.pict.providers['Theme-Section'])
		{
			this.pict.addProvider('Theme-Section',
			{
				ApplyDefault: tmpPictConfig.ApplyDefault || 'pict-default',
				DefaultMode:  tmpPictConfig.DefaultMode  || 'system',
				DefaultScale: (typeof tmpPictConfig.DefaultScale === 'number') ? tmpPictConfig.DefaultScale : 1.0,
				// Disable persistence so the playground always boots
				// from the editor-supplied defaults — otherwise the
				// first user pick would stick across reloads and the
				// "system mode 1.0" starter wouldn't be what they see.
				Persistence: false,
				Views: ['Picker', 'ModeToggle', 'ScaleSelect']
			}, window.PictSectionTheme);
		}

		// 2. Let the wrapper run its render() on our "Picker" view —
		//    now that providers.Theme exists, the picker can enumerate
		//    themes and paint correctly.
		super.onAfterInitialize();

		// 3. Render the playground topbar's Theme controls.  The
		//    docuserve iframe template ships #Theme-Picker /
		//    #Theme-ModeToggle / #Theme-ScaleSelect divs in its topbar;
		//    normally the section-playground bootstrap auto-mounts them
		//    once Theme-Section has been registered, but we registered
		//    it ourselves so we own the render call too.
		try { this.pict.views['Theme-Picker'].render(); }      catch (pErr) { /* topbar mount is best-effort */ }
		try { this.pict.views['Theme-ModeToggle'].render(); }  catch (pErr) { /* topbar mount is best-effort */ }
		try { this.pict.views['Theme-ScaleSelect'].render(); } catch (pErr) { /* topbar mount is best-effort */ }
	}
};
