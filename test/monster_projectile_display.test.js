import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, STONE, W_WEP } from '../js/const.js';
import { canSeeMonster, flush_screen, objectColor, redrawMap } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterProjectileDisplay } from '../js/monster_projectile_display.js';
import { throwMonsterProjectile } from '../js/monster_throw.js';
import { AKLYS, POT_WATER } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { CLR_GRAY, CLR_WHITE, NO_COLOR } from '../js/terminal.js';
import { cansee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function screenCell(x, y) {
    const cell = requireGameDisplay(game).grid[y + 1]?.[x - 1];
    assert.ok(cell, `Expected a displayed map cell at ${x},${y}`);
    return cell;
}
void test('an unseen thrower starts a generic projectile glyph which stays frozen after visible flight reveals its appearance', async () => {
    freshObjectRoom({ heroX: 10, heroY: 12 });
    requirePlayingGame(game);
    const state = game;
    state.context.mon_moving = true;
    const source = await createMonsterAt('orc', 8, 10, NO_MINVENT | MM_NOGRP);
    source.minvis = 1;
    const potion = await knownObject(POT_WATER);
    const observedColor = objectColor(potion);
    assert.notEqual(observedColor, CLR_GRAY, 'The observed potion must have a distinct color');
    assert.notEqual(observedColor, NO_COLOR);
    await addObjectToMonsterInventory(source, potion);
    assert.equal(canSeeMonster(source), false);
    assert.equal(cansee(9, 10), true);
    await redrawMap();
    let visibleFrames = 0;
    state.animationFrame = async () => {
        const { x, y } = state.bhitpos;
        const cell = screenCell(x, y);
        assert.equal(cell.ch, '!');
        assert.equal(potion.dknown, true, 'The visible flight cell must reveal the object');
        assert.equal(cell.color, NO_COLOR, 'Flight keeps its initial generic gray glyph');
        visibleFrames++;
    };
    await throwMonsterProjectile(source, potion, {
        state, dx: 1, dy: 0, range: 3, random: limit => Math.min(1, limit - 1),
    });
    await flush_screen(1);
    assert.ok(visibleFrames >= 2, 'The projectile must travel through multiple visible cells');
    assert.equal(potion.where, 'floor');
    assert.equal(potion.dknown, true);
    assert.equal(screenCell(11, 10).color, observedColor, 'The landed object uses its discovered appearance');
});
void test('a sighted hero does not learn the appearance of a completely unseen throw', async () => {
    const level = freshObjectRoom({ heroX: 10, heroY: 12 });
    requirePlayingGame(game);
    const state = game;
    state.context.mon_moving = true;
    for (let x = 7; x <= 16; x++)
        level.requireAt(x, 10).typ = STONE;
    vision_note_blocker_change(10, 10);
    vision_recalc(0);
    const source = await createMonsterAt('orc', 8, 8, NO_MINVENT | MM_NOGRP);
    const potion = await knownObject(POT_WATER);
    await addObjectToMonsterInventory(source, potion);
    assert.equal(canSeeMonster(source), false);
    for (const x of [9, 10, 11])
        assert.equal(cansee(x, 8), false);
    let hiddenFrames = 0;
    state.animationFrame = async () => {
        assert.equal(potion.dknown, false, 'An unseen flight cannot reveal appearance knowledge');
        hiddenFrames++;
    };
    await throwMonsterProjectile(source, potion, {
        state, dx: 1, dy: 0, range: 3, random: limit => Math.min(1, limit - 1),
    });
    assert.ok(hiddenFrames > 0);
    assert.equal(potion.where, 'floor');
    assert.equal(potion.dknown, false);
    assert.ok(floorObjectsAt(level, 11, 8).includes(potion));
});
void test('an advancing tether leaves a white cord behind the weapon and clears every cell', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await redrawMap();
    const aklys = await knownObject(AKLYS);
    const flight = monsterProjectileDisplay(aklys, game, { tethered: true });
    await flight.show({ x: 11, y: 10 });
    await flight.show({ x: 12, y: 10 });
    await flight.show({ x: 13, y: 10 });
    assert.equal(screenCell(11, 10).ch, '─');
    assert.equal(screenCell(11, 10).color, CLR_WHITE);
    assert.equal(screenCell(12, 10).ch, '─');
    assert.equal(screenCell(13, 10).ch, ')');
    flight.clear();
    await flush_screen(1);
    for (const x of [11, 12, 13])
        assert.equal(screenCell(x, 10).ch, '.');
    assert.equal(aklys.where, 'free');
});
for (const { x, y, glyph } of [
    { x: 10, y: 9, glyph: '│' },
    { x: 11, y: 9, glyph: '/' },
    { x: 11, y: 11, glyph: '\\' },
    { x: 10, y: 10, glyph: '\\' },
]) {
    void test(`the tether at ${x},${y} uses the native direction toward the hero`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        await redrawMap();
        const flight = monsterProjectileDisplay(await knownObject(AKLYS), game, { tethered: true });
        await flight.show({ x, y });
        await flight.show({ x: x + 1, y });
        assert.equal(screenCell(x, y).ch, glyph);
        assert.equal(screenCell(x, y).color, CLR_WHITE);
        flight.clear();
    });
}
void test('a tether remains drawn outside current sight while an ordinary missile stays hidden', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await redrawMap();
    await makeBlinded(10, { talk: false });
    assert.equal(cansee(11, 10), false);
    const object = await knownObject(AKLYS);
    const ordinary = monsterProjectileDisplay(object, game);
    await ordinary.show({ x: 11, y: 10 });
    assert.notEqual(screenCell(11, 10).ch, ')');
    ordinary.clear();
    const tether = monsterProjectileDisplay(object, game, { tethered: true });
    await tether.show({ x: 11, y: 10 });
    await tether.show({ x: 12, y: 10 });
    assert.equal(screenCell(11, 10).ch, '─');
    assert.equal(screenCell(12, 10).ch, ')');
    tether.clear();
    await flush_screen(1);
    assert.notEqual(screenCell(11, 10).ch, '─');
    assert.notEqual(screenCell(12, 10).ch, ')');
});
void test('a returning tether steps inward before its first return frame', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await redrawMap();
    const flight = monsterProjectileDisplay(await knownObject(AKLYS), game, { tethered: true });
    await flight.show({ x: 11, y: 10 });
    await flight.show({ x: 12, y: 10 });
    await flight.show({ x: 13, y: 10 });
    const weaponPositions = [];
    game.animationFrame = async () => {
        const x = [11, 12, 13].find(column => screenCell(column, 10).ch === ')');
        assert.ok(x, 'Each return frame must show the weapon on the remaining tether');
        weaponPositions.push(x);
        assert.equal(screenCell(13, 10).ch, '.');
    };
    await flight.backtrack();
    await flush_screen(1);
    assert.deepEqual(weaponPositions, [12, 11]);
    for (const x of [11, 12, 13])
        assert.equal(screenCell(x, 10).ch, '.');
});
void test('clearing a tether after game over restores its whole trail without a return animation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await redrawMap();
    const flight = monsterProjectileDisplay(await knownObject(AKLYS), game, { tethered: true });
    await flight.show({ x: 11, y: 10 });
    await flight.show({ x: 12, y: 10 });
    await flight.show({ x: 13, y: 10 });
    game.program_state.gameover = true;
    flight.clear();
    flight.clear();
    await flush_screen(1);
    for (const x of [11, 12, 13])
        assert.equal(screenCell(x, 10).ch, '.');
});
for (const returns of [false, true]) {
    void test(`a monster's actual aklys flight clears its tether after ${returns ? 'being caught' : 'snapping'}`, async () => {
        const level = freshObjectRoom({ heroX: 10, heroY: 12 });
        requirePlayingGame(game);
        game.context.mon_moving = true;
        const source = await createMonsterAt('orc', 8, 10, NO_MINVENT | MM_NOGRP);
        const aklys = await equipMonsterObject(source, await knownObject(AKLYS), W_WEP);
        await redrawMap();
        const farthestFrames = [];
        let sawCord = false;
        game.animationFrame = async () => {
            if (screenCell(11, 10).ch === ')')
                farthestFrames.push(11);
            if (screenCell(10, 10).ch === '│')
                sawCord = true;
        };
        await throwMonsterProjectile(source, aklys, {
            dx: 1, dy: 0, range: 3,
            random: limit => limit === 100 ? Number(returns) : Math.min(1, limit - 1),
        });
        await flush_screen(1);
        assert.equal(sawCord, true);
        assert.equal(farthestFrames.length, 1, 'The endpoint must appear only once before return or cleanup');
        assert.equal(screenCell(9, 10).ch, '.');
        assert.equal(screenCell(10, 10).ch, '.');
        if (returns) {
            assert.equal(source.mw, aklys);
            assert.equal(aklys.where, 'minvent');
            assert.equal(screenCell(11, 10).ch, '.');
        }
        else {
            assert.equal(aklys.where, 'floor');
            assert.ok(floorObjectsAt(level, 11, 10).includes(aklys));
            assert.equal(screenCell(11, 10).ch, ')');
        }
    });
}
//# sourceMappingURL=monster_projectile_display.test.js.map