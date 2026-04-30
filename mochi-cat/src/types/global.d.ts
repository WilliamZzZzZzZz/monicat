export { };

type PetMenuAction = 'pet' | 'feed' | 'sleep' | 'wake';

export interface UserSettings {
    petSize: 'small' | 'medium' | 'large';
    alwaysOnTop: boolean;
    speechBubbleEnabled: boolean;
    randomBehaviorEnabled: boolean;
}

declare global {
    interface Window {
        mochiCat: {
            window: {
                dragStart: () => Promise<void>;
                dragMove: () => void;
                dragEnd: () => Promise<void>;
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
