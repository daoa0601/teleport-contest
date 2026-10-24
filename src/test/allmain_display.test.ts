import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

for (const blind of [false, true]) {
    void test(`command input refreshes Sting's warning for a ${blind ? 'blind running' : 'sighted stationary'} hero`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game._moveloopStarted = true;
        await setPrimaryWeapon(await addInventoryItem(await artifactObject('Sting')));
        await createMonsterAt('goblin', 14, 10, NO_MINVENT);
        if (blind) {
            setHeroBlindnessTurns(100);
            game.context.mv = true;
        }
        const input = resetInputState();
        const expected = blind ? /Sting quivers slightly\./ : /Sting flickers light blue!/;
        installPagerInput(input, { expected, limit: 1 });
        const turn = game.moves;

        await finishAtCommandInput(input, moveloop_core, expected);

        assert.equal(game.moves, turn, 'Refreshing warning does not take a turn');
    });
}
