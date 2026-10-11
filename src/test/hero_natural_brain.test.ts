import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { A_INT, M_ATTK_MISS, MM_NOGRP, NO_MINVENT, W_ARMH } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroNaturalBrain } from '../js/hero_natural_brain.js';
import type { HeroNaturalEffectContext } from '../js/hero_natural_types.js';
import { resetInputState } from '../js/input.js';
import { AD_DRIN, AT_TENT } from '../js/monster_attack_types.js';
import { MONSTER_ATTACKS } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, DUNCE_CAP, HELMET } from '../js/object_data.js';
import { propertyIsActive } from '../js/properties.js';
import { d, rn2, rnd } from '../js/rng.js';
import { setHeroPetrificationTimeout } from '../js/stoning.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function brainAttack(target: string, role: 'caveman' | 'wizard' = 'caveman') {
    freshObjectRoom({ role, gameplaySeed: 71n });
    requirePlayingGame(game);
    game.plname = 'Ada';
    installPolymorphedHero('mind flayer');
    const monster = await createMonsterAt(target, 11, 10, MM_NOGRP | NO_MINVENT);
    const attack = MONSTER_ATTACKS[game.u.umonnum]?.find(([method, damage]) =>
        method === AT_TENT && damage === AD_DRIN);
    assert.ok(attack, 'The mind flayer must have a brain-eating tentacle.');
    const messages: string[] = [];
    const context: HeroNaturalEffectContext = {
        state: game, publish: async message => { messages.push(message); },
        attack, damage: 3, specialDamage: 0, target: { x: 11, y: 10 },
        random: rn2, rollDice: d, rollOne: rnd,
    };
    installPagerInput(resetInputState(), {
        expected: /cannibal|bad feeling|But wait|medallion|much better|brain|Ingesting|crumble|You survive|You come back/,
        limit: 20,
    });
    return { monster, context, messages };
}

void test('brain eating restores lost intelligence without raising its maximum', async () => {
    const { monster, context } = await brainAttack('newt');
    const hero = context.state.u;
    hero.acurr.a[A_INT] = 11;
    hero.amax.a[A_INT] = 12;
    const hunger = hero.uhunger;

    const result = await applyHeroNaturalBrain(monster, context);

    assert.equal(hero.acurr.a[A_INT], 12);
    assert.equal(hero.amax.a[A_INT], 12);
    assert.ok(hero.uhunger > hunger && hero.uhunger <= hunger + 30);
    assert.ok(result.damage > 3 && result.damage <= 13);
    assert.equal(hero.uconduct.food, 1);
    assert.equal(hero.uconduct.unvegetarian, 1);
    assert.equal(result.done, false);
    assert.equal(result.nativeResult, M_ATTK_MISS);
});

void test('brain nutrition cannot choke an already overfull hero', async () => {
    const { monster, context } = await brainAttack('newt');
    context.state.u.uhunger = 2000;

    const result = await applyHeroNaturalBrain(monster, context);

    assert.ok(context.state.u.uhunger > 2000);
    assert.equal(context.state.u.umortality ?? 0, 0);
    assert.equal(result.heroDied, false);
    assert.equal(context.state._helplessTurns ?? 0, 0);
});

void test('brain food repairs base intelligence beneath the hero\'s dunce cap', async () => {
    const { monster, context } = await brainAttack('newt');
    wearHeroArmor(await addInventoryObject(DUNCE_CAP), context.state);
    context.state.u.acurr.a[A_INT] = 11;
    context.state.u.amax.a[A_INT] = 12;

    await applyHeroNaturalBrain(monster, context);

    assert.equal(context.state.u.acurr.a[A_INT], 12);
    assert.equal(context.state.u.amax.a[A_INT], 12);
});

for (const target of ['acid blob', 'long worm']) {
    void test(`${target === 'long worm' ? 'a worm tail' : 'a headless target'} prevents brain damage and further tentacle attempts`, async () => {
        const { monster, context, messages } = await brainAttack(target);
        if (target === 'long worm') context.target = { x: 12, y: 10 };

        const result = await applyHeroNaturalBrain(monster, context);

        assert.equal(result.damage, 0);
        assert.equal(result.skipBrainDrain, true);
        assert.equal(context.state.u.uconduct.food ?? 0, 0);
        assert.ok(messages.some(message => message.endsWith("doesn't seem harmed.")));
    });
}

for (const unchanging of [false, true]) {
    void test(`headless green slime ${unchanging ? 'cannot infect an unchanging hero' : 'infects the feeding hero'}`, async () => {
        const { monster, context } = await brainAttack('green slime');
        context.state.u.unchanging = unchanging;

        const result = await applyHeroNaturalBrain(monster, context);

        assert.equal(result.damage, 0);
        assert.equal(result.skipBrainDrain, true);
        assert.equal(context.state.u.slimedTurns ?? 0, unchanging ? 0 : 10);
    });
}

void test('sucking more slime does not reset a running slime transformation', async () => {
    const { monster, context } = await brainAttack('green slime');
    context.state.u.slimedTurns = 2;
    context.state.u.slimed = true;

    await applyHeroNaturalBrain(monster, context);

    assert.equal(context.state.u.slimedTurns, 2);
});

for (const helmetType of [HELMET, DUNCE_CAP]) {
    void test(`${helmetType === HELMET ? 'a helmet' : 'a dunce cap'} blocks brain eating while retaining ordinary tentacle damage`, async () => {
        const { monster, context, messages } = await brainAttack('orc');
        await equipMonsterObject(monster, await knownObject(helmetType), W_ARMH);
        context.random = () => 1;

        const result = await applyHeroNaturalBrain(monster, context);

        assert.equal(result.damage, 3);
        assert.equal(result.skipBrainDrain, undefined);
        assert.equal(context.state.u.uconduct.food ?? 0, 0);
        assert.ok(messages.some(message => message.includes('blocks your attack')));
    });
}

void test('a greased helmet lets the target slip free before brain eating', async () => {
    const { monster, context, messages } = await brainAttack('orc');
    const helmet = await equipMonsterObject(monster, await knownObject(HELMET, { greased: true }), W_ARMH);
    context.random = () => 0;

    const result = await applyHeroNaturalBrain(monster, context);

    assert.equal(result.damage, 3);
    assert.equal(context.state.u.uconduct.food ?? 0, 0);
    assert.equal(helmet.greased, false);
    assert.ok(messages.some(message => message.includes('cannot hold onto')));
});

void test('a brain-eating tentacle can get past an ordinary helmet', async () => {
    const { monster, context } = await brainAttack('orc');
    await equipMonsterObject(monster, await knownObject(HELMET), W_ARMH);
    context.random = () => 0;

    const result = await applyHeroNaturalBrain(monster, context);

    assert.ok(result.damage > 3);
    assert.equal(context.state.u.uconduct.food, 1);
});

void test('a mindless target breaks dietary conduct but yields no nourishment or extra damage', async () => {
    const { monster, context, messages } = await brainAttack('human zombie');
    const hunger = context.state.u.uhunger;
    context.state.u.acurr.a[A_INT] = 8;

    const result = await applyHeroNaturalBrain(monster, context);

    assert.equal(result.damage, 3);
    assert.equal(context.state.u.uhunger, hunger);
    assert.equal(context.state.u.acurr.a[A_INT], 8);
    assert.equal(context.state.u.uconduct.food, 1);
    assert.equal(context.state.u.uconduct.unvegetarian, 1);
    assert.ok(messages.some(message => message.endsWith("doesn't notice.")));
});

void test('a ghost has no corporeal brain to eat', async () => {
    const { monster, context, messages } = await brainAttack('ghost');
    const hunger = context.state.u.uhunger;

    const result = await applyHeroNaturalBrain(monster, context);

    assert.equal(result.damage, 3);
    assert.equal(context.state.u.uhunger, hunger);
    assert.equal(context.state.u.uconduct.food ?? 0, 0);
    assert.ok(messages.some(message => message.endsWith('brain is unharmed.')));
});

for (const resistant of [false, true]) {
    void test(`eating Medusa's brain ${resistant ? 'respects stone resistance' : 'starts delayed petrification'}`, async () => {
        const { monster, context } = await brainAttack('Medusa');
        context.state.u.stoneResistance = resistant;

        const result = await applyHeroNaturalBrain(monster, context);

        assert.equal(context.state.u.stonedTurns ?? 0, resistant ? 0 : 5);
        if (!resistant) assert.equal(context.state.u.stoneKiller, 'Medusa');
        assert.ok(result.damage > 3);
        assert.equal(context.state.u.uconduct.food, 1);
    });
}

void test('brain contact does not replace an earlier petrification timer or cause', async () => {
    const { monster, context } = await brainAttack('Medusa');
    await setHeroPetrificationTimeout(2, { state: context.state, killer: 'cockatrice' });

    await applyHeroNaturalBrain(monster, context);

    assert.equal(context.state.u.stonedTurns, 2);
    assert.equal(context.state.u.stoneKiller, 'cockatrice');
});

void test('multiple cannibal tentacles apply one luck penalty in the same turn', async () => {
    const { monster, context } = await brainAttack('mind flayer', 'wizard');

    await applyHeroNaturalBrain(monster, context);
    const luck = context.state.u.uluck ?? 0;
    await applyHeroNaturalBrain(monster, context);

    assert.ok(luck >= -5 && luck <= -2);
    assert.equal(context.state.u.uluck, luck);
    assert.equal(propertyIsActive('aggravateMonster', context.state), true);
    assert.equal(context.state.u.uconduct.food, 2);
});

void test('life saving lets the hero survive Rider brain food and retain its damage bonus', async () => {
    const { monster, context, messages } = await brainAttack('Death');
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    context.state.u.acurr.a[A_INT] = 8;

    const result = await applyHeroNaturalBrain(monster, context);

    assert.equal(result.heroDied, false);
    assert.equal(result.done, false);
    assert.equal(context.state.u.umortality, 1);
    assert.equal(amulet.where, 'gone');
    assert.ok(context.state.level.monsters.includes(monster));
    assert.equal(context.state.u.acurr.a[A_INT], 8);
    assert.ok(result.damage > 3);
    assert.ok(messages.includes('Ingesting that is fatal.'));
});
