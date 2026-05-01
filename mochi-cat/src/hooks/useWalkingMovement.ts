import { useEffect, useRef } from 'react';
import type { PetState } from '../types/pet';
import { DEBUG_WALKING } from '../debug/debugFlags';

export interface UseWalkingMovementParams {
    petState: PetState;
    isDragging: boolean;
    isWindowVisible: boolean;
    walkRunId: number;
    walkingSpeedPxPerSecond: number;
    walkingDurationMinMs: number;
    walkingDurationMaxMs: number;
    onWalkComplete: () => void;
}

/**
 * Drives the Electron window position while petState is walk_right or walk_left.
 * Uses requestAnimationFrame for smooth movement.
 * Stops immediately if dragging starts, window is hidden, or walk duration elapses.
 * Clamps position to the screen workArea.
 */
export function useWalkingMovement({
    petState,
    isDragging,
    isWindowVisible,
    walkRunId,
    walkingSpeedPxPerSecond,
    walkingDurationMinMs,
    walkingDurationMaxMs,
    onWalkComplete,
}: UseWalkingMovementParams): void {
    const rafIdRef = useRef<number | null>(null);
    const onWalkCompleteRef = useRef(onWalkComplete);
    onWalkCompleteRef.current = onWalkComplete;

    useEffect(() => {
        const isWalking = petState === 'walk_right' || petState === 'walk_left';

        if (!isWalking || isDragging || !isWindowVisible) {
            // Cancel any in-progress animation immediately
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            return;
        }

        const direction = petState === 'walk_right' ? 1 : -1;
        const duration =
            walkingDurationMinMs +
            Math.random() * (walkingDurationMaxMs - walkingDurationMinMs);

        let startTime: number | null = null;
        let startX = 0;
        let workArea = { x: 0, y: 0, width: 1280, height: 800 };
        let windowWidth = 300;
        let cancelled = false;

        // Fetch initial position, workArea, and real window bounds from main process
        Promise.all([
            window.mochiCat.window.getPosition(),
            window.mochiCat.window.getWorkArea(),
            window.mochiCat.window.getBounds(),
        ]).then(([pos, area, bounds]) => {
            if (cancelled) return;
            startX = pos[0];
            workArea = area;
            windowWidth = bounds.width;
            const minX = workArea.x;
            const maxX = workArea.x + workArea.width - windowWidth;
            const movementY = pos[1];
            startX = Math.max(minX, Math.min(maxX, startX));
            if (DEBUG_WALKING) {
                console.debug('[walking] started', {
                    state: petState,
                    run: walkRunId,
                    startX,
                    workArea,
                    windowWidth,
                    maxX,
                    direction,
                    duration,
                    walkingSpeedPxPerSecond,
                });
            }

            function frame(timestamp: number) {
                if (cancelled) return;

                if (startTime === null) startTime = timestamp;
                const elapsed = timestamp - startTime;

                const targetX = startX + direction * walkingSpeedPxPerSecond * (elapsed / 1000);

                const clampedX = Math.max(minX, Math.min(maxX, targetX));

                window.mochiCat.window.setPosition(clampedX, movementY).catch(() => {/* noop */ });

                const hitBoundary = clampedX <= minX || clampedX >= maxX;
                const elapsed2 = timestamp - startTime;
                if (elapsed2 >= duration || hitBoundary) {
                    // Walk finished
                    if (DEBUG_WALKING) console.debug('[walking] completed -> idle', { hitBoundary, elapsed: elapsed2 });
                    onWalkCompleteRef.current();
                    return;
                }

                rafIdRef.current = requestAnimationFrame(frame);
            }

            rafIdRef.current = requestAnimationFrame(frame);
        }).catch(() => {
            // If IPC fails, just complete immediately
            if (!cancelled) onWalkCompleteRef.current();
        });

        return () => {
            cancelled = true;
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [
        petState,
        isDragging,
        isWindowVisible,
        walkRunId,
        walkingSpeedPxPerSecond,
        walkingDurationMinMs,
        walkingDurationMaxMs,
    ]);
}
