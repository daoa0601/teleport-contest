import assert from 'node:assert/strict';
import { clearMessageWindow, docrt } from '../../js/display.js';
import { game, requireGameDisplay } from '../../js/gstate.js';
import { Engine, runSegment } from '../../js/jsmain.js';
import { vision_recalc, vision_reset } from '../../js/vision.js';
import { memoryStorage } from './memory-storage.js';
import { createRoomLevel } from './playable-room.js';

export function screen(): string {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

export async function startMenuGame(bindings = ''): Promise<Engine> {
    const engine = await runSegment({
        seed: 73, datetime: '20260830120000', moves: ' ', storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Menu,role:valkyrie,race:human,gender:female,align:lawful,!legacy,!tutorial,!tips,pettype:none\n' + bindings,
    });
    game.level = createRoomLevel({ left: 5, right: 20, top: 5, bottom: 15 });
    game.stairs = null;
    game.u.ux = 10;
    game.u.uy = 10;
    vision_reset();
    vision_recalc(0);
    clearMessageWindow();
    await docrt();
    return engine;
}

export async function type(engine: Engine, keys: string): Promise<void> {
    engine.inputGate.feed(keys);
    await engine.runUntilInputNeeded();
}

export async function finish(engine: Engine): Promise<void> {
    engine.state.program_state.gameover = true;
    engine.inputGate.beforeRead = () => { engine.inputGate.feed('\x1b'); };
    engine.inputGate.feed('\x1b');
    await engine.runningTask;
}

export async function choose(engine: Engine, text: string, answers = ''): Promise<void> {
    const row = screen().split('\n').find(line => line.includes(text));
    const key = row?.match(/([a-zA-Z]) - /)?.[1];
    assert.ok(key, `Missing selectable action: ${text}\n${screen()}`);
    await type(engine, key + answers);
}
