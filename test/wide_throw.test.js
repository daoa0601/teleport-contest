import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { A_DEX, NO_MINVENT } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE, KATANA, POT_HEALING, SHORT_SWORD, YUMI, YA, } from '../js/object_data.js';
import { pickupAtHero } from '../js/pickup.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObjects } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
function topline() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
void test('a hungry metal-eating pet catches a quivered coin as food', async () => {
    const level = freshObjectRoom();
    const mole = await createMonsterAt('rock mole', 11, 10, NO_MINVENT);
    initializePet(mole);
    assert.ok(mole.edog);
    mole.edog.hungrytime = game.moves;
    const gold = await addInventoryObject(GOLD_PIECE, { quan: 3 });
    await setQuiverObject(gold);
    initRng(2n);
    const input = resetInputState();
    installPagerInput(input, { expected: /rock mole catches|rock mole eats/, limit: 3 });
    input.feed('l');
    await rhack('f'.charCodeAt(0));
    await flush_screen();
    assert.match(topline(), /rock mole (?:catches the|eats an uncursed) gold piece/);
    assert.equal(gold.quan, 2);
    assert.ok((mole.meating ?? 0) > 0);
    assert.equal(floorObjects(level).some(object => object.otyp === GOLD_PIECE), false);
});
void test('missed potions can thaw an immobilized target or leave it frozen across seeds', async () => {
    let thawedMisses = 0;
    let frozenMisses = 0;
    for (let seed = 1n; seed <= 100n; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        game.u.acurr.a[A_DEX] = 3;
        const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
        dog.mpeaceful = 0;
        dog.mcanmove = 0;
        dog.mfrozen = 6;
        const potion = await addInventoryObject(POT_HEALING);
        initRng(seed);
        const input = resetInputState();
        let missed = false;
        input.beforeRead = () => {
            missed ||= /potion of healing misses/.test(topline());
        };
        installPagerInput(input, {
            expected: /potion of healing|peculiar odor|breaks into shards/, limit: 3,
        });
        await throwInventoryObject(potion, 'l');
        if (!missed)
            continue;
        if (dog.mcanmove) {
            thawedMisses++;
            assert.equal(dog.mfrozen, 0, `A thawed target retained its paralysis at seed ${seed}`);
        }
        else {
            frozenMisses++;
            assert.equal(dog.mfrozen, 6, `A still-frozen target changed paralysis at seed ${seed}`);
        }
    }
    assert.ok(thawedMisses > 0, `No target thawed among ${frozenMisses} visibly missed throws`);
    assert.ok(frozenMisses > 0, `Every target thawed among ${thawedMisses} visibly missed throws`);
});
void test('potion misses respect nonverbose target descriptions', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 3;
    await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    const potion = await addInventoryObject(POT_HEALING);
    initRng(1n);
    const input = resetInputState();
    const throwing = throwInventoryObject(potion, 'l');
    await input.waitUntilBlocked();
    try {
        assert.equal(topline(), 'The potion of healing misses it.--More--');
    }
    finally {
        installPagerInput(input, { expected: /potion of healing shatters|peculiar odor/, limit: 2 });
        input.feed(' ');
        await throwing;
    }
});
void test('recovering a split projectile reuses its former inventory letter when free', async () => {
    const level = freshObjectRoom();
    const daggers = await addInventoryObject(DAGGER, { invlet: 'b', quan: 2 });
    await setQuiverObject(daggers);
    const input = resetInputState();
    input.feed('lh');
    await rhack('f'.charCodeAt(0));
    await rhack('f'.charCodeAt(0));
    const pile = floorObjects(level).find(object => object.otyp === DAGGER && object.ox > game.u.ux);
    assert.ok(pile);
    game.u.ux = pile.ox;
    game.u.uy = pile.oy;
    await pickupAtHero();
    await flush_screen();
    assert.match(topline(), /^b - a \+0 dagger \(at the ready\)\./);
});
void test('fire assistance retains the displayed map while acknowledging the launcher', async () => {
    freshObjectRoom({
        role: 'samurai',
        flags: { fireassist: true, pushweapon: false, time: false },
    });
    requirePlayingGame(game);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const katana = await addInventoryObject(KATANA, { invlet: 'a' });
    const wakizashi = await addInventoryObject(SHORT_SWORD, { invlet: 'b' });
    await addInventoryObject(YUMI, { invlet: 'c' });
    const arrows = await addInventoryObject(YA, { invlet: 'd', quan: 10 });
    await setPrimaryWeapon(katana);
    await setSecondaryWeapon(wakizashi);
    await setQuiverObject(arrows);
    const dog = await createMonsterAt('little dog', 14, 10, NO_MINVENT);
    initializePet(dog);
    initRng(2n);
    const input = resetInputState();
    input.feed('f');
    await moveloop_core();
    await answerPrompts(moveloop_core(), input, [
        { prompt: /wakizashi .*--More--/, keys: ' ' },
    ]);
    await answerPrompts(moveloop_core(), input, [
        { prompt: /katana .*--More--/, keys: ' ' },
    ]);
    const previousX = dog.mx;
    const previousY = dog.my;
    const firing = moveloop_core();
    await input.waitUntilBlocked();
    try {
        assert.match(topline(), /^c - .*yumi .*--More--/);
        assert.notDeepEqual([dog.mx, dog.my], [previousX, previousY], 'The pet should move during wielding');
        assert.equal(requireScreenCell(previousX - 1, previousY + 1).ch, 'd');
    }
    finally {
        input.feed(' \x1b');
        await firing;
    }
});
//# sourceMappingURL=wide_throw.test.js.map