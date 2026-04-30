import type { AnimationConfig } from './animationTypes';

// Resolve paths at module load time via Vite's import.meta.url —
// works correctly in both dev (HTTP) and packaged (file://) Electron environments.
const idle000 = new URL('../assets/cat/idle/idle_000.png', import.meta.url).href;
const idle001 = new URL('../assets/cat/idle/idle_001.png', import.meta.url).href;
const idle002 = new URL('../assets/cat/idle/idle_002.png', import.meta.url).href;

const dragging000 = new URL('../assets/cat/dragging/dragging_000.png', import.meta.url).href;
const dragging001 = new URL('../assets/cat/dragging/dragging_001.png', import.meta.url).href;
const dragging002 = new URL('../assets/cat/dragging/dragging_002.png', import.meta.url).href;

const happy000 = new URL('../assets/cat/happy/happy_000.png', import.meta.url).href;
const happy001 = new URL('../assets/cat/happy/happy_001.png', import.meta.url).href;
const happy002 = new URL('../assets/cat/happy/happy_002.png', import.meta.url).href;

const sleeping000 = new URL('../assets/cat/sleeping/sleeping_000.png', import.meta.url).href;
const sleeping001 = new URL('../assets/cat/sleeping/sleeping_001.png', import.meta.url).href;
const sleeping002 = new URL('../assets/cat/sleeping/sleeping_002.png', import.meta.url).href;

const walkRight000 = new URL('../assets/cat/walk_right/walk_right_000.png', import.meta.url).href;
const walkRight001 = new URL('../assets/cat/walk_right/walk_right_001.png', import.meta.url).href;
const walkRight002 = new URL('../assets/cat/walk_right/walk_right_002.png', import.meta.url).href;
const walkRight003 = new URL('../assets/cat/walk_right/walk_right_003.png', import.meta.url).href;

const walkLeft000 = new URL('../assets/cat/walk_left/walk_left_000.png', import.meta.url).href;
const walkLeft001 = new URL('../assets/cat/walk_left/walk_left_001.png', import.meta.url).href;
const walkLeft002 = new URL('../assets/cat/walk_left/walk_left_002.png', import.meta.url).href;
const walkLeft003 = new URL('../assets/cat/walk_left/walk_left_003.png', import.meta.url).href;

export const animationConfig: AnimationConfig = {
    idle: {
        fps: 4,
        loop: true,
        frames: [idle000, idle001, idle002],
    },
    dragging: {
        fps: 6,
        loop: true,
        frames: [dragging000, dragging001, dragging002],
    },
    happy: {
        fps: 6,
        loop: true,
        frames: [happy000, happy001, happy002],
    },
    sleeping: {
        fps: 3,
        loop: true,
        frames: [sleeping000, sleeping001, sleeping002],
    },
    walk_right: {
        fps: 7,
        loop: true,
        frames: [walkRight000, walkRight001, walkRight002, walkRight003],
    },
    walk_left: {
        fps: 7,
        loop: true,
        frames: [walkLeft000, walkLeft001, walkLeft002, walkLeft003],
    },
};
