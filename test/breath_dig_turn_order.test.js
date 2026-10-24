import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, PIT, W_AMUL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AMULET_OF_REFLECTION, PICK_AXE } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';
// C mthrowu.c:breamm() launches the breath and finishes with dobuzz() plus
// nomul(0); the occupation survives the launch.  zap.c:dobuzz() stops the
// occupation only if the ray actually reaches the hero's own square.  A
// frost breath that reflects from an intervening monster therefore never
// interrupts the digging hero, who keeps spending hero actions on the
// occupation alone until the pit is cut — no further command key involved.
void test('a reflected monster breath leaves the hero digging uninterrupted', async () => {
    const input = freshTurnRoom({ left: 2, right: 40, top: 2, bottom: 18, heroX: 12, heroY: 10 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    game.u.uhp = game.u.uhpmax = 500;
    const pick = await addInventoryObject(PICK_AXE);
    game.uwep = game.u.uwep = pick;
    const mirror = await createMonsterAt('white dragon', 16, 10, MM_NOGRP | MM_NOMSG | NO_MINVENT);
    mirror.mhp = mirror.mhpmax = 500;
    mirror.msleeping = 0;
    mirror.mcanmove = 0;
    mirror.mfrozen = 99;
    await equipMonsterObject(mirror, await knownObject(AMULET_OF_REFLECTION), W_AMUL);
    const cub = await createMonsterAt('winter wolf cub', 20, 10, MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT);
    cub.mhp = cub.mhpmax = 100;
    cub.msleeping = 0;
    cub.mspec_used = 0;
    const seen = [];
    installPagerInput(input, { expected: /frost|reflect|dig|pit|wolf/i, limit: 120 });
    input.display = {
        async readKey() {
            seen.push(game._pending_message
                || game.nhDisplay?.grid?.[0]?.map(cell => cell.ch).join('').trim() || '');
            return ' '.charCodeAt(0);
        },
    };
    input.feed(`a${pick.invlet}>`);
    // Consume the apply question and the digging direction; the command's
    // own turn also gives the cub its first chance to breathe.
    await moveloop_core();
    const heroX = game.u.ux, heroY = game.u.uy;
    let pitDug = false;
    for (let round = 0; round < 40 && !pitDug; round++) {
        await moveloop_core();
        if (game._pending_message)
            seen.push(game._pending_message);
        pitDug = !!game.level?.traps?.some(trap => trap.tx === heroX && trap.ty === heroY && trap.ttyp === PIT);
    }
    const prose = seen.join('\n');
    assert.match(prose, /breathes frost/, 'The aligned cub must launch its frost breath.');
    assert.match(prose, /reflect/, 'The frozen dragon must reflect the blast back.');
    assert.ok(pitDug, 'A reflected breath never reaches the hero, so the dig occupation keeps acting every turn and cuts a pit without any new command key.');
    assert.equal(game.u.uhp, 500, 'The reflected blast never touches the hero.');
});
//# sourceMappingURL=breath_dig_turn_order.test.js.map