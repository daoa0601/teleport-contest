import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, RUST_TRAP, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { DAGGER, OIL_LAMP, TALLOW_CANDLE } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { beginObjectBurn } from '../js/timeout.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/trap.js';
import { knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';
for (const quantity of [1, 3]) {
    void test(`a rust trap hitting a gnome lord's right arm describes ${quantity === 1 ? 'a dagger rusting' : 'daggers rusting'}`, async () => {
        const level = await freshObjectRoom({ left: 10, right: 12, top: 10, bottom: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('gnome lord', 11, 10, MM_NOGRP | NO_MINVENT);
        const weapon = await knownObject(DAGGER, { quan: quantity, oeroded: 0 });
        await equipMonsterObject(monster, weapon, W_WEP);
        monster.female = false;
        const trap = addTrap(level, RUST_TRAP, 11, 10);
        const messages = [];
        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            random: () => 2,
            publish: message => { messages.push(message); },
        });
        assert.equal(trap.tseen, true);
        assert.equal(messages[0], "A gush of water hits the gnome lord's right arm!");
        assert.equal(weapon.oeroded, 1, `The weapon must rust: ${messages.join(' | ')}`);
        const feedback = quantity === 1 ? "The gnome lord's dagger rusts!" : "The gnome lord's daggers rust!";
        assert.ok(messages.some(message => message.includes(feedback)), `Expected ${feedback} in: ${messages.join(' | ')}`);
    });
}
for (const erosion of [1, 2]) {
    void test(`a rust trap describes a stack rusting ${erosion === 1 ? 'further' : 'completely'}`, async () => {
        const { monster } = await freshMonsterTrapRoom(RUST_TRAP);
        requirePlayingGame(game);
        const weapon = await knownObject(DAGGER, { quan: 3, oeroded: erosion });
        await equipMonsterObject(monster, weapon, W_WEP);
        const messages = [];
        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            random: () => 2,
            publish: message => { messages.push(message); },
        });
        assert.equal(weapon.oeroded, erosion + 1);
        assert.equal(messages[1], `The giant's daggers rust ${erosion === 1 ? 'further' : 'completely'}!`);
    });
}
for (const verbose of [true, false]) {
    void test(`a rust trap learns rustproof daggers with verbose feedback ${verbose ? 'enabled' : 'disabled'}`, async () => {
        const { monster } = await freshMonsterTrapRoom(RUST_TRAP);
        requirePlayingGame(game);
        game.flags.verbose = verbose;
        const weapon = await knownObject(DAGGER, { quan: 3, oerodeproof: true, rknown: false });
        await equipMonsterObject(monster, weapon, W_WEP);
        const messages = [];
        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            random: () => 2,
            publish: message => { messages.push(message); },
        });
        assert.equal(weapon.oeroded ?? 0, 0);
        assert.equal(weapon.rknown, true);
        assert.equal(messages.length, verbose ? 2 : 1, messages.join(' | '));
        if (verbose)
            assert.equal(messages[1], "Somehow, the giant's daggers are not affected by the oxidation.");
    });
}
for (const type of [OIL_LAMP, TALLOW_CANDLE]) {
    void test(`a body gush snuffs a monster's ${type === OIL_LAMP ? 'lamp' : 'candle'}`, async () => {
        const { monster } = await freshMonsterTrapRoom(RUST_TRAP);
        requirePlayingGame(game);
        const light = await knownObject(type, { age: 200 });
        await addObjectToMonsterInventory(monster, light);
        beginObjectBurn(light);
        const messages = [];
        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            random: () => 4,
            publish: message => { messages.push(message); },
        });
        assert.equal(light.lamplit, false);
        const feedback = type === OIL_LAMP
            ? "The giant's oil lamp goes out!"
            : "The giant's candle's flame is extinguished.";
        assert.ok(messages.includes(feedback), `Expected ${feedback} in: ${messages.join(' | ')}`);
    });
}
//# sourceMappingURL=monster_rust_trap.test.js.map