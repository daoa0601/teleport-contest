import type { DisplayGlyph } from '../js/display.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BC_BALL, BC_CHAIN, PIT, SLP_GAS_TRAP } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { heroIsUnaware } from '../js/hero_sleep.js';
import { initRng } from '../js/rng.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { docrt, feel_location } from '../js/display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING,
    BOULDER,
    HEAVY_IRON_BALL,
    IRON_CHAIN,
    OBJECT_NAMES,
    ROCK,
} from '../js/object_data.js';
import { rhack } from '../js/cmd.js';
import { placeBallAndChain, setBallAndChainFelt } from '../js/ball.js';
import { pickupAtHero } from '../js/pickup.js';
import { polymonHero } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { moveObject } from '../js/floor_object.js';
import { moveHeroByTeleport } from '../js/teleport.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { punishHero, unpunishHero } from '../js/punishment.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

async function blindPunishedHero() {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await docrt();
    await punishHero();
    await setBallAndChainFelt(false);
    setHeroBlindnessTurns(20);
    vision_recalc(0);
}

void test('losing sight preserves the floor memory beneath both attachments', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);

    assert.equal(game.u.bc_felt, BC_CHAIN);
    assert.equal(game.u.bglyph?.kind, 'terrain');
    assert.equal(game.u.cglyph?.kind, 'terrain');
    assert.equal(game.u.bglyph?.ch, '.');
});

void test('feeling a pile detects only the exposed punishment attachment', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);

    feel_location(game.u.ux, game.u.uy);

    assert.equal(game.u.bc_felt, BC_CHAIN);
    await floorObject(ROCK, game.u.ux, game.u.uy);
    feel_location(game.u.ux, game.u.uy);
    assert.equal(game.u.bc_felt, 0);
});

void test('feeling another square clears both attachment touch flags', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);
    assert.equal(game.u.bc_felt, BC_CHAIN);

    feel_location(11, 10);

    assert.equal(game.u.bc_felt, 0);
});

void test('a dragging teleport restores felt chain memory before relocating the hero', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);
    await rhack('l'.charCodeAt(0));
    await rhack('l'.charCodeAt(0));
    feel_location(11, 10);
    assert.equal(game.u.bc_felt, BC_CHAIN);

    await moveHeroByTeleport(13, 10, game, { allowDrag: true });

    assert.deepEqual(
        [punishmentAttachment('uball').ox, punishmentAttachment('uball').oy],
        [11, 10],
    );
    assert.deepEqual(
        [punishmentAttachment('uchain').ox, punishmentAttachment('uchain').oy],
        [12, 10],
    );
    assert.equal(requireGameLevel().requireAt(11, 10).remembered_glyph?.kind, 'terrain');
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('a distant blind teleport forgets the old chain and remembers the destination floor', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);
    feel_location(10, 10);

    await moveHeroByTeleport(14, 10);

    assert.equal(requireGameLevel().requireAt(10, 10).remembered_glyph?.kind, 'terrain');
    assert.equal(game.u.bglyph?.kind, 'terrain');
    assert.equal(game.u.cglyph?.kind, 'terrain');
    assert.equal(game.u.bc_felt, BC_CHAIN);
    assert.deepEqual(
        [punishmentAttachment('uball').ox, punishmentAttachment('uchain').ox],
        [14, 14],
    );
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('a carried ball stays in inventory when blindness records the chain', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await punishHero();
    await pickupAtHero();
    assert.equal(punishmentAttachment('uball').where, 'inventory');

    await setBallAndChainFelt(false);
    setHeroBlindnessTurns(20);
    vision_recalc(0);
    await rhack('l'.charCodeAt(0));
    await rhack('l'.charCodeAt(0));

    assert.equal(punishmentAttachment('uball').where, 'inventory');
    assert.ok(game.inventory.includes(punishmentAttachment('uball')));
    assert.equal(game.u.bc_felt, 0);
    assert.deepEqual(
        [punishmentAttachment('uchain').ox, punishmentAttachment('uchain').oy],
        [11, 10],
    );
});

void test('blind ball memory and floor identity survive save and restore', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);
    feel_location(10, 10);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await rhack('l'.charCodeAt(0));
    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.cglyph?.kind, 'terrain');
    assert.ok(floorObjectsAt(requireGameLevel(), 10, 10).includes(punishmentAttachment('uball')));
    assert.ok(floorObjectsAt(requireGameLevel(), 11, 10).includes(punishmentAttachment('uchain')));
    assert.equal(game.u.bc_felt, 0);
});

for (const ballOnTop of [false, true]) {
    void test(`losing sight remembers the object beneath a ${ballOnTop ? 'ball-first' : 'chain-first'} pile`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        const rock = await floorObject(ROCK, 10, 10);
        await punishHero();
        if (ballOnTop) await moveObject(game.uball, 10, 10);
        const top = ballOnTop ? game.uball : game.uchain;

        await setBallAndChainFelt(false);
        setHeroBlindnessTurns(20);

        assert.equal(floorObjectsAt(requireGameLevel(), 10, 10)[0], top);
        assert.ok(floorObjectsAt(requireGameLevel(), 10, 10).includes(rock));
        assert.equal(objectGlyphType(game.u.bglyph), ROCK);
        assert.equal(objectGlyphType(game.u.cglyph), ROCK);
        assert.equal(game.u.bc_felt, BC_BALL | BC_CHAIN);
    });
}

void test('one blind step leaves both attachments within reach at their old square', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);

    await rhack('l'.charCodeAt(0));

    assert.equal(
        objectGlyphType(requireGameLevel().requireAt(10, 10).remembered_glyph),
        IRON_CHAIN,
    );
    assert.deepEqual(
        [punishmentAttachment('uball').ox, punishmentAttachment('uchain').ox],
        [10, 10],
    );
});

for (const [seed, sleepTurns] of [
    [7, 1],
    [48, 2],
    [5, 20],
] as const) {
    void test(`a costly drag after ${sleepTurns} turns of sleeping gas preserves Native delay precedence`, async () => {
        await blindPunishedHero();
        requirePlayingGame(game);
        await rhack('l'.charCodeAt(0));
        await rhack('l'.charCodeAt(0));
        addTrap(game.level, SLP_GAS_TRAP, 13, 10);
        initRng(BigInt(seed));

        await rhack('l'.charCodeAt(0));

        assert.equal(game._helplessTurns, Math.max(2, sleepTurns));
        assert.equal(heroIsUnaware(), sleepTurns > 2);
        assert.equal(game._helplessDoneMessage, '');
    });
}

for (const recover of [false, true]) {
    void test(`a fatal landing ${recover ? 'followed by life saving retains' : 'cuts off'} the dragging delay`, async () => {
        await blindPunishedHero();
        requirePlayingGame(game);
        if (recover) {
            const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        await rhack('l'.charCodeAt(0));
        await rhack('l'.charCodeAt(0));
        addTrap(game.level, PIT, 13, 10);
        game.u.uhp = 1;

        await rhack('l'.charCodeAt(0));

        assert.equal(!!game.program_state.gameover, !recover);
        assert.equal(game._helplessTurns ?? 0, recover ? 2 : 0);
    });
}

void test('feeling while levitating does not change which attachments are known by touch', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('levitation'));
    await wearHeroAccessory(ring, 'uleft');
    await floorObject(ROCK, 10, 10);

    feel_location(10, 10);

    assert.equal(game.u.bc_felt, BC_CHAIN);
});

void test('an adjacent relocation can drag both attachments without imposing a walking delay', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);
    await rhack('l'.charCodeAt(0));
    await rhack('l'.charCodeAt(0));

    await moveHeroByTeleport(13, 10, game, { allowDrag: true });

    assert.deepEqual(
        [punishmentAttachment('uball').ox, punishmentAttachment('uchain').ox, game.u.ux],
        [11, 12, 13],
    );
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('a distant relocation carries the pair even when its caller permits dragging', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);

    await moveHeroByTeleport(14, 10, game, { allowDrag: true });

    assert.deepEqual(
        [punishmentAttachment('uball').ox, punishmentAttachment('uchain').ox, game.u.ux],
        [14, 14, 14],
    );
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('new blind punishment remembers the felt chain rather than the hero overlay', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    setHeroBlindnessTurns(20);
    vision_recalc(0);

    await punishHero();

    assert.equal(game.u.bc_felt, BC_CHAIN);
    assert.equal(objectGlyphType(game.u.bglyph), IRON_CHAIN);
    assert.equal(objectGlyphType(game.u.cglyph), IRON_CHAIN);
});

void test('blind unpunishment replaces the destroyed chain with knowledge of the remaining ball', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);
    const chain = punishmentAttachment('uchain');
    const ball = punishmentAttachment('uball');

    await unpunishHero();

    assert.equal(chain.where, 'gone');
    assert.equal(game.uball, null);
    assert.equal((game.u.bc_felt ?? 0) & BC_CHAIN, 0);
    assert.equal(
        objectGlyphType(requireGameLevel().requireAt(10, 10).remembered_glyph),
        HEAVY_IRON_BALL,
    );
    assert.ok(floorObjectsAt(requireGameLevel(), 10, 10).includes(ball));
});

void test('placing an already placed chain reports the error without duplicating it or terminating play', async () => {
    await blindPunishedHero();
    requirePlayingGame(game);
    const chain = punishmentAttachment('uchain');

    await placeBallAndChain();

    assert.equal(
        floorObjectsAt(requireGameLevel(), 10, 10).filter((object) => object === chain).length,
        1,
    );
    assert.equal(chain.where, 'floor');
    assert.equal(!!game.program_state.gameover, false);
});

void test('a boulder above newly imposed blind punishment hides both attachments from touch', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await floorObject(BOULDER, 10, 10);
    setHeroBlindnessTurns(20);
    vision_recalc(0);

    await punishHero();

    assert.equal(game.u.bc_felt, 0);
    assert.equal(objectGlyphType(game.u.bglyph), BOULDER);
    assert.equal(objectGlyphType(game.u.cglyph), BOULDER);
});

void test('a blind flying hero can still feel the punishment chain', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await polymonHero(MONSTER_NAME.indexOf('vampire bat'));
    setHeroBlindnessTurns(20);
    vision_recalc(0);

    await punishHero();

    assert.equal(game.u.bc_felt, BC_CHAIN);
    assert.equal(objectGlyphType(game.u.cglyph), IRON_CHAIN);
});

function objectGlyphType(glyph: DisplayGlyph | null | undefined): number {
    assert.ok(glyph?.kind === 'object', 'the remembered square must contain an object glyph');
    return glyph.otyp;
}

function punishmentAttachment(slot: 'uball' | 'uchain') {
    const object = game[slot];
    assert.ok(object, `punishment must retain its ${slot === 'uball' ? 'ball' : 'chain'}`);
    return object;
}
