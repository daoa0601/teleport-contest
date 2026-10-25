import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTOUNLOCK_KICK, DOOR, D_BROKEN, D_LOCKED } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function lockedDoorEast() {
    const level = freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_KICK } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_LOCKED;
    return door;
}
void test('answering the autounlock kick offer runs the kick at the door without a new direction', async () => {
    const door = lockedDoorEast();
    requirePlayingGame(game);
    // A polymorphed giant always breaks the door, independent of the roll.
    game.u.mh = game.u.mhmax = 100;
    game.u.mtimedone = 100;
    setHeroSpecies(MONSTER_NAME.indexOf('giant'));
    const input = resetInputState();
    pushKeys('l');
    await answerPrompts(rhack('o'.charCodeAt(0)), input, [
        { prompt: /This door is locked\.--More--/, keys: ' ' },
        { prompt: /Kick it\?/, keys: 'y' },
    ]);
    // The open command takes no turn; the queued kick owns the action.
    assert.equal(game.context.move, 0);
    assert.equal(door.doormask, D_LOCKED);
    const canned = game._cannedCommands ?? [];
    assert.equal(canned.length, 1);
    assert.equal(canned[0]?.kind, 'kick');
    // No direction key is available, so the kick must reuse the door
    // direction recorded with the command.
    await answerPrompts(rhack(0), input, []);
    assert.deepEqual(game._kickedLoc, { x: 11, y: 10 });
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'As you kick the door, it crashes open!');
    assert.equal(door.doormask, D_BROKEN);
});
for (const answer of ['n', 'q']) {
    void test(`declining the autounlock kick offer with '${answer}' queues no kick`, async () => {
        const door = lockedDoorEast();
        const input = resetInputState();
        pushKeys('l');
        await answerPrompts(rhack('o'.charCodeAt(0)), input, [
            { prompt: /This door is locked\.--More--/, keys: ' ' },
            { prompt: /Kick it\?/, keys: answer },
        ]);
        // Looking at the door taught the hero something, so the open
        // still spends its turn exactly as the native res dictates.
        assert.equal(game.context.move, 1);
        assert.equal(game._cannedCommands?.length ?? 0, 0);
        assert.equal(door.doormask, D_LOCKED);
        assert.equal(game._kickedLoc ?? null, null);
    });
}
void test('a mounted hero gets no kick offer for a locked door', async () => {
    const door = lockedDoorEast();
    const steed = await createSaddledSteed('pony', { x: 10, y: 9 });
    game.u.usteed = steed;
    const input = resetInputState();
    pushKeys('l');
    await answerPrompts(rhack('o'.charCodeAt(0)), input, []);
    assert.match(game._pending_message ?? '', /This door is locked\./);
    assert.equal(game._cannedCommands?.length ?? 0, 0);
    assert.equal(door.doormask, D_LOCKED);
});
//# sourceMappingURL=open_autounlock_kick.test.js.map