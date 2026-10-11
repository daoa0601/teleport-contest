import type { ObjectRoomOptions } from './support/object-room.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import {
    BEAR_TRAP, D_ISOPEN, DOOR, PIT, POOL,
    TT_BEARTRAP, TT_BURIEDBALL, TT_PIT, TT_WEB, WEB,
} from '../js/const.js';
import { requireGameLevel, requireGameDisplay, game } from '../js/gstate.js';
import { newsym } from '../js/display.js';
import { jumpHero } from '../js/jumping.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { GOLD_PIECE, OBJECT_NAMES, STATUE } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { forceLearnSpell } from '../js/spell.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectsAt, addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function readyJump({ knight = false, ...room }: ObjectRoomOptions & { knight?: boolean } = {}) {
    freshObjectRoom({ flags: { tips: false, pickup: false }, ...room });
    grantIntrinsicProperty('jumping', knight ? 'outside' : 'form');
    return resetInputState();
}

function text() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

void test('physical jump refuses a hero without jumping before asking for a target', async () => {
    freshObjectRoom({ flags: { tips: false } });
    requireFixtureGame(game);
    const input = resetInputState();
    input.feed('jump\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.context.move, 0);
    assert.match(game._last_message, /can't jump very far/);
    assert.equal(game.u.ux, 10);
    assert.equal(input.isBlocked, false);
});

void test('jump target selection suspends before movement and Escape spends no time or nutrition', async () => {
    const input = readyJump();
    requireFixtureGame(game);
    const before = game.u.uhunger;
    const jumping = jumpHero();
    await input.waitUntilBlocked();
    assert.match(text(), /Where do you want to jump/);
    assert.equal(game.u.ux, 10);
    input.feed('\x1b');
    assert.deepEqual(await jumping, { spentTime: false, heroDied: false });
    assert.equal(game.u.uhunger, before);
});

void test('physical jump lands, pays nutrition, and installs its delay', async () => {
    const input = readyJump({ hero: { uhunger: 900 } });
    requireFixtureGame(game);
    input.feed('lll.');
    const result = await jumpHero();
    assert.equal(result.spentTime, true);
    assert.equal(game.u.ux, 13);
    assert.equal(game.u.uy, 10);
    assert.equal(game._helplessTurns, 1);
    assert.equal(game._helplessReason, 'jumping around');
    assert.ok(game.u.uhunger >= 875 && game.u.uhunger < 900);
});

void test('jump landing performs native autopickup on the final square', async () => {
    const input = readyJump();
    requireFixtureGame(game);
    game.flags.pickup = true;
    game.flags.pickup_types = '$';
    const gold = await floorObject(GOLD_PIECE, 13, 10, { quan: 20 });
    input.feed('lll.' + ' '.repeat(8));
    await jumpHero();
    assert.equal(game.u.ux, 13);
    assert.ok(game.inventory.includes(gold));
    assert.equal(gold.where, 'inventory');
});

void test('a fresh jumping spell supplies the physical command fallback through real casting', async () => {
    freshObjectRoom({ role: 'wizard', flags: { tips: false }, hero: {
        uen: 100, uenmax: 100, ulevel: 20,
        acurr: { a: [12, 18, 18, 12, 12, 12] },
    } });
    requireFixtureGame(game);
    const spell = forceLearnSpell(OBJECT_NAMES.indexOf('jumping'));
    assert.ok(spell);
    const input = resetInputState();
    initRng(2n);
    input.feed('lll.' + ' '.repeat(8));
    const result = await jumpHero();
    assert.equal(result.spentTime, true);
    assert.ok(game.u.uen < 100);
    assert.equal(game.u.ux, 13);
});

void test('innate knight jumping accepts a knight move and rejects an orthogonal jump', async () => {
    let input = readyJump({ knight: true });
    requireFixtureGame(game);
    input.feed('lll.');
    assert.equal((await jumpHero()).spentTime, false);
    assert.match(game._last_message, /Illegal move/);
    input = readyJump({ knight: true });
    input.feed('llj.');
    assert.equal((await jumpHero()).spentTime, true);
    assert.deepEqual([game.u.ux, game.u.uy], [12, 11]);
});

void test('magic jumping bypasses physical anatomy and hunger admission', async () => {
    const input = readyJump({ hero: {
        umonnum: MONSTER_NAME.indexOf('giant eel'), mh: 20, mhmax: 20,
        uhunger: 90,
    } });
    requireFixtureGame(game);
    input.feed('lll.');
    assert.equal((await jumpHero(2)).spentTime, true);
    assert.equal(game.u.ux, 13);
    assert.ok(game.u.uhunger < 90);
});

void test('physical weakness refuses a target while magic can bounce inside a swallower', async () => {
    readyJump({ hero: { uhunger: 100 } });
    requireFixtureGame(game);
    assert.equal((await jumpHero()).spentTime, false);
    assert.match(game._last_message, /lack the strength/);
    game.u.uswallow = true;
    assert.equal((await jumpHero(1)).spentTime, true);
    assert.match(game._last_message, /bounce around a little/);
    assert.equal(game.u.ux, 10);
});

void test('physical jumps reject a diagonal open doorway while magic uses the same later collision owner', async () => {
    let input = readyJump();
    requireFixtureGame(game);
    const door = game.level.requireAt(10, 10);
    door.typ = DOOR;
    door.doormask = D_ISOPEN;
    door.horizontal = false;
    input.feed('nj.');
    assert.equal((await jumpHero()).spentTime, false);
    assert.match(game._last_message, /diagonally out of a doorway/);
    input = readyJump();
    const magicDoor = game.level.requireAt(10, 10);
    magicDoor.typ = DOOR;
    magicDoor.doormask = D_ISOPEN;
    magicDoor.horizontal = false;
    input.feed('nj.');
    assert.equal((await jumpHero(1)).spentTime, true);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 12]);
});

void test('jumping crosses water without drowning and lands on dry terrain', async () => {
    const input = readyJump();
    requireFixtureGame(game);
    game.level.requireAt(11, 10).typ = POOL;
    game.level.requireAt(12, 10).typ = POOL;
    input.feed('lll.');
    assert.equal((await jumpHero()).heroDied, false);
    assert.equal(game.u.ux, 13);
    assert.equal(!!game.u.uinwater, false);
});

void test('ordinary pits are crossed but the landing pit catches the hero', async () => {
    const input = readyJump();
    requireFixtureGame(game);
    addTrap(game.level, PIT, 11, 10, { tseen: true });
    addTrap(game.level, PIT, 13, 10, { tseen: true });
    input.feed('lll.' + ' '.repeat(8));
    const result = await jumpHero();
    assert.equal(result.spentTime, true);
    assert.equal(game.u.ux, 13);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
});

void test('a blocking monster wakes and stops the jump before its square', async () => {
    const input = readyJump();
    requireFixtureGame(game);
    const monster = await createMonsterAt(MONSTER_NAME.indexOf('wumpus'), 12, 10);
    monster.msleeping = 1;
    input.feed('lll.' + ' '.repeat(8));
    await jumpHero();
    assert.equal(game.u.ux, 11);
    assert.equal(monster.msleeping, 0);
    assert.equal(monster.mpeaceful, 0);
});

void test('jumping discovers a hidden animal using its native object pronoun', async () => {
    const input = readyJump();
    requireFixtureGame(game);
    const monster = await createMonsterAt(MONSTER_NAME.indexOf('wumpus'), 12, 10);
    monster.mundetected = 1;
    newsym(12, 10);
    input.feed('lll.' + ' '.repeat(8));
    await jumpHero();
    assert.equal(monster.mundetected, 0);
    assert.equal(game.u.ux, 11);
    assert.match(game._last_message, /You find a wumpus by bumping into it\./);
});

void test('an unseen humanoid collision does not reveal species or replace its sex with it', async () => {
    const input = readyJump();
    requireFixtureGame(game);
    const monster = await createMonsterAt(MONSTER_NAME.indexOf('human'), 12, 10);
    monster.minvis = 1;
    monster.female = false;
    newsym(12, 10);
    input.feed('lll.' + ' '.repeat(8));
    await jumpHero();
    assert.equal(game.u.ux, 11);
    assert.match(game._last_message, /You find someone by bumping into him\./);
});

void test('a petrifying jump collision uses the real monster death and statue owner', async () => {
    const input = readyJump({ hero: {
        umonnum: MONSTER_NAME.indexOf('cockatrice'), mh: 20, mhmax: 20,
    } });
    requireFixtureGame(game);
    const monster = await createMonsterAt(MONSTER_NAME.indexOf('wumpus'), 12, 10);
    input.feed('lll.' + ' '.repeat(12));
    const result = await jumpHero(1);
    assert.equal(result.heroDied, false);
    assert.equal(game.u.ux, 11);
    assert.equal(monster.dead, true);
    assert.equal(game.level.monsters.includes(monster), false);
    const statue = floorObjectsAt(requireGameLevel(game), 12, 10).find(object => object.otyp === STATUE);
    assert.ok(statue);
    assert.equal(statue.corpsenm, monster.mnum);
    assert.equal(game.u.uconduct.killer, 1);
});

void test('a Sokoban pit ends the jump and is applied as the landing trap', async () => {
    const input = readyJump();
    requireFixtureGame(game);
    game.level.flags.sokoban_rules = true;
    addTrap(game.level, PIT, 11, 10, { tseen: true });
    input.feed('lll.' + ' '.repeat(8));
    assert.equal((await jumpHero()).spentTime, true);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
});

void test('jumping frees a web and removes its trap before travelling', async () => {
    const input = readyJump({ hero: { utrap: 4, utraptype: TT_WEB } });
    requireFixtureGame(game);
    const web = addTrap(game.level, WEB, 10, 10, { tseen: true });
    input.feed('lll.' + ' '.repeat(8));
    await jumpHero();
    assert.equal(game.u.ux, 13);
    assert.equal(game.u.utrap, 0);
    assert.equal(game.level.traps.includes(web), false);
});

void test('escaping a bear trap costs health and wounds a leg', async () => {
    const input = readyJump({ hero: { utrap: 4, utraptype: TT_BEARTRAP } });
    requireFixtureGame(game);
    addTrap(game.level, BEAR_TRAP, 10, 10, { tseen: true });
    input.feed('lll.' + ' '.repeat(8));
    initRng(11n);
    await jumpHero();
    assert.ok(game.u.uhp < 40);
    assert.ok((game.u._woundedLegTurns ?? 0) >= 500);
    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.ux, 13);
});

void test('a buried ball keeps the hero trapped and strains both legs without hunger cost', async () => {
    const input = readyJump({ hero: { utrap: 4, utraptype: TT_BURIEDBALL, uhunger: 900 } });
    requireFixtureGame(game);
    input.feed('lll.' + ' '.repeat(8));
    assert.equal((await jumpHero()).spentTime, true);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.utrap, 4);
    assert.equal(game.u._woundedLegSide, 'both');
    assert.equal(game.u.uhunger, 900);
});

void test('jumping in place triggers a trap, while an empty square takes no time', async () => {
    let input = readyJump();
    requireFixtureGame(game);
    input.feed('.');
    assert.equal((await jumpHero(1)).spentTime, false);
    assert.match(game._last_message, /decide not to jump/);
    input = readyJump();
    addTrap(game.level, PIT, 10, 10);
    input.feed('.' + ' '.repeat(8));
    assert.equal((await jumpHero(1)).spentTime, true);
    assert.equal(game.u.utraptype, TT_PIT);
});
