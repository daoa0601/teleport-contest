import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const condition of ['paralyzed', 'waiting', 'sleeping'] as const) {
    void test(`a ${condition} monster changes its hallucinated appearance without moving`, async () => {
        freshObjectRoom({ hero: { hallucinationTurns: 20, stealth: true } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('soldier', 14, 10, MM_NOGRP | NO_MINVENT);
        monster.mpeaceful = false;
        monster.movement = 12;
        if (condition === 'paralyzed') monster.mcanmove = 0;
        else if (condition === 'waiting') {
            monster.mstrategy = STRAT_WAITFORU;
            monster.mcansee = 0;
        } else monster.msleeping = 1;
        initRng(1n);
        newsym(monster.mx, monster.my);
        const previous = glyphAt(monster.mx, monster.my);
        assert.ok(previous?.kind === 'monster');

        await runMonsterAction(monster, game, () => 1);

        const current = glyphAt(monster.mx, monster.my);
        assert.ok(current?.kind === 'monster');
        assert.notEqual(current.mnum, previous.mnum);
        assert.equal(monster.mx, 14);
        assert.equal(monster.my, 10);
    });
}
