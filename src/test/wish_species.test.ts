import assert from 'node:assert/strict';
import test from 'node:test';

import { CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_NEUTER, G_GENOD } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, EGG, FIGURINE, GLOB_OF_GRAY_OOZE, STATUE, TIN } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { runDueTimers } from '../js/timer_effects.js';
import { freshObjectRoom } from './support/object-room.js';

async function wish(request: string, wizardWish = true) {
    const result = await readObjectName(request, { wizardWish });
    assert.ok(result && !result.noWish, `Wish was rejected: ${request}`);
    return result.object;
}

for (const request of ['female gnome ruler statue', 'statue of a female gnome ruler']) {
    void test(`a wish preserves species and gender in ${request}`, async () => {
        freshObjectRoom();

        const statue = await wish(request);

        assert.equal(statue.otyp, STATUE);
        assert.equal(statue.corpsenm, MONSTER_NAME.indexOf('gnome ruler'));
        assert.equal(statue.spe, CORPSTAT_FEMALE);
    });
}

void test('historic statues retain history along with the depicted gender', async () => {
    freshObjectRoom();

    const statue = await wish('historic female statue of a gnome ruler');

    assert.equal(statue.spe, CORPSTAT_HISTORIC | CORPSTAT_FEMALE);
});

void test('a neuter species overrides a female corpse request', async () => {
    freshObjectRoom();

    const corpse = await wish('female lichen corpse');

    assert.equal(corpse.otyp, CORPSE);
    assert.equal(corpse.corpsenm, MONSTER_NAME.indexOf('lichen'));
    assert.equal(corpse.spe, CORPSTAT_NEUTER);
});

void test('a zombifying newt corpse wish rots after ten to fourteen turns', async () => {
    freshObjectRoom();
    const corpse = await wish('zombifying newt corpse');
    assert.equal(corpse.corpsenm, MONSTER_NAME.indexOf('newt'));
    placeCreatedObject(corpse, game.u.ux, game.u.uy);

    game.moves += 9;
    await runDueTimers();
    assert.equal(corpse.where, 'floor', 'The corpse should remain for at least ten turns');

    game.moves += 5;
    await runDueTimers();
    assert.equal(corpse.where, 'gone', 'A species without a zombie form should rot by turn fourteen');
});

void test('corpse wishes for pudding species produce their glob', async () => {
    freshObjectRoom();

    const glob = await wish('gray ooze corpse');

    assert.equal(glob.otyp, GLOB_OF_GRAY_OOZE);
    assert.equal(glob.quan, 1);
});

void test('a tin wish can contain spinach or be empty', async () => {
    freshObjectRoom();

    const spinach = await wish('tin of spinach');
    const empty = await wish('empty tin');

    assert.equal(spinach.otyp, TIN);
    assert.equal(spinach.spe, 1);
    assert.equal(spinach.corpsenm, -1);
    assert.equal(empty.otyp, TIN);
    assert.equal(empty.corpsenm, -1);
});

void test('a tin of a genocided species is empty', async () => {
    freshObjectRoom();
    const newt = MONSTER_NAME.indexOf('newt');
    game.mvitals = [];
    game.mvitals[newt] = { born: 0, died: 0, mvflags: G_GENOD };

    const tin = await wish('tin of newt meat');

    assert.equal(tin.corpsenm, -1);
});

void test('wished eggs keep a hatchable species and start its timer', async () => {
    freshObjectRoom();

    const egg = await wish('cockatrice egg');

    assert.equal(egg.otyp, EGG);
    assert.equal(egg.corpsenm, MONSTER_NAME.indexOf('cockatrice'));
    assert.ok(egg.objectTimers?.some(timer => timer.kind === 'hatch-egg'));
});

void test('a figurine cannot depict a unique monster even for a wizard', async () => {
    freshObjectRoom();

    const figurine = await wish('figurine of Medusa');

    assert.equal(figurine.otyp, FIGURINE);
    assert.notEqual(figurine.corpsenm, MONSTER_NAME.indexOf('Medusa'));
});
