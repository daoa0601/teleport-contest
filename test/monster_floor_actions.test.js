import assert from 'node:assert/strict';
import test from 'node:test';
import { moveMonsterForHeroAttack } from '../js/allmain.js';
import { MMOVE_DONE, MMOVE_NOMOVES, MMOVE_NOTHING, MM_NOGRP, NO_MINVENT, POLY_TRAP, POOL, ROOM } from '../js/const.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { pickUpMonsterFloorObject } from '../js/monster_pickup.js';
import { CORPSE, DAGGER, GOLD_PIECE, SACK, SCR_BLANK_PAPER, WAN_STRIKING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { objectTypeKnown } from '../js/shk.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function floorActionRoom(species, { verbose = true, corridor = false } = {}) {
    const level = freshObjectRoom({
        flags: { verbose },
        ...(corridor ? { left: 10, right: 14, top: 10, bottom: 10 } : {}),
    });
    const monster = await createMonsterAt(species, 12, 10, MM_NOGRP | NO_MINVENT);
    monster.msleeping = 0;
    monster.mcanmove = 1;
    monster.mpeaceful = 0;
    monster.mflee = 1;
    monster.mfleetim = 20;
    const input = resetInputState();
    const seen = [];
    input.beforeRead = () => { seen.push(screenText()); };
    installPagerInput(input, {
        expected: /picks up|eats|engulfs|slurping|corpse|wand|gold pieces|passage|turns into/,
        limit: 8,
    });
    return { level, monster, input, text: () => [...seen, screenText()].join('\n') };
}
function screenText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
void test('a purple worm acts on its underfoot corpse goal without taking the corpse into inventory', async () => {
    const { level, monster, text } = await floorActionRoom('purple worm');
    const corpse = await floorObject(CORPSE, 12, 10, { corpsenm: MONSTER_NAME.indexOf('newt') });
    const result = await moveMonsterForHeroAttack(monster);
    await flushPendingTopline();
    assert.equal(result.status, MMOVE_DONE);
    assert.equal(monster.mx, 12);
    assert.equal(monster.my, 10);
    assert.equal(corpse.where, 'gone');
    assert.equal(floorObjectsAt(level, 12, 10).includes(corpse), false);
    assert.equal(monster.minvent?.includes(corpse) ?? false, false);
    assert.match(text(), /purple worm eats .*newt corpse/);
});
void test('a cube eats a scroll while completing its underfoot object-search action', async () => {
    const { monster, text } = await floorActionRoom('gelatinous cube');
    const scroll = await floorObject(SCR_BLANK_PAPER, 12, 10);
    initRng(91n);
    const result = await moveMonsterForHeroAttack(monster);
    await flushPendingTopline();
    assert.equal(result.status, MMOVE_DONE);
    assert.equal(scroll.where, 'gone');
    assert.equal(monster.minvent?.includes(scroll) ?? false, false);
    assert.equal(monster.meating ?? 0, 0);
    assert.match(text(), /gelatinous cube eats/);
});
void test('a paused pickup leaves its object on the floor until the message resumes', async () => {
    const { monster, level, input, text } = await floorActionRoom('leprechaun');
    const coins = await floorObject(GOLD_PIECE, 12, 10, { quan: 30 });
    await plineWithContinuation('The long passage disappears into the darkness beyond the distant doorway.');
    const recordScreen = input.beforeRead;
    let sawFloorBeforePickup = false;
    input.beforeRead = async () => {
        await recordScreen?.();
        if (!screenText().includes('long passage'))
            return;
        sawFloorBeforePickup = true;
        assert.equal(coins.where, 'floor');
        assert.ok(floorObjectsAt(level, 12, 10).includes(coins));
        assert.equal(monster.minvent?.includes(coins) ?? false, false);
    };
    const result = await moveMonsterForHeroAttack(monster);
    await flushPendingTopline();
    assert.equal(sawFloorBeforePickup, true);
    assert.equal(result.status, MMOVE_DONE);
    assert.ok(monster.minvent?.includes(coins));
    assert.equal(floorObjectsAt(level, 12, 10).includes(coins), false);
    assert.match(text(), /leprechaun picks up 30 gold pieces/);
});
void test('a handless collector takes one coin and leaves the remaining stack on the floor', async () => {
    const { monster, level, input } = await floorActionRoom('rock mole');
    requirePlayingGame(game);
    const coins = await floorObject(GOLD_PIECE, 12, 10, { quan: 30 });
    await plineWithContinuation('The long passage disappears into the darkness beyond the distant doorway.');
    let pausedBeforeTransfer = false;
    input.beforeRead = () => {
        if (!screenText().includes('long passage'))
            return;
        pausedBeforeTransfer = true;
        const floorCoins = floorObjectsAt(level, 12, 10).filter(object => object.otyp === GOLD_PIECE);
        assert.equal(floorCoins.reduce((total, object) => total + object.quan, 0), 30);
        assert.equal(monster.minvent?.some(object => object.otyp === GOLD_PIECE) ?? false, false);
    };
    assert.equal(await pickUpMonsterFloorObject(monster, game), true);
    assert.equal(pausedBeforeTransfer, true);
    assert.equal(coins.quan, 29);
    assert.ok(floorObjectsAt(level, 12, 10).includes(coins));
    const carried = monster.minvent?.find(object => object.otyp === GOLD_PIECE);
    assert.ok(carried);
    assert.equal(carried.quan, 1);
    assert.equal(carried.where, 'minvent');
});
void test('a flying monster cannot pick up coins beneath the water', async () => {
    const { monster, level } = await floorActionRoom('red dragon');
    requirePlayingGame(game);
    const coins = await floorObject(GOLD_PIECE, 12, 10, { quan: 30 });
    level.requireAt(12, 10).typ = POOL;
    assert.equal(await pickUpMonsterFloorObject(monster, game), false);
    assert.ok(floorObjectsAt(level, 12, 10).includes(coins));
    assert.equal(monster.minvent?.includes(coins) ?? false, false);
    level.requireAt(12, 10).typ = ROOM;
    assert.equal(await pickUpMonsterFloorObject(monster, game), true);
    assert.ok(monster.minvent?.includes(coins));
});
void test('quiet nearby pickup still teaches an object appearance without revealing its type', async () => {
    const { monster, text } = await floorActionRoom('goblin', { verbose: false });
    requirePlayingGame(game);
    const wand = await floorObject(WAN_STRIKING, 12, 10, {
        dknown: false, known: false, typeKnown: false, spe: 3,
    });
    assert.equal(objectTypeKnown(wand, game), false, 'The wand type must start undiscovered');
    assert.equal(await pickUpMonsterFloorObject(monster, game), true);
    assert.ok(monster.minvent?.includes(wand));
    assert.equal(wand.dknown, true);
    assert.equal(wand.known, false);
    assert.equal(objectTypeKnown(wand, game), false, 'Watching pickup must not identify the wand type');
    assert.doesNotMatch(text(), /picks up/);
});
void test('hallucinated pickup describes an unobserved sack as a bag', async () => {
    const { monster, text } = await floorActionRoom('goblin');
    requirePlayingGame(game);
    const sack = await floorObject(SACK, 12, 10, {
        dknown: false, bknown: false, known: false, typeKnown: false,
    });
    await makeHallucinated(20, { talk: false });
    assert.equal(await pickUpMonsterFloorObject(monster, game), true);
    await flushPendingTopline();
    assert.equal(sack.dknown, false);
    assert.ok(monster.minvent?.includes(sack));
    assert.match(text(), /picks up a bag\./);
});
void test('Conflict lets a peaceful monster consider the hero square when it has no other exit', async () => {
    for (const conflict of [false, true]) {
        freshObjectRoom({ left: 10, right: 11, top: 10, bottom: 10 });
        const goblin = await createMonsterAt('goblin', 11, 10, MM_NOGRP | NO_MINVENT);
        goblin.msleeping = 0;
        goblin.mcanmove = 1;
        goblin.mpeaceful = 1;
        if (conflict)
            grantIntrinsicProperty('conflict', 'outside');
        initRng(1n);
        const result = await moveMonsterForHeroAttack(goblin);
        assert.equal(result.status, conflict ? MMOVE_NOTHING : MMOVE_NOMOVES);
        assert.equal(goblin.mx, 11);
        assert.equal(goblin.my, 10);
    }
});
void test('a movement trap changes which body can eat the corpse on its destination', async () => {
    const { monster, level } = await floorActionRoom('purple worm', { corridor: true });
    const originalSpecies = monster.mnum;
    const corpse = await floorObject(CORPSE, 13, 10, { corpsenm: MONSTER_NAME.indexOf('newt') });
    addTrap(level, POLY_TRAP, 13, 10);
    initRng(2n);
    await moveMonsterForHeroAttack(monster);
    await flushPendingTopline();
    assert.equal(monster.mx, 13);
    assert.equal(monster.my, 10);
    assert.notEqual(monster.mnum, originalSpecies);
    assert.equal(corpse.where, 'floor');
    assert.ok(floorObjectsAt(level, 13, 10).includes(corpse));
});
void test('a polymorph trap gives an orc a metal-eating body which consumes its destination dagger', async () => {
    const { monster, level } = await floorActionRoom('orc', { corridor: true, verbose: false });
    const corpse = await floorObject(CORPSE, 13, 10, { corpsenm: MONSTER_NAME.indexOf('newt') });
    const dagger = await floorObject(DAGGER, 13, 10);
    addTrap(level, POLY_TRAP, 13, 10);
    initRng(15n);
    await moveMonsterForHeroAttack(monster);
    await flushPendingTopline();
    assert.equal(monster.mx, 13);
    assert.equal(monster.my, 10);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('rock mole'), 'The movement trap must produce the metal-eating form for this scenario');
    assert.ok(monster.mhp > 0);
    assert.equal(dagger.where, 'gone');
    assert.equal(floorObjectsAt(level, 13, 10).includes(dagger), false);
    assert.equal(monster.minvent?.includes(dagger) ?? false, false);
    assert.equal(corpse.where, 'floor');
    assert.ok(floorObjectsAt(level, 13, 10).includes(corpse));
});
//# sourceMappingURL=monster_floor_actions.test.js.map