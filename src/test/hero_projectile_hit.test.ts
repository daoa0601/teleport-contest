import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { findArmorClass } from '../js/armor.js';
import { NO_MINVENT, Upolyd } from '../js/const.js';
import { pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { throwMonsterWeaponAtHero } from '../js/monster_throw.js';
import { DAGGER, DART, ROCK } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function throwWeaponAtHero(type = DAGGER, properties = {}) {
    const soldier = await createMonsterAt('soldier', 12, 10, NO_MINVENT);
    const weapon = await addObjectToMonsterInventory(soldier,
        await knownObject(type, { spe: 5, ...properties }));
    findArmorClass();
    assert.ok(weapon);
    soldier.mux = game.u.ux;
    soldier.muy = game.u.uy;
    return { soldier, weapon };
}

void test('a horizontal rock throw tells a rock-passing hero it does no harm', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('xorn', { hitPoints: 40 });
    const { soldier, weapon } = await throwWeaponAtHero(ROCK, { spe: 0 });
    const messages: string[] = [];

    await throwMonsterWeaponAtHero(soldier, game, weapon, {
        random: () => 1, rollOne: () => 1,
        publish: async message => { messages.push(message); },
    });

    assert.equal(game.u.mh, 40);
    assert.ok(messages.includes("It doesn't harm you."));
});

void test('projectile damage waits until the hit message can be shown', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const health = game.u.uhp;
    const { soldier, weapon } = await throwWeaponAtHero();
    assert.equal(game.u.uhp, health, 'a projectile still in flight must not deal damage');
    const input = resetInputState();
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');

    const hit = throwMonsterWeaponAtHero(soldier, game, weapon);
    await input.waitUntilBlocked();
    assert.equal(game.u.uhp, health, 'dismissing the previous message has not happened yet');
    input.feed(' ');
    await hit;

    assert.ok(game.u.uhp < health);
});

void test('a thrown weapon hurts the current monster body without changing saved human health', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('minotaur', { hitPoints: 60 });
    const humanHealth = game.u.uhp;
    const { soldier, weapon } = await throwWeaponAtHero();

    await throwMonsterWeaponAtHero(soldier, game, weapon, { publish: async () => {} });

    assert.ok(game.u.mh < 60);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(Upolyd(game.u), true);
});

void test('poison on a thrown dart damages the same monster body as its point', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('minotaur', { hitPoints: 60 });
    const { soldier, weapon } = await throwWeaponAtHero(DART, { opoisoned: 1 });

    await throwMonsterWeaponAtHero(soldier, game, weapon, {
        random: range => range === 30 ? 6 : 1,
        rollOne: () => 1,
        publish: async () => {},
    });

    assert.equal(game.u.mh, 53);
    assert.equal(game.u.uhp, 40);
});

void test('a projectile that destroys the monster body returns the hero to human form', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('minotaur', { hitPoints: 1 });
    const humanHealth = game.u.uhp;
    const { soldier, weapon } = await throwWeaponAtHero();

    await throwMonsterWeaponAtHero(soldier, game, weapon, { publish: async () => {} });

    assert.equal(Upolyd(game.u), false);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(!!game.program_state.gameover, false);
});

void test('half physical damage reduces a thrown weapon hit, rounding up', async () => {
    const damage = [];
    for (const halfPhysicalDamage of [false, true] as const) {
        freshObjectRoom({ hero: { halfPhysicalDamage } });
        requireFixtureGame(game);
        const health = game.u.uhp;
        const { soldier, weapon } = await throwWeaponAtHero();

        await throwMonsterWeaponAtHero(soldier, game, weapon, { publish: async () => {} });

        damage.push(health - game.u.uhp);
    }
    const [fullDamage, reducedDamage] = damage;
    assert.ok(fullDamage !== undefined && reducedDamage !== undefined);
    assert.ok(fullDamage > 0);
    assert.equal(reducedDamage, Math.ceil(fullDamage / 2));
});

// C mthrowu.c monshoot(): singular(otmp, xname) names the monster's stack
// itself, so a seen throw reveals the darts it keeps, and a thrown one can
// merge back into that stack later.
void test('watching a monster throw one dart reveals the rest of its stack', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const { soldier, weapon } = await throwWeaponAtHero(DART, { quan: 3, dknown: false, spe: 0 });

    await throwMonsterWeaponAtHero(soldier, game, weapon, { publish: async () => {}, rollOne: () => 1 });

    const kept = soldier.minvent?.find(object => object.otyp === DART);
    assert.equal(kept?.quan, 2);
    assert.equal(kept?.dknown, true);
});

void test('a caught poisoned dart is announced by its simple name', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const { soldier, weapon } = await throwWeaponAtHero(DART, { opoisoned: 1, spe: 0 });
    const messages: string[] = [];

    await throwMonsterWeaponAtHero(soldier, game, weapon, {
        random: () => 0,
        publish: async message => { messages.push(message); },
    });

    assert.ok(messages.some(message => message.startsWith('You catch the dart!')), messages.join(' | '));
});
