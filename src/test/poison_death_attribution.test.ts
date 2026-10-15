import { advanceHeroSickness } from './support/condition-turn.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { A_STR, SICK_NONVOMITABLE } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { startHeroSickness } from '../js/hero_illness.js';
import { poisonHero } from '../js/poison.js';
import { LUMP_OF_ROYAL_JELLY } from '../js/object_data.js';
import { eatRoyalJelly } from '../js/royal_jelly.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('fatal cursed royal jelly uses an article in its poisoning record and tombstone', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 10 },
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, { cursed: true });
    const input = resetInputState();
    const pages: string[] = [];
    input.beforeRead = () => {
        pages.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
    };
    installPagerInput(input, { expected: /feel weak|die|poison|Goodbye|points|You were/i, limit: 8 });

    const result = await eatRoyalJelly(jelly);

    assert.equal(result.died, true);
    assert.equal(loadScoreRecords()[0]?.death, 'poisoned by a rotten lump of royal jelly');
    assert.ok(pages.some(page => /\|\s+poisoned by a\s+\|/.test(page)),
        'The tombstone includes the poisoning prefix and the killer article.');
    assert.ok(pages.some(page => page.includes('You were poisoned in The Dungeons of Doom')));
});

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
        const pages: string[] = [];
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
            assert.ok(pages.some(page => /\|\s+poisoned by\s+\|/.test(page)),
                'The tombstone must leave the proper name on its own row without an article.');
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

for (const { killer, cause } of [
    { killer: 'Juiblex', cause: 'Juiblex' },
    { killer: 'Oracle', cause: 'the Oracle' },
    { killer: 'rabid rat', cause: 'a rabid rat' },
]) {
    void test(`fatal illness from ${killer} keeps the native killer article`, async () => {
        freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
        requirePlayingGame(game);
        game.storage = memoryStorage();
        game.u.urexp = 100;
        game.iflags.toptenwin = false;
        const input = resetInputState();
        let tombstone = '';
        input.beforeRead = () => {
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (text.includes('REST')) tombstone = text;
        };
        installPagerInput(input, { expected: /sick|illness|Goodbye|points|You were/i, limit: 8 });
        await startHeroSickness({ turns: 1, cause: killer, type: SICK_NONVOMITABLE });

        const result = await advanceHeroSickness();

        assert.equal(result.died, true);
        assert.equal(loadScoreRecords()[0]?.death, `poisoned by ${cause}`);
        if (killer === 'Juiblex') assert.match(tombstone, /\|\s+poisoned by\s+\|/);
    });
}
