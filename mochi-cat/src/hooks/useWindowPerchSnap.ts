import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExternalWindowBounds, PerchMovementBounds, SpriteRectInWindow, WindowBounds } from '../types/ipc';

const SNAP_THRESHOLD_Y = 28;
const SNAP_HORIZONTAL_MARGIN = 24;
const PERCH_OVERLAP_PX = 8;
const REFRESH_INTERVAL_MS = 750;

type PerchState =
    | { mode: 'free' }
    | {
        mode: 'perched';
        targetWindow: ExternalWindowBounds;
        attachedAt: number;
    };

interface UseWindowPerchSnapParams {
    isDragging: boolean;
    isWindowVisible: boolean;
    petVisualRectInWindow: SpriteRectInWindow;
}

interface UseWindowPerchSnapResult {
    detachFromPerch: () => void;
    trySnapToWindowTop: () => Promise<boolean>;
    perchMovementBounds: PerchMovementBounds | null;
}

interface PerchGeometry {
    x: number;
    y: number;
    movementBounds: PerchMovementBounds;
}

function clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.max(min, Math.min(max, value));
}

function getVisualPetBounds(windowBounds: WindowBounds, rect: SpriteRectInWindow): WindowBounds {
    return {
        x: windowBounds.x + rect.left,
        y: windowBounds.y + rect.top,
        width: rect.width,
        height: rect.height,
    };
}

function getPerchGeometry(
    targetWindow: ExternalWindowBounds,
    currentWindowBounds: WindowBounds,
    rect: SpriteRectInWindow,
): PerchGeometry {
    const minWindowX = targetWindow.x - rect.left;
    const maxWindowX = targetWindow.x + targetWindow.width - (rect.left + rect.width);
    const y = targetWindow.y - (rect.top + rect.height) + PERCH_OVERLAP_PX;

    return {
        x: clamp(currentWindowBounds.x, minWindowX, maxWindowX),
        y,
        movementBounds: {
            minX: minWindowX,
            maxX: maxWindowX,
            y,
        },
    };
}

function isMostlyVisible(visualY: number, visualHeight: number, displayBounds: WindowBounds): boolean {
    return visualY + visualHeight * 0.5 >= displayBounds.y;
}

function findBestSnapCandidate(
    petBounds: WindowBounds,
    candidates: ExternalWindowBounds[],
): ExternalWindowBounds | null {
    const petBottom = petBounds.y + petBounds.height;
    const petCenterX = petBounds.x + petBounds.width / 2;

    return candidates
        .map((candidate) => {
            const targetLeft = candidate.x;
            const targetRight = candidate.x + candidate.width;
            const verticalDistance = Math.abs(petBottom - candidate.y);
            const centerDistance = Math.abs(petCenterX - (targetLeft + targetRight) / 2);
            const withinVerticalRange = verticalDistance <= SNAP_THRESHOLD_Y;
            const withinHorizontalRange =
                petCenterX >= targetLeft - SNAP_HORIZONTAL_MARGIN &&
                petCenterX <= targetRight + SNAP_HORIZONTAL_MARGIN;
            const wideEnough = candidate.width >= petBounds.width * 0.8;

            return {
                candidate,
                verticalDistance,
                centerDistance,
                matches: withinVerticalRange && withinHorizontalRange && wideEnough,
            };
        })
        .filter((entry) => entry.matches)
        .sort((a, b) => {
            if (a.verticalDistance !== b.verticalDistance) {
                return a.verticalDistance - b.verticalDistance;
            }
            return a.centerDistance - b.centerDistance;
        })[0]?.candidate ?? null;
}

function findRefreshedTarget(
    targetWindow: ExternalWindowBounds,
    candidates: ExternalWindowBounds[],
): ExternalWindowBounds | null {
    if (targetWindow.id) {
        const exactMatch = candidates.find((candidate) => candidate.id === targetWindow.id);
        if (exactMatch) return exactMatch;
    }

    return candidates.find((candidate) => (
        candidate.appName === targetWindow.appName &&
        candidate.title === targetWindow.title
    )) ?? null;
}

export function useWindowPerchSnap({
    isDragging,
    isWindowVisible,
    petVisualRectInWindow,
}: UseWindowPerchSnapParams): UseWindowPerchSnapResult {
    const [perchState, setPerchState] = useState<PerchState>({ mode: 'free' });
    const perchStateRef = useRef(perchState);
    perchStateRef.current = perchState;

    const detachFromPerch = useCallback(() => {
        setPerchState({ mode: 'free' });
    }, []);

    const trySnapToWindowTop = useCallback(async (): Promise<boolean> => {
        const [windowBounds, displayBounds, candidates] = await Promise.all([
            window.mochiCat.window.getBounds(),
            window.mochiCat.window.getDisplayBounds(),
            window.mochiCat.externalWindows.getVisibleWindows().catch(() => []),
        ]);
        const petBounds = getVisualPetBounds(windowBounds, petVisualRectInWindow);
        const targetWindow = findBestSnapCandidate(petBounds, candidates);

        if (!targetWindow) {
            setPerchState({ mode: 'free' });
            return false;
        }

        const geometry = getPerchGeometry(targetWindow, windowBounds, petVisualRectInWindow);
        const visualY = geometry.y + petVisualRectInWindow.top;
        if (!isMostlyVisible(visualY, petVisualRectInWindow.height, displayBounds)) {
            setPerchState({ mode: 'free' });
            return false;
        }

        await window.mochiCat.window.setPosition(geometry.x, geometry.y);
        setPerchState({
            mode: 'perched',
            targetWindow,
            attachedAt: Date.now(),
        });
        return true;
    }, [petVisualRectInWindow]);

    useEffect(() => {
        if (perchState.mode !== 'perched' || isDragging || !isWindowVisible) return;

        let cancelled = false;

        const refreshTargetWindow = async () => {
            const currentState = perchStateRef.current;
            if (currentState.mode !== 'perched') return;

            const candidates = await window.mochiCat.externalWindows.getVisibleWindows().catch(() => []);
            if (cancelled) return;

            const refreshedTarget = findRefreshedTarget(currentState.targetWindow, candidates);
            if (!refreshedTarget) {
                setPerchState({ mode: 'free' });
                return;
            }

            const [windowBounds, displayBounds] = await Promise.all([
                window.mochiCat.window.getBounds(),
                window.mochiCat.window.getDisplayBounds(),
            ]);
            if (cancelled) return;

            const geometry = getPerchGeometry(refreshedTarget, windowBounds, petVisualRectInWindow);
            const visualY = geometry.y + petVisualRectInWindow.top;
            if (!isMostlyVisible(visualY, petVisualRectInWindow.height, displayBounds)) {
                setPerchState({ mode: 'free' });
                return;
            }

            await window.mochiCat.window.setPosition(geometry.x, geometry.y).catch(() => undefined);
            if (cancelled) return;

            setPerchState({
                mode: 'perched',
                targetWindow: refreshedTarget,
                attachedAt: currentState.attachedAt,
            });
        };

        const intervalId = window.setInterval(() => {
            void refreshTargetWindow();
        }, REFRESH_INTERVAL_MS);
        void refreshTargetWindow();

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [isDragging, isWindowVisible, perchState.mode, petVisualRectInWindow]);

    const perchMovementBounds = useMemo(() => {
        if (perchState.mode !== 'perched') return null;

        return getPerchGeometry(
            perchState.targetWindow,
            {
                x: 0,
                y: 0,
                width: petVisualRectInWindow.width,
                height: petVisualRectInWindow.height,
            },
            petVisualRectInWindow,
        ).movementBounds;
    }, [perchState, petVisualRectInWindow]);

    return {
        detachFromPerch,
        trySnapToWindowTop,
        perchMovementBounds,
    };
}
