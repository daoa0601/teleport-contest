import assert from 'node:assert/strict';
import test from 'node:test';
import { finishOrdinaryDeath } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';

void test('a first-turn death gives its parting message before the bones question', async () => {
    freshObjectRoom({ moves: 1, flags: {
        debug: true, disclose: '-i -a -v -g -c -o', tombstone: false,
    } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    const input = resetInputState();
    const ending = finishOrdinaryDeath({ killer: 'molten lava' });
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    try {
        assert.match(text, /Do not pass Go\.  Do not collect 200 zorkmids\.--More--/);
    } finally {
        input.feed(' n' + ' '.repeat(10));
        await ending;
    }
});

void test('a hallucinating first-turn death names fictional currency in the parting message', async () => {
    freshObjectRoom({ moves: 1, hero: { hallucinationTurns: 20 }, flags: {
        debug: true, bones: false, disclose: '-i -a -v -g -c -o', tombstone: false,
    } });
    initRng(1n);
    const input = resetInputState();
    const ending = finishOrdinaryDeath({ killer: 'molten lava' });
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    try {
        assert.match(text, /Do not pass Go\.  Do not collect 200 [^.]+\./);
        assert.doesNotMatch(text, /200 zorkmids/);
    } finally {
        input.feed(' '.repeat(20));
        await ending;
    }
});

