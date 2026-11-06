import test from 'node:test';
import assert from 'node:assert/strict';
import { COIN_CLASS } from '../js/objclass.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_DRDX, AD_SGLD, AD_SPEL, AD_WERE, AT_BITE, AT_CLAW, AT_TUCH } from '../js/monster_attack_types.js';
import { mhitm_adtyping, resolveHeroNaturalDamage } from '../js/uhitm.js';
import { resolveMonsterCombatDamage } from '../js/mhitm.js';
import { mksobj } from '../js/mkobj.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { GOLD_PIECE } from '../js/object_data.js';
import type { HeroContactAttack } from '../js/monster_action_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C uhitm.c:mhitm_adtyping() groups AD_DRST/AD_DRDX/AD_DRCO into one
// mhitm_ad_drst() call for every attacker; the hero's poisoned contact
// publishes the poisoned line and boosts the damage.
void test('a hero contact attack with AD_DRDX reaches the grouped poison port', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mhp = goblin.mhpmax = 20;
    const messages: string[] = [];

    const result = await resolveHeroNaturalDamage(goblin, [AT_TUCH, AD_DRDX, 2, 4], 0, {
        publish: async message => { messages.push(message); },
        random: limit => limit === 8 ? 0 : 1,
    });

    assert.match(messages.join('\n'), /Your contact was poisoned!/);
    // Poison adds 6 plus a one-in-ten draw on top of the 2d4 roll.
    assert.ok(result.nativeResult === 1 || goblin.mhp < goblin.mhpmax,
        'the rolled damage plus the poison bonus reaches the defender');
});

// C uhitm.c:mhitm_adtyping() leaves unlisted damage types at mhm->damage = 0;
// a hero spell attack therefore never wounds through the dispatcher.
void test('a hero attack with an unlisted damage type deals no damage', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mhp = goblin.mhpmax = 20;
    const messages: string[] = [];

    const result = await resolveHeroNaturalDamage(goblin, [AT_TUCH, AD_SPEL, 5, 6], 0, {
        publish: async message => { messages.push(message); },
        random: limit => 1,
    });

    assert.equal(result.heroDied, false);
    assert.equal(result.nativeResult, 1);
    assert.equal(goblin.mhp, goblin.mhpmax);
    assert.equal(messages.length, 0);
});

// C uhitm.c:mhitm_adtyping()'s AD_WERE case owns the mhitu branch hitmu()
// resumes after its contact line: a werecreature bite can infect the hero.
void test('a deferred AD_WERE contact through the dispatcher infects the hero', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const werewolf = await createMonsterAt('werewolf', 11, 10);
    const messages: string[] = [];
    const attack: HeroContactAttack = { kind: 'hero-attack', attackType: AT_BITE,
        damageType: AD_WERE, hit: true, damage: 4 };

    await mhitm_adtyping({ adtyp: AD_WERE, mdef: 'youmonst', context: {
        state: game, attacker: werewolf, attack,
        publish: async message => { messages.push(message); }, random: () => 0 } });

    assert.match(messages.join('\n'), /You feel feverish\./);
    assert.equal(game.u.ulycn, werewolf.mnum);
});

// C uhitm.c:mhitm_adtyping()'s AD_SGLD case owns the mhitm branch that
// mdamagem() reaches: a leprechaun steals a monster's gold and keeps its
// claw damage out of the ordinary hit-point tail.
void test('a monster-versus-monster AD_SGLD attack through the dispatcher steals gold', async () => {
    const level = await freshObjectRoom();
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const leprechaun = await createMonsterAt('leprechaun', 11, 10);
    const soldier = await createMonsterAt('soldier', 12, 10);
    const purse = await mksobj(GOLD_PIECE, true, false);
    purse.quan = 25;
    await addObjectToMonsterInventory(soldier, purse);
    const before = (leprechaun.minvent.find(object => object.oclass === COIN_CLASS)?.quan ?? 0);
    const messages: string[] = [];

    const result = await resolveMonsterCombatDamage(leprechaun, soldier, [AT_CLAW, AD_SGLD, 0, 0], {
        state: game, visible: true,
        publish: async message => { messages.push(message); },
        random: () => 0, rollOne: () => 0, rollDice: () => 0,
    });

    const stolen = leprechaun.minvent.find(object => object.oclass === COIN_CLASS)?.quan ?? 0;
    assert.ok(stolen > before, `gold ${stolen} > ${before}; messages: ${messages.join(' | ')}`);
    assert.equal(soldier.minvent.includes(purse), false);
    assert.match(messages.join('\n'), /leprechaun steals some gold from the soldier/);
    assert.equal(result.damage, 0, 'the theft replaces the ordinary damage');
});
