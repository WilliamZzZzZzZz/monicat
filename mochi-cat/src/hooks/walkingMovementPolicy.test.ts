import { describe, it, expect } from 'vitest';
import {
    computeWalkXRange,
    clampToWorkArea,
    hasHitBoundary,
    computeTargetX,
    normalizeWalkingDuration,
    safeWalkingSpeed,
    type WorkArea,
} from './walkingMovementPolicy';

const WORK_AREA: WorkArea = { x: 0, y: 0, width: 1440, height: 900 };
const WIN_WIDTH = 300;

// ─────────────────────────────────────────────────────────────────────────────
// computeWalkXRange
// ─────────────────────────────────────────────────────────────────────────────
describe('computeWalkXRange', () => {
    it('maxX does not exceed workArea right minus windowWidth', () => {
        const [, maxX] = computeWalkXRange(WORK_AREA, WIN_WIDTH);
        expect(maxX).toBe(WORK_AREA.x + WORK_AREA.width - WIN_WIDTH);
    });

    it('minX equals workArea.x', () => {
        const [minX] = computeWalkXRange(WORK_AREA, WIN_WIDTH);
        expect(minX).toBe(WORK_AREA.x);
    });

    it('uses real windowWidth, not a hardcoded 300', () => {
        const [, maxX300] = computeWalkXRange(WORK_AREA, 300);
        const [, maxX400] = computeWalkXRange(WORK_AREA, 400);
        expect(maxX300).not.toBe(maxX400);
        expect(maxX400).toBe(WORK_AREA.width - 400);
    });

    it('maxX is at least minX even when window is wider than workArea', () => {
        const [minX, maxX] = computeWalkXRange(WORK_AREA, 9999);
        expect(maxX).toBeGreaterThanOrEqual(minX);
    });

    it('respects non-zero workArea.x offset', () => {
        const offset: WorkArea = { x: 100, y: 0, width: 1440, height: 900 };
        const [minX, maxX] = computeWalkXRange(offset, WIN_WIDTH);
        expect(minX).toBe(100);
        expect(maxX).toBe(100 + 1440 - WIN_WIDTH);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// clampToWorkArea
// ─────────────────────────────────────────────────────────────────────────────
describe('clampToWorkArea', () => {
    it('walk_right cannot exceed right boundary', () => {
        const tooFar = WORK_AREA.x + WORK_AREA.width + 500;
        const clamped = clampToWorkArea(tooFar, WORK_AREA, WIN_WIDTH);
        expect(clamped).toBeLessThanOrEqual(WORK_AREA.x + WORK_AREA.width - WIN_WIDTH);
    });

    it('walk_left cannot go past left boundary', () => {
        const tooFar = WORK_AREA.x - 500;
        const clamped = clampToWorkArea(tooFar, WORK_AREA, WIN_WIDTH);
        expect(clamped).toBeGreaterThanOrEqual(WORK_AREA.x);
    });

    it('passes through a mid-range value', () => {
        const mid = 700;
        expect(clampToWorkArea(mid, WORK_AREA, WIN_WIDTH)).toBe(mid);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// hasHitBoundary
// ─────────────────────────────────────────────────────────────────────────────
describe('hasHitBoundary', () => {
    it('returns true at right boundary', () => {
        const rightEdge = WORK_AREA.x + WORK_AREA.width - WIN_WIDTH;
        expect(hasHitBoundary(rightEdge, WORK_AREA, WIN_WIDTH)).toBe(true);
    });

    it('returns true at left boundary', () => {
        expect(hasHitBoundary(WORK_AREA.x, WORK_AREA, WIN_WIDTH)).toBe(true);
    });

    it('returns false in the middle', () => {
        expect(hasHitBoundary(700, WORK_AREA, WIN_WIDTH)).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeTargetX
// ─────────────────────────────────────────────────────────────────────────────
describe('computeTargetX', () => {
    it('moves right with direction +1', () => {
        const target = computeTargetX(100, 1, 50, 2000);
        expect(target).toBe(100 + 50 * 2); // 200
    });

    it('moves left with direction -1', () => {
        const target = computeTargetX(500, -1, 50, 2000);
        expect(target).toBe(500 - 100); // 400
    });

    it('returns startX when elapsed is 0', () => {
        expect(computeTargetX(300, 1, 50, 0)).toBe(300);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeWalkingDuration
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeWalkingDuration', () => {
    it('returns valid range when inputs are in range', () => {
        const [min, max] = normalizeWalkingDuration(4_000, 6_000, 2_000, 9_000);
        expect(min).toBe(4_000);
        expect(max).toBe(6_000);
    });

    it('ensures min <= max', () => {
        const [min, max] = normalizeWalkingDuration(8_000, 3_000, 2_000, 9_000);
        expect(min).toBeLessThanOrEqual(max);
    });

    it('clamps min to minLimit', () => {
        const [min] = normalizeWalkingDuration(100, 6_000, 2_000, 9_000);
        expect(min).toBe(2_000);
    });

    it('clamps max to maxLimit', () => {
        const [, max] = normalizeWalkingDuration(4_000, 99_999, 2_000, 9_000);
        expect(max).toBe(9_000);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeWalkingSpeed
// ─────────────────────────────────────────────────────────────────────────────
describe('safeWalkingSpeed', () => {
    it('returns the speed when positive', () => {
        expect(safeWalkingSpeed(35, 30)).toBe(35);
    });

    it('falls back when speed is 0', () => {
        expect(safeWalkingSpeed(0, 30)).toBe(30);
    });

    it('falls back when speed is negative', () => {
        expect(safeWalkingSpeed(-5, 30)).toBe(30);
    });
});
