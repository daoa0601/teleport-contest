import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_FLOOR, DB_ICE, DB_MOAT, DB_WEST, DRAWBRIDGE_UP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { BRASS_LANTERN, POT_WATER } from '../js/object_data.js';
import { waterDamageObject } from '../js/trap.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { surface, underlay, submerged } of [
    { surface: 'dry floor', underlay: DB_FLOOR, submerged: false },
    { surface: 'ice', underlay: DB_ICE, submerged: false },
    { surface: 'water', underlay: DB_MOAT, submerged: true },
]) {
    void test(`dipping a lantern beneath a raised bridge over ${surface} ${submerged ? 'submerges it' : 'only splashes it'}`, async () => {
        const level = freshObjectRoom();
        const bridge = level.requireAt(10, 10);
        bridge.typ = DRAWBRIDGE_UP;
        bridge.drawbridgemask = DB_WEST | underlay;
        const lantern = await addInventoryObject(BRASS_LANTERN, { age: 300 });
        const water = await addInventoryObject(POT_WATER);
        assert.ok(beginObjectBurn(lantern));
        const burningAge = lantern.age;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };

        await runExtendedCommand('dip', lantern.invlet
            + (submerged ? 'y' : water.invlet) + ' '.repeat(10));

        assert.equal(lantern.lamplit, !submerged);
        assert.equal(lantern.age, submerged ? 200 : burningAge);
        assert.equal(game.context.move, 1);
        const text = [...messages, game._pending_message].join('\n');
        assert.match(text, /lantern crackles and flickers\./);
        if (submerged) assert.match(text, /lantern goes out!/);
        else assert.doesNotMatch(text, /lantern goes out!/);
    });

    void test(`splashing a humanoid's lantern beneath a raised bridge over ${surface} ${submerged ? 'submerges it' : 'keeps its light and battery'}`, async () => {
        const level = freshObjectRoom();
        const goblin = await createMonsterAt('goblin', 11, 10);
        const lantern = await knownObject(BRASS_LANTERN, { age: 300 });
        await addObjectToMonsterInventory(goblin, lantern);
        assert.ok(beginObjectBurn(lantern));
        const burningAge = lantern.age;
        const bridge = level.requireAt(11, 10);
        bridge.typ = DRAWBRIDGE_UP;
        bridge.drawbridgemask = DB_WEST | underlay;
        const messages: string[] = [];

        const outcome = await waterDamageObject(lantern, messages, game, { force: true });

        assert.equal(outcome, submerged ? 'damaged' : 'nothing');
        assert.equal(lantern.lamplit, !submerged);
        assert.equal(lantern.age, submerged ? 200 : burningAge);
        assert.match(messages.join('\n'), /lantern crackles and flickers\./);
        if (submerged) assert.match(messages.join('\n'), /lantern goes out!/);
        else assert.doesNotMatch(messages.join('\n'), /lantern goes out!/);
    });
}
