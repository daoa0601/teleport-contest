import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { moveloop_core } from '../js/allmain.js';
import { pushKeys } from '../js/input.js';
import { msummon } from '../js/minion.js';
import { MONSTER_FLAGS2 } from '../js/monster_data.js';
import { runMonsterAction } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshGameplayRoom, freshTurnRoom } from './support/playable-room.js';

const M2_DEMON = 0x00000100;

for (const cancelled of [false, true]) {
    void test(`a ${cancelled ? 'cancelled demon cannot summon' : 'demon can summon'} help during an attack`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        requirePlayingGame(game);
        const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
        demon.mpeaceful = false;
        demon.mcan = cancelled;
        pushKeys(' '.repeat(40));

        await runMonsterAction(demon, game, () => 0, count => count, () => 1);

        const summoned = game.level.monsters.filter(monster => monster !== demon);
        assert.equal(summoned.length > 0, !cancelled);
        assert.ok(summoned.every(monster => (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DEMON));
        assert.ok(game.u.uhp < game.u.uhpmax, 'the demon should also attack');
    });
}

void test('the Wizard summons demons beside the hero', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    initRng(1n);

    const result = await msummon();

    assert.equal(result.count, 2);
    assert.ok(result.created.every(monster =>
        ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DEMON)
        && Math.max(
            Math.abs(monster.mx - game.u.ux),
            Math.abs(monster.my - game.u.uy),
        ) === 1));
});

for (const [seed, summonsDemons] of [[3, false], [18, true]] satisfies [number, boolean][]) {
    void test(`a monster spell summons ${summonsDemons ? 'demons' : 'nasty monsters'} during its turn in Gehennom`, async () => {
        freshTurnRoom();
        requirePlayingGame(game);
        game.dungeons = [{
            dname: 'Gehennom', num_dunlevs: 20, entry_lev: 1, dunlev_ureached: 1, depth_start: 1,
            flags: { hellish: true, maze_like: false, alignment: null },
            bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
        }];
        game.u.uhp = game.u.uhpmax = 2000;
        const wizard = await createMonsterAt('Wizard of Yendor', 12, 10,
            MM_NOWAIT | NO_MINVENT);
        wizard.mpeaceful = false;
        wizard.msleeping = 0;
        wizard.movement = 12;
        initRng(BigInt(seed));
        pushKeys('m.' + ' '.repeat(200) + 'm.');

        await moveloop_core();
        await moveloop_core();

        const summoned = game.level.monsters.filter(monster => monster !== wizard);
        assert.ok(summoned.length > 0);
        assert.equal(summoned.every(monster => (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DEMON),
            summonsDemons);
    });
}
