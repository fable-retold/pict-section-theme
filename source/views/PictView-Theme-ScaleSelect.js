/**
 * Theme-ScaleSelect — dropdown that picks a viewport scale (zoom).
 *
 * Independent of the active theme bundle: scale is a per-user
 * preference stored alongside ThemeHash + Mode in localStorage. Reads
 * presets from the Theme-Scale helper (or a host-supplied `Presets`
 * array). Subscribes to Theme-Scale.onChange so external scale changes
 * (the persisted boot apply, hotkeys, other code) keep the dropdown's
 * selected option in sync.
 *
 * Drop-in destination: `<div id="Theme-ScaleSelect"></div>`.
 */

const libPictView = require('pict-view');
const libThemeScale = require('../Theme-Scale.js');

const _ViewConfiguration =
{
	ViewIdentifier: 'Theme-ScaleSelect',
	AutoInitialize: true,
	AutoRender: false,

	DefaultDestinationAddress: '#Theme-ScaleSelect',
	DefaultRenderable: 'Theme-ScaleSelect-Renderable',

	// Optional override of the preset list. Each entry: { Value: <number>, Label: <string> }.
	// When omitted we use libThemeScale.PRESETS.
	Presets: null,

	Templates:
	[
		{
			Hash: 'Theme-ScaleSelect-Template',
			Template: /*html*/`
<select class="pict-theme-scaleselect"
        title="{~D:AppData.PictSectionTheme.ScaleSelect.Tooltip~}"
        onchange="_Pict.views['Theme-ScaleSelect'].pickScale(parseFloat(this.value));">
	{~TS:Theme-ScaleSelect-Option-Template:AppData.PictSectionTheme.ScaleSelect.Options~}
</select>`
		},
		{
			Hash: 'Theme-ScaleSelect-Option-Template',
			Template: /*html*/`
<option value="{~D:Record.Value~}"{~NE:Record.Selected^ selected~}>{~D:Record.Label~}</option>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'Theme-ScaleSelect-Renderable',
			TemplateHash: 'Theme-ScaleSelect-Template',
			ContentDestinationAddress: '#Theme-ScaleSelect',
			RenderMethod: 'replace'
		}
	],

	CSS: /*css*/`
.pict-theme-scaleselect {
	min-width: 180px;
	padding: 6px 10px;
	border-radius: 6px;
	font: inherit;
	font-size: 13px;
	background: var(--theme-color-background-secondary, #fbfbfc);
	color: var(--theme-color-text-primary, #1f2933);
	border: 1px solid var(--theme-color-border-default, #cfd5dd);
	cursor: pointer;
}
.pict-theme-scaleselect:focus {
	outline: none;
	border-color: var(--theme-color-brand-primary, #2563eb);
	box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}`,
	CSSPriority: 500
};

class PictViewThemeScaleSelect extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this._unsubscribeFromScale = null;
	}

	onAfterInitialize()
	{
		this._subscribeToScale();
		return super.onAfterInitialize ? super.onAfterInitialize() : undefined;
	}

	onBeforeRender(pRenderable)
	{
		this._refreshAppData();
		return super.onBeforeRender ? super.onBeforeRender(pRenderable) : undefined;
	}

	onAfterRender(pRenderable, pAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();
		return super.onAfterRender
			? super.onAfterRender(pRenderable, pAddress, pRecord, pContent)
			: undefined;
	}

	/**
	 * onchange handler — apply a new scale and let the listener re-render.
	 * @param {number} pScale
	 */
	pickScale(pScale)
	{
		let tmpApplied = libThemeScale.applyScale(pScale);
		if (typeof this.options.OnScaleChange === 'function')
		{
			try { this.options.OnScaleChange(tmpApplied); }
			catch (pErr) { /* host hook failure */ }
		}
		return tmpApplied;
	}

	// ================================================================
	// Internals
	// ================================================================

	_subscribeToScale()
	{
		if (this._unsubscribeFromScale) return;
		let tmpSelf = this;
		this._unsubscribeFromScale = libThemeScale.onChange(function ()
		{
			tmpSelf.render();
		});
	}

	_refreshAppData()
	{
		let tmpPresets = Array.isArray(this.options.Presets) ? this.options.Presets : libThemeScale.PRESETS;
		let tmpActive = libThemeScale.getActive();

		// "Closest" match — the saved scale may be a custom value (e.g.
		// 1.10 from a hotkey nudge) that doesn't exactly equal any preset.
		// We highlight the nearest option so the dropdown still reflects
		// roughly where the user is.
		let tmpClosestIdx = 0;
		let tmpClosestDelta = Infinity;
		for (let i = 0; i < tmpPresets.length; i++)
		{
			let tmpDelta = Math.abs(tmpPresets[i].Value - tmpActive);
			if (tmpDelta < tmpClosestDelta) { tmpClosestDelta = tmpDelta; tmpClosestIdx = i; }
		}

		let tmpOptions = [];
		for (let i = 0; i < tmpPresets.length; i++)
		{
			let tmpEntry = tmpPresets[i];
			tmpOptions.push(
			{
				Value: tmpEntry.Value,
				Label: tmpEntry.Label,
				Selected: (i === tmpClosestIdx)
			});
		}

		let tmpTooltip = 'Viewport scale — currently '
			+ Math.round(tmpActive * 100) + '%';

		this.pict.AppData.PictSectionTheme = this.pict.AppData.PictSectionTheme || {};
		this.pict.AppData.PictSectionTheme.ScaleSelect =
		{
			ActiveScale: tmpActive,
			Tooltip: tmpTooltip,
			Options: tmpOptions
		};
	}
}

PictViewThemeScaleSelect.default_configuration = _ViewConfiguration;

module.exports = PictViewThemeScaleSelect;
