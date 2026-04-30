export type PetState = 'idle' | 'dragging' | 'happy' | 'sleeping';

export const PET_STATE_EMOJI: Record<PetState, string> = {
    idle: '🐱',
    dragging: '😾',
    happy: '😸',
    sleeping: '😴',
};
