import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import { rhack } from '../js/cmd.js';
import { MM_EPRI } from '../js/const.js';
import { game } from '../js/gstate.js';
import type { AttributeValues } from '../js/roles.js';
import { ELVEN_DAGGER, SCR_IDENTIFY } from '../js/object_data.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { createStaffedShop } from './support/shop.js';

async function nameMonsterAt(t: TestContext, proposed: string) {
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('#m');
    planInput(input, t, [
        { prompt: /instructions/, keys: 'l' },
        { prompt: /./, keys: '.' }, // select the monster at the cursor
        { prompt: /What do you want to call/, keys: `${proposed}\r` },
    ]);
    await rhack('#'.charCodeAt(0));
}

void test('a shopkeeper declines a nickname by introducing itself', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const { shopkeeper } = await createStaffedShop({ keeperX: 11, keeperY: 10 });
    shopkeeper.eshk = { ...shopkeeper.eshk, shknam: 'Asidonhopo' };
    assert.ok(shopkeeper.isshk);

    await nameMonsterAt(t, 'Bob');

    assert.equal(game._pending_message, `"I'm Asidonhopo, not Bob."`);
    assert.equal(shopkeeper.mgivenname, undefined);
});

void test('a temple priest refuses a new personal name', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    // priest.c:priest_init(): MM_EPRI prevents the roamer-minion conversion
    // makemon gives an ordinary cleric, then the caller finishes the temple
    // priest itself. Without ispriest this monster would be an isminion
    // roamer, and the refusal below would not exercise the ispriest arm.
    const priest = await createMonsterAt('aligned cleric', 11, 10, MM_EPRI);
    priest.female = false;
    priest.ispriest = 1;
    priest.mpeaceful = 1;
    priest.epri = {
        shroom: 0, shralign: 0, shrpos: { x: 12, y: 10 },
        shrlevel: { dnum: 0, dlevel: 8 }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    assert.ok(priest.ispriest && !priest.isminion && !priest.isshk
        && !priest.mextra?.ebones, 'only the ispriest arm can refuse this name');

    await nameMonsterAt(t, 'Bob');
    assert.match(game._pending_message ?? '', /^The priest of \S+ will not accept the name Bob\.$/);
    assert.equal(priest.mgivenname, undefined);
});

void test('naming at the hero square declines without a steed', async t => {
    // C apply.c:beautiful(): charisma 25 (the ACURR(A_CHA) maximum) yields
    // "sublime", asserted literally so a broken port cannot echo itself.
    const attributes: AttributeValues = [12, 12, 12, 12, 12, 25];
    freshObjectRoom({
        flags: { tips: false, verbose: true },
        hero: { acurr: { a: [...attributes] }, amax: { a: [...attributes] } },
    });
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('#m');
    planInput(input, t, [
        { prompt: /instructions/, keys: '.' },
    ]);

    await rhack('#'.charCodeAt(0));

    assert.equal(game._pending_message,
        `This sublime creature is called ${game.plname} and cannot be renamed.`);
    assert.equal(game.context.move, 0);
});

void test('floor naming rejects an unnameable object type', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    await floorObject(ELVEN_DAGGER, 10, 10, { typeKnown: false });
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('#f');
    planInput(input, t, [
        { prompt: /instructions/, keys: '.' },
    ]);

    await rhack('#'.charCodeAt(0));

    assert.match(game._pending_message ?? '', /^That .* can't be assigned a type name\.$/);
});

void test('floor naming refuses an unrecognized object', async t => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const scroll = await floorObject(SCR_IDENTIFY, 10, 10, { typeKnown: false });
    scroll.dknown = false;
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('#f');
    planInput(input, t, [
        { prompt: /instructions/, keys: '.' },
    ]);

    await rhack('#'.charCodeAt(0));

    assert.match(game._pending_message ?? '', /^You don't know that .* well enough to name it\.$/);
});
