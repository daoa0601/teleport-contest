import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { ARROW_TRAP, DBWALL, DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_CLOSED, D_LOCKED, ENGRAVE, HEADSTONE, HOLE, MAGIC_PORTAL, MAGIC_TRAP, MFAST, MSLOW, ROOM, SDOOR, STONE, TRAPDOOR, TT_BEARTRAP, BEAR_TRAP, } from '../js/const.js';
import { map_invisible } from '../js/display.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { buryObject } from '../js/buried_object.js';
import { game } from '../js/gstate.js';
import { useHeroHide } from '../js/hero_hide.js';
import { resetInputState } from '../js/input.js';
import { CHEST, DAGGER, HELMET, POT_FRUIT_JUICE, POT_SICKNESS, ROCK, SPE_EXTRA_HEALING, WAN_CANCELLATION, WAN_LOCKING, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING, WAN_SECRET_DOOR_DETECTION, WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS, WAN_STRIKING, WAN_TELEPORTATION, } from '../js/object_data.js';
import { objectTypeKnown } from '../js/shk.js';
import { doride } from '../js/steed.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { applyWandEffect } from '../js/wand_effects.js';
import { addInventoryObject, chargedWand, floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
function room(options = {}) {
    const level = freshGameplayRoom(options);
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /jackal|pony|purple worm|door|trap|rock|ceiling|engraving|probe|dagger|buried|shudder|hidden/i,
        limit: 30,
    });
    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    return level;
}
async function zap(type, direction = [1, 0, 0], properties = {}) {
    requirePlayingGame(game);
    game.u.dx = direction[0];
    game.u.dy = direction[1];
    game.u.dz = direction[2];
    const object = await chargedWand(type, properties);
    await applyWandEffect(object);
    return object;
}
void test('an immediate wand reaches successive monsters and stops at solid terrain', async () => {
    const level = room();
    requirePlayingGame(game);
    const first = await createMonsterAt('jackal', 11, 10);
    const second = await createMonsterAt('jackal', 12, 10);
    level.requireAt(13, 10).typ = STONE;
    const beyond = await createMonsterAt('jackal', 14, 10);
    await zap(WAN_SPEED_MONSTER);
    assert.equal(first.mspeed, MFAST);
    assert.equal(second.mspeed, MFAST);
    assert.equal(beyond.mspeed, 0);
});
void test('an immediate wand affects a floor pile even without a monster', async () => {
    room();
    requirePlayingGame(game);
    const potion = await floorObject(POT_SICKNESS, 11, 10, { cursed: true });
    const dagger = await floorObject(DAGGER, 12, 10, { spe: 3 });
    await zap(WAN_CANCELLATION);
    assert.equal(potion.otyp, POT_FRUIT_JUICE);
    assert.equal(potion.cursed, false);
    assert.equal(dagger.spe, 0);
});
void test('opening magic unlocks a door but does not pass through it', async () => {
    const level = room();
    requirePlayingGame(game);
    const doorSquare = level.requireAt(11, 10);
    doorSquare.typ = DOOR;
    doorSquare.doormask = D_LOCKED;
    const chest = await floorObject(CHEST, 12, 10, { olocked: true });
    await zap(WAN_OPENING);
    assert.equal(level.requireAt(11, 10).doormask, D_CLOSED);
    assert.equal(chest.olocked, true);
    assert.equal(game.bhitpos.x, 10);
});
void test('opening a secret door reveals a closed door and stops at the old wall', async () => {
    const level = room();
    requirePlayingGame(game);
    const secretDoorSquare = level.requireAt(11, 10);
    secretDoorSquare.typ = SDOOR;
    secretDoorSquare.doormask = D_LOCKED;
    await zap(WAN_OPENING);
    assert.equal(level.requireAt(11, 10).typ, DOOR);
    assert.equal(level.requireAt(11, 10).doormask, D_CLOSED);
    assert.equal(game.bhitpos.x, 10);
});
void test('a swallowed immediate wand targets the engulfer instead of a floor beam', async () => {
    room();
    requirePlayingGame(game);
    const engulfer = await createMonsterAt('purple worm', 10, 10);
    game.u.uswallow = true;
    game.u.ustuck = engulfer;
    const other = await createMonsterAt('jackal', 11, 10);
    await zap(WAN_SLOW_MONSTER);
    assert.equal(engulfer.mspeed, MSLOW);
    assert.equal(other.mspeed, 0);
});
void test('downward speed magic targets the mounted steed', async () => {
    room({ role: 'knight', heroLevel: 30 });
    requirePlayingGame(game);
    const steed = await createSaddledSteed();
    const input = resetInputState();
    await answerPrompts(doride(), input, [{ prompt: /In what direction/, keys: 'l' }]);
    installPagerInput(input, { expected: /pony|mount|steed/i, limit: 4 });
    await zap(WAN_SPEED_MONSTER, [0, 0, 1]);
    assert.equal(game.u.usteed, steed);
    assert.equal(steed.mspeed, MFAST);
});
void test('a healing spell pointed down heals the mounted steed', async () => {
    room({ role: 'knight', heroLevel: 30 });
    requirePlayingGame(game);
    const steed = await createSaddledSteed();
    const input = resetInputState();
    await answerPrompts(doride(), input, [{ prompt: /In what direction/, keys: 'l' }]);
    installPagerInput(input, { expected: /pony|mount|steed/i, limit: 4 });
    steed.mhp = 1;
    const source = await knownObject(SPE_EXTRA_HEALING, { oclass: 10 });
    game.u.dx = 0;
    game.u.dy = 0;
    game.u.dz = 1;
    await applyWandEffect(source);
    assert.ok(steed.mhp > 1);
    assert.equal(steed.mpeaceful, 1);
});
void test('opening down releases a holding trap before changing floor boxes', async () => {
    const level = room();
    requirePlayingGame(game);
    const trap = addTrap(level, BEAR_TRAP, 10, 10, { tseen: true });
    game.u.utrap = 5;
    game.u.utraptype = TT_BEARTRAP;
    const chest = await floorObject(CHEST, 10, 10, { olocked: true });
    await zap(WAN_OPENING, [0, 0, 1]);
    assert.equal(game.u.utrap, 0);
    assert.equal(trap.ttyp, BEAR_TRAP);
    assert.equal(chest.olocked, false);
});
void test('locking down turns a known hole into a trapdoor without making the hero fall', async () => {
    const level = room();
    requirePlayingGame(game);
    const trap = addTrap(level, HOLE, 10, 10, { tseen: true });
    await zap(WAN_LOCKING, [0, 0, 1]);
    assert.equal(trap.ttyp, TRAPDOOR);
    assert.equal(game.level, level);
    assert.match(game._pending_message, /trapdoor appears beneath you/);
});
void test('striking down shatters a trapdoor while a levitating hero stays above it', async () => {
    const level = room();
    requirePlayingGame(game);
    const trap = addTrap(level, TRAPDOOR, 10, 10, { tseen: true });
    game.u.levitating = true;
    await zap(WAN_STRIKING, [0, 0, 1]);
    assert.equal(trap.ttyp, HOLE);
    assert.equal(game.level, level);
});
void test('downward cancellation erases an engraving and leaves a headstone intact', async () => {
    room();
    requirePlayingGame(game);
    makeEngravingAt(10, 10, 'Keep out', null, 0, ENGRAVE);
    await zap(WAN_CANCELLATION, [0, 0, 1]);
    assert.equal(engravingAt(10, 10), null);
    const grave = makeEngravingAt(10, 10, 'Rest in peace', null, 0, HEADSTONE);
    await zap(WAN_CANCELLATION, [0, 0, 1]);
    assert.equal(engravingAt(10, 10), grave);
});
void test('downward polymorph replaces engraving text and chooses an actual writing type', async () => {
    room();
    requirePlayingGame(game);
    const old = makeEngravingAt(10, 10, 'An old message', null, 0, ENGRAVE);
    await zap(WAN_POLYMORPH, [0, 0, 1]);
    const changed = engravingAt(10, 10);
    assert.notEqual(changed, old);
    assert.ok(changed !== undefined && changed !== null, 'Expected changed to be initialized');
    assert.ok(changed.text.length);
    assert.ok(changed.engr_type >= 1 && changed.engr_type < HEADSTONE);
    assert.equal(changed.rememberedText, changed.text);
});
void test('downward teleportation relocates the same engraving onto another floor', async () => {
    room();
    requirePlayingGame(game);
    const engraving = makeEngravingAt(10, 10, 'A traveler was here', null, 0, ENGRAVE);
    await zap(WAN_TELEPORTATION, [0, 0, 1]);
    assert.equal(engravingAt(10, 10), null);
    assert.ok(engraving !== undefined && engraving !== null, 'Expected engraving to be initialized');
    assert.equal(engravingAt(engraving.x, engraving.y), engraving);
    assert.equal(game.level.requireAt(engraving.x, engraving.y).typ, ROOM);
});
void test('a hidden hero zapping up affects only the covering object', async () => {
    room();
    requirePlayingGame(game);
    installPolymorphedHero('garter snake');
    const below = await floorObject(DAGGER, 10, 10, { spe: 3 });
    const cover = await floorObject(POT_SICKNESS, 10, 10);
    await useHeroHide();
    assert.ok(game.u.uundetected);
    await zap(WAN_CANCELLATION, [0, 0, -1]);
    assert.equal(cover.otyp, POT_FRUIT_JUICE);
    assert.equal(below.spe, 3);
    await zap(WAN_CANCELLATION, [0, 0, 1]);
    assert.equal(below.spe, 0);
});
void test('striking the ceiling leaves its falling rock and a hard helmet limits damage', async () => {
    room();
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(HELMET));
    const health = game.u.uhp;
    for (let attempt = 0; attempt < 10 && game.u.uhp === health; attempt++)
        await zap(WAN_STRIKING, [0, 0, -1]);
    assert.ok(game.u.uhp < health && game.u.uhp >= health - 2);
    assert.ok(game.level.objects[10] !== undefined && game.level.objects[10] !== null);
    assert.ok(game.level.objects[10]?.[10] !== undefined && game.level.objects[10]?.[10] !== null);
    assert.ok(game.level.objects[10][10].some(object => object.otyp === ROCK));
});
void test('probing reveals a secret door and an unseen floor trap along its path', async () => {
    const level = room();
    requirePlayingGame(game);
    const trap = addTrap(level, ARROW_TRAP, 11, 10, { tseen: false });
    const secretDoorSquare = level.requireAt(12, 10);
    secretDoorSquare.typ = SDOOR;
    secretDoorSquare.doormask = D_LOCKED;
    vision_note_blocker_change(12, 10);
    vision_recalc(0);
    await zap(WAN_PROBING);
    assert.ok(trap.tseen);
    assert.equal(level.requireAt(12, 10).typ, DOOR);
    assert.equal(level.requireAt(12, 10).doormask, D_LOCKED);
});
void test('probing removes an empty remembered invisible monster marker', async () => {
    const level = room();
    requirePlayingGame(game);
    map_invisible(11, 10);
    await zap(WAN_PROBING);
    assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
});
void test('probing down identifies buried objects without digging them up', async () => {
    room();
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10, { dknown: false });
    await buryObject(dagger);
    const input = resetInputState();
    await answerPrompts(zap(WAN_PROBING, [0, 0, 1]), input, [
        { prompt: /probe beneath the floor[\s\S]*--More--/, keys: ' ' },
        { prompt: /Things that are buried[\s\S]*dagger[\s\S]*\(end\)/, keys: ' ' },
    ]);
    assert.equal(dagger.dknown, true);
    assert.equal(dagger.where, 'buried');
    assert.ok(game.level.buriedObjects !== undefined && game.level.buriedObjects !== null, 'Expected game.level.buriedObjects to be initialized');
    assert.ok(game.level.buriedObjects.includes(dagger));
});
void test('buried probing resumes through the real message and inventory input boundary', async () => {
    room();
    requirePlayingGame(game);
    const dagger = await floorObject(DAGGER, 10, 10, { dknown: false });
    await buryObject(dagger);
    const wand = await chargedWand(WAN_PROBING);
    game.u.dx = 0;
    game.u.dy = 0;
    game.u.dz = 1;
    const input = resetInputState();
    let complete = false;
    const action = applyWandEffect(wand).then(() => { complete = true; });
    try {
        await input.waitUntilBlocked();
        assert.equal(complete, false);
        assert.match(game._pending_message, /probe beneath the floor/);
        assert.equal(dagger.dknown, true);
    }
    finally {
        await answerPrompts(action, input, [
            { prompt: /probe beneath the floor[\s\S]*--More--/, keys: ' ' },
            { prompt: /Things that are buried[\s\S]*dagger/, keys: ' ' },
        ]);
    }
    assert.equal(complete, true);
    assert.equal(dagger.where, 'buried');
});
void test('cancellation explodes magical traps but preserves a magic portal', async () => {
    const level = room();
    requirePlayingGame(game);
    game.u.uhp = 1000;
    game.u.uhpmax = 1000;
    const trap = addTrap(level, MAGIC_TRAP, 11, 10, { tseen: false });
    const portal = addTrap(level, MAGIC_PORTAL, 12, 10, { tseen: false });
    await zap(WAN_CANCELLATION);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(level.traps.includes(portal), true);
    assert.ok(portal.tseen);
    assert.ok(game.u.uhp < 1000);
});
void test('opening laterally lowers a drawbridge when its portcullis is struck', async () => {
    const level = room();
    requirePlayingGame(game);
    game.u.uy = 9;
    const drawbridgeSquare = level.requireAt(12, 10);
    drawbridgeSquare.typ = DRAWBRIDGE_UP;
    drawbridgeSquare.drawbridgemask = DB_NORTH | DB_MOAT;
    level.requireAt(12, 9).typ = DBWALL;
    await zap(WAN_OPENING);
    assert.equal(level.requireAt(12, 10).typ, DRAWBRIDGE_DOWN);
    assert.equal(level.requireAt(12, 9).typ, DOOR);
});
void test('directionless secret detection discovers itself even when it finds nothing', async () => {
    room();
    requirePlayingGame(game);
    const source = await zap(WAN_SECRET_DOOR_DETECTION, [0, 0, 0], { typeKnown: false });
    assert.equal(objectTypeKnown(source), true);
    assert.equal(game.u.urexp, 10);
});
void test('stasis extends the teleport prohibition without shortening an existing effect', async () => {
    const level = room();
    requirePlayingGame(game);
    const wand = await zap(WAN_STASIS, [0, 0, 0], { typeKnown: false });
    assert.ok(level.flags.stasis_until !== undefined && level.flags.stasis_until !== null, 'Expected level.flags.stasis_until to be initialized');
    assert.ok(level.flags.stasis_until >= game.moves + 10);
    level.flags.stasis_until = game.moves + 100;
    await zap(WAN_STASIS, [0, 0, 0], { typeKnown: false });
    assert.equal(level.flags.stasis_until, game.moves + 100);
    assert.equal(objectTypeKnown(wand), false);
});
//# sourceMappingURL=wand_effects.test.js.map