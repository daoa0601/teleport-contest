import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { untrap } from '../js/trap.js';
import { artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { DOOR, D_CLOSED, D_TRAPPED, D_NODOOR } from '../js/const.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { hasMagicKey, isMagicKey, uncreateArtifact } from '../js/artifact.js';
import { createMonsterAt } from './support/monsters.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
void test('a cursed Master Key cannot overcome a rogue fumbling while untrapping a door', async () => {
    const level = await freshObjectRoom({ role: 'rogue', gameplaySeed: 1n,
        hero: { ualign: { type: -1, record: 10 }, ulevel: 30, uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    grantIntrinsicProperty('fumbling', 'outside', game);
    const key = await artifactObject('The Master Key of Thievery', {
        invlet: 'a', where: 'inventory', cursed: true,
    });
    game.inventory = [key];
    const door = level.requireAt(game.u.ux + 1, game.u.uy);
    door.typ = DOOR;
    door.doormask = D_CLOSED | D_TRAPPED;
    await untrap({
        chooseDirection: async () => ({ key: 'l', dx: 1, dy: 0, dz: 0 }),
        ask: async () => 'y', random: () => 0, publish: async () => { },
    });
    assert.equal(door.doormask, D_NODOOR, 'The failed disarm sets off and destroys the door');
    assert.ok(game.u.uhp < 200);
});
void test('the magic key check serves the hero by role and a monster by species', async () => {
    await freshObjectRoom({ role: 'rogue', gameplaySeed: 1n });
    requirePlayingGame(game);
    const rogueMonster = await createMonsterAt('rogue', game.u.ux + 1, game.u.uy);
    const soldier = await createMonsterAt('soldier', game.u.ux - 1, game.u.uy);
    const key = await artifactObject('The Master Key of Thievery', { invlet: 'a' });
    game.inventory = [key];
    // artifact.c is_magic_key(): a rogue hero needs only an uncursed key.
    key.cursed = false;
    key.blessed = false;
    assert.equal(isMagicKey({ youmonst: true }, key), true);
    assert.equal(hasMagicKey({ youmonst: true }), true);
    key.cursed = true;
    assert.equal(hasMagicKey({ youmonst: true }), false);
    // A rogue monster needs only an uncursed key; a cursed one never works.
    game.inventory = [];
    await addObjectToMonsterInventory(rogueMonster, key, game);
    key.cursed = false;
    assert.equal(hasMagicKey({ monster: rogueMonster }), true);
    key.cursed = true;
    assert.equal(hasMagicKey({ monster: rogueMonster }), false);
    // A non-rogue carrier must have a blessed key.
    uncreateArtifact(key);
    const secondKey = await artifactObject('The Master Key of Thievery', { invlet: 'b' });
    await addObjectToMonsterInventory(soldier, secondKey, game);
    secondKey.cursed = false;
    secondKey.blessed = false;
    assert.equal(hasMagicKey({ monster: soldier }), false);
    secondKey.blessed = true;
    assert.equal(hasMagicKey({ monster: soldier }), true);
});
//# sourceMappingURL=artifact_magic_key.test.js.map