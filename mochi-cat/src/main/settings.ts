import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { UserSettings } from '../types/ipc';
import {
    PET_SIZE_MIN,
    PET_SIZE_MAX,
    PET_SIZE_DEFAULT,
    WALKING_SPEED_MIN,
    WALKING_SPEED_MAX,
    WALKING_SPEED_DEFAULT,
    WALKING_DURATION_MIN_LIMIT_MS,
    WALKING_DURATION_MAX_LIMIT_MS,
    DEFAULT_SETTINGS,
    normalizeSettings,
    migrateAndMerge,
} from './settingsSchema';

// Re-export schema constants so existing imports don't break.
export {
    PET_SIZE_MIN,
    PET_SIZE_MAX,
    PET_SIZE_DEFAULT,
    WALKING_SPEED_MIN,
    WALKING_SPEED_MAX,
    WALKING_SPEED_DEFAULT,
    WALKING_DURATION_MIN_LIMIT_MS,
    WALKING_DURATION_MAX_LIMIT_MS,
};

/** @deprecated Use DEFAULT_SETTINGS from settingsSchema instead. */
export const defaultSettings: UserSettings = DEFAULT_SETTINGS;

function settingsFilePath(): string {
    return path.join(app.getPath('userData'), 'settings.json');
}

function needsWriteBack(parsed: Record<string, unknown>, normalized: UserSettings): boolean {
    return Object.keys(DEFAULT_SETTINGS).some((key) => parsed[key] !== normalized[key as keyof UserSettings]);
}

export const settingsService = {
    load(): UserSettings {
        try {
            const raw = fs.readFileSync(settingsFilePath(), 'utf-8');
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const normalized = migrateAndMerge(parsed);
            if (needsWriteBack(parsed, normalized)) {
                this.save(normalized);
            }
            return normalized;
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    },

    save(settings: UserSettings): void {
        try {
            fs.writeFileSync(settingsFilePath(), JSON.stringify(settings, null, 2), 'utf-8');
        } catch (err) {
            console.error('[settings] failed to save:', err);
        }
    },

    update(partial: Partial<UserSettings>): UserSettings {
        const current = this.load();
        const merged = normalizeSettings({ ...current, ...partial });
        this.save(merged);
        return merged;
    },

    reset(): UserSettings {
        const fresh = { ...DEFAULT_SETTINGS };
        this.save(fresh);
        return fresh;
    },
};
