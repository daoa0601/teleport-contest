import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { M_ATTK_DEF_DIED, M_ATTK_HIT, MM_NOGRP, NO_MINVENT, W_AMUL, W_WEP } from '../js/const.js';
import { canSpotMonster, flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resolveHeroCombatExplosion } from '../js/hero_combat_explosion.js';
import { resetInputState } from '../js/input.js';
import { AT_EXPL } from '../js/monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, SCR_BLANK_PAPER } from '../js/object_data.js';
import { heroIsBlind } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';

function explosionForm(species: string) {
    freshRoomWithPolymorphedHero(species, { right: 19 });
    vision_recalc(0);
    const attack = MONSTER_ATTACKS[MONSTER_NAME.indexOf(species)]?.find(([method]) => method === AT_EXPL);
    assert.ok(attack, `${species} needs its native explosion attack`);
    return attack;
}

async function targetMonster(species = 'orc', x = 11, y = 10) {
    const monster = await createMonsterAt(species, x, y, MM_NOGRP | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    return monster;
}

function unresistedBlast(range: number): number {
    return range === 5 ? 1 : range - 1;
}

void test('a blind yellow-light hero receives flash feedback without ending its monster form', async () => {
    const attack = explosionForm('yellow light');
    requirePlayingGame(game);
    const defender = await targetMonster();
    assert.equal(heroIsBlind(game), true);
    assert.equal(canSpotMonster(defender), false);
    const form = game.u.umonnum;
    const health = game.u.mh;
    await plineWithContinuation('You explode!');

    const result = await resolveHeroCombatExplosion(defender, attack, {
        rollDice: () => 200,
    });
    await flush_screen(1);

    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(defender.mblinded, 127);
    assert.equal(defender.mcansee, 0);
    assert.equal(defender.mhp, 100);
    assert.equal(game.u.umonnum, form);
    assert.equal(game.u.mh, health);
    assert.ok(game.nhDisplay);
    const row = game.nhDisplay.grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(row, /You explode!\s+It is blinded by your flash of light!/);
});

void test('a light explosion without a target wakes only monsters within seven squares', async () => {
    const attack = explosionForm('yellow light');
    const near = await targetMonster('orc', 16, 10);
    const boundary = await targetMonster('orc', 17, 10);
    near.msleeping = boundary.msleeping = 1;
    const messages: string[] = [];

    const result = await resolveHeroCombatExplosion(null, attack, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(near.msleeping, 0);
    assert.equal(boundary.msleeping, 1);
    assert.ok(near.mcansee);
    assert.ok(boundary.mcansee);
    assert.equal(messages.length, 0);
});

void test('a sleeping target resists a yellow flash before the explosion wakes it', async () => {
    const attack = explosionForm('yellow light');
    const defender = await targetMonster();
    defender.msleeping = 1;
    const messages: string[] = [];

    await resolveHeroCombatExplosion(defender, attack, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(defender.msleeping, 0);
    assert.equal(defender.mblinded ?? 0, 0);
    assert.ok(defender.mcansee);
    assert.equal(messages.length, 0);
});

void test('Sunsword protects a monster from the hero yellow-light flash', async () => {
    const attack = explosionForm('yellow light');
    const defender = await targetMonster();
    await equipMonsterObject(defender, await artifactObject('Sunsword'), W_WEP);

    await resolveHeroCombatExplosion(defender, attack, { publish: async () => {} });

    assert.ok(defender.mcansee);
    assert.equal(defender.mblinded ?? 0, 0);
});

for (const target of ['Archon', 'blind orc', 'gray ooze'] as const) {
    void test(`the hero black-light flash respects the ${target}'s sight`, async () => {
        const attack = explosionForm('black light');
        const defender = await targetMonster(target === 'blind orc' ? 'orc' : target);
        if (target === 'blind orc') defender.mcansee = 0;
        const messages: string[] = [];

        const result = await resolveHeroCombatExplosion(defender, attack, {
            publish: async message => { messages.push(message); },
        });

        assert.equal(result.nativeResult, M_ATTK_HIT);
        assert.equal(defender.mhp, 100);
        assert.equal(!!defender.mconf, target === 'Archon');
        assert.equal(messages.some(message => message.includes('affected by your flash of light')), target === 'Archon');
    });
}

for (const species of ['flaming sphere', 'freezing sphere', 'shocking sphere'] as const) {
    void test(`a hero ${species} damages nearby monsters without damaging its own body or inventory`, async () => {
        const attack = explosionForm(species);
        requirePlayingGame(game);
        const defender = await targetMonster();
        const bystander = await targetMonster('newt', 9, 10);
        const scroll = await addInventoryObject(SCR_BLANK_PAPER);
        const health = game.u.mh;
        const messages: string[] = [];

        const result = await resolveHeroCombatExplosion(defender, attack, {
            rollDice: () => 12, random: unresistedBlast,
            publish: async message => { messages.push(message); },
        });

        assert.equal(result.nativeResult, M_ATTK_HIT);
        assert.equal(result.heroDied, false);
        assert.equal(defender.mhp, 88);
        assert.equal(bystander.mhp, 88);
        assert.equal(game.u.mh, health);
        assert.equal(scroll.where, 'inventory');
        assert.ok(messages.includes('Boom!'));
        assert.equal(messages.includes('You explode!'), false);
    });
}

void test('a hero fire explosion consumes a paper target and awards hero kill credit', async () => {
    const attack = explosionForm('flaming sphere');
    requirePlayingGame(game);
    const defender = await targetMonster('paper golem');
    defender.mhp = 1;
    game.context.mon_moving = true;
    const kills = game.u.uconduct.killer ?? 0;
    const experience = game.u.uexp;

    const result = await resolveHeroCombatExplosion(defender, attack, {
        rollDice: () => 12, random: unresistedBlast, publish: async () => {},
    });

    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(game.level, defender.mx, defender.my), defender);
    assert.equal(game.u.uconduct.killer, kills + 1);
    assert.ok(game.u.uexp > experience);
    assert.equal(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === SCR_BLANK_PAPER), false);
});

void test('killing a bystander leaves the hero explosion result as a hit on the surviving target', async () => {
    const attack = explosionForm('freezing sphere');
    requirePlayingGame(game);
    const defender = await targetMonster();
    const bystander = await targetMonster('newt', 9, 10);
    bystander.mhp = 1;
    const kills = game.u.uconduct.killer ?? 0;

    const result = await resolveHeroCombatExplosion(defender, attack, {
        rollDice: () => 12, random: unresistedBlast, publish: async () => {},
    });

    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.ok(game.level.monsters.includes(defender));
    assert.notEqual(monsterAtPosition(game.level, bystander.mx, bystander.my), bystander);
    assert.equal(game.u.uconduct.killer, kills + 1);
});

void test('a life-saved target makes the hero explosion return a hit', async () => {
    const attack = explosionForm('freezing sphere');
    requirePlayingGame(game);
    const defender = await targetMonster();
    defender.mhp = 1;
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const input = resetInputState();

    const result = await answerPrompts(resolveHeroCombatExplosion(defender, attack, {
        rollDice: () => 12, random: unresistedBlast, publish: async () => {},
    }), input, [
        { prompt: /But wait\.\.\.  [\s\S]*medallion begins to glow![\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.ok(defender.mhp > 0);
    assert.ok(game.level.monsters.includes(defender));
    assert.equal(amulet.where, 'gone');
});

void test('a hero explosion from inside a monster affects the engulfer but spares outside monsters', async () => {
    const attack = explosionForm('freezing sphere');
    requirePlayingGame(game);
    const engulfer = await targetMonster('purple worm');
    const outside = await targetMonster('orc', 9, 10);
    await installSwallowedHero(engulfer);
    const health = game.u.mh;

    const result = await resolveHeroCombatExplosion(engulfer, attack, {
        rollDice: () => 12, random: unresistedBlast, publish: async () => {},
    });

    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(engulfer.mhp, 88);
    assert.equal(outside.mhp, 100);
    assert.equal(game.u.mh, health);
    assert.equal(game.u.ustuck, engulfer);
});
