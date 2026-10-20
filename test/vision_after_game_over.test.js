import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { launchRollingBoulder } from '../js/rolling_boulder.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';
function screenText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
void test('a boulder restored for bones after a fatal roll does not change the final view', async () => {
    freshObjectRoom({
        heroX: 10, right: 26,
        flags: { debug: true, bones: true, disclose: '-i -a -v -c -o', tombstone: false },
        hero: { uz: { dnum: 0, dlevel: 1 }, ulevel: 1, uhp: 1, uhpmax: 12 },
    });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.plname = 'ExitTester';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    await floorObject(BOULDER, 15, 10);
    vision_recalc(0);
    assert.equal(cansee(17, 10), false, 'the waiting boulder blocks the view behind it');
    const input = resetInputState();
    installPagerInput(input, { expected: /boulder|die|Goodbye|points|You were/i, limit: 8 });
    const pager = input.display;
    assert.ok(pager);
    let viewAtBonesPrompt = null;
    input.display = {
        async readKey() {
            const screen = screenText();
            if (screen.includes('Die? [yn] (n)'))
                return 'y'.charCodeAt(0);
            if (screen.includes('Save bones?')) {
                // C really_done() disables vision before it puts the
                // launched boulder back at its origin for bones.
                viewAtBonesPrompt = cansee(17, 10);
                return 'n'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };
    await launchRollingBoulder({ x: 15, y: 10 }, { x: 8, y: 10 }, {
        state: game, rollOne: () => 1, rollDice: () => 50,
    });
    assert.equal(game.program_state.gameover, true);
    assert.equal(viewAtBonesPrompt, true);
});
void test('a boulder placed during play blocks the view behind it', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    vision_recalc(0);
    assert.equal(cansee(14, 10), true);
    await floorObject(BOULDER, 12, 10);
    vision_recalc(0);
    assert.equal(cansee(14, 10), false);
});
//# sourceMappingURL=vision_after_game_over.test.js.map