import React, { useRef, useCallback } from 'react';

// Size constants are still imported by App.tsx (for PET_SIZE_DEFAULT) and
// settingsSchema.ts. The SizeSliderPanel component itself is legacy —
// size controls are now fully integrated into SettingsPanel.
// Do not render SizeSliderPanel directly; use SettingsPanel instead.
export const PET_SIZE_MIN = 96;
export const PET_SIZE_MAX = 260;
export const PET_SIZE_DEFAULT = 220;

interface SizeSliderPanelProps {
    sizePx: number;
    onSizeChange: (px: number) => void;
    onClose: () => void;
}

export function SizeSliderPanel({ sizePx, onSizeChange, onClose }: SizeSliderPanelProps) {
    const debounceRef = useRef<number | null>(null);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        // Update UI immediately
        onSizeChange(value);
        // Debounce persistence
        if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
            void window.mochiCat.settings.update({ petSizePx: value });
        }, 200);
    }, [onSizeChange]);

    const handleReset = useCallback(() => {
        onSizeChange(PET_SIZE_DEFAULT);
        if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
        void window.mochiCat.settings.update({ petSizePx: PET_SIZE_DEFAULT });
    }, [onSizeChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    // Stop mouse/pointer events from bubbling to the pet drag handler
    const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation();

    return (
        <div
            className="size-slider-panel"
            onMouseDown={stopPropagation}
            onPointerDown={stopPropagation}
            onKeyDown={handleKeyDown}
        >
            <div className="size-slider-panel__header">
                <span className="size-slider-panel__title">调整大小</span>
                <button
                    className="size-slider-panel__close"
                    onClick={onClose}
                    onMouseDown={stopPropagation}
                    aria-label="关闭"
                >
                    ✕
                </button>
            </div>
            <div className="size-slider-panel__body">
                <input
                    type="range"
                    min={PET_SIZE_MIN}
                    max={PET_SIZE_MAX}
                    step={1}
                    value={sizePx}
                    onChange={handleChange}
                    className="size-slider-panel__slider"
                />
                <div className="size-slider-panel__value-row">
                    <span className="size-slider-panel__value">{sizePx} px</span>
                    <button
                        className="size-slider-panel__reset"
                        onClick={handleReset}
                        onMouseDown={stopPropagation}
                    >
                        重置
                    </button>
                </div>
            </div>
        </div>
    );
}
