import assert from 'node:assert/strict';
import test from 'node:test';

import { flush_screen, newsym } from '../js/display.js';
import { IRONBARS, PLNMSG_ENVELOPED_IN_GAS } from '../js/const.js';
import { makeBlinded } from '../js/sight_change.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { createGasCloudSelection, createHarmlessGasCloudSelection, createPoisonGasCloud, runLevelRegions } from '../js/regions.js';
import { pushKeys } from '../js/input.js';
import { CLR_BRIGHT_GREEN, CLR_CYAN, CLR_GRAY } from '../js/terminal.js';
import { cansee } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';

for (const symset of ['ASCII', 'DECgraphics']) {
    void test(`ordinary map rendering shows harmless gas in gray with ${symset} symbols`, async () => {
        freshObjectRoom();
        game.symset = symset;
        await createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }]);

        newsym(11, 10);
        await flush_screen(1);

        const cell = requireGameDisplay().grid[11]?.[10];
        assert.ok(cell);
        assert.equal(cell.ch, '#');
        assert.equal(cell.color, CLR_GRAY);
    });
}

void test('a newly created gas cloud redraws its visible floor before any later vision refresh', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    await flush_screen(1);

    await createPoisonGasCloud(game, 11, 10, 1, 8);
    await flush_screen(1);

    const cell = requireGameDisplay().grid[11]?.[10];
    assert.ok(cell);
    assert.equal(cell.ch, '#');
    assert.equal(cell.color, CLR_BRIGHT_GREEN);
    assert.equal(level.requireAt(11, 10).remembered_glyph?.kind, 'terrain');
});

void test('gas crossing iron bars preserves their visible and remembered terrain', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = IRONBARS;
    game.symset = 'DECgraphics';
    const cloud = await createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }]);
    assert.ok(cloud);
    cloud.damage = 8;
    cloud.heroFault = false;

    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireGameDisplay().grid[11]?.[10]?.ch, '#');
    await makeBlinded(1, { talk: false });
    await flush_screen(1);
    assert.equal(requireGameDisplay().grid[11]?.[10]?.color, CLR_CYAN);
});

void test('poison gas blindness updates sight before the next coughing message', async () => {
    freshObjectRoom({ hero: { poisonResistance: true } });
    pushKeys(' '.repeat(20));
    await createPoisonGasCloud(game, game.u.ux, game.u.uy, 1, 8);
    assert.equal(cansee(11, 10), true);

    await runLevelRegions(game);
    await flush_screen(1);

    assert.equal(game.u.blindTurns, 1);
    assert.equal(cansee(11, 10), false);
    assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '@');
});

void test('selection gas announces the hero only when a cloud first envelops them', async () => {
    freshObjectRoom();
    const messages: string[] = [];
    const publish = async (message: string) => { messages.push(message); };
    const cells = [{ x: game.u.ux, y: game.u.uy }];

    const cloud = await createGasCloudSelection(game, cells, 8, 5, publish);

    assert.ok(cloud);
    assert.equal(cloud.heroFault, true);
    assert.deepEqual(messages, ['You are enveloped in a cloud of noxious gas!']);
    assert.equal(game._lastPlineKind, PLNMSG_ENVELOPED_IN_GAS);
    await createGasCloudSelection(game, cells, 8, 0, publish);
    assert.equal(messages.length, 1);
    assert.equal(game._lastPlineKind, PLNMSG_ENVELOPED_IN_GAS);
});
