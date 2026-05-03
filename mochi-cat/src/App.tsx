import { useState, useEffect, useRef, useCallback } from 'react';
import { type UserSettings } from './types/ipc';
import { SpeechBubble } from './components/SpeechBubble';
import { PetSprite } from './components/PetSprite';
import { SettingsPanel } from './components/SettingsPanel';
import { useRandomBehavior } from './hooks/useRandomBehavior';
import { useWalkingMovement } from './hooks/useWalkingMovement';
import { usePetActionController, USER_ACTION_RANDOM_COOLDOWN_MS } from './hooks/usePetActionController';
import { PET_SIZE_DEFAULT } from './components/SizeSliderPanel';
import { DEBUG_INTERACTION } from './debug/debugFlags';
import { PET_ACTIONS } from './actions/actionRegistry';
import type { PetActionRequest } from './actions/actionTypes';

const DEFAULT_SLEEP_AFTER_IDLE_MS = import.meta.env.DEV ? 15_000 : 5 * 60_000;

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

export default function App() {
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
    const bubbleTimerRef = useRef<number | null>(null);
    const hasDraggedRef = useRef(false);

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

    const clearBubbleTimer = useCallback(() => {
        if (bubbleTimerRef.current !== null) {
            window.clearTimeout(bubbleTimerRef.current);
            bubbleTimerRef.current = null;
        }
    }, []);

    const clearBubble = useCallback(() => {
        clearBubbleTimer();
        setBubbleText(null);
    }, [clearBubbleTimer]);

    const showBubble = useCallback((text: string) => {
        if (!settingsRef.current.speechBubbleEnabled) {
            clearBubble();
            return;
        }

        clearBubbleTimer();
        setBubbleText(text);
        bubbleTimerRef.current = window.setTimeout(() => {
            bubbleTimerRef.current = null;
            setBubbleText(null);
        }, settingsRef.current.bubbleDurationMs);
    }, [clearBubble, clearBubbleTimer]);

    const handleLocomotionActionStarted = useCallback(() => {
        setWalkRunId((current) => current + 1);
    }, []);

    const {
        petState,
        petStateRef,
        enteredStateAtRef,
        lastInteractionAtRef,
        manualActionCooldownUntilRef,
        actionTokenRef,
        dispatchPetAction,
        markUserInteraction,
        resetInactivityTimer,
    } = usePetActionController({
        settings,
        isWindowVisible,
        showBubble,
        clearBubble,
        onLocomotionActionStarted: handleLocomotionActionStarted,
    });

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

    // Subscribe to window visibility changes from main process
    useEffect(() => {
        return window.mochiCat.window.onVisibilityChanged(setIsWindowVisible);
    }, []);

    // Bubble timer remains UI-owned; action/inactivity timers live in the controller.
    useEffect(() => {
        return clearBubbleTimer;
    }, [clearBubbleTimer]);

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
            switch (action) {
                case 'pet': {
                    const request: PetActionRequest = {
                        state: 'happy',
                        source: 'menu',
                        reason: 'menu pet',
                        bubbleText: '舒服～',
                        force: true,
                    };
                    dispatchPetAction(request);
                    break;
                }
                case 'feed': {
                    const request: PetActionRequest = {
                        state: 'happy',
                        source: 'menu',
                        reason: 'menu feed',
                        bubbleText: '小鱼干！',
                        force: true,
                    };
                    dispatchPetAction(request);
                    break;
                }
                case 'grooming':
                    dispatchPetAction({
                        state: 'grooming',
                        source: 'menu',
                        reason: 'menu grooming',
                        force: true,
                    });
                    break;
                case 'sleep':
                    dispatchPetAction({
                        state: 'sleeping',
                        source: 'menu',
                        reason: 'menu sleep',
                        bubbleText: 'Zzz...',
                        force: true,
                    });
                    break;
                case 'wake':
                    dispatchPetAction({
                        state: 'happy',
                        source: 'menu',
                        reason: 'menu wake',
                        bubbleText: '醒啦！',
                        force: true,
                    });
                    break;
                case 'openSettingsPanel':
                    markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
                    setIsSettingsPanelOpen(true);
                    break;
                case 'resetPosition':
                    void resetPetPosition();
                    break;
                case 'walkLeft':
                    dispatchPetAction({
                        state: 'walk_left',
                        source: 'menu',
                        reason: 'menu walkLeft',
                        force: true,
                    });
                    break;
                case 'walkRight':
                    dispatchPetAction({
                        state: 'walk_right',
                        source: 'menu',
                        reason: 'menu walkRight',
                        force: true,
                    });
                    break;
            }
        });
        return unsubscribe;
    }, [
        dispatchPetAction,
        markUserInteraction,
        resetPetPosition,
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
            setIsDragging(true);
            dispatchPetAction({
                state: 'dragging',
                source: 'interaction',
                reason: 'pointer drag confirmed',
                bubbleText: '别拎我！',
                force: true,
            });
            if (DEBUG_INTERACTION) console.debug('[interaction] drag confirmed');
        }
        window.mochiCat.window.dragMove(event.screenX, event.screenY);
    }, [dispatchPetAction]);

    const endDrag = useCallback(async (didDrag: boolean) => {
        setIsDragging(false);
        await window.mochiCat.window.dragEnd();
        markUserInteraction(USER_ACTION_RANDOM_COOLDOWN_MS);
        if (didDrag) {
            dispatchPetAction({
                state: 'idle',
                source: 'interaction',
                reason: 'drag ended',
                force: true,
            });
            return;
        }
        resetInactivityTimer('drag ended');
    }, [dispatchPetAction, markUserInteraction, resetInactivityTimer]);

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
        dispatchPetAction({
            state: 'happy',
            source: 'interaction',
            reason: 'double-click happy',
            bubbleText: petStateRef.current === 'sleeping' ? '醒啦！' : undefined,
            force: true,
        });
    }, [dispatchPetAction, petStateRef]);

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
        onWalkComplete: () => {
            dispatchPetAction({
                state: 'idle',
                source: 'system',
                reason: 'walking completed',
            });
        },
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
        dispatchPetAction,
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
                    isDragging={isDragging}
                    windowPosition={windowPosition}
                    lastInteractionAgeMs={debugNow - lastInteractionAtRef.current}
                    enteredStateAgeMs={debugNow - enteredStateAtRef.current}
                    actionKind={PET_ACTIONS[petState].kind}
                    actionToken={actionTokenRef.current}
                    manualActionCooldownRemainingMs={Math.max(
                        0,
                        manualActionCooldownUntilRef.current - debugNow,
                    )}
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
