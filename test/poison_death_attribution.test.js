import assert from 'node:assert/strict';
import test from 'node:test';
import { A_STR } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { poisonHero } from '../js/poison.js';
import { loadScoreRecords } from '../js/score_records.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const { killer, cause } of [
    { killer: 'Juiblex', cause: 'Juiblex' },
    { killer: 'Oracle', cause: 'the Oracle' },
    { killer: 'giant spider', cause: 'a giant spider' },
    { killer: 'an arrow', cause: 'an arrow' },
]) {
    void test(`fatal poison from ${killer} preserves the killer article and poisoning outcome`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 10 },
            flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
        requirePlayingGame(game);
        game.storage = memoryStorage();
        game.u.urexp = 100;
        game.iflags.toptenwin = false;
        const input = resetInputState();
        const pages = [];
        input.beforeRead = () => {
            pages.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
        };
        installPagerInput(input, { expected: /die|poison|Goodbye|points|You were/i, limit: 8 });
        const result = await poisonHero({ reason: 'poison', killer, attribute: A_STR,
            random: () => 0, rollDice: () => 4 });
        assert.equal(result.died, true);
        assert.equal(loadScoreRecords()[0]?.death, `poisoned by ${cause}`);
        assert.ok(pages.some(page => page.includes('You were poisoned in The Dungeons of Doom')));
        assert.ok(pages.some(page => page.includes('when you were poisoned.')));
        if (killer === 'Juiblex') {
            assert.ok(pages.some(page => /\|\s+poisoned by\s+\|/.test(page)), 'The tombstone must leave the proper name on its own row without an article.');
        }
    });
}
void test('ordinary poison HP damage attributes a unique killer without changing the death to poisoning', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 10 },
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    const input = resetInputState();
    installPagerInput(input, { expected: /die|Goodbye|points|You were/i, limit: 8 });
    const result = await poisonHero({ reason: 'poison', killer: 'Juiblex', attribute: A_STR,
        random: () => 6 });
    assert.equal(result.died, true);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by Juiblex');
});
//# sourceMappingURL=poison_death_attribution.test.js.map