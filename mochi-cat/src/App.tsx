import { useState, useEffect, useRef, useCallback } from 'react';
import { type PetState } from './types/pet';
import { type UserSettings } from './types/global';
import { SpeechBubble } from './components/SpeechBubble';
import { PetSprite } from './components/PetSprite';
import { useRandomBehavior } from './hooks/useRandomBehavior';
import { useWalkingMovement } from './hooks/useWalkingMovement';
import { SizeSliderPanel, PET_SIZE_DEFAULT } from './components/SizeSliderPanel';

const DEFAULT_SETTINGS: UserSettings = {
    petSizePx: PET_SIZE_DEFAULT,
    alwaysOnTop: true,
    speechBubbleEnabled: true,
    randomBehaviorEnabled: true,
};

const HAPPY_DURATION_MS = 2500;
const BUBBLE_DURATION_MS = 1800;
const INACTIVITY_TIMEOUT_MS = import.meta.env.DEV ? 15_000 : 5 * 60_000;

export default function App() {
    const [petState, setPetState] = useState<PetState>('idle');
    const [isDragging, setIsDragging] = useState(false);
    const [bubbleText, setBubbleText] = useState<string | null>(null);
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [isSizePanelOpen, setIsSizePanelOpen] = useState(false);
    // Local sizePx mirrors settings.petSizePx but updates immediately while dragging the slider
    const [localSizePx, setLocalSizePx] = useState<number>(DEFAULT_SETTINGS.petSizePx);
    // Ref so callbacks always see latest value without stale closure
    const settingsRef = useRef<UserSettings>(DEFAULT_SETTINGS);
    const updateSettings = (s: UserSettings) => {
        settingsRef.current = s;
        setSettings(s);
        setLocalSizePx(s.petSizePx);
    };

    const happyTimerRef = useRef<number | null>(null);
    const bubbleTimerRef = useRef<number | null>(null);
    const inactivityTimerRef = useRef<number | null>(null);
    // Tracks latest petState for use inside timer callbacks
    const petStateRef = useRef<PetState>('idle');
    // True only after actual mouse movement — used to distinguish click from drag
    const hasDraggedRef = useRef(false);
    // Random behavior: track last user interaction and when current state was entered
    const lastInteractionAtRef = useRef<number>(Date.now());
    const enteredStateAtRef = useRef<number>(Date.now());
    const [isWindowVisible, setIsWindowVisible] = useState(true);

    const markUserInteraction = useCallback(() => {
        lastInteractionAtRef.current = Date.now();
    }, []);

    const showBubble = useCallback((text: string) => {
        if (!settingsRef.current.speechBubbleEnabled) return;
        setBubbleText(text);
        if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = window.setTimeout(() => setBubbleText(null), BUBBLE_DURATION_MS);
    }, []);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current !== null) window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = window.setTimeout(() => {
            if (petStateRef.current === 'idle') {
                petStateRef.current = 'sleeping';
                setPetState('sleeping');
                showBubble('Zzz...');
            }
        }, INACTIVITY_TIMEOUT_MS);
    }, [showBubble]);

    const triggerHappy = useCallback((bubbleOverride?: string) => {
        if (happyTimerRef.current !== null) window.clearTimeout(happyTimerRef.current);
        petStateRef.current = 'happy';
        setPetState('happy');
        showBubble(bubbleOverride ?? '喵～');
        resetInactivityTimer();
        happyTimerRef.current = window.setTimeout(() => {
            petStateRef.current = 'idle';
            setPetState('idle');
            resetInactivityTimer();
        }, HAPPY_DURATION_MS);
    }, [showBubble, resetInactivityTimer]);

    const triggerSleep = useCallback((bubbleOverride?: string) => {
        if (happyTimerRef.current !== null) window.clearTimeout(happyTimerRef.current);
        petStateRef.current = 'sleeping';
        setPetState('sleeping');
        showBubble(bubbleOverride ?? 'Zzz...');
    }, [showBubble]);

    const triggerIdle = useCallback(() => {
        petStateRef.current = 'idle';
        setPetState('idle');
        resetInactivityTimer();
    }, [resetInactivityTimer]);

    const triggerWalkRight = useCallback(() => {
        if (happyTimerRef.current !== null) window.clearTimeout(happyTimerRef.current);
        petStateRef.current = 'walk_right';
        setPetState('walk_right');
    }, []);

    const triggerWalkLeft = useCallback(() => {
        if (happyTimerRef.current !== null) window.clearTimeout(happyTimerRef.current);
        petStateRef.current = 'walk_left';
        setPetState('walk_left');
    }, []);

    // Load settings on mount and subscribe to changes pushed from main process
    useEffect(() => {
        void window.mochiCat.settings.get().then((s) => updateSettings(s));
        const unsubscribe = window.mochiCat.settings.onChange((s) => updateSettings(s));
        return unsubscribe;
    }, []);

    // Track when petState was entered (used by random behavior to compute state duration)
    useEffect(() => {
        enteredStateAtRef.current = Date.now();
    }, [petState]);

    // Subscribe to window visibility changes from main process
    useEffect(() => {
        return window.mochiCat.window.onVisibilityChanged(setIsWindowVisible);
    }, []);

    // Start inactivity timer on mount, clean up all timers on unmount
    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (happyTimerRef.current !== null) window.clearTimeout(happyTimerRef.current);
            if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
            if (inactivityTimerRef.current !== null) window.clearTimeout(inactivityTimerRef.current);
        };
    }, [resetInactivityTimer]);

    // Subscribe to native context menu actions from main process
    useEffect(() => {
        const unsubscribe = window.mochiCat.pet.onMenuAction((action) => {
            markUserInteraction();
            switch (action) {
                case 'pet': triggerHappy('舒服～'); break;
                case 'feed': triggerHappy('小鱼干！'); break;
                case 'sleep': triggerSleep('Zzz...'); break;
                case 'wake': triggerHappy('醒啦！'); break;
                case 'openSizePanel': setIsSizePanelOpen(true); break;
                case 'walkLeft': triggerWalkLeft(); break;
                case 'walkRight': triggerWalkRight(); break;
            }
        });
        return unsubscribe;
    }, [triggerHappy, triggerSleep, triggerWalkLeft, triggerWalkRight, markUserInteraction]);

    const handleMouseDown = async (event: React.MouseEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        markUserInteraction();
        hasDraggedRef.current = false; // reset — dragging only confirmed after mousemove
        await window.mochiCat.window.dragStart(event.screenX, event.screenY);
        setIsDragging(true);
    };

    // Double-click: only fire if no actual movement occurred (not a drag)
    const handleDoubleClick = () => {
        if (hasDraggedRef.current) return;
        markUserInteraction();
        triggerHappy(petStateRef.current === 'sleeping' ? '醒啦！' : undefined);
    };

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            // Enter dragging state on first move only
            if (!hasDraggedRef.current) {
                hasDraggedRef.current = true;
                petStateRef.current = 'dragging';
                setPetState('dragging');
                showBubble('别拎我！');
                resetInactivityTimer();
            }
            window.mochiCat.window.dragMove(event.screenX, event.screenY);
        };

        const stopDragging = async () => {
            // Capture BEFORE await — dblclick may fire and set happy between mouseup and dragEnd resolution
            const didDrag = hasDraggedRef.current;
            hasDraggedRef.current = false;
            await window.mochiCat.window.dragEnd();
            setIsDragging(false);
            markUserInteraction();
            if (didDrag) {
                // Only reset to idle when actual movement happened; pure clicks must not overwrite happy
                petStateRef.current = 'idle';
                setPetState('idle');
            }
            resetInactivityTimer();
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', stopDragging);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopDragging);
        };
    }, [isDragging, showBubble, resetInactivityTimer, markUserInteraction]);

    const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        markUserInteraction();
        void window.mochiCat.menu.openPetMenu();
    };

    useWalkingMovement({
        petState,
        isDragging,
        isWindowVisible,
        onWalkComplete: triggerIdle,
    });

    useRandomBehavior({
        petState,
        randomBehaviorEnabled: settings.randomBehaviorEnabled,
        isWindowVisible,
        lastInteractionAtRef,
        enteredStateAtRef,
        triggerHappy,
        triggerSleep,
        triggerWalkLeft,
        triggerWalkRight,
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
                    onMouseDown={handleMouseDown}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                />
            </div>
            {isSizePanelOpen && (
                <SizeSliderPanel
                    sizePx={localSizePx}
                    onSizeChange={setLocalSizePx}
                    onClose={() => setIsSizePanelOpen(false)}
                />
            )}
        </main>
    );
}
