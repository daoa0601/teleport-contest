import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('the monster naming command assigns a normalized name without taking a turn', async (t) => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('m');
    planInput(input, t, [
        { prompt: /instructions/, keys: 'l' },
        { prompt: /soldier/, keys: '.' },
        { prompt: /What do you want to call the soldier\?/, keys: '  Watcher   One  \r' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(soldier.mgivenname, 'Watcher One');
    assert.equal(game.context.move, 0);
});
void test('hallucination prevents monster naming before cursor selection', async (t) => {
    freshObjectRoom({ flags: { tips: false }, hero: { hallucinationTurns: 20 } });
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('m');
    planInput(input, t, []);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, 'You would never recognize it anyway.');
});
void test('monster naming keeps printable high bytes and limits the normalized name', async (t) => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('m');
    planInput(input, t, [
        { prompt: /instructions/, keys: 'l.' },
        { prompt: /What do you want to call the soldier\?/, keys: `  \u00a0Café   ${'r'.repeat(68)}\r` },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(soldier.mgivenname, `\u00a0Café ${'r'.repeat(56)}`);
    assert.equal(game.context.move, 0);
});
void test('unique monsters reject a different name', async (t) => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const medusa = await createMonsterAt('Medusa', 11, 10, NO_MINVENT);
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('m');
    planInput(input, t, [
        { prompt: /instructions/, keys: 'l.' },
        { prompt: /What do you want to call Medusa\?/, keys: 'Watcher\r' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(medusa.mgivenname, undefined);
    assert.equal(game._pending_message, "Medusa doesn't like being called names!");
});
for (const { lit, sensed } of [
    { lit: false, sensed: false }, { lit: true, sensed: false }, { lit: false, sensed: true },
]) {
    void test(`monster naming through a ${lit ? 'lit' : 'dark'} worm tail ${sensed ? 'with' : 'without'} detection`, async (t) => {
        const level = freshObjectRoom({
            flags: { tips: false, verbose: true }, hero: { detectMonsters: sensed },
        });
        const worm = await createMonsterAt('long worm', 11, 10, NO_MINVENT | MM_NOTAIL);
        initializeMonsterWormBody(worm, { segmentCount: 0 });
        worm.wormSegments = [{ x: 12, y: 10 }, { x: 13, y: 10 }];
        level.requireAt(13, 10).lit = lit;
        vision_recalc(0);
        assert.ok(cansee(worm.mx, worm.my), 'The head remains visible');
        assert.equal(!!cansee(13, 10), lit, 'Only the selected tail square changes lighting');
        const input = resetInputState();
        input.feed('name\r');
        queueCommandKeys('m');
        planInput(input, t, [
            { prompt: /instructions/, keys: 'lll.' },
            ...(lit || sensed ? [{ prompt: /What do you want to call the long worm\?/, keys: 'Coil\r' }] : []),
        ]);
        await rhack('#'.charCodeAt(0));
        assert.equal(worm.mgivenname, lit || sensed ? 'Coil' : undefined);
        if (!lit && !sensed)
            assert.equal(game._pending_message, 'I see no monster there.');
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=monster_naming_command.test.js.map