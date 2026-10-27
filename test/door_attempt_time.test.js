import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ROOM, STONE } from '../js/const.js';
import { feel_location, map_background, newsym, swallowed } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('closing while blind and engulfed does not spend time redisplaying known terrain after redraw', async () => {
    freshObjectRoom({ hero: { blindTurns: 10 } });
    const engulfer = await createMonsterAt('air elemental', 11, 10);
    feel_location(11, 10);
    game.u.uswallow = true;
    game.u.ustuck = engulfer;
    swallowed(true);
    pushKeys('\x12l');
    await rhack('c'.charCodeAt(0));
    assert.equal(game._pending_message, 'You feel no door there.');
    assert.equal(game.context.move, 0);
});
void test('closing while blind spends time learning an unknown floor', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 10 } });
    level.requireAt(11, 10).lastseentyp = STONE;
    pushKeys('l');
    await rhack('c'.charCodeAt(0));
    assert.equal(level.requireAt(11, 10).lastseentyp, ROOM);
    assert.equal(game.context.move, 1);
});
void test('opening at a hallucinated monster does not spend time on its changing appearance', async () => {
    const level = freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    await createMonsterAt('jackal', 11, 10);
    map_background(11, 10, false);
    level.requireAt(11, 10).lastseentyp = ROOM;
    newsym(11, 10);
    pushKeys('l');
    await rhack('o'.charCodeAt(0));
    assert.equal(game._pending_message, 'You see no door there.');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=door_attempt_time.test.js.map