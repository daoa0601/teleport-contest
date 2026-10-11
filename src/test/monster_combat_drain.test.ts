import test from 'node:test';
import assert from 'node:assert/strict';

import {
    M_ATTK_DEF_DIED, M_ATTK_MISS, MM_ANGRY, MM_NOGRP, MM_NOMSG,
    MM_NOWAIT, NO_MINVENT, STRAT_WAITFORU, W_AMUL, W_ARM, W_ARMC, W_WEP,
} from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import {
    AD_CURS, AD_DETH, AD_DISE, AD_DREN, AD_DRIN, AD_DRLI, AD_FAMN, AD_PEST, AT_ENGL, AT_TENT, AT_TUCH,
} from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { MONSTER_NAME, monsterIsUndead } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import {
    AMULET_OF_LIFE_SAVING, BLACK_DRAGON_SCALES, CLOAK_OF_PROTECTION, OBJECT_NAMES,
} from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { isHumanWereMonster } from '../js/were.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
const GREEN_DRAGON_SCALES = OBJECT_NAMES.indexOf('green dragon scales');
const maximumRoll = (sides: number) => sides;
const maximumDice = (count: number, sides: number) => count * sides;
const drainSucceeds = (range: number) => range === 3 ? 0 : range - 1;
const energyDrainSucceeds = (range: number) => range === 4 ? 0 : range - 1;

async function combatPair(attackerSpecies: string, defenderSpecies: string) {
    const level = freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    game.datetime = '20261010230000';
    const attacker = await createMonsterAt(attackerSpecies, 11, 10, TEST_MONSTER_FLAGS);
    const defender = await createMonsterAt(defenderSpecies, 12, 10, TEST_MONSTER_FLAGS);
    attacker.mhp = attacker.mhpmax = 20;
    defender.mhp = defender.mhpmax = 40;
    return { attacker, defender, level };
}

void test('monster life drain replaces the hit damage, reduces level and maximum HP, and does not heal its attacker', async () => {
    const { attacker, defender } = await combatPair('wraith', 'orc');
    attacker.mhp = 2;
    defender.m_lev = 4;
    const messages: string[] = [];

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DRLI, 1, 2], {
        state: game, visible: true, random: drainSucceeds, rollDice: maximumDice,
        publish: async message => { messages.push(message); },
    });

    assert.equal(defender.mhp, 28);
    assert.equal(defender.mhpmax, 28);
    assert.equal(defender.m_lev, 3);
    assert.equal(attacker.mhp, 2);
    assert.ok(messages.includes('The orc becomes weaker!'));
});

void test('a failed life-drain chance keeps the ordinary contact damage', async () => {
    const { attacker, defender } = await combatPair('wraith', 'orc');
    const oldLevel = defender.m_lev;

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DRLI, 1, 2], {
        state: game, visible: false, random: range => range - 1, rollDice: maximumDice,
    });

    assert.equal(defender.mhp, 38);
    assert.equal(defender.mhpmax, 40);
    assert.equal(defender.m_lev, oldLevel);
});

for (const cancelled of [false, true]) {
    void test(`${cancelled ? 'attacker cancellation' : 'magic-negating armor'} blocks life drain while retaining physical damage`, async () => {
        const { attacker, defender } = await combatPair('wraith', 'orc');
        if (cancelled) attacker.mcan = 1;
        else await equipMonsterObject(defender, await knownObject(CLOAK_OF_PROTECTION), W_ARMC);
        const oldLevel = defender.m_lev;
        const messages: string[] = [];

        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DRLI, 1, 2], {
            state: game, visible: true, random: () => 0, rollDice: maximumDice,
            publish: async message => { messages.push(message); },
        });

        assert.equal(defender.mhp, 38);
        assert.equal(defender.mhpmax, 40);
        assert.equal(defender.m_lev, oldLevel);
        assert.equal(messages.includes('The orc avoids harm.'), !cancelled);
    });
}

for (const defense of ['undead', 'adult dragon', 'scales', 'wielded artifact']) {
    void test(`${defense} prevents monster life drain`, async () => {
        const { attacker, defender } = await combatPair('wraith', defense === 'undead'
            ? 'vampire' : defense === 'adult dragon' ? 'black dragon' : 'orc');
        if (defense === 'scales') {
            await equipMonsterObject(defender, await knownObject(BLACK_DRAGON_SCALES), W_ARM);
        } else if (defense === 'wielded artifact') {
            await equipMonsterObject(defender, await artifactObject('Stormbringer'), W_WEP);
        }
        const oldLevel = defender.m_lev;

        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DRLI, 1, 2], {
            state: game, visible: false, random: drainSucceeds, rollDice: maximumDice,
        });

        assert.equal(defender.mhp, 38);
        assert.equal(defender.mhpmax, 40);
        assert.equal(defender.m_lev, oldLevel);
    });
}

for (const maximumBefore of [4, 6]) {
    void test(`life drain respects the level floor without increasing a ${maximumBefore}-HP maximum`, async () => {
        const { attacker, defender } = await combatPair('wraith', 'orc');
        defender.m_lev = 4;
        defender.mhp = defender.mhpmax = maximumBefore;

        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DRLI, 1, 2], {
            state: game, visible: false, random: drainSucceeds,
            rollOne: maximumRoll, rollDice: maximumDice,
        });

        assert.equal(defender.mhpmax, maximumBefore === 4 ? 4 : 5);
        assert.ok(defender.mhp <= 0);
    });
}

void test('life drain past level zero triggers actual life saving without reducing the level below zero', async () => {
    const { attacker, defender, level } = await combatPair('wraith', 'orc');
    defender.m_lev = 0;
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const input = resetInputState();
    installPagerInput(input, { expected: /orc|But wait|medallion|looks much better/, limit: 8 });

    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DRLI, 1, 2], {
        state: game, visible: true, random: drainSucceeds, rollDice: maximumDice,
        publish: async () => {},
    });

    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(defender.m_lev, 0);
    assert.ok(defender.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(level.monsters.includes(defender), true);
});

void test('Death drains an undead defender despite its resistance and his cancellation, with reduced damage', async () => {
    const { attacker, defender } = await combatPair('Death', 'human zombie');
    assert.equal(monsterIsUndead(defender.mnum), true, 'The defender must have an undead body at contact');
    attacker.mcan = 1;
    defender.m_lev = 5;

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DETH, 2, 6], {
        state: game, visible: false, random: () => 0, rollOne: maximumRoll, rollDice: maximumDice,
    });

    assert.equal(defender.mhp, 34);
    assert.equal(defender.mhpmax, 34);
    assert.equal(defender.m_lev, 4);
});

for (const method of [AT_TUCH, AT_ENGL] as const) {
    void test(`energy drain ${method === AT_ENGL ? 'inside engulfment stays quiet' : 'announces a visible spellcaster'} and inflicts no HP damage`, async () => {
        const { attacker, defender } = await combatPair('energy vortex', 'gnomish wizard');
        defender.mspec_used = 19;
        const messages: string[] = [];

        await resolveMonsterCombatDamage(attacker, defender, [method, AD_DREN, 1, 6], {
            state: game, visible: true, random: energyDrainSucceeds, rollDice: maximumDice,
            publish: async message => { messages.push(message); },
        });

        assert.equal(defender.mhp, 40);
        assert.equal(defender.mspec_used, 23);
        assert.equal(messages.includes('The gnomish wizard seems lethargic.'), method !== AT_ENGL);
    });
}

for (const species of ['jackal', 'gnomish wizard']) {
    void test(`energy drain has no effect on ${species === 'jackal' ? 'a creature without spells or breath' : 'an exhausted caster'}`, async () => {
        const { attacker, defender } = await combatPair('energy vortex', species);
        defender.mspec_used = species === 'jackal' ? 0 : 20;

        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DREN, 1, 6], {
            state: game, visible: false, random: energyDrainSucceeds, rollDice: maximumDice,
        });

        assert.equal(defender.mhp, 40);
        assert.equal(defender.mspec_used, species === 'jackal' ? 0 : 20);
    });
}

for (const species of ['lichen', 'ghost', 'orc', 'pony', 'rust monster']) {
    void test(`Famine ${species === 'lichen' || species === 'ghost' ? 'cannot harm' : 'damages'} a ${species}`, async () => {
        const { attacker, defender } = await combatPair('Famine', species);

        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_FAMN, 1, 6], {
            state: game, visible: false, rollDice: maximumDice,
        });

        assert.equal(defender.mhp, species === 'lichen' || species === 'ghost' ? 40 : 34);
    });
}

for (const damageType of [AD_DISE, AD_PEST] as const) {
    for (const species of ['lichen', 'ghoul', 'green dragon', 'baby green dragon', 'killer bee']) {
        void test(`${damageType === AD_PEST ? 'Pestilence' : 'disease'} checks ${species} disease defenses rather than poison resistance`, async () => {
            const { attacker, defender } = await combatPair('Pestilence', species);
            const protectedSpecies = ['lichen', 'ghoul', 'green dragon'].includes(species);

            await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, damageType, 1, 6], {
                state: game, visible: false, rollDice: maximumDice,
            });

            assert.equal(defender.mhp, protectedSpecies ? 40 : 34);
        });
    }
}

for (const worn of [false, true]) {
    void test(`${worn ? 'wearing' : 'carrying'} green dragon scales ${worn ? 'blocks' : 'does not block'} disease`, async () => {
        const { attacker, defender } = await combatPair('Pestilence', 'orc');
        const scales = await knownObject(GREEN_DRAGON_SCALES);
        if (worn) await equipMonsterObject(defender, scales, W_ARM);
        else await addObjectToMonsterInventory(defender, scales);

        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_DISE, 1, 6], {
            state: game, visible: false, rollDice: maximumDice,
        });

        assert.equal(defender.mhp, worn ? 40 : 34);
    });
}

void test('daylight prevents a gremlin curse while retaining its ordinary damage', async () => {
    const { attacker, defender } = await combatPair('gremlin', 'orc');
    game.datetime = '20261010120000';
    defender.mstrategy = STRAT_WAITFORU;

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_CURS, 1, 2], {
        state: game, visible: false, random: () => 0, rollDice: maximumDice,
    });

    assert.equal(defender.mcan || 0, 0);
    assert.equal(defender.mstrategy, STRAT_WAITFORU);
    assert.equal(defender.mhp, 38);
});

for (const deaf of [false, true]) {
    void test(`an unseen gremlin curse ${deaf ? 'stays silent for a deaf hero' : 'can be heard'} while cancelling the defender`, async () => {
        const { attacker, defender } = await combatPair('gremlin', 'orc');
        requirePlayingGame(game);
        game.u.deafTurns = deaf ? 10 : 0;
        defender.mstrategy = STRAT_WAITFORU;
        const messages: string[] = [];

        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_CURS, 1, 2], {
            state: game, visible: false, random: () => 0, rollDice: maximumDice,
            publish: async message => { messages.push(message); },
        });

        assert.equal(defender.mcan, 1);
        assert.equal(defender.mstrategy & STRAT_WAITFORU, 0);
        assert.equal(defender.mhp, 38);
        assert.equal(messages.includes('You hear laughter.'), !deaf);
    });
}

for (const changes of [false, true]) {
    void test(`curse cancellation ${changes ? 'can revert' : 'does not always revert'} a werebeast`, async () => {
        const { attacker, defender } = await combatPair('gremlin', 'werewolf');
        defender.mhp = 20;
        assert.equal(isHumanWereMonster(defender), false);

        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_CURS, 1, 2], {
            state: game, visible: true,
            random: range => range === 30 && !changes ? 29 : 0,
            rollDice: maximumDice, publish: async () => {},
        });

        assert.equal(defender.mcan, 1);
        assert.equal(isHumanWereMonster(defender), changes);
        assert.equal(defender.mhp, changes ? 23 : 18);
    });
}

void test('a gremlin curse destroys a clay golem and awards actual attacker growth once', async () => {
    const { attacker, defender, level } = await combatPair('gremlin', 'clay golem');
    requirePlayingGame(game);
    const messages: string[] = [];

    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_CURS, 1, 2], {
        state: game, visible: true, random: () => 0, rollOne: maximumRoll, rollDice: maximumDice,
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.equal(defender.mcan, 1);
    assert.equal(level.monsters.includes(defender), false);
    assert.ok(attacker.mhpmax > 20);
    assert.ok(messages.includes('The clay golem is destroyed!'));
    assert.equal(game.u.uconduct.killer || 0, 0);
});

void test('a life-saved clay form remains cancelled and gives its curser no kill growth', async () => {
    const { attacker, defender, level } = await combatPair('gremlin', 'vampire');
    await changeMonsterForm(defender, MONSTER_NAME.indexOf('clay golem'), game);
    assert.equal(defender.mnum, MONSTER_NAME.indexOf('clay golem'));
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    await makeBlinded(10, { talk: false });

    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_CURS, 1, 2], {
        state: game, visible: false, random: () => 0, rollOne: maximumRoll, rollDice: maximumDice,
        publish: async () => {},
    });

    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(defender.mcan, 1);
    assert.equal(amulet.where, 'gone');
    assert.ok(defender.mhp > 0);
    assert.equal(level.monsters.includes(defender), true);
    assert.equal(attacker.mhpmax, 20);
});

void test('an unseen clay pet killed by a curse gives the native strangely-sad feedback', async () => {
    const { attacker, defender } = await combatPair('gremlin', 'clay golem');
    initializePet(defender, { state: game });
    await makeBlinded(10, { talk: false });
    const messages: string[] = [];

    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_CURS, 1, 2], {
        state: game, visible: false, random: () => 0, rollOne: maximumRoll, rollDice: maximumDice,
        publish: async message => { messages.push(message); },
    });

    assert.ok(messages.includes('You have a strangely sad feeling for a moment, then it passes.'));
    assert.ok(messages.every(message => !message.includes('laughter')));
});

void test('brain contact honors the head flag independently of its retained hit square', async () => {
    const { attacker, defender } = await combatPair('mind flayer', 'hill giant');
    const health = defender.mhp;

    const miss = await resolveMonsterCombatDamage(attacker, defender, [AT_TENT, AD_DRIN, 1, 2], {
        state: game, visible: false, target: { x: defender.mx, y: defender.my },
        notOnHead: true,
    });

    assert.equal(defender.mhp, health, 'an off-head strike cannot reach the brain');
    assert.equal(miss.skipBrainDrain, true);

    await resolveMonsterCombatDamage(attacker, defender, [AT_TENT, AD_DRIN, 1, 2], {
        state: game, visible: false, target: { x: attacker.mx, y: attacker.my },
        notOnHead: false,
    });

    assert.ok(defender.mhp < health, 'the independent head strike reaches the brain');
});
