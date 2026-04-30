import type { MouseEventHandler } from 'react';
import type { PetState } from '../types/pet';
import { useAnimation } from '../hooks/useAnimation';

interface PetSpriteProps {
    state: PetState;
    onMouseDown: MouseEventHandler<HTMLButtonElement>;
    onDoubleClick: MouseEventHandler<HTMLButtonElement>;
    onContextMenu: MouseEventHandler<HTMLButtonElement>;
}

export function PetSprite({ state, onMouseDown, onDoubleClick, onContextMenu }: PetSpriteProps) {
    const { currentFrame } = useAnimation(state);

    return (
        <button
            className={`pet-sprite-button pet-${state}`}
            type="button"
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            aria-label="MochiCat desktop pet"
        >
            {currentFrame ? (
                <img
                    className="pet-sprite-image"
                    src={currentFrame}
                    alt=""
                    draggable={false}
                />
            ) : (
                <span className="pet-sprite-fallback">🐱</span>
            )}
        </button>
    );
}
