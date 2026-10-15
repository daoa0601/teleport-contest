import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('chatting with a peaceful demon offers a bribe even if it last saw the hero elsewhere', async () => {
    freshObjectRoom();
    const demon = await createMonsterAt('Baalzebub', 11, 10);
    demon.mux = 8;
    demon.muy = 8;
    demon.minvis = demon.perminvis = false;
    setHeroGoldAmount(game, 1000);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await runExtendedCommand('chat', 'l 1000\n');
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(demon.dead, true);
    assert.equal(game.context.move, 1);
});
void test('a tame bribe-speaking demon gives the peaceful doom response', async () => {
    freshObjectRoom();
    const demon = await createMonsterAt('Baalzebub', 11, 10);
    demon.minvis = demon.perminvis = false;
    demon.mtame = 10;
    await runExtendedCommand('chat', 'l');
    assert.equal(game._pending_message, '"We\'re all doomed."');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=demon_chat.test.js.map