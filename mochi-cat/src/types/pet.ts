export type PetState =
    | 'idle'
    | 'dragging'
    | 'happy'
    | 'sleeping'
    | 'walk_right'
    | 'walk_left'
    | 'grooming';

/**
 * PET_STATE_EMOJI maps every PetState to a representative emoji.
 * Used in the dev debug panel and available for accessibility labels,
 * tray tooltips, or logging in future phases.
 */
export const PET_STATE_EMOJI: Record<PetState, string> = {
    idle: '🐱',
    dragging: '😾',
    happy: '😸',
    sleeping: '😴',
    walk_right: '🐾',
    walk_left: '🐾',
    grooming: '🧼',
};
