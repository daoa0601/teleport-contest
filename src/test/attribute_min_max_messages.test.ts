import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { initRng } from '../js/rng.js';
import { throneSitEffect } from '../js/throne.js';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { createDungeon } from './support/topology.js';
import { GAUNTLETS_OF_POWER, POT_GAIN_ABILITY } from '../js/object_data.js';

type Bases = readonly [number, number, number, number, number, number];

const ATTRIBUTE_GAIN_WORD = [
    'strong', 'smart', 'wise', 'agile', 'tough', 'charismatic',
];
const ATTRIBUTE_LOSS_WORD = [
    'weak', 'stupid', 'foolish', 'clumsy', 'fragile', 'repulsive',
];
const ATTRIBUTE_NAME = [
    'strength', 'intelligence', 'wisdom', 'dexterity', 'constitution', 'charisma',
];
const ALL_ATTRIBUTES = [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA] as const;

function captureMessages(feed: string): string[] {
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        if (game._pending_message) messages.push(game._pending_message);
    };
    input.feed(feed);
    return messages;
}

async function sitOnVladsThrone(
    seed: bigint, bases: Bases, maximums: Bases, feed: string,
): Promise<string[]> {
    freshObjectRoom({ flags: { debug: true, verbose: true } });
    requirePlayingGame(game);
    game.u.uz = { dnum: 3, dlevel: 8 };
    game.dungeons[3] = createDungeon({ dname: "Vlad's Tower" });
    game.u.acurr.a = [...bases];
    game.u.amax.a = [...maximums];
    await bot();
    initRng(seed);
    return captureMessages(feed);
}

// C sit.c special_throne_effect() case 13 calls adjattrib(ability, rn2(5) - 2,
// -1) for every attribute in order.  A delta of two makes adjattrib describe
// the change with the "very " emphasis (attrib.c adjattrib: incr > 1 or
// incr < -1); a positive delta also raises the maximum to the new base, while
// a loss leaves the maximum alone (attrib.c positive branch only).
void test("Vlad's throne shuffle describes every ability delta it applies", async () => {
    let sawEmphasizedChange = false;
    for (let seed = 1n; seed < 60n; seed++) {
        const bases: Bases = [12, 12, 12, 12, 12, 12];
        const messages = await sitOnVladsThrone(
            seed, bases, bases, '13\n' + '\n'.repeat(200));
        await throneSitEffect();
        messages.push(game._pending_message || '');
        const text = messages.join('\n');
        if (!/As you sit on the throne, your body and mind start to warp\./.test(text)) continue;

        const after = game.u.acurr?.a;
        const maximum = game.u.amax?.a;
        if (!after || !maximum) throw new Error('throne shuffle requires attributes');
        for (const attribute of ALL_ATTRIBUTES) {
            const delta = after[attribute] - bases[attribute];
            const word = delta >= 0 ? ATTRIBUTE_GAIN_WORD[attribute]
                : ATTRIBUTE_LOSS_WORD[attribute];
            if (delta === 0) {
                assert.doesNotMatch(text, new RegExp(`You feel (very )?${word}!`));
                continue;
            }
            assert.ok(Math.abs(delta) <= 2, 'the shuffle moves a base by two at most');
            if (Math.abs(delta) === 2) {
                sawEmphasizedChange = true;
                assert.match(text, new RegExp(`You feel very ${word}!`));
            } else {
                assert.match(text, new RegExp(`You feel ${word}!`));
                assert.doesNotMatch(text, new RegExp(`You feel very ${word}!`));
            }
            if (delta > 0)
                assert.equal(maximum[attribute], after[attribute], 'a gain raises the maximum');
            else
                assert.equal(maximum[attribute], bases[attribute], 'a loss leaves the maximum');
        }
    }
    assert.ok(sawEmphasizedChange, 'the fixed seed range covers a two-point change');
});

// C attrib.c adjattrib(): when a loss would take the base below the racial
// minimum, the base is clamped to the minimum and the maximum loses
// rn2(excess + 1) of the excess (excess equals the whole rn1(4, 3) loss, so
// the drain is 0..6 points).  A zero roll leaves the maximum alone, and the
// msgflg-0 caller (sit.c throne case 1) then reports "You're already as X as
// you can get." instead of "Your innate X has declined.".
void test('a cursed throne loss at the minimum trades maximum for part of the excess', async () => {
    let sawDeclined = false;
    let sawAlready = false;
    for (let seed = 1n; seed < 40n; seed++) {
        const bases: Bases = [3, 3, 3, 3, 3, 3];
        const maximums: Bases = [12, 12, 12, 12, 12, 12];
        freshObjectRoom({ flags: { debug: true, verbose: true } });
        requirePlayingGame(game);
        game.u.acurr.a = [...bases];
        game.u.amax.a = [...maximums];
        await bot();
        initRng(seed);
        const messages = captureMessages('1\n' + '\n'.repeat(200));
        await throneSitEffect();
        messages.push(game._pending_message || '');
        const text = messages.join('\n');

        const declined = ALL_ATTRIBUTES.filter(attribute =>
            text.includes(`Your innate ${ATTRIBUTE_NAME[attribute]} has declined.`));
        const already = ALL_ATTRIBUTES.filter(attribute =>
            new RegExp(`You're already as ${ATTRIBUTE_LOSS_WORD[attribute]} as you can get\\.`).test(text));
        if (!declined.length && !already.length) continue;
        const current = game.u.acurr?.a;
        const maximum = game.u.amax?.a;
        if (!current || !maximum) throw new Error('throne loss requires attributes');
        const health = game.u.uhp;
        if (health === undefined) throw new Error('throne loss requires health');
        assert.equal(declined.length + already.length, 1,
            'the throne names exactly the one attribute it rolled');
        const rolled = declined.length ? declined[0] : already[0];
        if (declined.length) sawDeclined = true;
        else sawAlready = true;
        for (const attribute of ALL_ATTRIBUTES) {
            assert.equal(current[attribute], 3, 'the base stays at the minimum');
            if (attribute === rolled) {
                if (declined.length)
                    assert.ok(maximum[attribute] < 12 && maximum[attribute] >= 6,
                        'a declined maximum lost between one and six points');
                else
                    assert.equal(maximum[attribute], 12,
                        'a zero roll leaves the maximum alone');
            } else {
                assert.equal(maximum[attribute], 12, 'only the rolled attribute can drain');
            }
        }
        assert.ok(health < 40, 'the cursed throne also wounds the hero');
    }
    assert.ok(sawDeclined, 'the fixed seed range covers the drained outcome');
    assert.ok(sawAlready, 'the fixed seed range covers the undrained outcome');
});

// C attrib.c adjattrib(): a base gain that cannot move the current value
// because fixed equipment (gauntlets of power) pins it at ACURR(A_STR) = 25
// reports "Your innate strength has improved." on the msgflg-0 attempt of a
// blessed gain ability (potion.c peffect_gain_ability).
void test('a blessed gain ability under gauntlets of power reports the innate gain', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    game.u.acurr.a = [16, 18, 18, 18, 18, 18];
    game.u.amax.a = [16, 18, 18, 18, 18, 18];
    game.uarmg = await addInventoryObject(GAUNTLETS_OF_POWER);
    assert.equal(game.uarmg.otyp, GAUNTLETS_OF_POWER);

    const potion = await addInventoryObject(POT_GAIN_ABILITY, { blessed: true });
    const messages = captureMessages(`${potion.invlet}${' '.repeat(60)}`);
    await rhack('q'.charCodeAt(0));

    messages.push(game._pending_message || '');
    const text = messages.join('\n');
    assert.match(text, /Your innate strength has improved\./);
    // The gauntlets hold the current value at 25 while only the underlying
    // base and maximum move.
    assert.equal(game.u.acurr.a[A_STR], 17);
    assert.equal(game.u.amax.a[A_STR], 17);
    assert.match(text, /You're already as smart as you can get\./);
});
