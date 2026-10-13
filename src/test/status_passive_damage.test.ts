import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroContactPassive } from '../js/monster_passive.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

for (const polymorphed of [false, true]) {
    void test(`the Oracle's passive damage updates ${polymorphed ? 'monster-form' : 'human'} HP on the next screen flush`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        if (polymorphed) installPolymorphedHero('wolf', { hitPoints: 40 });
        const oracle = await createMonsterAt('Oracle', 11, 10, NO_MINVENT);
        await bot();

        await applyHeroContactPassive(oracle, { hit: true });
        const hp = polymorphed ? game.u.mh : game.u.uhp;
        const maximum = polymorphed ? game.u.mhmax : game.u.uhpmax;
        await flush_screen(1);

        assert.ok(hp > 0 && hp < 40, 'the missiles should injure the hero');
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''),
            new RegExp(`HP:${hp}\\(${maximum}\\)`));
    });
}
