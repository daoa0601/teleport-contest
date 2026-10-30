import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR, DOOR, D_NODOOR, FOUNTAIN, GETOBJ_SUGGEST, NO_MINVENT, W_NONDIGGABLE } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { zapDigWithObject } from '../js/digging_magic.js';
import { flush_screen, newsym, newsym_force, pline } from '../js/display.js';
import { doBlindingRay } from '../js/flash.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { chooseInventoryObject } from '../js/inventory_prompt.js';
import { clearDetectionMap } from '../js/magic_map_display.js';
import { blockMonsterNotices, unblockMonsterNotices } from '../js/monster_notices.js';
import { EXPENSIVE_CAMERA, FOOD_RATION, WAN_DIGGING } from '../js/object_data.js';
import { runSegment } from '../js/jsmain.js';
import { makeBlinded } from '../js/sight_change.js';
import { cleanupTransientLight, showTransientLight } from '../js/transient_light.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
function messages() {
    return [...game._messageHistory, game._pending_message].join(' | ');
}
void test('a vision recalculation announces newly visible monsters nearest first', async () => {
    await freshObjectRoom();
    const gnome = await createMonsterAt('gnome', 14, 10, NO_MINVENT);
    gnome.mpeaceful = 1;
    const newt = await createMonsterAt('newt', 12, 10, NO_MINVENT);
    newt.mpeaceful = 0;
    game.flags.spot_monsters = true;
    pushKeys(' '.repeat(20));
    await vision_recalc(0);
    assert.match(messages(), /You see a newt\..*You see a peaceful gnome\./);
});
void test('message output settles vision notices before its own prose', async () => {
    await freshObjectRoom();
    const jackal = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    game.flags.spot_monsters = true;
    game.flags.accessiblemsg = true;
    game.vision_full_recalc = 1;
    pushKeys(' '.repeat(20));
    await pline('The passage opens.');
    assert.match(messages(), /\(2east\): You see a jackal\..*The passage opens\./);
});
void test('losing and regaining sight in one action announces the second sighting', async () => {
    await freshObjectRoom();
    const jackal = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    game.flags.spot_monsters = true;
    pushKeys(' '.repeat(20));
    await vision_recalc(0);
    await makeBlinded(5);
    await makeBlinded(0);
    const said = messages();
    const notice = 'You see a jackal.';
    assert.ok(said.indexOf(notice) >= 0 && said.lastIndexOf(notice) > said.indexOf('You can see again.'), said);
});
void test('transient light announces a monster before the flash is removed', async () => {
    const level = await freshObjectRoom();
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    const jackal = await createMonsterAt('jackal', 14, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    await vision_recalc(0);
    game.flags.spot_monsters = true;
    await showTransientLight(null, 14, 10);
    assert.equal(game._pending_message, 'You see a jackal.');
    await cleanupTransientLight();
});
void test('mention_map describes a newly displayed fountain with its position', async () => {
    const level = await freshObjectRoom();
    level.requireAt(12, 10).typ = FOUNTAIN;
    game.flags.mention_map = true;
    await newsym(12, 10);
    assert.equal(game._pending_message, '(2east): fountain.');
    assert.equal(game.flags.accessiblemsg, undefined, 'the forced location prefix is temporary');
});
for (const camera of [true, false]) {
    void test(`mention_map only announces furniture restored after a ${camera ? 'camera flash' : 'digging beam'}`, async () => {
        const level = await freshObjectRoom({ left: 10, right: 16, top: 10, bottom: 10 });
        for (let x = 11; x <= 16; x++)
            level.requireAt(x, 10).typ = CORR;
        const doorway = level.requireAt(13, 10);
        doorway.typ = DOOR;
        doorway.doormask = D_NODOOR;
        level.requireAt(14, 10).typ = FOUNTAIN;
        level.requireAt(17, 10).wall_info = W_NONDIGGABLE;
        await floorObject(FOOD_RATION, 12, 10);
        for (let x = 11; x <= 16; x++)
            await newsym(x, 10);
        await flush_screen(1);
        const source = await knownObject(camera ? EXPENSIVE_CAMERA : WAN_DIGGING);
        game.flags.mention_map = true;
        pushKeys(' '.repeat(20));
        if (camera)
            await doBlindingRay(source, { dx: 1, dy: 0 });
        else {
            game.u.dx = 1;
            game.u.dy = game.u.dz = 0;
            await zapDigWithObject(source);
        }
        assert.equal(messages(), '(4east): fountain.', 'restoring the beam announces furniture, keeping known corridors, doorways, and objects quiet');
    });
}
void test('mention_map describes an object on previously unexplored ground', async () => {
    const level = await freshObjectRoom();
    await floorObject(FOOD_RATION, 12, 10);
    delete level.requireAt(12, 10).disp_glyph;
    game.flags.mention_map = true;
    await newsym(12, 10);
    assert.equal(game._pending_message, '(2east): an uncursed food ration.');
});
void test('mention_map describes a discovered monster when spot_monsters is off', async () => {
    const level = await freshObjectRoom();
    const newt = await createMonsterAt('newt', 12, 10, NO_MINVENT);
    newt.mpeaceful = 0;
    delete level.requireAt(12, 10).disp_glyph;
    game.flags.mention_map = true;
    await newsym(12, 10);
    assert.equal(game._pending_message, '(2east): newt.');
});
void test('a flushed unchanged fountain is quiet on the next repaint', async () => {
    const level = await freshObjectRoom();
    level.requireAt(12, 10).typ = FOUNTAIN;
    await newsym(12, 10);
    await flush_screen(1);
    game.flags.mention_map = true;
    await newsym(12, 10);
    assert.equal(game._pending_message, '');
});
void test('clearing the detection map leaves unexplored squares silent', async () => {
    await freshObjectRoom();
    await clearDetectionMap();
    game.flags.mention_map = true;
    await newsym(40, 10);
    assert.equal(game._pending_message, '', 'resetting the glyph buffer does not discover unknown terrain');
});
void test('a forced repaint makes an unchanged fountain worth mentioning again', async () => {
    const level = await freshObjectRoom();
    level.requireAt(12, 10).typ = FOUNTAIN;
    await newsym(12, 10);
    await flush_screen(1);
    await newsym_force(12, 10);
    game.flags.mention_map = true;
    await newsym(12, 10);
    assert.equal(game._pending_message, '(2east): fountain.');
});
void test('mention_map describes the surroundings after the startup welcome', async () => {
    const engine = await runSegment({
        seed: 37,
        datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:Ria,role:Valkyrie,race:human,gender:female,align:neutral,'
            + '!legacy,!tutorial,pettype:dog,spot_monsters,mention_map',
        moves: ' '.repeat(20), storage: memoryStorage(),
    });
    try {
        const said = [...engine.state._messageHistory, engine.state._pending_message].join(' | ');
        const welcome = said.indexOf('welcome to NetHack');
        const room = said.indexOf('You are in');
        const pet = said.indexOf('tame little dog');
        assert.ok(welcome >= 0 && room > welcome && pet > room, said);
        assert.doesNotMatch(said, /You see your little dog/, 'the surroundings description owns startup notices');
    }
    finally {
        await engine.lua.destroy();
    }
});
void test('nested notice blocking suppresses glyph and monster notices until vision catches up', async () => {
    const level = await freshObjectRoom();
    const jackal = await createMonsterAt('jackal', 13, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    level.requireAt(12, 10).typ = FOUNTAIN;
    game.flags.spot_monsters = true;
    game.flags.mention_map = true;
    blockMonsterNotices(game);
    blockMonsterNotices(game);
    await newsym(12, 10);
    await vision_recalc(0);
    await unblockMonsterNotices(game);
    await vision_recalc(0);
    assert.equal(game._pending_message, '', 'the outer blocker still owns the quiet period');
    await unblockMonsterNotices(game);
    assert.equal(game._pending_message, '', 'unblocking does not itself announce anything');
    await vision_recalc(0);
    assert.match(game._pending_message, /You see a jackal\./);
    assert.doesNotMatch(messages(), /fountain/, 'suppressed glyph notices are discarded');
});
void test('an unmatched notice unblock reports the error and allows later sightings', async () => {
    await freshObjectRoom();
    const jackal = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    game.flags.spot_monsters = true;
    pushKeys(' '.repeat(20));
    await unblockMonsterNotices(game);
    assert.match(messages(), /mon_notices_blocked<0/);
    await vision_recalc(0);
    assert.match(game._pending_message, /You see a jackal\./);
});
void test('mention_map leaves a newly seen monster to spot_monsters when both are enabled', async () => {
    await freshObjectRoom();
    const jackal = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    game.flags.spot_monsters = true;
    game.flags.mention_map = true;
    await newsym(12, 10);
    assert.equal(game._pending_message, '');
    await vision_recalc(0);
    assert.equal(game._pending_message, 'You see a jackal.');
});
void test('wizard identification follows the sighting produced by dismissing its menu', async () => {
    await freshObjectRoom({ flags: { debug: true, menu_overlay: false } });
    const food = await addInventoryObject(FOOD_RATION, { known: false, bknown: false, dknown: false });
    const jackal = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    game.flags.spot_monsters = true;
    pushKeys('\t\n' + ' '.repeat(20));
    await rhack(9);
    assert.equal(food.bknown, true, 'wizard identification revealed the blessing');
    assert.match(game._pending_message, /You see a jackal\..*food ration/, 'the menu redraw notice precedes the identified inventory item');
});
void test('inventory selection keeps the sighting produced by dismissing its menu', async () => {
    await freshObjectRoom({ flags: { menu_overlay: false } });
    const food = await addInventoryObject(FOOD_RATION);
    const jackal = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    game.flags.spot_monsters = true;
    pushKeys(`*${food.invlet}\n` + ' '.repeat(20));
    const selected = await chooseInventoryObject('eat', () => GETOBJ_SUGGEST);
    assert.equal(selected, food);
    assert.equal(game._pending_message, 'You see a jackal.');
});
void test('cancelling inventory selection follows the sighting from its menu redraw', async () => {
    await freshObjectRoom({ flags: { menu_overlay: false } });
    await addInventoryObject(FOOD_RATION);
    const jackal = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    jackal.mpeaceful = 0;
    game.flags.spot_monsters = true;
    pushKeys('*\x1b' + ' '.repeat(20));
    const selected = await chooseInventoryObject('eat', () => GETOBJ_SUGGEST);
    assert.equal(selected, null);
    assert.equal(game._pending_message, 'You see a jackal.  Never mind.');
});
//# sourceMappingURL=a11y_notices.test.js.map