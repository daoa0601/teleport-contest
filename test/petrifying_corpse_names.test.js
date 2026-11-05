import { feelPetrifyingCorpse } from '../js/invent.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { BULLWHIP } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/topten.js';
import { touchPetrifyingCorpse } from '../js/pickup.js';
import { useWhip } from '../js/apply.js';
import { addInventoryObject, corpseObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { W_WEP } from '../js/const.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { selfTouchPetrifyingWeapons } from '../js/trap.js';
const COCKATRICE = MONSTER_NAME.indexOf('cockatrice');
// Runs a fatal contact and returns the paged messages and the score entry.
async function fatalContact(contact, overrides = {}) {
    await freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false } });
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
// C apply.c:3187-3231: use_whip()'s snatch case pulls the disarmed weapon
// straight into the pack; snatched bare-handed, a cockatrice corpse is
// fatal, and its cxname() is both the warning and the death reason.
async function snatchPetrifyingCorpseThroughWhip(overrides) {
    for (let seed = 1n; seed <= 200n; seed++) {
        await freshObjectRoom({
            role: 'archeologist',
            hero: {
                acurr: { a: [10, 10, 10, 18, 10, 10] },
                urexp: 100,
            },
            flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
        });
        requirePlayingGame(game);
        game.storage = memoryStorage();
        game.iflags.toptenwin = false;
        const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
        game.uwep = game.u.uwep = whip;
        const corpse = await corpseObject(COCKATRICE, overrides);
        const bugbear = await createMonsterAt('bugbear', 11, 10);
        await equipMonsterObject(bugbear, corpse, W_WEP);
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => {
            if (game._pending_message)
                messages.push(game._pending_message);
        };
        installPagerInput(input, {
            expected: /bullwhip|snatch|stone|fatal mistake|Goodbye|points|You were/i,
            limit: 12,
        });
        initRng(seed);
        pushKeys('l' + ' '.repeat(12));
        await useWhip(whip);
        const text = [...messages, game._pending_message].join('\n');
        if (/You snatch/u.test(text)) {
            assert.ok(game.program_state.gameover, 'a bare-handed cockatrice snatch must be fatal');
            return { messages: text.split('\n'), death: loadScoreRecords()[0]?.death };
        }
    }
    throw new Error('No seed reached the bullwhip snatch.');
}
void test('snatching a cockatrice stack names the plural stack without an article', async () => {
    const { messages, death } = await snatchPetrifyingCorpseThroughWhip({ quan: 2 });
    assert.ok(messages.join(' ').includes('Snatching cockatrice corpses is a fatal mistake.'), messages.join(' | '));
    assert.equal(death, 'petrified by cockatrice corpses');
});
void test('snatching a named cockatrice corpse uses the plain corpse name', async () => {
    const { messages, death } = await snatchPetrifyingCorpseThroughWhip({ oname: 'Fluffy' });
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