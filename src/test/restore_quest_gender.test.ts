import assert from 'node:assert/strict';
import test from 'node:test';

import { game, resetGame } from '../js/gstate.js';
import { ensureQuestStatus } from '../js/quest.js';
import { convertQuestLine } from '../js/quest_pager.js';
import { initRng } from '../js/rng.js';
import type { RoleKey } from '../js/roles.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';

const cases: {
    name: string;
    role: RoleKey;
    leaderGender: number;
    nemesisGender: number;
    text: string;
}[] = [
    {
        name: 'a female Wizard nemesis', role: 'wizard',
        leaderGender: 0, nemesisGender: 1,
        text: 'He guides you. She challenges you with her magic.',
    },
    {
        name: 'a male Wizard nemesis', role: 'wizard',
        leaderGender: 0, nemesisGender: 0,
        text: 'He guides you. He challenges you with his magic.',
    },
    {
        name: 'the female Valkyrie leader', role: 'valkyrie',
        leaderGender: 1, nemesisGender: 0,
        text: 'She guides you. He challenges you with his magic.',
    },
];

// C restgamestate() loads q_score after role_init(), so saved quest genders
// govern questpgr.c:qtext_pronoun() even after restore rolls new genders.
for (const { name, role, leaderGender, nemesisGender, text } of cases) {
    void test(`restoring preserves the saved quest pronouns for ${name}`, async () => {
        freshObjectRoom({ role });
        game.plname = 'Questor';
        const quest = ensureQuestStatus();
        quest.ldrgend = leaderGender;
        quest.nemgend = nemesisGender;
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);

        resetGame();
        initRng(1);
        assert.equal(restoreGame('Questor', storage), true);

        assert.equal(game.quest_status?.ldrgend, leaderGender,
            'Restoring must retain the saved quest leader gender.');
        assert.equal(game.quest_status?.nemgend, nemesisGender,
            'Restoring must retain the saved quest nemesis gender.');
        assert.equal(
            convertQuestLine('%lH guides you. %nH challenges you with %nj magic.'),
            text,
        );
    });
}
