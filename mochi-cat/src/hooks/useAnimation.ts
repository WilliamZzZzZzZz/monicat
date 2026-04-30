import { useEffect, useState } from 'react';
import type { PetState } from '../types/pet';
import { animationConfig } from '../animation/animationConfig';

export function useAnimation(state: PetState): {
    currentFrame: string;
    frameIndex: number;
    frameCount: number;
} {
    const definition = animationConfig[state];
    const [frameIndex, setFrameIndex] = useState(0);

    // Reset to first frame whenever state changes
    useEffect(() => {
        setFrameIndex(0);
    }, [state]);

    // Advance frames on an interval based on fps
    useEffect(() => {
        if (!definition || definition.frames.length <= 1 || definition.fps <= 0) {
            return;
        }

        const intervalMs = 1000 / definition.fps;

        const timerId = window.setInterval(() => {
            setFrameIndex((current) => {
                const next = current + 1;
                if (next >= definition.frames.length) {
                    return definition.loop ? 0 : definition.frames.length - 1;
                }
                return next;
            });
        }, intervalMs);

        return () => {
            window.clearInterval(timerId);
        };
    }, [definition, state]);

    return {
        currentFrame: definition.frames[frameIndex] ?? definition.frames[0] ?? '',
        frameIndex,
        frameCount: definition.frames.length,
    };
}
