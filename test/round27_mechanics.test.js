import test from 'node:test';
import assert from 'node:assert/strict';
import { heroHasFreeAction } from '../js/armor.js';
import { STONE, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { continueHeroDigging, startHeroDigging } from '../js/hero_digging.js';
import { resetInputState } from '../js/input.js';
import { HEAVY_IRON_BALL, PICK_AXE } from '../js/object_data.js';
import { grantIntrinsicProperty, hasTimedProperty, setPropertyTimeout } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { waterDamageObject } from '../js/trap.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPagerInput } from './support/pager-input.js';
void test('intrinsic free action does not prevent paralysis', async () => {
    await freshObjectRoom();
    grantIntrinsicProperty('freeAction', 'outside');
    assert.equal(heroHasFreeAction(), false, 'Free_action reads equipment sources only');
    setPropertyTimeout('freeAction', 20);
    assert.equal(hasTimedProperty('freeAction'), true, 'wizard timers still retain their duration');
    assert.equal(heroHasFreeAction(), false, 'a wizard timeout supplies no paralysis protection');
});
void test('a submerged hero sees a nearby iron ball rust', async () => {
    const level = await freshObjectRoom({ hero: { uinwater: 1 } });
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    await vision_recalc(0);
    assert.equal(cansee(game.u.ux, game.u.uy), true);
    const ball = await floorObject(HEAVY_IRON_BALL, game.u.ux, game.u.uy, { oeroded: 1 });
    const messages = [];
    await waterDamageObject(ball, messages, game);
    assert.equal(ball.oeroded, 2);
    assert.ok(messages.some(message => /heavy iron ball rusts further/.test(message)), `Visible underwater erosion must be reported: ${messages.join(' | ')}`);
});
void test('an Earth cave opening restores sight through the excavated rock', async () => {
    for (let seed = 1; seed <= 12; seed++) {
        const level = await freshObjectRoom();
        requireFixtureGame(game);
        game.earth_level = { ...game.u.uz, flags: { town: false }, alignment: null };
        for (let y = 6; y <= 14; y++)
            level.requireAt(11, y).typ = STONE;
        vision_reset();
        await vision_recalc(0);
        assert.equal(cansee(12, 10), false, 'the original rock must block sight');
        const pick = await addInventoryObject(PICK_AXE, { blessed: true });
        await setPrimaryWeapon(pick);
        const messages = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /dig|rock|cave|force|might|elemental|xorn/i, limit: 20 });
        input.beforeRead = () => { messages.push(game._pending_message); };
        initRng(BigInt(seed));
        await startHeroDigging(pick, 11, 10);
        for (let turn = 0; turn < 32; turn++) {
            if (!await continueHeroDigging())
                break;
        }
        messages.push(game._pending_message);
        if (!messages.some(message => /mysterious force/.test(message)))
            continue;
        await vision_recalc(0);
        assert.equal(cansee(12, 10), true, `The opened cave must admit sight (seed ${seed})`);
        return;
    }
    assert.fail('No cave-opening event occurred in twelve completed blessed-pick digs');
});
//# sourceMappingURL=round27_mechanics.test.js.map