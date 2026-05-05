import { describe, it, expect } from 'vitest';
import { PET_ACTIONS, isLocomotionState } from './actionRegistry';
import type { PetState } from '../types/pet';

const ALL_STATES: PetState[] = [
    'idle',
    'dragging',
    'happy',
    'sleeping',
    'walk_right',
    'walk_left',
    'grooming',
];

// ─────────────────────────────────────────────────────────────────────────────
// Registry completeness
// ─────────────────────────────────────────────────────────────────────────────
describe('PET_ACTIONS registry completeness', () => {
    it('has a definition for every PetState', () => {
        for (const state of ALL_STATES) {
            expect(PET_ACTIONS[state], `missing definition for state: ${state}`).toBeDefined();
        }
    });

    it('each definition\'s .state field matches its key', () => {
        for (const state of ALL_STATES) {
            expect(PET_ACTIONS[state].state).toBe(state);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ActionKind classifications
// ─────────────────────────────────────────────────────────────────────────────
describe('ActionKind classifications', () => {
    it('idle is persistent', () => {
        expect(PET_ACTIONS.idle.kind).toBe('persistent');
    });

    it('sleeping is persistent', () => {
        expect(PET_ACTIONS.sleeping.kind).toBe('persistent');
    });

    it('happy is oneShot', () => {
        expect(PET_ACTIONS.happy.kind).toBe('oneShot');
    });

    it('grooming is oneShot', () => {
        expect(PET_ACTIONS.grooming.kind).toBe('oneShot');
    });

    it('walk_left is locomotion', () => {
        expect(PET_ACTIONS.walk_left.kind).toBe('locomotion');
    });

    it('walk_right is locomotion', () => {
        expect(PET_ACTIONS.walk_right.kind).toBe('locomotion');
    });

    it('dragging is interactionOverride', () => {
        expect(PET_ACTIONS.dragging.kind).toBe('interactionOverride');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// oneShot contract
// ─────────────────────────────────────────────────────────────────────────────
describe('oneShot action contract', () => {
    const oneShotStates = ALL_STATES.filter((s) => PET_ACTIONS[s].kind === 'oneShot');

    it('every oneShot action has a defaultDurationMs', () => {
        for (const state of oneShotStates) {
            expect(
                PET_ACTIONS[state].defaultDurationMs,
                `${state} is missing defaultDurationMs`,
            ).toBeTypeOf('number');
        }
    });

    it('every oneShot action has a returnState', () => {
        for (const state of oneShotStates) {
            expect(
                PET_ACTIONS[state].returnState,
                `${state} is missing returnState`,
            ).toBeDefined();
        }
    });

    it('oneShot defaultDurationMs is positive', () => {
        for (const state of oneShotStates) {
            expect(PET_ACTIONS[state].defaultDurationMs).toBeGreaterThan(0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// locomotion contract
// ─────────────────────────────────────────────────────────────────────────────
describe('locomotion action contract', () => {
    const locomotionStates = ALL_STATES.filter((s) => PET_ACTIONS[s].kind === 'locomotion');

    it('locomotion states are walk_left and walk_right', () => {
        expect(new Set(locomotionStates)).toEqual(new Set(['walk_left', 'walk_right']));
    });

    it('locomotion actions do not have a oneShot defaultDurationMs timer', () => {
        // Locomotion uses RAF-based movement, not a fixed timer.
        // They intentionally do not have defaultDurationMs.
        for (const state of locomotionStates) {
            expect(
                PET_ACTIONS[state].defaultDurationMs,
                `${state} should not have defaultDurationMs`,
            ).toBeUndefined();
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Random trigger policy
// ─────────────────────────────────────────────────────────────────────────────
describe('random trigger policy', () => {
    it('dragging cannot be triggered randomly', () => {
        expect(PET_ACTIONS.dragging.canBeTriggeredRandomly).toBe(false);
    });

    it('idle, sleeping, happy, grooming, walk_right, walk_left can be triggered randomly', () => {
        const randomable: PetState[] = ['idle', 'sleeping', 'happy', 'grooming', 'walk_right', 'walk_left'];
        for (const state of randomable) {
            expect(
                PET_ACTIONS[state].canBeTriggeredRandomly,
                `expected ${state} to be randomly triggerable`,
            ).toBe(true);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// blocksRandomBehavior
// ─────────────────────────────────────────────────────────────────────────────
describe('blocksRandomBehavior', () => {
    it('idle does not block random behavior', () => {
        expect(PET_ACTIONS.idle.blocksRandomBehavior).toBe(false);
    });

    it('dragging blocks random behavior', () => {
        expect(PET_ACTIONS.dragging.blocksRandomBehavior).toBe(true);
    });

    it('oneShot and locomotion states block random behavior', () => {
        const blocking: PetState[] = ['happy', 'grooming', 'walk_right', 'walk_left'];
        for (const state of blocking) {
            expect(
                PET_ACTIONS[state].blocksRandomBehavior,
                `expected ${state} to block random behavior`,
            ).toBe(true);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// isLocomotionState helper
// ─────────────────────────────────────────────────────────────────────────────
describe('isLocomotionState', () => {
    it('returns true for walk_left', () => {
        expect(isLocomotionState('walk_left')).toBe(true);
    });

    it('returns true for walk_right', () => {
        expect(isLocomotionState('walk_right')).toBe(true);
    });

    it('returns false for non-locomotion states', () => {
        const nonLoco: PetState[] = ['idle', 'dragging', 'happy', 'sleeping', 'grooming'];
        for (const state of nonLoco) {
            expect(isLocomotionState(state)).toBe(false);
        }
    });
});
