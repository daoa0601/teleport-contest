import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { canSpotMonster, flush_screen, map_invisible, swallowed } from '../js/display.js';
import { revealWarnedMonsters } from '../js/detect.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
function topline() {
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
import { freshObjectRoom } from './support/object-room.js';
for (const blind of [false, true]) {
    void test(`warning reveals a hidden adjacent piercer to a ${blind ? 'blind' : 'sighted'} hero during the turn`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        if (blind)
            await makeBlinded(10, { talk: false });
        grantIntrinsicProperty('warning', 'outside');
        const piercer = await createMonsterAt('iron piercer', 11, 10);
        piercer.mundetected = 1;
        piercer.mpeaceful = 0;
        piercer.m_lev = 8;
        piercer.mcanmove = 0;
        piercer.mfrozen = 20;
        vision_recalc(0);
        assert.equal(canSpotMonster(piercer), false);
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 0;
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => {
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            messages.push(text);
            input.feed(text.includes('--More--') ? ' ' : '.');
        };
        await moveloop_core();
        assert.equal(piercer.mundetected, 0);
        const displayed = messages.join('\n');
        assert.match(displayed, blind
            ? /Your danger sense causes you to take a second to check nearby\./
            : /Your danger sense causes you to take a second look close by\./);
        assert.match(displayed, blind ? /You feel an unseen monster!/ : /You find an iron piercer\./);
    });
}
void test('an engulfed hero\'s acknowledged danger sense message leaves the topline', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('warning', 'outside');
    const lurker = await createMonsterAt('lurker above', game.u.ux, game.u.uy);
    game.u.uswallow = 1;
    game.u.ustuck = lurker;
    swallowed(true);
    const piercer = await createMonsterAt('iron piercer', game.u.ux + 1, game.u.uy);
    piercer.mundetected = 1;
    piercer.mpeaceful = 0;
    piercer.m_lev = 8;
    vision_recalc(0);
    map_invisible(piercer.mx, piercer.my);
    assert.equal(canSpotMonster(piercer), false);
    await flush_screen(1);
    const input = resetInputState();
    const pages = [];
    input.beforeRead = () => {
        pages.push(topline());
        input.feed(' ');
    };
    await revealWarnedMonsters();
    await flush_screen(1);
    // C mfind0() returns -1 for a square already marked unseen, so no
    // later message replaces the line display_nhwindow() acknowledged.
    assert.equal(piercer.mundetected, 0);
    assert.deepEqual(pages, ['Your danger sense causes you to take a second look close by.--More--']);
    assert.equal(topline(), '');
});
//# sourceMappingURL=warning_reveal.test.js.map