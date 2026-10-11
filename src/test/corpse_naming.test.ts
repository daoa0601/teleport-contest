import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { CORPSTAT_FEMALE, CORPSTAT_MALE, G_GONE } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { mksobj, set_corpsenm } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { CORPSE, ICE_BOX, STATUE } from '../js/object_data.js';
import { corpseName, foodObjectName, killerObjectName } from '../js/objnam.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';

test.beforeEach(() =>
    freshObjectRoom({ gameplaySeed: 12n, hero: { ulevel: 1, uz: { dnum: 0, dlevel: 1 } } }),
);

void test('a newly created corpse has a species name without learning its object type', async () => {
    const body = await mksobj(CORPSE, true, false);
    set_corpsenm(body, MONSTER_NAME.indexOf('jackal'));
    body.dknown = false;

    assert.equal(inventoryItemDescription(body), 'a jackal corpse');
    body.quan = 2;
    assert.equal(inventoryItemDescription(body), '2 jackal corpses');
    assert.equal(game._knownObjectTypes?.has(CORPSE) ?? false, false);
});

void test('generated ice-box corpses retain both sexes as separate stacks', async () => {
    const box = await mksobj(ICE_BOX, true, false);
    assert.ok(box.contents);
    const newts = box.contents.filter((body) => body.corpsenm === MONSTER_NAME.indexOf('newt'));

    assert.equal(newts.length, 2, 'opposite-sex newts must not merge');
    assert.deepEqual(
        newts.map((body) => body.quan).sort((a, b) => a - b),
        [1, 2],
    );
    assert.deepEqual(
        newts.map((body) => body.spe).sort((a, b) => a - b),
        [CORPSTAT_FEMALE, CORPSTAT_MALE],
    );
});

void test('an uninitialized corpse represents living flesh while a statue retains its undead species', async () => {
    freshObjectRoom({ gameplaySeed: 18n, hero: { ulevel: 30, uz: { dnum: 0, dlevel: 30 } } });
    requirePlayingGame(game);
    const statue = await mksobj(STATUE, false, false);
    initRng(18n);
    const body = await mksobj(CORPSE, false, false);

    assert.ok(statue.corpsenm !== undefined);
    assert.equal(MONSTER_NAME[statue.corpsenm], 'vampire leader');
    assert.equal(corpseName(body), 'human corpse');
});

void test('unavailable living flesh falls back to the hero role corpse species', async () => {
    freshObjectRoom({
        gameplaySeed: 18n,
        role: 'monk',
        hero: { ulevel: 30, uz: { dnum: 0, dlevel: 30 } },
    });
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    game.mvitals[MONSTER_NAME.indexOf('human')] = { born: 0, died: 0, mvflags: G_GONE };
    const body = await mksobj(CORPSE, false, false);

    assert.equal(corpseName(body), 'monk corpse');
});

void test('same-sex corpse admission merges while opposite-sex admission keeps another stack', async () => {
    const box = await mksobj(ICE_BOX, false, false);
    for (const sex of [CORPSTAT_MALE, CORPSTAT_FEMALE, CORPSTAT_MALE]) {
        const body = await mksobj(CORPSE, false, false);
        set_corpsenm(body, MONSTER_NAME.indexOf('jackal'));
        body.spe = sex;
        await addObjectToContainer(box, body);
    }

    assert.ok(box.contents);
    assert.deepEqual(box.contents.map((object) => inventoryItemDescription(object)).sort(), [
        '2 jackal corpses',
        'a jackal corpse',
    ]);
});

void test('floor loot contents pause with complete corpse names and preserve both sex stacks', async () => {
    const input = resetInputState();
    const box = await mksobj(ICE_BOX, false, false);
    placeCreatedObject(box, game.u.ux, game.u.uy);
    for (const sex of [CORPSTAT_MALE, CORPSTAT_FEMALE, CORPSTAT_MALE]) {
        const body = await mksobj(CORPSE, false, false);
        set_corpsenm(body, MONSTER_NAME.indexOf('jackal'));
        body.spe = sex;
        await addObjectToContainer(box, body);
    }
    pushKeys('loot\n:');
    const action = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.ok(game.nhDisplay);
    const text = game.nhDisplay.grid.map((row) => row.map((cell) => cell.ch).join('')).join('\n');
    assert.match(text, /Contents of the ice box:/);
    assert.match(text, /2 jackal corpses/);
    assert.match(text, /a jackal corpse/);
    assert.match(text, /--More--/);
    pushKeys(' q');
    await action;
    assert.ok(box.contents);
    assert.equal(box.contents.length, 2);
});

for (const [species, expected] of [
    ['jackal', 'an uncursed partly eaten jackal corpse'],
    ['Oracle', "the Oracle's uncursed partly eaten corpse"],
    ['Medusa', "Medusa's uncursed partly eaten corpse"],
] as const) {
    void test(`${species} corpse places inventory adjectives in native order`, async () => {
        const body = await mksobj(CORPSE, false, false);
        set_corpsenm(body, MONSTER_NAME.indexOf(species));
        body.oeaten = 1;
        body.bknown = true;

        assert.equal(inventoryItemDescription(body), expected);
    });
}

void test('food and killer names share species grammar but food ignores the stack quantity', async () => {
    const body = await mksobj(CORPSE, false, false);
    set_corpsenm(body, MONSTER_NAME.indexOf('jackal'));
    body.quan = 3;

    assert.equal(corpseName(body), 'jackal corpses');
    assert.equal(killerObjectName(body), 'jackal corpses');
    assert.equal(foodObjectName(body), 'jackal corpse');
    assert.equal(foodObjectName(body, { definite: true }), 'the jackal corpse');
});

void test('unique and personally named corpses preserve their definite and possessive grammar', async () => {
    const body = await mksobj(CORPSE, false, false);
    set_corpsenm(body, MONSTER_NAME.indexOf('Oracle'));
    body.quan = 2;
    assert.equal(inventoryItemDescription(body), "the Oracle's 2 corpses");
    assert.equal(foodObjectName(body, { definite: true }), "the Oracle's corpse");
    set_corpsenm(body, MONSTER_NAME.indexOf('Medusa'));
    assert.equal(foodObjectName(body, { definite: true }), "Medusa's corpse");
});
