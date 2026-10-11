import test from 'node:test';
import assert from 'node:assert/strict';
import { STONE } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { startHeroDigging, continueHeroDigging } from '../js/hero_digging.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE, TOWEL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { burnHeroArmorByFire } from '../js/trap.js';
import { vision_reset } from '../js/vision.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { requireFixtureGame } from './support/game-state.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('fire dries a wet towel carried by the hero', async () => {
    freshObjectRoom();
    const towel = await addInventoryObject(TOWEL, { spe: 7 });
    const messages = [];
    initRng(1n);
    await burnHeroArmorByFire(game, message => { messages.push(message); });
    assert.ok(game.inventory.includes(towel));
    assert.ok(towel.spe < 7, 'Fire should reduce the carried towel\'s wetness.');
    assert.ok(messages.some(message => message.startsWith('Your towel dries')));
});
void test('an Earth cave-in leaves a wall-walking xorn inside the new rock', { timeout: 5000 }, async () => {
    const level = freshObjectRoom();
    requireFixtureGame(game);
    game.earth_level = {
        ...game.u.uz, flags: { town: false }, alignment: null,
    };
    const xorn = await createMonsterAt('xorn', 9, 10);
    const pick = await addInventoryObject(PICK_AXE, { cursed: true });
    await setPrimaryWeapon(pick);
    level.requireAt(11, 10).typ = STONE;
    vision_reset();
    const input = resetInputState();
    initRng(5n);
    await startHeroDigging(pick, 11, 10);
    const digging = (async () => {
        for (let turn = 0; turn < 32; turn++) {
            if (!await continueHeroDigging())
                return;
        }
        assert.fail('Digging did not finish within 32 turns.');
    })();
    const boundary = await Promise.race([
        digging.then(() => 'finished'),
        input.waitUntilBlocked().then(() => 'prompt'),
    ]);
    if (boundary === 'prompt') {
        const display = requireGameDisplay();
        const prompt = Array.from({ length: display.cols }, (_, column) => display.getChar(column + 1, 1)).join('');
        assert.match(prompt, /^You hit the rock with all your might\.\s*--More--/);
        input.feed(' ');
    }
    await digging;
    assert.equal(level.requireAt(9, 10).typ, STONE, 'The cave-in should fill the xorn\'s square.');
    assert.equal(xorn.mx, 9);
    assert.equal(xorn.my, 10);
    assert.ok(xorn.mhp > 0);
});
//# sourceMappingURL=fire_digging_native_rules.test.js.map