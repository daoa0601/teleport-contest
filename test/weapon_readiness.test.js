import { installPagerInput } from './support/pager-input.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { BOW, DAGGER, OBJECT_NAMES, PICK_AXE, TOWEL } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { applyInventoryObject, dropInventoryObject, runExtendedCommand } from './support/commands.js';
async function combatRoom() {
    freshObjectRoom({ role: 'barbarian' });
    requirePlayingGame(game);
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, {
        expected: /wield|hand|bash|hit|miss|pick-axe|bow|halberd|towel|pony|ride|drop|dig|minotaur/i,
        limit: 200,
    });
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
    };
    await createMonsterAt('minotaur', game.u.ux + 1, game.u.uy, MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT);
    return messages;
}
async function text(messages) {
    await flushPendingTopline();
    const output = messages.join('\n');
    messages.length = 0;
    return output;
}
async function wield(object) {
    assert.ok(object.invlet);
    pushKeys(object.invlet);
    await rhack('w'.charCodeAt(0));
}
void test('dropping a used weapon announces bare-handed combat on the next attack only', async () => {
    const messages = await combatRoom();
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER);
    await wield(dagger);
    await rhack('l'.charCodeAt(0));
    await text(messages);
    await dropInventoryObject(dagger);
    await text(messages);
    await rhack('l'.charCodeAt(0));
    assert.match(await text(messages), /You begin bashing monsters with your bare hands\./);
    await rhack('l'.charCodeAt(0));
    assert.doesNotMatch(await text(messages), /You begin bashing/);
});
void test('an improvised weapon announcement uses its owned name without inventory details', async () => {
    const messages = await combatRoom();
    requirePlayingGame(game);
    const opener = await addInventoryObject(OBJECT_NAMES.indexOf('tin opener'));
    await wield(opener);
    await text(messages);
    await rhack('l'.charCodeAt(0));
    assert.match(await text(messages), /You begin bashing monsters with your tin opener\./);
});
for (const [name, type] of [['bow', BOW], ['unmounted halberd', OBJECT_NAMES.indexOf('halberd')]]) {
    void test(`using a ${name} in melee announces bashing once`, async () => {
        const messages = await combatRoom();
        requirePlayingGame(game);
        const weapon = await addInventoryObject(type);
        await wield(weapon);
        await wield(weapon);
        await text(messages);
        await rhack('l'.charCodeAt(0));
        assert.match(await text(messages), /You begin bashing monsters with/);
        await rhack('l'.charCodeAt(0));
        assert.doesNotMatch(await text(messages), /You begin bashing/);
    });
}
for (const wet of [false, true]) {
    void test(`a ${wet ? 'wet' : 'dry'} towel ${wet ? 'is a melee weapon' : 'announces improvised melee'}`, async () => {
        const messages = await combatRoom();
        requirePlayingGame(game);
        const towel = await addInventoryObject(TOWEL, { spe: wet ? 1 : 0 });
        await wield(towel);
        await text(messages);
        await rhack('l'.charCodeAt(0));
        const output = await text(messages);
        if (wet)
            assert.doesNotMatch(output, /You begin bashing/);
        else
            assert.match(output, /You begin bashing monsters with/);
    });
}
for (const explicitlyWield of [false, true]) {
    void test(`an applied pick-axe ${explicitlyWield ? 'stops warning after explicit wielding' : 'announces its first melee use'}`, async () => {
        const messages = await combatRoom();
        requirePlayingGame(game);
        const pick = await addInventoryObject(PICK_AXE);
        await applyInventoryObject(pick, ' .');
        await rhack(0);
        assert.equal(game.uwep, pick);
        if (explicitlyWield)
            await wield(pick);
        await text(messages);
        await rhack('l'.charCodeAt(0));
        const output = await text(messages);
        if (explicitlyWield)
            assert.doesNotMatch(output, /You begin bashing/);
        else
            assert.match(output, /You begin bashing monsters with/);
    });
}
void test('mounting readies an already wielded polearm for melee', async () => {
    const messages = await combatRoom();
    requirePlayingGame(game);
    game.flags.debug = true;
    const polearm = await addInventoryObject(OBJECT_NAMES.indexOf('halberd'));
    await wield(polearm);
    const pony = await createSaddledSteed('pony', { x: 10, y: 9 });
    await runExtendedCommand('ride', 'ky');
    assert.equal(game.u.usteed, pony);
    await text(messages);
    await rhack('n'.charCodeAt(0));
    assert.doesNotMatch(await text(messages), /You begin bashing/);
});
//# sourceMappingURL=weapon_readiness.test.js.map