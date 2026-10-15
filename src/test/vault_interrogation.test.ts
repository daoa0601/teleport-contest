import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR, VAULT, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { continueVaultGuardArrival, maintainVaultResidence } from '../js/vault.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';

function arrivingGuard() {
    const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
    requirePlayingGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
    game.u.uinvault = 29;
    assert.equal(maintainVaultResidence(), true);
    return level;
}

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
