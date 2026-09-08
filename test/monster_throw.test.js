import test from 'node:test';
import assert from 'node:assert/strict';

import {
    continueMonsterWeaponVolley,
    finishDeferredRangedProjectileHit,
    finishHeroProjectileHit, finishMonsterProjectileHit,
    presentMonsterProjectileShot,
    readyRangedMonsterWeapon, selectMonsterMissile,
    throwMonsterWeaponAtHero, throwMonsterWeaponAtMonster,
} from '../js/monster_throw.js';
import {
    A_STR, MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NEED_WEAPON,
    NO_MINVENT, NO_WEAPON_WANTED, W_AMUL, W_WEP,
} from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    AMULET_OF_LIFE_SAVING, ARROW, BOULDER, BOW, CORPSE, CREAM_PIE,
    CROSSBOW, CROSSBOW_BOLT, DAGGER, DART, EGG, ELVEN_ARROW,
    ELVEN_BOW, OBJECT_NAMES, SLING, STATUE, YA, YUMI,
} from '../js/object_data.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    beginMonsterRangedTurn, continueMonsterRangedTurn,
} from '../js/dogmove.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    addInventoryObject, uninitializedObject,
} from './support/game-objects.js';
import { wearHeroAccessory } from '../js/accessory.js';
import {
    floorObjectQuantityAt, floorObjectsAt,
} from './support/level-state.js';
import {
    createMonsterAt, equipMonsterObject,
} from './support/monsters.js';
import {
    finishRangedAttacks, freshRangedCombatRoom,
} from './support/ranged-combat.js';

const PROJECTILE_GLYPH = { ch: ')', color: 0, decgfx: false, attr: 0 };
const SILVER_DAGGER = OBJECT_NAMES.indexOf('silver dagger');
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT
    | NO_MINVENT;

async function combatant(species, {
    x = 9,
    y = 10,
    hitPoints,
    tame = false,
    inventory = [],
} = {}) {
    const monster = await createMonsterAt(
        species, x, y, TEST_MONSTER_FLAGS,
    );
    if (tame) tameMonster(monster, game);
    if (hitPoints !== undefined)
        monster.mhp = monster.mhpmax = hitPoints;
    for (const object of inventory)
        addObjectToMonsterInventory(monster, object, game);
    return monster;
}

test('a monster readies the launcher required by its ammunition', async () => {
    freshRangedCombatRoom();
    const bow = uninitializedObject(BOW);
    const arrows = uninitializedObject(ARROW, { quan: 6 });
    const archer = await combatant('orc', {
        x: 10,
        inventory: [arrows, bow],
    });
    archer.weaponCheck = NEED_WEAPON;

    const readied = await readyRangedMonsterWeapon(archer);

    assert.equal(readied, true);
    assert.equal(archer.mw, bow);
    assert.equal(bow.wielded, true);
    assert.equal(selectMonsterMissile(archer)?.missile, arrows);
});

test('trying to ready a bow spends the attack when the current weapon is welded', async () => {
    freshRangedCombatRoom();
    const arrows = uninitializedObject(ARROW, { quan: 6 });
    const orc = await combatant('orc', { inventory: [arrows, uninitializedObject(BOW)] });
    const dagger = equipMonsterObject(orc, uninitializedObject(DAGGER, { cursed: true }), W_WEP);
    orc.weaponCheck = NEED_WEAPON;
    const target = await combatant('lichen', { x: 12 });
    const health = target.mhp;
    pushKeys('  ');

    const attack = await throwMonsterWeaponAtMonster(orc, target, game);

    assert.equal(attack.spentWielding, true);
    assert.equal(orc.mw?.o_id, dagger.o_id);
    assert.equal(arrows.quan, 6);
    assert.equal(target.mhp, health);
});

test('a monster can shoot ya from an ordinary bow', async () => {
    freshRangedCombatRoom();
    const arrows = uninitializedObject(YA, { quan: 6 });
    const orc = await combatant('orc', { inventory: [arrows] });
    equipMonsterObject(orc, uninitializedObject(BOW), W_WEP);
    orc.weaponCheck = NEED_WEAPON;
    const target = await combatant('lichen', { x: 12 });

    const attack = await throwMonsterWeaponAtMonster(orc, target, game);

    assert.equal(attack?.launched, true);
    assert.ok(arrows.quan < 6);
    finishRangedAttacks([attack], game);
});

test('a monster prefers a yumi to a more recently acquired ordinary bow', async () => {
    freshRangedCombatRoom();
    const orc = await combatant('orc', {
        inventory: [uninitializedObject(ARROW), uninitializedObject(YUMI), uninitializedObject(BOW)],
    });

    const selection = selectMonsterMissile(orc);

    assert.equal(selection?.missile.otyp, ARROW);
    assert.equal(selection?.launcher.otyp, YUMI);
});

test('a monster keeps its welded dagger but can throw a spare one', async () => {
    freshRangedCombatRoom();
    const orc = await combatant('orc');
    const held = equipMonsterObject(orc, uninitializedObject(DAGGER, { cursed: true }), W_WEP);
    orc.weaponCheck = NO_WEAPON_WANTED;
    assert.equal(selectMonsterMissile(orc), null);
    const spare = addObjectToMonsterInventory(orc, uninitializedObject(DAGGER));

    assert.equal(selectMonsterMissile(orc)?.missile.o_id, spare.o_id);
    assert.equal(orc.mw?.o_id, held.o_id);
});

test('Kops choose pies and giants choose boulders before ordinary missiles', async () => {
    freshRangedCombatRoom();
    const kop = await combatant('Keystone Kop', {
        inventory: [uninitializedObject(CREAM_PIE), uninitializedObject(DAGGER)],
    });
    const giant = await combatant('giant', {
        x: 10,
        inventory: [uninitializedObject(BOULDER), uninitializedObject(DAGGER)],
    });

    assert.equal(selectMonsterMissile(kop)?.missile.otyp, CREAM_PIE);
    assert.equal(selectMonsterMissile(giant)?.missile.otyp, BOULDER);
});

test('a monster that does not collect gems uses one in its sling before throwing darts', async () => {
    freshRangedCombatRoom();
    const gem = uninitializedObject(OBJECT_NAMES.indexOf('emerald'));
    const soldier = await combatant('soldier', {
        inventory: [gem, uninitializedObject(SLING), uninitializedObject(DART)],
    });

    const selection = selectMonsterMissile(soldier);

    assert.equal(selection?.missile.o_id, gem.o_id);
    assert.equal(selection?.launcher.otyp, SLING);
});

test('a tame orc throws a dagger at a distant monster', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const dagger = uninitializedObject(DAGGER);
    const orc = await combatant('orc', {
        tame: true,
        inventory: [dagger],
    });
    const target = await combatant('jackal', { x: 12, hitPoints: 1 });

    const action = await takeMonsterTurn(
        orc, game,
        () => 1,
        (count, sides) => count * sides,
        () => 1,
    );
    finishRangedAttacks(action.movement.rangedAttacks, game, {
        random: () => 0,
    });

    assert.deepEqual([orc.mx, orc.my], [9, 10]);
    assert.equal(target.mhp, 0);
    assert.equal(orc.inventory.includes(dagger), false);
    assert.equal(
        floorObjectsAt(game.level, 12, 10).some(
            object => object.otyp === DAGGER,
        ),
        true,
    );
});

test('a poisoned dart adds poison damage to a susceptible monster',
    async () => {
        freshRangedCombatRoom({ gameplaySeed: 1n });
        const dart = uninitializedObject(DART, { opoisoned: 1 });
        const orc = await combatant('orc', {
            tame: true,
            inventory: [dart],
        });
        const target = await combatant('purple worm', {
            x: 12,
            hitPoints: 20,
        });
        const options = { random: () => 1, rollOne: () => 1 };

        const attack = await throwMonsterWeaponAtMonster(
            orc, target, game, options,
        );
        finishRangedAttacks([attack], game, options);

        assert.equal(target.mhp, 18);
    });

test('a silver dagger sears a vampire', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n, recalculateVision: true });
    const dagger = uninitializedObject(SILVER_DAGGER);
    const orc = await combatant('orc', {
        tame: true,
        inventory: [dagger],
    });
    const vampire = await combatant('vampire', {
        x: 12,
        hitPoints: 100,
    });
    const rolls = [1, 4, 20];
    const options = { random: () => 1, rollOne: () => rolls.shift() };

    const attack = await throwMonsterWeaponAtMonster(
        orc, vampire, game, options,
    );
    const messages = [];
    await presentMonsterProjectileShot(
        attack.shots[0], PROJECTILE_GLYPH, game, {
            publish: async message => messages.push(message),
        },
    );

    assert.equal(vampire.mhp, 76);
    assert.equal(messages.length, 2);
    assert.match(messages[0], /^The silver dagger hits the /);
    assert.match(messages[1], /^The silver sears .*flesh!$/);
});

test('a silver dagger sears a lycanthropic hero', async () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        gameplaySeed: 1n,
        hero: {
            uac: 30,
            uhp: 100,
            uhpmax: 100,
            ulycn: MONSTER_NAME.indexOf('werewolf'),
        },
    });
    const dagger = uninitializedObject(SILVER_DAGGER);
    const orc = await combatant('orc', {
        inventory: [dagger],
    });
    const attack = throwMonsterWeaponAtHero(orc, game, dagger, {
        random: () => 1,
        rollOne: range => range,
    });
    const messages = [];

    await finishHeroProjectileHit(attack.shots[0], game, {
        publish: async message => messages.push(message),
    });

    assert.equal(game.u.uhp, 76);
    assert.deepEqual(messages, ['The silver sears your flesh!']);
});

test('a cream pie blinds a monster without hurting it', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n, recalculateVision: true });
    const pie = uninitializedObject(CREAM_PIE);
    const orc = await combatant('orc', {
        tame: true,
        inventory: [pie],
    });
    const target = await combatant('jackal', { x: 12 });
    const hitPointsBefore = target.mhp;

    const attack = await throwMonsterWeaponAtMonster(orc, target, game, {
        random: () => 1,
        rollOne: () => 1,
    });
    const shot = attack.shots[0];
    const messages = [];
    await presentMonsterProjectileShot(shot, PROJECTILE_GLYPH, game, {
        publish: async message => messages.push(message),
    });
    finishDeferredRangedProjectileHit(shot, game, () => 0);

    assert.equal(target.mhp, hitPointsBefore);
    assert.equal(target.mcansee, 0);
    assert.equal(target.mblinded, 21);
    assert.equal(pie.where, 'gone');
    assert.deepEqual(messages, [
        'The cream pie hits the jackal.',
        'The jackal is blinded by the pie.',
    ]);
});

test('a cockatrice egg turns an intervening monster into a statue',
    async () => {
        freshRangedCombatRoom({
            heroX: 12,
            heroY: 10,
            gameplaySeed: 1n,
            recalculateVision: true,
        });
        const egg = uninitializedObject(EGG, {
            corpsenm: 10,
            known: true,
        });
        const orc = await combatant('orc', {
            inventory: [egg],
        });
        const target = await combatant('jackal', {
            x: 11,
        });
        const attack = throwMonsterWeaponAtHero(orc, game, egg, {
            random: () => 1,
            rollOne: () => 1,
        });
        const shot = attack.shots[0];
        const messages = [];
        const publish = async message => messages.push(message);

        await presentMonsterProjectileShot(
            shot, PROJECTILE_GLYPH, game, { publish },
        );
        const result = await finishMonsterProjectileHit(shot, game, {
            publish,
            finishMonsterDeath: (monster, death) =>
                finishEnvironmentalMonsterDeath(monster, game, {
                    noCorpse: death.noCorpse,
                    publish,
                }),
        });
        finishDeferredRangedProjectileHit(shot, game, () => 0);

        assert.equal(result.deathFinished, true);
        assert.equal(game.level.monsters.includes(target), false);
        assert.equal(
            floorObjectsAt(game.level, 11, 10).some(
                object => object.otyp === STATUE
                    && object.corpsenm === target.mnum,
            ),
            true,
        );
        assert.equal(egg.where, 'gone');
        assert.deepEqual(messages, [
            'Splat!  The jackal is hit with a cockatrice egg!',
            'The jackal is slowing down.',
            'The jackal turns to stone.',
        ]);
    });

test('a monster eats a lizard corpse before a cockatrice egg petrifies it',
    async () => {
        freshRangedCombatRoom({
            heroX: 12,
            heroY: 10,
            gameplaySeed: 1n,
            recalculateVision: true,
        });
        const egg = uninitializedObject(EGG, {
            corpsenm: 10,
            known: true,
        });
        const lizard = uninitializedObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf('lizard'),
        });
        const orc = await combatant('orc', {
            inventory: [egg],
        });
        const target = await combatant('jackal', {
            x: 11,
            hitPoints: 12,
            inventory: [lizard],
        });
        target.movement = 12;
        const attack = throwMonsterWeaponAtHero(orc, game, egg, {
            random: () => 1,
            rollOne: () => 1,
        });
        const shot = attack.shots[0];
        const messages = [];
        const publish = async message => messages.push(message);

        await presentMonsterProjectileShot(
            shot, PROJECTILE_GLYPH, game, { publish },
        );
        await finishMonsterProjectileHit(shot, game, {
            publish,
            rollOne: () => 1,
            finishMonsterDeath: (monster, death) =>
                finishEnvironmentalMonsterDeath(monster, game, {
                    noCorpse: death.noCorpse,
                    publish,
                }),
        });
        finishDeferredRangedProjectileHit(shot, game, () => 0);

        assert.equal(target.mhp, 12);
        assert.equal(target.inventory.includes(lizard), false);
        assert.equal(target.movement, 0);
        assert.equal(
            floorObjectsAt(game.level, 11, 10).some(
                object => object.otyp === STATUE,
            ),
            false,
        );
        assert.deepEqual(messages, [
            'Splat!  The jackal is hit with a cockatrice egg!',
            'The jackal is slowing down.',
            'The jackal eats a lizard corpse.',
            'The jackal seems limber!',
        ]);
    });

test('poison resistance stops the poison on a thrown dart', async () => {
    freshRangedCombatRoom({
        gameplaySeed: 1n,
        recalculateVision: true,
    });
    const dart = uninitializedObject(DART, { opoisoned: 1 });
    const orc = await combatant('orc', {
        tame: true,
        inventory: [dart],
    });
    const target = await combatant('green dragon', {
        x: 12,
        hitPoints: 20,
    });
    const options = { random: () => 1, rollOne: () => 1 };

    const attack = await throwMonsterWeaponAtMonster(
        orc, target, game, options,
    );
    const messages = [];
    await presentMonsterProjectileShot(
        attack.shots[0],
        PROJECTILE_GLYPH,
        game,
        { publish: async message => messages.push(message) },
    );

    assert.equal(target.mhp, 19);
    assert.deepEqual(messages, [
        'The poisoned dart hits the green dragon.',
        "The poison doesn't seem to affect the green dragon.",
    ]);
});

test('deadly poison on a thrown dart kills the monster', async () => {
    freshRangedCombatRoom({
        gameplaySeed: 1n,
        recalculateVision: true,
    });
    const dart = uninitializedObject(DART, { opoisoned: 1 });
    const orc = await combatant('orc', {
        tame: true,
        inventory: [dart],
    });
    const target = await combatant('purple worm', {
        x: 12,
        hitPoints: 20,
    });
    const options = { random: () => 0, rollOne: () => 1 };

    const attack = await throwMonsterWeaponAtMonster(
        orc, target, game, options,
    );
    const messages = [];
    await presentMonsterProjectileShot(
        attack.shots[0],
        PROJECTILE_GLYPH,
        game,
        { publish: async message => messages.push(message) },
    );

    assert.equal(target.mhp, 0);
    assert.deepEqual(messages, [
        'The poisoned dart hits the purple worm.',
        'The poison was deadly...',
        'The purple worm is killed!',
    ]);
});

test('a tame orc shoots an arrow with its bow', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const arrow = uninitializedObject(ARROW);
    const bow = uninitializedObject(BOW);
    const orc = await combatant('orc', { tame: true });
    equipMonsterObject(orc, arrow, 0);
    equipMonsterObject(orc, bow, W_WEP);
    const target = await combatant('jackal', { x: 12, hitPoints: 12 });

    const action = await takeMonsterTurn(orc, game);
    finishRangedAttacks(action.movement.rangedAttacks, game, {
        random: () => 0,
    });

    assert.deepEqual([orc.mx, orc.my], [9, 10]);
    assert.ok(target.mhp < 12);
    assert.equal(orc.mw, bow);
    assert.equal(orc.inventory.includes(arrow), false);
    assert.equal(
        floorObjectsAt(game.level, 12, 10).some(
            object => object.otyp === ARROW,
        ),
        true,
    );
});

test('a hostile monster can throw a dagger at the hero and land it',
    async () => {
        freshRangedCombatRoom({ heroX: 12, heroY: 10, gameplaySeed: 1n });
        const dagger = uninitializedObject(DAGGER);
        const orc = await combatant('orc', {
            inventory: [dagger],
        });
        const hitPointsBefore = game.u.uhp;

        const attack = throwMonsterWeaponAtHero(orc, game, dagger, {
            random: () => 1,
            rollOne: () => 1,
        });
        const shot = attack.shots[0];

        assert.equal(shot.heroTarget, true);
        assert.equal(shot.hit, true);
        assert.equal(game.u.uhp, hitPointsBefore - 1);
        assert.equal(orc.inventory.includes(dagger), false);

        finishDeferredRangedProjectileHit(shot, game);

        assert.equal(
            floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(dagger),
            true,
        );
    });

test('a cream pie blinds the hero without hurting them', async () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        hero: { uhp: 12, uhpmax: 12 },
        gameplaySeed: 1n,
    });
    const pie = uninitializedObject(CREAM_PIE);
    const orc = await combatant('orc', {
        inventory: [pie],
    });
    const attack = throwMonsterWeaponAtHero(orc, game, pie, {
        random: () => 1,
        rollOne: () => 1,
    });
    const messages = [];

    await finishHeroProjectileHit(attack.shots[0], game, {
        publish: async message => messages.push(message),
        random: () => 0,
        rollOne: () => 5,
    });

    assert.equal(game.u.uhp, 12);
    assert.equal(game.u.blindTurns, 5);
    assert.equal(game.u.ucreamed, 5);
    assert.equal(pie.where, 'gone');
    assert.deepEqual(messages, ["Yecch!  You've been creamed."]);
});

test('a cockatrice egg starts petrifying the hero', async () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        hero: { uhp: 12, uhpmax: 12 },
        gameplaySeed: 1n,
    });
    const egg = uninitializedObject(EGG, {
        corpsenm: 10,
        known: true,
    });
    const orc = await combatant('orc', {
        inventory: [egg],
    });
    const attack = throwMonsterWeaponAtHero(orc, game, egg, {
        random: () => 1,
        rollOne: () => 1,
    });

    await finishHeroProjectileHit(attack.shots[0], game, {
        random: () => 0,
    });

    assert.equal(game.u.uhp, 12);
    assert.equal(game.u.stonedTurns, 5);
    assert.equal(egg.where, 'gone');
});

test('a poisoned dart damages the hero after its ordinary hit', async () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        hero: { uhp: 12, uhpmax: 12 },
        gameplaySeed: 1n,
    });
    const dart = uninitializedObject(DART, { opoisoned: 1 });
    const orc = await combatant('orc', {
        inventory: [dart],
    });
    const attack = throwMonsterWeaponAtHero(orc, game, dart, {
        random: () => 1,
        rollOne: () => 2,
    });

    await finishHeroProjectileHit(attack.shots[0], game, {
        random: range => range === 30 ? 6 : 0,
        rollOne: () => 2,
    });

    assert.equal(game.u.uhp, 8);
});

test('impact life saving limits thrown poison to strength loss', async () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        gameplaySeed: 1n,
    });
    const amulet = addInventoryObject(AMULET_OF_LIFE_SAVING);
    wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    const originalStrength = game.u.acurr.a[A_STR];
    const dart = uninitializedObject(DART, { opoisoned: 1 });
    const orc = await combatant('orc', {
        inventory: [dart],
    });
    const attack = throwMonsterWeaponAtHero(orc, game, dart, {
        random: () => 1,
        rollOne: () => 1,
    });
    pushKeys(' '.repeat(12));

    const result = await finishHeroProjectileHit(
        attack.shots[0], game, { random: () => 0 },
    );

    assert.equal(result.lifeSaved, true);
    assert.ok(game.u.uhp > 0);
    assert.equal(game.u.acurr.a[A_STR], originalStrength - 1);
    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(floorObjectsAt(
        game.level, game.u.ux, game.u.uy,
    ).includes(dart), true);
});

test('a hostile rogue throws its full dagger volley at the hero', async () => {
    freshRangedCombatRoom({ heroX: 12, heroY: 10, gameplaySeed: 1n });
    const daggers = uninitializedObject(DAGGER, { quan: 4 });
    const rogue = await combatant('rogue', {
        inventory: [daggers],
    });
    const hitPointsBefore = game.u.uhp;
    const rolls = [2, 1, 1, 1, 1, 1, 1];
    const options = {
        random: () => 1,
        rollOne: () => rolls.shift(),
    };

    const attack = throwMonsterWeaponAtHero(
        rogue, game, daggers, options,
    );
    finishDeferredRangedProjectileHit(attack.shots[0], game, () => 0);
    while (continueMonsterWeaponVolley(attack, game, options)) {
        finishDeferredRangedProjectileHit(
            attack.shots.at(-1), game, () => 0,
        );
    }

    assert.equal(game.u.uhp, hitPointsBefore - 3);
    assert.equal(
        floorObjectQuantityAt(game.level, game.u.ux, game.u.uy, DAGGER),
        3,
    );
    assert.equal(daggers.quan, 1);
});

test('life saving lets a hostile monster finish its dagger volley', async () => {
    freshRangedCombatRoom({ heroX: 12, heroY: 10, gameplaySeed: 1n });
    const amulet = addInventoryObject(AMULET_OF_LIFE_SAVING);
    wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    const daggers = uninitializedObject(DAGGER, { quan: 4 });
    const rogue = await combatant('rogue', {
        inventory: [daggers],
    });
    const rolls = [2, 1, 1, 1, 1, 1, 1];
    const options = {
        random: () => 1,
        rollOne: () => rolls.shift(),
    };
    const attack = throwMonsterWeaponAtHero(
        rogue, game, daggers, options,
    );
    pushKeys(' '.repeat(12));

    await finishHeroProjectileHit(
        attack.shots[0], game, { random: () => 0 },
    );
    let nextShot;
    while ((nextShot = continueMonsterWeaponVolley(
        attack, game, options,
    ))) {
        await finishHeroProjectileHit(nextShot, game, { random: () => 0 });
    }

    assert.ok(game.u.uhp > 0);
    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(
        floorObjectQuantityAt(game.level, game.u.ux, game.u.uy, DAGGER),
        3,
    );
});

test('a monster life-saves before the next dagger is thrown', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const daggers = uninitializedObject(DAGGER, { quan: 4 });
    const rogue = await combatant('rogue', {
        tame: true,
        inventory: [daggers],
    });
    const amulet = uninitializedObject(AMULET_OF_LIFE_SAVING, {
        owornmask: W_AMUL,
        worn: true,
    });
    const target = await combatant('jackal', {
        x: 12,
        hitPoints: 1,
    });
    equipMonsterObject(target, amulet, W_AMUL);
    const rolls = [2, 1, 1, 1, 1, 1, 1];
    const options = {
        random: () => 0,
        rollOne: () => rolls.shift(),
    };

    const attack = await throwMonsterWeaponAtMonster(
        rogue, target, game, options,
    );

    assert.equal(target.mhp, 0);
    assert.equal(daggers.quan, 3);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 0);

    await finishEnvironmentalMonsterDeath(target, game, {
        visible: false,
        publish: async () => {},
        random: () => 0,
    });
    finishDeferredRangedProjectileHit(attack.shots[0], game, () => 0);
    let shot;
    while ((shot = continueMonsterWeaponVolley(attack, game, options))) {
        finishDeferredRangedProjectileHit(shot, game, () => 0);
    }

    assert.equal(game.level.monsters.includes(target), true);
    assert.ok(target.mhp > 0);
    assert.equal(target.inventory.includes(amulet), false);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 3);
    assert.equal(daggers.quan, 1);
});

test('a missed intervening monster does not hide the later hit', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n, recalculateVision: true });
    const dagger = uninitializedObject(DAGGER);
    const orc = await combatant('orc', {
        tame: true,
        inventory: [dagger],
    });
    const bystander = await combatant('goblin', {
        x: 11,
        hitPoints: 12,
    });
    const target = await combatant('jackal', {
        x: 13,
        hitPoints: 12,
    });
    const rolls = [20, 1, 1];

    const attack = await throwMonsterWeaponAtMonster(orc, target, game, {
        random: () => 1,
        rollOne: () => rolls.shift(),
    });
    const messages = [];
    await presentMonsterProjectileShot(
        attack.shots[0],
        PROJECTILE_GLYPH,
        game,
        { publish: async message => messages.push(message) },
    );

    assert.equal(bystander.mhp, 12);
    assert.equal(target.mhp, 11);
    assert.deepEqual(messages, [
        'The dagger misses the goblin.',
        'The dagger hits the jackal.',
    ]);
});

test('a crossbow bolt gets its source damage against a large monster',
    async () => {
        freshRangedCombatRoom({ gameplaySeed: 1n });
        const bolt = uninitializedObject(CROSSBOW_BOLT);
        const crossbow = uninitializedObject(CROSSBOW);
        const orc = await combatant('orc', { tame: true });
        equipMonsterObject(orc, bolt, 0);
        equipMonsterObject(orc, crossbow, W_WEP);
        const target = await combatant('purple worm', {
            x: 12,
            hitPoints: 100,
        });

        const options = {
            random: () => 0,
            rollOne: range => range === 20 ? 1 : range,
        };
        const attack = await throwMonsterWeaponAtMonster(
            orc, target, game, options,
        );
        finishRangedAttacks([attack], game, options);

        assert.equal(target.mhp, 93);
    });

test('an elven lord fires every arrow in a three-shot volley', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const arrows = uninitializedObject(ELVEN_ARROW, { quan: 3 });
    const bow = uninitializedObject(ELVEN_BOW);
    const archer = await combatant('elf-noble', { tame: true });
    equipMonsterObject(archer, arrows, 0);
    equipMonsterObject(archer, bow, W_WEP);
    const target = await combatant('jackal', { x: 12, hitPoints: 100 });

    const options = {
        random: () => 0,
        rollOne: range => range === 20 ? 1 : range,
    };
    const attack = await throwMonsterWeaponAtMonster(
        archer, target, game, options,
    );
    finishRangedAttacks([attack], game, options);

    assert.equal(floorObjectQuantityAt(game.level, 12, 10, ELVEN_ARROW), 3);
    assert.equal(archer.inventory.includes(arrows), false);
    assert.ok(target.mhp < 100);
});

test('a rogue player monster gets its dagger volley bonus', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const daggers = uninitializedObject(DAGGER, { quan: 4 });
    const rogue = await combatant('rogue', {
        tame: true,
        inventory: [daggers],
    });
    const target = await combatant('jackal', {
        x: 12,
        hitPoints: 100,
    });

    const options = {
        random: () => 0,
        rollOne: range => range,
    };
    const attack = await throwMonsterWeaponAtMonster(
        rogue, target, game, options,
    );
    finishRangedAttacks([attack], game, options);

    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 3);
    assert.equal(daggers.quan, 1);
});

test('a second weapon attack starts after the first dagger lands', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const daggers = uninitializedObject(DAGGER, { quan: 2 });
    const captain = await combatant('orc-captain', {
        tame: true,
        inventory: [daggers],
    });
    const target = await combatant('jackal', {
        x: 12,
        hitPoints: 100,
    });
    const options = { random: () => 0, rollOne: () => 1 };

    const turn = await beginMonsterRangedTurn(captain, target, game, options);
    const firstAttack = turn.current.attack;

    assert.equal(daggers.quan, 1);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 0);

    finishRangedAttacks([firstAttack], game, options);
    const hitPointsAfterFirstAttack = target.mhp;
    const secondAttack = (await continueMonsterRangedTurn(
        turn, game, options,
    )).attack;

    assert.ok(target.mhp < hitPointsAfterFirstAttack);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 1);

    finishRangedAttacks([secondAttack], game, options);

    assert.equal(captain.inventory.includes(daggers), false);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 2);
});
