import { useEffect, useRef, MutableRefObject } from 'react';
import type { PetState } from '../types/pet';
import { RANDOM_BEHAVIOR_CONFIG as cfg } from '../behavior/randomBehaviorConfig';
import { DEBUG_RANDOM } from '../debug/debugFlags';

// ---- helpers ----------------------------------------------------------------

function randomBetween(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min));
}

function pickRandom<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const IDLE_BUBBLES = ['喵？', '喵～', '在看你'] as const;
const WAKE_BUBBLES = ['醒啦～', '喵？'] as const;

// ---- types ------------------------------------------------------------------

export interface UseRandomBehaviorParams {
    petState: PetState;
    randomBehaviorEnabled: boolean;
    isWindowVisible: boolean;
    /** When the size-adjustment panel is open, suppress random behavior */
    isSizePanelOpen: boolean;
    /** Ref to timestamp of last user interaction (ms) */
    lastInteractionAtRef: MutableRefObject<number>;
    /** Ref to timestamp when current petState was entered (ms) */
    enteredStateAtRef: MutableRefObject<number>;
    triggerHappy: (bubbleText?: string) => void;
    triggerSleep: (bubbleText?: string) => void;
    triggerWalkLeft: () => void;
    triggerWalkRight: () => void;
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
    isWindowVisible,
    isSizePanelOpen,
    lastInteractionAtRef,
    enteredStateAtRef,
    triggerHappy,
    triggerSleep,
    triggerWalkLeft,
    triggerWalkRight,
}: UseRandomBehaviorParams): void {
    // Keep latest callbacks in refs so closures inside timers never go stale
    const triggerHappyRef = useRef(triggerHappy);
    const triggerSleepRef = useRef(triggerSleep);
    const triggerWalkLeftRef = useRef(triggerWalkLeft);
    const triggerWalkRightRef = useRef(triggerWalkRight);
    useEffect(() => {
        triggerHappyRef.current = triggerHappy;
        triggerSleepRef.current = triggerSleep;
        triggerWalkLeftRef.current = triggerWalkLeft;
        triggerWalkRightRef.current = triggerWalkRight;
    });

    const timerRef = useRef<number | null>(null);
    // Per-behavior cooldown timestamps
    const cooldownRef = useRef({
        lastAnyBehaviorAt: 0,
        lastWalkAt: 0,
        lastHappyAt: 0,
        lastSleepAt: 0,
    });

    useEffect(() => {
        // Clear any previously scheduled timer first
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // Don't schedule if disabled, hidden, size panel open, or non-schedulable state
        if (!randomBehaviorEnabled || !isWindowVisible || isSizePanelOpen) return;
        if (petState !== 'idle' && petState !== 'sleeping') return;

        const [minDelay, maxDelay] =
            petState === 'idle'
                ? [cfg.minIdleDelayMs, cfg.maxIdleDelayMs]
                : [cfg.minSleepCheckDelayMs, cfg.maxSleepCheckDelayMs];

        const schedule = () => {
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;

                const now = Date.now();

                // Guard: recent user interaction
                if (now - lastInteractionAtRef.current < cfg.recentInteractionCooldownMs) {
                    if (DEBUG_RANDOM) console.debug('[random] skipped — recent interaction');
                    schedule();
                    return;
                }

                // Guard: global behavior cooldown
                if (now - cooldownRef.current.lastAnyBehaviorAt < cfg.globalBehaviorCooldownMs) {
                    if (DEBUG_RANDOM) console.debug('[random] skipped — global cooldown');
                    schedule();
                    return;
                }

                const stateDuration = now - enteredStateAtRef.current;

                if (petState === 'idle') {
                    const roll = Math.random();
                    if (roll < 0.25) {
                        // selfHappy (25%)
                        if (now - cooldownRef.current.lastHappyAt < cfg.happyCooldownMs) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped happy — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] selfHappy');
                        cooldownRef.current.lastAnyBehaviorAt = now;
                        cooldownRef.current.lastHappyAt = now;
                        triggerHappyRef.current(pickRandom(IDLE_BUBBLES));
                    } else if (roll < 0.50) {
                        // walkRight (25%)
                        if (now - cooldownRef.current.lastWalkAt < cfg.walkCooldownMs) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped walkRight — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] walkRight');
                        cooldownRef.current.lastAnyBehaviorAt = now;
                        cooldownRef.current.lastWalkAt = now;
                        triggerWalkRightRef.current();
                    } else if (roll < 0.75) {
                        // walkLeft (25%)
                        if (now - cooldownRef.current.lastWalkAt < cfg.walkCooldownMs) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped walkLeft — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] walkLeft');
                        cooldownRef.current.lastAnyBehaviorAt = now;
                        cooldownRef.current.lastWalkAt = now;
                        triggerWalkLeftRef.current();
                    } else if (stateDuration >= cfg.minNapIdleMs && roll < 0.90) {
                        // nap (15% if idle long enough)
                        if (now - cooldownRef.current.lastSleepAt < cfg.sleepCooldownMs) {
                            if (DEBUG_RANDOM) console.debug('[random] skipped nap — cooldown');
                            schedule(); return;
                        }
                        if (DEBUG_RANDOM) console.debug('[random] nap');
                        cooldownRef.current.lastAnyBehaviorAt = now;
                        cooldownRef.current.lastSleepAt = now;
                        triggerSleepRef.current('Zzz...');
                    } else {
                        // No behavior this tick — reschedule
                        if (DEBUG_RANDOM) console.debug('[random] no-op tick, rescheduling');
                        schedule();
                    }
                } else if (petState === 'sleeping') {
                    if (stateDuration >= cfg.minSleepBeforeWakeMs && Math.random() < 0.35) {
                        // wakeUp — petState change will re-run this effect
                        if (DEBUG_RANDOM) console.debug('[random] wakeUp');
                        cooldownRef.current.lastAnyBehaviorAt = now;
                        triggerHappyRef.current(pickRandom(WAKE_BUBBLES));
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
    }, [petState, randomBehaviorEnabled, isWindowVisible, isSizePanelOpen]);
    // lastInteractionAtRef and enteredStateAtRef are refs (stable identity) —
    // read via .current inside callbacks so no dep needed.
    // triggerHappy/triggerSleep are synced via the ref pair above.
}
