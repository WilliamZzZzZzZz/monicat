import { describe, it, expect } from 'vitest';
import {
    normalizeSettings,
    migrateAndMerge,
    clampSize,
    clampNumber,
    normalizeBehaviorFrequency,
    normalizeSleepAfterIdle,
    DEFAULT_SETTINGS,
    PET_SIZE_MIN,
    PET_SIZE_MAX,
    PET_SIZE_DEFAULT,
    WALKING_SPEED_MIN,
    WALKING_SPEED_MAX,
    WALKING_DURATION_MIN_LIMIT_MS,
    WALKING_DURATION_MAX_LIMIT_MS,
} from './settingsSchema';

// ─────────────────────────────────────────────────────────────────────────────
// clamp helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('clampSize', () => {
    it('clamps below minimum to PET_SIZE_MIN', () => {
        expect(clampSize(0)).toBe(PET_SIZE_MIN);
        expect(clampSize(-100)).toBe(PET_SIZE_MIN);
    });

    it('clamps above maximum to PET_SIZE_MAX', () => {
        expect(clampSize(9999)).toBe(PET_SIZE_MAX);
    });

    it('passes a valid value through unchanged', () => {
        expect(clampSize(150)).toBe(150);
        expect(clampSize(PET_SIZE_DEFAULT)).toBe(PET_SIZE_DEFAULT);
    });

    it('rounds to nearest integer', () => {
        expect(clampSize(100.6)).toBe(101);
    });
});

describe('clampNumber', () => {
    it('clamps below min', () => {
        expect(clampNumber(5, 10, 20)).toBe(10);
    });

    it('clamps above max', () => {
        expect(clampNumber(30, 10, 20)).toBe(20);
    });

    it('leaves valid values unchanged', () => {
        expect(clampNumber(15, 10, 20)).toBe(15);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeBehaviorFrequency
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeBehaviorFrequency', () => {
    it('accepts valid values', () => {
        expect(normalizeBehaviorFrequency('low')).toBe('low');
        expect(normalizeBehaviorFrequency('normal')).toBe('normal');
        expect(normalizeBehaviorFrequency('high')).toBe('high');
    });

    it('returns normal for unknown string', () => {
        expect(normalizeBehaviorFrequency('ultra')).toBe('normal');
    });

    it('returns normal for non-string', () => {
        expect(normalizeBehaviorFrequency(42)).toBe('normal');
        expect(normalizeBehaviorFrequency(null)).toBe('normal');
        expect(normalizeBehaviorFrequency(undefined)).toBe('normal');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeSleepAfterIdle
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeSleepAfterIdle', () => {
    it('returns null for null (disabled)', () => {
        expect(normalizeSleepAfterIdle(null)).toBeNull();
    });

    it('returns null for 0 (disabled)', () => {
        expect(normalizeSleepAfterIdle(0)).toBeNull();
    });

    it('clamps a valid positive ms value', () => {
        const result = normalizeSleepAfterIdle(30_000);
        expect(result).toBeGreaterThanOrEqual(5_000);
        expect(result).toBeLessThanOrEqual(30 * 60_000);
    });

    it('returns default for NaN / Infinity', () => {
        const result = normalizeSleepAfterIdle(NaN);
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeSettings
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeSettings', () => {
    it('clamps petSizePx to valid range', () => {
        const result = normalizeSettings({ ...DEFAULT_SETTINGS, petSizePx: 5 });
        expect(result.petSizePx).toBe(PET_SIZE_MIN);
    });

    it('clamps walkingSpeedPxPerSecond', () => {
        const low = normalizeSettings({ ...DEFAULT_SETTINGS, walkingSpeedPxPerSecond: 0 });
        expect(low.walkingSpeedPxPerSecond).toBe(WALKING_SPEED_MIN);

        const high = normalizeSettings({ ...DEFAULT_SETTINGS, walkingSpeedPxPerSecond: 9999 });
        expect(high.walkingSpeedPxPerSecond).toBe(WALKING_SPEED_MAX);
    });

    it('ensures walkingDurationMinMs <= walkingDurationMaxMs', () => {
        // swap them so min > max
        const result = normalizeSettings({
            ...DEFAULT_SETTINGS,
            walkingDurationMinMs: 8_000,
            walkingDurationMaxMs: 3_000,
        });
        expect(result.walkingDurationMinMs).toBeLessThanOrEqual(result.walkingDurationMaxMs);
    });

    it('clamps walkingDurationMinMs to valid limits', () => {
        const result = normalizeSettings({ ...DEFAULT_SETTINGS, walkingDurationMinMs: 100 });
        expect(result.walkingDurationMinMs).toBe(WALKING_DURATION_MIN_LIMIT_MS);
    });

    it('clamps walkingDurationMaxMs to valid limits', () => {
        const result = normalizeSettings({ ...DEFAULT_SETTINGS, walkingDurationMaxMs: 99_999 });
        expect(result.walkingDurationMaxMs).toBe(WALKING_DURATION_MAX_LIMIT_MS);
    });

    it('normalises invalid behaviorFrequency to normal', () => {
        const result = normalizeSettings({
            ...DEFAULT_SETTINGS,
            behaviorFrequency: 'turbo' as never,
        });
        expect(result.behaviorFrequency).toBe('normal');
    });

    it('allows sleepAfterIdleMs to be null (disabled)', () => {
        const result = normalizeSettings({ ...DEFAULT_SETTINGS, sleepAfterIdleMs: null });
        expect(result.sleepAfterIdleMs).toBeNull();
    });

    it('clamps happyDurationMs', () => {
        const tooShort = normalizeSettings({ ...DEFAULT_SETTINGS, happyDurationMs: 1 });
        expect(tooShort.happyDurationMs).toBe(800);

        const tooLong = normalizeSettings({ ...DEFAULT_SETTINGS, happyDurationMs: 99_999 });
        expect(tooLong.happyDurationMs).toBe(10_000);
    });

    it('passes through valid boolean fields unchanged', () => {
        const result = normalizeSettings({ ...DEFAULT_SETTINGS, alwaysOnTop: false });
        expect(result.alwaysOnTop).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// migrateAndMerge
// ─────────────────────────────────────────────────────────────────────────────
describe('migrateAndMerge', () => {
    it('migrates legacy petSize enum small -> 120', () => {
        const result = migrateAndMerge({ petSize: 'small' });
        expect(result.petSizePx).toBe(120);
    });

    it('migrates legacy petSize enum medium -> PET_SIZE_DEFAULT', () => {
        const result = migrateAndMerge({ petSize: 'medium' });
        expect(result.petSizePx).toBe(PET_SIZE_DEFAULT);
    });

    it('migrates legacy petSize enum large -> PET_SIZE_MAX', () => {
        const result = migrateAndMerge({ petSize: 'large' });
        expect(result.petSizePx).toBe(PET_SIZE_MAX);
    });

    it('uses petSizePx when both petSize and petSizePx are absent — defaults apply', () => {
        const result = migrateAndMerge({});
        expect(result.petSizePx).toBe(PET_SIZE_DEFAULT);
    });

    it('reads petSizePx from parsed object directly', () => {
        const result = migrateAndMerge({ petSizePx: 150 });
        expect(result.petSizePx).toBe(150);
    });

    it('fills missing fields with defaults', () => {
        const result = migrateAndMerge({});
        expect(result.behaviorFrequency).toBe('normal');
        expect(result.alwaysOnTop).toBe(DEFAULT_SETTINGS.alwaysOnTop);
        expect(result.speechBubbleEnabled).toBe(DEFAULT_SETTINGS.speechBubbleEnabled);
    });

    it('accepts valid boolean overrides', () => {
        const result = migrateAndMerge({ alwaysOnTop: false, speechBubbleEnabled: false });
        expect(result.alwaysOnTop).toBe(false);
        expect(result.speechBubbleEnabled).toBe(false);
    });

    it('normalises invalid behaviorFrequency to normal', () => {
        const result = migrateAndMerge({ behaviorFrequency: 'very-fast' });
        expect(result.behaviorFrequency).toBe('normal');
    });

    it('treats sleepAfterIdleMs === 0 as null (disabled)', () => {
        const result = migrateAndMerge({ sleepAfterIdleMs: 0 });
        expect(result.sleepAfterIdleMs).toBeNull();
    });

    it('treats sleepAfterIdleMs === null as disabled', () => {
        const result = migrateAndMerge({ sleepAfterIdleMs: null });
        expect(result.sleepAfterIdleMs).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT_SETTINGS integrity
// ─────────────────────────────────────────────────────────────────────────────
describe('DEFAULT_SETTINGS', () => {
    it('passes normalizeSettings unchanged', () => {
        const normalized = normalizeSettings(DEFAULT_SETTINGS);
        // Only compare fields that don't depend on runtime env (sleepAfterIdleMs varies by DEV flag)
        expect(normalized.petSizePx).toBe(DEFAULT_SETTINGS.petSizePx);
        expect(normalized.behaviorFrequency).toBe(DEFAULT_SETTINGS.behaviorFrequency);
        expect(normalized.walkingSpeedPxPerSecond).toBe(DEFAULT_SETTINGS.walkingSpeedPxPerSecond);
    });

    it('has walkingDurationMinMs <= walkingDurationMaxMs', () => {
        expect(DEFAULT_SETTINGS.walkingDurationMinMs).toBeLessThanOrEqual(
            DEFAULT_SETTINGS.walkingDurationMaxMs,
        );
    });
});
