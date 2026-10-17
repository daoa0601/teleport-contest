import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_MISS, MM_NOGRP, NO_MINVENT,
    STRAT_WAITFORU, W_AMUL, W_WEP,
} from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AT_EXPL } from '../js/monster_attack_types.js';
import { resolveMonsterCombatExplosion } from '../js/monster_combat_explosion.js';
import { reportMonsterCombatNoise } from '../js/monster_combat_messages.js';
import { MONSTER_ATTACKS } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, LEASH } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function combatants(source: string, target = 'orc') {
    freshObjectRoom({ heroX: 7, heroY: 10 });
    const attacker = await createMonsterAt(source, 11, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt(target, 12, 10, MM_NOGRP | NO_MINVENT);
    attacker.mhp = attacker.mhpmax = 50;
    defender.mhp = defender.mhpmax = 100;
    const attack = MONSTER_ATTACKS[attacker.mnum]?.find(([method]) => method === AT_EXPL);
    assert.ok(attack, `${source} needs its native explosion attack`);
    return { attacker, defender, attack };
}

// Pick the torso when fire searches for armor; otherwise creatures fail their
// magic-resistance roll and fragile inventory avoids random destruction.
function unresistedBlast(range: number): number {
    return range === 5 ? 1 : range - 1;
}

void test('cancellation stops a monster explosion without harming either combatant', async () => {
    const { attacker, defender, attack } = await combatants('flaming sphere');
    attacker.mcan = 1;
    const messages: string[] = [];

    const result = await resolveMonsterCombatExplosion(attacker, defender, attack, {
        visible: true, publish: async message => { messages.push(message); },
    });

    assert.equal(result.mask, M_ATTK_MISS);
    assert.equal(result.damage, 0);
    assert.equal(attacker.mhp, 50);
    assert.equal(defender.mhp, 100);
    assert.equal(messages.length, 0);
});

for (const source of ['flaming sphere', 'freezing sphere', 'shocking sphere'] as const) {
    void test(`${source} disappears before its area blast damages the defender and a bystander`, async () => {
        const { attacker, defender, attack } = await combatants(source);
        requirePlayingGame(game);
        const bystander = await createMonsterAt('newt', 12, 11, MM_NOGRP | NO_MINVENT);
        bystander.mhp = bystander.mhpmax = 100;
        const messages: string[] = [];
        const experience = game.u.uexp;

        const result = await resolveMonsterCombatExplosion(attacker, defender, attack, {
            visible: true, random: unresistedBlast, rollDice: () => 12,
            publish: async message => { messages.push(message); },
        });

        assert.equal(result.mask, M_ATTK_AGR_DIED);
        assert.equal(result.damage, 12);
        assert.equal(result.heroDied, false);
        assert.notEqual(monsterAtPosition(game.level, attacker.mx, attacker.my), attacker);
        assert.equal(defender.mhp, 88);
        assert.equal(bystander.mhp, 88);
        assert.equal(game.u.uexp, experience);
        assert.equal(messages.some(message => message.startsWith(`The ${source} is caught`)), false);
        assert.equal(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === CORPSE), false);
    });
}

void test('an elemental explosion reports both deaths when it kills its defender', async () => {
    const { attacker, defender, attack } = await combatants('freezing sphere');
    requirePlayingGame(game);
    defender.mhp = 1;

    const result = await resolveMonsterCombatExplosion(attacker, defender, attack, {
        visible: true, random: unresistedBlast, rollDice: () => 12,
        publish: async () => {},
    });

    assert.equal(result.mask, M_ATTK_AGR_DIED | M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(game.level, defender.mx, defender.my), defender);
});

void test('a life-saved elemental sphere stays alive while its combat result ends the attack', async () => {
    const { attacker, defender, attack } = await combatants('freezing sphere');
    requirePlayingGame(game);
    initializePet(attacker);
    const amulet = await equipMonsterObject(attacker, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const messages: string[] = [];
    const input = resetInputState();

    const result = await answerPrompts(resolveMonsterCombatExplosion(attacker, defender, attack, {
        visible: true, random: unresistedBlast, rollDice: () => 12,
        publish: async message => { messages.push(message); },
    }), input, [
        { prompt: /But wait\.\.\.  [\s\S]*medallion begins to glow![\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(result.mask, M_ATTK_AGR_DIED);
    assert.ok(game.level.monsters.includes(attacker));
    assert.ok(attacker.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(defender.mhp, 88);
    assert.ok(messages.some(message => message.includes('melancholy feeling')));
});

void test('a yellow light blinds its defender without HP damage and clears its waiting strategy', async () => {
    const { attacker, defender, attack } = await combatants('yellow light');
    defender.mstrategy = STRAT_WAITFORU | 1;
    const messages: string[] = [];

    const result = await resolveMonsterCombatExplosion(attacker, defender, attack, {
        visible: true, rollDice: () => 200,
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.mask, M_ATTK_AGR_DIED);
    assert.equal(result.damage, 0);
    assert.equal(defender.mhp, 100);
    assert.equal(defender.mblinded, 127);
    assert.equal(defender.mcansee, 0);
    assert.equal(defender.mstrategy, 1);
    assert.ok(messages.some(message => message.endsWith('is blinded.')));
});

for (const resistance of ['eyeless', 'sleeping', 'already blind', 'blinding species', 'artifact'] as const) {
    void test(`a ${resistance} defender resists a yellow light`, async () => {
        const { attacker, defender, attack } = await combatants('yellow light',
            resistance === 'eyeless' ? 'gray ooze' : resistance === 'blinding species' ? 'Archon' : 'orc');
        if (resistance === 'sleeping') defender.msleeping = 1;
        if (resistance === 'already blind') {
            defender.mcansee = 0;
            defender.mblinded = 9;
        }
        if (resistance === 'artifact')
            await equipMonsterObject(defender, await artifactObject('Sunsword'), W_WEP);
        defender.mstrategy = STRAT_WAITFORU;
        const blindness = defender.mblinded ?? 0;
        const messages: string[] = [];

        await resolveMonsterCombatExplosion(attacker, defender, attack, {
            visible: true, publish: async message => { messages.push(message); },
        });

        assert.equal(defender.mblinded ?? 0, blindness);
        assert.equal(defender.mstrategy, STRAT_WAITFORU);
        assert.equal(defender.mhp, 100);
        assert.equal(messages.some(message => message.endsWith('is blinded.')), false);
    });
}

void test('black light confuses a sighted defender even when it resists blinding light', async () => {
    const { attacker, defender, attack } = await combatants('black light', 'Archon');
    defender.mstrategy = STRAT_WAITFORU;
    defender.mconf = 1;
    const messages: string[] = [];

    const result = await resolveMonsterCombatExplosion(attacker, defender, attack, {
        visible: true, publish: async message => { messages.push(message); },
    });

    assert.equal(result.damage, 0);
    assert.equal(defender.mhp, 100);
    assert.equal(defender.mconf, 1);
    assert.equal(defender.mstrategy, 0);
    assert.ok(messages.some(message => message.endsWith('looks more confused.')));
});

for (const target of ['blind orc', 'gray ooze'] as const) {
    void test(`black light leaves a ${target} unconfused`, async () => {
        const { attacker, defender, attack } = await combatants('black light', target === 'blind orc' ? 'orc' : target);
        if (target === 'blind orc') defender.mcansee = 0;
        defender.mstrategy = STRAT_WAITFORU;

        await resolveMonsterCombatExplosion(attacker, defender, attack, {
            visible: true, publish: async () => {},
        });

        assert.equal(!!defender.mconf, false);
        assert.equal(defender.mstrategy, STRAT_WAITFORU);
    });
}

void test('life saving after a light explosion preserves the source and omits melancholy', async () => {
    const { attacker, defender, attack } = await combatants('yellow light');
    requirePlayingGame(game);
    initializePet(attacker);
    await makeBlinded(1, { talk: false });
    const amulet = await equipMonsterObject(attacker, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const messages: string[] = [];

    const result = await resolveMonsterCombatExplosion(attacker, defender, attack, {
        visible: false, publish: async message => { messages.push(message); },
    });

    assert.equal(result.mask, M_ATTK_MISS);
    assert.ok(game.level.monsters.includes(attacker));
    assert.ok(attacker.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(defender.mcansee, 0);
    assert.equal(messages.some(message => message.includes('melancholy feeling')), false);
});

void test('an exploding leashed pet releases its actual leash and presents melancholy after the pager', async () => {
    const { attacker, defender, attack } = await combatants('yellow light');
    requirePlayingGame(game);
    initializePet(attacker);
    attacker.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: attacker.m_id });
    const input = resetInputState();

    await answerPrompts(resolveMonsterCombatExplosion(attacker, defender, attack, {
        visible: true, rollDice: () => 20,
    }), input, [
        { prompt: /explodes![\s\S]*is blinded\.[\s\S]*--More--/, keys: ' ' },
        { prompt: /Your leash falls slack\.[\s\S]*--More--/, keys: ' ' },
    ]);
    await flush_screen(1);

    assert.equal(leash.leashmon, 0);
    assert.equal(attacker.mleashed, 0);
    assert.ok(game.nhDisplay);
    const message = game.nhDisplay.grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(message, /You have a melancholy feeling for a moment, then it passes\./);
});

void test('unseen explosions and ordinary monster combat share one audible-noise throttle', async () => {
    const { attacker, defender, attack } = await combatants('yellow light');
    await makeBlinded(1, { talk: false });
    const messages: string[] = [];
    const publish = async (message: string) => { messages.push(message); };

    await resolveMonsterCombatExplosion(attacker, defender, attack, { visible: false, publish });
    await reportMonsterCombatNoise(defender, game, { publish });

    assert.ok(messages.includes('You hear an explosion in the distance.'));
    assert.equal(messages.some(message => message.includes('some noises')), false);
    game.moves += 11;
    await reportMonsterCombatNoise(defender, game, { publish });
    assert.ok(messages.includes('You hear some noises in the distance.'));
});
