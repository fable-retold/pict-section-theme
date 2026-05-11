/**
 * Theme Registry — runtime registry of every theme available to
 * pict-section-theme.
 *
 * Bundled "starter set" themes are pre-registered at module load time
 * via static `require()` so browserify can resolve and inline each JSON
 * at bundle time. Beyond the starter set, consumers can register
 * additional theme bundles at runtime — useful for:
 *
 *   - Loading themes the host app authored (e.g. an app's own brand
 *     palette that isn't shipped with this module).
 *   - Pulling themes from a remote "theme garden" via
 *     `registerFromURL()` (CDN-hosted curated bundles).
 *   - Tooling / playgrounds that mutate the registry as the user
 *     iterates.
 *
 * Module exports a singleton instance, so all consumers operate on the
 * same set. Use `register({Hash, Bundle, Category, IsDefault})` to add
 * themes, `list()` to enumerate them, `get(hash)` for direct lookup,
 * `unregister(hash)` to remove.
 *
 * Each entry shape:
 *
 *   {
 *     Hash:       <string>      // matches bundle.Hash; used by the picker
 *     Bundle:     <object>      // theme JSON, ready for provider.registerTheme()
 *     Category:   <string>      // grouping label for the picker UI
 *     IsDefault:  <bool?>       // true for the canonical ecosystem default
 *     Source:     <string?>     // 'starter' | URL | host-supplied tag
 *   }
 *
 * Backwards-compat:
 *   - The instance is iterable (Symbol.iterator), exposes `.length`,
 *     and supports numeric indexing `[i]` so legacy code that treated
 *     the catalog as an array continues to work without changes.
 */
'use strict';

class ThemeRegistry
{
	constructor()
	{
		this._themes = new Map();      // Hash → entry, insertion-ordered
		this._loadStarterSet();
	}

	// ── Bundled starter set ──────────────────────────────────────────────
	// Each `require()` is a literal string so browserify inlines the JSON
	// at build time. Adding a new bundled theme: drop the JSON in this
	// folder and append a row here. Runtime additions go via register()
	// from anywhere else in the codebase.
	_loadStarterSet()
	{
		const STARTER =
		[
			// Retold ecosystem defaults
			{ Hash: 'retold-default',     Category: 'Default',  IsDefault: true,  Bundle: require('./retold-default.json') },
			{ Hash: 'retold-mono',        Category: 'Default',  Bundle: require('./retold-mono.json') },

			// App-extracted themes (named after their host app)
			{ Hash: 'retold-manager',         Category: 'App',  Bundle: require('./retold-manager.json') },
			{ Hash: 'retold-content-system',  Category: 'App',  Bundle: require('./retold-content-system.json') },

			// Playground / starter paired themes (have light/dark)
			{ Hash: 'playground-corp',    Category: 'Paired',   Bundle: require('./playground-corp.json') },
			{ Hash: 'playground-starter', Category: 'Paired',   Bundle: require('./playground-starter.json') },

			// Greys (low-light single-mode themes)
			{ Hash: 'twilight',           Category: 'Grey',     Bundle: require('./twilight.json') },
			{ Hash: 'night',              Category: 'Grey',     Bundle: require('./night.json') },
			{ Hash: 'evening',            Category: 'Grey',     Bundle: require('./evening.json') },
			{ Hash: 'afternoon',          Category: 'Grey',     Bundle: require('./afternoon.json') },
			{ Hash: 'daylight',           Category: 'Grey',     Bundle: require('./daylight.json') },

			// Fun / period palettes
			{ Hash: 'cyberpunk',          Category: 'Fun',      Bundle: require('./cyberpunk.json') },
			{ Hash: 'synthwave',          Category: 'Fun',      Bundle: require('./synthwave.json') },
			{ Hash: 'neo-tokyo',          Category: 'Fun',      Bundle: require('./neo-tokyo.json') },
			{ Hash: 'solarized-dark',     Category: 'Fun',      Bundle: require('./solarized-dark.json') },
			{ Hash: 'forest',             Category: 'Fun',      Bundle: require('./forest.json') },
			{ Hash: 'hotdog',             Category: 'Fun',      Bundle: require('./hotdog.json') },
			{ Hash: '1970s-console',      Category: 'Fun',      Bundle: require('./1970s-console.json') },
			{ Hash: '1980s-console',      Category: 'Fun',      Bundle: require('./1980s-console.json') },
			{ Hash: '1990s-website',      Category: 'Fun',      Bundle: require('./1990s-website.json') },
			{ Hash: 'early-2000s',        Category: 'Fun',      Bundle: require('./early-2000s.json') },

			// Diagnostics / utility
			{ Hash: 'mobile-debug',       Category: 'Debug',    Bundle: require('./mobile-debug.json') }
		];

		for (let i = 0; i < STARTER.length; i++)
		{
			let tmpEntry = Object.assign({}, STARTER[i], { Source: STARTER[i].Source || 'starter' });
			this._themes.set(tmpEntry.Hash, tmpEntry);
		}
	}

	// ── Public API ───────────────────────────────────────────────────────

	/**
	 * Register a theme. Re-registering an existing hash overwrites cleanly.
	 *
	 * @param {{Hash, Bundle, Category?, IsDefault?, Source?}} pEntry
	 * @returns {object} the stored entry
	 */
	register(pEntry)
	{
		if (!pEntry || typeof pEntry !== 'object')
		{
			throw new Error('ThemeRegistry.register: entry must be an object');
		}
		if (typeof pEntry.Hash !== 'string' || pEntry.Hash.length === 0)
		{
			throw new Error('ThemeRegistry.register: entry.Hash is required');
		}
		if (!pEntry.Bundle || typeof pEntry.Bundle !== 'object')
		{
			throw new Error('ThemeRegistry.register: entry.Bundle is required');
		}
		let tmpStored = Object.assign({ Source: 'host' }, pEntry);
		this._themes.set(pEntry.Hash, tmpStored);
		return tmpStored;
	}

	/**
	 * Remove a theme by hash. Returns true if anything was removed.
	 * @param {string} pHash
	 * @returns {boolean}
	 */
	unregister(pHash)
	{
		return this._themes.delete(pHash);
	}

	/**
	 * Look up a single theme entry by hash.
	 * @param {string} pHash
	 * @returns {object|undefined}
	 */
	get(pHash)
	{
		return this._themes.get(pHash);
	}

	has(pHash)
	{
		return this._themes.has(pHash);
	}

	/**
	 * Snapshot of every registered entry, in registration order.
	 * @returns {Array<object>}
	 */
	list()
	{
		return Array.from(this._themes.values());
	}

	/**
	 * Drop every registered entry. Mostly useful in tests; production
	 * consumers should prefer `unregister()` per hash.
	 */
	clear()
	{
		this._themes.clear();
	}

	/**
	 * Re-load the bundled starter set. No-op if the starter set is
	 * already registered (re-registering replaces, so this is safe to
	 * call any time).
	 */
	loadStarterSet()
	{
		this._loadStarterSet();
	}

	/**
	 * Number of registered themes.
	 * @returns {number}
	 */
	get count()
	{
		return this._themes.size;
	}

	/**
	 * Async fetch + register from a URL. Used by the future "online theme
	 * garden" — the URL must serve a JSON bundle compatible with
	 * pict-provider-theme's `registerTheme()` shape.
	 *
	 * @param {string} pURL
	 * @param {{Category?, IsDefault?, Hash?}} [pMetadata] - override metadata
	 * @returns {Promise<object>} the registered entry
	 */
	async registerFromURL(pURL, pMetadata)
	{
		if (typeof fetch !== 'function')
		{
			throw new Error('ThemeRegistry.registerFromURL: fetch is not available in this environment');
		}
		let tmpResponse = await fetch(pURL);
		if (!tmpResponse.ok)
		{
			throw new Error('ThemeRegistry.registerFromURL: HTTP ' + tmpResponse.status + ' for ' + pURL);
		}
		let tmpBundle = await tmpResponse.json();
		if (!tmpBundle || typeof tmpBundle !== 'object' || typeof tmpBundle.Hash !== 'string')
		{
			throw new Error('ThemeRegistry.registerFromURL: payload missing Hash');
		}
		let tmpMeta = pMetadata || {};
		return this.register(
		{
			Hash: tmpMeta.Hash || tmpBundle.Hash,
			Bundle: tmpBundle,
			Category: tmpMeta.Category || 'Garden',
			IsDefault: !!tmpMeta.IsDefault,
			Source: pURL
		});
	}

	// ── Array-like compatibility ─────────────────────────────────────────
	// Older code iterated the catalog as an array (`for (let i = 0; i <
	// CATALOG.length; i++) ... CATALOG[i]`). Preserve those usages without
	// requiring a refactor: the iterator + length + numeric proxy give
	// `Array.isArray(registry)` returns false, but everything that reads
	// keeps working. New code should prefer `list()` / `get()`.

	get length()
	{
		return this._themes.size;
	}

	[Symbol.iterator]()
	{
		return this._themes.values();
	}
}

// Singleton — every consumer gets the same registry.
const _Registry = new ThemeRegistry();

// Numeric-index proxy: `registry[0]` returns the first entry, matching
// the legacy "catalog as array" shape. Wraps the singleton so existing
// `tmpEntry = _CATALOG[i]` loops keep working.
const _IndexedRegistry = new Proxy(_Registry,
{
	get(pTarget, pProp, pReceiver)
	{
		if (typeof pProp === 'string' && /^\d+$/.test(pProp))
		{
			let tmpIdx = parseInt(pProp, 10);
			let tmpList = pTarget.list();
			return tmpList[tmpIdx];
		}
		return Reflect.get(pTarget, pProp, pReceiver);
	},
	has(pTarget, pProp)
	{
		if (typeof pProp === 'string' && /^\d+$/.test(pProp))
		{
			return parseInt(pProp, 10) < pTarget.length;
		}
		return Reflect.has(pTarget, pProp);
	}
});

module.exports = _IndexedRegistry;
module.exports.ThemeRegistry = ThemeRegistry;
