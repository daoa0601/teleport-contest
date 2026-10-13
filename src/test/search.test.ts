import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { ARROW_TRAP, MM_NOGRP, NO_MINVENT, STATUE_TRAP } from '../js/const.js';
import { automaticSearch } from '../js/detect.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { createCorpstatAt } from '../js/mklev.js';
import { STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';

const PM_JACKAL = 12;

void test('finding a trap under a visible monster keeps the map and needs no acknowledgement', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const newt = await createMonsterAt('newt', 11, 10, MM_NOGRP | NO_MINVENT);
    newsym(newt.mx, newt.my);
    const trap = addTrap(level, ARROW_TRAP, 11, 10, { tseen: false });
    const input = resetInputState();
    let acknowledgements = 0;
    installPagerInput(input, { expected: /find an arrow trap/, limit: 1 });
    input.beforeRead = () => { acknowledgements++; };
    initRng(14n);

    await automaticSearch();

    assert.equal(trap.tseen, true);
    assert.equal(acknowledgements, 0, 'a visible monster does not obscure the remembered trap');
    assert.equal(game._pending_message, 'You find an arrow trap.');
    assert.equal(level.requireAt(11, 10).disp_glyph?.kind, 'monster');
});

void test('searching beside a statue trap releases its monster', async () => {
    const level = freshPlayableRoom({ role: 'wizard' });
    requirePlayingGame(game);
    const x = game.u.ux - 1;
    const y = game.u.uy - 1;
    initRng(9403n);
    const statue = await createCorpstatAt(STATUE, null, PM_JACKAL, x, y, 0);
    addTrap(level, STATUE_TRAP, x, y, { tseen: false });
    initRng(14n);

    await rhack('s'.charCodeAt(0));

    const released = level.monsters.find(monster =>
        monster.mnum === PM_JACKAL && monster.mx === x && monster.my === y,
    );
    assert.ok(released);
    assert.equal(released.mpeaceful, 0);
    assert.equal(statue.where, 'gone');
    assert.equal(level.traps.length, 0);
    assert.equal(game.context.move, 1);
});
