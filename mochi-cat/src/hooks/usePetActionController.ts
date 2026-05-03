import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { PetState } from '../types/pet';
import type { UserSettings } from '../types/ipc';
import { PET_ACTIONS, isLocomotionState } from '../actions/actionRegistry';
import type { LocomotionPetState, PetActionRequest } from '../actions/actionTypes';
import { DEBUG_ACTIONS, DEBUG_TIMERS } from '../debug/debugFlags';

export const USER_ACTION_RANDOM_COOLDOWN_MS = import.meta.env.DEV ? 1_500 : 5_000;

const EXPLICIT_ACTION_SOURCES = new Set<PetActionRequest['source']>([
    'manual',
    'menu',
    'tray',
    'interaction',
]);

interface UsePetActionControllerParams {
    settings: UserSettings;
    isWindowVisible: boolean;
    showBubble: (text: string) => void;
    clearBubble: () => void;
    onLocomotionActionStarted?: (state: LocomotionPetState) => void;
}

interface UsePetActionControllerResult {
    petState: PetState;
    petStateRef: MutableRefObject<PetState>;
    enteredStateAtRef: MutableRefObject<number>;
    lastInteractionAtRef: MutableRefObject<number>;
    manualActionCooldownUntilRef: MutableRefObject<number>;
    actionTokenRef: MutableRefObject<number>;
    dispatchPetAction: (request: PetActionRequest) => boolean;
    markUserInteraction: (cooldownMs?: number) => void;
    resetInactivityTimer: (reason: string) => void;
}

function shouldMarkUserInteraction(source: PetActionRequest['source']): boolean {
    return EXPLICIT_ACTION_SOURCES.has(source);
}

export function usePetActionController({
    settings,
    isWindowVisible,
    showBubble,
    clearBubble,
    onLocomotionActionStarted,
}: UsePetActionControllerParams): UsePetActionControllerResult {
    const [petState, setPetState] = useState<PetState>('idle');

    const settingsRef = useRef(settings);
    const isWindowVisibleRef = useRef(isWindowVisible);
    const petStateRef = useRef<PetState>('idle');
    const enteredStateAtRef = useRef<number>(Date.now());
    const lastInteractionAtRef = useRef<number>(Date.now());
    const manualActionCooldownUntilRef = useRef<number>(0);
    const actionTokenRef = useRef<number>(0);
    const actionTimerRef = useRef<number | null>(null);
    const inactivityTimerRef = useRef<number | null>(null);
    const dispatchPetActionRef = useRef<(request: PetActionRequest) => boolean>(() => false);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        isWindowVisibleRef.current = isWindowVisible;
    }, [isWindowVisible]);

    const clearActionTimer = useCallback(() => {
        if (actionTimerRef.current !== null) {
            window.clearTimeout(actionTimerRef.current);
            actionTimerRef.current = null;
        }
    }, []);

    const clearInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current !== null) {
            window.clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
    }, []);

    const markUserInteraction = useCallback((cooldownMs = 0) => {
        const now = Date.now();
        lastInteractionAtRef.current = now;
        if (cooldownMs > 0) {
            manualActionCooldownUntilRef.current = Math.max(
                manualActionCooldownUntilRef.current,
                now + cooldownMs,
            );
        }
        if (DEBUG_ACTIONS) {
            console.debug('[action] user interaction marked', { cooldownMs });
        }
    }, []);

    const transitionToState = useCallback((nextState: PetState, reason: string): number => {
        const previousState = petStateRef.current;
        actionTokenRef.current += 1;
        const token = actionTokenRef.current;
        petStateRef.current = nextState;
        enteredStateAtRef.current = Date.now();
        setPetState(nextState);

        if (DEBUG_ACTIONS) {
            console.debug('[action] transition', {
                previousState,
                nextState,
                reason,
                token,
            });
        }

        return token;
    }, []);

    const resetInactivityTimer = useCallback((reason: string) => {
        clearInactivityTimer();

        const currentState = petStateRef.current;
        const sleepAfterIdleMs = settingsRef.current.sleepAfterIdleMs;
        if (sleepAfterIdleMs === null || sleepAfterIdleMs <= 0) {
            if (DEBUG_TIMERS) console.debug('[timer] inactivity disabled', { reason });
            return;
        }

        if (currentState !== 'idle') {
            if (DEBUG_TIMERS) {
                console.debug('[timer] inactivity not scheduled outside idle', {
                    reason,
                    currentState,
                });
            }
            return;
        }

        const token = actionTokenRef.current;
        inactivityTimerRef.current = window.setTimeout(() => {
            inactivityTimerRef.current = null;

            if (actionTokenRef.current !== token) {
                if (DEBUG_TIMERS) {
                    console.debug('[timer] inactivity ignored due to stale token', {
                        token,
                        currentToken: actionTokenRef.current,
                    });
                }
                return;
            }

            if (petStateRef.current !== 'idle') {
                if (DEBUG_TIMERS) {
                    console.debug('[timer] inactivity skipped due to currentState', {
                        currentState: petStateRef.current,
                    });
                }
                return;
            }

            dispatchPetActionRef.current({
                state: 'sleeping',
                source: 'timer',
                reason: 'inactivity timeout',
                bubbleText: 'Zzz...',
            });
        }, sleepAfterIdleMs);

        if (DEBUG_TIMERS) {
            console.debug('[timer] inactivity scheduled', {
                reason,
                token,
                sleepAfterIdleMs,
                isWindowVisible: isWindowVisibleRef.current,
            });
        }
    }, [clearInactivityTimer]);

    const dispatchPetAction = useCallback((request: PetActionRequest): boolean => {
        const now = Date.now();
        const currentState = petStateRef.current;
        const currentDefinition = PET_ACTIONS[currentState];
        const nextDefinition = PET_ACTIONS[request.state];

        if (DEBUG_ACTIONS) {
            console.debug('[action] request received', {
                request,
                currentState,
                currentKind: currentDefinition.kind,
                currentToken: actionTokenRef.current,
            });
        }

        if (currentState === 'dragging') {
            const isDragLifecycleAction =
                request.source === 'interaction'
                && (request.state === 'dragging' || request.state === 'idle');
            if (!isDragLifecycleAction) {
                if (DEBUG_ACTIONS) {
                    console.debug('[action] rejected while dragging', { request });
                }
                return false;
            }
        }

        if (request.source === 'random') {
            if (now < manualActionCooldownUntilRef.current) {
                if (DEBUG_ACTIONS) {
                    console.debug('[action] rejected random during manual cooldown', {
                        cooldownRemainingMs: manualActionCooldownUntilRef.current - now,
                    });
                }
                return false;
            }

            if (!nextDefinition.canBeTriggeredRandomly) {
                if (DEBUG_ACTIONS) {
                    console.debug('[action] rejected random for non-random action', { state: request.state });
                }
                return false;
            }

            if (
                currentDefinition.kind === 'oneShot'
                || currentDefinition.kind === 'locomotion'
                || currentDefinition.kind === 'interactionOverride'
            ) {
                if (DEBUG_ACTIONS) {
                    console.debug('[action] rejected random due to blocking state', {
                        currentState,
                        currentKind: currentDefinition.kind,
                    });
                }
                return false;
            }
        }

        if (
            request.source === 'system'
            && request.state === 'idle'
            && request.reason === 'walking completed'
            && currentDefinition.kind !== 'locomotion'
        ) {
            if (DEBUG_ACTIONS) {
                console.debug('[action] rejected stale walking completion', { currentState });
            }
            return false;
        }

        if (shouldMarkUserInteraction(request.source)) {
            markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        }

        clearActionTimer();
        clearInactivityTimer();

        const token = transitionToState(request.state, request.reason);
        const bubbleText = request.bubbleText ?? nextDefinition.defaultBubble;
        if (bubbleText) {
            showBubble(bubbleText);
        } else {
            clearBubble();
        }

        if (isLocomotionState(request.state)) {
            onLocomotionActionStarted?.(request.state);
        }

        if (nextDefinition.kind === 'oneShot') {
            const durationMs = request.durationMs
                ?? (request.state === 'happy' ? settingsRef.current.happyDurationMs : nextDefinition.defaultDurationMs)
                ?? 0;
            const expectedState = request.state;
            const returnState = nextDefinition.returnState ?? 'idle';

            actionTimerRef.current = window.setTimeout(() => {
                actionTimerRef.current = null;

                if (actionTokenRef.current !== token) {
                    if (DEBUG_TIMERS) {
                        console.debug('[timer] oneShot ignored due to stale token', {
                            expectedState,
                            token,
                            currentToken: actionTokenRef.current,
                        });
                    }
                    return;
                }

                if (petStateRef.current !== expectedState) {
                    if (DEBUG_TIMERS) {
                        console.debug('[timer] oneShot skipped due to currentState', {
                            expectedState,
                            currentState: petStateRef.current,
                        });
                    }
                    return;
                }

                dispatchPetActionRef.current({
                    state: returnState,
                    source: 'timer',
                    reason: `${expectedState} completed`,
                });
            }, durationMs);

            if (DEBUG_TIMERS) {
                console.debug('[timer] oneShot scheduled', {
                    expectedState,
                    returnState,
                    durationMs,
                    token,
                });
            }
        }

        if (nextDefinition.kind === 'persistent' || nextDefinition.resetsInactivityTimerOnStart) {
            resetInactivityTimer(`after ${request.reason}`);
        }

        if (DEBUG_ACTIONS) {
            console.debug('[action] accepted', {
                previousState: currentState,
                nextState: request.state,
                source: request.source,
                reason: request.reason,
                token,
            });
        }

        return true;
    }, [
        clearActionTimer,
        clearBubble,
        clearInactivityTimer,
        markUserInteraction,
        onLocomotionActionStarted,
        resetInactivityTimer,
        showBubble,
        transitionToState,
    ]);

    useEffect(() => {
        dispatchPetActionRef.current = dispatchPetAction;
    }, [dispatchPetAction]);

    useEffect(() => {
        resetInactivityTimer('mount/settings changed');
    }, [resetInactivityTimer, settings.sleepAfterIdleMs]);

    useEffect(() => {
        return () => {
            clearActionTimer();
            clearInactivityTimer();
        };
    }, [clearActionTimer, clearInactivityTimer]);

    return {
        petState,
        petStateRef,
        enteredStateAtRef,
        lastInteractionAtRef,
        manualActionCooldownUntilRef,
        actionTokenRef,
        dispatchPetAction,
        markUserInteraction,
        resetInactivityTimer,
    };
}
