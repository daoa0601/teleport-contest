import assert from 'node:assert/strict';
import test from 'node:test';

import { finishOrdinaryDeath } from '../js/end.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishMonsterAttackDeath } from '../js/monster_attack_death.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { loadScoreRecords } from '../js/score_records.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { installPagerInput } from './support/pager-input.js';

function visibleText(): string {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

void test('an invisible monster keeps its invisibility in the tombstone and score entry', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
    requirePlayingGame(game);
    const xorn = await createMonsterAt('xorn', 11, 10);
    xorn.minvis = true;
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    const input = resetInputState();
    let tombstone = '';
    input.beforeRead = () => {
        if (visibleText().includes('REST')) tombstone = visibleText();
    };
    installPagerInput(input, { expected: /die|Goodbye|points|You were/i, limit: 8 });

    await finishMonsterAttackDeath(xorn);

    assert.match(tombstone, /killed by an/);
    assert.match(tombstone, /invisible xorn/);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by an invisible xorn');
});

void test('a named monster death sanitizes punctuation on the tombstone and score entry', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
    requirePlayingGame(game);
    const xorn = await createMonsterAt('xorn', 11, 10);
    setMonsterGivenName(xorn, 'Bob,=Joe');
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    const input = resetInputState();
    let tombstone = '';
    input.beforeRead = () => {
        if (visibleText().includes('REST')) tombstone = visibleText();
    };
    installPagerInput(input, { expected: /die|Goodbye|points|You were/i, limit: 8 });

    await finishMonsterAttackDeath(xorn);

    assert.match(tombstone, /Bob;_Joe/);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a xorn called Bob;_Joe');
});

void test('a death while fainted includes helplessness in the score but leaves the tombstone cause concise', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: true } });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    game._helplessTurns = 7;
    game._helplessReason = 'fainted from lack of food';
    const input = resetInputState();
    let tombstone = '';
    input.beforeRead = () => {
        if (visibleText().includes('REST')) tombstone = visibleText();
    };
    installPagerInput(input, { expected: /Goodbye|points|You were/i, limit: 8 });

    await finishOrdinaryDeath({ killer: 'fox' });

    assert.match(tombstone, /killed by a fox/);
    assert.doesNotMatch(tombstone, /fainted/);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by a fox, while fainted from lack of food');
});

for (const { causeLength, expectedSuffix } of [
    { causeLength: 64, expectedSuffix: ', while paralyzed by a floating eye' },
    { causeLength: 65, expectedSuffix: ', while helpless' },
    { causeLength: 83, expectedSuffix: ', while helpless' },
    { causeLength: 84, expectedSuffix: '' },
    { causeLength: 110, expectedSuffix: '' },
]) {
    void test(`a helpless death with a ${causeLength}-character cause fits the native score field`, async () => {
        freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
        requirePlayingGame(game);
        game.storage = memoryStorage();
        game.u.urexp = 100;
        game.iflags.toptenwin = false;
        game._helplessTurns = 7;
        game._helplessReason = 'paralyzed by a floating eye';
        const prefix = 'killed by an orc called ';
        const cause = prefix + 'O'.repeat(causeLength - prefix.length);
        const input = resetInputState();
        installPagerInput(input, { expected: /Goodbye|points|You were/i, limit: 8 });

        await finishOrdinaryDeath({ killer: 'orc', deathCause: cause });

        assert.equal(loadScoreRecords()[0]?.death, cause.slice(0, 100) + expectedSuffix);
    });
}
