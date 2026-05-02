import { useState, useEffect, useRef, useCallback } from 'react';
import { type PetState } from './types/pet';
import { type UserSettings } from './types/ipc';
import { SpeechBubble } from './components/SpeechBubble';
import { PetSprite } from './components/PetSprite';
import { SettingsPanel } from './components/SettingsPanel';
import { useRandomBehavior } from './hooks/useRandomBehavior';
import { useWalkingMovement } from './hooks/useWalkingMovement';
import { PET_SIZE_DEFAULT } from './components/SizeSliderPanel';
import { DEBUG_INTERACTION, DEBUG_STATE_MACHINE } from './debug/debugFlags';
import { animationConfig } from './animation/animationConfig';

const DEFAULT_SLEEP_AFTER_IDLE_MS = import.meta.env.DEV ? 15_000 : 5 * 60_000;
const USER_ACTION_RANDOM_COOLDOWN_MS = import.meta.env.DEV ? 1_500 : 5_000;
const GROOMING_DURATION_MS =
    Math.ceil((animationConfig.grooming.frames.length / animationConfig.grooming.fps) * 1000) + 300;

const DEFAULT_SETTINGS: UserSettings = {
    petSizePx: PET_SIZE_DEFAULT,
    alwaysOnTop: true,
    speechBubbleEnabled: true,
    randomBehaviorEnabled: true,
    autoWalkEnabled: true,
    behaviorFrequency: 'normal',
    walkingSpeedPxPerSecond: 35,
    walkingDurationMinMs: 4_000,
    walkingDurationMaxMs: 6_000,
    sleepAfterIdleMs: DEFAULT_SLEEP_AFTER_IDLE_MS,
    happyDurationMs: 2_500,
    bubbleDurationMs: 1_800,
};

function isRandomReason(reason: string): boolean {
    return reason.startsWith('random');
}

export default function App() {
    const [petState, setPetState] = useState<PetState>('idle');
    const [isDragging, setIsDragging] = useState(false);
    const [bubbleText, setBubbleText] = useState<string | null>(null);
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const [localSizePx, setLocalSizePx] = useState<number>(DEFAULT_SETTINGS.petSizePx);
    const [isWindowVisible, setIsWindowVisible] = useState(true);
    const [walkRunId, setWalkRunId] = useState(0);
    const [windowPosition, setWindowPosition] = useState<[number, number] | null>(null);
    const [debugNow, setDebugNow] = useState(Date.now());

    const settingsRef = useRef<UserSettings>(DEFAULT_SETTINGS);
    const happyTimerRef = useRef<number | null>(null);
    const groomingTimerRef = useRef<number | null>(null);
    const bubbleTimerRef = useRef<number | null>(null);
    const inactivityTimerRef = useRef<number | null>(null);
    const petStateRef = useRef<PetState>('idle');
    const isDraggingRef = useRef(false);
    const hasDraggedRef = useRef(false);
    const lastInteractionAtRef = useRef<number>(Date.now());
    const manualActionCooldownUntilRef = useRef<number>(0);
    const enteredStateAtRef = useRef<number>(Date.now());

    // ---- Pointer interaction state ----------------------------------------
    /** Minimum movement to confirm a drag (avoids accidental drags on plain clicks) */
    const DRAG_START_THRESHOLD_PX = 4;
    const pointerDownRef = useRef(false);
    const pointerIdRef = useRef<number | null>(null);
    /** True once movement has exceeded the drag threshold in the current press */
    const dragStartedRef = useRef(false);
    const dragStartScreenRef = useRef<{ x: number; y: number } | null>(null);

    const updateSettings = useCallback((nextSettings: UserSettings) => {
        settingsRef.current = nextSettings;
        setSettings(nextSettings);
        setLocalSizePx(nextSettings.petSizePx);
    }, []);

    const clearHappyTimer = useCallback(() => {
        if (happyTimerRef.current !== null) {
            window.clearTimeout(happyTimerRef.current);
            happyTimerRef.current = null;
        }
    }, []);

    const clearGroomingTimer = useCallback(() => {
        if (groomingTimerRef.current !== null) {
            window.clearTimeout(groomingTimerRef.current);
            groomingTimerRef.current = null;
        }
    }, []);

    const clearBubbleTimer = useCallback(() => {
        if (bubbleTimerRef.current !== null) {
            window.clearTimeout(bubbleTimerRef.current);
            bubbleTimerRef.current = null;
        }
    }, []);

    const markUserInteraction = useCallback((randomCooldownMs = 0) => {
        const now = Date.now();
        lastInteractionAtRef.current = now;
        if (randomCooldownMs > 0) {
            manualActionCooldownUntilRef.current = Math.max(
                manualActionCooldownUntilRef.current,
                now + randomCooldownMs,
            );
        }
    }, []);

    const transitionToState = useCallback((nextState: PetState, reason: string) => {
        const previousState = petStateRef.current;
        if (nextState !== 'grooming') clearGroomingTimer();
        petStateRef.current = nextState;
        enteredStateAtRef.current = Date.now();
        setPetState(nextState);
        if (DEBUG_STATE_MACHINE) {
            console.debug(`[state] transition: ${previousState} -> ${nextState}`, { reason });
        }
    }, [clearGroomingTimer]);

    const showBubble = useCallback((text: string) => {
        if (!settingsRef.current.speechBubbleEnabled) {
            clearBubbleTimer();
            setBubbleText(null);
            return;
        }

        clearBubbleTimer();
        setBubbleText(text);
        bubbleTimerRef.current = window.setTimeout(() => {
            bubbleTimerRef.current = null;
            setBubbleText(null);
        }, settingsRef.current.bubbleDurationMs);
    }, [clearBubbleTimer]);

    const resetInactivityTimer = useCallback((reason = 'reset inactivity timer') => {
        if (inactivityTimerRef.current !== null) {
            window.clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }

        const sleepAfterIdleMs = settingsRef.current.sleepAfterIdleMs;
        if (sleepAfterIdleMs === null || sleepAfterIdleMs <= 0) {
            if (DEBUG_STATE_MACHINE) console.debug('[state] inactivity sleep disabled', { reason });
            return;
        }

        inactivityTimerRef.current = window.setTimeout(() => {
            inactivityTimerRef.current = null;
            if (petStateRef.current !== 'idle') {
                if (DEBUG_STATE_MACHINE) {
                    console.debug('[state] inactivity sleep skipped', {
                        reason,
                        currentState: petStateRef.current,
                    });
                }
                return;
            }
            transitionToState('sleeping', 'inactivity timeout');
            showBubble('Zzz...');
        }, sleepAfterIdleMs);
    }, [showBubble, transitionToState]);

    const forcePetStateFromUserAction = useCallback((nextState: PetState, reason: string): boolean => {
        if (petStateRef.current === 'dragging' || isDraggingRef.current) {
            if (DEBUG_STATE_MACHINE) console.debug('[state] explicit action ignored while dragging', { reason });
            return false;
        }

        clearHappyTimer();
        clearGroomingTimer();
        markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        transitionToState(nextState, reason);
        resetInactivityTimer(`after ${reason}`);
        return true;
    }, [clearGroomingTimer, clearHappyTimer, markUserInteraction, resetInactivityTimer, transitionToState]);

    const triggerHappy = useCallback((bubbleOverride?: string, reason = 'happy') => {
        if (petStateRef.current === 'dragging' || isDraggingRef.current) return;

        clearHappyTimer();
        clearGroomingTimer();
        transitionToState('happy', reason);
        showBubble(bubbleOverride ?? '喵～');
        resetInactivityTimer(`after ${reason}`);

        happyTimerRef.current = window.setTimeout(() => {
            happyTimerRef.current = null;
            if (petStateRef.current !== 'happy') {
                if (DEBUG_STATE_MACHINE) {
                    console.debug('[state] happy timer skipped', { currentState: petStateRef.current });
                }
                return;
            }
            transitionToState('idle', 'happy timer elapsed');
            resetInactivityTimer('after happy timer');
        }, settingsRef.current.happyDurationMs);
    }, [clearGroomingTimer, clearHappyTimer, resetInactivityTimer, showBubble, transitionToState]);

    const triggerSleep = useCallback((bubbleOverride?: string, reason = 'sleep') => {
        if (petStateRef.current === 'dragging' || isDraggingRef.current) return;
        clearHappyTimer();
        clearGroomingTimer();
        transitionToState('sleeping', reason);
        showBubble(bubbleOverride ?? 'Zzz...');
    }, [clearGroomingTimer, clearHappyTimer, showBubble, transitionToState]);

    const triggerIdle = useCallback((reason = 'idle') => {
        transitionToState('idle', reason);
        resetInactivityTimer(`after ${reason}`);
    }, [resetInactivityTimer, transitionToState]);

    const triggerGrooming = useCallback((reason = 'manual grooming') => {
        if (petStateRef.current === 'dragging' || isDraggingRef.current) return;
        if (isRandomReason(reason) && petStateRef.current !== 'idle') return;

        clearHappyTimer();
        clearGroomingTimer();
        clearBubbleTimer();
        setBubbleText(null);
        if (!isRandomReason(reason)) {
            markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        }

        transitionToState('grooming', reason);
        groomingTimerRef.current = window.setTimeout(() => {
            groomingTimerRef.current = null;
            if (petStateRef.current !== 'grooming') {
                if (DEBUG_STATE_MACHINE) {
                    console.debug('[state] grooming timer skipped', { currentState: petStateRef.current });
                }
                return;
            }
            transitionToState('idle', 'grooming timer elapsed');
            resetInactivityTimer('after grooming timer');
        }, GROOMING_DURATION_MS);
    }, [
        clearBubbleTimer,
        clearGroomingTimer,
        clearHappyTimer,
        markUserInteraction,
        resetInactivityTimer,
        transitionToState,
    ]);

    const startWalk = useCallback((nextState: 'walk_left' | 'walk_right', reason: string) => {
        const isExplicitUserAction = !isRandomReason(reason);
        const didStart = isExplicitUserAction
            ? forcePetStateFromUserAction(nextState, reason)
            : (() => {
                if (petStateRef.current === 'dragging' || isDraggingRef.current) return false;
                clearHappyTimer();
                transitionToState(nextState, reason);
                return true;
            })();

        if (didStart) setWalkRunId((current) => current + 1);
    }, [clearHappyTimer, forcePetStateFromUserAction, transitionToState]);

    const triggerWalkRight = useCallback((reason = 'manual walkRight') => {
        startWalk('walk_right', reason);
    }, [startWalk]);

    const triggerWalkLeft = useCallback((reason = 'manual walkLeft') => {
        startWalk('walk_left', reason);
    }, [startWalk]);

    const applySettingsUpdate = useCallback((partial: Partial<UserSettings>) => {
        void window.mochiCat.settings.update(partial).then(updateSettings);
    }, [updateSettings]);

    const refreshWindowPosition = useCallback(async () => {
        const position = await window.mochiCat.window.getPosition();
        setWindowPosition(position);
        return position;
    }, []);

    const resetPetPosition = useCallback(async () => {
        markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        const [workArea, bounds] = await Promise.all([
            window.mochiCat.window.getWorkArea(),
            window.mochiCat.window.getBounds(),
        ]);
        const maxX = workArea.x + workArea.width - bounds.width;
        const maxY = workArea.y + workArea.height - bounds.height;
        const targetX = Math.max(workArea.x, Math.min(maxX, maxX - 80));
        const targetY = Math.max(workArea.y, Math.min(maxY, maxY - 120));
        await window.mochiCat.window.setPosition(targetX, targetY);
        setWindowPosition([targetX, targetY]);
    }, [markUserInteraction]);

    const resetSettings = useCallback(() => {
        void window.mochiCat.settings.reset().then(updateSettings);
    }, [updateSettings]);

    // Load settings on mount and subscribe to changes pushed from main process
    useEffect(() => {
        void window.mochiCat.settings.get().then(updateSettings);
        const unsubscribe = window.mochiCat.settings.onChange(updateSettings);
        return unsubscribe;
    }, [updateSettings]);

    // Keep state refs aligned for timers and IPC callbacks.
    useEffect(() => {
        petStateRef.current = petState;
        enteredStateAtRef.current = Date.now();
    }, [petState]);

    useEffect(() => {
        isDraggingRef.current = isDragging;
    }, [isDragging]);

    // Subscribe to window visibility changes from main process
    useEffect(() => {
        return window.mochiCat.window.onVisibilityChanged(setIsWindowVisible);
    }, []);

    // Start inactivity timer on mount, clean up all timers on unmount
    useEffect(() => {
        resetInactivityTimer('mount');
        return () => {
            clearHappyTimer();
            clearGroomingTimer();
            clearBubbleTimer();
            if (inactivityTimerRef.current !== null) window.clearTimeout(inactivityTimerRef.current);
        };
    }, [clearBubbleTimer, clearGroomingTimer, clearHappyTimer, resetInactivityTimer]);

    useEffect(() => {
        resetInactivityTimer('settings sleepAfterIdleMs changed');
    }, [resetInactivityTimer, settings.sleepAfterIdleMs]);

    useEffect(() => {
        if (!settings.speechBubbleEnabled) {
            clearBubbleTimer();
            setBubbleText(null);
        }
    }, [clearBubbleTimer, settings.speechBubbleEnabled]);

    useEffect(() => {
        if (!isSettingsPanelOpen) return;
        setDebugNow(Date.now());
        void refreshWindowPosition();

        if (!import.meta.env.DEV) return;
        const timerId = window.setInterval(() => {
            setDebugNow(Date.now());
            void refreshWindowPosition();
        }, 1_000);

        return () => window.clearInterval(timerId);
    }, [isSettingsPanelOpen, refreshWindowPosition]);

    // Subscribe to native context menu actions from main process
    useEffect(() => {
        const unsubscribe = window.mochiCat.pet.onMenuAction((action) => {
            if (DEBUG_STATE_MACHINE) console.debug('[menu] action received:', action);
            markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
            switch (action) {
                case 'pet':
                    triggerHappy('舒服～', 'menu pet');
                    break;
                case 'feed':
                    triggerHappy('小鱼干！', 'menu feed');
                    break;
                case 'grooming':
                    triggerGrooming('menu grooming');
                    break;
                case 'sleep':
                    triggerSleep('Zzz...', 'menu sleep');
                    break;
                case 'wake':
                    triggerHappy('醒啦！', 'menu wake');
                    break;
                case 'openSettingsPanel':
                    setIsSettingsPanelOpen(true);
                    break;
                case 'resetPosition':
                    void resetPetPosition();
                    break;
                case 'walkLeft':
                    triggerWalkLeft('menu walkLeft');
                    break;
                case 'walkRight':
                    triggerWalkRight('menu walkRight');
                    break;
            }
        });
        return unsubscribe;
    }, [
        markUserInteraction,
        resetPetPosition,
        triggerGrooming,
        triggerHappy,
        triggerSleep,
        triggerWalkLeft,
        triggerWalkRight,
    ]);

    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        hasDraggedRef.current = false;
        pointerDownRef.current = true;
        pointerIdRef.current = event.pointerId;
        dragStartedRef.current = false;
        dragStartScreenRef.current = { x: event.screenX, y: event.screenY };
        // Pointer capture: pointer events continue to reach this element even when
        // the pointer moves outside it or the window.
        event.currentTarget.setPointerCapture(event.pointerId);
        // Start drag tracking in the main process immediately; no await keeps the
        // interaction chain responsive.
        if (DEBUG_INTERACTION) console.debug('[interaction] pointerdown', event.screenX, event.screenY);
        void window.mochiCat.window.dragStart(event.screenX, event.screenY);
    }, [markUserInteraction]);

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (!pointerDownRef.current || pointerIdRef.current !== event.pointerId) return;
        if (!dragStartScreenRef.current) return;
        const dx = event.screenX - dragStartScreenRef.current.x;
        const dy = event.screenY - dragStartScreenRef.current.y;
        if (!dragStartedRef.current) {
            if (Math.sqrt(dx * dx + dy * dy) < DRAG_START_THRESHOLD_PX) return;
            dragStartedRef.current = true;
            hasDraggedRef.current = true;
            isDraggingRef.current = true;
            setIsDragging(true);
            clearHappyTimer();
            transitionToState('dragging', 'pointer drag confirmed');
            showBubble('别拎我！');
            resetInactivityTimer('drag confirmed');
            if (DEBUG_INTERACTION) console.debug('[interaction] drag confirmed');
        }
        window.mochiCat.window.dragMove(event.screenX, event.screenY);
    }, [clearHappyTimer, resetInactivityTimer, showBubble, transitionToState]);

    const endDrag = useCallback(async (didDrag: boolean) => {
        isDraggingRef.current = false;
        setIsDragging(false);
        await window.mochiCat.window.dragEnd();
        markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        if (didDrag) {
            transitionToState('idle', 'drag ended');
        }
        resetInactivityTimer('drag ended');
    }, [markUserInteraction, resetInactivityTimer, transitionToState]);

    const handlePointerUp = useCallback(async (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!pointerDownRef.current || pointerIdRef.current !== event.pointerId) return;
        const didDrag = dragStartedRef.current;
        // Reset state before any await so re-entrant events are ignored
        pointerDownRef.current = false;
        pointerIdRef.current = null;
        dragStartedRef.current = false;
        dragStartScreenRef.current = null;
        if (DEBUG_INTERACTION) console.debug('[interaction] pointerup  didDrag=', didDrag);
        await endDrag(didDrag);
    }, [endDrag]);

    const handlePointerCancel = useCallback(async (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!pointerDownRef.current) return;
        if (pointerIdRef.current !== null && pointerIdRef.current !== event.pointerId) return;
        const didDrag = dragStartedRef.current;
        pointerDownRef.current = false;
        pointerIdRef.current = null;
        dragStartedRef.current = false;
        dragStartScreenRef.current = null;
        if (DEBUG_INTERACTION) console.debug('[interaction] pointercancel  didDrag=', didDrag);
        await endDrag(didDrag);
    }, [endDrag]);

    // Safety net: if the app window loses focus while dragging, cancel the drag
    useEffect(() => {
        const onBlur = async () => {
            if (!pointerDownRef.current) return;
            const didDrag = dragStartedRef.current;
            pointerDownRef.current = false;
            pointerIdRef.current = null;
            dragStartedRef.current = false;
            dragStartScreenRef.current = null;
            if (DEBUG_INTERACTION) console.debug('[interaction] window blur — cancelling drag');
            await endDrag(didDrag);
        };
        window.addEventListener('blur', onBlur);
        return () => window.removeEventListener('blur', onBlur);
    }, [endDrag]);

    // Double-click: only fire happy if no drag occurred during this press
    const handleDoubleClick = useCallback(() => {
        if (hasDraggedRef.current) return;
        markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        triggerHappy(petStateRef.current === 'sleeping' ? '醒啦！' : undefined, 'double-click happy');
    }, [markUserInteraction, triggerHappy]);

    const handleContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        void window.mochiCat.menu.openPetMenu();
    }, [markUserInteraction]);

    useWalkingMovement({
        petState,
        isDragging,
        isWindowVisible,
        walkRunId,
        walkingSpeedPxPerSecond: settings.walkingSpeedPxPerSecond,
        walkingDurationMinMs: settings.walkingDurationMinMs,
        walkingDurationMaxMs: settings.walkingDurationMaxMs,
        onWalkComplete: () => triggerIdle('walking completed'),
    });

    useRandomBehavior({
        petState,
        randomBehaviorEnabled: settings.randomBehaviorEnabled,
        autoWalkEnabled: settings.autoWalkEnabled,
        behaviorFrequency: settings.behaviorFrequency,
        isWindowVisible,
        isSettingsPanelOpen,
        lastInteractionAtRef,
        manualActionCooldownUntilRef,
        enteredStateAtRef,
        triggerHappy,
        triggerSleep,
        triggerWalkLeft,
        triggerWalkRight,
        triggerGrooming,
    });

    return (
        <main
            className="pet-window"
            style={{ '--pet-size': `${localSizePx}px` } as React.CSSProperties}
        >
            <div className="pet-container">
                <SpeechBubble text={bubbleText} visible={bubbleText !== null} />
                <PetSprite
                    state={petState}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                />
            </div>
            {isSettingsPanelOpen && (
                <SettingsPanel
                    settings={settings}
                    sizePx={localSizePx}
                    petState={petState}
                    isWindowVisible={isWindowVisible}
                    windowPosition={windowPosition}
                    lastInteractionAgeMs={debugNow - lastInteractionAtRef.current}
                    onSizePreview={setLocalSizePx}
                    onSettingsChange={applySettingsUpdate}
                    onResetPosition={resetPetPosition}
                    onResetSettings={resetSettings}
                    onClose={() => setIsSettingsPanelOpen(false)}
                />
            )}
        </main>
    );
}
