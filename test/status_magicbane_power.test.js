import assert from 'node:assert/strict';
import test from 'node:test';
import { applyArtifactHitToMonster } from '../js/artifact_hit.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { bot, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('Magicbane displays increased power with its absorption message', async () => {
    freshObjectRoom({ hero: { uen: 5, uenmax: 30, uenpeak: 30 } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('gnomish wizard', 12, 10, MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT);
    const blade = await artifactObject('Magicbane', { spe: 0 });
    await bot();
    pushKeys(' '.repeat(10));
    let absorptionPower = '';
    await applyArtifactHitToMonster(blade, monster, 4, {
        state: game,
        dieRoll: 1,
        random: range => range - 1,
        rollOne: sides => sides,
        async publish(message, options) {
            await plineWithContinuation(message, options);
            if (message === 'You absorb magical energy!')
                absorptionPower = requireScreenRow(23).map(cell => cell.ch).join('');
        },
    });
    assert.equal(monster.mcan, 1);
    assert.equal(game.u.uen, 6);
    assert.equal(game.u.uenmax, 31);
    assert.equal(game.u.uenpeak, 31);
    assert.match(absorptionPower, /Pw:6\(31\)/);
});
//# sourceMappingURL=status_magicbane_power.test.js.map