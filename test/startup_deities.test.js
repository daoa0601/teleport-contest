import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { convertQuestLine } from '../js/quest_pager.js';
import { memoryStorage } from './support/memory-storage.js';
for (const { role, alignment, expected } of [
    { role: 'Samurai', alignment: 'lawful', expected: 'Amaterasu Omikami: she, her, her' },
    { role: 'Ranger', alignment: 'neutral', expected: 'Venus: she, her, her' },
    { role: 'Knight', alignment: 'lawful', expected: 'Lugh: he, him, his' },
]) {
    void test(`${role} quest text uses the starting patron's pronouns after conversion`, async () => {
        await runSegment({
            seed: 17,
            datetime: '20260831120000',
            nethackrc: `OPTIONS=name:Patron,role:${role},race:human,gender:male,align:${alignment},!legacy,!tutorial,pettype:none`,
            moves: '',
            storage: memoryStorage(),
        });
        requirePlayingGame(game);
        game.u.ualign.type = -1;
        assert.equal(convertQuestLine('%d: %dh, %di, %dj'), expected);
    });
}
//# sourceMappingURL=startup_deities.test.js.map