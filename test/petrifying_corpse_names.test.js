import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { loadScoreRecords } from '../js/score_records.js';
import { feelPetrifyingCorpse, selfTouchPetrifyingWeapons, snatchPetrifyingCorpse, touchPetrifyingCorpse, } from '../js/stoning.js';
import { corpseObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const COCKATRICE = MONSTER_NAME.indexOf('cockatrice');
// Runs a fatal contact and returns the paged messages and the score entry.
async function fatalContact(contact, overrides = {}) {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
    requirePlayingGame(game);
    const corpse = await corpseObject(COCKATRICE, overrides);
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    installPagerInput(input, { expected: /stone|fatal mistake|touch|Goodbye|points|You were/i, limit: 10 });
    await contact(corpse);
    assert.ok(game.program_state.gameover, 'bare-handed cockatrice contact must be fatal');
    return { messages, death: loadScoreRecords()[0]?.death };
}
void test('picking up a named cockatrice corpse omits its given name from the warning and death', async () => {
    const { messages, death } = await fatalContact(touchPetrifyingCorpse, { oname: 'Fluffy' });
    assert.ok(messages.join(' ').includes('Touching a cockatrice corpse is a fatal mistake.'), messages.join(' | '));
    assert.equal(death, 'petrified by a cockatrice corpse');
});
void test('picking up from a cockatrice stack warns about one corpse but dies to the whole stack', async () => {
    const { messages, death } = await fatalContact(touchPetrifyingCorpse, { quan: 2 });
    assert.ok(messages.join(' ').includes('Touching a cockatrice corpse is a fatal mistake.'), messages.join(' | '));
    assert.equal(death, 'petrified by cockatrice corpses');
});
void test('snatching a cockatrice stack names the plural stack without an article', async () => {
    const { messages, death } = await fatalContact(corpse => snatchPetrifyingCorpse(corpse), { quan: 2 });
    assert.ok(messages.join(' ').includes('Snatching cockatrice corpses is a fatal mistake.'), messages.join(' | '));
    assert.equal(death, 'petrified by cockatrice corpses');
});
void test('snatching a named cockatrice corpse uses the plain corpse name', async () => {
    const { messages, death } = await fatalContact(corpse => snatchPetrifyingCorpse(corpse), { oname: 'Fluffy' });
    assert.ok(messages.join(' ').includes('Snatching a cockatrice corpse is a fatal mistake.'), messages.join(' | '));
    assert.equal(death, 'petrified by a cockatrice corpse');
});
void test('feeling a named cockatrice corpse uses the definite corpse name', async () => {
    const { messages, death } = await fatalContact(corpse => feelPetrifyingCorpse(corpse, { forceTouch: true }), { oname: 'Fluffy' });
    assert.ok(messages.join(' ').includes('Touching the cockatrice corpse is a fatal mistake...'), messages.join(' | '));
    assert.equal(death, 'petrified by touching a cockatrice corpse bare-handed');
});
void test('touching a wielded named cockatrice corpse names only its species', async () => {
    const { messages, death } = await fatalContact(async (corpse) => {
        corpse.where = 'inventory';
        game.inventory.push(corpse);
        game.uwep = corpse;
        await selfTouchPetrifyingWeapons({ messageStart: 'Falling, you' });
    }, { oname: 'Fluffy' });
    assert.ok(messages.join(' ').includes('Falling, you touch the cockatrice corpse.'), messages.join(' | '));
    assert.equal(death, 'petrified by a cockatrice corpse');
});
//# sourceMappingURL=petrifying_corpse_names.test.js.map