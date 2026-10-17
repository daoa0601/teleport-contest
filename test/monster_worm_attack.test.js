import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { assertWormBody } from './support/worms.js';
for (const nearbyTail of [true, false]) {
    void test(`a long worm attacks with its head${nearbyTail ? ' and its adjacent tail' : ' only when its tail is distant'}`, async () => {
        freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
        requirePlayingGame(game);
        const worm = await createMonsterAt('long worm', 11, 10, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
        assertWormBody(worm);
        worm.wormSegments = nearbyTail
            ? [{ x: 11, y: 11 }, { x: 12, y: 12 }]
            : [{ x: 12, y: 11 }, { x: 13, y: 12 }];
        worm.msleeping = 0;
        worm.movement = 12;
        game._moveloopStarted = game._heroTimePending = true;
        game.u.umovement = 12;
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => {
            if (game._pending_message)
                messages.push(game._pending_message);
        };
        installPagerInput(input, { expected: /long worm/, limit: 5 });
        initRng(1n);
        enableRngLog();
        await finishAtCommandInput(input, moveloop_core, /long worm/);
        await flushPendingTopline();
        const attacks = nearbyTail ? 2 : 1;
        assert.equal(getRngLog().filter(entry => entry.startsWith('rnd(20)=')).length, attacks, 'each nearby body part gets a fresh bite to-hit roll');
        assert.equal(messages.join('\n').match(/The long worm bites!/g)?.length, attacks, 'the head and each adjacent tail segment present their own attack');
        assert.ok(game.u.uhp < 200, 'the bites must deal damage through normal combat');
    });
}
void test('a tail bite that petrifies the worm stops the remaining tail attacks', async () => {
    freshObjectRoom({ hero: { uhp: 200, uhpmax: 200, uac: 0 } });
    requirePlayingGame(game);
    installPolymorphedHero('cockatrice');
    const worm = await createMonsterAt('long worm', 11, 10, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    assertWormBody(worm);
    worm.wormSegments = [{ x: 11, y: 11 }, { x: 10, y: 11 }, { x: 9, y: 11 }];
    worm.msleeping = 0;
    worm.movement = 12;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /worm|stone/, limit: 5 });
    initRng(4n);
    enableRngLog();
    await finishAtCommandInput(input, moveloop_core, /worm|stone/);
    assert.equal(game.level.monsters.includes(worm), false, 'the passive petrifies the attacker');
    assert.ok(game.u.mh < 40, 'a tail bite lands after the head misses');
    assert.equal(getRngLog().filter(entry => entry.startsWith('rnd(20)=')).length, 2, 'the dead worm cannot attack with its two remaining nearby segments');
});
void test('a fatal tail bite ends the turn before the remaining tail attacks', async () => {
    freshObjectRoom({ hero: { uhp: 6, uhpmax: 200 } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 11, 10, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    assertWormBody(worm);
    worm.wormSegments = [{ x: 11, y: 11 }, { x: 10, y: 11 }, { x: 9, y: 11 }];
    worm.msleeping = 0;
    worm.movement = 12;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /worm|die|points|Goodbye|REST|PEACE/, limit: 10 });
    initRng(1n);
    enableRngLog();
    await moveloop_core();
    assert.equal(game.program_state.gameover, true, 'the second bite kills the hero');
    assert.equal(getRngLog().filter(entry => entry.startsWith('rnd(20)=')).length, 2, 'the worm stops attacking as soon as the hero dies');
});
//# sourceMappingURL=monster_worm_attack.test.js.map