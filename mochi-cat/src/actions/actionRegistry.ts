import { animationConfig } from '../animation/animationConfig';
import type { PetState } from '../types/pet';
import type { LocomotionPetState, PetActionDefinition } from './actionTypes';

function animationDurationMs(state: PetState): number {
    const definition = animationConfig[state];
    if (definition.fps <= 0 || definition.frames.length === 0) return 0;
    return Math.ceil((definition.frames.length / definition.fps) * 1000) + 300;
}

export const PET_ACTIONS: Record<PetState, PetActionDefinition> = {
    idle: {
        state: 'idle',
        kind: 'persistent',
        canBeTriggeredRandomly: true,
        blocksRandomBehavior: false,
        resetsInactivityTimerOnStart: true,
    },
    dragging: {
        state: 'dragging',
        kind: 'interactionOverride',
        canBeTriggeredRandomly: false,
        blocksRandomBehavior: true,
        resetsInactivityTimerOnStart: true,
    },
    happy: {
        state: 'happy',
        kind: 'oneShot',
        defaultDurationMs: 2_500,
        returnState: 'idle',
        canBeTriggeredRandomly: true,
        blocksRandomBehavior: true,
        resetsInactivityTimerOnStart: true,
        defaultBubble: '喵～',
    },
    sleeping: {
        state: 'sleeping',
        kind: 'persistent',
        canBeTriggeredRandomly: true,
        blocksRandomBehavior: true,
        resetsInactivityTimerOnStart: false,
        defaultBubble: 'Zzz...',
    },
    walk_right: {
        state: 'walk_right',
        kind: 'locomotion',
        canBeTriggeredRandomly: true,
        blocksRandomBehavior: true,
        resetsInactivityTimerOnStart: true,
    },
    walk_left: {
        state: 'walk_left',
        kind: 'locomotion',
        canBeTriggeredRandomly: true,
        blocksRandomBehavior: true,
        resetsInactivityTimerOnStart: true,
    },
    grooming: {
        state: 'grooming',
        kind: 'oneShot',
        defaultDurationMs: animationDurationMs('grooming'),
        returnState: 'idle',
        canBeTriggeredRandomly: true,
        blocksRandomBehavior: true,
        resetsInactivityTimerOnStart: true,
    },
};

export function isLocomotionState(state: PetState): state is LocomotionPetState {
    return PET_ACTIONS[state].kind === 'locomotion';
}
