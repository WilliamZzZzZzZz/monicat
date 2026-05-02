export type BehaviorFrequency = 'low' | 'normal' | 'high';

export type PetMenuAction =
    | 'pet'
    | 'feed'
    | 'grooming'
    | 'sleep'
    | 'wake'
    | 'openSettingsPanel'
    | 'resetPosition'
    | 'walkLeft'
    | 'walkRight';

export interface UserSettings {
    petSizePx: number;
    alwaysOnTop: boolean;
    speechBubbleEnabled: boolean;
    randomBehaviorEnabled: boolean;
    autoWalkEnabled: boolean;
    behaviorFrequency: BehaviorFrequency;
    walkingSpeedPxPerSecond: number;
    walkingDurationMinMs: number;
    walkingDurationMaxMs: number;
    sleepAfterIdleMs: number | null;
    happyDurationMs: number;
    bubbleDurationMs: number;
}
