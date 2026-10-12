import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack, continueCountedCommand } from '../js/cmd.js';
import { A_CON, A_DEX, A_STR, DOOR, SDOOR, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { LOCK_PICK } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPagerInput } from './support/pager-input.js';
function trappedDoor(mask = D_CLOSED, type = DOOR, messages = []) {
    const level = freshPlayableRoom({ flags: { verbose: true }, hero: { uhp: 100, uhpmax: 100 } });
    requireFixtureGame(game);
    for (const attribute of [A_STR, A_DEX, A_CON])
        game.u.acurr.a[attribute] = 25;
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
for (const command of ['o', 'l']) {
    void test(`${command === 'o' ? 'explicit' : 'automatic'} opening detonates a trapped door and stuns the hero`, async () => {
        const door = trappedDoor();
        if (command === 'o')
            pushKeys('l');
        await rhack(command.charCodeAt(0));
        assert.equal(door.doormask, D_NODOOR);
        assert.ok((game.u.uhp ?? 100) < 100);
        assert.ok((game.u.stunnedTurns ?? 0) > 0);
        assert.match(game._pending_message, /The door opens\.  KABOOM!!  The door was booby-trapped!  You stagger/);
    });
}
for (const type of [DOOR, SDOOR]) {
    void test(`kicking a trapped ${type === SDOOR ? 'secret ' : ''}door destroys it in an explosion`, async () => {
        const messages = [];
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
    const messages = [];
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
//# sourceMappingURL=door_booby_trap.test.js.map