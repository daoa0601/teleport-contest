import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { LEATHER_DRUM } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('a permanently deaf drummer feels the performance without gaining temporary deafness', async () => {
    const input = freshTurnRoom();
    assert.ok(game.u.uroleplay);
    game.u.uroleplay.deaf = true;
    const drum = await addInventoryObject(LEATHER_DRUM);
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /playing|pound|deafening/, limit: 5 });
    pushKeys(`a${drum.invlet}`);
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|pound|deafening|^$/);
    messages.push(game._pending_message);
    assert.equal(game.u.deafTurns ?? 0, 0);
    assert.match(messages.join('\n'), /You pound on the drum\./);
});
// C music.c LEATHER_DRUM scares an engulfing lurker awake; monflee() calls
// expels(), which flags botl before its "unfolds" pline (mhitu.c). vpline()
// then flushes that flag — redrawing the committed "Deaf" condition —
// before update_topl() pages the still-unseen drum row.
void test('a deafening drum row pages with its Deaf condition already in the status line', async () => {
    const input = freshTurnRoom();
    const drum = await addInventoryObject(LEATHER_DRUM);
    const lurker = await createMonsterAt('lurker above', game.u.ux, game.u.uy);
    lurker.mstrategy = 0; // a roaming lurker, not one still lying in wait
    game.u.uswallow = 1;
    game.u.ustuck = lurker;
    const pages = [];
    input.beforeRead = () => {
        if (/use or apply/.test(game._pending_message))
            pushKeys(drum.invlet ?? '?');
    };
    input.display = {
        async readKey() {
            const grid = game.nhDisplay?.grid ?? [];
            pages.push(grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
            return ' '.charCodeAt(0);
        },
    };
    pushKeys('a');
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|deafening|released|flee|^$/);
    assert.ok((game.u.deafTurns ?? 0) > 0, 'the drum deafens its player');
    assert.equal(game.u.uswallow, 0, 'the scared lurker releases the drummer');
    const row = pages.find(page => /deafening/.test(page) && /--More--/.test(page))
        ?.split('\n')[23];
    assert.ok(row, 'The drum row pages when the lurker is expelled');
    assert.match(row ?? '', / Deaf/);
});
//# sourceMappingURL=music_deafness.test.js.map