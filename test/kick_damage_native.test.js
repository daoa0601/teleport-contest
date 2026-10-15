import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CON, A_DEX, A_STR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { kickDirection } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('exceptional strength uses the native 3 to 25 scale for kick damage', async () => {
    for (let seed = 1n; seed <= 10n; seed++) {
        freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        game.u.acurr.a[A_STR] = 125;
        game.u.acurr.a[A_DEX] = game.u.acurr.a[A_CON] = 3;
        const lichen = await createMonsterAt('lichen', 11, 10);
        lichen.mhp = lichen.mhpmax = 100;
        lichen.mpeaceful = 0;
        initRng(seed);
        await kickDirection('l', ' '.repeat(10));
        const damage = 100 - lichen.mhp;
        assert.ok(damage >= 1 && damage <= 2, `Native kick damage is 1..2; seed ${seed} dealt ${damage}.`);
    }
});
void test('sasquatch feet use martial kicking without straining a muscle', async () => {
    for (let seed = 1n; seed <= 10n; seed++) {
        freshPlayableRoom({ seed });
        requirePlayingGame(game);
        game.u.mh = game.u.mhmax = 100;
        game.u.mtimedone = 100;
        setHeroSpecies(MONSTER_NAME.indexOf('sasquatch'));
        game.u.acurr.a[A_DEX] = 3;
        await kickDirection('l', ' '.repeat(10));
        assert.equal(game._pending_message, 'You kick at empty space.');
        assert.equal(game.u._woundedLegTurns ?? 0, 0);
    }
});
void test('a shade lets an ordinary kick pass harmlessly through', async () => {
    freshPlayableRoom();
    const shade = await createMonsterAt('shade', 11, 10);
    shade.mpeaceful = 0;
    shade.minvis = 0;
    const health = shade.mhp;
    await kickDirection('l', ' '.repeat(10));
    assert.equal(shade.mhp, health);
    assert.equal(game._lastPlineMessage, 'The kick passes harmlessly through.');
});
//# sourceMappingURL=kick_damage_native.test.js.map