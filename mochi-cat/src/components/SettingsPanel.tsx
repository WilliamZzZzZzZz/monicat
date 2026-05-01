import React, { useCallback, useEffect } from 'react';
import type { BehaviorFrequency, UserSettings } from '../types/ipc';
import type { PetState } from '../types/pet';
import { PET_SIZE_MAX, PET_SIZE_MIN } from './SizeSliderPanel';

const WALKING_SPEED_MIN = 20;
const WALKING_SPEED_MAX = 60;

const FREQUENCY_LABELS: Record<BehaviorFrequency, string> = {
    low: '低',
    normal: '正常',
    high: '高',
};

interface SettingsPanelProps {
    settings: UserSettings;
    sizePx: number;
    petState: PetState;
    isWindowVisible: boolean;
    windowPosition: [number, number] | null;
    lastInteractionAgeMs: number;
    onSizePreview: (px: number) => void;
    onSettingsChange: (partial: Partial<UserSettings>) => void;
    onResetPosition: () => void;
    onResetSettings: () => void;
    onClose: () => void;
}

function formatMs(ms: number): string {
    if (ms < 1_000) return `${ms} ms`;
    if (ms < 60_000) return `${Math.round(ms / 1_000)} 秒`;
    return `${Math.round(ms / 60_000)} 分钟`;
}

export function SettingsPanel({
    settings,
    sizePx,
    petState,
    isWindowVisible,
    windowPosition,
    lastInteractionAgeMs,
    onSizePreview,
    onSettingsChange,
    onResetPosition,
    onResetSettings,
    onClose,
}: SettingsPanelProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const stopPropagation = useCallback((event: React.SyntheticEvent) => {
        event.stopPropagation();
    }, []);

    const updateSize = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const nextSize = Number(event.target.value);
        onSizePreview(nextSize);
        onSettingsChange({ petSizePx: nextSize });
    }, [onSettingsChange, onSizePreview]);

    const updateWalkingSpeed = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        onSettingsChange({ walkingSpeedPxPerSecond: Number(event.target.value) });
    }, [onSettingsChange]);

    const updateSleepDelay = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        onSettingsChange({ sleepAfterIdleMs: value === 'never' ? null : Number(value) });
    }, [onSettingsChange]);

    const sleepValue = settings.sleepAfterIdleMs === null ? 'never' : String(settings.sleepAfterIdleMs);
    const baseSleepOptions = [
        ...(import.meta.env.DEV ? [{ value: '15000', label: '15 秒' }] : []),
        { value: '60000', label: '1 分钟' },
        { value: '180000', label: '3 分钟' },
        { value: '300000', label: '5 分钟' },
        { value: '600000', label: '10 分钟' },
        { value: 'never', label: '从不' },
    ];
    const hasSleepValue = baseSleepOptions.some((option) => option.value === sleepValue);
    const sleepOptions = hasSleepValue || sleepValue === 'never'
        ? baseSleepOptions
        : [
            { value: sleepValue, label: formatMs(settings.sleepAfterIdleMs ?? 0) },
            ...baseSleepOptions,
        ];

    return (
        <section
            className="settings-panel"
            aria-label="MochiCat 设置"
            onMouseDown={stopPropagation}
            onMouseUp={stopPropagation}
            onClick={stopPropagation}
            onDoubleClick={stopPropagation}
            onContextMenu={stopPropagation}
            onPointerDown={stopPropagation}
            onPointerMove={stopPropagation}
            onPointerUp={stopPropagation}
        >
            <div className="settings-panel__header">
                <h1 className="settings-panel__title">设置</h1>
                <button
                    className="settings-panel__icon-button"
                    type="button"
                    onClick={onClose}
                    aria-label="关闭设置"
                    title="关闭"
                >
                    ×
                </button>
            </div>

            <div className="settings-panel__body">
                <fieldset className="settings-panel__group">
                    <legend>外观</legend>
                    <label className="settings-panel__range-row">
                        <span>尺寸</span>
                        <input
                            type="range"
                            min={PET_SIZE_MIN}
                            max={PET_SIZE_MAX}
                            step={1}
                            value={sizePx}
                            onChange={updateSize}
                        />
                        <output>{sizePx} px</output>
                    </label>
                    <label className="settings-panel__toggle">
                        <input
                            type="checkbox"
                            checked={settings.speechBubbleEnabled}
                            onChange={(event) => onSettingsChange({ speechBubbleEnabled: event.target.checked })}
                        />
                        <span>气泡</span>
                    </label>
                </fieldset>

                <fieldset className="settings-panel__group">
                    <legend>行为</legend>
                    <label className="settings-panel__toggle">
                        <input
                            type="checkbox"
                            checked={settings.randomBehaviorEnabled}
                            onChange={(event) => onSettingsChange({ randomBehaviorEnabled: event.target.checked })}
                        />
                        <span>随机行为</span>
                    </label>
                    <label className="settings-panel__toggle">
                        <input
                            type="checkbox"
                            checked={settings.autoWalkEnabled}
                            onChange={(event) => onSettingsChange({ autoWalkEnabled: event.target.checked })}
                        />
                        <span>自动走路</span>
                    </label>
                    <div className="settings-panel__control-row">
                        <span>频率</span>
                        <div className="settings-panel__segmented" role="group" aria-label="行为频率">
                            {(['low', 'normal', 'high'] as BehaviorFrequency[]).map((frequency) => (
                                <button
                                    key={frequency}
                                    className={settings.behaviorFrequency === frequency ? 'is-active' : ''}
                                    type="button"
                                    onClick={() => onSettingsChange({ behaviorFrequency: frequency })}
                                >
                                    {FREQUENCY_LABELS[frequency]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="settings-panel__range-row">
                        <span>速度</span>
                        <input
                            type="range"
                            min={WALKING_SPEED_MIN}
                            max={WALKING_SPEED_MAX}
                            step={1}
                            value={settings.walkingSpeedPxPerSecond}
                            onChange={updateWalkingSpeed}
                        />
                        <output>{settings.walkingSpeedPxPerSecond} px/s</output>
                    </label>
                    <label className="settings-panel__select-row">
                        <span>自动睡觉</span>
                        <select value={sleepValue} onChange={updateSleepDelay}>
                            {sleepOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </fieldset>

                <fieldset className="settings-panel__group">
                    <legend>窗口</legend>
                    <label className="settings-panel__toggle">
                        <input
                            type="checkbox"
                            checked={settings.alwaysOnTop}
                            onChange={(event) => onSettingsChange({ alwaysOnTop: event.target.checked })}
                        />
                        <span>始终置顶</span>
                    </label>
                    <div className="settings-panel__button-row">
                        <button type="button" onClick={onResetPosition}>重置位置</button>
                        <button type="button" onClick={onResetSettings}>重置设置</button>
                    </div>
                </fieldset>

                {import.meta.env.DEV && (
                    <fieldset className="settings-panel__group settings-panel__debug">
                        <legend>调试</legend>
                        <dl>
                            <div>
                                <dt>状态</dt>
                                <dd>{petState}</dd>
                            </div>
                            <div>
                                <dt>尺寸</dt>
                                <dd>{sizePx} px</dd>
                            </div>
                            <div>
                                <dt>随机</dt>
                                <dd>{settings.randomBehaviorEnabled ? 'on' : 'off'}</dd>
                            </div>
                            <div>
                                <dt>自动走路</dt>
                                <dd>{settings.autoWalkEnabled ? 'on' : 'off'}</dd>
                            </div>
                            <div>
                                <dt>频率</dt>
                                <dd>{settings.behaviorFrequency}</dd>
                            </div>
                            <div>
                                <dt>位置</dt>
                                <dd>{windowPosition ? `${windowPosition[0]}, ${windowPosition[1]}` : '-'}</dd>
                            </div>
                            <div>
                                <dt>可见</dt>
                                <dd>{isWindowVisible ? 'true' : 'false'}</dd>
                            </div>
                            <div>
                                <dt>交互</dt>
                                <dd>{formatMs(lastInteractionAgeMs)}</dd>
                            </div>
                        </dl>
                    </fieldset>
                )}
            </div>
        </section>
    );
}
