import assert from 'node:assert/strict';
import test from 'node:test';
import { finishLivingGame } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { artifactByName } from '../js/artifact.js';
import { CHEST, OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryItem } from '../js/invent.js';
import { mksobj, addCreatedObjectToContainer } from '../js/mkobj.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
void test('final artifact disclosure marks a boxed artifact base type discovered', async () => {
    await freshObjectRoom({ hero: { uhp: 1, uhpmax: 1 }, flags: { bones: false, disclose: 'none' } });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const magicbane = artifactByName('Magicbane');
    assert.ok(magicbane, 'Magicbane must exist in the artifact table');
    const athame = OBJECT_NAMES.indexOf('athame');
    assert.ok(athame > 0, 'The athame base type must exist');
    // done()'s identify loop walks top-level inventory only (end.c:1257), and
    // disclose 'none' skips container_contents(), so the listing pass of
    // artifact_score() — which recurses into containers (end.c:937) — is the
    // only discover_object(otyp, TRUE, TRUE, FALSE) for this type.
    const chest = await mksobj(CHEST, true, false);
    const blade = await mksobj(athame, true, false);
    blade.oartifact = magicbane.id;
    await addCreatedObjectToContainer(chest, blade);
    await addInventoryItem(chest, null, false);
    const input = resetInputState();
    let keys = 0;
    input.display = {
        async readKey() {
            keys++;
            assert.ok(keys < 32, 'The final summary must finish');
            requireGameDisplay();
            return 32;
        },
    };
    await finishLivingGame('escaped');
    assert.equal(game._encounteredObjectTypes?.has(athame), true, 'artifact_score() marks the boxed artifact base type encountered (o_init.c:1094 "  " rows)');
    assert.equal(game._knownObjectTypes?.has(athame), true, 'artifact_score() marks the boxed artifact base type known');
});
//# sourceMappingURL=end_artifact_disclosure.test.js.map