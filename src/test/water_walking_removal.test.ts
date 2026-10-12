import assert from 'node:assert/strict';
import test from 'node:test';
import { removeHeroArmor, wearHeroArmor } from '../js/armor.js';
import { LAVAPOOL, POOL, TT_LAVA } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { TOWEL, WATER_WALKING_BOOTS } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('removing water-walking boots over water immediately submerges the hero and wets inventory', async () => {
    const level = freshObjectRoom();
    const boots = await addInventoryObject(WATER_WALKING_BOOTS, { typeKnown: false });
    const towel = await addInventoryObject(TOWEL, { spe: 0 });
    wearHeroArmor(boots);
    grantIntrinsicProperty('magicalBreathing', 'outside');
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    pushKeys(' '.repeat(20));

    await removeHeroArmor(boots);

    assert.equal(game.uarmf, null);
    assert.equal(game.u.uinwater, 1);
    assert.ok(towel.spe > 0, 'entering water wets the carried towel during removal');
    assert.equal(objectTypeKnown(boots), true);
    assert.equal(!!game.program_state.gameover, false);
});

void test('removing water-walking boots over lava immediately burns and traps a fire-resistant hero', async () => {
    const level = freshObjectRoom();
    const boots = await addInventoryObject(WATER_WALKING_BOOTS, { typeKnown: false, oerodeproof: true });
    wearHeroArmor(boots);
    grantIntrinsicProperty('fireResistance', 'outside');
    level.requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    pushKeys(' '.repeat(20));

    await removeHeroArmor(boots);

    assert.equal(game.uarmf, null);
    assert.ok(game.u.uhp !== undefined && game.u.uhp < 40, 'lava burns the hero during removal');
    assert.equal(game.u.utraptype, TT_LAVA);
    assert.ok(game.u.utrap !== undefined && game.u.utrap > 0);
    assert.equal(objectTypeKnown(boots), true);
    assert.equal(!!game.program_state.gameover, false);
});

for (const protection of ['levitation', 'flying', 'ceiling', 'cancelled dressing', 'lava effects'] as const) {
    void test(`removing water-walking boots skips terrain effects during ${protection}`, async () => {
        const level = freshObjectRoom();
        const boots = await addInventoryObject(WATER_WALKING_BOOTS, { typeKnown: false });
        const towel = await addInventoryObject(TOWEL, { spe: 0 });
        wearHeroArmor(boots);
        if (protection === 'levitation' || protection === 'flying')
            grantIntrinsicProperty(protection, 'outside');
        if (protection === 'ceiling') {
            game.u.umonnum = MONSTER_NAME.indexOf('rock piercer');
            game.u.mtimedone = 20;
        }
        if (protection === 'lava effects') game.iflags.in_lava_effects = 1;
        level.requireAt(game.u.ux, game.u.uy).typ = protection === 'lava effects' ? LAVAPOOL : POOL;

        await removeHeroArmor(boots, game, { cancelledDon: protection === 'cancelled dressing' });

        assert.equal(game.uarmf, null);
        assert.equal(game.u.uinwater ?? 0, 0);
        assert.equal(towel.spe, 0);
        assert.equal(objectTypeKnown(boots), false, 'no terrain transition reveals the boots');
    });
}
