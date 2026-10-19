import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { FAINTED, HUNGRY } from '../js/const.js';
import { clearMessageWindow } from '../js/display.js';
import { reportHeroEncumbrance } from '../js/encumbrance.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { HVY_ENCUMBER, MOD_ENCUMBER, nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';

void test('hunger-induced burden pages the faint before monsters move after wizard teleport', async () => {
    freshObjectRoom({
        flags: { debug: true, tips: false, pickup: false, verbose: false },
        hero: { uhunger: 100, uhs: HUNGRY, umovement: 12 },
    });
    requirePlayingGame(game);
    game._moveloopStarted = true;
    const monster = await createMonsterAt('giant ant', 16, 10);
    monster.movement = 12;
    await addInventoryObject(ROCK, { quan: 128 });
    assert.equal(nearCapacity(game), MOD_ENCUMBER);
    await reportHeroEncumbrance();
    clearMessageWindow();
    const turn = game.moves;
    const input = resetInputState();
    installPagerInput(input, { expected: /materialize|faint|heavy load/, limit: 4 });
    let faintTurn: number | undefined;
    let monsterXAtFaint: number | undefined;
    input.beforeRead = () => {
        const message = requireScreenRow(0).map(cell => cell.ch).join('').trim();
        if (/You faint from lack of food\..*--More--/.test(message)) {
            faintTurn = game.moves;
            monsterXAtFaint = monster.mx;
        }
    };
    input.feed('\x14ll.');

    await moveloop_core();
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uhs, FAINTED);
    assert.equal(nearCapacity(game), HVY_ENCUMBER);
    await moveloop_core();

    assert.equal(faintTurn, turn, 'The faint must be acknowledged before advancing world time');
    assert.equal(monsterXAtFaint, 16, 'The monster must stay put until the faint is acknowledged');
    assert.ok(game.moves > turn, 'World time resumes while the hero is fainted');
});
