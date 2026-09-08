import test from 'node:test';
import assert from 'node:assert/strict';

import { findArmorClass } from '../js/armor.js';
import { NO_MINVENT, Upolyd } from '../js/const.js';
import { pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { hitHeroWithMonsterProjectile, throwMonsterWeaponAtHero } from '../js/monster_throw.js';
import { DAGGER } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function throwDaggerAtHero() {
    const soldier = await createMonsterAt('soldier', 12, 10, NO_MINVENT);
    const dagger = addObjectToMonsterInventory(soldier, knownObject(DAGGER, { spe: 5 }));
    findArmorClass();
    return throwMonsterWeaponAtHero(soldier, game, dagger).shots[0];
}

test('projectile damage waits until the hit message can be shown', async () => {
    freshObjectRoom();
    const health = game.u.uhp;
    const shot = await throwDaggerAtHero();
    assert.equal(game.u.uhp, health, 'a projectile still in flight must not deal damage');
    const input = resetInputState();
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');

    const hit = hitHeroWithMonsterProjectile(shot, game);
    await input.waitUntilBlocked();
    assert.equal(game.u.uhp, health, 'dismissing the previous message has not happened yet');
    input.feed(' ');
    await hit;

    assert.ok(game.u.uhp < health);
});

test('a thrown weapon hurts the current monster body without changing saved human health', async () => {
    freshObjectRoom();
    installPolymorphedHero('minotaur', { hitPoints: 60 });
    const humanHealth = game.u.uhp;
    const shot = await throwDaggerAtHero();

    await hitHeroWithMonsterProjectile(shot, game, { publish: async () => {} });

    assert.ok(game.u.mh < 60);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(Upolyd(game.u), true);
});

test('a projectile that destroys the monster body returns the hero to human form', async () => {
    freshObjectRoom();
    installPolymorphedHero('minotaur', { hitPoints: 1 });
    const humanHealth = game.u.uhp;
    const shot = await throwDaggerAtHero();

    await hitHeroWithMonsterProjectile(shot, game, { publish: async () => {} });

    assert.equal(Upolyd(game.u), false);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(!!game.program_state.gameover, false);
});

test('half physical damage reduces a thrown weapon hit, rounding up', async () => {
    const damage = [];
    for (const halfPhysicalDamage of [false, true]) {
        freshObjectRoom({ hero: { halfPhysicalDamage } });
        const health = game.u.uhp;
        const shot = await throwDaggerAtHero();

        await hitHeroWithMonsterProjectile(shot, game, { publish: async () => {} });

        damage.push(health - game.u.uhp);
    }
    assert.ok(damage[0] > 0);
    assert.equal(damage[1], Math.ceil(damage[0] / 2));
});
