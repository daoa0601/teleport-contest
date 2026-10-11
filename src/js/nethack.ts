// nethack.js — Browser game bootstrap.
// C ref: unixmain.c / nttty.c — platform-specific entry point.
// Connects the game engine (jsmain.js) to the browser terminal and
// keyboard input, then runs the game loop.

import { Engine } from './jsmain.js';
import { GameDisplay } from './game_display.js';

// Start an interactive browser game with the given terminal container.
export async function startBrowser(container: string | HTMLElement, seed = 42) {
    const display = new GameDisplay(container);
    const engine = new Engine({ seed, display, interactive: true });
    await engine.run();
}
