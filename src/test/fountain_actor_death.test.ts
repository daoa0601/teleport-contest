import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, F_WARNED, ROOM, ROLLING_BOULDER_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { command, lifeSaving } of [
    { command: 'q', lifeSaving: false },
    { command: 'q', lifeSaving: true },
    { command: 'dip', lifeSaving: false },
    { command: 'dip', lifeSaving: true },
]) {
    void test(`${command}: fountain snakes ${lifeSaving ? 'continue after life saving' : 'stop spawning when their trap kills the hero'}`, async () => {
        const level = freshObjectRoom({
            left: 8, right: 15, top: 10, bottom: 10,
            hero: { uhp: 1, uhpmax: 40, uac: 20 },
            flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
        });
        const fountain = level.requireAt(10, 10);
        fountain.typ = FOUNTAIN;
        fountain.looted = F_WARNED;
        for (const x of [9, 11]) {
            addTrap(level, ROLLING_BOULDER_TRAP, x, 10, {
                launch: { x: 13, y: 10 }, launch2: { x: 8, y: 10 },
            });
        }
        await floorObject(BOULDER, 13, 10);
        if (lifeSaving) {
            const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        const answers = 'y' + ' '.repeat(100);
        resetInputState().feed(command === 'q' ? answers : '');
        initRng(command === 'q' ? 3n : 80n);

        if (command === 'q') await rhack(command.charCodeAt(0));
        else await runExtendedCommand('dip', '-' + answers);

        assert.equal(!!game.program_state.gameover, !lifeSaving);
        assert.equal(game.u.umortality, 1);
        if (lifeSaving) {
            assert.ok(level.monsters.length > 1, 'the fountain finishes creating snakes after the hero survives');
            assert.equal(fountain.typ, ROOM, 'the warned fountain dries after the effect finishes');
        } else {
            assert.equal(level.monsters.length, 1,
                `the first snake killed the hero, but ${level.monsters.length} snakes remain`);
            assert.equal(fountain.typ, FOUNTAIN, 'death ends the command before the fountain dries');
        }
    });
}
