import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { propertyIsActive } from '../js/properties.js';
import { artifactObject, floorArtifact } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { applyInventoryObject, dropInventoryObject } from './support/commands.js';
void test('wielding and unwielding the Staff enables and removes regeneration and drain resistance', async () => {
    freshObjectRoom({ role: 'healer' });
    requirePlayingGame(game);
    const staff = await artifactObject('The Staff of Aesculapius', { invlet: 'a', where: 'inventory' });
    game.inventory = [staff];
    pushKeys('a');
    await rhack('w'.charCodeAt(0));
    assert.equal(propertyIsActive('regeneration'), true);
    assert.equal(propertyIsActive('drainResistance'), true);
    pushKeys('-');
    await rhack('w'.charCodeAt(0));
    assert.equal(propertyIsActive('regeneration'), false);
    assert.equal(propertyIsActive('drainResistance'), false);
});
void test('picking up and dropping the Heart enables and removes its carried stealth', async () => {
    freshObjectRoom({ role: 'barbarian' });
    requirePlayingGame(game);
    const heart = await floorArtifact('The Heart of Ahriman', game.u.ux, game.u.uy);
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(heart), true);
    assert.equal(propertyIsActive('stealth'), true);
    await dropInventoryObject(heart, ' '.repeat(20));
    assert.equal(propertyIsActive('stealth'), false);
});
void test('dropping one carried artifact retains the magic resistance granted by another', async () => {
    freshObjectRoom({ role: 'knight', hero: { uhp: 200, uhpmax: 200, ualign: { type: 1, record: 10 } } });
    requirePlayingGame(game);
    await floorArtifact('The Magic Mirror of Merlin', game.u.ux, game.u.uy);
    await rhack(','.charCodeAt(0));
    const orb = await floorArtifact('The Orb of Detection', game.u.ux, game.u.uy);
    pushKeys(' '.repeat(20));
    await rhack(','.charCodeAt(0));
    assert.equal(propertyIsActive('antimagic'), true);
    await dropInventoryObject(orb, ' '.repeat(20));
    assert.equal(propertyIsActive('antimagic'), true);
});
void test('wearing the Eyes grants x-ray sight and magic resistance, removing them ends both', async () => {
    freshObjectRoom({ role: 'monk' });
    requirePlayingGame(game);
    const eyes = await artifactObject('The Eyes of the Overworld', { invlet: 'a', where: 'inventory' });
    game.inventory = [eyes];
    await applyInventoryObject(eyes);
    assert.equal(game.u.xray_range, 3);
    assert.equal(propertyIsActive('antimagic'), true);
    await applyInventoryObject(eyes, ' '.repeat(20));
    assert.equal(game.u.xray_range, -1);
    assert.equal(propertyIsActive('antimagic'), false);
});
//# sourceMappingURL=artifact_properties.test.js.map