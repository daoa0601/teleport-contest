import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_OBJECT, STRAT_WAITFORU } from '../js/const.js';
import { game } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a deaf hero gets the hearing refusal from an awake animal', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10);
    dog.msleeping = 0;
    dog.mstrategy = STRAT_WAITFORU;
    game.u.deafTurns = 20;
    await runExtendedCommand('chat', 'l');
    assert.equal(game._pending_message, 'Any response from the little dog falls on deaf ears.');
    assert.equal(game.context.move, 0);
    assert.equal(dog.mstrategy, 0);
});
for (const disguise of ['hidden', 'object']) {
    void test(`chat does not rouse a ${disguise} monster`, async () => {
        freshObjectRoom();
        const mimic = await createMonsterAt('small mimic', 11, 10);
        mimic.msleeping = 0;
        mimic.mstrategy = STRAT_WAITFORU;
        if (disguise === 'hidden')
            mimic.mundetected = 1;
        else
            mimic.m_ap_type = M_AP_OBJECT;
        await runExtendedCommand('chat', 'l');
        assert.equal(mimic.mstrategy, STRAT_WAITFORU);
        assert.equal(game.context.move, 0);
    });
}
void test('chatting down to an awake mounted horse gets its answer and spends a turn', async () => {
    freshObjectRoom();
    const horse = await createSaddledSteed('horse', { x: 10, y: 10 });
    game.u.usteed = horse;
    horse.msleeping = 0;
    await runExtendedCommand('chat', '>');
    assert.equal(game._pending_message, 'The saddled horse whickers.');
    assert.equal(game.context.move, 1);
});
void test('chatting upward gives the native refusal without spending a turn', async () => {
    freshObjectRoom();
    await runExtendedCommand('chat', '<');
    assert.equal(game._pending_message, "They won't hear you up there.");
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=chat_targets.test.js.map