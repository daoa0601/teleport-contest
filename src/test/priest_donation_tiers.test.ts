import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty, propertyTimeout } from '../js/properties.js';
import { monsterGoldAmount } from '../js/shop_money.js';
import type { Monster } from '../js/monster_types.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
import { createRoom } from './support/topology.js';

// C priest.c:priest_talk(): the donation tiers are relative to the suggested
// amounts the priest prints in the offer prompt ("suggested: N or 2N"), so
// the tests derive each offer from the printed suggestion instead of any
// particular random roll.  Distinct seeds per case keep that honest.
async function donationTemple(record: number, seed: bigint) {
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
    initRng(seed);
    return priest;
}

interface DonationResult {
    priest: Monster;
    offered: number;
    messages: string;
}

async function donate(
    record: number, seed: bigint, purse: number,
    offerFor: (suggested: number, doubled: number) => number,
): Promise<DonationResult> {
    const priest = await donationTemple(record, seed);
    setHeroGoldAmount(game, purse);
    const input = resetInputState();
    const messages: string[] = [];
    let offered: number | null = null;
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.display = {
        async readKey() {
            const screen = (game.nhDisplay?.grid ?? []).map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/--More--|Hit space/.test(screen)) return 32;
            const prompt = /suggested: (\d+) or (\d+)/.exec(screen);
            if (prompt && offered === null) {
                offered = offerFor(Number(prompt[1]), Number(prompt[2]));
                const answer = `${offered}\n`;
                input.feed(answer.slice(1));
                return answer.charCodeAt(0);
            }
            return 27;
        },
    };

    await runExtendedCommand('chat', 'l');

    if (offered === null) throw new Error('The donation prompt never appeared');
    return { priest, offered, messages: [...messages, game._pending_message].join('\n') };
}

void test('an offer below the suggestion from a full purse earns a rebuke', async () => {
    const { priest, offered, messages } = await donate(0, 2n, 800,
        (suggested) => Math.floor(suggested / 2));

    assert.match(messages, new RegExp(`You give the priestess of Ishtar ${offered} zorkmids\\.`));
    assert.match(messages, /"Cheapskate\."/);
    assert.equal(heroGoldAmount(game), 800 - offered);
    assert.equal(monsterGoldAmount(priest), offered);
    assert.equal(priest.epri?.cheapskate_count, 1, 'cheaping out raises the next suggested donation');
});

void test('a small offer that empties the purse is thanked', async () => {
    const { priest, offered, messages } = await donate(0, 3n, 225,
        (suggested) => Math.floor(suggested / 2));

    assert.match(messages, /"I thank thee for thy contribution\."/);
    assert.equal(heroGoldAmount(game), 225 - offered);
    assert.equal(monsterGoldAmount(priest), offered);
    assert.equal(priest.epri?.cheapskate_count, undefined);
});

void test('a pious donation blesses clairvoyance and can redeem a sinned record', async () => {
    const { messages } = await donate(-5, 5n, 400,
        (suggested, doubled) => suggested + Math.floor((doubled - suggested) / 2));

    assert.match(messages, /"Thou art indeed a pious individual\."/);
    assert.match(messages, /"I bestow upon thee a blessing\."/);
    // The offer is 1.5x the suggestion, so the blessing lasts past 650 turns.
    assert.ok(propertyTimeout('clairvoyant', game) >= 650);
    assert.equal(game.u.ualign?.record, -4, 'donating most of a small purse regains alignment');
});

void test('a protective donation grants recoverable protection from outside', async () => {
    const { messages } = await donate(0, 7n, 800,
        (suggested, doubled) => doubled + Math.floor(suggested / 2));

    assert.match(messages, /"Thou hast been rewarded for thy devotion\."/);
    assert.equal(hasPermanentIntrinsicProperty('protection', game), true);
    assert.ok((game.u.ublessed ?? 0) >= 2 && (game.u.ublessed ?? 0) <= 4,
        'a fresh reward rolls two to four protection points');
});

void test('a protective donation cannot exceed the protection cap', async () => {
    const priest = await donationTemple(0, 11n);
    grantIntrinsicProperty('protection', 'outside', game);
    game.u.ublessed = 20;
    setHeroGoldAmount(game, 800);
    const input = resetInputState();
    const messages: string[] = [];
    let offered: number | null = null;
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.display = {
        async readKey() {
            const screen = (game.nhDisplay?.grid ?? []).map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/--More--|Hit space/.test(screen)) return 32;
            const prompt = /suggested: (\d+) or (\d+)/.exec(screen);
            if (prompt && offered === null) {
                offered = Number(prompt[2]) + Math.floor(Number(prompt[1]) / 2);
                const answer = `${offered}\n`;
                input.feed(answer.slice(1));
                return answer.charCodeAt(0);
            }
            return 27;
        },
    };

    await runExtendedCommand('chat', 'l');

    assert.match([...messages, game._pending_message].join('\n'), /"Thy selfless generosity is deeply appreciated\."/);
    assert.equal(game.u.ublessed, 20, 'a capped hero gains no further protection');
});

void test('generosity beyond three suggestions mends a strayed record', async () => {
    const { messages } = await donate(-5, 13n, 800,
        (suggested) => 3 * suggested + 10);

    assert.match(messages, /"Thy selfless generosity is deeply appreciated\."/);
    assert.equal(game.u.ualign?.record, -3, 'generosity within five thousand moves of the last cleansing nudges alignment');
    assert.equal(game.u.ucleansed ?? 0, 0);
});

void test('an old cleanse lets maximum generosity reset the record', async () => {
    const priest = await donationTemple(-5, 17n);
    game.moves = 6000;
    setHeroGoldAmount(game, 800);
    const input = resetInputState();
    const messages: string[] = [];
    let offered: number | null = null;
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.display = {
        async readKey() {
            const screen = (game.nhDisplay?.grid ?? []).map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/--More--|Hit space/.test(screen)) return 32;
            const prompt = /suggested: (\d+) or (\d+)/.exec(screen);
            if (prompt && offered === null) {
                offered = 3 * Number(prompt[1]) + 10;
                const answer = `${offered}\n`;
                input.feed(answer.slice(1));
                return answer.charCodeAt(0);
            }
            return 27;
        },
    };

    await runExtendedCommand('chat', 'l');

    assert.match([...messages, game._pending_message].join('\n'), /"Thy selfless generosity is deeply appreciated\."/);
    assert.equal(game.u.ualign?.record, 0, 'a cleanse older than five thousand moves resets the record');
    assert.equal(game.u.ucleansed, 6000);
    assert.equal(priest.mpeaceful, 1);
});
