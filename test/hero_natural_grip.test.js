import { objectTypeKnown } from '../js/shk.js';
import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { M_ATTK_DEF_DIED, NO_MINVENT, POOL, W_AMUL, W_ARM, W_ARMC, W_ARMH, W_ARMU } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroNaturalGrip, monsterSlipsFromHeroGrip } from '../js/hero_natural_grip.js';
import { resolveHeroNaturalDamage } from '../js/hero_natural_damage.js';
import { resetInputState } from '../js/input.js';
import { AD_STCK, AD_WRAP, AT_TUCH } from '../js/monster_attack_types.js';
import { AMULET_OF_LIFE_SAVING, OBJECT_NAMES } from '../js/object_data.js';
import { d, rn2, rnd } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function gripScene(form = 'lichen', defender = 'goblin') {
    freshObjectRoom({ gameplaySeed: 97n, flags: { verbose: true } });
    installPolymorphedHero(form);
    const monster = await createMonsterAt(defender, 11, 10, NO_MINVENT);
    requirePlayingGame(game);
    const messages = [];
    const context = {
        state: game,
        publish: async (message) => { messages.push(message); },
        random: rn2,
        rollDice: d,
        rollOne: rnd,
        attack: [AT_TUCH, AD_STCK, 0, 0],
        damage: 3,
        specialDamage: 0,
        target: { x: monster.mx, y: monster.my },
    };
    return { monster, context, messages };
}
void test('a sticky hero holds an adjacent target and retains physical damage', async () => {
    const { monster, context } = await gripScene();
    const result = await applyHeroNaturalGrip(monster, context);
    assert.equal(game.u.ustuck, monster);
    assert.equal(result.damage, 3);
    assert.equal(result.done, false);
});
void test('magic cancellation prevents adhesion without preventing physical damage', async () => {
    const { monster, context } = await gripScene();
    await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('cloak of protection')), W_ARMC);
    const result = await applyHeroNaturalGrip(monster, { ...context, random: () => 0 });
    assert.ok(!game.u.ustuck);
    assert.equal(result.damage, 3);
});
void test('adhesion cannot hold another sticky species or a distant target', async () => {
    const { monster, context } = await gripScene('lichen', 'violet fungus');
    await applyHeroNaturalGrip(monster, context);
    assert.ok(!game.u.ustuck);
    const distant = await createMonsterAt('goblin', 15, 10, NO_MINVENT);
    await applyHeroNaturalGrip(distant, { ...context, target: { x: 15, y: 10 } });
    assert.ok(!game.u.ustuck);
});
void test('barbed devil adhesion names the held creature', async () => {
    const { monster, context, messages } = await gripScene('barbed devil');
    await applyHeroNaturalGrip(monster, context);
    assert.equal(game.u.ustuck, monster);
    assert.deepEqual(messages, ['Your barbs stick to the goblin!']);
});
void test('the pinned wrap rule brushes a head contact instead of grabbing', async () => {
    const { monster, context, messages } = await gripScene('giant eel');
    const result = await applyHeroNaturalGrip(monster, {
        ...context, attack: [AT_TUCH, AD_WRAP, 0, 0], random: () => 0,
    });
    assert.equal(result.damage, 0);
    assert.ok(!game.u.ustuck);
    assert.deepEqual(messages, ["You brush against the goblin's tail."]);
});
void test('an eel wrap can catch a long worm away from its head', async () => {
    const { monster, context, messages } = await gripScene('giant eel', 'long worm');
    const target = monster.wormSegments?.find(segment => segment.x !== 0);
    assert.ok(target, 'The long worm should have a tail to touch.');
    const result = await applyHeroNaturalGrip(monster, {
        ...context, target, attack: [AT_TUCH, AD_WRAP, 0, 0], random: () => 0,
    });
    assert.equal(game.u.ustuck, monster);
    assert.equal(result.damage, 3);
    assert.deepEqual(messages, ['You swing yourself around the long worm!']);
});
void test('an established water grip deals enough damage to drown a breathing worm', async () => {
    const { monster, context, messages } = await gripScene('giant eel', 'long worm');
    const target = monster.wormSegments?.find(segment => segment.x !== 0);
    assert.ok(target, 'The long worm should have a tail to touch.');
    game.u.ustuck = monster;
    context.state.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const result = await applyHeroNaturalGrip(monster, {
        ...context, target, attack: [AT_TUCH, AD_WRAP, 0, 0],
    });
    assert.equal(result.damage, monster.mhp);
    assert.equal(result.done, false, 'The common damage owner must resolve death and life saving.');
    assert.deepEqual(messages, ['You drown the long worm...']);
});
for (const lifeSaved of [false, true]) {
    void test(`natural drowning ${lifeSaved ? 'consumes life saving but still ends the attack' : 'awards the hero kill and releases the body'}`, async () => {
        const { monster, context, messages } = await gripScene('giant eel', 'long worm');
        const target = monster.wormSegments?.find(segment => segment.x !== 0);
        assert.ok(target, 'The long worm should have a tail to touch.');
        const amulet = lifeSaved
            ? await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL)
            : null;
        game.u.ustuck = monster;
        context.state.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
        installPagerInput(resetInputState(), {
            expected: /But wait|long worm|medallion|feel more experienced|Welcome to experience level/,
            limit: 6,
        });
        const result = await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_WRAP, 0, 0], 0, {
            ...context, target,
        });
        assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
        assert.equal(result.heroDied, false);
        assert.equal(context.state.u.uconduct.killer, 1);
        assert.equal(monsterAtPosition(context.state.level, monster.mx, monster.my) === monster, lifeSaved);
        assert.match(messages.join('\n'), /You drown the long worm/);
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.equal(monster.mhp, monster.mhpmax);
        }
        else {
            assert.equal(monster.dead, true);
            assert.equal(game.u.ustuck, null);
            assert.ok(context.state.u.uexp > 0);
        }
    });
}
void test('body grip checks the outer cloak before a greased suit or shirt', async () => {
    const { monster, context } = await gripScene();
    await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('leather cloak')), W_ARMC);
    await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('leather armor'), { greased: true }), W_ARM);
    await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('T-shirt'), { greased: true }), W_ARMU);
    const slipped = await monsterSlipsFromHeroGrip(monster, { ...context, head: false });
    assert.equal(slipped, false);
});
for (const [name, mask] of [['leather armor', W_ARM], ['T-shirt', W_ARMU]]) {
    void test(`an exposed greased ${name} prevents a body grip`, async () => {
        const { monster, context, messages } = await gripScene();
        const armor = await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf(name), { greased: true }), mask);
        const slipped = await monsterSlipsFromHeroGrip(monster, {
            ...context, head: false, random: () => 0,
        });
        assert.equal(slipped, true);
        assert.equal(armor.greased, false);
        assert.match(messages[0] ?? '', /You slip off of the goblin's greased/);
        assert.equal(messages[1], 'The grease wears off.');
    });
}
void test('an unknown oilskin cloak slips without revealing its type or repeating slippery', async () => {
    const { monster, context, messages } = await gripScene();
    const cloak = await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('oilskin cloak'), { typeKnown: false, known: false }), W_ARMC);
    const slipped = await monsterSlipsFromHeroGrip(monster, { ...context, head: false });
    assert.equal(slipped, true);
    assert.equal(objectTypeKnown(cloak), false);
    assert.deepEqual(messages, ["You slip off of the goblin's slippery cloak!"]);
});
void test('cursed grease can fail to protect the body and stays on the armor', async () => {
    const { monster, context, messages } = await gripScene();
    const armor = await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('leather armor'), { greased: true, cursed: true }), W_ARM);
    const slipped = await monsterSlipsFromHeroGrip(monster, {
        ...context, head: false, random: () => 0,
    });
    assert.equal(slipped, false);
    assert.equal(armor.greased, true);
    assert.equal(messages.length, 0);
});
void test('a brain-draining grip slips on helmet grease without wearing it off every time', async () => {
    const { monster, context, messages } = await gripScene('mind flayer');
    const helmet = await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('helmet'), { greased: true }), W_ARMH);
    const slipped = await monsterSlipsFromHeroGrip(monster, {
        ...context, head: true, random: () => 1,
    });
    assert.equal(slipped, true);
    assert.equal(helmet.greased, true);
    assert.match(messages[0] ?? '', /You grab, but cannot hold onto the goblin's greased/);
    assert.equal(messages.length, 1);
});
void test('head grip ignores a greased cloak when the helmet is bare', async () => {
    const { monster, context } = await gripScene('mind flayer');
    await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('helmet')), W_ARMH);
    await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('leather cloak'), { greased: true }), W_ARMC);
    assert.equal(await monsterSlipsFromHeroGrip(monster, { ...context, head: true }), false);
});
//# sourceMappingURL=hero_natural_grip.test.js.map