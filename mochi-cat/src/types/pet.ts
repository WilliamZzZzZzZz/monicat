export type PetState =
    | 'idle'
    | 'dragging'
    | 'happy'
    | 'sleeping'
    | 'walk_right'
    | 'walk_left'
    | 'grooming';

export const PET_STATE_EMOJI: Record<PetState, string> = {
    idle: '🐱',
    dragging: '😾',
    happy: '😸',
    sleeping: '😴',
    walk_right: '🐾',
    walk_left: '🐾',
    grooming: '🧼',
};
