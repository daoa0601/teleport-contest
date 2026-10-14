import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { autopickupAtHero } from '../js/pickup.js';
import { DB_ICE, DRAWBRIDGE_UP, ICE, W_AMUL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, CLUB, CORPSE } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

for (const terrain of [ICE, DRAWBRIDGE_UP]) {
    void test(`blind pickup describes ice before touching a cockatrice on terrain ${terrain}`, async () => {
        const level = freshPlayableRoom({ hero: { blindTurns: 10 } });
        const square = level.requireAt(10, 10);
        square.typ = terrain;
        if (terrain === DRAWBRIDGE_UP) square.drawbridgemask = DB_ICE;
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, { owornmask: W_AMUL });
        game.uamul = game.u.uamul = amulet;
        const club = await floorObject(CLUB, 10, 10);
        await floorObject(CORPSE, 10, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => {
            messages.push(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '');
        };
        input.feed(' '.repeat(30));

        if (terrain === DRAWBRIDGE_UP) {
            game.flags.pickup = false;
            await autopickupAtHero();
        } else await rhack(','.charCodeAt(0));

        assert.match(messages.join('\n'), /ice here\.  You try to feel what is on it\./);
        assert.equal(amulet.where, 'gone');
        assert.equal(game.inventory.includes(club), false);
        if (terrain === ICE) assert.equal(game.context.move, 0);
        resetInputState();
    });
}
