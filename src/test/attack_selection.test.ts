import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAttack } from '../js/attack_selection.js';
import { M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, NO_MINVENT, W_ARM, W_ARMG, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    AD_COLD, AD_DISE, AD_DREN, AD_DRLI, AD_DRST, AD_ELEC, AD_FAMN, AD_PEST,
    AD_PHYS, AD_POLY, AD_SSEX, AD_STCK, AD_STUN,
    AT_CLAW, AT_ENGL, AT_HUGS, AT_TUCH, AT_WEAP,
} from '../js/monster_attack_types.js';
import { LEATHER_GLOVES, WHITE_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { artifactObject, corpseObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { nameToMonster } from '../js/mondata.js';

for (const [species, damage, index] of [
    ['Pestilence', AD_PEST, 1], ['Famine', AD_FAMN, 1], ['Demogorgon', AD_DISE, 3],
] satisfies [string, number, number][]) {
    void test(`${species} substitutes stun after its preceding illness or hunger attack succeeds`, async () => {
        freshObjectRoom();
        const attacker = await createMonsterAt(species, 12, 10, NO_MINVENT);
        requirePlayingGame(game);
        const missed = Array<number>(index).fill(M_ATTK_MISS);
        const hit = [...missed];
        hit[index - 1] = M_ATTK_HIT;
        const defenderDied = [...missed];
        defenderDied[index - 1] = M_ATTK_DEF_DIED;

        assert.equal(selectAttack(attacker, game.u, index, missed, game)[1], damage);
        assert.equal(selectAttack(attacker, game.u, index, hit, game)[1], AD_STUN);
        assert.equal(selectAttack(attacker, game.u, index, defenderDied, game)[1], AD_STUN);
    });
}

void test('energy drain adapts to the hero energy reserve while respecting the level-six floor', async () => {
    freshObjectRoom({ hero: { ulevel: 1, uen: 10, uenmax: 12 } });
    const vortex = await createMonsterAt('energy vortex', 12, 10, NO_MINVENT);
    requirePlayingGame(game);
    assert.deepEqual(selectAttack(vortex, game.u, 1, [], game), [AT_ENGL, AD_DREN, 1, 3]);
    game.u.uen = 40;
    game.u.uenmax = 100;
    assert.deepEqual(selectAttack(vortex, game.u, 1, [], game), [AT_ENGL, AD_DREN, 2, 6]);
    game.u.uen = 73;
    game.u.uenmax = 120;
    assert.deepEqual(selectAttack(vortex, game.u, 1, [], game), [AT_ENGL, AD_DREN, 3, 6]);
    game.u.uenmax = 121;
    assert.deepEqual(selectAttack(vortex, game.u, 1, [], game), [AT_ENGL, AD_DREN, 3, 9]);
});

void test('hero energy scaling takes precedence over an engulfing monster cooldown', async () => {
    freshObjectRoom({ hero: { ulevel: 6, uen: 40, uenmax: 100 } });
    const vortex = await createMonsterAt('energy vortex', 12, 10, NO_MINVENT);
    vortex.mspec_used = 2;
    const defender = await createMonsterAt('goblin', 13, 10, NO_MINVENT);
    requirePlayingGame(game);

    assert.deepEqual(selectAttack(vortex, game.u, 1, [], game), [AT_ENGL, AD_DREN, 2, 6]);
    assert.deepEqual(selectAttack(vortex, defender, 1, [], game), [AT_CLAW, AD_PHYS, 1, 6]);
    assert.deepEqual(selectAttack(vortex, defender, 0, [], game), [AT_TUCH, AD_ELEC, 1, 6]);
});

void test('a monster target does not cause energy scaling from the hero reserve', async () => {
    freshObjectRoom({ hero: { ulevel: 1, uen: 0, uenmax: 0 } });
    const vortex = await createMonsterAt('energy vortex', 12, 10, NO_MINVENT);
    const defender = await createMonsterAt('goblin', 13, 10, NO_MINVENT);
    requirePlayingGame(game);

    assert.deepEqual(selectAttack(vortex, defender, 1, [], game), [AT_ENGL, AD_DREN, 2, 6]);
});

void test('cooldowns replace holds and polymorph touches while preserving harmless sticky touches', async () => {
    freshObjectRoom();
    const owlbear = await createMonsterAt('owlbear', 12, 10, NO_MINVENT);
    const engineer = await createMonsterAt('genetic engineer', 13, 10, NO_MINVENT);
    const lichen = await createMonsterAt('lichen', 14, 10, NO_MINVENT);
    requirePlayingGame(game);
    assert.equal(selectAttack(owlbear, game.u, 2, [], game)[0], AT_HUGS);
    assert.equal(selectAttack(engineer, game.u, 0, [], game)[1], AD_POLY);
    assert.equal(selectAttack(lichen, game.u, 0, [], game)[1], AD_STCK);
    owlbear.mspec_used = engineer.mspec_used = lichen.mspec_used = 2;

    assert.deepEqual(selectAttack(owlbear, game.u, 2, [], game), [AT_CLAW, AD_PHYS, 1, 6]);
    assert.deepEqual(selectAttack(engineer, game.u, 0, [], game), [AT_CLAW, AD_PHYS, 1, 6]);
    assert.deepEqual(selectAttack(lichen, game.u, 0, [], game), [AT_TUCH, AD_PHYS, 0, 0]);
});

void test('cancelled special weapon attacks become physical without changing later cold touches', async () => {
    freshObjectRoom();
    const wight = await createMonsterAt('barrow wight', 12, 10, NO_MINVENT);
    requirePlayingGame(game);
    assert.equal(selectAttack(wight, game.u, 0, [], game)[1], AD_DRLI);
    wight.mcan = true;
    grantIntrinsicProperty('coldResistance', 'outside');

    assert.equal(selectAttack(wight, game.u, 0, [], game)[1], AD_PHYS);
    assert.equal(selectAttack(wight, game.u, 3, [], game)[1], AD_COLD);
});

for (const artifact of ['Stormbringer', 'Vorpal Blade']) {
    void test(`a wielded ${artifact} replaces a wight's draining weapon attack`, async () => {
        freshObjectRoom();
        const wight = await createMonsterAt('barrow wight', 12, 10, NO_MINVENT);
        await equipMonsterObject(wight, await artifactObject(artifact), W_WEP);
        requirePlayingGame(game);

        const attack = selectAttack(wight, game.u, 0, [], game);

        assert.equal(attack[0], AT_WEAP);
        assert.equal(attack[1], AD_PHYS);
    });
}

void test('a petrifying corpse weapon replaces a monster draining weapon attack', async () => {
    freshObjectRoom();
    const wight = await createMonsterAt('barrow wight', 12, 10, NO_MINVENT);
    await equipMonsterObject(wight, await knownObject(LEATHER_GLOVES), W_ARMG);
    await equipMonsterObject(wight, await corpseObject(nameToMonster('cockatrice')), W_WEP);
    requirePlayingGame(game);

    assert.equal(selectAttack(wight, game.u, 0, [], game)[1], AD_PHYS);
});

void test('a physical second weapon attack protects the first special weapon slot from substitution', async () => {
    freshObjectRoom();
    const assassin = await createMonsterAt('Master Assassin', 12, 10, NO_MINVENT);
    assassin.mcan = true;
    await equipMonsterObject(assassin, await artifactObject('Vorpal Blade'), W_WEP);
    requirePlayingGame(game);

    assert.equal(selectAttack(assassin, game.u, 0, [], game)[1], AD_DRST);
    assert.equal(selectAttack(assassin, game.u, 1, [], game)[1], AD_PHYS);
});

void test('liches replace first-slot cold touches against resistant heroes and equipped monsters', async () => {
    freshObjectRoom();
    const lich = await createMonsterAt('lich', 12, 10, NO_MINVENT);
    const archLich = await createMonsterAt('arch-lich', 13, 10, NO_MINVENT);
    const defender = await createMonsterAt('goblin', 14, 10, NO_MINVENT);
    await equipMonsterObject(defender, await knownObject(WHITE_DRAGON_SCALE_MAIL), W_ARM);
    requirePlayingGame(game);
    assert.equal(selectAttack(lich, game.u, 0, [], game)[1], AD_COLD);
    grantIntrinsicProperty('coldResistance', 'outside');

    assert.deepEqual(selectAttack(lich, game.u, 0, [], game), [AT_TUCH, AD_PHYS, 1, 6]);
    assert.deepEqual(selectAttack(archLich, defender, 0, [], game), [AT_TUCH, AD_PHYS, 3, 6]);
});

void test('a cold-resistant shade does not invite a useless physical lich touch', async () => {
    freshObjectRoom();
    const lich = await createMonsterAt('lich', 12, 10, NO_MINVENT);
    const shade = await createMonsterAt('shade', 13, 10, NO_MINVENT);
    requirePlayingGame(game);

    assert.equal(selectAttack(lich, shade, 0, [], game)[1], AD_COLD);
});

void test('home-plane elemental damage doubles only attacks which were not replaced', async () => {
    freshObjectRoom();
    const elemental = await createMonsterAt('air elemental', 12, 10, NO_MINVENT);
    requirePlayingGame(game);
    const foreign = selectAttack(elemental, game.u, 0, [], game);
    game.air_level = { ...game.u.uz, flags: { town: false }, alignment: null };

    const home = selectAttack(elemental, game.u, 0, [], game);
    assert.equal(home[2], foreign[2] * 2);
    assert.equal(home[3], foreign[3]);
    elemental.mspec_used = 1;
    assert.deepEqual(selectAttack(elemental, game.u, 0, [], game), [AT_CLAW, AD_PHYS, 1, 6]);
});

void test('hero form attacks use home-elemental bonuses and retain special weapon damage', async () => {
    freshObjectRoom();
    const defender = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    installPolymorphedHero('air elemental');
    requirePlayingGame(game);
    game.air_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    assert.deepEqual(selectAttack(game.u, defender, 0, [], game), [AT_ENGL, AD_PHYS, 2, 10]);

    installPolymorphedHero('barrow wight');
    await setPrimaryWeapon(await addInventoryItem(await artifactObject('Stormbringer')));
    assert.equal(selectAttack(game.u, defender, 0, [], game)[1], AD_DRLI);
});

void test('the enabled native seduction setting retains the amorous demon seduction bite', async () => {
    freshObjectRoom();
    const demon = await createMonsterAt('amorous demon', 12, 10, NO_MINVENT);
    requirePlayingGame(game);

    assert.equal(selectAttack(demon, game.u, 0, [], game)[1], AD_SSEX);
});
