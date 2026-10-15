import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

for (const source of ['drink nymph', 'dip nymph', 'drink snakes'] as const) {
    void test(`${source} creatures fall into pits immediately on leaving the fountain`, async () => {
        const level = freshObjectRoom();
        level.requireAt(10, 10).typ = FOUNTAIN;
        for (let x = 9; x <= 11; x++) {
            for (let y = 9; y <= 11; y++) {
                if (x !== 10 || y !== 10) addTrap(level, PIT, x, y);
            }
        }
        const stone = source === 'dip nymph' ? await addInventoryObject(ROCK) : null;
        resetInputState().feed(source === 'dip nymph' ? '' : 'y' + ' '.repeat(40));
        initRng(source === 'drink nymph' ? 52n : 3n);

        if (stone) await runExtendedCommand('dip', stone.invlet + 'y' + ' '.repeat(40));
        else await rhack('q'.charCodeAt(0));

        assert.ok(level.monsters.length > 0);
        assert.ok(level.monsters.every(monster => monster.mtrapped || monster.mhp <= 0),
            'Every spawned creature must enter the pit under its landing square');
        assert.ok(level.monsters.some(monster => monster.mhp < monster.mhpmax));
        assert.equal(game.context.move, 1);
    });
}
