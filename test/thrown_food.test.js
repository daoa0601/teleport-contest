import test from 'node:test';
import assert from 'node:assert/strict';
import { A_DEX, A_STR, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitMonsterWithKickedObject } from '../js/hero_ranged_attack.js';
import { resetInputState } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { APPLE, BANANA, CARROT, CORPSE, CREAM_PIE, RING_MAIL, TRIPE_RATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { kickDirection, throwInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
async function throwFood(food) {
    installPagerInput(resetInputState(), {
        expected: /seems more amiable|catches|eats|devours|misses|seems quite friendly/,
        limit: 3,
    });
    await throwInventoryObject(food, 'l');
}
async function message() {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
void test('throwing a treat tames a domestic dog and consumes the projectile without injury', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    dog.mpeaceful = 0;
    const hp = dog.mhp;
    const food = await addInventoryObject(TRIPE_RATION, { invlet: 'a' });
    await throwFood(food);
    assert.ok((dog.mtame ?? 0) > 0);
    assert.equal(dog.mpeaceful, 1);
    assert.equal(dog.mhp, hp);
    assert.equal(food.where, 'gone');
    assert.ok((dog.meating ?? 0) > 0);
    assert.match(await message(), /devours an uncursed tripe ration\./);
});
void test('unsuitable food pacifies a cat and lands without provoking a hostile wakeup', async () => {
    const level = freshObjectRoom();
    const cat = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    cat.mpeaceful = 0;
    cat.msleeping = 1;
    cat.mstrategy = STRAT_WAITFORU;
    const hp = cat.mhp;
    const apple = await addInventoryObject(APPLE, { invlet: 'a' });
    await throwFood(apple);
    assert.equal(cat.mpeaceful, 1);
    assert.equal(cat.mtame ?? 0, 0);
    assert.equal(cat.mhp, hp);
    assert.equal(cat.msleeping, 0);
    assert.equal((cat.mstrategy ?? 0) & STRAT_WAITFORU, 0);
    assert.equal(apple.where, 'floor');
    assert.ok(floorObjectsAt(level, cat.mx, cat.my).includes(apple));
    assert.match(await message(), /The apple misses the kitten\./);
});
for (const [foodType, becomesPet] of [[BANANA, true], [APPLE, false]]) {
    void test(`a monkey ${becomesPet ? 'accepts a thrown banana' : 'is not pacified by a thrown apple'}`, async () => {
        freshObjectRoom();
        const monkey = await createMonsterAt('monkey', 11, 10, NO_MINVENT);
        monkey.mpeaceful = 0;
        const food = await addInventoryObject(foodType, { invlet: 'a' });
        await throwFood(food);
        assert.equal((monkey.mtame ?? 0) > 0, becomesPet);
        assert.equal(!!monkey.mpeaceful, becomesPet);
        assert.equal(food.where, becomesPet ? 'gone' : 'floor');
    });
}
void test('a horse can be tamed by a carrot but is not pacified by animal flesh', async () => {
    freshObjectRoom();
    const pony = await createMonsterAt('pony', 11, 10, NO_MINVENT);
    pony.mpeaceful = 0;
    const corpse = await addInventoryObject(CORPSE, {
        invlet: 'a', corpsenm: MONSTER_NAME.indexOf('newt'),
    });
    await throwFood(corpse);
    assert.equal(pony.mtame ?? 0, 0);
    assert.equal(pony.mpeaceful, 0);
    assert.equal(corpse.where, 'floor');
    const carrot = await addInventoryObject(CARROT, { invlet: 'a' });
    await throwFood(carrot);
    assert.ok((pony.mtame ?? 0) > 0);
    assert.equal(carrot.where, 'gone');
});
void test('a pet catches one thrown treat and leaves the rest of the stack with the hero', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    const hungrytime = dog.edog.hungrytime;
    const tameness = dog.mtame ?? 0;
    const food = await addInventoryObject(TRIPE_RATION, { invlet: 'a', quan: 3 });
    await throwFood(food);
    assert.equal(food.quan, 2);
    assert.equal(food.where, 'inventory');
    assert.ok(dog.edog.hungrytime > hungrytime);
    assert.equal(dog.mtame, tameness + 1);
    assert.match(await message(), /catches the tripe ration\.|eats an uncursed tripe ration\./);
});
void test('kicking food into a dog tames it without putting the eaten object back on the floor', async () => {
    const level = freshObjectRoom({ right: 22 });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 18;
    game.u.acurr.a[A_DEX] = 18;
    const dog = await createMonsterAt('little dog', 13, 10, NO_MINVENT);
    dog.mpeaceful = 0;
    const food = await floorObject(TRIPE_RATION, 11, 10);
    initRng(1n);
    installPagerInput(resetInputState(), {
        expected: /seems more amiable|devours/, limit: 2,
    });
    await kickDirection('l');
    assert.ok((dog.mtame ?? 0) > 0);
    assert.equal(food.where, 'gone');
    assert.equal(floorObjectsAt(level, dog.mx, dog.my).includes(food), false);
});
void test('a hungry pet catches a cream pie which fails to splatter on it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 3;
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog);
    dog.edog.hungrytime = game.moves;
    const pie = await addInventoryObject(CREAM_PIE, { invlet: 'a' });
    initRng(1n);
    await throwFood(pie);
    assert.equal(pie.where, 'gone');
    assert.ok((dog.meating ?? 0) > 0);
    assert.ok(dog.edog.hungrytime > game.moves);
    assert.equal(dog.mblinded ?? 0, 0);
    assert.match(await message(), /catches the cream pie\.|eats an uncursed cream pie\./);
});
void test('a rust monster spits caught rustproof armor onto the floor exactly once', async () => {
    const level = freshObjectRoom();
    const pet = await createMonsterAt('rust monster', 11, 10, NO_MINVENT);
    initializePet(pet);
    assert.ok(pet.edog);
    pet.edog.hungrytime = game.moves;
    const armor = await addInventoryObject(RING_MAIL, {
        invlet: 'a', oerodeproof: true,
    });
    installPagerInput(resetInputState(), {
        expected: /rust monster catches|rust monster eats|spits.*out in disgust/,
        limit: 3,
    });
    await throwInventoryObject(armor, 'l');
    assert.equal(armor.where, 'floor');
    assert.equal(armor.oerodeproof, false);
    assert.equal(pet.mstun, 1);
    assert.equal(floorObjectsAt(level, pet.mx, pet.my).filter(object => object === armor).length, 1);
    assert.equal(pet.minvent.includes(armor), false);
});
for (const dexterity of [3, 25]) {
    void test(`a kicked pie ${dexterity === 3 ? 'can be caught after missing' : 'splashes before a hungry pet can eat it'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.u.acurr.a[A_DEX] = dexterity;
        const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
        initializePet(pet);
        assert.ok(pet.edog);
        pet.edog.hungrytime = game.moves;
        const pie = await mksobj(CREAM_PIE, false, false);
        initRng(1n);
        installPagerInput(resetInputState(), {
            expected: /cream pie|little dog growls/, limit: 2,
        });
        const contact = await hitMonsterWithKickedObject(pet, pie);
        assert.notEqual(contact.heroDied, true);
        assert.equal(pie.where, 'gone');
        if (dexterity === 3) {
            assert.equal(pet.mblinded ?? 0, 0);
            assert.ok(pet.edog.hungrytime > game.moves);
        }
        else {
            assert.ok((pet.mblinded ?? 0) > 0);
            assert.equal(pet.edog.hungrytime, game.moves);
            assert.equal(pet.meating ?? 0, 0);
        }
    });
}
//# sourceMappingURL=thrown_food.test.js.map