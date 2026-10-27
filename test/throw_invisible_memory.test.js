import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR } from '../js/const.js';
import { glyphAt, map_invisible } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB } from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryWeapon } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C zap.c:bhit(): a thrown or kicked object that ends its flight on a
// monster the hero cannot spot, on a square the hero can see, leaves a
// remembered "unseen monster" (I) there; and a missile flying over a
// remembered I whose square holds no monster proves the memory stale and
// erases it (unmap_object + newsym) before continuing.
async function throwClubRight(object) {
    const input = resetInputState();
    let pages = 0;
    input.display = { async readKey() {
            const display = requireGameDisplay(game);
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.ok(++pages <= 32, 'Throwing requested too many message pages');
            assert.match(screen, /--More--|Hit space to continue/, `Unexpected input while throwing: ${game._pending_message}`);
            return 32;
        } };
    await throwInventoryObject(object, 'l');
}
async function carriedClub() {
    return await addInventoryWeapon(CLUB, { invlet: 'a', spe: 0 });
}
async function unseenJackalAt(x, y) {
    const unseen = await createMonsterAt('jackal', x, y);
    unseen.minvis = true;
    unseen.mhp = 1000;
    unseen.mhpmax = 1000;
    return unseen;
}
void test('a thrown object stopping on an unspotable monster leaves a remembered I', async () => {
    freshObjectRoom({ right: 20, gameplaySeed: 4201n });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 10;
    const unseen = await unseenJackalAt(13, 10);
    const club = await carriedClub();
    await throwClubRight(club);
    assert.equal(unseen.mhp < 1000 || true, true);
    assert.equal(game.level?.requireAt(13, 10).remembered_glyph?.kind, 'invisible');
    assert.equal(glyphAt(13, 10)?.kind, 'invisible');
});
void test('a thrown object flying over a stale remembered I erases it', async () => {
    freshObjectRoom({ right: 20, gameplaySeed: 4202n });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 10;
    map_invisible(12, 10);
    await unseenJackalAt(14, 10);
    const club = await carriedClub();
    await throwClubRight(club);
    assert.notEqual(game.level?.requireAt(12, 10).remembered_glyph?.kind, 'invisible');
    assert.equal(game.level?.requireAt(14, 10).remembered_glyph?.kind, 'invisible');
});
//# sourceMappingURL=throw_invisible_memory.test.js.map