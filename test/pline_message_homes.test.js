// C pline.c's message helpers, gamelog_add(), and shk.c:doinvbill() live in
// their C-file owner modules (pline.js, mondata.js, shk.js). These checks pin
// their observable wording and chronicle/bill shapes to C behavior.
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFeltMessage, formatHeardMessage, formatSeenMessage, publishHeardMessage, truncatePlineMessage, truncateRawMessage, recordGameLogEvent, gameLogEvents, } from '../js/pline.js';
import { heroCanChant } from '../js/mondata.js';
import { doinvbill } from '../js/shk.js';
import { game } from '../js/gstate.js';
import { setMulti } from '../js/cmd.js';
import { BUFSZ, FAINTED, LL_CONDUCT } from '../js/const.js';
import { DAGGER } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
void test('You_hear wording tracks deafness, dreams, water, and acoustics', async () => {
    await freshObjectRoom({ role: 'valkyrie' });
    const heard = [];
    const collect = (message) => { heard.push(message); };
    assert.equal(formatHeardMessage('a chime'), 'You hear a chime');
    game.u.extrinsicDeaf = true;
    assert.equal(formatHeardMessage('a chime'), null);
    await publishHeardMessage('a chime', collect);
    assert.deepEqual(heard, []);
    // C pline.c:436-452: only an awake deaf hero hears nothing; an unaware
    // hero dreams the sound, and a deaf one is still unconscious while doing so.
    setMulti(-1);
    game.u.uhs = FAINTED;
    assert.equal(formatHeardMessage('a chime'), 'You dream that you hear a chime');
    delete game.u.extrinsicDeaf;
    game.underwater = true;
    assert.equal(formatHeardMessage('a chime'), 'You barely hear a chime');
    game.underwater = false;
    game.flags.acoustics = false;
    assert.equal(formatHeardMessage('a chime'), null);
    await publishHeardMessage('a chime', collect);
    assert.deepEqual(heard, []);
    delete game.flags.acoustics;
    setMulti(0);
    await publishHeardMessage('a chime', collect);
    assert.deepEqual(heard, ['You hear a chime']);
});
void test('You_see and You_feel wording tracks awareness and blindness', async () => {
    await freshObjectRoom({ role: 'valkyrie' });
    assert.equal(formatSeenMessage('a fog'), 'You see a fog');
    assert.equal(formatFeltMessage('dizzy'), 'You feel dizzy');
    game.u.blindTurns = 10;
    assert.equal(formatSeenMessage('a fog'), 'You sense a fog');
    game.u.blindTurns = 0;
    setMulti(-1);
    game.u.uhs = FAINTED;
    assert.equal(formatSeenMessage('a fog'), 'You dream that you see a fog');
    assert.equal(formatFeltMessage('dizzy'), 'You dream that you feel dizzy');
    setMulti(0);
});
void test('vpline and vraw_printf shorten past BUFSZ differently', () => {
    const long = `${'a'.repeat(BUFSZ + 40)}XYZ`;
    const pline = truncatePlineMessage(long);
    assert.equal(pline.length, BUFSZ - 1);
    assert.ok(pline.endsWith('...XYZ'));
    const raw = truncateRawMessage(long);
    assert.equal(raw.length, BUFSZ - 1);
    assert.ok(raw.startsWith('a'.repeat(40)));
    assert.ok(!raw.includes('XYZ'));
    assert.equal(truncatePlineMessage('short\0trailing'), 'short');
});
void test('gamelog_add records turn, text, and flags', async () => {
    await freshObjectRoom({ role: 'valkyrie' });
    game.gamelog = [];
    assert.equal(recordGameLogEvent(''), null);
    assert.deepEqual(gameLogEvents(), []);
    game.moves = 0;
    const entry = recordGameLogEvent('became vegetarian', { flags: LL_CONDUCT });
    assert.ok(entry);
    assert.equal(entry.turn, 1);
    assert.equal(entry.text, 'became vegetarian');
    assert.equal(entry.flags, LL_CONDUCT);
    assert.deepEqual(gameLogEvents(), [entry]);
});
void test('can_chant refuses a strangled hero', async () => {
    await freshObjectRoom({ role: 'valkyrie' });
    assert.equal(heroCanChant(), true);
    game.u.strangled = true;
    assert.equal(heroCanChant(), false);
    delete game.u.strangled;
    game.u.strangledTurns = 3;
    assert.equal(heroCanChant(), false);
});
void test('doinvbill counts used-up articles and leftover debit', async () => {
    await freshObjectRoom({ role: 'valkyrie' });
    assert.deepEqual(doinvbill(0), []);
    const used = await knownObject(DAGGER, { quan: 4, where: 'onbill' });
    game.billObjects = [used];
    const keeper = await createStaffedShop({
        bill: [{ bo_id: used.o_id, bquan: 4, price: 10, useup: true }],
    });
    keeper.shopkeeper.eshk.debit = 3;
    const lines = doinvbill(0);
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.object, used);
    assert.equal(lines[0]?.quantity, 4);
    assert.equal(lines[0]?.price, 40);
    assert.equal(lines[1]?.object, null);
    assert.equal(lines[1]?.price, 3);
});
//# sourceMappingURL=pline_message_homes.test.js.map