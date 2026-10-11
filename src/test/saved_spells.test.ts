import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import {
    CLUB, OBJECT_NAMES, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_FORCE_BOLT,
} from '../js/object_data.js';
import { saveGame, restoreGame } from '../js/save.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { forceLearnSpell } from '../js/spell.js';
import { selectSpellToCast } from '../js/spell_menu.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [description, type] of [
    ['negative object type', -1],
    ['missing object type', OBJECT_NAMES.length],
    ['ordinary weapon', CLUB],
    ['blank spellbook', SPE_BLANK_PAPER],
    ['Book of the Dead', SPE_BOOK_OF_THE_DEAD],
] as const) {
    void test(`restore rejects a memorized ${description} before changing live state`, async () => {
        const level = freshObjectRoom({ role: 'wizard' });
        game.plname = 'SavedSpells';
        forceLearnSpell(SPE_FORCE_BOLT);
        const hero = game.u;
        const spells = game.spells;
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const key = 'teleport-save:savedspells';
        const encoded = storage.getItem(key);
        assert.ok(encoded);
        const snapshot = decodeSavedGraph(encoded);
        assert.ok(isSavedRecord(snapshot) && isSavedRecord(snapshot.state));
        assert.ok(Array.isArray(snapshot.state.spells));
        const entries: unknown[] = snapshot.state.spells;
        const spell = entries[0];
        assert.ok(isSavedRecord(spell));
        spell.otyp = type;
        storage.setItem(key, encodeSavedGraph(snapshot));

        assert.equal(restoreGame(game.plname, storage), false);

        assert.equal(game.u, hero);
        assert.equal(game.level, level);
        assert.equal(game.spells, spells);
        assert.notEqual(storage.getItem(key), null);
    });
}

void test('a restored memorized spell remains selectable for casting', async () => {
    freshObjectRoom({ role: 'wizard' });
    game.plname = 'SavedSpells';
    forceLearnSpell(SPE_FORCE_BOLT);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    game.spells = [];

    assert.equal(restoreGame(game.plname, storage), true);
    const input = resetInputState();
    const selection = selectSpellToCast();
    await input.waitUntilBlocked();
    input.feed('a');
    const spell = await selection;

    assert.equal(spell?.otyp, SPE_FORCE_BOLT);
    assert.equal(spell, game.spells[0]);
});
