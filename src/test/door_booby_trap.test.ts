import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack, continueCountedCommand } from '../js/cmd.js';
import { A_CON, A_DEX, A_STR, DOOR, SDOOR, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, NO_MINVENT, VWALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { LOCK_PICK } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { cansee, vision_recalc, vision_reset_new_level } from '../js/vision.js';

function trappedDoor(mask = D_CLOSED, type = DOOR, messages: string[] = []) {
    const level = freshPlayableRoom({ flags: { verbose: true }, hero: { uhp: 100, uhpmax: 100 } });
    requireFixtureGame(game);
    for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 25;
    const door = level.requireAt(11, 10);
    door.typ = type;
    door.doormask = mask | D_TRAPPED;
    const input = resetInputState();
    installPagerInput(input, { expected: /door|booby-trapped|stagger|picking the lock/, limit: 5 });
    const pager = input.display;
    assert.ok(pager);
    input.display = { async readKey() {
        messages.push(game._pending_message);
        return pager.readKey();
    } };
    return door;
}

for (const command of ['o', 'l'] as const) {
    void test(`${command === 'o' ? 'explicit' : 'automatic'} opening detonates a trapped door and stuns the hero`, async () => {
        const door = trappedDoor();
        if (command === 'o') pushKeys('l');
        await rhack(command.charCodeAt(0));
        assert.equal(door.doormask, D_NODOOR);
        assert.ok((game.u.uhp ?? 100) < 100);
        assert.ok((game.u.stunnedTurns ?? 0) > 0);
        assert.match(game._pending_message, /The door opens\.  KABOOM!!  The door was booby-trapped!  You stagger/);
    });
}

for (const type of [DOOR, SDOOR]) {
    void test(`kicking a trapped ${type === SDOOR ? 'secret ' : ''}door destroys it in an explosion`, async () => {
        const messages: string[] = [];
        const door = trappedDoor(D_CLOSED, type, messages);
        pushKeys('l');
        await rhack(4);
        assert.equal(door.typ, DOOR);
        assert.equal(door.doormask, D_NODOOR);
        assert.ok((game.u.uhp ?? 100) < 100);
        assert.ok((game.u.stunnedTurns ?? 0) > 0);
        assert.match([...messages, game._pending_message].join(" "), /booby-trapped/);
    });
}

void test('successfully picking a trapped door lock detonates it', async () => {
    const messages: string[] = [];
    const door = trappedDoor(D_LOCKED, DOOR, messages);
    const tool = await knownObject(LOCK_PICK);
    game._occupation = { key: 'pick-lock', text: 'picking the lock', remaining: 51, usedtime: 0,
        door, x: 11, y: 10, tool, chance: 100 };
    await continueCountedCommand();
    assert.equal(door.doormask, D_NODOOR);
    assert.ok((game.u.uhp ?? 100) < 100);
    assert.ok((game.u.stunnedTurns ?? 0) > 0);
    assert.equal(game._occupation, null);
    assert.match([...messages, game._pending_message].join(" "), /You succeed in picking the lock\..*KABOOM!!/);
});

void test('picking a trapped lock leaves a hidden sleeper beyond the blast asleep until the following turn', async () => {
    const door = trappedDoor(D_LOCKED);
    requireFixtureGame(game);
    for (const y of [8, 9, 11, 12]) game.level.requireAt(11, y).typ = VWALL;
    const gnome = await createMonsterAt('gnome', 16, 10, NO_MINVENT);
    gnome.msleeping = 1;
    gnome.mpeaceful = 1;
    gnome.movement = 12;
    // Aggravation makes waking certain once the monster has line of sight.
    // Six squares is outside a level-one hero's explosion wake radius.
    game.u.aggravateMonster = true;
    vision_reset_new_level();
    vision_recalc(0);
    assert.equal(cansee(16, 10), false, 'The closed door must hide the sleeping gnome.');
    const tool = await knownObject(LOCK_PICK);
    game._occupation = { key: 'pick-lock', text: 'picking the lock', remaining: 51, usedtime: 0,
        door, x: 11, y: 10, tool, chance: 100 };
    const input = resetInputState();
    installPagerInput(input, { expected: /door|booby-trapped|stagger|picking the lock|gnome/, limit: 10 });
    game._moveloopStarted = true;

    await continueCountedCommand();
    game._heroTimePending = true;
    game.u.umovement = 0;
    await finishAtCommandInput(input, moveloop_core, /door|booby-trapped|stagger|picking the lock|gnome|^$/);

    assert.equal(gnome.msleeping, 1, 'The monster phase must use sight from before the door exploded.');
    assert.equal(cansee(16, 10), true, 'The next command must see through the destroyed door.');

    game._heroTimePending = true;
    game.u.umovement = 0;
    await finishAtCommandInput(input, moveloop_core, /gnome|^$/);
    assert.equal(gnome.msleeping, 0, 'The gnome must wake on the next monster phase.');
});
