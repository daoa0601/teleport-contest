import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_CLOSED, D_LOCKED, TT_PIT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { artifactByName } from '../js/artifacts.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CREDIT_CARD } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('opening a locked door offers the carried unlock tool after acknowledging the lock', async () => {
    for (const answer of ['y', 'q']) {
        const level = freshObjectRoom();
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        await addInventoryObject(CREDIT_CARD);
        const input = resetInputState();
        pushKeys('l');
        await answerPrompts(rhack('o'.charCodeAt(0)), input, [
            { prompt: /This door is locked\.--More--/, keys: ' ' },
            { prompt: /Unlock it with your credit card\?/, keys: answer },
        ]);
        assert.equal(door.doormask, D_LOCKED);
        assert.equal(Boolean(game._occupation), answer === 'y');
        assert.equal(game.context.move, answer === 'y' ? 1 : 0);
    }
});
for (const doorState of [D_CLOSED, D_LOCKED]) {
    void test(`opening a ${doorState === D_LOCKED ? 'locked' : 'closed'} door from a pit refuses without spending a turn`, async () => {
        const level = freshObjectRoom({ hero: { utrap: 3, utraptype: TT_PIT } });
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = doorState;
        await addInventoryObject(CREDIT_CARD);
        const input = resetInputState();
        pushKeys('l');
        await answerPrompts(rhack('o'.charCodeAt(0)), input, []);
        assert.match(game._pending_message, /You can't reach over the edge of the pit\./);
        assert.equal(game.context.move, 0);
        assert.equal(Boolean(game._occupation), false);
        assert.equal(door.doormask, doorState);
        assert.equal(game.u.utrap, 3);
    });
}
const keyTouchAlignments = [0, -1];
for (const alignment of keyTouchAlignments) {
    void test(`autounlock touches a foreign quest key before ${alignment === 0 ? 'rejecting it' : 'starting to unlock'}`, async () => {
        const level = freshObjectRoom({
            hero: { uhp: 100, uhpmax: 100, ualign: { type: alignment, record: 10 } },
        });
        requirePlayingGame(game);
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        const artifact = artifactByName('The Master Key of Thievery');
        assert.ok(artifact);
        const key = await addInventoryObject(artifact.baseType, {
            oartifact: artifact.id, oextra: { oname: artifact.name },
        });
        const input = resetInputState();
        pushKeys('l');
        await answerPrompts(rhack('o'.charCodeAt(0)), input, [
            { prompt: /This door is locked\.--More--/, keys: ' ' },
            { prompt: /Unlock it with your skeleton key\?/, keys: 'y' },
            ...(alignment === 0 ? [{
                    prompt: /You are blasted by The Master Key of Thievery's power!--More--/, keys: ' ',
                }] : []),
        ]);
        assert.ok(game.u.uhp < 100, 'the artifact blast damages the hero');
        assert.ok(game.u.uhp >= 60, 'a self-willed artifact blast deals at most four ten-sided dice');
        assert.equal(Boolean(game._occupation), alignment === -1);
        assert.equal(game.context.move, 1, 'even a rejected touch spends the opening turn');
        assert.equal(door.doormask, D_LOCKED);
        assert.ok(game.inventory.includes(key), 'the rejected key remains carried');
        assert.match(game._pending_message, alignment === 0
            ? /The Master Key of Thievery is beyond your control!/
            : /You are blasted by The Master Key of Thievery's power!/);
    });
}
//# sourceMappingURL=open_autounlock.test.js.map