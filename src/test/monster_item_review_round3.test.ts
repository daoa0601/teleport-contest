import assert from 'node:assert/strict';
import test from 'node:test';
import { moveMonsterForHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT, PIT, PLNMSG_ENVELOPED_IN_GAS } from '../js/const.js';
import { canSenseMonster, setTopline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { BOULDER, SCR_TELEPORTATION, WAN_DIGGING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { monsterKnowsTrap, monsterLearnsTrap } from '../js/trap_knowledge.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';

void test('a boulder fills a monster-dug pit before the digger can fall into it', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    level.flags.hardfloor = true;
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_DIGGING, { spe: 3 }), game);
    assert.ok(wand);
    const boulder = await floorObject(BOULDER, 10, 10);
    const messages: string[] = [];

    await useMonsterDefensiveItem(monster, { kind: 'digging', object: wand }, {
        state: game, publish: message => { messages.push(message); }, rollOne: () => 6,
    });

    assert.equal(level.traps.length, 0);
    assert.equal(boulder.where, 'gone');
    assert.equal(monster.mtrapped ?? 0, 0);
    assert.equal(monster.mhp, 100);
    assert.equal(messages.some(message => message.includes('falls into')), false);
});

void test('falling into a new monster-dug pit teaches the digger and sighted witnesses', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    level.flags.hardfloor = true;
    const digger = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    const witness = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    const blindWitness = await createMonsterAt('orc', 10, 11, NO_MINVENT);
    blindWitness.mcansee = 0;
    const wand = await addObjectToMonsterInventory(digger, await knownObject(WAN_DIGGING, { spe: 3 }), game);
    assert.ok(wand);

    await useMonsterDefensiveItem(digger, { kind: 'digging', object: wand }, {
        state: game, publish: () => {}, rollOne: () => 1,
    });

    assert.equal(digger.mtrapped, 1);
    assert.equal(monsterKnowsTrap(digger, { ttyp: PIT }), true);
    assert.equal(monsterKnowsTrap(witness, { ttyp: PIT }), true);
    assert.equal(monsterKnowsTrap(blindWitness, { ttyp: PIT }), false);
});

void test('a digger bungles a familiar pit and takes damage after its avoidance attempt', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    level.flags.hardfloor = true;
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    monsterLearnsTrap(monster, { ttyp: PIT });
    const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_DIGGING, { spe: 3 }), game);
    assert.ok(wand);
    initRng(1n);

    await useMonsterDefensiveItem(monster, { kind: 'digging', object: wand }, {
        state: game, publish: () => {},
    });

    assert.equal(monster.mtrapped, 1);
    // FORCEBUNGLE keeps the familiar-trap attempt before the pit's damage.
    assert.equal(monster.mhp, 99);
});

for (const cursed of [true, false]) {
    void test(`an unseen, unheard ${cursed ? 'cursed' : 'ordinary'} teleport scroll does not ask for a name`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        level.flags.noteleport = true;
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
        const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        game.u.deafTurns = 10;
        const scroll = await addObjectToMonsterInventory(monster, await knownObject(SCR_TELEPORTATION, {
            typeKnown: false, dknown: true, cursed,
        }), game);
        assert.ok(scroll);
        monster.minvis = true;
        assert.equal(scroll.dknown, true);
        const input = resetInputState();
        let prompts = 0;
        input.display = { async readKey() { prompts++; return 27; } };
        const messages: string[] = [];

        await useMonsterDefensiveItem(monster, { kind: 'teleport-scroll', object: scroll }, {
            state: game, random: () => 0, publish: message => { messages.push(message); },
        });

        assert.equal(scroll.where, 'gone');
        assert.equal(messages.length, 0);
        assert.equal(prompts, 0);
    });
}

void test('hearing an unseen monster read an unknown teleport scroll permits naming it', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.minvis = true;
    const scroll = await addObjectToMonsterInventory(monster, await knownObject(SCR_TELEPORTATION, {
        typeKnown: false, dknown: false, cursed: true,
    }), game);
    assert.ok(scroll);
    const input = resetInputState();
    let prompts = 0;
    input.display = { async readKey() { prompts++; return 27; } };
    const messages: string[] = [];

    await useMonsterDefensiveItem(monster, { kind: 'teleport-scroll', object: scroll }, {
        state: game, random: () => 0, publish: message => { messages.push(message); },
    });

    assert.equal(scroll.dknown, true);
    assert.match(messages[0] ?? '', /^You hear/);
    assert.equal(prompts, 1);
});

void test('a swallowing steam vortex envelops the hero before its move resumes from message input', async () => {
    const level = freshObjectRoom({ heroX: 10, heroY: 10, context: { mon_moving: true } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('steam vortex', 10, 10, MM_ANGRY | NO_MINVENT);
    placeMonsterAt(monster, game.u.ux, game.u.uy);
    monster.mflee = 1;
    monster.mfleetim = 20;
    game.u.uswallow = 1;
    game.u.ustuck = monster;
    const input = resetInputState();
    let pausedWithCloud = false;
    input.beforeRead = () => {
        pausedWithCloud = true;
        assert.ok(level.regions.some(region => region.cells.some(cell => cell.x === 10 && cell.y === 10)));
        assert.equal(monster.mx, 10);
        assert.equal(monster.my, 10);
    };
    installPagerInput(input, { expected: /earlier message/, limit: 1 });
    await setTopline('An earlier message fills the line while the swallowing steam vortex starts to move.');

    await moveMonsterForHeroAttack(monster);

    assert.equal(pausedWithCloud, true);
    assert.ok(monster.mx !== 10 || monster.my !== 10);
    assert.equal(game._pending_message, 'You are enveloped in a cloud of steam!');
    assert.equal(game._lastPlineKind, PLNMSG_ENVELOPED_IN_GAS);
});

void test('a deaf telepath can name a previously seen scroll after sensing the reader teleport', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    const scroll = await addObjectToMonsterInventory(monster, await knownObject(SCR_TELEPORTATION, {
        typeKnown: false, dknown: true,
    }), game);
    assert.ok(scroll);
    game.u.telepathy = true;
    game.u.deafTurns = 10;
    await makeBlinded(10, { state: game, talk: false });
    vision_recalc(0);
    assert.equal(canSenseMonster(monster), true);
    const input = resetInputState();
    let prompts = 0;
    input.display = {
        async readKey() {
            const screen = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/--More--/.test(screen)) return 32;
            assert.match(screen, /Call a scroll labeled/);
            prompts++;
            return 27;
        },
    };

    await useMonsterDefensiveItem(monster, { kind: 'teleport-scroll', object: scroll }, {
        state: game, random: () => 0,
    });

    assert.equal(scroll.where, 'gone');
    assert.equal(prompts, 1);
});
