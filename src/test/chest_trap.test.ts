import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { triggerChestTrap } from '../js/chest_trap.js';
import { M_SEEN_COLD, M_SEEN_ELEC } from '../js/const.js';
import { useContainer } from '../js/container.js';
import { flush_screen } from '../js/display.js';
import { moveObject } from '../js/floor_object.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { AMULET_OF_YENDOR, CHEST, CLUB, RIN_FREE_ACTION, ROCK } from '../js/object_data.js';
import { punishHero } from '../js/punishment.js';
import { initRng } from '../js/rng.js';
import { heroIsHallucinating } from '../js/senses.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { untrap } from '../js/untrap.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

function randomValues(...values: number[]) {
    return (range: number) => {
        const value = values.shift();
        assert.ok(value !== undefined, `missing random value for rn2(${range})`);
        assert.ok(value >= 0 && value < range, `${value} is outside rn2(${range})`);
        return value;
    };
}

function messageCollector() {
    const messages: string[] = [];
    return {
        messages,
        publish: async (message: string) => {
            messages.push(message);
        },
    };
}

function freshTrapRoom(options: Parameters<typeof freshPlayableRoom>[0]) {
    const level = freshPlayableRoom(options);
    requirePlayingGame(game);
    initRng(7301n);
    return level;
}

void test('chest paralysis preserves a longer sleep while replacing its recovery message', async () => {
    freshTrapRoom({ hero: { uluck: 0, uhp: 40, uhpmax: 40 } });
    const chest = await addInventoryObject(CHEST, { otrapped: true });
    await putHeroToSleep(20);
    const output = messageCollector();

    await triggerChestTrap(chest, {
        random: randomValues(0, 1, 3), rollDice: () => 5, publish: output.publish,
    });

    assert.equal(game._helplessTurns, 20);
    assert.ok(game.u.usleep);
    assert.equal(game._helplessReason, 'frozen by a trap');
    assert.equal(game._helplessDoneMessage, 'You can move again.');
});

void test('luck can discharge a trapped chest without harming the hero', async () => {
    freshTrapRoom({ hero: { uluck: 0, uhp: 40, uhpmax: 40 } });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const output = messageCollector();

    const result = await triggerChestTrap(chest, {
        random: randomValues(8, 11),
        publish: output.publish,
    });

    assert.ok(result);
    assert.equal(result.outcome, 'luck-save');
    assert.equal(game.u.uhp, 40);
    assert.equal(chest.otrapped, false);
    assert.equal(chest.tknown, true);
    assert.deepEqual(output.messages, [
        'You trigger a trap!',
        'But luckily the explosive charge is a dud!',
    ]);
});

void test('a floor chest explosion destroys ordinary objects and wakes monsters', async () => {
    freshTrapRoom({
        hero: { uluck: 0, ulevel: 5, uhp: 100, uhpmax: 100 },
    });
    requirePlayingGame(game);
    const chest = await floorObject(CHEST, 10, 10, { otrapped: true });
    const contents = await knownObject(CLUB, {
        where: 'contained',
        container: chest,
    });
    chest.contents = [contents];
    const rock = await floorObject(ROCK, 10, 10);
    const amulet = await floorObject(AMULET_OF_YENDOR, 10, 10);
    const sleeper = await createMonsterAt('jackal', 12, 10);
    sleeper.msleeping = 1;
    const output = messageCollector();

    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 21),
        rollDice: () => 12,
        publish: output.publish,
    });

    assert.ok(result);
    assert.equal(result.outcome, 'explosion');
    assert.equal(result.destroyed, true);
    assert.equal(game.u.uhp, 88);
    assert.equal(chest.where, 'gone');
    assert.equal(contents.where, 'gone');
    assert.equal(rock.where, 'gone');
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(amulet), true);
    assert.equal(sleeper.msleeping, 0);
});

void test('a carried trapped chest survives its explosion but loses its contents', async () => {
    freshTrapRoom({ hero: { uluck: 0, uhp: 60, uhpmax: 60 } });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const club = await knownObject(CLUB, {
        invlet: 'b',
        where: 'contained',
        container: chest,
    });
    chest.contents = [club];

    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 21),
        rollDice: () => 9,
        publish: async () => {},
    });

    assert.ok(result);
    assert.equal(result.destroyed, false);
    assert.equal(game.inventory.includes(chest), true);
    assert.deepEqual(chest.contents, []);
    assert.equal(club.where, 'gone');
    assert.equal(chest.tknown, true);
    assert.equal(game.u.uhp, 51);
});

void test('free action prevents a chest trap from paralyzing the hero', async () => {
    freshTrapRoom({ hero: { uluck: 0 } });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const ring = await addInventoryObject(RIN_FREE_ACTION, {
        invlet: 'b',
        worn: true,
    });
    game.uleft = game.u.uleft = ring;

    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 1, 3),
        rollDice: () => {
            throw new Error('free action must prevent the paralysis roll');
        },
        publish: async () => {},
    });

    assert.ok(result);
    assert.equal(result.outcome, 'paralysis');
    assert.ok('duration' in result);
    assert.equal(result.duration, 0);
    assert.equal(game._helplessTurns, undefined);
});

void test('poison resistance blocks a trapped chest needle', async () => {
    freshTrapRoom({
        hero: {
            uluck: 0,
            uhp: 40,
            uhpmax: 40,
            poisonResistance: true,
        },
    });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });

    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 13),
        publish: async () => {},
    });

    assert.ok(result);
    assert.equal(result.outcome, 'poisoned-needle');
    assert.equal(game.u.uhp, 40);
    assert.equal(chest.tknown, true);
});

void test('a noxious chest trap can leave a live poison cloud', async () => {
    freshTrapRoom({ hero: { uluck: 0 } });
    requirePlayingGame(game);
    const chest = await floorObject(CHEST, 10, 10, { otrapped: true });

    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 17, 0, 1),
        publish: async () => {},
    });

    assert.ok(result);
    assert.equal(result.outcome, 'noxious-gas');
    assert.deepEqual(
        requireGameLevel().regions.map((region) => ({
            damage: region.damage,
            ttl: region.ttl,
            cells: region.cells,
        })),
        [{ damage: 8, ttl: 5, cells: [{ x: 10, y: 10 }] }],
    );
});

void test('shock resistance blocks direct chest-trap electrical damage', async () => {
    freshTrapRoom({
        hero: {
            uluck: 0,
            uhp: 40,
            uhpmax: 40,
            shockResistance: true,
        },
    });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });

    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 6, 0),
        rollDice: () => 8,
        publish: async () => {},
    });

    assert.ok(result);
    assert.equal(result.outcome, 'electric-shock');
    assert.ok('damage' in result);
    assert.equal(result.damage, 0);
    assert.equal(game.u.uhp, 40);
});

void test('colored gas stuns the hero while hallucination resistance stays active', async () => {
    freshTrapRoom({
        hero: { uluck: 0, hallucinationResistance: true },
    });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });

    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 1, 0, 2, 4, 3),
        publish: async () => {},
    });

    assert.ok(result);
    assert.equal(result.outcome, 'stunning-gas');
    assert.equal(game.u.stunnedTurns, 20);
    assert.equal(game.u.hallucinationTurns, 19);
    assert.equal(heroIsHallucinating(), false);
});

void test('hallucination changes the color seen when a chest releases stunning gas', async () => {
    const gasMessages: string[] = [];
    for (const hallucinationTurns of [0, 30]) {
        freshTrapRoom({ hero: { uluck: 13, hallucinationTurns } });
        const chest = await addInventoryObject(CHEST, { otrapped: true });
        const output = messageCollector();
        initRng(2n);

        const result = await triggerChestTrap(chest, { publish: output.publish });

        assert.equal(result?.outcome, 'stunning-gas');
        const message = output.messages.find(text => text.startsWith('A cloud of '));
        assert.ok(message, 'Stunning gas must describe the cloud the hero sees');
        gasMessages.push(message);
    }
    assert.notEqual(gasMessages[1], gasMessages[0],
        'A hallucinating hero sees a fanciful color instead of the ordinary gas color');
});

for (const blind of [false, true]) {
    void test(`stunning chest gas reports ${blind ? 'dizziness to a blind hero' : 'blurred vision to a sighted hero'}`, async () => {
        freshTrapRoom({ hero: { blind, blindTurns: blind ? 10 : 0 } });
        const chest = await addInventoryObject(CHEST, { otrapped: true });
        const output = messageCollector();

        await triggerChestTrap(chest, {
            random: randomValues(0, 1, 0, 2, 4, 3), publish: output.publish,
        });

        assert.ok(output.messages.includes(blind
            ? 'A cloud of pungent gas billows from the chest.'
            : 'A cloud of green gas billows from the chest.'));
        assert.equal(output.messages.at(-1), blind
            ? 'You stagger and get dizzy...'
            : 'You stagger and your vision blurs...');
        assert.equal(game.u.stunnedTurns, 20);
        assert.equal(game.u.hallucinationTurns, 19);
    });
}

void test('stunning chest gas uses the current form movement verb', async () => {
    freshTrapRoom({ hero: { hallucinationResistance: true } });
    installPolymorphedHero('floating eye');
    game.u.hallucinationResistance = true;
    const chest = await addInventoryObject(CHEST, { otrapped: true });
    const output = messageCollector();

    await triggerChestTrap(chest, { random: () => 0, publish: output.publish });

    assert.equal(output.messages.at(-1), 'You wobble...');
});

void test('a hallucinating hero sees an imaginary gas color and feels groovy', async () => {
    freshTrapRoom({ hero: { hallucinationTurns: 10 } });
    const chest = await addInventoryObject(CHEST, { otrapped: true });
    const output = messageCollector();
    initRng(1n);

    await triggerChestTrap(chest, { random: () => 0, publish: output.publish });

    assert.ok(output.messages.includes('A cloud of light black gas billows from the chest.'));
    assert.equal(output.messages.at(-1), 'What a groovy feeling!');
    assert.equal(game.u.hallucinationTurns, 26);
});

void test('stunning gas extends existing stun without announcing another stagger', async () => {
    freshTrapRoom({ hero: { stunned: true, stunnedTurns: 10 } });
    const chest = await addInventoryObject(CHEST, { otrapped: true });
    const output = messageCollector();

    await triggerChestTrap(chest, { random: () => 0, publish: output.publish });

    assert.equal(output.messages.length, 2);
    assert.equal(game.u.stunnedTurns, 26);
});

for (const resistant of [false, true]) {
    void test(`a chest shock ${resistant ? 'teaches' : 'clears'} electrical resistance for monsters in line of sight`, async () => {
        freshTrapRoom({ hero: { shockResistance: resistant, uhp: 40, uhpmax: 40 } });
        const chest = await addInventoryObject(CHEST, { otrapped: true });
        const watcher = await createMonsterAt('jackal', 12, 10);
        const blindWatcher = await createMonsterAt('jackal', 13, 10);
        blindWatcher.mcansee = 0;
        for (const observer of [watcher, blindWatcher])
            observer.seen_resistance = M_SEEN_COLD | (resistant ? 0 : M_SEEN_ELEC);

        await triggerChestTrap(chest, {
            random: randomValues(0, 0, 6, 0), rollDice: () => 8, publish: () => {},
        });

        const expected = M_SEEN_COLD | (resistant ? M_SEEN_ELEC : 0);
        assert.equal(watcher.seen_resistance, expected);
        assert.equal(blindWatcher.seen_resistance, expected);
        assert.equal(game.u.uhp, resistant ? 40 : 32);
    });
}

void test('an exploding chest exposes the monster hiding beneath it', async () => {
    freshTrapRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const chest = await floorObject(CHEST, 11, 10, { otrapped: true });
    const snake = await createMonsterAt('garter snake', 11, 10);
    snake.mundetected = 1;

    await triggerChestTrap(chest, {
        random: randomValues(0, 0, 21), rollDice: () => 6, publish: () => {},
    });

    assert.equal(chest.where, 'gone');
    assert.equal(snake.mundetected, 0);
});

void test('the Amulet survives a chest explosion and is no longer in use', async () => {
    freshTrapRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const chest = await floorObject(CHEST, 11, 10, { otrapped: true });
    const amulet = await floorObject(AMULET_OF_YENDOR, 11, 10, { in_use: true });

    await triggerChestTrap(chest, {
        random: randomValues(0, 0, 21), rollDice: () => 6, publish: () => {},
    });

    assert.equal(amulet.where, 'floor');
    assert.equal(amulet.in_use, false);
});

void test('an explosion that breaks punishment exposes a monster beneath the distant chain', async () => {
    freshTrapRoom({ hero: { uhp: 100, uhpmax: 100 } });
    pushKeys(' '.repeat(10));
    await punishHero();
    const ball = game.uball;
    const chain = game.uchain;
    assert.ok(ball && chain);
    await moveObject(ball, 11, 10);
    await moveObject(chain, 12, 10);
    const snake = await createMonsterAt('garter snake', chain.ox, chain.oy);
    snake.mundetected = 1;
    const chest = await floorObject(CHEST, 11, 10, { otrapped: true });

    await triggerChestTrap(chest, {
        random: randomValues(0, 0, 21), rollDice: () => 6, publish: () => {},
    });

    assert.equal(game.u.punished, false);
    assert.equal(chain.where, 'gone');
    assert.equal(snake.mundetected, 0);
});

void test('a chest needle pricks the current form hand', async () => {
    freshTrapRoom({ hero: { poisonResistance: true } });
    installPolymorphedHero('kitten');
    game.u.poisonResistance = true;
    const chest = await addInventoryObject(CHEST, { otrapped: true });
    const output = messageCollector();

    await triggerChestTrap(chest, {
        random: randomValues(0, 0, 13), publish: output.publish,
    });

    assert.ok(output.messages.includes('You feel a needle prick your paw.'));
});

void test('a failed chest disarm pricks a finger rather than the whole hand', async () => {
    freshTrapRoom({ hero: { poisonResistance: true, confusionTurns: 10 } });
    const chest = await floorObject(CHEST, 10, 10, { otrapped: true, tknown: true });
    const output = messageCollector();

    await untrap({ container: chest, ask: async () => 'y',
        random: randomValues(0, 0, 13), publish: output.publish });

    assert.ok(output.messages.includes('You set it off!'));
    assert.ok(output.messages.includes('You feel a needle prick your finger.'));
});

void test('the trap warning is acknowledged before a luck escape is displayed', async () => {
    freshTrapRoom({});
    const chest = await addInventoryObject(CHEST, { otrapped: true });
    pushKeys(' ');

    await triggerChestTrap(chest, { random: randomValues(8, 11) });
    await flush_screen(1);

    const text = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
    assert.equal(text, 'But luckily the explosive charge is a dud!');
});

for (const held of [false, true]) {
    void test(`opening a trapped ${held ? 'carried' : 'floor'} chest delays further actions after a luck escape`, async () => {
        freshTrapRoom({ hero: { uluck: 13 } });
        const chest = held ? await addInventoryObject(CHEST, { otrapped: true, olocked: false })
            : await floorObject(CHEST, 10, 10, { otrapped: true, olocked: false });
        pushKeys(' '.repeat(10));
        initRng(7n);

        const result = await useContainer(chest, { held });

        assert.equal(result.spentTime, true);
        assert.equal(game._helplessTurns, 1);
        assert.equal(game._helplessReason, 'opening a container');
        assert.equal(game._helplessDoneMessage, '');
    });
}

void test('opening a carried trapped chest announces the opening before the trap', async () => {
    freshTrapRoom({ hero: { uluck: 13 } });
    const chest = await addInventoryObject(CHEST, { otrapped: true, olocked: false });
    const input = resetInputState();
    initRng(7n);

    const opening = useContainer(chest, { held: true });
    await Promise.race([opening, input.waitUntilBlocked()]);
    const text = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
    input.feed(' '.repeat(10));
    await opening;

    assert.match(text, /You open the chest\.\.\.  You trigger a trap!/);
});
