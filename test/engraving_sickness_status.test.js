import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { ENGRAVE, SICK_VOMITABLE } from '../js/const.js';
import { bot } from '../js/display.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
void test('an engraving that stops a run redraws expired food poisoning before the death message', async () => {
    const input = freshTurnRoom({
        flags: { time: true, bones: false, disclose: '-i -a -v -g -c -o' },
        hero: {
            sick: true, sickTurns: 1, sickType: SICK_VOMITABLE,
            sickCause: 'rotted jackal corpse',
        },
    });
    makeEngravingAt(11, 10, 'turn back', null, 0, ENGRAVE);
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /FoodPois/);
    const pages = [];
    installPagerInput(input, { expected: /./, limit: 10, pages });
    input.feed('L');
    await moveloop_core();
    await moveloop_core();
    const engravingPage = pages.find(page => /You read: "turn back"\.--More--/.test(page));
    assert.ok(engravingPage, 'The fatal message must page the engraving first.');
    assert.doesNotMatch(engravingPage.split('\n')[23] ?? '', /FoodPois/);
    assert.equal(game.program_state.gameover, true);
    const deathPage = pages.find(page => /You die from your illness\.--More--/.test(page));
    assert.ok(deathPage, 'The fatal sickness must reach the death message.');
    assert.match(deathPage.split('\n')[23] ?? '', /FoodPois/);
});
//# sourceMappingURL=engraving_sickness_status.test.js.map