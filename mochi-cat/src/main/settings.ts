import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface UserSettings {
    petSizePx: number;
    alwaysOnTop: boolean;
    speechBubbleEnabled: boolean;
    randomBehaviorEnabled: boolean;
}

export const PET_SIZE_MIN = 96;
export const PET_SIZE_MAX = 260;
export const PET_SIZE_DEFAULT = 220;

function clampSize(v: number): number {
    return Math.max(PET_SIZE_MIN, Math.min(PET_SIZE_MAX, Math.round(v)));
}

export const defaultSettings: UserSettings = {
    petSizePx: PET_SIZE_DEFAULT,
    alwaysOnTop: true,
    speechBubbleEnabled: true,
    randomBehaviorEnabled: true,
};

function settingsFilePath(): string {
    return path.join(app.getPath('userData'), 'settings.json');
}

/** Migrate an old settings file that may still contain petSize enum */
function migrateAndMerge(parsed: Record<string, unknown>): UserSettings {
    const base: UserSettings = { ...defaultSettings };

    // Migrate legacy petSize enum -> petSizePx
    if (typeof parsed['petSize'] === 'string' && !('petSizePx' in parsed)) {
        const legacyMap: Record<string, number> = {
            small: 120,
            medium: PET_SIZE_DEFAULT,
            large: PET_SIZE_MAX,
        };
        base.petSizePx = legacyMap[parsed['petSize'] as string] ?? PET_SIZE_DEFAULT;
    } else if (typeof parsed['petSizePx'] === 'number') {
        base.petSizePx = clampSize(parsed['petSizePx'] as number);
    }

    if (typeof parsed['alwaysOnTop'] === 'boolean') base.alwaysOnTop = parsed['alwaysOnTop'];
    if (typeof parsed['speechBubbleEnabled'] === 'boolean') base.speechBubbleEnabled = parsed['speechBubbleEnabled'];
    if (typeof parsed['randomBehaviorEnabled'] === 'boolean') base.randomBehaviorEnabled = parsed['randomBehaviorEnabled'];

    return base;
}

export const settingsService = {
    load(): UserSettings {
        try {
            const raw = fs.readFileSync(settingsFilePath(), 'utf-8');
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return migrateAndMerge(parsed);
        } catch {
            return { ...defaultSettings };
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
        const merged = { ...current, ...partial };
        if (partial.petSizePx !== undefined) {
            merged.petSizePx = clampSize(partial.petSizePx);
        }
        this.save(merged);
        return merged;
    },

    reset(): UserSettings {
        const fresh = { ...defaultSettings };
        this.save(fresh);
        return fresh;
    },
};
