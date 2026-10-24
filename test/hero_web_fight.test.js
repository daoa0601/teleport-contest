// C hack.c:domove_fight_web(): the F-prefix melee against a seen web.
import assert from 'node:assert/strict';
import test from 'node:test';
import { A_STR, WEB } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DAGGER, MACE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryItem } from '../js/u_init.js';
import { addTrap } from './support/level-state.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('force fighting a seen web with a blunt weapon cannot cut it', async () => {
    const level = freshObjectRoom();
    const trap = addTrap(level, WEB, 11, 10, { tseen: true });
    const mace = await addInventoryObject(MACE);
    await setPrimaryWeapon(mace);
    initRng(1n);
    pushKeys('Fl');
    await rhack(0);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, "You can't cut a web with a mace!");
    assert.ok(level.traps.includes(trap), 'The web survives a blunt weapon.');
});
void test('Sting cuts a seen web away under force fighting', async () => {
    const level = freshObjectRoom();
    const trap = addTrap(level, WEB, 11, 10, { tseen: true });
    await setPrimaryWeapon(await addInventoryItem(await artifactObject('Sting')));
    initRng(1n);
    pushKeys('Fl');
    await rhack(0);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game._pending_message, 'Sting cuts through the web!');
    assert.equal(level.traps.includes(trap), false);
});
void test('a weak blade hacks a seen web ineffectually', async () => {
    const level = freshObjectRoom();
    const trap = addTrap(level, WEB, 11, 10, { tseen: true });
    const dagger = await addInventoryObject(DAGGER, { spe: -5 });
    await setPrimaryWeapon(dagger);
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 3;
    initRng(1n);
    pushKeys('Fl');
    await rhack(0);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game._pending_message, 'You hack ineffectually at some of the strands.');
    assert.ok(level.traps.includes(trap), 'The web survives the failed cut.');
});
void test('a strong blade cuts a seen web away', async () => {
    const level = freshObjectRoom();
    const trap = addTrap(level, WEB, 11, 10, { tseen: true });
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger);
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 18;
    initRng(1n);
    pushKeys('Fl');
    await rhack(0);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(game._pending_message, 'You cut through the web.');
    assert.equal(level.traps.includes(trap), false);
});
//# sourceMappingURL=hero_web_fight.test.js.map