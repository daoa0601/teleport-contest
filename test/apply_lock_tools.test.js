import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { AUTOUNLOCK_UNTRAP, DOOR, D_CLOSED, D_LOCKED, D_TRAPPED, LEVEL_TELEP } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { artifactByName } from '../js/artifacts.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CHEST, CREDIT_CARD, LOCK_PICK, SKELETON_KEY } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
for (const toolType of [CREDIT_CARD, LOCK_PICK, SKELETON_KEY]) {
    for (const target of ['door', 'box']) {
        void test(`applying ${toolType === CREDIT_CARD ? 'a card' : toolType === LOCK_PICK ? 'a pick' : 'a key'} unlocks a ${target}`, async () => {
            const level = freshObjectRoom({ role: 'rogue', hero: { acurr: { a: [18, 25, 18, 18, 18, 18] } } });
            const tool = await addInventoryObject(toolType, { invlet: 'a' });
            const door = level.requireAt(11, 10);
            door.typ = DOOR;
            door.doormask = D_LOCKED;
            const box = target === 'box' ? await floorObject(CHEST, 10, 10, { olocked: true }) : null;
            const input = resetInputState();
            pushKeys(`a${target === 'door' ? 'l' : '.'}`);
            await answerPrompts(rhack('a'.charCodeAt(0)), input, [{ prompt: target === 'door' ? /Unlock it\?/ : /here; (unlock it|pick its lock)\?/, keys: 'y' }]);
            assert.equal(game._occupation?.key, 'pick-lock');
            initRng(1n);
            pushKeys(' '.repeat(20));
            for (let turn = 0; game._occupation && turn < 51; turn++)
                await continueCountedCommand();
            assert.equal(target === 'door' ? door.doormask : box?.olocked, target === 'door' ? D_CLOSED : false);
            assert.equal(game._occupation, null);
            assert.match(game._pending_message, tool.otyp === SKELETON_KEY ? /succeed in unlocking the (door|chest)/ : /succeed in picking the lock/);
        });
    }
}
void test('applying a key can lock an unlocked closed door', async () => {
    const level = freshObjectRoom();
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    await addInventoryObject(SKELETON_KEY, { invlet: 'a' });
    const input = resetInputState();
    pushKeys('al');
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [{ prompt: /Lock it\?/, keys: 'y' }]);
    pushKeys(' '.repeat(20));
    for (let turn = 0; game._occupation && turn < 51; turn++)
        await continueCountedCommand();
    assert.equal(door.doormask, D_LOCKED);
    assert.match(game._pending_message, /You succeed in locking the door\./);
});
void test('a card refuses to lock a closed unlocked door', async () => {
    const level = freshObjectRoom();
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    await addInventoryObject(CREDIT_CARD, { invlet: 'a' });
    pushKeys('al');
    await rhack('a'.charCodeAt(0));
    assert.equal(game._pending_message, "You can't lock a door with a credit card.");
    assert.equal(game.context.move, 1);
    assert.ok(!game._occupation);
});
void test('cancelling the apply direction spends no turn', async () => {
    freshObjectRoom();
    await addInventoryObject(SKELETON_KEY, { invlet: 'a' });
    pushKeys('a\x1b');
    await rhack('a'.charCodeAt(0));
    assert.equal(game.context.move, 0);
});
void test('declining a floor box learns its lock state and spends a turn', async () => {
    freshObjectRoom();
    const box = await floorObject(CHEST, 10, 10, { olocked: true, lknown: false });
    await addInventoryObject(SKELETON_KEY, { invlet: 'a' });
    const input = resetInputState();
    pushKeys('a.');
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [{ prompt: /here; unlock it\?/, keys: 'n' }]);
    assert.equal(box.lknown, true);
    assert.equal(box.olocked, true);
    assert.equal(game.context.move, 1);
});
void test('an interrupted box attempt resumes without asking for another direction', async () => {
    freshObjectRoom({ hero: { acurr: { a: [3, 3, 3, 3, 3, 3] } } });
    const box = await floorObject(CHEST, 10, 10, { olocked: true });
    await addInventoryObject(CREDIT_CARD, { invlet: 'a' });
    const input = resetInputState();
    pushKeys('a.');
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [{ prompt: /here; unlock it\?/, keys: 'y' }]);
    initRng(1n);
    await continueCountedCommand();
    assert.equal(box.olocked, true);
    await stopHeroOccupation();
    pushKeys('a ');
    await rhack('a'.charCodeAt(0));
    assert.equal(game._occupation?.key, 'pick-lock');
    assert.match(game._pending_message, /resume your attempt at picking the lock/);
});
void test('moving away from the floor box ends picking without unlocking it', async () => {
    freshObjectRoom();
    const box = await floorObject(CHEST, 10, 10, { olocked: true });
    await addInventoryObject(SKELETON_KEY, { invlet: 'a' });
    const input = resetInputState();
    pushKeys('a.');
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [{ prompt: /here; unlock it\?/, keys: 'y' }]);
    game.u.ux = 12;
    await continueCountedCommand();
    assert.equal(box.olocked, true);
    assert.equal(game._occupation, null);
});
void test('checking a door through autounlock ignores a floor trap on that square', async () => {
    const level = freshObjectRoom({ flags: { autounlock: AUTOUNLOCK_UNTRAP } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_LOCKED;
    level.traps.push({ tx: 11, ty: 10, ttyp: LEVEL_TELEP, tseen: true, once: false, launch: { x: 0, y: 0 } });
    await addInventoryObject(SKELETON_KEY, { invlet: 'a' });
    const input = resetInputState();
    pushKeys('al');
    await answerPrompts(rhack('a'.charCodeAt(0)), input, [{ prompt: /Check this door for a trap\?/, keys: 'y' }]);
    assert.equal(game._pending_message, 'You find no traps on the door.');
    assert.equal(door.doormask, D_LOCKED);
    assert.equal(level.traps.length, 1);
    assert.equal(game.context.move, 1);
});
for (const target of ['box', 'door']) {
    void test(`the Master Key disarms a ${target} trap and leaves its lock locked`, async () => {
        const level = freshObjectRoom({ role: 'rogue', hero: { ualign: { type: -1, record: 10 } } });
        const artifact = artifactByName('The Master Key of Thievery');
        assert.ok(artifact);
        await addInventoryObject(SKELETON_KEY, { invlet: 'a', oartifact: artifact.id, cursed: false });
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED | D_TRAPPED;
        const box = target === 'box' ? await floorObject(CHEST, 10, 10, { olocked: true, otrapped: true }) : null;
        const input = resetInputState();
        pushKeys(`a${target === 'box' ? '.' : 'l'}`);
        await answerPrompts(rhack('a'.charCodeAt(0)), input, [
            { prompt: target === 'box' ? /here; unlock it\?/ : /Unlock it\?/, keys: 'y' },
            { prompt: /whispers:.*--More--/, keys: ' ' },
        ]);
        await answerPrompts(flushPendingTopline(), input, [{ prompt: /--More--/, keys: ' ' }]);
        initRng(1n);
        await answerPrompts(continueCountedCommand(), input, [
            ...(target === 'box' ? [{ prompt: /You find a trap!.*--More--/, keys: ' ' }] : []),
            { prompt: /Do you want to try to disarm it\?/, keys: 'y' },
        ]);
        assert.equal(target === 'box' ? box?.otrapped : door.doormask & D_TRAPPED, target === 'box' ? false : 0);
        assert.equal(target === 'box' ? box?.olocked : door.doormask, target === 'box' ? true : D_LOCKED);
        assert.equal(game._occupation, null);
    });
}
//# sourceMappingURL=apply_lock_tools.test.js.map