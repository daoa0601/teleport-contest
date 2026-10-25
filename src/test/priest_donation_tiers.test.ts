import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty, propertyTimeout } from '../js/properties.js';
import { monsterGoldAmount } from '../js/shop_money.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { runExtendedCommand } from './support/commands.js';
import { createRoom } from './support/topology.js';

// C priest.c:priest_talk(): with a level-1 peak and seed 2 the priest suggests
// a base donation of 185, so quan is 1 and the tiers below are stable.
async function donationTemple(record: number) {
    const level = freshObjectRoom({ hero: { ulevelpeak: 1, ualign: { type: 0, record } } });
    requirePlayingGame(game);
    const room = createRoom({ lx: 7, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', 11, 10, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = 1;
    priest.msleeping = 0;
    priest.female = true;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 12, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    const input = resetInputState();
    input.beforeRead = () => { input.feed(' '); };
    initRng(2);
    return priest;
}

async function donate(record: number, gold: number, offer: number) {
    const priest = await donationTemple(record);
    setHeroGoldAmount(game, gold);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /./, limit: 40 });
    await runExtendedCommand('chat', `l ${offer}\n`);
    return { priest, messages: [...messages, game._pending_message].join('\n') };
}

void test('an offer below the suggestion from a full purse earns a rebuke', async () => {
    const { priest, messages } = await donate(0, 400, 100);

    assert.match(messages, /You give the priestess of Ishtar 100 zorkmids\./);
    assert.match(messages, /"Cheapskate\."/);
    assert.equal(heroGoldAmount(game), 300);
    assert.equal(monsterGoldAmount(priest), 100);
    assert.equal(priest.epri?.cheapskate_count, 1, 'cheaping out raises the next suggested donation');
});

void test('a small offer that empties the purse is thanked', async () => {
    const { priest, messages } = await donate(0, 300, 100);

    assert.match(messages, /"I thank thee for thy contribution\."/);
    assert.equal(heroGoldAmount(game), 200);
    assert.equal(monsterGoldAmount(priest), 100);
    assert.equal(priest.epri?.cheapskate_count, undefined);
});

void test('a pious donation blesses clairvoyance and can redeem a sinned record', async () => {
    const { messages } = await donate(-5, 500, 300);

    assert.match(messages, /"Thou art indeed a pious individual\."/);
    assert.match(messages, /"I bestow upon thee a blessing\."/);
    // 500 * 300 / 185 = 810, so the blessing lasts at least 810 turns.
    assert.ok(propertyTimeout('clairvoyant', game) >= 810);
    assert.equal(heroGoldAmount(game), 200);
    assert.equal(game.u.ualign?.record, -4, 'donating most of a small purse regains alignment');
});

void test('a protective donation grants recoverable protection from outside', async () => {
    const { messages } = await donate(0, 1000, 500);

    assert.match(messages, /"Thou hast been rewarded for thy devotion\."/);
    assert.equal(hasPermanentIntrinsicProperty('protection', game), true);
    assert.ok((game.u.ublessed ?? 0) >= 2 && (game.u.ublessed ?? 0) <= 4,
        'a fresh reward rolls two to four protection points');
});

void test('a protective donation cannot exceed the protection cap', async () => {
    await donationTemple(0);
    grantIntrinsicProperty('protection', 'outside', game);
    game.u.ublessed = 20;
    setHeroGoldAmount(game, 1000);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /./, limit: 40 });

    await runExtendedCommand('chat', 'l 500\n');

    assert.match([...messages, game._pending_message].join('\n'), /"Thy selfless generosity is deeply appreciated\."/);
    assert.equal(game.u.ublessed, 20, 'a capped hero gains no further protection');
});

void test('generosity beyond three suggestions mends a strayed record', async () => {
    const { messages } = await donate(-5, 1000, 900);

    assert.match(messages, /"Thy selfless generosity is deeply appreciated\."/);
    assert.equal(game.u.ualign?.record, -3, 'generosity within five thousand moves of the last cleansing nudges alignment');
    assert.equal(game.u.ucleansed ?? 0, 0);
});

void test('an old cleanse lets maximum generosity reset the record', async () => {
    const priest = await donationTemple(-5);
    game.moves = 6000;
    setHeroGoldAmount(game, 1000);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /./, limit: 40 });

    await runExtendedCommand('chat', 'l 900\n');

    assert.match([...messages, game._pending_message].join('\n'), /"Thy selfless generosity is deeply appreciated\."/);
    assert.equal(game.u.ualign?.record, 0, 'a cleanse older than five thousand moves resets the record');
    assert.equal(game.u.ucleansed, 6000);
    assert.equal(priest.mpeaceful, 1);
});
