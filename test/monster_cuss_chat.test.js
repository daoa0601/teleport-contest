import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a peaceful lawful minion urges the hero to repent', async () => {
    freshObjectRoom();
    const angel = await createMonsterAt('Archon', 11, 10);
    angel.mpeaceful = 1;
    await runExtendedCommand('chat', 'l');
    assert.equal(game._pending_message, '"It\'s not too late."');
    assert.equal(game.context.move, 1);
});
void test('the Wizard can curse through chat and wake nearby sleepers', async () => {
    freshObjectRoom();
    const wizard = await createMonsterAt('Wizard of Yendor', 11, 10);
    wizard.msleeping = 0;
    wizard.mpeaceful = 0;
    const sleeper = await createMonsterAt('goblin', 13, 10);
    sleeper.msleeping = 1;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(167);
    await runExtendedCommand('chat', 'l');
    assert.equal(sleeper.msleeping, 0);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=monster_cuss_chat.test.js.map