import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DB_NORTH, DB_MOAT,
    DOOR, DRAWBRIDGE_DOWN, FIRE_TRAP, LANDMINE, PIT, ROCKTRAP, RUST_TRAP, W_ARM,
} from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { moveDrawbridgeOccupants } from '../js/drawbridge_occupants.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { CORPSE, POT_OIL, RED_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [name, trapType] of [
    ['bear trap', BEAR_TRAP], ['pit', PIT], ['arrow trap', ARROW_TRAP],
    ['falling rock', ROCKTRAP], ['land mine', LANDMINE],
] as const) {
    void test(`an unseen pet killed by a ${name} gives a sad feeling`, async () => {
        const { monster } = await freshMonsterTrapRoom(trapType, {
            monster: { species: 'pony', hitPoints: 1 },
        });
        requirePlayingGame(game);
        initializePet(monster);
        await makeBlinded(1, { talk: false });
        const messages: string[] = [];

        const action = await triggerImmediateMonsterTrap(monster, game, {
            random: range => range - 1,
            rollOne: sides => sides, rollDice: () => 8,
        });
        await resumeDeferredMonsterTrap(action, game, {
            rollOne: sides => sides, rollDice: () => 8,
            publish: async message => { messages.push(message); },
        });

        assert.equal(game.level.monsters.includes(monster), false);
        assert.ok(messages.includes('You have a sad feeling for a moment, then it passes.'));
        assert.equal(messages.some(message => /is killed!|is destroyed!/.test(message)), false);
    });
}

void test('a pet iron golem rusting to pieces has grief and a rust epitaph without a second death line', async () => {
    const { monster } = await freshMonsterTrapRoom(RUST_TRAP, {
        monster: { species: 'iron golem' },
    });
    requirePlayingGame(game);
    initializePet(monster);
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(game.level.monsters.includes(monster), false);
    assert.ok(messages.some(message => message.endsWith('falls to pieces!')));
    assert.ok(messages.includes('You have a sad feeling for a moment, then it passes.'));
    assert.ok(messages.some(message => message.endsWith('rust in peace.')));
    assert.equal(messages.some(message => message.endsWith('is destroyed!')), false);
});

void test('an invisible pet killed by anti-magic compression gives grief instead of an unseen kill line', async () => {
    const { monster } = await freshMonsterTrapRoom(ANTI_MAGIC, {
        monster: { species: 'baby gray dragon', hitPoints: 1, minvis: true },
    });
    requirePlayingGame(game);
    initializePet(monster);
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game, { rollOne: () => 4 });
    await resumeDeferredMonsterTrap(action, game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(game.level.monsters.includes(monster), false);
    assert.ok(messages.includes('You have a sad feeling for a moment, then it passes.'));
    assert.equal(messages.some(message => message.includes('compression')), false);
});

void test('the initial fire-trap hit does not give a straw pet the inventory-burning epitaph', async () => {
    const { monster } = await freshMonsterTrapRoom(FIRE_TRAP, {
        monster: { species: 'straw golem', hitPoints: 1, maxHitPoints: 20 },
    });
    requirePlayingGame(game);
    initializePet(monster);
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game, { rollDice: () => 8 });
    await resumeDeferredMonsterTrap(action, game, {
        random: range => range === 5 ? 1 : 0,
        publish: async message => { messages.push(message); },
    });

    assert.equal(game.level.monsters.includes(monster), false);
    assert.ok(messages.some(message => message.endsWith('is destroyed!')));
    assert.equal(messages.some(message => message.includes('roast in peace')), false);
});

void test('a straw pet killed by an exploding potion in a fire trap receives a roast epitaph', async () => {
    const { monster } = await freshMonsterTrapRoom(FIRE_TRAP, {
        monster: { species: 'straw golem', hitPoints: 1, maxHitPoints: 20 },
    });
    requirePlayingGame(game);
    initializePet(monster);
    await equipMonsterObject(monster, await knownObject(RED_DRAGON_SCALE_MAIL), W_ARM);
    const potion = await knownObject(POT_OIL);
    await addObjectToMonsterInventory(monster, potion);
    const messages: string[] = [];

    const action = await triggerImmediateMonsterTrap(monster, game, { rollDice: () => 8 });
    await resumeDeferredMonsterTrap(action, game, {
        random: range => range === 5 ? 1 : 0,
        rollOne: () => 6,
        publish: async message => { messages.push(message); },
    });

    assert.equal(potion.where, 'gone');
    assert.equal(game.level.monsters.includes(monster), false);
    assert.ok(messages.some(message => message.endsWith('is uninjured.')));
    assert.ok(messages.some(message => message.endsWith('roast in peace.')));
    assert.equal(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === CORPSE), false);
});

for (const [name, trapType] of [['pit', PIT], ['bear trap', BEAR_TRAP]] as const) {
    void test(`a monster knocked into a ${name} does not award the hero kill credit`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt('pony', 11, 10);
        monster.mhp = 1;
        addTrap(game.level, trapType, 12, 10);
        const experience = game.u.uexp;
        const kills = game.u.uconduct.killer ?? 0;

        await hurtleMonster(monster, 1, 0, 1, {
            announce: async () => {},
            finishMonsterDeath: victim => finishHeroMonsterKill(victim, victim.mx, victim.my),
        });

        assert.equal(game.level.monsters.includes(monster), false);
        assert.equal(game.u.uexp, experience);
        assert.equal(game.u.uconduct.killer ?? 0, kills);
    });
}

void test('an unseen pet crushed by a moving drawbridge gives a sad feeling', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.context.mon_moving = true;
    const monster = await createMonsterAt('little dog', 12, 10);
    initializePet(monster);
    monster.minvis = true;
    const location = game.level.requireAt(12, 10);
    location.typ = DRAWBRIDGE_DOWN;
    location.drawbridgemask = DB_NORTH | DB_MOAT;
    const wall = game.level.requireAt(12, 9);
    wall.typ = DOOR;
    vision_recalc(0);
    const input = resetInputState();

    await answerPrompts(moveDrawbridgeOccupants(
        { x: 12, y: 10, location }, { x: 12, y: 9, location: wall }, game,
    ), input, [
        { prompt: /crushed underneath the drawbridge\.[\s\S]*--More--/, keys: ' ' },
    ]);
    await flush_screen(1);

    assert.equal(game.level.monsters.includes(monster), false);
    assert.ok(game.nhDisplay);
    const message = game.nhDisplay.grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(message, /You have a sad feeling for a moment, then it passes\./);
});
