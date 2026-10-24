import test from 'node:test';
import assert from 'node:assert/strict';
import { A_DEX, MM_NOGRP, NO_MINVENT, STRAT_WAITFORU, W_AMUL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { attackHostileMonster } from '../js/hero_melee.js';
import { resolveHeroWeaponHit } from '../js/hero_weapon_hit.js';
import { resetInputState } from '../js/input.js';
import { AD_PHYS, AT_WEAP } from '../js/monster_attack_types.js';
import { AMULET_OF_LIFE_SAVING, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
import type { AttackTuple } from '../js/monster_action_types.js';

const weaponAttack: AttackTuple = [AT_WEAP, AD_PHYS, 1, 6];

async function weaponFight(species = 'hill giant') {
    freshObjectRoom({ role: 'tourist', flags: { verbose: true }, gameplaySeed: 1n });
    requirePlayingGame(game);
    game.u.uhitinc = 100;
    const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    monster.mpeaceful = false;
    installPagerInput(resetInputState(), {
        expected: /You |Your |Somehow|giant|medallion|But wait|looks much better|amulet|crumbles|floating eye|beheaded|Welcome/,
        limit: 30,
    });
    return { monster, state: game };
}

void test('a weapon hit deals damage without charging a second action or invoking a passive response', async () => {
    const { monster, state } = await weaponFight('brown mold');
    const weapon = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(weapon);
    const hunger = state.u.uhunger;
    const health = state.u.uhp;
    const dexterityExercise = state.u._exercise?.[A_DEX] ?? 0;

    const result = await resolveHeroWeaponHit(monster, 11, 10, weapon, {
        attack: weaponAttack, hit: true, threshold: 100, armorPenalty: 0, dieRoll: 10, twoHits: 0,
    });

    assert.ok(monster.mhp < 100);
    assert.equal(state.u.uhp, health);
    assert.equal(state.u.uhunger, hunger);
    assert.equal(state.u._exercise?.[A_DEX] ?? 0, dexterityExercise);
    assert.equal(state.u.uconduct.weaphit, 1);
    assert.equal(result.hit, true);
    assert.equal(result.survived, true);
});

void test('a missed weapon attack leaves a sleeping defender asleep and preserves weapon conduct', async () => {
    const { monster, state } = await weaponFight();
    const weapon = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(weapon);
    monster.msleeping = 1;

    const result = await resolveHeroWeaponHit(monster, 11, 10, weapon, {
        attack: weaponAttack, hit: false, threshold: -100, armorPenalty: 0, dieRoll: 10, twoHits: 0,
    });

    assert.equal(monster.mhp, 100);
    assert.equal(monster.msleeping, 1);
    assert.equal(state.u.uconduct.weaphit ?? 0, 0);
    assert.equal(result.hit, false);
});

void test('Vorpal Blade missing a headless target restores weapon conduct and reports no contact', async () => {
    const { monster, state } = await weaponFight('acid blob');
    const weapon = await addInventoryItem(await artifactObject('Vorpal Blade'));
    await setPrimaryWeapon(weapon);
    state.u.uconduct.weaphit = 4;

    const result = await resolveHeroWeaponHit(monster, 11, 10, weapon, {
        attack: weaponAttack, hit: true, threshold: 100, armorPenalty: 0, dieRoll: 1, twoHits: 0,
    });

    assert.equal(monster.mhp, 100);
    assert.equal(state.u.uconduct.weaphit, 4);
    assert.equal(result.hit, false);
    assert.equal(result.survived, true);
});

void test('a life-saved defender remains on the level while its lethal strike ends the attack sequence', async () => {
    const { monster, state } = await weaponFight('floating eye');
    const weapon = await addInventoryObject(DAGGER, { spe: 10 });
    await setPrimaryWeapon(weapon);
    const amulet = await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    monster.mhp = 1;

    const result = await resolveHeroWeaponHit(monster, 11, 10, weapon, {
        attack: weaponAttack, hit: true, threshold: 100, armorPenalty: 0, dieRoll: 10, twoHits: 0,
    });

    assert.equal(result.hit, true);
    assert.equal(result.survived, false);
    assert.equal(result.heroDied, false);
    assert.ok(monster.mhp > 0);
    assert.ok(state.level.monsters.includes(monster));
    assert.equal(amulet.where, 'gone');
});

void test('a hero with no active attacks spends no combat nutrition and releases a waiting target', async () => {
    const { monster, state } = await weaponFight();
    installPolymorphedHero('acid blob');
    monster.mstrategy = STRAT_WAITFORU;
    const hunger = state.u.uhunger;

    const acted = await attackHostileMonster(monster, 11, 10);

    assert.equal(acted, true);
    assert.equal(monster.mhp, 100);
    assert.equal(state.u.uhunger, hunger);
    assert.equal(monster.mstrategy & STRAT_WAITFORU, 0);
    assert.match(state._pending_message ?? '', /no way to attack monsters physically/);
});

void test('an eye saved from a lethal ordinary hit does not make its living passive gaze', async () => {
    const { monster, state } = await weaponFight('floating eye');
    await setPrimaryWeapon(await addInventoryObject(DAGGER, { spe: 10 }));
    const amulet = await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    monster.mhp = 1;

    await attackHostileMonster(monster, 11, 10);

    assert.ok(monster.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(state._helplessTurns ?? 0, 0);
    assert.equal(state.multi ?? 0, 0);
});

void test('Cleaver hits both adjacent targets and reverses the swing on its next attack', async () => {
    const { monster, state } = await weaponFight();
    const north = await createMonsterAt('frost giant', 11, 9, MM_NOGRP | NO_MINVENT);
    const south = await createMonsterAt('stone giant', 11, 11, MM_NOGRP | NO_MINVENT);
    north.mhp = north.mhpmax = south.mhp = south.mhpmax = 100;
    const cleaver = await addInventoryItem(await artifactObject('Cleaver'));
    await setPrimaryWeapon(cleaver);
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /You hit the (stone|hill|frost) giant/, limit: 8 });
    const pager = input.display;
    assert.ok(pager, 'The swing sequence needs a real message pager.');
    input.display = {
        async readKey(): Promise<number> {
            messages.push(state._pending_message);
            return pager.readKey();
        },
    };
    initRng(71n);

    await attackHostileMonster(monster, 11, 10);
    await attackHostileMonster(monster, 11, 10);

    assert.ok(monster.mhp < 100 && north.mhp < 100 && south.mhp < 100);
    const prose = [...messages, state._pending_message].join('\n');
    assert.match(prose, /frost giant[\s\S]*hill giant[\s\S]*stone giant[\s\S]*stone giant[\s\S]*hill giant[\s\S]*frost giant/);
    assert.equal(state.u.uconduct.weaphit, 6);
});

void test('a Cleaver wielder can save after attacking and continue fighting after restore', async () => {
    const { monster, state } = await weaponFight();
    const cleaver = await addInventoryItem(await artifactObject('Cleaver'));
    await setPrimaryWeapon(cleaver);
    state.plname = 'CleaverSaver';
    const storage = memoryStorage();

    await attackHostileMonster(monster, 11, 10);
    const savedHealth = monster.mhp;
    assert.ok(savedHealth < 100, 'The first Cleaver attack must damage the target.');

    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('CleaverSaver', storage), true);
    requirePlayingGame(game);
    const restoredMonster = game.level.monsters.find(candidate => candidate.m_id === monster.m_id);
    assert.ok(restoredMonster, 'The saved combat target must be restored.');
    assert.equal(restoredMonster.mhp, savedHealth);
    assert.equal(game.uwep?.oartifact, cleaver.oartifact);

    await attackHostileMonster(restoredMonster, 11, 10);

    assert.ok(restoredMonster.mhp < savedHealth, 'The restored hero must be able to attack again.');
});

void test('a newly cursed offhand weapon drops before the next attack and cannot strike', async () => {
    const { monster, state } = await weaponFight();
    await setPrimaryWeapon(await addInventoryObject(DAGGER));
    const secondary = await addInventoryObject(DAGGER, { spe: 1 });
    await setSecondaryWeapon(secondary);
    setTwoWeaponCombat(true);
    secondary.cursed = true;

    await attackHostileMonster(monster, 11, 10);

    assert.equal(state.u.twoweap, false);
    assert.equal(secondary.where, 'floor');
    assert.equal(state.uswapwep, null);
    assert.equal(state.u.uconduct.weaphit, 1);
    assert.ok(monster.mhp < 100);
});
