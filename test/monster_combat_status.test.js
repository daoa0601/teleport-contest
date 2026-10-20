import assert from 'node:assert/strict';
import test from 'node:test';
import { MFAST, MM_NOGRP, MM_NOWAIT, MSLOW, NO_MINVENT, STRAT_WAITFORU, W_ARM, W_ARMC, W_ARMF, W_ARMH, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_BLND, AD_CONF, AD_ENCH, AD_HALU, AD_HEAL, AD_LEGS, AD_PLYS, AD_SLEE, AD_SLOW, AD_STCK, AD_STUN, AD_WERE, AD_WRAP, AT_BITE, AT_CLAW, AT_GAZE, AT_HUGS, AT_KICK, AT_STNG, AT_TUCH, } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { applyMonsterCombatBlindness } from '../js/monster_combat_status.js';
import { CLOAK_OF_PROTECTION, LEATHER_ARMOR, OBJECT_NAMES, SPEED_BOOTS } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
async function statusFight(source = 'goblin', target = 'orc') {
    freshObjectRoom({ heroX: 8, context: { mon_moving: true }, gameplaySeed: 81n });
    requirePlayingGame(game);
    const attacker = await createMonsterAt(source, 11, 10, BIRTH_FLAGS);
    const defender = await createMonsterAt(target, 12, 10, BIRTH_FLAGS);
    attacker.msleeping = defender.msleeping = 0;
    defender.mhp = defender.mhpmax = 100;
    defender.mcanmove = defender.mcansee = 1;
    defender.mstrategy = STRAT_WAITFORU;
    const messages = [];
    const options = {
        state: game, visible: true,
        publish: async (message) => { messages.push(message); },
        random: () => 0,
        rollOne: (sides) => sides,
        rollDice: (count, sides) => count * sides,
    };
    return { attacker, defender, messages, options };
}
void test('paralysis freezes the defender, ends its meal, and retains ordinary damage', async () => {
    const { attacker, defender, messages, options } = await statusFight('ghoul');
    defender.meating = 4;
    await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_PLYS, 1, 4], options);
    assert.equal(defender.mcanmove, 0);
    assert.equal(defender.mfrozen, 10);
    assert.equal(defender.meating, 0);
    assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, 0);
    assert.equal(defender.mhp, 96);
    assert.match(messages.join('\n'), /The orc is frozen by the ghoul/);
});
void test('magic cancellation prevents paralysis but does not remove the contact damage', async () => {
    const { attacker, defender, messages, options } = await statusFight('ghoul');
    await equipMonsterObject(defender, await knownObject(CLOAK_OF_PROTECTION), W_ARMC);
    await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_PLYS, 1, 4], options);
    assert.equal(defender.mcanmove, 1);
    assert.equal(defender.mhp, 96);
    assert.match(messages.join('\n'), /The orc avoids harm/);
});
void test('a paralysis contact does not replace an existing frozen duration', async () => {
    const { attacker, defender, options } = await statusFight('ghoul');
    defender.mcanmove = 0;
    defender.mfrozen = 20;
    await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_PLYS, 1, 4], options);
    assert.equal(defender.mfrozen, 20);
    assert.equal(defender.mhp, 96);
});
void test('native monster sleep immobilizes a holder without running its later grip-release branch', async () => {
    const { attacker, defender, messages, options } = await statusFight('homunculus', 'python');
    attacker.mcan = 1;
    defender.meating = 3;
    game.u.ustuck = defender;
    await resolveMonsterCombatDamage(attacker, defender, [AT_BITE, AD_SLEE, 1, 4], options);
    assert.equal(defender.mcanmove, 0);
    assert.equal(defender.mfrozen, 10);
    assert.equal(defender.meating, 0);
    assert.equal(defender.mhp, 96);
    assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, STRAT_WAITFORU);
    assert.equal(game.u.ustuck, defender);
    assert.doesNotMatch(messages.join('\n'), /put to sleep|grip relaxes/);
});
void test('sleep resistance blocks immobilization while the bite still hurts', async () => {
    const { attacker, defender, options } = await statusFight('homunculus', 'orange dragon');
    await resolveMonsterCombatDamage(attacker, defender, [AT_BITE, AD_SLEE, 1, 4], options);
    assert.equal(defender.mcanmove, 1);
    assert.equal(defender.mfrozen ?? 0, 0);
    assert.equal(defender.mhp, 96);
});
void test('a slowing contact reduces speed and clears waiting without removing damage', async () => {
    const { attacker, defender, options, messages } = await statusFight();
    defender.permspeed = defender.mspeed = MFAST;
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SLOW, 1, 4], options);
    assert.equal(defender.mspeed, 0);
    assert.equal(defender.mhp, 96);
    assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, 0);
    assert.match(messages.join('\n'), /seems to be moving slower\.[\s\S]*slows down/, 'mon_adjust_speed() announces the change before mhitm_ad_slow()');
});
for (const defense of ['dragon body', 'dragon armor', 'speed boots']) {
    void test(`${defense} retains visible speed through a slowing contact`, async () => {
        const { attacker, defender, options, messages } = await statusFight('goblin', defense === 'dragon body' ? 'blue dragon' : 'orc');
        if (defense === 'dragon armor') {
            await equipMonsterObject(defender, await knownObject(OBJECT_NAMES.indexOf('blue dragon scales')), W_ARM);
        }
        else if (defense === 'speed boots') {
            await equipMonsterObject(defender, await knownObject(SPEED_BOOTS), W_ARMF);
        }
        const oldSpeed = defender.mspeed;
        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SLOW, 1, 4], {
            ...options, random: range => range - 1,
        });
        assert.equal(defender.mspeed, oldSpeed);
        assert.equal(defender.mhp, 96);
        assert.doesNotMatch(messages.join('\n'), /slows down/);
        if (defense === 'speed boots') {
            assert.equal(defender.permspeed, MSLOW);
            assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, 0);
        }
        else
            assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, STRAT_WAITFORU);
    });
}
void test('confusion retains physical damage and does not start a caster cooldown', async () => {
    const { attacker, defender, options } = await statusFight('umber hulk');
    await resolveMonsterCombatDamage(attacker, defender, [AT_GAZE, AD_CONF, 1, 4], options);
    assert.equal(defender.mconf, 1);
    assert.equal(defender.mhp, 96);
    assert.equal(attacker.mspec_used ?? 0, 0);
    assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, 0);
});
for (const blockedBy of ['cancellation', 'cooldown', 'existing confusion']) {
    void test(`${blockedBy} prevents new confusion feedback while contact damage remains`, async () => {
        const { attacker, defender, options, messages } = await statusFight('umber hulk');
        if (blockedBy === 'cancellation')
            attacker.mcan = 1;
        else if (blockedBy === 'cooldown')
            attacker.mspec_used = 5;
        else
            defender.mconf = 1;
        await resolveMonsterCombatDamage(attacker, defender, [AT_GAZE, AD_CONF, 1, 4], options);
        assert.equal(!!defender.mconf, blockedBy === 'existing confusion');
        assert.equal(defender.mhp, 96);
        assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, STRAT_WAITFORU);
        assert.doesNotMatch(messages.join('\n'), /confused/);
    });
}
void test('hallucinatory light confuses a seeing defender again without HP damage', async () => {
    const { attacker, defender, options, messages } = await statusFight('black light');
    defender.mconf = 1;
    await resolveMonsterCombatDamage(attacker, defender, [AT_GAZE, AD_HALU, 1, 4], options);
    assert.equal(defender.mhp, 100);
    assert.equal(defender.mconf, 1);
    assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, 0);
    assert.match(messages.join('\n'), /looks more confused/);
});
for (const protectedBy of ['blindness', 'no eyes', 'cancellation']) {
    void test(`${protectedBy} prevents hallucinatory confusion without making it a damaging attack`, async () => {
        const { attacker, defender, options } = await statusFight('black light', protectedBy === 'no eyes' ? 'gray ooze' : 'orc');
        if (protectedBy === 'blindness')
            defender.mcansee = 0;
        if (protectedBy === 'cancellation')
            attacker.mcan = 1;
        await resolveMonsterCombatDamage(attacker, defender, [AT_GAZE, AD_HALU, 1, 4], options);
        assert.equal(defender.mhp, 100);
        assert.equal(!!defender.mconf, false);
    });
}
for (const cancelled of [false, true]) {
    void test(`a ${cancelled ? 'cancelled' : 'normal'} stunning kick follows its native physical-delegation rule`, async () => {
        const { attacker, defender, options } = await statusFight('abbot', 'mastodon');
        attacker.mcan = cancelled;
        await resolveMonsterCombatDamage(attacker, defender, [AT_KICK, AD_STUN, 1, 4], options);
        assert.equal(!!defender.mstun, !cancelled);
        assert.equal(defender.mhp, cancelled ? 96 : 100, 'An uncancelled stun delegates to thick-skin kick immunity; cancellation retains the rolled damage.');
    });
}
for (const [source, method, damageType] of [
    ['werewolf', AT_BITE, AD_WERE], ['nurse', AT_TUCH, AD_HEAL], ['xan', AT_STNG, AD_LEGS],
]) {
    void test(`${source} contact delegates physical shade immunity`, async () => {
        const { attacker, defender, options } = await statusFight(source, 'shade');
        await resolveMonsterCombatDamage(attacker, defender, [method, damageType, 1, 4], options);
        assert.equal(defender.mhp, 100);
    });
}
void test('a cancelled leg attack has no damage or wounded-leg state', async () => {
    const { attacker, defender, options } = await statusFight('xan');
    attacker.mcan = 1;
    await resolveMonsterCombatDamage(attacker, defender, [AT_STNG, AD_LEGS, 1, 4], options);
    assert.equal(defender.mhp, 100);
    assert.equal(defender.mcanmove, 1);
});
void test('magic cancellation removes all sticky contact damage', async () => {
    const { attacker, defender, options } = await statusFight('large mimic');
    await equipMonsterObject(defender, await knownObject(CLOAK_OF_PROTECTION), W_ARMC);
    await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_STCK, 1, 4], options);
    assert.equal(defender.mhp, 100);
    assert.ok(!game.u.ustuck);
});
for (const [kind, source, method, damageType] of [
    ['sticky', 'large mimic', AT_CLAW, AD_STCK], ['wrapping', 'python', AT_HUGS, AD_WRAP],
]) {
    void test(`an uncancelled ${kind} contact damages another monster without binding the hero`, async () => {
        const { attacker, defender, options } = await statusFight(source);
        await resolveMonsterCombatDamage(attacker, defender, [method, damageType, 1, 4], options);
        assert.equal(defender.mhp, 96);
        assert.ok(!game.u.ustuck);
    });
}
void test('cancelled wrapping brushes visibly even when the general fight-visible flag is false', async () => {
    const { attacker, defender, options, messages } = await statusFight('python');
    attacker.mcan = 1;
    await resolveMonsterCombatDamage(attacker, defender, [AT_HUGS, AD_WRAP, 1, 4], { ...options, visible: false });
    assert.equal(defender.mhp, 100);
    assert.match(messages.join('\n'), /brushes against the orc/);
    assert.ok(!game.u.ustuck);
});
void test('monster disenchantment contact damages the body without selecting its armor', async () => {
    const { attacker, defender, options } = await statusFight('disenchanter');
    const armor = await equipMonsterObject(defender, await knownObject(LEATHER_ARMOR, { spe: 3 }), W_ARM);
    await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_ENCH, 1, 4], options);
    assert.equal(defender.mhp, 96);
    assert.equal(armor.spe, 3);
});
void test('physical blinding extends temporary blindness to its cap even from a cancelled raven', async () => {
    const { attacker, defender, options, messages } = await statusFight('raven');
    attacker.mcan = 1;
    defender.mcansee = 0;
    defender.mblinded = 125;
    await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_BLND, 1, 4], options);
    assert.equal(defender.mblinded, 127);
    assert.equal(defender.mhp, 100);
    assert.equal((defender.mstrategy ?? 0) & STRAT_WAITFORU, 0);
    assert.equal(messages.length, 0);
});
void test('an Archon blindness prepass does not blind an already blinded target again', async () => {
    const { attacker, defender, options } = await statusFight('Archon');
    await applyMonsterCombatBlindness(attacker, defender, [AT_GAZE, AD_BLND, 1, 4], options);
    assert.equal(defender.mblinded, 4);
    await applyMonsterCombatBlindness(attacker, defender, [AT_GAZE, AD_BLND, 1, 4], options);
    assert.equal(defender.mblinded, 4);
    assert.equal(defender.mhp, 100);
});
for (const protectedBy of ['raven kinship', 'visored helmet', 'permanent blindness', 'no eyes']) {
    void test(`${protectedBy} blocks a blinding claw`, async () => {
        const { attacker, defender, options } = await statusFight('raven', protectedBy === 'raven kinship' ? 'raven' : protectedBy === 'no eyes' ? 'gray ooze' : 'orc');
        if (protectedBy === 'permanent blindness') {
            defender.mcansee = 0;
            defender.mblinded = 0;
        }
        else if (protectedBy === 'visored helmet') {
            const helmetType = options.state.objectDescriptions?.findIndex(description => description === 'visored helmet');
            assert.ok(helmetType !== undefined && helmetType >= 0);
            await equipMonsterObject(defender, await knownObject(helmetType), W_ARMH);
        }
        await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_BLND, 1, 4], options);
        assert.equal(defender.mblinded ?? 0, 0);
        assert.equal(defender.mhp, 100);
    });
}
void test('physical blindness of a visible Archon retains the pinned radiance message', async () => {
    const { attacker, defender, options, messages } = await statusFight('raven', 'Archon');
    await applyMonsterCombatBlindness(attacker, defender, [AT_CLAW, AD_BLND, 1, 4], options);
    assert.equal(defender.mblinded, 4);
    assert.match(messages.join('\n'), /Archon is blinded by the raven's radiance/);
});
//# sourceMappingURL=monster_combat_status.test.js.map