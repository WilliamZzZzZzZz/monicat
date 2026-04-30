import { useState, useEffect, useRef, useCallback } from 'react';
import { type PetState } from './types/pet';
import { type UserSettings } from './types/global';
import { SpeechBubble } from './components/SpeechBubble';
import { PetSprite } from './components/PetSprite';

const DEFAULT_SETTINGS: UserSettings = {
    petSize: 'medium',
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
    // Ref so callbacks always see latest value without stale closure
    const settingsRef = useRef<UserSettings>(DEFAULT_SETTINGS);
    const updateSettings = (s: UserSettings) => {
        settingsRef.current = s;
        setSettings(s);
    };

    const happyTimerRef = useRef<number | null>(null);
    const bubbleTimerRef = useRef<number | null>(null);
    const inactivityTimerRef = useRef<number | null>(null);
    // Tracks latest petState for use inside timer callbacks
    const petStateRef = useRef<PetState>('idle');
    // True only after actual mouse movement — used to distinguish click from drag
    const hasDraggedRef = useRef(false);

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

    // Load settings on mount and subscribe to changes pushed from main process
    useEffect(() => {
        void window.mochiCat.settings.get().then((s) => updateSettings(s));
        const unsubscribe = window.mochiCat.settings.onChange((s) => updateSettings(s));
        return unsubscribe;
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
            switch (action) {
                case 'pet': triggerHappy('舒服～'); break;
                case 'feed': triggerHappy('小鱼干！'); break;
                case 'sleep': triggerSleep('Zzz...'); break;
                case 'wake': triggerHappy('醒啦！'); break;
            }
        });
        return unsubscribe;
    }, [triggerHappy, triggerSleep]);

    const handleMouseDown = async (event: React.MouseEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        hasDraggedRef.current = false; // reset — dragging only confirmed after mousemove
        await window.mochiCat.window.dragStart();
        setIsDragging(true);
    };

    // Double-click: only fire if no actual movement occurred (not a drag)
    const handleDoubleClick = () => {
        if (hasDraggedRef.current) return;
        triggerHappy(petStateRef.current === 'sleeping' ? '醒啦！' : undefined);
    };

    useEffect(() => {
        const handleMouseMove = () => {
            // Enter dragging state on first move only
            if (!hasDraggedRef.current) {
                hasDraggedRef.current = true;
                petStateRef.current = 'dragging';
                setPetState('dragging');
                showBubble('别拎我！');
                resetInactivityTimer();
            }
            window.mochiCat.window.dragMove();
        };

        const stopDragging = async () => {
            // Capture BEFORE await — dblclick may fire and set happy between mouseup and dragEnd resolution
            const didDrag = hasDraggedRef.current;
            hasDraggedRef.current = false;
            await window.mochiCat.window.dragEnd();
            setIsDragging(false);
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
    }, [isDragging, showBubble, resetInactivityTimer]);

    const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        void window.mochiCat.menu.openPetMenu();
    };

    return (
        <main className={`pet-window size-${settings.petSize}`}>
            <div className="pet-container">
                <SpeechBubble text={bubbleText} visible={bubbleText !== null} />
                <PetSprite
                    state={petState}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                />
            </div>
        </main>
    );
}
