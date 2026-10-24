import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mkstairs } from '../js/mklev.js';
import { applyLevitationPotion } from '../js/levitation_potion.js';
import { POT_LEVITATION } from '../js/object_data.js';
import { refreshProperty } from '../js/properties.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { knownObject } from './support/game-objects.js';
for (const up of [false, true]) {
    void test(`${up ? 'ascending' : 'descending'} cannot use stairs covered by a newer stair in the other direction`, async () => {
        const { source } = freshConnectedLevels({ destinationDepth: 3 });
        requirePlayingGame(game);
        const older = game.stairs;
        assert.ok(older);
        older.up = up;
        game.u.uz = { dnum: 0, dlevel: up ? 4 : 2 };
        const dungeon = game.dungeons[0];
        assert.ok(dungeon);
        dungeon.num_dunlevs = 5;
        await mkstairs(game.u.ux, game.u.uy, !up, null, true);
        resetInputState().feed(' '.repeat(10));
        await rhack((up ? '<' : '>').charCodeAt(0));
        assert.ok(game.level === source, 'the first stair at this square determines its direction');
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, `You can't go ${up ? 'up' : 'down'} here.`);
        assert.equal(older.u_traversed, false);
    });
}
void test('levitating above newer upstairs does not reveal an older downward ladder', async () => {
    freshConnectedLevels({ ladder: true });
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 2 };
    await mkstairs(game.u.ux, game.u.uy, true, null, true);
    game.u.levitationTurns = 10;
    refreshProperty('levitation');
    await rhack('>'.charCodeAt(0));
    assert.equal(game._pending_message, 'You are floating high above the stairs.');
    assert.equal(game.context.move, 0);
});
void test('cursed levitation hits the ceiling when newer downstairs cover older upstairs', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    assert.ok(game.stairs);
    game.stairs.up = true;
    game.u.uz = { dnum: 0, dlevel: 3 };
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.num_dunlevs = 4;
    await mkstairs(game.u.ux, game.u.uy, false, null, true);
    const hp = game.u.uhp;
    const potion = await knownObject(POT_LEVITATION, { cursed: true });
    resetInputState().feed(' '.repeat(10));
    await applyLevitationPotion(potion);
    assert.ok(game.level === source);
    assert.ok(game.u.uhp < hp, 'hitting the ceiling causes damage');
    assert.match(game._pending_message, /You hit your head on the ceiling\./);
});
//# sourceMappingURL=stairs_lookup.test.js.map