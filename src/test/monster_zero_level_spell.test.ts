import assert from 'node:assert/strict';
import test from 'node:test';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';

void test('a peaceful zero-level caster curses before continuing its movement', async () => {
    const caster = await prepareSpellCaster('kobold shaman', 0);
    caster.mpeaceful = 1;

    const messages = await finishSpellTurn(1);

    assert.match(messages, /kobold shaman points at you, then curses\./);
    assert.doesNotMatch(messages, /casts a spell/);
    assert.equal(caster.mspec_used ?? 0, 0);
});
