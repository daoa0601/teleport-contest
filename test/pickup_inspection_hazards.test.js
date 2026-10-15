import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { ARROW_TRAP, W_AMUL } from '../js/const.js';
import { AMULET_OF_LIFE_SAVING, CLUB, CORPSE } from '../js/object_data.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { addTrap } from './support/level-state.js';
for (const poisonous of [false, true]) {
    void test(`blind pickup announces a ${poisonous ? 'poison gas' : 'vapor'} cloud and known trap before corpse inspection`, async () => {
        const level = freshPlayableRoom({ hero: { blindTurns: 10 } });
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
            invlet: 'a', worn: true, owornmask: W_AMUL,
        });
        game.uamul = game.u.uamul = amulet;
        const club = await floorObject(CLUB, 10, 10);
        await floorObject(CORPSE, 10, 10, { corpsenm: 10 });
        addTrap(level, ARROW_TRAP, 10, 10, { tseen: true });
        const cloud = await createHarmlessGasCloudSelection(game, [{ x: 10, y: 10 }]);
        assert.ok(cloud);
        cloud.damage = poisonous ? 8 : 0;
        cloud.heroFault = false;
        const input = resetInputState();
        const operation = rhack(','.charCodeAt(0));
        await input.waitUntilBlocked();
        const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        const amuletStillWorn = amulet.where === 'inventory';
        input.feed(' '.repeat(12));
        await operation;
        assert.match(message, new RegExp(`There is a ${poisonous ? 'poison gas' : 'vapor'} cloud and an arrow trap here\\.`));
        assert.equal(amuletStillWorn, true, 'The hazard announcement precedes lethal corpse contact.');
        assert.equal(amulet.where, 'gone');
        assert.equal(game.inventory.includes(club), false);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=pickup_inspection_hazards.test.js.map