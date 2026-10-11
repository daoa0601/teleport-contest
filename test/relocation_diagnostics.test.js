import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, PANICLOG, RLOC_ERR, RLOC_NOMSG, ROWNO, STONE } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requireGameLevel, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { Engine } from '../js/jsmain.js';
import { randomMonsterRelocation } from '../js/teleport.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function strandedOrc() {
    const orc = await createMonsterAt('orc', 14, 10);
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            requireGameLevel().requireAt(x, y).typ = STONE;
    }
    return orc;
}
async function failedRelocation(orc, flags) {
    const input = resetInputState();
    const pages = [];
    input.beforeRead = () => {
        pages.push(visibleText());
        input.feed(' ');
    };
    const result = await randomMonsterRelocation(orc, { flags });
    await flush_screen(1);
    return { result, text: [...pages, visibleText()].join('\n') };
}
void test('relocation failure without RLOC_ERR stays quiet and leaves the monster in place', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.storage = memoryStorage();
    const orc = await strandedOrc();
    const { result, text } = await failedRelocation(orc, RLOC_NOMSG);
    assert.equal(result, null);
    assert.deepEqual([orc.mx, orc.my], [14, 10]);
    assert.doesNotMatch(text, /couldn't relocate|Program in disorder/);
    assert.equal(game.storage.getItem(PANICLOG), null);
});
void test('RLOC_ERR reports and logs a placement failure without ending the game', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.storage = memoryStorage();
    const orc = await strandedOrc();
    const { result, text } = await failedRelocation(orc, RLOC_ERR | RLOC_NOMSG);
    assert.equal(result, null);
    assert.match(text, /rloc\(\): couldn't relocate monster/);
    assert.match(text, /Program in disorder!/);
    assert.match(text, /Please report these messages to devteam@nethack\.org/);
    assert.doesNotMatch(text, /Saving and reloading/);
    const records = (game.storage.getItem(PANICLOG) || '').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    assert.ok(records.some(record => typeof record === 'object' && record !== null
        && 'type' in record && record.type === 'impossible'
        && 'reason' in record && record.reason === "rloc(): couldn't relocate monster"));
    assert.deepEqual([orc.mx, orc.my], [14, 10]);
    assert.equal(!!game.program_state.gameover, false);
});
void test('a relocation diagnostic after character startup offers saving and reloading', async () => {
    const engine = new Engine({
        seed: 1,
        display: new GameDisplay(null),
        storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Diagnostic,role:valkyrie,race:human,gender:female,align:lawful,!legacy,!tutorial,!tips',
    });
    engine.inputGate.beforeRead = () => {
        assert.match(visibleText(), /--More--/);
        engine.inputGate.feed(' ');
    };
    await engine.start();
    try {
        const orc = await strandedOrc();
        const { result, text } = await failedRelocation(orc, RLOC_ERR | RLOC_NOMSG);
        assert.equal(result, null);
        assert.match(text, /Saving and reloading may fix this problem/);
        assert.equal(!!game.program_state.gameover, false);
    }
    finally {
        await engine.lua.destroy();
    }
});
//# sourceMappingURL=relocation_diagnostics.test.js.map