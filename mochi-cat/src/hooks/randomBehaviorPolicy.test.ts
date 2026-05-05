import { describe, it, expect } from 'vitest';
import {
    canRunRandomBehavior,
    selectIdleBehavior,
    selectSleepingBehavior,
    type RandomBehaviorGuards,
    type BehaviorWeights,
    type IdleCooldowns,
} from './randomBehaviorPolicy';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers / fixtures
// ─────────────────────────────────────────────────────────────────────────────
const NOW = 1_000_000;

const BASE_GUARDS: RandomBehaviorGuards = {
    randomBehaviorEnabled: true,
    isWindowVisible: true,
    isSettingsPanelOpen: false,
    petState: 'idle',
    nowMs: NOW,
    lastInteractionAtMs: 0,
    manualActionCooldownUntilMs: 0,
    recentInteractionCooldownMs: 0,
};

const EQUAL_WEIGHTS: BehaviorWeights = {
    happyChance: 0.25,
    groomingChance: 0.25,
    walkRightChance: 0.25,
    walkLeftChance: 0.25,
    napChance: 0.0,
    wakeUpChance: 0.5,
};

const ZERO_COOLDOWNS: IdleCooldowns = {
    lastAnyBehaviorAt: 0,
    lastWalkAt: 0,
    lastHappyAt: 0,
    lastGroomingAt: 0,
    lastSleepAt: 0,
    globalBehaviorCooldownMs: 0,
    walkCooldownMs: 0,
    happyCooldownMs: 0,
    groomingCooldownMs: 0,
    sleepCooldownMs: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// canRunRandomBehavior
// ─────────────────────────────────────────────────────────────────────────────
describe('canRunRandomBehavior', () => {
    it('returns true when all conditions are met', () => {
        expect(canRunRandomBehavior(BASE_GUARDS)).toBe(true);
    });

    it('returns false when randomBehaviorEnabled is false', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, randomBehaviorEnabled: false })).toBe(false);
    });

    it('returns false when window is not visible', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, isWindowVisible: false })).toBe(false);
    });

    it('returns false when settings panel is open', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, isSettingsPanelOpen: true })).toBe(false);
    });

    it('returns false when petState is happy (oneShot)', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, petState: 'happy' })).toBe(false);
    });

    it('returns false when petState is grooming (oneShot)', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, petState: 'grooming' })).toBe(false);
    });

    it('returns false when petState is walk_right (locomotion)', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, petState: 'walk_right' })).toBe(false);
    });

    it('returns false when petState is walk_left (locomotion)', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, petState: 'walk_left' })).toBe(false);
    });

    it('returns false when petState is dragging (interactionOverride)', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, petState: 'dragging' })).toBe(false);
    });

    it('returns true for sleeping state (sleeping can trigger wakeUp)', () => {
        expect(canRunRandomBehavior({ ...BASE_GUARDS, petState: 'sleeping' })).toBe(true);
    });

    it('returns false when manual action cooldown is active', () => {
        expect(
            canRunRandomBehavior({
                ...BASE_GUARDS,
                manualActionCooldownUntilMs: NOW + 1_000,
            }),
        ).toBe(false);
    });

    it('returns false when recent interaction cooldown is active', () => {
        expect(
            canRunRandomBehavior({
                ...BASE_GUARDS,
                lastInteractionAtMs: NOW - 100,
                recentInteractionCooldownMs: 1_000,
            }),
        ).toBe(false);
    });

    it('returns true when interaction was long enough ago', () => {
        expect(
            canRunRandomBehavior({
                ...BASE_GUARDS,
                lastInteractionAtMs: NOW - 2_000,
                recentInteractionCooldownMs: 1_000,
            }),
        ).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectIdleBehavior
// ─────────────────────────────────────────────────────────────────────────────
describe('selectIdleBehavior', () => {
    it('returns happy when roll < happyChance', () => {
        const result = selectIdleBehavior(NOW, true, EQUAL_WEIGHTS, ZERO_COOLDOWNS, 0.1);
        expect(result).toBe('happy');
    });

    it('returns grooming when roll is in grooming range', () => {
        // roll in [0.25, 0.50)
        const result = selectIdleBehavior(NOW, true, EQUAL_WEIGHTS, ZERO_COOLDOWNS, 0.35);
        expect(result).toBe('grooming');
    });

    it('returns walk_right when roll is in walk_right range', () => {
        // roll in [0.50, 0.75)
        const result = selectIdleBehavior(NOW, true, EQUAL_WEIGHTS, ZERO_COOLDOWNS, 0.6);
        expect(result).toBe('walk_right');
    });

    it('returns walk_left when roll is in walk_left range', () => {
        // roll in [0.75, 1.00) — napChance is 0 so it falls through to walk_left
        const result = selectIdleBehavior(NOW, true, EQUAL_WEIGHTS, ZERO_COOLDOWNS, 0.85);
        expect(result).toBe('walk_left');
    });

    it('returns null for walk_right when autoWalkEnabled is false', () => {
        const result = selectIdleBehavior(NOW, false, EQUAL_WEIGHTS, ZERO_COOLDOWNS, 0.6);
        expect(result).toBeNull();
    });

    it('returns null for walk_left when autoWalkEnabled is false', () => {
        const result = selectIdleBehavior(NOW, false, EQUAL_WEIGHTS, ZERO_COOLDOWNS, 0.85);
        expect(result).toBeNull();
    });

    it('autoWalkEnabled=false does not affect happy', () => {
        const result = selectIdleBehavior(NOW, false, EQUAL_WEIGHTS, ZERO_COOLDOWNS, 0.1);
        expect(result).toBe('happy');
    });

    it('autoWalkEnabled=false does not affect grooming', () => {
        const result = selectIdleBehavior(NOW, false, EQUAL_WEIGHTS, ZERO_COOLDOWNS, 0.35);
        expect(result).toBe('grooming');
    });

    it('returns null when global cooldown is still active', () => {
        const recentCooldowns: IdleCooldowns = {
            ...ZERO_COOLDOWNS,
            lastAnyBehaviorAt: NOW - 100,
            globalBehaviorCooldownMs: 1_000,
        };
        const result = selectIdleBehavior(NOW, true, EQUAL_WEIGHTS, recentCooldowns, 0.1);
        expect(result).toBeNull();
    });

    it('returns null when happy per-behavior cooldown is still active', () => {
        const cooldowns: IdleCooldowns = {
            ...ZERO_COOLDOWNS,
            lastHappyAt: NOW - 100,
            happyCooldownMs: 1_000,
        };
        const result = selectIdleBehavior(NOW, true, EQUAL_WEIGHTS, cooldowns, 0.1);
        expect(result).toBeNull();
    });

    it('returns null when grooming per-behavior cooldown is still active', () => {
        const cooldowns: IdleCooldowns = {
            ...ZERO_COOLDOWNS,
            lastGroomingAt: NOW - 100,
            groomingCooldownMs: 1_000,
        };
        const result = selectIdleBehavior(NOW, true, EQUAL_WEIGHTS, cooldowns, 0.35);
        expect(result).toBeNull();
    });

    it('returns null when walk cooldown is still active', () => {
        const cooldowns: IdleCooldowns = {
            ...ZERO_COOLDOWNS,
            lastWalkAt: NOW - 100,
            walkCooldownMs: 1_000,
        };
        const result = selectIdleBehavior(NOW, true, EQUAL_WEIGHTS, cooldowns, 0.6);
        expect(result).toBeNull();
    });

    it('returns sleeping when roll is in nap range', () => {
        const napWeights: BehaviorWeights = {
            ...EQUAL_WEIGHTS,
            walkLeftChance: 0,
            walkRightChance: 0,
            napChance: 0.5,
        };
        // roll in [0.50, 1.00)
        const result = selectIdleBehavior(NOW, true, napWeights, ZERO_COOLDOWNS, 0.75);
        expect(result).toBe('sleeping');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectSleepingBehavior
// ─────────────────────────────────────────────────────────────────────────────
describe('selectSleepingBehavior', () => {
    it('returns wakeUp when conditions are met', () => {
        const result = selectSleepingBehavior({
            nowMs: NOW,
            enteredStateAtMs: 0,
            minSleepBeforeWakeMs: 0,
            wakeUpChance: 1.0,
            cooldowns: { lastAnyBehaviorAt: 0, globalBehaviorCooldownMs: 0 },
        });
        expect(result).toBe('wakeUp');
    });

    it('returns null when pet has not slept long enough', () => {
        const result = selectSleepingBehavior({
            nowMs: NOW,
            enteredStateAtMs: NOW - 100,
            minSleepBeforeWakeMs: 10_000,
            wakeUpChance: 1.0,
            cooldowns: { lastAnyBehaviorAt: 0, globalBehaviorCooldownMs: 0 },
        });
        expect(result).toBeNull();
    });

    it('returns null when global cooldown is active', () => {
        const result = selectSleepingBehavior({
            nowMs: NOW,
            enteredStateAtMs: 0,
            minSleepBeforeWakeMs: 0,
            wakeUpChance: 1.0,
            cooldowns: { lastAnyBehaviorAt: NOW - 100, globalBehaviorCooldownMs: 1_000 },
        });
        expect(result).toBeNull();
    });

    it('returns null when roll >= wakeUpChance', () => {
        const result = selectSleepingBehavior({
            nowMs: NOW,
            enteredStateAtMs: 0,
            minSleepBeforeWakeMs: 0,
            wakeUpChance: 0.3,
            cooldowns: { lastAnyBehaviorAt: 0, globalBehaviorCooldownMs: 0 },
            roll: 0.9,
        });
        expect(result).toBeNull();
    });
});
