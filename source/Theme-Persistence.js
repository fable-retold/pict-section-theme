/**
 * Theme-Persistence — reads and writes the user's selected theme + mode
 * to the browser's localStorage so a reload restores the same look.
 *
 * pict-provider-theme is intentionally stateless — host applications
 * decide what to apply at boot. This module is the small, opt-out-able
 * layer that pict-section-theme.install() uses to make "remember my
 * theme" the default behaviour without forcing every consumer to wire
 * it themselves.
 *
 * # Storage shape
 *
 * Every entry is a single JSON object under one key:
 *
 *   localStorage["pict-section-theme:<scope>"] =
 *     {
 *       Version:   1,
 *       ThemeHash: "retold-manager",
 *       Mode:      "dark",
 *       Scale:     1.25,
 *       SavedAt:   "2026-05-09T21:00:00.000Z"
 *     }
 *
 * Version-tagged so future schema changes can be migrated cleanly;
 * mismatched versions are treated as "no saved entry" and the host
 * application's defaults take over. Older entries that pre-date the
 * Scale field are still valid — Scale is optional and load() returns
 * null for it when absent (caller defaults to 1.0).
 *
 * # Scope (the <scope> portion of the key)
 *
 * Determined in this priority order:
 *   1. The string the host passed in (`PersistenceKey: 'my-app'`) —
 *      use this when one host serves multiple logical apps from the
 *      same origin and they shouldn't share theme state.
 *   2. window.location.hostname when running in a browser.
 *   3. The literal 'default' as a last-ditch fallback (Node, sandbox,
 *      mid-SSR, etc.).
 *
 * # Failure modes
 *
 * - localStorage missing (SSR, Safari private mode, blocked) →
 *   load() returns null, save() returns false, no exception.
 * - Quota exceeded → save() returns false silently; the in-memory
 *   active theme is unaffected.
 * - JSON parse error or version mismatch → load() returns null so the
 *   caller falls back to ApplyDefault.
 *
 * Nothing here throws — persistence failures must NEVER crash the host
 * application's boot path.
 */

const STORAGE_PREFIX = 'pict-section-theme:';
const SCHEMA_VERSION = 1;

function _getStorage()
{
	try
	{
		if (typeof window !== 'undefined' && window.localStorage)
		{
			return window.localStorage;
		}
	}
	catch (pErr) { /* SecurityError in some contexts */ }
	return null;
}

function _autoScope()
{
	try
	{
		if (typeof window !== 'undefined' && window.location && window.location.hostname)
		{
			return window.location.hostname;
		}
	}
	catch (pErr) { /* fall through */ }
	return 'default';
}

/**
 * Resolve the full localStorage key for this app's theme state.
 *
 * @param {string|null} pUserKey - Host-supplied scope override; falsy
 *   values trigger the auto-scope fallback (hostname → 'default').
 * @returns {string} the fully-qualified localStorage key.
 */
function resolveKey(pUserKey)
{
	let tmpScope = (typeof pUserKey === 'string' && pUserKey.length > 0)
		? pUserKey
		: _autoScope();
	return STORAGE_PREFIX + tmpScope;
}

/**
 * Read the saved theme state for a key.  Returns null if nothing is
 * stored, the storage is unavailable, or the entry's schema version
 * doesn't match.
 *
 * @param {string} pKey - the resolved storage key
 * @returns {{ThemeHash: string, Mode: string|null, Scale: number|null}|null}
 */
function load(pKey)
{
	let tmpStore = _getStorage();
	if (!tmpStore) return null;

	let tmpRaw;
	try { tmpRaw = tmpStore.getItem(pKey); }
	catch (pErr) { return null; }
	if (!tmpRaw) return null;

	let tmpParsed;
	try { tmpParsed = JSON.parse(tmpRaw); }
	catch (pErr) { return null; }

	if (!tmpParsed || typeof tmpParsed !== 'object') return null;
	if (tmpParsed.Version !== SCHEMA_VERSION) return null;
	if (typeof tmpParsed.ThemeHash !== 'string' || tmpParsed.ThemeHash.length === 0) return null;

	let tmpScale = null;
	if (typeof tmpParsed.Scale === 'number' && isFinite(tmpParsed.Scale) && tmpParsed.Scale > 0)
	{
		tmpScale = tmpParsed.Scale;
	}

	return {
		ThemeHash: tmpParsed.ThemeHash,
		Mode:      (typeof tmpParsed.Mode === 'string' && tmpParsed.Mode.length > 0)
			? tmpParsed.Mode
			: null,
		Scale:     tmpScale
	};
}

/**
 * Persist the active theme + mode for this key.  No-ops gracefully
 * when storage is unavailable or quota is exceeded.
 *
 * @param {string} pKey
 * @param {{ThemeHash: string, Mode?: string, Scale?: number}} pState
 * @returns {boolean} true on success, false otherwise
 */
function save(pKey, pState)
{
	let tmpStore = _getStorage();
	if (!tmpStore) return false;
	if (!pState || typeof pState.ThemeHash !== 'string' || pState.ThemeHash.length === 0) return false;

	let tmpEntry =
	{
		Version:   SCHEMA_VERSION,
		ThemeHash: pState.ThemeHash,
		Mode:      (typeof pState.Mode === 'string' && pState.Mode.length > 0) ? pState.Mode : null,
		Scale:     (typeof pState.Scale === 'number' && isFinite(pState.Scale) && pState.Scale > 0)
			? pState.Scale
			: null,
		SavedAt:   new Date().toISOString()
	};

	try { tmpStore.setItem(pKey, JSON.stringify(tmpEntry)); return true; }
	catch (pErr) { return false; }
}

/**
 * Remove the saved theme state for a key.  Useful for "reset to
 * defaults" actions.
 */
function clear(pKey)
{
	let tmpStore = _getStorage();
	if (!tmpStore) return false;
	try { tmpStore.removeItem(pKey); return true; }
	catch (pErr) { return false; }
}

module.exports =
{
	resolveKey: resolveKey,
	load:       load,
	save:       save,
	clear:      clear,
	STORAGE_PREFIX: STORAGE_PREFIX,
	SCHEMA_VERSION: SCHEMA_VERSION
};
