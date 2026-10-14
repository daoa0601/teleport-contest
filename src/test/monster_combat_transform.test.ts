import test from 'node:test';
import assert from 'node:assert/strict';
import { G_GENOD, M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_HIT, NO_MINVENT,
    STRAT_WAITFORU, W_AMUL, W_ARMC } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_POLY, AD_SLIM, AD_TLPT, AT_TUCH } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_LIFE_SAVING, CLOAK_OF_PROTECTION, SCR_FIRE, WAN_FIRE } from '../js/object_data.js';
import { initRng, rn2 } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function transformFight(attackerSpecies: string, defenderSpecies = 'orc') {
    const level = freshObjectRoom({ right: 22, gameplaySeed: 1n, flags: { verbose: true } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt(attackerSpecies, 11, 10, NO_MINVENT);
    const defender = await createMonsterAt(defenderSpecies, 12, 10, NO_MINVENT);
    attacker.mhp = attacker.mhpmax = 20;
    defender.mhp = defender.mhpmax = 100;
    const messages: string[] = [];
    const options = {
        state: game, visible: true, random: rn2,
        rollDice: (count: number, sides: number) => count * sides,
        publish: (message: string) => { messages.push(message); },
    };
    installPagerInput(resetInputState(), {
        expected: /turn|resist|shudder|killed|destroyed|teleport|appears|slime|fire|unharmed|amulet|medallion|glow|reconstitut|looks much better/,
        limit: 16,
    });
    return { level, attacker, defender, options, messages };
}

void test('a teleporting hit relocates the defender and then applies its ordinary damage', async () => {
    const { attacker, defender, options } = await transformFight('quantum mechanic');
    defender.mstrategy = STRAT_WAITFORU;
    const origin = { x: defender.mx, y: defender.my };
    initRng(37n);

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_TLPT, 1, 3], options);

    assert.ok(defender.mx !== origin.x || defender.my !== origin.y);
    assert.ok(options.state.level.monsters.includes(defender));
    assert.equal(defender.mhp, 97);
    assert.equal(defender.mstrategy & STRAT_WAITFORU, 0);
});

void test('armor negation prevents relocation and retains the teleport attack physical damage', async () => {
    const { attacker, defender, options, messages } = await transformFight('quantum mechanic');
    await equipMonsterObject(defender, await knownObject(CLOAK_OF_PROTECTION), W_ARMC);

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_TLPT, 1, 3], {
        ...options, random: () => 0,
    });

    assert.equal(defender.mx, 12);
    assert.equal(defender.mhp, 97);
    assert.match(messages.join('\n'), /avoids harm\.[\s\S]*is not affected\./);
});

void test('a restricted teleporting hit still harms its defender', async () => {
    const { level, attacker, defender, options, messages } = await transformFight('quantum mechanic');
    level.flags.noteleport = true;

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_TLPT, 1, 3], options);

    assert.equal(defender.mx, 12);
    assert.equal(defender.mhp, 97);
    assert.match(messages.join('\n'), /mysterious force prevents the orc/);
});

void test('antimagic completes a polymorph attack without subtracting its ordinary damage', async () => {
    const { attacker, defender, options, messages } = await transformFight('genetic engineer', 'baby gray dragon');
    const species = defender.mnum;

    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_POLY, 1, 3], options);

    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(defender.mhp, 100);
    assert.equal(defender.mnum, species);
    assert.equal(attacker.mspec_used ?? 0, 0);
    assert.match(messages.join('\n'), /resists!/);
});

void test('a polymorph cooldown leaves an ordinary damaging hit', async () => {
    const { attacker, defender, options } = await transformFight('genetic engineer');
    attacker.mspec_used = 2;
    const species = defender.mnum;

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_POLY, 1, 3], options);

    assert.equal(defender.mnum, species);
    assert.equal(defender.mhp, 97);
    assert.equal(attacker.mspec_used, 2);
});

void test('a successful polymorph changes the defender and starts the attacker cooldown', async () => {
    const { level, attacker, defender, options, messages } = await transformFight('genetic engineer');
    level.flags.noteleport = true;
    const species = defender.mnum;
    initRng(1n);

    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_POLY, 1, 3], options);

    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.notEqual(defender.mnum, species);
    assert.ok((attacker.mspec_used ?? 0) >= 1 && (attacker.mspec_used ?? 0) <= 2);
    assert.ok(defender.mhp > 0);
    assert.match(messages.join('\n'), /turns into/);
    assert.equal(game.u.uconduct?.killer ?? 0, 0);
});

for (const lifesaved of [false, true]) {
    void test(`polymorph system shock ${lifesaved ? 'respects life saving' : 'kills its defender'} without growing the attacker`, async () => {
        const { attacker, defender, options } = await transformFight('genetic engineer');
        defender.mcan = true;
        defender.mhp = 40;
        const amulet = lifesaved
            ? await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL) : null;
        const level = attacker.m_lev;
        const maximum = attacker.mhpmax;

        const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_POLY, 1, 3], {
            ...options, random: bound => bound === 25 ? 0 : rn2(bound),
        });

        assert.equal(!!(result.nativeResult & M_ATTK_DEF_DIED), !lifesaved);
        assert.equal(!!defender.dead, !lifesaved);
        assert.equal(attacker.m_lev, level);
        assert.equal(attacker.mhpmax, maximum);
        assert.equal(requireMonsterVital(defender.mnum).died, lifesaved ? 0 : 1);
        assert.equal(game.u.uconduct?.killer ?? 0, 0);
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.ok(defender.mhp > 0);
        }
    });
}

function forceSliming(bound: number): number {
    return bound === 4 ? 0 : rn2(bound);
}

void test('an uncured monster becomes green slime without taking the pending physical damage', async () => {
    const { attacker, defender, options } = await transformFight('green slime');
    defender.mstrategy = STRAT_WAITFORU;

    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SLIM, 1, 6], {
        ...options, random: forceSliming,
    });

    assert.equal(defender.mnum, MONSTER_NAME.indexOf('green slime'));
    assert.ok(defender.mhp > 0);
    assert.equal(defender.mhp, defender.mhpmax);
    assert.equal(defender.mstrategy & STRAT_WAITFORU, 0);
    assert.ok(result.nativeResult & M_ATTK_HIT);
});

void test('a slime attack cannot turn its victim into a genocided species', async () => {
    const { attacker, defender, options } = await transformFight('green slime');
    const species = defender.mnum;
    requireMonsterVital(attacker.mnum).mvflags |= G_GENOD;

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SLIM, 1, 6], {
        ...options, random: forceSliming,
    });

    assert.equal(defender.mnum, species);
    assert.equal(defender.mhp, 100);
    assert.equal(!!defender.dead, false);
});

void test('a defender burns slime away with its actual wand and spends its next move', async () => {
    const { attacker, defender, options } = await transformFight('green slime');
    const wand = await knownObject(WAN_FIRE, { spe: 3 });
    await addObjectToMonsterInventory(defender, wand);
    defender.movement = 24;
    const species = defender.mnum;

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SLIM, 1, 6], {
        ...options, random: forceSliming,
    });

    assert.equal(defender.mnum, species);
    assert.equal(defender.mhp, 88);
    assert.equal(wand.spe, 2);
    assert.equal(defender.movement, 12);
    assert.equal(defender.mlstmv, options.state.moves);
});

void test('a fire-scroll slime cure can kill both combatants without awarding hero credit', async () => {
    const { attacker, defender, options } = await transformFight('green slime');
    const scroll = await knownObject(SCR_FIRE);
    await addObjectToMonsterInventory(defender, scroll);
    attacker.mhp = defender.mhp = 1;

    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SLIM, 1, 6], {
        ...options, random: forceSliming,
    });

    assert.ok(result.nativeResult & M_ATTK_AGR_DIED);
    assert.ok(result.nativeResult & M_ATTK_DEF_DIED);
    assert.equal(attacker.dead, true);
    assert.equal(defender.dead, true);
    assert.equal(scroll.where, 'gone');
    assert.equal(requireMonsterVital(attacker.mnum).died, 1);
    assert.equal(requireMonsterVital(defender.mnum).died, 1);
    assert.equal(game.u.uconduct?.killer ?? 0, 0);
});
