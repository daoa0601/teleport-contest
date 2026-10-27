import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { NOT_HUNGRY } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FOOD_RATION, SPE_CONFUSE_MONSTER } from '../js/object_data.js';
import { forceLearnSpell } from '../js/spell.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const action of ['eat', 'study']) {
    void test(`${action} refreshes the turn display after travel during occupation steps`, async () => {
        freshObjectRoom({
            moves: 60, flags: { time: true, runmode: 'walk' },
            // findtravelpath() leaves run set after arrival, with no multi.
            context: { run: 8, mv: false },
            hero: { uhunger: 400, uhs: NOT_HUNGRY },
        });
        requirePlayingGame(game);
        game._moveloopStarted = true;
        game.u.umovement = 12;
        const item = await addInventoryObject(action === 'eat' ? FOOD_RATION : SPE_CONFUSE_MONSTER, { blessed: true, age: game.moves });
        if (action === 'study') {
            forceLearnSpell(SPE_CONFUSE_MONSTER);
            const spell = game.spells[0];
            assert.ok(spell);
            spell.know = 0;
        }
        const input = resetInputState();
        installPagerInput(input, { expected: /ration|memorize|knowledge/, limit: 4 });
        input.feed(item.invlet);
        await rhack((action === 'eat' ? 'e' : 'r').charCodeAt(0));
        await moveloop_core();
        const displayedTurn = game.moves;
        await moveloop_core();
        const status = game.nhDisplay?.grid[23]?.map(cell => cell.ch).join('');
        assert.match(status ?? '', new RegExp(`\\bT:${game.moves}\\b`));
        assert.equal(game.moves, displayedTurn + 1);
    });
}
//# sourceMappingURL=occupation_time.test.js.map