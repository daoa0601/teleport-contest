import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, VAULT, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pline } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { continueVaultGuardArrival, maintainVaultResidence } from '../js/vault.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';
void test('guard arrival waits for the gold-pile message before its introduction', async () => {
    const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
    requirePlayingGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
    game.u.uinvault = 29;
    await pline('You see here 398 gold pieces.');
    const input = resetInputState();
    assert.equal(maintainVaultResidence(), true);
    const arrived = await answerPrompts(continueVaultGuardArrival(), input, [
        { prompt: /You see here 398 gold pieces\.--More--/, keys: ' ' },
        { prompt: /Suddenly one of the Vault's guards enters!--More--/, keys: ' ' },
        { prompt: /Hello stranger, who are you\?/, keys: 'TestHero\n' },
        { prompt: /I don't know you\.[\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(arrived, true);
    assert.equal(level.monsters.filter(monster => monster.isgd).length, 1);
});
//# sourceMappingURL=vault_arrival_messages.test.js.map