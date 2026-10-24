import assert from 'node:assert/strict';
import test from 'node:test';
import { DUST } from '../js/const.js';
import { engravingAt, makeEngravingAt, wipeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
void test('bones engravings lose the ancestor reading flags and restore worn text pointers', async () => {
    freshObjectRoom();
    const storage = memoryStorage();
    game.storage = storage;
    const engraving = makeEngravingAt(12, 10, '   a warning!', null, 0, DUST);
    assert.ok(engraving);
    engraving.eread = engraving.erevealed = true;
    // Wear advances the actual text pointer while preserving the original text.
    wipeEngravingAt(12, 10, 0);
    assert.equal(saveBonesLevel(), true);
    freshObjectRoom();
    game.storage = storage;
    game.flags.debug = true;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    resetInputState().feed('yn');
    await mklev();
    const restored = engravingAt(12, 10);
    assert.ok(restored);
    assert.equal(restored.eread, false);
    assert.equal(restored.erevealed, false);
    assert.equal(restored.text, 'a warning!');
    assert.equal(restored.rememberedText, 'a warning!');
    assert.equal(restored.pristine, '   a warning!');
});
//# sourceMappingURL=engraving_bones_memory.test.js.map