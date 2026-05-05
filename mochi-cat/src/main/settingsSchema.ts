/**
 * Pure, Electron-free functions for settings normalization and migration.
 * These are extracted so they can be tested without importing `electron`.
 */
import type { BehaviorFrequency, UserSettings } from '../types/ipc';

export const PET_SIZE_MIN = 96;
export const PET_SIZE_MAX = 260;
export const PET_SIZE_DEFAULT = 220;
export const WALKING_SPEED_MIN = 20;
export const WALKING_SPEED_MAX = 60;
export const WALKING_SPEED_DEFAULT = 35;
export const WALKING_DURATION_MIN_LIMIT_MS = 2_000;
export const WALKING_DURATION_MAX_LIMIT_MS = 9_000;

const DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
const DEFAULT_SLEEP_AFTER_IDLE_MS = DEV ? 15_000 : 5 * 60_000;
const BEHAVIOR_FREQUENCIES: readonly BehaviorFrequency[] = ['low', 'normal', 'high'];

export function clampSize(v: number): number {
    return Math.max(PET_SIZE_MIN, Math.min(PET_SIZE_MAX, Math.round(v)));
}

export function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizeBehaviorFrequency(value: unknown): BehaviorFrequency {
    return BEHAVIOR_FREQUENCIES.includes(value as BehaviorFrequency)
        ? value as BehaviorFrequency
        : 'normal';
}

export function normalizeSleepAfterIdle(value: unknown): number | null {
    if (value === null || value === 0) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SLEEP_AFTER_IDLE_MS;
    return clampNumber(value, 5_000, 30 * 60_000);
}

export const DEFAULT_SETTINGS: UserSettings = {
    petSizePx: PET_SIZE_DEFAULT,
    alwaysOnTop: true,
    speechBubbleEnabled: true,
    randomBehaviorEnabled: true,
    autoWalkEnabled: true,
    behaviorFrequency: 'normal',
    walkingSpeedPxPerSecond: WALKING_SPEED_DEFAULT,
    walkingDurationMinMs: 4_000,
    walkingDurationMaxMs: 6_000,
    sleepAfterIdleMs: DEFAULT_SLEEP_AFTER_IDLE_MS,
    happyDurationMs: 2_500,
    bubbleDurationMs: 1_800,
};

export function normalizeSettings(settings: UserSettings): UserSettings {
    const walkingDurationMinMs = clampNumber(
        settings.walkingDurationMinMs,
        WALKING_DURATION_MIN_LIMIT_MS,
        WALKING_DURATION_MAX_LIMIT_MS,
    );
    const walkingDurationMaxMs = clampNumber(
        settings.walkingDurationMaxMs,
        walkingDurationMinMs,
        WALKING_DURATION_MAX_LIMIT_MS,
    );

    return {
        petSizePx: clampSize(settings.petSizePx),
        alwaysOnTop: settings.alwaysOnTop,
        speechBubbleEnabled: settings.speechBubbleEnabled,
        randomBehaviorEnabled: settings.randomBehaviorEnabled,
        autoWalkEnabled: settings.autoWalkEnabled,
        behaviorFrequency: normalizeBehaviorFrequency(settings.behaviorFrequency),
        walkingSpeedPxPerSecond: clampNumber(
            settings.walkingSpeedPxPerSecond,
            WALKING_SPEED_MIN,
            WALKING_SPEED_MAX,
        ),
        walkingDurationMinMs,
        walkingDurationMaxMs,
        sleepAfterIdleMs: normalizeSleepAfterIdle(settings.sleepAfterIdleMs),
        happyDurationMs: clampNumber(settings.happyDurationMs, 800, 10_000),
        bubbleDurationMs: clampNumber(settings.bubbleDurationMs, 300, 10_000),
    };
}

/** Migrate an old settings file that may still contain petSize enum and merge with defaults. */
export function migrateAndMerge(parsed: Record<string, unknown>): UserSettings {
    const base: UserSettings = { ...DEFAULT_SETTINGS };

    // Migrate legacy petSize enum -> petSizePx
    if (typeof parsed['petSize'] === 'string' && !('petSizePx' in parsed)) {
        const legacyMap: Record<string, number> = {
            small: 120,
            medium: PET_SIZE_DEFAULT,
            large: PET_SIZE_MAX,
        };
        base.petSizePx = legacyMap[parsed['petSize'] as string] ?? PET_SIZE_DEFAULT;
    } else if (typeof parsed['petSizePx'] === 'number') {
        base.petSizePx = clampSize(parsed['petSizePx'] as number);
    }

    if (typeof parsed['alwaysOnTop'] === 'boolean') base.alwaysOnTop = parsed['alwaysOnTop'];
    if (typeof parsed['speechBubbleEnabled'] === 'boolean') base.speechBubbleEnabled = parsed['speechBubbleEnabled'];
    if (typeof parsed['randomBehaviorEnabled'] === 'boolean') base.randomBehaviorEnabled = parsed['randomBehaviorEnabled'];
    if (typeof parsed['autoWalkEnabled'] === 'boolean') base.autoWalkEnabled = parsed['autoWalkEnabled'];
    base.behaviorFrequency = normalizeBehaviorFrequency(parsed['behaviorFrequency']);
    if (typeof parsed['walkingSpeedPxPerSecond'] === 'number') {
        base.walkingSpeedPxPerSecond = parsed['walkingSpeedPxPerSecond'];
    }
    if (typeof parsed['walkingDurationMinMs'] === 'number') {
        base.walkingDurationMinMs = parsed['walkingDurationMinMs'];
    }
    if (typeof parsed['walkingDurationMaxMs'] === 'number') {
        base.walkingDurationMaxMs = parsed['walkingDurationMaxMs'];
    }
    if (typeof parsed['sleepAfterIdleMs'] === 'number' || parsed['sleepAfterIdleMs'] === null) {
        base.sleepAfterIdleMs = normalizeSleepAfterIdle(parsed['sleepAfterIdleMs']);
    }
    if (typeof parsed['happyDurationMs'] === 'number') base.happyDurationMs = parsed['happyDurationMs'];
    if (typeof parsed['bubbleDurationMs'] === 'number') base.bubbleDurationMs = parsed['bubbleDurationMs'];

    return normalizeSettings(base);
}
