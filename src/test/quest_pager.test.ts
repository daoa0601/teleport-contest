import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { ensureQuestStatus } from '../js/quest.js';
import { freshObjectRoom } from './support/object-room.js';
import { convertQuestLine } from '../js/quest_pager.js';
import type { AlignmentValue, RoleKey } from '../js/roles.js';

function dungeonNamed(dname: string) {
    return {
        dname,
        num_dunlevs: 1, entry_lev: 1, dunlev_ureached: 1, depth_start: 1,
        flags: { maze_like: false, hellish: false, alignment: null },
        bonetag: undefined, protofile: undefined,
        levelFill: undefined, themeRooms: undefined,
    };
}

void test('quest text substitutions follow the native code table', () => {
    freshObjectRoom({ role: 'valkyrie', gameplaySeed: 11n });
    game.plname = 'Sigrid';
    game.u.ulevel = 14;
    game.u.ualign = { type: 1, record: 10 };
    game.u.ualignbase = [1, 1];
    game.dungeons = [dungeonNamed('The Dungeons of Doom')];
    const status = ensureQuestStatus(game);
    status.ldrgend = 1;

    // dat/quest.lua Val assignquest lines exercise the artifacts, ranks,
    // guardians, deities, pronouns, and possessives of convert_line().
    assert.equal(
        convertQuestLine('and unless %oh is returned into my care, %n may start Ragnarok.', game),
        'and unless it is returned into my care, Lord Surtur may start Ragnarok.',
    );
    assert.equal(
        convertQuestLine('had asked %d for a group of %gP', game),
        'had asked Tyr for a group of Warriors',
    );
    assert.equal(
        convertQuestLine('you will find %ns lair', game),
        "you will find Lord Surtur's lair",
    );
    assert.equal(
        convertQuestLine('you %x about the hill', game),
        'you see about the hill',
    );
    assert.equal(
        convertQuestLine('only when you have returned %Ra', game),
        'only when you have returned a Warrior',
    );
    assert.equal(
        convertQuestLine('%lh summons you, %p, and %c answers.', game),
        'she summons you, Sigrid, and Valkyrie answers.',
    );
    assert.equal(convertQuestLine('100%% of %Z', game), '100% of The Dungeons of Doom');
});

void test('quest guardians are named without an article in singular and plural', () => {
    freshObjectRoom({ role: 'valkyrie', gameplaySeed: 11n });

    assert.equal(convertQuestLine('%g; %gp; %gP', game), 'warrior; warriors; Warriors');
});

const deityCases: {
    role: RoleKey;
    alignment: AlignmentValue;
    deity: string;
    title: 'god' | 'goddess';
}[] = [
    { role: 'caveman', alignment: 0, deity: 'Ishtar', title: 'goddess' },
    { role: 'ranger', alignment: 0, deity: 'Venus', title: 'goddess' },
    { role: 'tourist', alignment: 0, deity: 'The Lady', title: 'goddess' },
    { role: 'valkyrie', alignment: 1, deity: 'Tyr', title: 'god' },
];

for (const { role, alignment, deity, title } of deityCases) {
    void test(`quest text addresses ${deity} as a ${title} after an alignment change`, () => {
        freshObjectRoom({ role, gameplaySeed: 11n });
        game.u.ualignbase = [alignment, alignment];
        game.u.ualign = { type: -1, record: 0 };

        // dat/quest.lua uses the original deity even after conversion.
        assert.equal(
            convertQuestLine('Your %G %d seeks to possess the Amulet, and with it', game),
            `Your ${title} ${deity} seeks to possess the Amulet, and with it`,
        );
    });
}
