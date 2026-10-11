import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { NO_MINVENT, W_ARM, W_ARMG, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroNaturalTheft } from '../js/hero_natural_theft.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import { AD_SEDU, AD_SGLD, AD_SITM, AD_SSEX, AT_CLAW, AT_TUCH } from '../js/monster_attack_types.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_LIFE_SAVING, APPLE, BOULDER, DAGGER, GOLD_PIECE,
    LEATHER_ARMOR, LEATHER_GLOVES, STATUE,
} from '../js/object_data.js';
import { d, rn2, rnd } from '../js/rng.js';
import type { DamageType } from '../js/monster_attack_types.js';
import type { HeroNaturalEffectContext } from '../js/hero_natural_types.js';
import { addInventoryObject, knownObject, untimedCorpse } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

function theftRoom(form = 'wood nymph', damageType: DamageType = AD_SEDU) {
    const level = freshObjectRoom({ gameplaySeed: 37n, flags: { female: true } });
    requirePlayingGame(game);
    setHeroSpecies(nameToMonster(form), game);
    game.u.mfemale = true;
    game.u.mh = game.u.mhmax = 40;
    game.storage = memoryStorage();
    const messages: string[] = [];
    const context: HeroNaturalEffectContext = {
        state: game, publish: message => { messages.push(message); },
        random: rn2, rollDice: d, rollOne: rnd,
        attack: [damageType === AD_SGLD ? AT_CLAW : AT_TUCH, damageType, 0, 0],
        damage: 8, specialDamage: 0, target: { x: 11, y: 10 },
    };
    return { level, messages, context };
}

void test('gold theft merges an entire purse even with all lettered inventory slots occupied', async () => {
    const { context, messages } = theftRoom('leprechaun', AD_SGLD);
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 10 });
    for (let i = 0; i < 52; i++) await addInventoryObject(DAGGER, { nomerge: true });
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const gold = await knownObject(GOLD_PIECE, { quan: 73 });
    await addObjectToMonsterInventory(monster, gold);

    const result = await applyHeroNaturalTheft(monster, context);

    assert.equal(purse.quan, 83);
    assert.equal(monster.minvent.length, 0);
    assert.equal(result.damage, 0);
    assert.ok(messages.includes('Your purse feels heavier.'));
});

void test('gold theft drops the purse when no stack or lettered inventory slot is available', async () => {
    const { level, context, messages } = theftRoom('leprechaun', AD_SGLD);
    for (let i = 0; i < 52; i++) await addInventoryObject(DAGGER, { nomerge: true });
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const gold = await knownObject(GOLD_PIECE, { quan: 73 });
    await addObjectToMonsterInventory(monster, gold);

    await applyHeroNaturalTheft(monster, context);

    assert.ok(floorObjectsAt(level, game.u.ux, game.u.uy).includes(gold));
    assert.equal(gold.quan, 73);
    assert.equal(monster.minvent.length, 0);
    assert.match(messages.join('\n'), /find no room in your knapsack/);
});

void test('item theft takes one possession and leaves gold with an unarmored victim', async () => {
    const { context } = theftRoom();
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const apple = await knownObject(APPLE);
    const dagger = await knownObject(DAGGER);
    const gold = await knownObject(GOLD_PIECE, { quan: 30 });
    for (const object of [apple, dagger, gold]) await addObjectToMonsterInventory(monster, object);

    await applyHeroNaturalTheft(monster, context);

    assert.ok(game.inventory.includes(dagger));
    assert.ok(monster.minvent.includes(apple));
    assert.ok(monster.minvent.includes(gold));
    assert.equal(game.inventory.length, 1);
});

const seductionDamageTypes: DamageType[] = [AD_SEDU, AD_SSEX];
for (const damageType of seductionDamageTypes) {
    void test(`seduction attack ${damageType} removes a movable victim's suit last and leaves their gold`, async () => {
        const { context, messages } = theftRoom('amorous demon', damageType);
        const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
        monster.female = false;
        const apple = await knownObject(APPLE);
        const gold = await knownObject(GOLD_PIECE, { quan: 30 });
        await addObjectToMonsterInventory(monster, apple);
        const suit = await equipMonsterObject(monster, await knownObject(LEATHER_ARMOR), W_ARM);
        await addObjectToMonsterInventory(monster, gold);

        await applyHeroNaturalTheft(monster, context);

        assert.ok(game.inventory.includes(apple));
        assert.ok(game.inventory.includes(suit));
        assert.deepEqual(monster.minvent, [gold]);
        assert.equal(suit.owornmask, 0);
        assert.equal((monster.misc_worn_check ?? 0) & W_ARM, 0);
        const firstTheft = messages.findIndex(message => message.startsWith('You steal:'));
        const undressed = messages.findIndex(message => message.includes('finishes taking off his suit'));
        assert.ok(firstTheft >= 0 && undressed > firstTheft,
            'The visible suit-removal message follows theft of the other possessions.');
        assert.match(messages.join('\n'), /You seduce the soldier/);
    });
}

void test('a nymph charms a victim of the same gender into giving up possessions', async () => {
    const { context, messages } = theftRoom();
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    monster.female = true;
    await equipMonsterObject(monster, await knownObject(LEATHER_ARMOR), W_ARM);
    await addObjectToMonsterInventory(monster, await knownObject(GOLD_PIECE));

    await applyHeroNaturalTheft(monster, context);

    assert.ok(messages.includes('You charm the soldier.  She gladly hands over most of her possessions.'));
});

for (const immobile of [false, true]) {
    void test(immobile ? 'a paralyzed victim cannot disrobe for a nymph' : 'a monkey steals one item without seducing an armored victim', async () => {
        const { context, messages } = theftRoom(immobile ? 'wood nymph' : 'monkey', immobile ? AD_SEDU : AD_SITM);
        const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
        if (immobile) monster.mcanmove = 0;
        const suit = await equipMonsterObject(monster, await knownObject(LEATHER_ARMOR), W_ARM);
        const apple = await knownObject(APPLE);
        await addObjectToMonsterInventory(monster, apple);

        await applyHeroNaturalTheft(monster, context);

        assert.ok(game.inventory.includes(apple));
        assert.ok(monster.minvent.includes(suit));
        assert.equal(suit.owornmask, W_ARM);
        assert.doesNotMatch(messages.join('\n'), /seduce|charm|clothes/);
    });
}

void test('theft removes a cursed wielded weapon without leaving a monster ownership link', async () => {
    const { context } = theftRoom('monkey', AD_SITM);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const dagger = await equipMonsterObject(monster, await knownObject(DAGGER, { cursed: true }), W_WEP);

    await applyHeroNaturalTheft(monster, context);

    assert.ok(game.inventory.includes(dagger));
    assert.equal(monster.mw, null);
    assert.equal(dagger.where, 'inventory');
    assert.equal(dagger.owornmask, 0);
    assert.equal(dagger.wielded, false);
    assert.equal(dagger.cursed, true);
});

void test('an overloaded theft drops the object before continuing to an item the hero can hold', async () => {
    const { level, context, messages } = theftRoom('monkey', AD_SITM);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const apple = await knownObject(APPLE);
    const boulder = await knownObject(BOULDER);
    await addObjectToMonsterInventory(monster, apple);
    await addObjectToMonsterInventory(monster, boulder);

    await applyHeroNaturalTheft(monster, context);

    assert.ok(floorObjectsAt(level, game.u.ux, game.u.uy).includes(boulder));
    assert.ok(game.inventory.includes(apple));
    assert.equal(monster.minvent.length, 0);
    assert.match(messages.join('\n'), /You snatched but dropped .*boulder/);
});

void test('stealing gloves petrifies a corpse-wielding victim and preserves their gold inside the statue', async () => {
    const { level, context } = theftRoom('monkey', AD_SITM);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const corpse = await untimedCorpse(nameToMonster('cockatrice'));
    await equipMonsterObject(monster, corpse, W_WEP);
    const gloves = await equipMonsterObject(monster, await knownObject(LEATHER_GLOVES), W_ARMG);
    const gold = await knownObject(GOLD_PIECE, { quan: 39 });
    await addObjectToMonsterInventory(monster, gold);

    const result = await applyHeroNaturalTheft(monster, context);

    assert.equal(result.damage, 0);
    assert.equal(monster.dead, true);
    assert.ok(game.inventory.includes(gloves));
    const statue = floorObjectsAt(level, 11, 10).find(object => object.otyp === STATUE);
    assert.ok(statue);
    assert.ok(statue.contents?.includes(gold));
    assert.ok(statue.contents?.includes(corpse));
    assert.equal(game.u.uconduct?.killer, 1);
    assert.equal(requireMonsterVital(monster.mnum).died, 1);
});

void test('touching a stolen petrifying corpse stops seduction even when life saving rescues the hero', async () => {
    const { context } = theftRoom();
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const suit = await equipMonsterObject(monster, await knownObject(LEATHER_ARMOR), W_ARM);
    const corpse = await untimedCorpse(nameToMonster('cockatrice'));
    await addObjectToMonsterInventory(monster, corpse);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /life saving|But wait|medallion|feel much better|crumbles|back to life/,
        limit: 10,
    });

    const result = await applyHeroNaturalTheft(monster, context);

    assert.equal(result.heroDied, false);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.u.umortality, 1);
    assert.ok(game.inventory.includes(corpse));
    assert.ok(monster.minvent.includes(suit));
    assert.equal(suit.owornmask, W_ARM);
});
