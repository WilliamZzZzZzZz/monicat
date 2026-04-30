import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface UserSettings {
    petSize: 'small' | 'medium' | 'large';
    alwaysOnTop: boolean;
    speechBubbleEnabled: boolean;
    randomBehaviorEnabled: boolean;
}

export const defaultSettings: UserSettings = {
    petSize: 'medium',
    alwaysOnTop: true,
    speechBubbleEnabled: true,
    randomBehaviorEnabled: true,
};

function settingsFilePath(): string {
    return path.join(app.getPath('userData'), 'settings.json');
}

export const settingsService = {
    load(): UserSettings {
        try {
            const raw = fs.readFileSync(settingsFilePath(), 'utf-8');
            const parsed = JSON.parse(raw) as Partial<UserSettings>;
            // Merge with defaults so newly added fields are always present
            return { ...defaultSettings, ...parsed };
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
        const updated = { ...current, ...partial };
        this.save(updated);
        return updated;
    },

    reset(): UserSettings {
        const fresh = { ...defaultSettings };
        this.save(fresh);
        return fresh;
    },
};
