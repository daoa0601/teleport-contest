import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun, rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
import { createMonsterAt } from './support/monsters.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';

import { LA_DOWN, MM_ANGRY, NO_MINVENT, STAIRS } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';


function topline(): string {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}

void test('travel keeps its selected stair description until another message replaces it', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    level.requireAt(14, 10).typ = STAIRS;
    level.requireAt(14, 10).ladder = LA_DOWN;
    level.dnstair = { x: 14, y: 10 };
    game.stairs = { sx: 14, sy: 10, up: false, isladder: false,
        tolev: { dnum: 0, dlevel: 9 }, u_traversed: false, next: null };
    newsym(14, 10);
    const input = resetInputState();
    input.feed('>.');

    await rhack('_'.charCodeAt(0));
    await flush_screen(1);

    assert.equal(topline(), 'staircase down');
    assert.equal(game.context.move, 1);
});

for (const killed of [false, true]) {
    void test(`travel ${killed ? 'continues past a killed' : 'stops beside a living'} adjacent monster`, async () => {
        freshObjectRoom({ flags: { tips: false } });
        const input = resetInputState();
        input.feed('llll.');
        await rhack('_'.charCodeAt(0));
        assert.equal(game.u.ux, 11);
        const monster = await createMonsterAt('newt', 11, 11, MM_ANGRY | NO_MINVENT);
        if (killed) await finishEnvironmentalMonsterDeath(monster, game, { noCorpse: true });

        const moved = await continueRun();

        assert.equal(moved, killed);
        assert.equal(game.u.ux, killed ? 12 : 11);
    });
}
