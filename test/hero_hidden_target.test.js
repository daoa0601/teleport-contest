import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { map_invisible, newsym } from '../js/display.js';
import { M_AP_MONSTER, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { game } from '../js/gstate.js';
import { LARGE_BOX } from '../js/object_data.js';
import { placeObject } from '../js/floor_object.js';
import { pushKey, resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { knownObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('walking into a hidden hider reveals it under its cover', async () => {
    freshObjectRoom({ gameplaySeed: 4n });
    const box = await knownObject(LARGE_BOX, { bknown: false, typeKnown: false });
    await placeObject(box, 11, 10);
    const spider = await createMonsterAt('cave spider', 11, 10);
    spider.mundetected = 1;
    pushKey('l'.charCodeAt(0));
    await rhack('l'.charCodeAt(0));
    assert.equal(game._pending_message, "Wait!  There's a cave spider hiding under a large box!");
    assert.equal(spider.mundetected, 0, 'the reveal clears the hidden state');
    assert.equal(game.u.ux, 10, 'the hero never enters the occupied square');
});
void test('striking an invisible worm tail marks the struck square', async () => {
    freshObjectRoom({ gameplaySeed: 4n });
    requireFixtureGame(game);
    const worm = await createMonsterAt('long worm', 12, 10);
    worm.minvis = 1;
    worm.wormSegments = [{ x: 11, y: 10 }];
    pushKey('l'.charCodeAt(0));
    await rhack('l'.charCodeAt(0));
    assert.match(game._pending_message, /something there you can't see/);
    assert.equal(game.level.requireAt(11, 10).remembered_glyph?.kind, 'invisible', 'the invisible marker lands on the struck tail square');
    assert.notEqual(game.level.requireAt(12, 10).remembered_glyph?.kind, 'invisible', 'the head square the hero did not strike stays unmarked');
    assert.equal(game.u.ux, 10, 'the hero never enters the occupied square');
});
void test('remembering an invisible worm head does not reveal its tail', async () => {
    freshObjectRoom({ gameplaySeed: 4n });
    requireFixtureGame(game);
    const worm = await createMonsterAt('long worm', 12, 10);
    worm.minvis = 1;
    worm.wormSegments = [{ x: 11, y: 10 }];
    map_invisible(12, 10);
    pushKey('l'.charCodeAt(0));
    await rhack('l'.charCodeAt(0));
    assert.match(game._pending_message, /something there you can't see/);
    assert.equal(game.level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    assert.equal(game.u.ux, 10);
});
void test('stumbling onto a sleeping monster-disguised mimic wakes it and establishes its hold', async () => {
    freshObjectRoom();
    const mimic = await createMonsterAt('large mimic', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    mimic.m_ap_type = M_AP_MONSTER;
    mimic.mappearance = MONSTER_NAME.indexOf('hill giant');
    mimic.msleeping = 1;
    mimic.mpeaceful = false;
    newsym(mimic.mx, mimic.my);
    const health = mimic.mhp;
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /mimic|hill giant/, limit: 4 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    await rhack('l'.charCodeAt(0));
    messages.push(game._pending_message);
    assert.match(messages.join('\n'), /That hill giant is really a large mimic/);
    assert.equal(mimic.msleeping, 0);
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(game.u.ustuck, mimic);
    assert.equal(mimic.mhp, health, 'Discovery consumes the move before any strike');
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=hero_hidden_target.test.js.map