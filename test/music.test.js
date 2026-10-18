import { objectTypeKnown } from '../js/shk.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { mksobj } from '../js/mklev.js';
import { monsterIsScaredAt } from '../js/monster_fear.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { playInstrument } from '../js/music.js';
import { initRng } from '../js/rng.js';
import { BUGLE, FIRE_HORN, FROST_HORN, LEATHER_DRUM, MAGIC_FLUTE, WOODEN_HARP, } from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { applyInventoryObject } from './support/commands.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom, freshTurnRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
async function instrument(otyp, spe = 0) {
    const object = await mksobj(otyp, true, false);
    object.spe = spe;
    return object;
}
void test('a charged magic flute puts nearby monsters to sleep', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.ulevel = 5;
    const target = await createMonsterAt('giant ant', 11, 10);
    const flute = await instrument(MAGIC_FLUTE, 2);
    pushKeys('y          ');
    await playInstrument(flute);
    assert.equal(flute.spe, 1);
    assert.equal(target.mcanmove, 0);
    assert.ok((target.mfrozen ?? 0) > 0);
});
void test('a skilled harp player calms nearby nymphs', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.ulevel = 30;
    const nymph = await createMonsterAt('water nymph', 11, 10);
    nymph.mpeaceful = 0;
    pushKeys('y          ');
    await playInstrument(await instrument(WOODEN_HARP));
    assert.equal(nymph.mpeaceful, 1);
});
void test('a bugle calls every soldier on the level to battle', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 18, 12);
    soldier.mpeaceful = 1;
    soldier.msleeping = 1;
    soldier.mcanmove = 0;
    soldier.mfrozen = 12;
    pushKeys('y          ');
    await playInstrument(await instrument(BUGLE));
    assert.equal(soldier.mpeaceful, 0);
    assert.equal(soldier.msleeping, 0);
    assert.equal(soldier.mcanmove, 1);
    assert.equal(soldier.mfrozen, 0);
});
void test('applying a leather drum plays it', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const drum = await addInventoryItem(await instrument(LEATHER_DRUM));
    await applyInventoryObject(drum, '          ');
    assert.ok((game.u.deafTurns ?? 0) >= 30);
    assert.equal(game.context.move, 1);
});
void test('a fire horn shoots a ray and spends one charge', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('gas spore', 11, 10);
    target.mhp = target.mhpmax = 100;
    const horn = await instrument(FIRE_HORN, 2);
    pushKeys('y l          '); // Acknowledge the horn announcement before choosing its direction.
    await playInstrument(horn);
    assert.equal(horn.spe, 1);
    assert.ok(target.mhp < 100);
    assert.equal(objectTypeKnown(horn), true);
});
void test('cold resistance protects against a frost horn aimed at yourself', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.coldResistance = true;
    game.u.uhp = game.u.uhpmax = 100;
    const horn = await instrument(FROST_HORN, 1);
    pushKeys('y .          ');
    await playInstrument(horn);
    assert.equal(game.u.uhp, 100);
    assert.equal(horn.spe, 0);
    assert.equal(objectTypeKnown(horn), true);
});
void test('an empty fire horn behaves like an ordinary horn', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('giant ant', 11, 10);
    target.msleeping = 1;
    const horn = await instrument(FIRE_HORN);
    pushKeys('y          ');
    await playInstrument(horn);
    assert.equal(target.msleeping, 0);
    assert.equal(objectTypeKnown(horn), false);
});
for (const inOwnShop of [true, false]) {
    void test(`a drum ${inOwnShop ? 'cannot frighten a shopkeeper inside its shop' : 'can frighten a shopkeeper outside its shop'}`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({ left: 12, keeperX: 12 });
        if (!inOwnShop)
            placeMonsterAt(shopkeeper, 11, 10);
        shopkeeper.msleeping = 1;
        const drum = await instrument(LEATHER_DRUM);
        initRng(1n);
        await answerPrompts(playInstrument(drum), input, inOwnShop ? [] : [
            { prompt: /deafening row!.*--More--/, keys: ' ' },
        ]);
        assert.equal(shopkeeper.msleeping, 0);
        assert.equal(Boolean(shopkeeper.mflee), !inOwnShop);
    });
}
for (const species of ['Angel', 'couatl']) {
    void test(`a drum awakens ${species} without frightening it`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10, MM_NOWAIT | NO_MINVENT);
        monster.msleeping = 1;
        monster.mcanmove = 0;
        monster.mfrozen = 10;
        assert.equal(monsterIsScaredAt(monster, game, 0, 0), false);
        const drum = await instrument(LEATHER_DRUM);
        initRng(1n);
        await answerPrompts(playInstrument(drum), input, []);
        assert.equal(monster.msleeping, 0);
        assert.equal(monster.mcanmove, 1);
        assert.equal(monster.mfrozen, 0);
        assert.equal(Boolean(monster.mflee), false);
    });
}
//# sourceMappingURL=music.test.js.map