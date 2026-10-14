import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactByName } from '../js/artifacts.js';
import { addFruit } from '../js/fruit.js';
import { game } from '../js/gstate.js';
import { DAGGER, SLIME_MOLD } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an object wish keeps the individual name supplied after named', async () => {
    freshObjectRoom();
    const result = await readObjectName('dagger named Needle');
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, DAGGER);
    assert.equal(result.object.oextra?.oname, 'Needle');
});
void test('a matching artifact name can turn a wished base object into that artifact', async () => {
    freshObjectRoom();
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact);
    const result = await readObjectName('long sword named excalibur', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.equal(result.object.oartifact, artifact.id);
    assert.equal(result.object.oextra?.oname, 'Excalibur');
    assert.equal(game.u.uconduct?.wisharti, 1);
});
void test('a named fruit is checked before an artifact with the same label', async () => {
    freshObjectRoom();
    const fruit = addFruit('Excalibur');
    const result = await readObjectName('Excalibur');
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, SLIME_MOLD);
    assert.equal(result.object.spe, fruit);
    assert.equal(game.u.uconduct?.wisharti ?? 0, 0);
});
//# sourceMappingURL=wish_named_objects.test.js.map