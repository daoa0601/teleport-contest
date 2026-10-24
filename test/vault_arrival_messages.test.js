import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, NO_MINVENT, ROOMOFFSET, VAULT, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { glyphAt, pline } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { GOLD_PIECE, SACK } from '../js/object_data.js';
import { continueVaultGuardArrival, maintainVaultResidence } from '../js/vault.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { createRoom } from './support/topology.js';
import { initRng } from '../js/rng.js';
void test('the guard accepts and echoes names longer than thirty-one characters', async () => {
    const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
    requirePlayingGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    game.u.uinvault = 29;
    assert.equal(maintainVaultResidence(), true);
    const name = 'Alexandria '.repeat(4).trim();
    const input = resetInputState();
    const arrival = continueVaultGuardArrival();
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    input.feed(name);
    await input.waitUntilBlocked();
    const echo = game.nhDisplay?.grid.slice(0, 2)
        .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('') ?? '';
    input.feed('\n');
    await arrival;
    assert.ok(echo.includes(name), `The guard name echo was truncated: ${echo}`);
});
for (const goldLocation of ['none', 'purse', 'sack', 'both']) {
    void test(`guard arrival pages unread prose and requests gold kept in ${goldLocation}`, async () => {
        const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
        requirePlayingGame(game);
        level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
        level.requireAt(16, 10).typ = CORR;
        level.requireAt(11, 10).typ = VWALL;
        setHeroGoldAmount(game, goldLocation === 'purse' || goldLocation === 'both' ? 37 : 0);
        if (goldLocation === 'sack' || goldLocation === 'both') {
            const sack = await addInventoryObject(SACK);
            await addCreatedObjectToContainer(sack, await knownObject(GOLD_PIECE, { quan: 37 }));
        }
        for (let x = 9; x <= 10; x++)
            for (let y = 9; y <= 10; y++)
                level.requireAt(x, y).roomno = ROOMOFFSET;
        game.u.uinvault = 29;
        await pline('You see here 398 gold pieces.');
        const input = resetInputState();
        assert.equal(maintainVaultResidence(), true);
        const answers = [
            { prompt: /You see here 398 gold pieces\.--More--/, keys: ' ' },
            { prompt: /Suddenly one of the Vault's guards enters!--More--/, keys: ' ' },
            { prompt: /Hello stranger, who are you\?/, keys: 'TestHero\n' },
        ];
        if (goldLocation !== 'none') {
            answers.push({ prompt: goldLocation === 'sack'
                    ? /"I don't know you\."  "You have hidden gold\."--More--/
                    : /"I don't know you\."--More--/, keys: ' ' }, { prompt: /"Most likely all your gold was stolen from this vault\."--More--/, keys: ' ' });
        }
        const arrived = await answerPrompts(continueVaultGuardArrival(), input, answers);
        assert.equal(arrived, true);
        assert.match(game._pending_message, goldLocation === 'none'
            ? /"I don't know you\."  "Please follow me\."/
            : /"Please drop that gold and follow me\."/);
        assert.equal(level.monsters.filter(monster => monster.isgd).length, 1);
        const guard = level.monsters.find(monster => monster.isgd);
        assert.equal(guard?._egd?.dropgoldcnt, goldLocation === 'none' ? 0 : 1);
    });
}
void test('guard arrival does not redraw warnings before announcing the guard', async () => {
    const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
    requirePlayingGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const troll = await createMonsterAt('troll', 14, 12, NO_MINVENT);
    troll.mpeaceful = false;
    // Warning starts now; only see_monsters() or a newsym() would show it.
    grantIntrinsicProperty('warning', 'outside');
    const before = glyphAt(14, 12)?.kind;
    game.u.uinvault = 29;
    assert.equal(maintainVaultResidence(), true);
    const input = resetInputState();
    const arrival = continueVaultGuardArrival();
    await input.waitUntilBlocked();
    const atAnnouncement = glyphAt(14, 12)?.kind;
    input.feed(' \x1b\n' + ' '.repeat(8));
    await arrival;
    assert.notEqual(before, 'warning');
    assert.equal(atAnnouncement, before);
});
void test('answering a guard does not change its hallucinated appearance before the next turn', async () => {
    const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
    requirePlayingGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
    game.u.uinvault = 29;
    game.u.hallucinationTurns = 20;
    initRng(123n);
    assert.equal(maintainVaultResidence(), true);
    const input = resetInputState();
    const arrival = continueVaultGuardArrival();
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    const beforeAnswer = glyphAt(11, 10);
    input.feed('TestHero\n');
    await arrival;
    const afterAnswer = glyphAt(11, 10);
    assert.ok(beforeAnswer?.kind === 'monster' && afterAnswer?.kind === 'monster');
    assert.equal(afterAnswer.mnum, beforeAnswer.mnum);
});
//# sourceMappingURL=vault_arrival_messages.test.js.map