import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePetActionController, USER_ACTION_RANDOM_COOLDOWN_MS } from './usePetActionController';
import type { UserSettings } from '../types/ipc';
import type { PetActionRequest } from '../actions/actionTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SLEEP_AFTER_IDLE_MS = 10_000;

const DEFAULT_SETTINGS: UserSettings = {
    petSizePx: 220,
    alwaysOnTop: true,
    speechBubbleEnabled: true,
    randomBehaviorEnabled: true,
    autoWalkEnabled: true,
    behaviorFrequency: 'normal',
    walkingSpeedPxPerSecond: 35,
    walkingDurationMinMs: 4_000,
    walkingDurationMaxMs: 6_000,
    sleepAfterIdleMs: SLEEP_AFTER_IDLE_MS,
    happyDurationMs: 2_500,
    bubbleDurationMs: 1_800,
};

function makeHook(overrides: Partial<UserSettings> = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...overrides };
    const showBubble = vi.fn();
    const clearBubble = vi.fn();
    const onLocomotionActionStarted = vi.fn();

    const { result, rerender, unmount } = renderHook(() =>
        usePetActionController({
            settings,
            isWindowVisible: true,
            showBubble,
            clearBubble,
            onLocomotionActionStarted,
        }),
    );

    return { result, rerender, unmount, showBubble, clearBubble, onLocomotionActionStarted };
}

function dispatch(result: ReturnType<typeof makeHook>['result'], req: PetActionRequest): boolean {
    let accepted = false;
    act(() => {
        accepted = result.current.dispatchPetAction(req);
    });
    return accepted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
describe('initial state', () => {
    it('starts in idle', () => {
        const { result } = makeHook();
        expect(result.current.petState).toBe('idle');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// oneShot: happy
// ─────────────────────────────────────────────────────────────────────────────
describe('happy oneShot', () => {
    it('transitions to happy on dispatch', () => {
        const { result } = makeHook();
        dispatch(result, { state: 'happy', source: 'menu', reason: 'test' });
        expect(result.current.petState).toBe('happy');
    });

    it('returns to idle after happyDurationMs', () => {
        const { result } = makeHook({ happyDurationMs: 2_500 });
        dispatch(result, { state: 'happy', source: 'menu', reason: 'test' });

        act(() => { vi.advanceTimersByTime(2_500); });
        expect(result.current.petState).toBe('idle');
    });

    it('happy timer does NOT fire after being preempted by walk_right', () => {
        const { result } = makeHook({ happyDurationMs: 2_500 });

        dispatch(result, { state: 'happy', source: 'menu', reason: 'test' });
        expect(result.current.petState).toBe('happy');

        // Preempt with walk_right before happy timer fires
        dispatch(result, { state: 'walk_right', source: 'menu', reason: 'walk' });
        expect(result.current.petState).toBe('walk_right');

        // Advance past happy duration — state must still be walk_right
        act(() => { vi.advanceTimersByTime(2_500); });
        expect(result.current.petState).toBe('walk_right');
    });

    it('happy timer does NOT fire after being preempted by sleeping', () => {
        const { result } = makeHook({ happyDurationMs: 2_500 });

        dispatch(result, { state: 'happy', source: 'menu', reason: 'test' });
        dispatch(result, { state: 'sleeping', source: 'menu', reason: 'sleep' });
        expect(result.current.petState).toBe('sleeping');

        act(() => { vi.advanceTimersByTime(2_500); });
        expect(result.current.petState).toBe('sleeping');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// oneShot: grooming
// ─────────────────────────────────────────────────────────────────────────────
describe('grooming oneShot', () => {
    it('transitions to grooming', () => {
        const { result } = makeHook();
        dispatch(result, { state: 'grooming', source: 'menu', reason: 'test' });
        expect(result.current.petState).toBe('grooming');
    });

    it('returns to idle after grooming duration', () => {
        const { result } = makeHook();
        const GROOMING_DURATION = 1_100; // use explicit durationMs

        dispatch(result, {
            state: 'grooming',
            source: 'menu',
            reason: 'test',
            durationMs: GROOMING_DURATION,
        });

        act(() => { vi.advanceTimersByTime(GROOMING_DURATION); });
        expect(result.current.petState).toBe('idle');
    });

    it('grooming timer does NOT fire after being preempted by walk_right', () => {
        const { result } = makeHook();
        const GROOMING_DURATION = 1_100;

        dispatch(result, {
            state: 'grooming',
            source: 'menu',
            reason: 'test',
            durationMs: GROOMING_DURATION,
        });

        dispatch(result, { state: 'walk_right', source: 'menu', reason: 'walk' });
        expect(result.current.petState).toBe('walk_right');

        act(() => { vi.advanceTimersByTime(GROOMING_DURATION); });
        expect(result.current.petState).toBe('walk_right');
    });

    it('grooming timer does NOT fire after being preempted by sleeping', () => {
        const { result } = makeHook();
        const GROOMING_DURATION = 1_100;

        dispatch(result, {
            state: 'grooming',
            source: 'menu',
            reason: 'test',
            durationMs: GROOMING_DURATION,
        });

        dispatch(result, { state: 'sleeping', source: 'menu', reason: 'sleep' });

        act(() => { vi.advanceTimersByTime(GROOMING_DURATION); });
        expect(result.current.petState).toBe('sleeping');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// walking completed
// ─────────────────────────────────────────────────────────────────────────────
describe('walking completed', () => {
    it('walk_right -> idle after system walking-completed dispatch', () => {
        const { result } = makeHook();
        dispatch(result, { state: 'walk_right', source: 'menu', reason: 'walk' });
        expect(result.current.petState).toBe('walk_right');

        dispatch(result, { state: 'idle', source: 'system', reason: 'walking completed' });
        expect(result.current.petState).toBe('idle');
    });

    it('stale walking-completed dispatch is rejected when not in locomotion state', () => {
        const { result } = makeHook();
        // Start from idle (no locomotion)
        const accepted = dispatch(result, {
            state: 'idle',
            source: 'system',
            reason: 'walking completed',
        });
        expect(accepted).toBe(false);
        expect(result.current.petState).toBe('idle');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// inactivity / sleeping timer
// ─────────────────────────────────────────────────────────────────────────────
describe('inactivity timer', () => {
    it('transitions to sleeping from idle after sleepAfterIdleMs', () => {
        const { result } = makeHook({ sleepAfterIdleMs: SLEEP_AFTER_IDLE_MS });

        act(() => { vi.advanceTimersByTime(SLEEP_AFTER_IDLE_MS); });
        expect(result.current.petState).toBe('sleeping');
    });

    it('does NOT sleep from happy — inactivity cannot interrupt oneShot', () => {
        const { result } = makeHook({ happyDurationMs: 60_000 });

        dispatch(result, { state: 'happy', source: 'menu', reason: 'test' });
        act(() => { vi.advanceTimersByTime(SLEEP_AFTER_IDLE_MS); });

        // Still happy — inactivity timer was not scheduled outside idle
        expect(result.current.petState).toBe('happy');
    });

    it('does NOT sleep from grooming — inactivity cannot interrupt oneShot', () => {
        const { result } = makeHook();

        dispatch(result, {
            state: 'grooming',
            source: 'menu',
            reason: 'test',
            durationMs: 60_000,
        });
        act(() => { vi.advanceTimersByTime(SLEEP_AFTER_IDLE_MS); });

        expect(result.current.petState).toBe('grooming');
    });

    it('does NOT sleep from walk_right — inactivity cannot interrupt locomotion', () => {
        const { result } = makeHook();

        dispatch(result, { state: 'walk_right', source: 'menu', reason: 'walk' });
        act(() => { vi.advanceTimersByTime(SLEEP_AFTER_IDLE_MS); });

        expect(result.current.petState).toBe('walk_right');
    });

    it('inactivity timer is disabled when sleepAfterIdleMs is null', () => {
        const { result } = makeHook({ sleepAfterIdleMs: null });

        act(() => { vi.advanceTimersByTime(60_000); });
        expect(result.current.petState).toBe('idle');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// dragging lifecycle
// ─────────────────────────────────────────────────────────────────────────────
describe('dragging lifecycle', () => {
    it('transitions to dragging from idle', () => {
        const { result } = makeHook();
        dispatch(result, { state: 'dragging', source: 'interaction', reason: 'drag start' });
        expect(result.current.petState).toBe('dragging');
    });

    it('random actions are rejected while dragging', () => {
        const { result } = makeHook();

        dispatch(result, { state: 'dragging', source: 'interaction', reason: 'drag start' });

        const accepted = dispatch(result, {
            state: 'happy',
            source: 'random',
            reason: 'random selfHappy',
        });
        expect(accepted).toBe(false);
        expect(result.current.petState).toBe('dragging');
    });

    it('menu actions are rejected while dragging', () => {
        const { result } = makeHook();

        dispatch(result, { state: 'dragging', source: 'interaction', reason: 'drag start' });

        const accepted = dispatch(result, {
            state: 'happy',
            source: 'menu',
            reason: 'menu pet',
        });
        expect(accepted).toBe(false);
        expect(result.current.petState).toBe('dragging');
    });

    it('drag end (interaction -> idle) is accepted while dragging', () => {
        const { result } = makeHook();

        dispatch(result, { state: 'dragging', source: 'interaction', reason: 'drag start' });
        dispatch(result, { state: 'idle', source: 'interaction', reason: 'drag end' });

        expect(result.current.petState).toBe('idle');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// random action dispatch rules
// ─────────────────────────────────────────────────────────────────────────────
describe('random action dispatch rules', () => {
    it('random action cannot interrupt oneShot (happy)', () => {
        const { result } = makeHook({ happyDurationMs: 60_000 });

        dispatch(result, { state: 'happy', source: 'menu', reason: 'test' });

        const accepted = dispatch(result, {
            state: 'grooming',
            source: 'random',
            reason: 'random grooming',
        });
        expect(accepted).toBe(false);
        expect(result.current.petState).toBe('happy');
    });

    it('random action cannot interrupt locomotion (walk_right)', () => {
        const { result } = makeHook();

        dispatch(result, { state: 'walk_right', source: 'menu', reason: 'walk' });

        const accepted = dispatch(result, {
            state: 'happy',
            source: 'random',
            reason: 'random happy',
        });
        expect(accepted).toBe(false);
        expect(result.current.petState).toBe('walk_right');
    });

    it('random action is rejected within USER_ACTION_RANDOM_COOLDOWN_MS of a menu action', () => {
        const { result } = makeHook();

        // trigger a menu action first to start manual cooldown
        dispatch(result, { state: 'sleeping', source: 'menu', reason: 'sleep' });
        dispatch(result, { state: 'idle', source: 'menu', reason: 'wake' });

        // Advance only partway through the cooldown
        act(() => { vi.advanceTimersByTime(USER_ACTION_RANDOM_COOLDOWN_MS - 100); });

        const accepted = dispatch(result, {
            state: 'happy',
            source: 'random',
            reason: 'random selfHappy',
        });
        expect(accepted).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// menu/manual can interrupt blocking states (except dragging)
// ─────────────────────────────────────────────────────────────────────────────
describe('menu/manual interrupts', () => {
    it('menu action can interrupt oneShot (happy -> grooming)', () => {
        const { result } = makeHook({ happyDurationMs: 60_000 });

        dispatch(result, { state: 'happy', source: 'menu', reason: 'test' });

        const accepted = dispatch(result, {
            state: 'grooming',
            source: 'menu',
            reason: 'menu grooming',
        });
        expect(accepted).toBe(true);
        expect(result.current.petState).toBe('grooming');
    });

    it('menu action can interrupt locomotion (walk -> sleeping)', () => {
        const { result } = makeHook();

        dispatch(result, { state: 'walk_right', source: 'menu', reason: 'walk' });

        const accepted = dispatch(result, {
            state: 'sleeping',
            source: 'menu',
            reason: 'menu sleep',
        });
        expect(accepted).toBe(true);
        expect(result.current.petState).toBe('sleeping');
    });

    it('menu action can interrupt sleeping (sleeping -> happy)', () => {
        const { result } = makeHook();

        dispatch(result, { state: 'sleeping', source: 'menu', reason: 'sleep' });

        const accepted = dispatch(result, {
            state: 'happy',
            source: 'menu',
            reason: 'wake happy',
        });
        expect(accepted).toBe(true);
        expect(result.current.petState).toBe('happy');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// sleeping -> wake -> walk flow
// ─────────────────────────────────────────────────────────────────────────────
describe('sleeping -> wake -> walk flow', () => {
    it('sleeping -> wake (idle) -> walk_right', () => {
        const { result } = makeHook();

        dispatch(result, { state: 'sleeping', source: 'menu', reason: 'sleep' });
        expect(result.current.petState).toBe('sleeping');

        dispatch(result, { state: 'idle', source: 'menu', reason: 'wake' });
        expect(result.current.petState).toBe('idle');

        dispatch(result, { state: 'walk_right', source: 'menu', reason: 'walk' });
        expect(result.current.petState).toBe('walk_right');
    });
});
