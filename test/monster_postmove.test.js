import test from 'node:test';
import assert from 'node:assert/strict';
import { ARROW_TRAP, D_CLOSED, D_ISOPEN, DOOR, MMOVE_MOVED, MM_ANGRY, NO_MINVENT, POLY_TRAP, ROOM, STAIRS, W_AMUL, WEB } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveMonsterForHeroAttack, moveloop_core } from '../js/allmain.js';
import { glyphAt, newsym } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { MONSTER_FLAGS1, requireMonsterData } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, DAGGER, RIN_CONFLICT, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { maketrap } from '../js/mklev.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
async function stationaryPetAttack(species, seed) {
    freshObjectRoom({ hero: { ux: 12, uy: 10 } });
    requirePlayingGame(game);
    const pet = await createMonsterAt(species, 9, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    const target = await createMonsterAt('lichen', 8, 10, MM_ANGRY | NO_MINVENT);
    target.mhp = target.mhpmax = 200;
    target.msleeping = 1;
    pushKeys(' '.repeat(40));
    initRng(BigInt(seed));
    return { pet, target };
}
void test('a pet can hide under its floor cover after attacking without moving', async () => {
    const { pet, target } = await stationaryPetAttack('cobra', 9);
    requirePlayingGame(game);
    await floorObject(ROCK, pet.mx, pet.my);
    await takeMonsterTurn(pet, game);
    assert.deepEqual([pet.mx, pet.my], [9, 10]);
    assert.equal(target.msleeping, 0, 'the attack woke the adjacent enemy');
    assert.ok(target.mhp < 200, 'the cobra bit the adjacent enemy before hiding');
    assert.equal(pet.mundetected, 1);
});
void test('a moving cobra refreshes its hallucination after checking for floor cover', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    const cobra = await createMonsterAt('cobra', 14, 10, MM_ANGRY | NO_MINVENT);
    cobra.msleeping = 0;
    // Arrival and the post-move hiding check both redraw an exposed cobra.
    initRng(1n);
    newsym(cobra.mx, cobra.my);
    newsym(cobra.mx, cobra.my);
    const refreshed = glyphAt(cobra.mx, cobra.my);
    assert.ok(refreshed?.kind === 'monster');
    initRng(1n);
    const result = await moveMonsterForHeroAttack(cobra);
    assert.equal(result.status, MMOVE_MOVED);
    assert.notDeepEqual([cobra.mx, cobra.my], [14, 10]);
    assert.equal(Boolean(cobra.mundetected), false, 'there is no floor cover to hide under');
    const current = glyphAt(cobra.mx, cobra.my);
    assert.ok(current?.kind === 'monster');
    assert.equal(current.mnum, refreshed.mnum, 'the hiding check refreshes the arrival appearance');
});
void test('a stationary pet spider can spin a web after a melee attack', async () => {
    let spunWeb = false;
    for (let seed = 1; seed <= 80 && !spunWeb; seed++) {
        const { pet } = await stationaryPetAttack('giant spider', seed);
        requirePlayingGame(game);
        await takeMonsterTurn(pet, game);
        assert.deepEqual([pet.mx, pet.my], [9, 10]);
        const web = game.level.traps.find(trap => trap.ttyp === WEB && trap.tx === 9 && trap.ty === 10);
        spunWeb = web !== undefined;
        if (web)
            assert.equal(web.tseen, true, 'a visible new web must be revealed');
    }
    assert.ok(spunWeb, "an attack does not suppress the spider's web-spinning chance");
});
void test('a spider attacking from stairs cannot cover them with a web', async () => {
    let attacked = false;
    for (let seed = 1; seed <= 80; seed++) {
        const { pet, target } = await stationaryPetAttack('giant spider', seed);
        requirePlayingGame(game);
        game.level.requireAt(pet.mx, pet.my).typ = STAIRS;
        await takeMonsterTurn(pet, game);
        attacked ||= target.mhp < 200;
        assert.equal(game.level.traps.some(trap => trap.tx === pet.mx && trap.ty === pet.my && trap.ttyp === WEB), false);
        assert.equal(pet.mspec_used ?? 0, 0, 'failed web placement does not start a cooldown');
    }
    assert.ok(attacked, 'the spider completed an attack from the stairs');
});
void test('a Tengu still encounters its floor trap when teleporting leaves it in place', async () => {
    let wounded = false;
    for (let seed = 1; seed <= 30 && !wounded; seed++) {
        freshTurnRoom({ left: 9, right: 9, top: 10, bottom: 10,
            heroX: 20, heroY: 10 });
        requirePlayingGame(game);
        game.level.requireAt(20, 10).typ = ROOM;
        const tengu = await createMonsterAt('tengu', 9, 10, NO_MINVENT);
        tengu.mpeaceful = 1;
        tengu.movement = 12;
        tengu.mhp = tengu.mhpmax = 100;
        await maketrap(9, 10, ARROW_TRAP);
        pushKeys('m.' + ' '.repeat(50) + 'm.');
        initRng(BigInt(seed));
        await moveloop_core();
        await moveloop_core();
        assert.deepEqual([tengu.mx, tengu.my], [9, 10]);
        wounded = tengu.mhp < 100;
    }
    assert.ok(wounded, 'the unchanged position still reaches the floor trap');
});
void test('retaining floor cover without acting does not start the post-action hiding tail', async () => {
    const { pet, target } = await stationaryPetAttack('cobra', 1);
    requirePlayingGame(game);
    await floorObject(ROCK, pet.mx, pet.my);
    await takeMonsterTurn(pet, game);
    assert.deepEqual([pet.mx, pet.my], [9, 10]);
    assert.equal(target.msleeping, 1);
    assert.equal(Boolean(pet.mundetected), false);
});
for (const lifesaving of [false, true]) {
    void test(`a floor trap resolves ${lifesaving ? 'life saving' : 'death'} before the monster opens its door`, async () => {
        let trapHit = false;
        for (let seed = 1; seed <= 20 && !trapHit; seed++) {
            freshTurnRoom({ left: 9, right: 11, top: 10, bottom: 10,
                heroX: 9, heroY: 10 });
            requirePlayingGame(game);
            const door = game.level.requireAt(10, 10);
            door.typ = DOOR;
            door.doormask = D_CLOSED;
            await maketrap(10, 10, ARROW_TRAP);
            const kobold = await createMonsterAt('kobold', 11, 10, MM_ANGRY | NO_MINVENT);
            kobold.movement = 12;
            kobold.mhp = 1;
            const amulet = lifesaving
                ? await equipMonsterObject(kobold, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL)
                : null;
            pushKeys('m.' + ' '.repeat(50) + 'm.');
            initRng(BigInt(seed));
            await moveloop_core();
            await moveloop_core();
            trapHit = amulet ? !kobold.minvent.includes(amulet) : !!kobold.dead;
            if (trapHit) {
                assert.equal(door.doormask, lifesaving ? D_ISOPEN : D_CLOSED);
                assert.equal(Boolean(kobold.dead), !lifesaving);
            }
        }
        assert.ok(trapHit, 'the arrow trap struck the one-HP monster');
    });
}
void test('reluctant movement and a web wait for their preceding messages', async () => {
    const input = freshTurnRoom({ left: 9, right: 13, top: 10, bottom: 10,
        heroX: 9, heroY: 10 });
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 13, 10, NO_MINVENT);
    initializePet(dog, { state: game });
    dog.movement = 12;
    await floorObject(ROCK, 12, 10, { cursed: true });
    const web = await maketrap(12, 10, WEB);
    assert.ok(web);
    const dagger = await addInventoryObject(DAGGER);
    const messages = [];
    input.beforeRead = () => {
        messages.push({
            text: (game._screen_output.split('\n')[0] ?? ''), trapped: !!dog.mtrapped,
        });
    };
    initRng(1n);
    pushKeys('d' + dagger.invlet + ' '.repeat(80) + 'm.');
    await moveloop_core();
    await moveloop_core();
    const dropped = messages.find(message => message.text.startsWith('You drop'));
    const reluctant = messages.find(message => message.text.includes('reluctantly'));
    assert.ok(dropped && reluctant, 'both lines required a player acknowledgement');
    assert.equal(dropped.trapped, false, 'the dog has not reached its trap while the drop line waits');
    assert.equal(reluctant.trapped, false, 'the web waits until its own message can be shown');
    assert.equal(dog.mtrapped, 1);
    assert.equal(web.tseen, true);
    assert.ok(messages.some(message => message.text.includes('caught in a spider web')));
});
void test('polymorphing on a door keeps the opening ability from before the trap', async () => {
    freshTurnRoom({ left: 9, right: 11, top: 10, bottom: 10,
        heroX: 9, heroY: 10 });
    requirePlayingGame(game);
    const door = game.level.requireAt(10, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    await maketrap(10, 10, POLY_TRAP);
    // Weak monsters deliberately use this trap in find_misc(), returning
    // before m_move() and its door handling. The captain moves onto it.
    const monster = await createMonsterAt('orc-captain', 11, 10, MM_ANGRY | NO_MINVENT);
    monster.movement = 12;
    const originalForm = monster.mnum;
    initRng(1n);
    pushKeys('m.' + ' '.repeat(100) + 'm.');
    await moveloop_core();
    await moveloop_core();
    assert.notEqual(monster.mnum, originalForm);
    const form = requireMonsterData(MONSTER_FLAGS1, monster.mnum);
    assert.ok(form & 0x2000, 'the new form has no hands');
    assert.equal(form & 0x0c, 0, 'the new form cannot bypass the door by phasing or oozing');
    assert.equal(door.doormask, D_ISOPEN);
});
void test('a pet cobra hides under its cover after biting the hero under Conflict', async () => {
    const input = freshTurnRoom({ left: 10, right: 11,
        top: 10, bottom: 10, heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    installPagerInput(input, {
        expected: /cobra|poison|feel weaker|ring of conflict/i,
        limit: 12,
    });
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    game.u.uhp = game.u.uhpmax = 200;
    const cobra = await createMonsterAt('cobra', 11, 10, NO_MINVENT);
    initializePet(cobra, { state: game });
    cobra.movement = 12;
    await floorObject(ROCK, 11, 10);
    initRng(81n);
    input.feed('m.');
    await finishAtCommandInput(input, async () => {
        await moveloop_core();
        await moveloop_core();
    }, /cobra|poison|feel weaker/i);
    assert.ok(game.u.uhp < 200, 'the cobra bit the hero');
    assert.deepEqual([cobra.mx, cobra.my], [11, 10]);
    assert.equal(cobra.mundetected, 1);
});
void test('hurtling into a web catches the monster and announces it once', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | NO_MINVENT);
    await maketrap(12, 10, WEB);
    const messages = [];
    await hurtleMonster(goblin, 1, 0, 1, {
        announce: async (message) => messages.push(message),
    });
    assert.deepEqual([goblin.mx, goblin.my], [12, 10]);
    assert.equal(goblin.mtrapped, 1);
    assert.equal(messages.filter(message => message.includes('caught in a spider web')).length, 1);
});
//# sourceMappingURL=monster_postmove.test.js.map