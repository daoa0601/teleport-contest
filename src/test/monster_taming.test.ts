import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT, G_GENOD } from '../js/const.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mksobj, set_corpsenm } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { tameMonster } from '../js/monster_taming.js';
import { CARROT, CORPSE, DAGGER, FOOD_RATION, LUMP_OF_ROYAL_JELLY, OBJECT_NAMES, SPE_CHARM_MONSTER, TRIPE_RATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { answerPrompts } from './support/input-boundaries.js';
import { installPagerInput } from './support/pager-input.js';

const SCR_TAMING = OBJECT_NAMES.indexOf('taming');

async function wildMonster(species = 'little dog', x = 11, y = 10) {
    return await createMonsterAt(species, x, y, MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT);
}

async function pet(species = 'little dog') {
    const monster = await wildMonster(species);
    initializePet(monster);
    assert.ok(monster.edog);
    return monster;
}

async function topMessage(): Promise<string> {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

void test('a wild confused dog becomes tame and devours offered food with native nutrition', async () => {
    freshObjectRoom({ moves: 100 });
    const dog = await wildMonster();
    dog.mconf = 1;
    const food = await mksobj(TRIPE_RATION, false, false);

    assert.equal(await tameMonster(dog, food), true);

    assert.ok(dog.edog);
    assert.equal(dog.mtame, 11);
    assert.equal(dog.mpeaceful, 1);
    assert.equal(dog.mconf, 0);
    assert.equal(dog.meating, 1);
    assert.equal(dog.edog.hungrytime, 2000); // 100+1000 initial, then 6*200*3/4.
    assert.equal(food.where, 'gone');
    assert.equal(await topMessage(), 'Your little dog devours a tripe ration.');
});

void test('an existing pet catches food before moving it to the floor or receiving nutrition', async () => {
    freshObjectRoom();
    const dog = await pet();
    assert.ok(dog.edog);
    const deadline = dog.edog.hungrytime;
    const food = await mksobj(TRIPE_RATION, false, false);
    const input = resetInputState();
    await plineWithContinuation('The previous message fills the top line before your pet can finish eating.');

    const feeding = tameMonster(dog, food);
    await input.waitUntilBlocked();
    assert.equal(food.where, 'free');
    assert.equal(dog.edog.hungrytime, deadline);
    const caught = await answerPrompts(feeding, input, [
        { prompt: /previous message.*--More--/s, keys: ' ' },
        { prompt: /The little dog catches the tripe ration\..*--More--/s, keys: ' ' },
    ]);

    assert.equal(caught, true);
    assert.equal(food.where, 'gone');
    assert.equal(dog.edog.hungrytime, deadline + 1200);
    assert.equal(await topMessage(), 'Your little dog eats a tripe ration.');
});

void test('paralysis is shortened and indefinite sleep ends before an untamable target refuses food', async () => {
    freshObjectRoom();
    const dog = await wildMonster();
    const neighbor = await wildMonster('kitten', 12, 10);
    dog.mfrozen = 7;
    dog.mcanmove = 0;
    dog.msleeping = neighbor.msleeping = 1;
    const food = await mksobj(TRIPE_RATION, false, false);

    assert.equal(await tameMonster(dog, food), false);

    assert.equal(dog.mfrozen, 4);
    assert.equal(dog.mcanmove, 0);
    assert.equal(dog.msleeping, 0);
    assert.equal(neighbor.msleeping, 1);
    assert.equal(dog.mpeaceful, 1);
    assert.equal(food.where, 'free');
    assert.equal(dog.mtame ?? 0, 0);
});

for (const condition of ['confused', 'paralyzed', 'eating'] as const) {
    void test(`an already tame ${condition} pet refuses to catch food`, async () => {
        freshObjectRoom();
        const dog = await pet();
        assert.ok(dog.edog);
        const deadline = dog.edog.hungrytime;
        if (condition === 'confused') dog.mconf = 1;
        else if (condition === 'paralyzed') { dog.mcanmove = 0; dog.mfrozen = 4; }
        else dog.meating = 2;
        const food = await mksobj(TRIPE_RATION, false, false);

        assert.equal(await tameMonster(dog, food), false);

        assert.equal(food.where, 'free');
        assert.equal(dog.edog.hungrytime, deadline);
        assert.equal(dog.mtame, 10);
    });
}

void test('a herbivore refuses meat but becomes tame when offered a carrot', async () => {
    freshObjectRoom();
    const pony = await wildMonster('pony');
    const meat = await mksobj(TRIPE_RATION, false, false);

    assert.equal(await tameMonster(pony, meat), false);
    assert.equal(meat.where, 'free');
    assert.equal(pony.mtame ?? 0, 0);

    const carrot = await mksobj(CARROT, false, false);
    assert.equal(await tameMonster(pony, carrot), true);
    assert.equal(carrot.where, 'gone');
    assert.equal(pony.mtame, 11);
});

void test('an ordinary ration is caught only once an existing pet is hungry', async () => {
    freshObjectRoom({ moves: 100 });
    const dog = await pet();
    assert.ok(dog.edog);
    const food = await mksobj(FOOD_RATION, false, false);

    assert.equal(await tameMonster(dog, food), false);
    assert.equal(food.where, 'free');
    dog.edog.hungrytime = game.moves;
    const input = resetInputState();
    assert.equal(await answerPrompts(tameMonster(dog, food), input, [{
        prompt: /The little dog catches the food ration\..*--More--/s, keys: ' ',
    }]), true);
    assert.equal(food.where, 'gone');
});

void test('catching a corpse larger than the pet preserves the native warning and consumes it', async () => {
    freshObjectRoom();
    const dog = await pet();
    assert.ok(dog.edog);
    dog.edog.hungrytime = game.moves;
    const corpse = await mksobj(CORPSE, false, false);
    set_corpsenm(corpse, MONSTER_NAME.indexOf('hill giant'));
    const input = resetInputState();
    const feeding = tameMonster(dog, corpse);

    await answerPrompts(feeding, input, [{
        prompt: /The little dog catches the hill giant corpse, or vice versa!.*--More--/s,
        keys: ' ',
    }]);

    assert.equal(corpse.where, 'gone');
    assert.match(await topMessage(), /eats a hill giant corpse/);
});

void test('visible food stops in front of an unseen pet without revealing its identity', async () => {
    freshObjectRoom();
    const dog = await pet();
    dog.minvis = true;
    const food = await mksobj(TRIPE_RATION, false, false);

    assert.equal(await tameMonster(dog, food), true);

    assert.equal(food.where, 'gone');
    assert.equal(await topMessage(), 'The tripe ration stops.  It eats a tripe ration.');
});

void test('catching a treat restores starvation strength and rewards a prior delivery', async () => {
    freshObjectRoom({ moves: 100 });
    const dog = await pet();
    assert.ok(dog.edog);
    dog.mhp = 3;
    dog.mhpmax = 4;
    dog.edog.mhpmax_penalty = 8;
    dog.edog.hungrytime = 50;
    dog.edog.apport = 2;
    dog.edog.dropdist = 5;
    dog.edog.droptime = 90;
    const food = await mksobj(TRIPE_RATION, false, false);
    food.invlet = 'a';
    const input = resetInputState();

    assert.equal(await answerPrompts(tameMonster(dog, food), input, [{
        prompt: /The little dog catches the tripe ration\..*--More--/s, keys: ' ',
    }]), true);

    assert.equal(dog.mhpmax, 12);
    assert.equal(dog.mhp, 3);
    assert.equal(dog.edog.mhpmax_penalty, 0);
    assert.equal(dog.edog.hungrytime, 1300);
    assert.equal(dog.edog.apport, 15);
});

void test('blessed taming magic increases a weak bond without consuming the source scroll', async () => {
    freshObjectRoom();
    const dog = await pet();
    dog.mtame = 8;
    const scroll = await mksobj(SCR_TAMING, false, false);
    scroll.blessed = true;

    assert.equal(await tameMonster(dog, scroll), false);

    assert.equal(dog.mtame, 10);
    assert.equal(scroll.where, 'free');
    assert.equal(dog.meating, 0);
});

void test('taming magic pacifies a new pet and readies its real weapon', async () => {
    freshObjectRoom();
    const goblin = await wildMonster('goblin');
    const weapon = await mksobj(DAGGER, false, false);
    await addObjectToMonsterInventory(goblin, weapon);
    const spell = await mksobj(SPE_CHARM_MONSTER, false, false);
    const input = resetInputState();
    installPagerInput(input, { expected: /goblin seems more amiable|goblin wields/i, limit: 1 });

    assert.equal(await tameMonster(goblin, spell, { announce: true }), true);

    assert.equal(goblin.mtame, 5);
    assert.equal(goblin.mpeaceful, 1);
    assert.ok(goblin.mw === weapon);
    assert.equal(spell.where, 'free');
});

void test('food refused during a full-moon night pacifies a dog but preserves its flight and hold', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dog = await wildMonster();
    dog.mflee = 1;
    dog.mfleetim = 12;
    game.u.ustuck = dog;
    game.flags.moonphase = 4;
    game.datetime = '20260102230000';
    const food = await mksobj(TRIPE_RATION, false, false);
    initRng(1n);

    assert.equal(await tameMonster(dog, food), false);

    assert.equal(dog.mpeaceful, 1);
    assert.equal(dog.mflee, 1);
    assert.equal(dog.mfleetim, 12);
    assert.ok(game.u.ustuck === dog);
    assert.equal(food.where, 'free');
});

void test('ordinary food refusal still releases the hero from a fleeing grabber', async () => {
    freshObjectRoom();
    const bear = await wildMonster('owlbear');
    bear.mflee = 1;
    bear.mfleetim = 12;
    game.u.ustuck = bear;
    const food = await mksobj(CARROT, false, false);

    assert.equal(await tameMonster(bear, food), false);

    assert.equal(game.u.ustuck, null);
    assert.equal(bear.mflee, 0);
    assert.equal(bear.mfleetim, 0);
    assert.equal(bear.mpeaceful, 1);
    assert.equal(food.where, 'free');
});

void test('Medusa refuses taming without becoming peaceful', async () => {
    freshObjectRoom();
    const medusa = await wildMonster('Medusa');

    assert.equal(await tameMonster(medusa), false);

    assert.equal(!!medusa.mpeaceful, false);
    assert.equal(medusa.mtame ?? 0, 0);
});

void test('food is still caught when a new pet grows into a genocided form and dies', async () => {
    freshObjectRoom();
    const bee = await wildMonster('killer bee');
    const queen = MONSTER_NAME.indexOf('queen bee');
    assert.ok(game.mvitals);
    game.mvitals[queen] = { born: 0, died: 0, mvflags: G_GENOD };
    const jelly = await mksobj(LUMP_OF_ROYAL_JELLY, false, false);
    const input = resetInputState();
    installPagerInput(input, { expected: /killer bee eats|grows up into a queen bee/, limit: 2 });

    assert.equal(await tameMonster(bee, jelly), true);

    assert.equal(jelly.where, 'gone');
    assert.equal(bee.dead, true);
    assert.equal(bee.mhp, 0);
});
