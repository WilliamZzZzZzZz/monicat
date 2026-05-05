import type { PetState } from '../types/pet';

export type ActionKind =
    | 'persistent'
    | 'oneShot'
    | 'locomotion'
    | 'interactionOverride';

export type ActionTriggerSource =
    | 'manual'
    | 'menu'
    /**
     * 'tray' is reserved for future tray-specific dispatch semantics
     * (e.g., tray actions that should not restart interaction cooldowns).
     * Currently no tray actions dispatch with source 'tray'; they use 'menu' instead.
     */
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
    /**
     * blocksRandomBehavior: when true, the random behavior scheduler will not
     * fire while this action is active. This mirrors the kind-based check in
     * useRandomBehavior (which tests for oneShot / locomotion / interactionOverride)
     * and serves as the canonical source of truth in the registry.
     * The actionRegistry tests assert the expected values for every state.
     */
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
    /**
     * force: when true, the caller asserts that this action should interrupt
     * the current state. Currently all 'menu' and 'interaction' source actions
     * already have interrupt capability, so this field has no additional effect
     * in the dispatcher — it is kept as documentation intent only.
     * If stricter dispatch rules are introduced in a future phase, force will
     * become the gating mechanism.
     */
    force?: boolean;
}
