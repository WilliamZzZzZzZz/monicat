export { };

import type { ExternalWindowBounds, SpriteRectInWindow, UserSettings, WindowBounds } from './ipc';

type PetMenuAction = 'pet' | 'feed' | 'sleep' | 'wake' | 'openSizePanel' | 'walkLeft' | 'walkRight';

declare global {
    interface Window {
        mochiCat: {
            window: {
                dragStart: (
                    mouseScreenX: number,
                    mouseScreenY: number,
                    spriteRect: SpriteRectInWindow
                ) => Promise<void>;
                dragMove: (mouseScreenX: number, mouseScreenY: number) => void;
                dragEnd: () => Promise<void>;
                onVisibilityChanged: (callback: (visible: boolean) => void) => () => void;
                getPosition: () => Promise<[number, number]>;
                getBounds: () => Promise<WindowBounds>;
                setPosition: (x: number, y: number) => Promise<void>;
                getWorkArea: () => Promise<{ x: number; y: number; width: number; height: number }>;
                getDisplayBounds: () => Promise<WindowBounds>;
            };
            externalWindows: {
                getVisibleWindows: () => Promise<ExternalWindowBounds[]>;
            };
            menu: {
                openPetMenu: () => Promise<void>;
            };
            pet: {
                onMenuAction: (callback: (action: PetMenuAction) => void) => () => void;
            };
            settings: {
                get: () => Promise<UserSettings>;
                update: (partial: Partial<UserSettings>) => Promise<UserSettings>;
                reset: () => Promise<UserSettings>;
                onChange: (callback: (settings: UserSettings) => void) => () => void;
            };
        };
    }
}
