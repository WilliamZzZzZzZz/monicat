/**
 * Pure, side-effect-free policy functions extracted from useRandomBehavior.
 * Testable without React hooks or timers.
 */
import type { PetState } from '../types/pet';
import type { BehaviorFrequency } from '../types/ipc';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RandomBehaviorGuards {
    randomBehaviorEnabled: boolean;
    isWindowVisible: boolean;
    isSettingsPanelOpen: boolean;
    petState: PetState;
    nowMs: number;
    lastInteractionAtMs: number;
    manualActionCooldownUntilMs: number;
    recentInteractionCooldownMs: number;
}

export type RandomBehaviorCandidate =
    | 'happy'
    | 'grooming'
    | 'walk_right'
    | 'walk_left'
    | 'sleeping'
    | 'wakeUp';

export interface BehaviorWeights {
    happyChance: number;
    groomingChance: number;
    walkRightChance: number;
    walkLeftChance: number;
    napChance: number;
    wakeUpChance: number;
}

export interface IdleCooldowns {
    lastAnyBehaviorAt: number;
    lastWalkAt: number;
    lastHappyAt: number;
    lastGroomingAt: number;
    lastSleepAt: number;
    globalBehaviorCooldownMs: number;
    walkCooldownMs: number;
    happyCooldownMs: number;
    groomingCooldownMs: number;
    sleepCooldownMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard: can random behavior be scheduled at all?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the random behavior scheduler is allowed to fire.
 * This consolidates all the guard conditions from useRandomBehavior into
 * a single testable predicate.
 */
export function canRunRandomBehavior(guards: RandomBehaviorGuards): boolean {
    if (!guards.randomBehaviorEnabled) return false;
    if (!guards.isWindowVisible) return false;
    if (guards.isSettingsPanelOpen) return false;

    // Only schedulable from idle or sleeping
    if (guards.petState !== 'idle' && guards.petState !== 'sleeping') return false;

    // Manual action cooldown
    if (guards.nowMs < guards.manualActionCooldownUntilMs) return false;

    // Recent user interaction
    if (guards.nowMs - guards.lastInteractionAtMs < guards.recentInteractionCooldownMs) return false;

    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Idle behavior selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select a random behavior for the idle state.
 *
 * Returns `null` when:
 * - The per-behavior cooldown is not yet expired.
 * - `autoWalkEnabled` is false and walking was the rolled behavior.
 * - The global cooldown is not yet expired.
 *
 * @param nowMs            - Current timestamp (ms)
 * @param autoWalkEnabled  - Whether automatic walking is allowed
 * @param weights          - Probability weights for each behavior
 * @param cooldowns        - Per-behavior cooldown timestamps
 * @param roll             - Pre-computed random number [0, 1). Defaults to Math.random().
 */
export function selectIdleBehavior(
    nowMs: number,
    autoWalkEnabled: boolean,
    weights: BehaviorWeights,
    cooldowns: IdleCooldowns,
    roll = Math.random(),
): RandomBehaviorCandidate | null {
    if (nowMs - cooldowns.lastAnyBehaviorAt < cooldowns.globalBehaviorCooldownMs) return null;

    let threshold = weights.happyChance;
    if (roll < threshold) {
        if (nowMs - cooldowns.lastHappyAt < cooldowns.happyCooldownMs) return null;
        return 'happy';
    }

    threshold += weights.groomingChance;
    if (roll < threshold) {
        if (nowMs - cooldowns.lastGroomingAt < cooldowns.groomingCooldownMs) return null;
        return 'grooming';
    }

    threshold += weights.walkRightChance;
    if (roll < threshold) {
        if (!autoWalkEnabled) return null;
        if (nowMs - cooldowns.lastWalkAt < cooldowns.walkCooldownMs) return null;
        return 'walk_right';
    }

    threshold += weights.walkLeftChance;
    if (roll < threshold) {
        if (!autoWalkEnabled) return null;
        if (nowMs - cooldowns.lastWalkAt < cooldowns.walkCooldownMs) return null;
        return 'walk_left';
    }

    threshold += weights.napChance;
    if (roll < threshold) {
        if (nowMs - cooldowns.lastSleepAt < cooldowns.sleepCooldownMs) return null;
        return 'sleeping';
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sleeping behavior selection
// ─────────────────────────────────────────────────────────────────────────────

export interface SleepingSelectionParams {
    nowMs: number;
    enteredStateAtMs: number;
    minSleepBeforeWakeMs: number;
    wakeUpChance: number;
    cooldowns: Pick<IdleCooldowns, 'lastAnyBehaviorAt' | 'globalBehaviorCooldownMs'>;
    roll?: number;
}

/**
 * Select a behavior for the sleeping state.
 * Returns 'wakeUp' when conditions are met, otherwise null.
 */
export function selectSleepingBehavior(params: SleepingSelectionParams): 'wakeUp' | null {
    const {
        nowMs,
        enteredStateAtMs,
        minSleepBeforeWakeMs,
        wakeUpChance,
        cooldowns,
        roll = Math.random(),
    } = params;

    if (nowMs - cooldowns.lastAnyBehaviorAt < cooldowns.globalBehaviorCooldownMs) return null;
    if (nowMs - enteredStateAtMs < minSleepBeforeWakeMs) return null;
    if (roll < wakeUpChance) return 'wakeUp';

    return null;
}
