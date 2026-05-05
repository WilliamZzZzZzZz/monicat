/**
 * Pure, side-effect-free helpers for walking movement calculations.
 * Extracted so they can be unit-tested without Electron IPC or RAF.
 */

export interface WorkArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Compute the clamped horizontal range the window may move within.
 * Returns [minX, maxX] where the window left edge must stay.
 */
export function computeWalkXRange(workArea: WorkArea, windowWidth: number): [number, number] {
    const minX = workArea.x;
    const maxX = workArea.x + workArea.width - windowWidth;
    // If window is wider than workArea, allow it to sit at workArea.x
    return [minX, Math.max(minX, maxX)];
}

/**
 * Clamp x so the window stays within the workArea.
 */
export function clampToWorkArea(x: number, workArea: WorkArea, windowWidth: number): number {
    const [minX, maxX] = computeWalkXRange(workArea, windowWidth);
    return Math.max(minX, Math.min(maxX, x));
}

/**
 * Returns true when the walker has hit the left or right boundary.
 */
export function hasHitBoundary(
    x: number,
    workArea: WorkArea,
    windowWidth: number,
): boolean {
    const [minX, maxX] = computeWalkXRange(workArea, windowWidth);
    return x <= minX || x >= maxX;
}

/**
 * Compute the target X position after `elapsedMs` of walking.
 *
 * @param startX          - window left edge when walking began
 * @param direction       - +1 for right, -1 for left
 * @param speedPxPerSec   - pixels per second
 * @param elapsedMs       - elapsed time in milliseconds
 */
export function computeTargetX(
    startX: number,
    direction: 1 | -1,
    speedPxPerSec: number,
    elapsedMs: number,
): number {
    return startX + direction * speedPxPerSec * (elapsedMs / 1000);
}

/**
 * Normalise a walking duration range: min and max are clamped to [minLimit, maxLimit]
 * and min is guaranteed to be ≤ max.
 */
export function normalizeWalkingDuration(
    minMs: number,
    maxMs: number,
    minLimit: number,
    maxLimit: number,
): [number, number] {
    const clampedMin = Math.max(minLimit, Math.min(maxLimit, minMs));
    const clampedMax = Math.max(clampedMin, Math.min(maxLimit, maxMs));
    return [clampedMin, clampedMax];
}

/**
 * Return a valid walking speed, falling back to `fallback` when `speed` is ≤ 0.
 */
export function safeWalkingSpeed(speed: number, fallback: number): number {
    return speed > 0 ? speed : fallback;
}
