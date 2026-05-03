import type { PetState } from '../types/pet';

export type ActionKind =
    | 'persistent'
    | 'oneShot'
    | 'locomotion'
    | 'interactionOverride';

export type ActionTriggerSource =
    | 'manual'
    | 'menu'
    | 'tray'
    | 'random'
    | 'interaction'
    | 'timer'
    | 'system';

export type LocomotionPetState = Extract<PetState, 'walk_left' | 'walk_right'>;

export interface PetActionDefinition {
    state: PetState;
    kind: ActionKind;
    defaultDurationMs?: number;
    returnState?: PetState;
    canBeTriggeredRandomly: boolean;
    blocksRandomBehavior: boolean;
    resetsInactivityTimerOnStart: boolean;
    defaultBubble?: string;
}

export interface PetActionRequest {
    state: PetState;
    source: ActionTriggerSource;
    reason: string;
    bubbleText?: string;
    durationMs?: number;
    force?: boolean;
}
