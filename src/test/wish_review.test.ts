import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CORPSTAT_FEMALE, CORPSTAT_MALE, TREE, TREE_LOOTED, TREE_SWARM,
    W_NONDIGGABLE, W_NONPASSWALL,
} from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { addFruit } from '../js/fruit.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { mayDig } from '../js/hero_digging.js';
import { mksobj } from '../js/mklev.js';
import {
    BAG_OF_TRICKS, GLOB_OF_GRAY_OOZE, LAND_MINE, POT_HEALING, RED_DRAGON_SCALES,
    SACK, SCR_LIGHT, SLIME_MOLD, SPEED_BOOTS, TIN,
} from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a glob wish excludes matching call names from other object classes', async () => {
    freshObjectRoom({ gameplaySeed: 1 });
    recordObjectCall(POT_HEALING, 'glob of gray ooze');

    const result = await readObjectName('glob of gray ooze', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, GLOB_OF_GRAY_OOZE);
});

void test('a potion call name is not interpreted as holy water', async () => {
    freshObjectRoom();
    recordObjectCall(POT_HEALING, 'holy water');

    const result = await readObjectName('uncursed potion called holy water', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, POT_HEALING);
    assert.equal(result.object.blessed, false);
});

void test('tin contents take precedence over the holy-water potion suffix', async () => {
    freshObjectRoom();

    const result = await readObjectName('uncursed tin of holy water', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, TIN);
    assert.equal(result.object.blessed, false);
    assert.equal(result.object.cursed, false);
});

void test('a bare spinach wish checks object call names before the tin fallback', async () => {
    freshObjectRoom();
    recordObjectCall(POT_HEALING, 'spinach');

    const result = await readObjectName('spinach', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, POT_HEALING);
});

void test('a bare spinach wish produces a spinach tin when no object name matches', async () => {
    freshObjectRoom();

    const result = await readObjectName('spinach', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, TIN);
    assert.equal(result.object.spe, 1);
    assert.equal(result.object.corpsenm, -1);
});

void test('a call name does not arm a wished land mine', async () => {
    freshObjectRoom();

    const result = await readObjectName('land mine called digger', { wizardWish: true });

    assert.ok(result && !result.noWish, 'The mine should be an object');
    assert.equal(result.object.otyp, LAND_MINE);
    assert.equal(requireGameLevel().traps.length, 0);
});

void test('ordinary trapped chest wishes retain a generated trap', async () => {
    freshObjectRoom({ gameplaySeed: 5 });

    const result = await readObjectName('trapped chest');

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otrapped, true);
});

void test('an ordinary untrapped chest wish removes a generated trap', async () => {
    freshObjectRoom({ gameplaySeed: 5 });

    const result = await readObjectName('untrapped chest');

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otrapped, false);
});

void test('broken glass is rejected instead of granting a glass gem', async () => {
    freshObjectRoom();

    const result = await readObjectName('broken glass', { wizardWish: true });

    assert.equal(result, null);
});

void test('an unmatched bag call name falls back to a bag description', async () => {
    freshObjectRoom({ gameplaySeed: 1 });

    const result = await readObjectName('bag called unregistered', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.ok(result.object.otyp >= SACK && result.object.otyp <= BAG_OF_TRICKS,
        `Expected a bag, received object type ${result.object.otyp}`);
});

void test('a plural range noun keeps its class when resolving a call name', async () => {
    freshObjectRoom();
    recordObjectCall(SPEED_BOOTS, 'speedy');
    recordObjectCall(POT_HEALING, 'speedy');

    const result = await readObjectName('boots called speedy', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, SPEED_BOOTS);
});

void test('an explicit article requests one fruit even with a plural registered label', async () => {
    freshObjectRoom();
    const fruit = addFruit('berries');

    const result = await readObjectName('a berries', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.spe, fruit);
    assert.equal(result.object.quan, 1);
});

for (const [name, blessing, blessed, cursed] of [
    ['holy Guava', 'uncursed', false, false],
    ['unholy Guava', 'blessed', true, false],
    ['Guava', 'cursed blessed', false, true],
    ['Guava', 'uncursed blessed', false, false],
] as const) {
    void test(`a fruit wish restores ${blessing} when matching ${name}`, async () => {
        freshObjectRoom();
        const fruit = addFruit(name);

        const result = await readObjectName(`${blessing} ${name}`, { wizardWish: true });

        assert.ok(result && !result.noWish);
        assert.equal(result.object.otyp, SLIME_MOLD);
        assert.equal(result.object.spe, fruit);
        assert.equal(result.object.blessed, blessed);
        assert.equal(result.object.cursed, cursed);
    });
}

void test('partly eaten within a registered fruit name does not consume that fruit', async () => {
    freshObjectRoom();
    const fruit = addFruit('greased partly eaten Guava');

    const result = await readObjectName('greased partly eaten Guava', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, SLIME_MOLD);
    assert.equal(result.object.spe, fruit);
    assert.equal(result.object.oeaten ?? 0, 0);
});

void test('a neutral monster alias replaces a wished gender and can depict either sex', async () => {
    const genders = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
        freshObjectRoom({ gameplaySeed: seed });

        const result = await readObjectName('female grey dragon statue', { wizardWish: true });

        assert.ok(result && !result.noWish, `Statue wish failed with seed ${seed}`);
        genders.add(result.object.spe);
    }
    assert.ok(genders.has(CORPSTAT_MALE), 'Alias wishes should be able to produce male statues');
    assert.ok(genders.has(CORPSTAT_FEMALE), 'Alias wishes should be able to produce female statues');
});

void test('a canonical neutral monster name preserves the explicit wished gender', async () => {
    freshObjectRoom();

    const result = await readObjectName('female gray dragon statue', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.spe, CORPSTAT_FEMALE);
});

for (const request of ['scales of red dragon', 'red dragon scales']) {
    void test(`a wish for ${request} produces that dragon's scales`, async () => {
        freshObjectRoom();

        const result = await readObjectName(request, { wizardWish: true });

        assert.ok(result && !result.noWish, `Scale wish was rejected: ${request}`);
        assert.equal(result.object.otyp, RED_DRAGON_SCALES);
    });
}

for (const [noun, oclass] of [['ring', 4], ['wand', 11]] as const) {
    void test(`of spinach does not change a wished ${noun} into food`, async () => {
        freshObjectRoom();

        const result = await readObjectName(`${noun} of spinach`, { wizardWish: true });

        assert.ok(result && !result.noWish);
        assert.equal(result.object.oclass, oclass);
    });
}

void test('luck can protect a floor scroll from water created by a wizard wish', async () => {
    freshObjectRoom({ gameplaySeed: 1, hero: { uluck: 13 } });
    const scroll = await mksobj(SCR_LIGHT, false, false);
    placeCreatedObject(scroll, game.u.ux, game.u.uy);

    const result = await readObjectName('pool', { wizardWish: true });

    assert.ok(result?.noWish);
    assert.equal(scroll.otyp, SCR_LIGHT, 'Luck should protect this scroll from blanking');
});

void test('a wished tree can be dug even when it replaces an undiggable wall', async () => {
    freshObjectRoom();
    await readObjectName('undiggable wall', { wizardWish: true });
    assert.equal(mayDig(game.u.ux, game.u.uy), false);

    const result = await readObjectName('looted tree', { wizardWish: true });

    assert.ok(result?.noWish);
    const tree = requireGameLevel().requireAt(game.u.ux, game.u.uy);
    assert.equal(tree.typ, TREE);
    assert.equal(tree.looted, TREE_LOOTED | TREE_SWARM);
    assert.equal(mayDig(game.u.ux, game.u.uy), true);
});

void test('a tree wish still honors an explicit undiggable property', async () => {
    freshObjectRoom();

    const result = await readObjectName('undiggable tree', { wizardWish: true });

    assert.ok(result?.noWish);
    assert.equal(mayDig(game.u.ux, game.u.uy), false);
});

for (const noun of ['wall', 'tree', 'iron bars']) {
    for (const suffix of ['named', 'called', 'labeled']) {
        void test(`a ${noun} wish ignores wall properties in its ${suffix} suffix`, async () => {
            freshObjectRoom();

            const result = await readObjectName(`${noun} ${suffix} undiggable unphaseable example`, { wizardWish: true });

            assert.ok(result?.noWish);
            const location = requireGameLevel().requireAt(game.u.ux, game.u.uy);
            assert.equal(location.wall_info & (W_NONDIGGABLE | W_NONPASSWALL), 0);
            assert.equal(mayDig(game.u.ux, game.u.uy), true);
        });
    }
}
