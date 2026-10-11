import assert from 'node:assert/strict';
import test from 'node:test';
import { moveMonsterForHeroAttack } from '../js/allmain.js';
import { MM_EMIN, MMOVE_DIED, MMOVE_MOVED, MMOVE_NOTHING, NO_MINVENT } from '../js/const.js';
import { canSpotMonster, flush_screen, plineWithContinuation } from '../js/display.js';
import { loseGuardianAngel } from '../js/guardian_angel.js';
import { game, requireGameDisplay, requireInitializedGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishSpecialRoamer } from '../js/mklev.js';
import { monsterAlignmentType } from '../js/monster_alignment.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { AMULET_OF_YENDOR, DAGGER, FOOD_RATION } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import type { AlignmentValue } from '../js/roles.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

const PM_ANGEL = MONSTER_NAME.indexOf('Angel');

async function guardian(x = 11, y = 10) {
    const state = requireInitializedGame();
    const angel = await createMonsterAt(PM_ANGEL, x, y, MM_EMIN | NO_MINVENT);
    finishSpecialRoamer(angel, state.u.ualign.type, true);
    // Native gain_guardian_angel makes this one tame minion without edog.
    angel.mtame = 10;
    return angel;
}

async function visibleMessage() {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

void test('a departing guardian disappears with ordinary inventory but leaves the real Amulet', async () => {
    const level = freshObjectRoom();
    const state = requireInitializedGame();
    const angel = await guardian();
    const dagger = await knownObject(DAGGER);
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addObjectToMonsterInventory(angel, dagger);
    await addObjectToMonsterInventory(angel, amulet);
    assert.equal(angel.edog ?? angel.mextra?.edog, undefined);
    const petConduct = state.u.uconduct.pets;
    installPagerInput(resetInputState(), { expected: /rebukes you|desire conflict/, limit: 2 });

    const result = await loseGuardianAngel(angel, state);

    assert.equal(result.heroDied, false);
    assert.equal(level.monsters.includes(angel), false);
    assert.equal(angel.dead, true);
    assert.equal(angel.minvent?.length, 0);
    assert.equal(dagger.where, 'gone');
    assert.equal(amulet.where, 'floor');
    assert.ok(floorObjectsAt(level, 11, 10).includes(amulet));
    assert.equal(state.u.uconduct.pets, petConduct);
    assert.ok(level.monsters.length >= 2 && level.monsters.length <= 4);
    for (const replacement of level.monsters) {
        assert.equal(replacement.mnum, PM_ANGEL);
        assert.equal(!!replacement.mpeaceful, false);
        assert.equal(replacement.mtame ?? 0, 0);
        assert.equal(replacement.edog ?? replacement.mextra?.edog, undefined);
        assert.equal(Math.max(Math.abs(replacement.mx - state.u.ux),
            Math.abs(replacement.my - state.u.uy)), 1);
    }
});

void test('the guardian and its inventory remain present while its rebuke waits for input', async () => {
    const level = freshObjectRoom();
    const state = requireInitializedGame();
    const angel = await guardian();
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(angel, dagger);
    const input = resetInputState();

    const departure = loseGuardianAngel(angel, state);
    await input.waitUntilBlocked();
    try {
        assert.equal(input.isBlocked, true);
        const message = requireGameDisplay(state).grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(message, /rebukes you, saying:.*--More--/);
        assert.ok(level.monsters.includes(angel));
        assert.equal(angel.dead ?? false, false);
        assert.equal(dagger.where, 'minvent');
        assert.ok(angel.minvent?.includes(dagger));
        assert.equal(level.monsters.length, 1);
    } finally {
        input.feed(' ');
        await departure;
    }

    assert.equal(await visibleMessage(), '"Since you desire conflict, have some more!"');
    assert.equal(level.monsters.includes(angel), false);
    assert.equal(dagger.where, 'gone');
});

void test('a deaf hero sees the guardian vanish without hearing its rebuke', async () => {
    const level = freshObjectRoom({ hero: { deafTurns: 20 } });
    const state = requireInitializedGame();
    const angel = await guardian();

    await loseGuardianAngel(angel, state);

    assert.match(await visibleMessage(), /^The guardian Angel.* vanishes!$/);
    assert.equal(level.monsters.includes(angel), false);
    assert.ok(level.monsters.length >= 2 && level.monsters.length <= 4);
});

void test('an unspotted guardian departs without announcing itself', async () => {
    const level = freshObjectRoom();
    const state = requireInitializedGame();
    const angel = await guardian();
    angel.minvis = true;
    assert.equal(canSpotMonster(angel), false);
    await plineWithContinuation('You wait quietly.');

    await loseGuardianAngel(angel, state);

    assert.equal(await visibleMessage(), 'You wait quietly.');
    assert.equal(level.monsters.includes(angel), false);
    assert.ok(level.monsters.length >= 2 && level.monsters.length <= 4);
});

for (const alignment of [-1, 0, 1] satisfies AlignmentValue[]) {
    void test(`replacement angels serve hero alignment ${alignment} as hostile renegades`, async () => {
        const level = freshObjectRoom({ hero: { ualign: { type: alignment, record: 0 } } });
        const state = requireInitializedGame();
        initRng(BigInt(alignment + 11));

        const result = await loseGuardianAngel(null, state);

        assert.equal(result.heroDied, false);
        assert.ok(level.monsters.length >= 2 && level.monsters.length <= 4);
        const squares = new Set(level.monsters.map(angel => `${angel.mx},${angel.my}`));
        assert.equal(squares.size, level.monsters.length);
        for (const angel of level.monsters) {
            assert.equal(angel.mnum, PM_ANGEL);
            assert.equal(monsterAlignmentType(angel), alignment);
            assert.equal(!!angel.emin?.renegade, true);
            assert.equal(!!angel.mpeaceful, false);
            assert.equal(!!angel.msleeping, false);
            assert.ok((angel.minvent?.length ?? 0) > 0, 'Replacement angels receive native equipment');
        }
    });
}

void test('replacement angels search past occupied adjacent squares without moving their occupants', async () => {
    const level = freshObjectRoom();
    const state = requireInitializedGame();
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x === 10 && y === 10) continue;
            await createMonsterAt('newt', x, y, NO_MINVENT);
        }
    }
    const occupants = level.monsters.map(monster => ({ monster, x: monster.mx, y: monster.my }));

    await loseGuardianAngel(null, state);

    const replacements = level.monsters.filter(monster => monster.mnum === PM_ANGEL);
    assert.ok(replacements.length >= 2 && replacements.length <= 4);
    for (const angel of replacements) {
        assert.equal(Math.max(Math.abs(angel.mx - state.u.ux),
            Math.abs(angel.my - state.u.uy)), 2);
    }
    for (const { monster, x, y } of occupants) {
        assert.ok(level.monsters.includes(monster));
        assert.equal(monster.mx, x);
        assert.equal(monster.my, y);
    }
});

void test('only one replacement can occupy the lone legal square after a guardian departs', async () => {
    const level = freshObjectRoom({ left: 10, right: 11, top: 10, bottom: 10,
        hero: { deafTurns: 20 } });
    const state = requireInitializedGame();
    const angel = await guardian();

    await loseGuardianAngel(angel, state);

    assert.equal(level.monsters.length, 1);
    const replacement = level.monsters[0];
    assert.ok(replacement);
    assert.notEqual(replacement, angel);
    assert.equal(replacement.mnum, PM_ANGEL);
    assert.equal(replacement.mx, 11);
    assert.equal(replacement.my, 10);
});

void test('hostile angels cannot appear when only the hero square is open', async () => {
    const level = freshObjectRoom({ left: 10, right: 10, top: 10, bottom: 10 });

    const result = await loseGuardianAngel(null, requireInitializedGame());

    assert.equal(result.heroDied, false);
    assert.equal(level.monsters.length, 0);
    assert.equal(!!game.program_state.gameover, false);
});

void test('Conflict makes a guardian depart during its actual movement turn', async () => {
    const level = freshObjectRoom({ hero: { ulevel: 30 } });
    const state = requireInitializedGame();
    const angel = await guardian();
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(angel, dagger);
    grantIntrinsicProperty('conflict', 'outside');
    installPagerInput(resetInputState(), { expected: /rebukes you|desire conflict/, limit: 2 });
    initRng(1n);

    const result = await moveMonsterForHeroAttack(angel, state);

    assert.equal(result.status, MMOVE_DIED);
    assert.equal(result.heroDied, false);
    assert.equal(level.monsters.includes(angel), false);
    assert.equal(dagger.where, 'gone');
    assert.ok(level.monsters.length >= 2 && level.monsters.length <= 4);
    assert.ok(level.monsters.every(replacement => replacement.mnum === PM_ANGEL
        && !replacement.mpeaceful && !replacement.mtame));
    assert.equal(await visibleMessage(), '"Since you desire conflict, have some more!"');
});

void test('a non-steed guardian on the hero square stays put even under Conflict', async () => {
    const level = freshObjectRoom({ hero: { ulevel: 30 } });
    const state = requireInitializedGame();
    const angel = await guardian();
    placeMonsterAt(angel, state.u.ux, state.u.uy);
    assert.notEqual(state.u.usteed, angel);
    grantIntrinsicProperty('conflict', 'outside');
    initRng(1n);

    const result = await moveMonsterForHeroAttack(angel, state);

    assert.equal(result.status, MMOVE_NOTHING);
    assert.equal(result.heroDied, false);
    assert.equal(level.monsters.length, 1);
    assert.equal(level.monsters[0], angel);
    assert.equal(angel.mx, state.u.ux);
    assert.equal(angel.my, state.u.uy);
    assert.equal(angel.dead ?? false, false);
    assert.equal(await visibleMessage(), '');
});

void test('a guardian follows its hero instead of food and remains within four squares', async () => {
    const level = freshObjectRoom({ left: 10, right: 16, top: 10, bottom: 10 });
    const state = requireInitializedGame();
    const angel = await guardian(14, 10);
    const food = await floorObject(FOOD_RATION, 15, 10);
    initRng(1n);

    const firstMove = await moveMonsterForHeroAttack(angel, state);

    assert.equal(firstMove.status, MMOVE_MOVED);
    assert.equal(firstMove.heroDied, false);
    assert.equal(angel.mx, 13);
    assert.equal(angel.my, 10);
    for (let turn = 0; turn < 20; turn++) {
        const result = await moveMonsterForHeroAttack(angel, state);
        assert.equal(result.heroDied, false);
        assert.ok((angel.mx - state.u.ux) ** 2 + (angel.my - state.u.uy) ** 2 <= 16,
            `Guardian wandered too far on movement ${turn + 2}: ${angel.mx},${angel.my}`);
    }
    assert.ok(level.monsters.includes(angel));
    assert.equal(!!angel.mpeaceful, true);
    assert.equal(food.where, 'floor');
    assert.ok(floorObjectsAt(level, 15, 10).includes(food));
});
