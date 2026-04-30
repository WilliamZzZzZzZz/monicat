import type { PetState } from '../types/pet';

export interface AnimationDefinition {
    fps: number;
    loop: boolean;
    frames: string[];
}

export type AnimationConfig = Record<PetState, AnimationDefinition>;
