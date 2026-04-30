export interface UserSettings {
    petSizePx: number;
    alwaysOnTop: boolean;
    speechBubbleEnabled: boolean;
    randomBehaviorEnabled: boolean;
}

export interface SpriteRectInWindow {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface WindowBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ExternalWindowBounds extends WindowBounds {
    id?: string;
    appName?: string;
    title?: string;
}

export interface PerchMovementBounds {
    minX: number;
    maxX: number;
    y: number;
}
