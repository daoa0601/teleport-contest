import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun } from '../js/hack.js';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { FLINT, POT_HEALING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
for (const keys of ['Fgl', 'gFl', 'FGl', 'GFl']) {
    void test(`${keys} stops before a visible hostile without attacking or spending time`, async () => {
        const input = freshTurnRoom();
        const monster = await createMonsterAt('jackal', 11, 10);
        monster.mpeaceful = false;
        monster.msleeping = 1;
        const hitPoints = monster.mhp;
        input.feed(keys);
        await rhack(0);
        assert.equal(game.u.ux, 10);
        assert.equal(game.context.move, 0);
        assert.equal(monster.mhp, hitPoints);
        assert.equal(monster.msleeping, 1, 'stopping must not wake the target');
        assert.equal((await continueRun()).tookTime, false);
    });
}
for (const [keys, message] of [
    ['mm', 'Double m prefix, canceled.'],
    ['FF', 'Double fight prefix, canceled.'],
    ['gg', 'Double rush prefix, canceled.'],
    ['GG', 'Double run prefix, canceled.'],
    ['gG', 'Double run prefix, canceled.'],
    ['Gg', 'Double rush prefix, canceled.'],
]) {
    void test(`${keys} cancels the movement prefix and leaves the next key unread`, async () => {
        const input = freshTurnRoom();
        input.feed(keys + 'l');
        await rhack(0);
        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 0);
        assert.equal(game.u.ux, 10);
        assert.equal(await nhgetch(), 'l'.charCodeAt(0));
    });
}
for (const [keys, message] of [
    ['mi', "The inventory command does not accept 'm' prefix."],
    ['F>', "The 'F' prefix should be followed by a movement command other than up or down."],
    ['g.', "The 'g' prefix should be followed by a movement command."],
    ['m~', "Unknown command '~'."],
    ['gL', "The 'g' prefix should be followed by a movement command."],
    ['F\x1b', ''],
]) {
    void test(`${JSON.stringify(keys)} reports the native prefix rejection without spending time`, async () => {
        const input = freshTurnRoom();
        input.feed(keys);
        await rhack(0);
        assert.equal(game._pending_message, message);
        assert.equal(game.context.move, 0);
    });
}
for (const [prefix, direction, mode, noPickup] of [
    ['g', 'l', 2, false], ['G', 'l', 3, false], ['mG', 'L', 3, true],
    ['Gm', 'L', 3, true], ['m', 'L', 1, true],
]) {
    void test(`${prefix}${direction} preserves its movement mode`, async () => {
        const input = freshTurnRoom();
        input.feed(prefix + direction);
        await rhack(0);
        assert.equal(game.u.ux, 11);
        assert.equal(game.context.move, 1);
        assert.equal(game.context.run, mode);
        assert.equal(!!game.context.nopick, noPickup);
        assert.equal((await continueRun()).tookTime, true);
        assert.equal(game.u.ux, 12);
    });
}
void test('a movement prefix can be entered as an extended command', async () => {
    const input = freshTurnRoom();
    input.feed('#rush\nl');
    await rhack(0);
    assert.equal(game.u.ux, 11);
    assert.equal(game.context.run, 2);
    assert.equal(game.context.move, 1);
});
void test('an extended menu request rejects quaff as a nonmovement command', async () => {
    const input = freshTurnRoom();
    const potion = await addInventoryObject(POT_HEALING);
    input.feed(`#reqmenu\nq${potion.invlet}`);
    await rhack(0);
    assert.equal(game._pending_message, "The 'm' prefix should be followed by a movement command.");
    assert.equal(game.context.move, 0);
    assert.equal(game.inventory.includes(potion), true);
    assert.equal(await nhgetch(), potion.invlet.charCodeAt(0), 'the rejected command never opens the potion picker');
});
void test('a rebound menu prefix names its actual key when doubled', async () => {
    const input = freshTurnRoom();
    game.commandBindings.bindKey('!'.charCodeAt(0), 'reqmenu');
    input.feed('!!');
    await rhack(0);
    assert.equal(game._pending_message, 'Double ! prefix, canceled.');
});
void test('a grid bug rejects diagonal movement before attempting a step', async () => {
    const input = freshTurnRoom();
    game.u.umonnum = MONSTER_NAME.indexOf('grid bug');
    input.feed('y');
    await rhack(0);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(game.u.dx, 0);
    assert.equal(game.u.dy, 0);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, "You can't get there from here...");
});
void test('an unknown key clears command recall while retaining an unfinished fight request', async () => {
    const input = freshTurnRoom();
    input.feed('F~l');
    await rhack(0);
    assert.equal(game._pending_message, "Unknown command '~'.");
    await rhack(0);
    assert.equal(game.u.ux, 10);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /attack thin air/);
});
void test('an unknown key retains a rush request until a movement command consumes it', async () => {
    const input = freshTurnRoom();
    input.feed('g~l');
    await rhack(0);
    assert.equal(game._pending_message, "Unknown command '~'.");
    await rhack(0);
    assert.equal(game.u.ux, 11);
    assert.equal(game.context.run, 2);
    assert.equal((await continueRun()).tookTime, true);
    assert.equal(game.u.ux, 12);
});
void test('a fight prefix retained past an unknown key force-fights a run step into a visible pet', async () => {
    const input = freshTurnRoom();
    const pet = await createMonsterAt('kitten', 11, 10);
    initializePet(pet, { state: game });
    const stones = await addInventoryObject(FLINT);
    assert.ok(stones.invlet, 'the flint stones need an inventory letter');
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    installPagerInput(input, {
        expected: /flint|bash|kitten|hit|miss|weapon in hand/i,
        limit: 20,
    });
    input.feed(stones.invlet);
    await rhack('w'.charCodeAt(0));
    await flushPendingTopline();
    messages.length = 0;
    // hack.c:2764 stops a run only for a monster that is not _is_safemon();
    // forcefight is not part of that macro, so the pending fight request
    // turns the run step into a real attack on the peaceful pet.
    input.feed('F~Gl');
    await rhack(0);
    assert.equal(game._pending_message, "Unknown command '~'.");
    await rhack(0);
    await flushPendingTopline();
    assert.match(messages.join('\n'), /You begin bashing monsters with your flint stones?\./);
    assert.equal(game.u.ux, 10, 'the attack replaces the step');
    assert.equal(game.context.move, 1, 'the attack spends the turn');
    assert.equal(pet.mx, 11, 'the pet is attacked rather than displaced');
    assert.equal(pet.my, 10);
});
//# sourceMappingURL=command_prefixes.test.js.map