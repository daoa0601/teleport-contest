import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRE_TRAP, MOAT, STAIRS, VIBRATING_SQUARE } from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mklev } from '../js/mklev.js';
import { BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, SPE_BOOK_OF_THE_DEAD } from '../js/object_data.js';
import { readBookOfDead } from '../js/special_spellbooks.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { freshSpecialLevel } from './support/special-level.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
void test('reading the prepared invocation book shows the fire ring before the moat and stairwell', async () => {
    freshSpecialLevel({ prototype: 'unused', seed: 12, depth: 8 });
    requirePlayingGame(game);
    game.flags.bones = false;
    game.specialLevels?.clear();
    game._activeSpecialLevel = null;
    game.dungeons[0] = createDungeon({ dname: 'Gehennom', num_dunlevs: 9,
        depth_start: 25, flags: { hellish: true } });
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    await mklev();
    const level = game.level;
    const square = level.traps.find(trap => trap.ttyp === VIBRATING_SQUARE);
    assert.ok(square, 'the penultimate Gehennom level must contain the invocation square');
    game.u.ux = square.tx;
    game.u.uy = square.ty;
    level.monsters = [];
    game.nhDisplay = new GameDisplay(null);
    vision_reset();
    vision_recalc(0);
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD, { initialize: false });
    await addInventoryObject(BELL_OF_OPENING, { initialize: false, age: game.moves - 4 });
    await addInventoryObject(CANDELABRUM_OF_INVOCATION, { initialize: false, spe: 7, lamplit: true });
    game.u.uhave.bell = game.u.uhave.menorah = true;
    installPagerInput(resetInputState(), {
        expected: /Book of the Dead|floor shakes violently|walls around you|stairwell leading down/,
        limit: 8,
    });
    let sawFireBeforeMoat = false;
    let sawMoatBeforeStairs = false;
    game.animationFrame = async () => {
        const moat = level.requireAt(square.tx + 4, square.ty).typ === MOAT;
        if (level.traps.some(trap => trap.ttyp === FIRE_TRAP) && !moat)
            sawFireBeforeMoat = true;
        if (moat && level.requireAt(square.tx, square.ty).typ !== STAIRS)
            sawMoatBeforeStairs = true;
    };
    await readBookOfDead(book);
    assert.ok(sawFireBeforeMoat, 'the fire ring must be visible while the moat is still forming');
    assert.ok(sawMoatBeforeStairs, 'the moat must be visible before the final stairwell announcement');
    assert.equal(level.requireAt(square.tx, square.ty).typ, STAIRS);
    assert.equal(game.u.uevent?.invoked, 1);
});
//# sourceMappingURL=mklev_invocation.test.js.map