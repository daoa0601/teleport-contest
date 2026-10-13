import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core, restoregamePreamble } from '../js/allmain.js';
import { ensureQuestStatus } from '../js/quest.js';
import { convertQuestLine } from '../js/quest_pager.js';
import { removeHeroArmor, wearHeroArmor } from '../js/armor.js';
import { DUST } from '../js/const.js';
import { makeEngravingAt } from '../js/engrave.js';
import { propertyIsActive } from '../js/properties.js';
import { nearCapacity } from '../js/weight.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_DISPLACEMENT, CORPSE, DART, FEDORA, FOOD_RATION, FUMBLE_BOOTS, LEATHER_ARMOR, LEVITATION_BOOTS, ROCK, SPEED_BOOTS, } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { getTrack, setTrack } from '../js/track.js';
import { vision_reset } from '../js/vision.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createRoomLevel, freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
import { completeHeroStartup } from './support/startup.js';
function preambleInput() {
    game.context ||= { move: 0, nopick: false };
    game.program_state ||= {};
    game.iflags ||= {};
    game.tutorial_set_in_config = true;
    game.datetime = '20260801120000';
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => acknowledgePreambleInput(input, messages);
    return { input, messages };
}
function acknowledgePreambleInput(input, messages) {
    const display = requireGameDisplay();
    const rows = display.grid.map(row => row.map(cell => cell.ch).join(''));
    const text = rows.slice(0, 3).join('\n');
    messages.push(text);
    if (rows.some(row => row.includes('--More--'))) {
        input.feed(' ');
        return;
    }
    if (game.program_state.gameover) {
        assert.match(rows.join('\n'), /Goodbye|turned to stone|killed|died/i);
        input.feed(' ');
        return;
    }
    assert.equal(game._moveloopStarted, true, `unexpected startup prompt: ${text}`);
    assert.equal(display.cursorCol, game.u.ux - 1, 'command cursor is on the hero');
    assert.equal(display.cursorRow, game.u.uy + 1, 'command cursor is on the hero');
    input.feed('\x1b');
}
function floorObjects() {
    const objects = requireGameLevel().objects[10]?.[10];
    assert.ok(objects, 'the hero floor square exists');
    return objects;
}
async function initialRole(role) {
    await completeHeroStartup({ role, alignment: 'lawful' });
    game.level = createRoomLevel();
    game.u.ux = 10;
    game.u.uy = 10;
    game.u.ux0 = 10;
    game.u.uy0 = 10;
    game.nhDisplay = new GameDisplay(null);
    vision_reset();
    return preambleInput();
}
void test('starting fedora adds Archeologist luck once and removal reverses it', async () => {
    await initialRole('archeologist');
    assert.ok(game.uarmh);
    assert.equal(game.uarmh.otyp, FEDORA);
    const luck = game.u.uluck ?? 0;
    await moveloop_core();
    assert.equal(game.u.uluck, luck + 1);
    await moveloop_core();
    assert.equal(game.u.uluck, luck + 1);
    await removeHeroArmor(game.uarmh);
    assert.equal(game.u.uluck, luck);
});
void test('starting Ranger displacement is active without the wear observation', async () => {
    const { messages } = await initialRole('ranger');
    assert.ok(game.uarmc);
    assert.equal(game.uarmc.otyp, CLOAK_OF_DISPLACEMENT);
    await moveloop_core();
    assert.equal(game.uarmc.worn, true);
    assert.doesNotMatch(messages.join('\n'), /difficulty pinpointing/);
    assert.equal(propertyIsActive('displaced'), true);
});
void test('starting boots apply speed and fumbling side effects before command input', async () => {
    for (const type of [SPEED_BOOTS, FUMBLE_BOOTS]) {
        freshPlayableRoom();
        preambleInput();
        const boots = await addInventoryObject(type);
        await wearHeroArmor(boots);
        await moveloop_core();
        if (type === SPEED_BOOTS)
            assert.equal(game.u.veryFast, true);
        else
            assert.ok((game.u.fumblingTurns ?? 0) > 0, 'fumble boots should install their initial timeout');
    }
});
void test('initial autopickup honors its class filter and replaces last-picked selection', async () => {
    freshPlayableRoom({ flags: { verbose: true, pickup: true, pickup_types: ')' } });
    preambleInput();
    const old = await addInventoryObject(FOOD_RATION, { pickup_prev: true });
    const darts = await floorObject(DART, 10, 10, { quantity: 3 });
    const armor = await floorObject(LEATHER_ARMOR, 10, 10);
    game.u.umovement = 3;
    setTrack();
    await moveloop_core();
    assert.equal(game.inventory.includes(darts), true);
    assert.equal(darts.pickup_prev, true);
    assert.equal(old.pickup_prev, false);
    assert.equal(floorObjects().includes(armor), true);
    assert.equal(game.u.umovement, 12);
    assert.equal(getTrack(11, 10), null);
    assert.equal(game.moves, 1);
});
void test('initial autopickup respects shop stock and picks up the hero belongings', async () => {
    freshPlayableRoom({ flags: { verbose: true, pickup: true } });
    preambleInput();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const stock = await floorObject(FOOD_RATION, 10, 10);
    const belongings = await floorObject(DART, 10, 10, { no_charge: true });
    await moveloop_core();
    assert.equal(game.inventory.includes(belongings), true);
    assert.equal(belongings.no_charge, false);
    assert.equal(floorObjects().includes(stock), true);
    assert.ok(shopkeeper.eshk);
    assert.equal(shopkeeper.eshk.bill.length, 0);
});
void test('an initial pickup pager suspends later initialization and resumes without a turn', async () => {
    freshPlayableRoom({ flags: { verbose: true, pickup: true } });
    const { input } = preambleInput();
    input.beforeRead = null;
    const darts = await floorObject(DART, 10, 10);
    game._pending_message = 'An earlier announcement fills most of the message line before the pickup.';
    const starting = moveloop_core();
    await input.waitUntilBlocked();
    try {
        assert.equal(game.seer_turn, undefined);
        assert.equal(!!game._moveloopStarted, false);
        assert.equal(game.moves, 1);
    }
    finally {
        input.beforeRead = () => acknowledgePreambleInput(input, []);
        input.feed(' ');
        await starting;
    }
    assert.equal(game.inventory.includes(darts), true);
    assert.ok(game.seer_turn !== undefined);
    assert.ok(game.seer_turn >= 1 && game.seer_turn <= 30);
    assert.equal(game._moveloopStarted, true);
    assert.equal(game.moves, 1);
});
void test('restore skips initial pickup and preserves movement, pursuit track, and worn effects', async () => {
    freshPlayableRoom({ role: 'archeologist', flags: { verbose: true, pickup: true } });
    preambleInput();
    const fedora = await addInventoryObject(FEDORA);
    await wearHeroArmor(fedora);
    game.u.uluck = 2;
    game.u.umovement = 5;
    setTrack();
    const darts = await floorObject(DART, 10, 10);
    const engraving = makeEngravingAt(10, 10, 'A remembered warning', null, 0, DUST);
    await restoregamePreamble();
    assert.equal(game.u.uluck, 2);
    assert.equal(game.u.umovement, 5);
    assert.deepEqual(getTrack(11, 10), { x: 10, y: 10 });
    assert.equal(game.inventory.includes(darts), false);
    assert.ok(engraving);
    assert.equal(engraving.eread, true);
    assert.equal(game._encumbranceLevel, 0);
    assert.equal(game.context.move, 0);
});
for (const gender of [0, 1]) {
    void test(`restore preserves the ${gender === 0 ? 'male' : 'female'} Wizard nemesis pronouns`, async () => {
        freshPlayableRoom({ role: 'wizard', flags: { verbose: true } });
        preambleInput();
        const quest = ensureQuestStatus();
        quest.nemgend = gender;
        quest.met_nemesis = true;
        await restoregamePreamble();
        assert.equal(quest.nemgend, gender);
        assert.equal(quest.met_nemesis, true);
        assert.equal(convertQuestLine('%nH guards %nj lair.'), gender === 0 ? 'He guards his lair.' : 'She guards her lair.');
    });
}
for (const restoring of [false, true]) {
    void test(`${restoring ? 'restored' : 'new'} carried load is reported before command input`, async () => {
        freshPlayableRoom();
        const { messages } = preambleInput();
        await addInventoryObject(ROCK, { quantity: 200 });
        const capacity = nearCapacity(game);
        assert.ok(capacity > 0);
        // oldcap belongs to the process; a restored hero still gets the
        // load notice even if the last saved input had the same capacity.
        if (restoring)
            game._encumbranceLevel = capacity;
        if (restoring)
            await restoregamePreamble();
        await moveloop_core();
        assert.equal(game._encumbranceLevel, capacity);
        assert.match(messages.join('\n'), /with this load|Movement is|under your heavy load|slowed slightly/);
        assert.equal(game.moves, 1);
    });
}
void test('starting levitation boots lift the hero before initial floor pickup', async () => {
    freshPlayableRoom({ flags: { verbose: true, pickup: true } });
    preambleInput();
    const boots = await addInventoryObject(LEVITATION_BOOTS);
    await wearHeroArmor(boots);
    const darts = await floorObject(DART, 10, 10);
    await moveloop_core();
    assert.equal(propertyIsActive('levitation'), true);
    assert.equal(game.inventory.includes(darts), false);
    assert.equal(floorObjects().includes(darts), true);
});
void test('a starting fedora gives no luck bonus to other roles', async () => {
    freshPlayableRoom({ role: 'wizard' });
    preambleInput();
    const fedora = await addInventoryObject(FEDORA);
    await wearHeroArmor(fedora);
    await moveloop_core();
    assert.equal(game.u.uluck ?? 0, 0);
    await removeHeroArmor(fedora);
    assert.equal(game.u.uluck ?? 0, 0);
});
void test('fatal initial corpse contact stops startup before the first movement ration', async () => {
    freshPlayableRoom({ flags: { verbose: true, pickup: true, disclose: '-i -a -v -g -c -o' } });
    preambleInput();
    game.u.umovement = 0;
    await floorObject(CORPSE, 10, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    await moveloop_core();
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.seer_turn, undefined);
    assert.equal(game.u.umovement, 0);
    assert.equal(!!game._moveloopStarted, false);
});
//# sourceMappingURL=startup_preamble.test.js.map