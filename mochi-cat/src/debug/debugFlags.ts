/**
 * Development-only debug flags.
 * Set any flag to `import.meta.env.DEV && true` to enable logging.
 * All flags default to false so production builds are never spammed.
 */

/** Log pointer interaction events (pointerdown, drag confirm, pointerup, blur cancel) */
export const DEBUG_INTERACTION = import.meta.env.DEV && false;

/** Log walking movement start, bounds, and completion */
export const DEBUG_WALKING = import.meta.env.DEV && false;

/** Log random behavior scheduling, cooldown skips, and chosen actions */
export const DEBUG_RANDOM = import.meta.env.DEV && false;

/**
 * @deprecated Superseded by DEBUG_ACTIONS which covers the unified action
 * dispatcher introduced in Phase 14. Kept for backward compatibility with
 * any external tooling that may reference this flag.
 */
export const DEBUG_STATE_MACHINE = import.meta.env.DEV && false;

/** Log unified action dispatcher requests, accepts, rejects, and transitions */
export const DEBUG_ACTIONS = import.meta.env.DEV && false;

/** Log one-shot and inactivity timer scheduling / stale skips */
export const DEBUG_TIMERS = import.meta.env.DEV && false;
