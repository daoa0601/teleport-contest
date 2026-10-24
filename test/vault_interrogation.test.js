import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { CORR, DOOR, ROOMOFFSET, SHARED, VAULT, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { continueVaultGuardArrival, maintainVaultResidence } from '../js/vault.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';
function arrivingGuard() {
    const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
    requirePlayingGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
    game.u.uinvault = 29;
    assert.equal(maintainVaultResidence(), true);
    return level;
}
void test('a guard calls a hiding mimic a whatcha-may-callit and leaves the vault closed', async () => {
    const level = arrivingGuard();
    installPolymorphedHero('small mimic');
    await runMonsterAbilityCommand();
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        const message = game.nhDisplay?.grid.slice(0, 3)
            .map(row => row.map(cell => cell.ch).join('')).join('') ?? '';
        messages.push(message);
        input.feed(message.includes('--More--') ? ' ' : '.');
    };
    await moveloop_core();
    messages.push(game._pending_message);
    assert.match(messages.join('\n'), /"Hey!  Who left that whatcha-may-callit in here\?"/);
    assert.equal(level.monsters.some(monster => monster.isgd), false);
    assert.equal(level.requireAt(11, 10).typ, VWALL);
});
for (const name of ['Croesus', 'Kroisos', 'Creosote']) {
    void test(`a vault guard leaves an unopened wall when the hero claims to be ${name}`, async () => {
        const level = arrivingGuard();
        const input = resetInputState();
        await answerPrompts(continueVaultGuardArrival(), input, [
            { prompt: /Suddenly one of the Vault's guards enters!--More--/, keys: ' ' },
            { prompt: /Hello stranger, who are you\?/, keys: `${name}\n` },
        ]);
        assert.equal(level.monsters.some(monster => monster.isgd), false);
        assert.equal(level.requireAt(11, 10).typ, VWALL);
        assert.match(game._lastPlineMessage, /Sorry to have disturbed you/);
    });
}
void test('a lawful hero loses alignment for lying to a vault guard', async () => {
    arrivingGuard();
    requirePlayingGame(game);
    game.u.ualign = { type: 1, record: 5 };
    game.plname = 'TestHero';
    const input = resetInputState();
    await answerPrompts(continueVaultGuardArrival(), input, [
        { prompt: /Suddenly one of the Vault's guards enters!--More--/, keys: ' ' },
        { prompt: /Hello stranger, who are you\?/, keys: 'Somebody Else\n' },
    ]);
    assert.equal(game.u.ualign.record, 4);
});
void test('a guard reports interrupted work before asking the hero name', async () => {
    arrivingGuard();
    game._occupation = { key: 'wipe-face', text: 'wiping your face', remaining: 8 };
    const messages = [];
    const input = resetInputState();
    let answered = false;
    input.beforeRead = () => {
        const text = game.nhDisplay?.grid.slice(0, 3)
            .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('') ?? '';
        messages.push(text);
        if (text.includes('Hello stranger, who are you?')) {
            if (!answered)
                input.feed('TestHero\n');
            answered = true;
        }
        else
            input.feed(' ');
    };
    await continueVaultGuardArrival();
    assert.match(messages.join('\n'), /You stop wiping your face\..*\n.*Hello stranger, who are you\?/);
    assert.equal(game._occupation, null);
});
void test('a hero in the vault doorway is questioned from a neighboring wall', async () => {
    const level = arrivingGuard();
    game._vaultGuardArrivalPending = null;
    game.u.uinvault = 29;
    game.u.ux = 11;
    level.requireAt(11, 10).typ = DOOR;
    level.requireAt(11, 10).roomno = SHARED;
    level.requireAt(11, 11).typ = VWALL;
    const input = resetInputState();
    assert.equal(maintainVaultResidence(), true);
    await answerPrompts(continueVaultGuardArrival(), input, [
        { prompt: /Suddenly one of the Vault's guards enters!--More--/, keys: ' ' },
        { prompt: /Hello stranger, who are you\?/, keys: 'TestHero\n' },
    ]);
    const guard = level.monsters.find(monster => monster.isgd);
    assert.ok(guard);
    assert.equal(guard.mx, 11);
    assert.equal(guard.my, 11);
});
//# sourceMappingURL=vault_interrogation.test.js.map