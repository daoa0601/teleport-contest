import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction } from '../js/monmove.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { makeBlinded } from '../js/sight_change.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const inactive of ['frozen', 'sleeping', 'waiting']) {
    void test(`a sensed ${inactive} monster is redrawn as a hallucination on its turn`, async () => {
        const level = freshObjectRoom({ right: 35 });
        requirePlayingGame(game);
        const troll = await createMonsterAt('troll', 30, 10, MM_NOGRP | NO_MINVENT);
        grantIntrinsicProperty('telepathy', 'outside');
        await makeBlinded(10, { talk: false });
        newsym(troll.mx, troll.my);
        const original = level.requireAt(troll.mx, troll.my).disp_glyph?.glyph;
        game.u.hallucinationTurns = 20;
        if (inactive === 'frozen') troll.mcanmove = 0;
        if (inactive === 'sleeping') troll.msleeping = 1;
        if (inactive === 'waiting') { troll.mstrategy = STRAT_WAITFORU; troll.mcansee = 0; }
        troll.movement = 12;

        await runMonsterAction(troll, game);

        assert.deepEqual([troll.mx, troll.my], [30, 10]);
        assert.notEqual(level.requireAt(troll.mx, troll.my).disp_glyph?.glyph, original);
    });
}
