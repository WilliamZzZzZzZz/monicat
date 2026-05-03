import { useEffect, useRef, type MutableRefObject } from 'react';
import type { PetState } from '../types/pet';
import type { BehaviorFrequency } from '../types/ipc';
import { RANDOM_BEHAVIOR_CONFIG as cfg } from '../behavior/randomBehaviorConfig';
import { DEBUG_RANDOM } from '../debug/debugFlags';
import type { PetActionRequest } from '../actions/actionTypes';

// ---- helpers ----------------------------------------------------------------

function randomBetween(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min));
}

function pickRandom<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const IDLE_BUBBLES = ['喵？', '喵～', '在看你'] as const;
const WAKE_BUBBLES = ['醒啦～', '喵？'] as const;

const FREQUENCY_PRESETS: Record<BehaviorFrequency, {
    delayMultiplier: number;
    happyChance: number;
    groomingChance: number;
    walkRightChance: number;
    walkLeftChance: number;
    napChance: number;
    cooldownMultiplier: number;
}> = {
    low: {
        delayMultiplier: 1.75,
        happyChance: 0.14,
        groomingChance: 0.04,
        walkRightChance: 0.10,
        walkLeftChance: 0.10,
        napChance: 0.08,
        cooldownMultiplier: 1.4,
    },
    normal: {
        delayMultiplier: 1,
        happyChance: 0.25,
        groomingChance: 0.07,
        walkRightChance: 0.25,
        walkLeftChance: 0.25,
        napChance: 0.15,
        cooldownMultiplier: 1,
    },
    high: {
        delayMultiplier: 0.55,
        happyChance: 0.32,
        groomingChance: 0.08,
        walkRightChance: 0.28,
        walkLeftChance: 0.28,
        napChance: 0.20,
        cooldownMultiplier: 0.7,
    },
};

function scaleMs(ms: number, multiplier: number): number {
    return Math.max(250, Math.round(ms * multiplier));
}

// ---- types ------------------------------------------------------------------

export interface UseRandomBehaviorParams {
    petState: PetState;
    randomBehaviorEnabled: boolean;
    autoWalkEnabled: boolean;
    behaviorFrequency: BehaviorFrequency;
    isWindowVisible: boolean;
    /** When the size-adjustment panel is open, suppress random behavior */
    isSettingsPanelOpen: boolean;
    /** Ref to timestamp of last user interaction (ms) */
    lastInteractionAtRef: MutableRefObject<number>;
    /** Ref to timestamp until which explicit user actions suppress random behavior */
    manualActionCooldownUntilRef: MutableRefObject<number>;
    /** Ref to timestamp when current petState was entered (ms) */
    enteredStateAtRef: MutableRefObject<number>;
    dispatchPetAction: (request: PetActionRequest) => boolean;
}

// ---- hook -------------------------------------------------------------------

/**
 * Drives lightweight autonomous random behavior.
 *
 * Scheduling strategy: setTimeout-based (no high-frequency polling).
 * The effect re-runs whenever petState, randomBehaviorEnabled, or isWindowVisible
 * changes, clearing the old timer and starting a fresh one.
 * Timer callbacks read mutable refs for lastInteractionAt / enteredStateAt so
 * they always see the latest values without needing to reschedule on every user
 * mouse-move.
 */
export function useRandomBehavior({
    petState,
    randomBehaviorEnabled,
    autoWalkEnabled,
    behaviorFrequency,
    isWindowVisible,
    isSettingsPanelOpen,
    lastInteractionAtRef,
    manualActionCooldownUntilRef,
    enteredStateAtRef,
    dispatchPetAction,
}: UseRandomBehaviorParams): void {
    // Keep latest dispatcher in a ref so closures inside timers never go stale
    const dispatchPetActionRef = useRef(dispatchPetAction);
    useEffect(() => {
        dispatchPetActionRef.current = dispatchPetAction;
    }, [dispatchPetAction]);

    const timerRef = useRef<number | null>(null);
    // Per-behavior cooldown timestamps
    const cooldownRef = useRef({
        lastAnyBehaviorAt: 0,
        lastWalkAt: 0,
        lastHappyAt: 0,
        lastGroomingAt: 0,
        lastSleepAt: 0,
    });

    useEffect(() => {
        // Clear any previously scheduled timer first
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // Don't schedule if disabled, hidden, settings panel open, or non-schedulable state
        if (!randomBehaviorEnabled || !isWindowVisible || isSettingsPanelOpen) return;
        if (petState !== 'idle' && petState !== 'sleeping') return;

        const preset = FREQUENCY_PRESETS[behaviorFrequency];
        const [minDelay, maxDelay] =
            petState === 'idle'
                ? [
                    scaleMs(cfg.minIdleDelayMs, preset.delayMultiplier),
                    scaleMs(cfg.maxIdleDelayMs, preset.delayMultiplier),
                ]
                : [
                    scaleMs(cfg.minSleepCheckDelayMs, preset.delayMultiplier),
                    scaleMs(cfg.maxSleepCheckDelayMs, preset.delayMultiplier),
                ];

        const schedule = () => {
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;

                const now = Date.now();

                // Guard: explicit user action cooldown
                if (now < manualActionCooldownUntilRef.current) {
                    if (DEBUG_RANDOM) console.debug('[random] skipped — manual action cooldown');
                    schedule();
                    return;
                }

                // Guard: recent user interaction
                if (now - lastInteractionAtRef.current < cfg.recentInteractionCooldownMs) {
                    if (DEBUG_RANDOM) console.debug('[random] skipped — recent interaction');
                    schedule();
                    return;
                }

                // Guard: global behavior cooldown
                if (now - cooldownRef.current.lastAnyBehaviorAt < scaleMs(cfg.globalBehaviorCooldownMs, preset.cooldownMultiplier)) {
                    if (DEBUG_RANDOM) console.debug('[random] skipped — global cooldown');
                    schedule();
                    return;
                }

                const stateDuration = now - enteredStateAtRef.current;

                if (petState === 'idle') {
                    const roll = Math.random();
                    let threshold = preset.happyChance;
                    if (roll < threshold) {
                        if (now - cooldownRef.current.lastHappyAt < scaleMs(cfg.happyCooldownMs, preset.cooldownMultiplier)) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped happy — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] selected action', { state: 'happy', reason: 'random selfHappy' });
                        const accepted = dispatchPetActionRef.current({
                            state: 'happy',
                            source: 'random',
                            reason: 'random selfHappy',
                            bubbleText: pickRandom(IDLE_BUBBLES),
                        });
                        if (accepted) {
                            cooldownRef.current.lastAnyBehaviorAt = now;
                            cooldownRef.current.lastHappyAt = now;
                        } else {
                            schedule();
                        }
                    } else if (roll < (threshold += preset.groomingChance)) {
                        if (now - cooldownRef.current.lastGroomingAt < scaleMs(cfg.groomingCooldownMs, preset.cooldownMultiplier)) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped grooming — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] selected action', { state: 'grooming', reason: 'random grooming' });
                        const accepted = dispatchPetActionRef.current({
                            state: 'grooming',
                            source: 'random',
                            reason: 'random grooming',
                        });
                        if (accepted) {
                            cooldownRef.current.lastAnyBehaviorAt = now;
                            cooldownRef.current.lastGroomingAt = now;
                        } else {
                            schedule();
                        }
                    } else if (autoWalkEnabled && roll < (threshold += preset.walkRightChance)) {
                        if (now - cooldownRef.current.lastWalkAt < scaleMs(cfg.walkCooldownMs, preset.cooldownMultiplier)) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped walkRight — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] selected action', { state: 'walk_right', reason: 'random walkRight' });
                        const accepted = dispatchPetActionRef.current({
                            state: 'walk_right',
                            source: 'random',
                            reason: 'random walkRight',
                        });
                        if (accepted) {
                            cooldownRef.current.lastAnyBehaviorAt = now;
                            cooldownRef.current.lastWalkAt = now;
                        } else {
                            schedule();
                        }
                    } else if (autoWalkEnabled && roll < (threshold += preset.walkLeftChance)) {
                        if (now - cooldownRef.current.lastWalkAt < scaleMs(cfg.walkCooldownMs, preset.cooldownMultiplier)) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped walkLeft — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] selected action', { state: 'walk_left', reason: 'random walkLeft' });
                        const accepted = dispatchPetActionRef.current({
                            state: 'walk_left',
                            source: 'random',
                            reason: 'random walkLeft',
                        });
                        if (accepted) {
                            cooldownRef.current.lastAnyBehaviorAt = now;
                            cooldownRef.current.lastWalkAt = now;
                        } else {
                            schedule();
                        }
                    } else if (stateDuration >= cfg.minNapIdleMs && roll < (threshold + preset.napChance)) {
                        if (now - cooldownRef.current.lastSleepAt < scaleMs(cfg.sleepCooldownMs, preset.cooldownMultiplier)) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped nap — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] selected action', { state: 'sleeping', reason: 'random nap' });
                        const accepted = dispatchPetActionRef.current({
                            state: 'sleeping',
                            source: 'random',
                            reason: 'random nap',
                            bubbleText: 'Zzz...',
                        });
                        if (accepted) {
                            cooldownRef.current.lastAnyBehaviorAt = now;
                            cooldownRef.current.lastSleepAt = now;
                        } else {
                            schedule();
                        }
                    } else {
                        // No behavior this tick — reschedule
                        if (DEBUG_RANDOM) console.debug('[random] no-op tick, rescheduling');
                        schedule();
                    }
                } else if (petState === 'sleeping') {
                    if (stateDuration >= cfg.minSleepBeforeWakeMs && Math.random() < 0.35) {
                        // wakeUp — petState change will re-run this effect
                        if (DEBUG_RANDOM) console.debug('[random] selected action', { state: 'happy', reason: 'random wakeUp' });
                        const accepted = dispatchPetActionRef.current({
                            state: 'happy',
                            source: 'random',
                            reason: 'random wakeUp',
                            bubbleText: pickRandom(WAKE_BUBBLES),
                        });
                        if (accepted) {
                            cooldownRef.current.lastAnyBehaviorAt = now;
                        } else {
                            schedule();
                        }
                    } else {
                        // Still sleeping — reschedule
                        schedule();
                    }
                }
            }, randomBetween(minDelay, maxDelay));
        };

        schedule();

        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [
        petState,
        randomBehaviorEnabled,
        autoWalkEnabled,
        behaviorFrequency,
        isWindowVisible,
        isSettingsPanelOpen,
    ]);
    // lastInteractionAtRef and enteredStateAtRef are refs (stable identity) —
    // read via .current inside callbacks so no dep needed.
    // dispatchPetAction is synced via the ref above.
}
