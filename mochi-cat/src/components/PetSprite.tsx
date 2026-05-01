import type { MouseEventHandler, PointerEventHandler } from 'react';
import type { PetState } from '../types/pet';
import { useAnimation } from '../hooks/useAnimation';

interface PetSpriteProps {
    state: PetState;
    onPointerDown: PointerEventHandler<HTMLButtonElement>;
    onPointerMove: PointerEventHandler<HTMLButtonElement>;
    onPointerUp: PointerEventHandler<HTMLButtonElement>;
    onPointerCancel: PointerEventHandler<HTMLButtonElement>;
    onDoubleClick: MouseEventHandler<HTMLButtonElement>;
    onContextMenu: MouseEventHandler<HTMLButtonElement>;
}

export function PetSprite({
    state,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onDoubleClick,
    onContextMenu,
}: PetSpriteProps) {
    const { currentFrame } = useAnimation(state);

    return (
        <button
            className={`pet-sprite-button pet-${state}`}
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
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
