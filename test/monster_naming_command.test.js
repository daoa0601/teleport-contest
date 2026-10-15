import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
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
//# sourceMappingURL=monster_naming_command.test.js.map