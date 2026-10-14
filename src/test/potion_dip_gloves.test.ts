import assert from 'node:assert/strict';
import test from 'node:test';
import { POOL, W_ARMG } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GAUNTLETS_OF_POWER, LEATHER_GLOVES, POT_OIL } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { type, known, seen, description, noun } of [
    { type: GAUNTLETS_OF_POWER, known: true, seen: true, description: 'fencing gloves', noun: 'gauntlets' },
    { type: GAUNTLETS_OF_POWER, known: false, seen: true, description: 'fencing gloves', noun: 'gloves' },
    { type: LEATHER_GLOVES, known: false, seen: true, description: 'riding gauntlets', noun: 'gauntlets' },
    { type: LEATHER_GLOVES, known: true, seen: true, description: 'riding gauntlets', noun: 'gloves' },
    { type: GAUNTLETS_OF_POWER, known: true, seen: false, description: 'riding gauntlets', noun: 'gloves' },
]) {
    for (const washing of [false, true]) {
        void test(`${washing ? 'washing' : 'spilling cursed oil on'} ${known ? 'known' : 'unknown'} ${description}, ${seen ? 'seen' : 'unseen'}, names ${noun}`, async () => {
            freshObjectRoom({ hero: { blindTurns: seen ? 0 : 20 } });
            requirePlayingGame(game);
            assert.ok(game.objectDescriptions);
            game.objectDescriptions[type] = description;
            const gloves = await addInventoryObject(type, {
                typeKnown: known, dknown: seen, observed: seen, owornmask: W_ARMG,
            });
            game.uarmg = gloves;
            const dagger = await addInventoryObject(DAGGER);
            const oil = await addInventoryObject(POT_OIL, { cursed: true });
            const input = resetInputState();
            const messages: string[] = [];
            input.beforeRead = () => { messages.push(game._pending_message); };

            if (washing) {
                game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
                game.u.glibTurns = 12;
                await runExtendedCommand('dip', '-y' + ' '.repeat(20));
                messages.push(game._pending_message);
                assert.equal(game.u.glibTurns, 0);
                assert.match(messages.join('\n'), new RegExp(`Your ${noun} are no longer slippery\\.`));
            } else {
                await runExtendedCommand('dip', dagger.invlet + oil.invlet + ' '.repeat(20));
                assert.ok((game.u.glibTurns ?? 0) >= 2);
                assert.match(game._pending_message, new RegExp(`covers your ${noun} with oil\\.`));
                assert.equal(game.inventory.includes(oil), false);
            }
        });
    }
}
