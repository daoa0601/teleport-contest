import test from 'node:test';
import assert from 'node:assert/strict';

// C dothrow.c:hurtle() (dothrow.c:1112-1114) sets nomul(-range) with
// gm.multi_reason "moving through the air"; the delay lasts until the
// world loop's negative-multi handling runs it out, so a monster killing
// the hurtling hero still reaches done() with gm.multi below zero. Every
// C topten.c:formatkiller() caller with incl_helpless TRUE then appends
// ", while moving through the air": dungeon.c:3709 puts it on the final
// disclosure's own "Final resting place for you, ..." line (before the
// strsubst() rephrasing), end.c:1317 on the grave engraving, and
// topten.c:694 in the score entry. rip.c:113 (the tombstone) passes
// incl_helpless FALSE, so the stone itself omits the delay.

import { performMonsterHeroAttack } from '../js/mhitu.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_EXTRA_HEALING } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { hurtleHero } from '../js/dothrow.js';
import { finishOrdinaryDeath } from '../js/end.js';
import { engravingAt } from '../js/engrave.js';
import { loadScoreRecords } from '../js/topten.js';
import { addInventoryObject } from './support/game-objects.js';
import { throwInventoryObject } from './support/commands.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { createDungeon } from './support/topology.js';
import type { OverviewRecord } from '../js/dungeon_types.js';

function screenText(): string {
    return (game.nhDisplay?.grid ?? []).map(row => row.map(cell => cell.ch).join('')).join('\n');
}

// Pages the ending like a player: disclosure questions default to no
// (the overview answers yes), every pager and menu page takes a space.
function endingReader(screens: string[]) {
    const input = resetInputState();
    let reads = 0;
    input.beforeRead = () => {
        screens.push(screenText());
    };
    input.display = {
        async readKey(): Promise<number> {
            assert.ok(++reads <= 80, `The ending keeps waiting for input:\n${screenText()}`);
            const question = game._pending_message || '';
            if (/\? \[yn/.test(question)) {
                return (question.includes('dungeon overview') ? 'y' : 'n').charCodeAt(0);
            }
            if (/Save bones\?/.test(screenText())) return 'y'.charCodeAt(0);
            return ' '.charCodeAt(0);
        },
    };
    return input;
}

void test('a monster killing a hurtling hero names the delay on the disclosure and score entry', async () => {
    await freshObjectRoom({
        hero: { uhp: 1, uhpmax: 100, uac: 10, urexp: 100 },
        flags: { bones: false, disclose: '-i -a -v -c o', tombstone: true },
    });
    requirePlayingGame(game);
    game.plname = 'Floater';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    // A deep, fully visited dungeon renders the final disclosure as the
    // session-scale full-screen menu, so the long cause row fits one line.
    const visitedLevels = new Map<string, OverviewRecord>();
    for (const dlevel of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
        visitedLevels.set(`0:${dlevel}`, {
            flags: { notreachable: false, forgot: false, sokosolved: false,
                bigroom: false, roguelevel: false, oracle: false, castle: false,
                castletune: false, ludios: false, valley: false, msanctum: false,
                vibrating_square: false, quest_summons: false, questing: false },
            features: { nshop: 0, shoptype: 0, nfount: 0, nsink: 0, naltar: 0,
                altarAlignment: null, ntemple: 0, nthrone: 0, ngrave: 0, ntree: 0 },
            branch: null, seenRooms: [], untendedRooms: [],
        });
    }
    game._overviewRecords = visitedLevels;
    // A giant mummy one square east catches the recoil of a westward throw
    // (dothrow.c:1681-1682): the levitating hero floats into it, stops
    // adjacent, and the fatal attack lands while the hero is still
    // "moving through the air".
    const mummy = await createMonsterAt('giant mummy', 11, 10);
    mummy.mpeaceful = 0;
    mummy.m_lev = 20;
    mummy.mux = game.u.ux;
    mummy.muy = game.u.uy;
    grantIntrinsicProperty('levitation', 'outside');
    const potion = await addInventoryObject(POT_EXTRA_HEALING);
    initRng(1n);
    const screens: string[] = [];
    endingReader(screens);

    await throwInventoryObject(potion, 'h', []);
    assert.ok((game._helplessTurns ?? 0) > 0,
        'The throw recoil must leave the hero moving through the air');

    const { heroDied } = await performMonsterHeroAttack(mummy, game, {
        random: () => 0, rollOne: () => 1, rollDice: () => 1,
    });
    assert.equal(heroDied, true);
    assert.equal(game.program_state.gameover, true);

    const disclosure = screens.find(screen => screen.includes('Final resting place'));
    assert.ok(disclosure, `The final disclosure must show the overview:\n${screens.at(-1) ?? ''}`);
    assert.match(disclosure, /you, killed by a giant mummy, while moving through the air\./);
    const tombstone = screens.filter(screen => /REST/.test(screen)).join('\n');
    assert.match(tombstone, /killed by a/);
    assert.doesNotMatch(tombstone, /while moving/,
        'rip.c:113 formats the stone without the helplessness (incl_helpless FALSE)');
    assert.equal(loadScoreRecords()[0]?.death,
        'killed by a giant mummy, while moving through the air');
});

void test('the grave over a hurtling victim carries the delay in its engraving', async () => {
    await freshObjectRoom({
        hero: { uhp: 1, uhpmax: 100, urexp: 100 },
        flags: { bones: true, disclose: '-i -a -v -c -o', tombstone: false },
    });
    requirePlayingGame(game);
    game.plname = 'Floater';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({
        dname: 'The Dungeons of Doom', num_dunlevs: 20, bonetag: 'D',
    })];
    game.flags.debug = true;
    game._canMakeBones = true;
    initRng(1n);
    endingReader([]);

    await hurtleHero(1, 0, 1);
    assert.equal(game._helplessReason, 'moving through the air');

    await finishOrdinaryDeath({ killer: 'a soldier ant', deathCause: 'killed by a soldier ant' });

    assert.equal(game.program_state.gameover, true);
    // end.c:1316-1318 formats "<plname>, " plus formatkiller() with the
    // remaining buffer (BUFSZ minus the name) under incl_helpless TRUE.
    assert.equal(engravingAt(game.u.ux, game.u.uy)?.text,
        'Floater, killed by a soldier ant, while moving through the air');
});
