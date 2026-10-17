import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { heroIsBlind } from '../js/senses.js';
import { invokeArtifactPower } from '../js/artifact_invoke.js';
import { artifactByName } from '../js/artifacts.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { requireScreenRow } from './support/screen.js';

void test('the Staff reports slight relief when it cures a timeout but permanent blindness remains', async () => {
    freshObjectRoom({ role: 'healer', hero: { permaBlind: true, blindTurns: 7 } });
    requirePlayingGame(game);
    const staff = await artifactObject('The Staff of Aesculapius', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [staff];

    await invokeInventoryObject(staff, ' '.repeat(20));

    assert.equal(game.u.blindTurns, 0);
    assert.equal(heroIsBlind(game), true);
    assert.equal(game._pending_message, 'You feel better.  You feel slightly better.');
    assert.equal(game.context.move, 1);
});

for (const cream of [0, 2]) {
    void test(`Staff healing reports relief ${cream ? 'once with cream remaining' : 'twice without cream'}`, async () => {
        freshObjectRoom({ role: 'healer', hero: { blindTurns: 7, ucreamed: cream } });
        requirePlayingGame(game);
        const staff = await artifactObject('The Staff of Aesculapius', {
            invlet: 'a', where: 'inventory', age: 0,
        });
        game.inventory = [staff];

        await invokeArtifactPower(staff, artifactByName('The Staff of Aesculapius'), {
            publish: plineWithContinuation,
        });
        await flush_screen(1);

        const feedback = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
        assert.equal(feedback, cream ? 'You feel better.' : 'You feel better.  You feel better.');
        assert.equal(game.u.uhp, game.u.uhpmax);
        assert.equal(game.u.blindTurns, cream);
        assert.equal(game.u.ucreamed, cream);
    });
}

void test('invoking the Staff at full health cures temporary blindness while leaving cream', async () => {
    freshObjectRoom({ role: 'healer', hero: { blindTurns: 7, ucreamed: 2 } });
    requirePlayingGame(game);
    const staff = await artifactObject('The Staff of Aesculapius', {
        invlet: 'a', where: 'inventory', age: 0,
    });
    game.inventory = [staff];

    await invokeInventoryObject(staff);

    assert.equal(game.u.uhp, game.u.uhpmax);
    assert.equal(game.u.blindTurns, 2);
    assert.equal(game.u.ucreamed, 2);
    assert.equal(heroIsBlind(game), true);
    assert.equal(game.context.move, 1);
});
