import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a fountain announces overflowing water before creatures drown in the new pools', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const victims = [];
    for (const [x, y] of [[9, 9], [9, 11], [11, 9], [11, 11]])
        victims.push(await createMonsterAt('goblin', x, y));
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed('y' + ' '.repeat(30));
    initRng(8n);
    await rhack('q'.charCodeAt(0));
    assert.ok(victims.some(monster => monster.mhp <= 0
        && level.requireAt(monster.mx, monster.my).typ === POOL));
    const text = [...messages, game._pending_message].join('\n');
    const overflow = text.indexOf('Water gushes forth');
    const drowning = text.indexOf('drown');
    assert.ok(overflow >= 0 && drowning > overflow, `Overflow must be announced before drowning: ${text}`);
});
//# sourceMappingURL=fountain_gush_order.test.js.map