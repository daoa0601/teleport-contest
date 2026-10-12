import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME, SPECIAL_PM, monsterClassSymbol } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('Rogue-level sandestins retry lowercase forms before changing shape', async () => {
    for (let seed = 1n; seed <= 64n; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        const sandestin = await createMonsterAt('sandestin', 13, 10, NO_MINVENT);
        await changeMonsterForm(sandestin, MONSTER_NAME.indexOf('sandestin'), game);
        game.rogue_level = { ...game.u.uz };
        initRng(seed);

        const change = await changeMonsterForm(sandestin, null, game);

        assert.ok(change, `a form is available, seed ${seed}`);
        assert.match(monsterClassSymbol(sandestin.mnum), /^[A-Z]$/, `preferred Rogue form, seed ${seed}`);
    }
});

void test('a Rogue-level sandestin can fall back to lowercase when uppercase forms are genocided', async () => {
    let changed = 0;
    for (let seed = 1n; seed <= 16n; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        const sandestin = await createMonsterAt('sandestin', 13, 10, NO_MINVENT);
        await changeMonsterForm(sandestin, MONSTER_NAME.indexOf('sandestin'), game);
        game.rogue_level = { ...game.u.uz };
        for (let species = 0; species < SPECIAL_PM; species++) {
            if (/^[A-Z]$/.test(monsterClassSymbol(species)))
                requireMonsterVital(species).mvflags = G_GENOD;
        }
        initRng(seed);

        const change = await changeMonsterForm(sandestin, null, game);

        if (change) {
            changed++;
            assert.doesNotMatch(monsterClassSymbol(sandestin.mnum), /^[A-Z]$/, `fallback form, seed ${seed}`);
        }
    }
    assert.ok(changed > 0, 'lowercase forms remain available after the Rogue preference expires');
});
