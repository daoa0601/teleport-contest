import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { addTrap } from './support/level-state.js';
import { MAGIC_PORTAL } from '../js/const.js';

// C do.c:goto_level() delivers the special-level arrival message
// (deliver_splev_message(), do.c:1858) before the Valley lines and
// familiar_level_msg(), and only then runs the location branch chain whose
// quest case is onquest() (do.c:1892).  The special message is freed once
// delivered, so a later return to the level cannot repeat it.
function questArrivalRoom(): { capture: string[]; topline: string[] } {
    const { source, destination } = freshConnectedLevels({ role: 'healer' });
    const cache = game._levelCache;
    assert.ok(cache);
    game.dungeons.push(createDungeon({ dname: 'The Quest' }));
    game.quest_dnum = 1;
    game.branches = [{ end1: { dnum: 0, dlevel: 1 }, end2: { dnum: 1, dlevel: 1 },
        type: 'portal', portal: true, end1_up: false }];
    cache.set('1:1', {
        level: destination,
        stairs: { sx: 12, sy: 10, up: true, isladder: false, u_traversed: false,
            tolev: { dnum: 0, dlevel: 1 }, next: null },
        heroTrack: [], savedAt: game.moves,
        activeSpecialLevel: {
            prototype: 'Hea-strt', file: 'Hea-strt.lua',
            specialMessages: ['Well done, mortal!'],
        },
    });
    cache.delete('0:2');
    game.specialLevels = new Map([['x-strt', createSpecialLevel({ dnum: 1, dlevel: 1 })]]);
    addTrap(destination, MAGIC_PORTAL, 12, 10);

    const capture: string[] = [];
    const topline: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        if (game._pending_message) {
            capture.push(game._pending_message);
            topline.push(game._pending_message);
        }
        const screen = game.nhDisplay?.grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
        if (screen.trim()) capture.push(screen);
        input.feed(' ');
    };
    return { capture, topline };
}

void test('a special-level arrival message precedes the quest homecoming text', async () => {
    const { capture } = questArrivalRoom();

    await gotoLevel({ dnum: 1, dlevel: 1 }, { arrival: 'portal' });

    const joined = capture.join('\n');
    const splev = joined.indexOf('Well done, mortal!');
    const quest = joined.search(/What sorcery/);
    assert.ok(splev >= 0, 'the level entry message must print (deliver_splev_message, do.c:1858)');
    assert.ok(quest >= 0, 'the quest homecoming text must print (onquest, do.c:1892)');
    assert.ok(splev < quest,
        'the level entry message precedes the quest pager text (do.c:1858 before do.c:1892)');
});

void test('a special-level arrival message prints once, not again on return', async () => {
    const { topline } = questArrivalRoom();

    await gotoLevel({ dnum: 1, dlevel: 1 }, { arrival: 'portal' });
    await gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'portal' });
    await gotoLevel({ dnum: 1, dlevel: 1 }, { arrival: 'portal' });

    const repeats = topline.join('\n').split('Well done, mortal!').length - 1;
    assert.equal(repeats, 1,
        'deliver_splev_message() frees its message, so a cached return stays silent');
});
