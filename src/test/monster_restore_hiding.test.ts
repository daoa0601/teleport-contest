import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, LAVAPOOL, M_AP_OBJECT, M_AP_TYPE, PIT, POOL, STONE, WEB } from '../js/const.js';
import { canSeeMonster, flush_screen, glyphAt, newsym, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { nameToMonster } from '../js/mondata.js';
import { revealMonsterAppearance } from '../js/monster_appearance.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { attemptMonsterRestrap, hideMonsterOnRestore, hideMonsterUnder, maybeUnhideAt } from '../js/monster_hiding.js';
import { APPLE, CORPSE, GOLD_PIECE, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { cansee, couldsee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import type { Monster } from '../js/monster_types.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function unseenMonster(species: string, x = 12, y = 10): Promise<Monster> {
    const monster = await createMonsterAt(species, x, y);
    monster.minvis = true;
    monster.mundetected = 0;
    return monster;
}

async function restoreUntilHidden(monster: Monster): Promise<void> {
    initRng(671n);
    for (let attempt = 0; attempt < 20 && !monster.mundetected && !M_AP_TYPE(monster); attempt++)
        await hideMonsterOnRestore(monster);
}

void test('restored mimics disguise themselves with floor objects and preserve the square vision', async () => {
    freshObjectRoom();
    const mimic = await createMonsterAt('small mimic', 12, 10);
    revealMonsterAppearance(mimic);
    await floorObject(APPLE, 12, 10);
    assert.equal(cansee(12, 10), true);
    assert.equal(couldsee(12, 10), true);
    assert.equal(await attemptMonsterRestrap(mimic), false, 'an ordinarily watched mimic cannot disguise itself');

    await restoreUntilHidden(mimic);

    assert.equal(M_AP_TYPE(mimic), M_AP_OBJECT);
    assert.equal(mimic.mappearance, APPLE);
    assert.equal(!!mimic.mundetected, false);
    assert.equal(cansee(12, 10), true);
    assert.equal(couldsee(12, 10), true);
});

void test('restoration does not disguise a cancelled, sleeping, or frozen mimic', async () => {
    for (const condition of ['cancelled', 'sleeping', 'frozen'] as const) {
        freshObjectRoom();
        const mimic = await createMonsterAt('small mimic', 12, 10);
        revealMonsterAppearance(mimic);
        if (condition === 'cancelled') mimic.mcan = true;
        if (condition === 'sleeping') mimic.msleeping = true;
        if (condition === 'frozen') mimic.mfrozen = 5;

        await restoreUntilHidden(mimic);

        assert.equal(M_AP_TYPE(mimic), 0, condition);
        assert.equal(!!mimic.mundetected, false, condition);
        assert.equal(cansee(12, 10), true, condition);
    }
});

void test('restored trappers hide on room floors, while ceiling hiders need a ceiling', async () => {
    freshObjectRoom();
    const trapper = await createMonsterAt('trapper', 12, 10);
    trapper.mundetected = 0;
    await restoreUntilHidden(trapper);
    assert.equal(!!trapper.mundetected, true);

    const piercer = await createMonsterAt('rock piercer', 13, 10);
    piercer.mundetected = 0;
    const earth = { dnum: 9, dlevel: 1 };
    game.astral_level = { dnum: 9, dlevel: 5, flags: { town: false }, alignment: null };
    game.earth_level = { ...earth, flags: { town: false }, alignment: null };
    game.u.uz = { dnum: 9, dlevel: 3 };
    await restoreUntilHidden(piercer);
    assert.equal(!!piercer.mundetected, false);
    game.u.uz = { ...earth };
    await restoreUntilHidden(piercer);
    assert.equal(!!piercer.mundetected, true);
});

void test('restored floor hiders reject corridors, holds, and non-pit traps', async () => {
    freshObjectRoom();
    const trapper = await createMonsterAt('trapper', 12, 10);
    trapper.mundetected = 0;
    requireGameLevel().requireAt(12, 10).typ = CORR;
    await restoreUntilHidden(trapper);
    assert.equal(!!trapper.mundetected, false);

    const piercer = await createMonsterAt('rock piercer', 13, 10);
    piercer.mundetected = 0;
    game.u.ustuck = piercer;
    await restoreUntilHidden(piercer);
    assert.equal(!!piercer.mundetected, false);
    game.u.ustuck = null;
    await maketrap(13, 10, WEB);
    piercer.mtrapped = true;
    await restoreUntilHidden(piercer);
    assert.equal(!!piercer.mundetected, false);
});

void test('a sensed adjacent hider remains exposed during restoration', async () => {
    freshObjectRoom({ hero: { detectMonsters: true } });
    const piercer = await createMonsterAt('rock piercer', 11, 10);
    piercer.mundetected = 0;

    await restoreUntilHidden(piercer);

    assert.equal(!!piercer.mundetected, false);
    assert.equal(cansee(11, 10), true);
});

void test('concealers need ten coins or a non-coin object to hide underneath', async () => {
    freshObjectRoom();
    const spider = await unseenMonster('cave spider');
    const coins = await floorObject(GOLD_PIECE, 12, 10, { quan: 9 });
    assert.equal(await hideMonsterUnder(spider), false);
    coins.quan = coins.quantity = 10;
    assert.equal(await hideMonsterUnder(spider), true);
    coins.quan = coins.quantity = 9;
    maybeUnhideAt(12, 10);
    assert.equal(!!spider.mundetected, false);
    await floorObject(ROCK, 12, 10);
    assert.equal(await hideMonsterUnder(spider), true);
});

void test('tame concealers refuse every pile containing a cursed item', async () => {
    freshObjectRoom();
    const spider = await unseenMonster('cave spider');
    initializePet(spider);
    await floorObject(ROCK, 12, 10);
    const cursed = await floorObject(APPLE, 12, 10, { cursed: true });
    assert.equal(await hideMonsterUnder(spider), false);
    cursed.cursed = false;
    assert.equal(await hideMonsterUnder(spider), true);
    cursed.cursed = true;
    assert.equal(await hideMonsterUnder(spider), false, 'returning residents revalidate their old cover');
    spider.mtame = 0;
    assert.equal(await hideMonsterUnder(spider), true);
});

void test('petrifying corpses alone cannot cover an unresistant concealer', async () => {
    freshObjectRoom();
    const spider = await unseenMonster('cave spider');
    await floorObject(CORPSE, 12, 10, { corpsenm: nameToMonster('cockatrice') });
    assert.equal(await hideMonsterUnder(spider), false);
    spider.mintrinsics = 0x80;
    assert.equal(await hideMonsterUnder(spider), true);
    spider.mintrinsics = 0;
    await floorObject(ROCK, 12, 10);
    assert.equal(await hideMonsterUnder(spider), true);
});

void test('non-pit traps and liquids prevent concealment beneath objects', async () => {
    freshObjectRoom();
    const spider = await unseenMonster('cave spider');
    await floorObject(ROCK, 12, 10);
    const trap = await maketrap(12, 10, WEB);
    assert.ok(trap);
    assert.equal(await hideMonsterUnder(spider), false);
    trap.ttyp = PIT;
    assert.equal(await hideMonsterUnder(spider), true);
    spider.mtrapped = true;
    assert.equal(await hideMonsterUnder(spider), false);
    spider.mtrapped = false;
    requireGameLevel().requireAt(12, 10).typ = POOL;
    assert.equal(await hideMonsterUnder(spider), false);
    requireGameLevel().requireAt(12, 10).typ = LAVAPOOL;
    assert.equal(await hideMonsterUnder(spider), false);
});

void test('eels cannot hide from an underwater hero with line of sight or on the Water Plane', async () => {
    freshObjectRoom();
    const level = requireGameLevel();
    level.requireAt(12, 10).typ = POOL;
    const eel = await unseenMonster('giant eel');
    assert.equal(await hideMonsterUnder(eel), true);
    game.u.uinwater = true;
    assert.equal(await hideMonsterUnder(eel), false);
    for (let y = 6; y <= 14; y++) {
        level.requireAt(11, y).typ = STONE;
        vision_note_blocker_change(11, y);
    }
    vision_recalc(0);
    assert.equal(couldsee(12, 10), false);
    assert.equal(await hideMonsterUnder(eel), true);
    const currentLevel = game.u.uz;
    if (!currentLevel) throw new Error('The test hero needs a current dungeon level.');
    game.water_level = { ...currentLevel, flags: { town: false }, alignment: null };
    assert.equal(await hideMonsterUnder(eel), false);
});

void test('visible hiding names the pet before concealment and repaints after the pending message', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    const snake = await createMonsterAt('garter snake', 12, 10);
    initializePet(snake);
    setMonsterGivenName(snake, 'Ribbon');
    snake.mundetected = 0;
    await floorObject(APPLE, 12, 10);
    newsym(12, 10);
    await flush_screen();
    assert.equal(canSeeMonster(snake), true);
    const snakeDisplayRow = snake.my + 1;
    const snakeDisplayColumn = snake.mx - 1;
    const before = game.nhDisplay?.grid[snakeDisplayRow]?.[snakeDisplayColumn]?.ch;
    assert.equal(before, 'S');
    await plineWithContinuation('A previous message fills the top line before the snake hides.');

    const hiding = hideMonsterUnder(snake);
    await input.waitUntilBlocked();
    assert.equal(game.nhDisplay?.grid[snakeDisplayRow]?.[snakeDisplayColumn]?.ch, before);
    const visibleTopline = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(visibleTopline, /A previous message.*--More--/);
    input.feed(' ');
    assert.equal(await hiding, true);
    await flush_screen();

    assert.match(game._pending_message, /You see Ribbon slither under an apple\./);
    assert.equal(glyphAt(12, 10)?.kind, 'object');
    assert.equal(game.nhDisplay?.grid[snakeDisplayRow]?.[snakeDisplayColumn]?.ch, '%');
});
