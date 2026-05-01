const DEV = import.meta.env.DEV;

export const RANDOM_BEHAVIOR_CONFIG = {
    /** Minimum delay before idle behavior check fires */
    minIdleDelayMs: DEV ? 2_000 : 20_000,
    /** Maximum delay before idle behavior check fires */
    maxIdleDelayMs: DEV ? 3_000 : 45_000,
    /** Minimum delay between sleeping behavior checks */
    minSleepCheckDelayMs: 30_000,
    /** Maximum delay between sleeping behavior checks */
    maxSleepCheckDelayMs: 60_000,
    /** How long after last user interaction before random behavior is allowed */
    recentInteractionCooldownMs: DEV ? 0 : 15_000,
    /** Minimum idle duration before nap is possible */
    minNapIdleMs: DEV ? 0 : 45_000,
    /** Minimum sleep duration before auto wake-up is possible */
    minSleepBeforeWakeMs: 60_000,
    // ---- Per-behavior cooldowns (prevent back-to-back same behavior) --------
    /** Minimum time between any two random behaviors */
    globalBehaviorCooldownMs: 8_000,
    /** Minimum time between two walk behaviors */
    walkCooldownMs: DEV ? 0 : 20_000,
    /** Minimum time between two happy behaviors */
    happyCooldownMs: DEV ? 0 : 10_000,
    /** Minimum time between two sleep behaviors */
    sleepCooldownMs: DEV ? 0 : 45_000,
};
