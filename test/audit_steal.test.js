import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE, OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function nearbyThief(species = 'water nymph') {
    const thief = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    thief.mux = game.u.ux;
    thief.muy = game.u.uy;
    return thief;
}
void test('a nymph takes a worn adornment ring before ordinary possessions', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('adornment'));
    await wearHeroAccessory(ring, 'uleft');
    const dagger = await addInventoryObject(DAGGER);
    const thief = await nearbyThief();
    theftMessages();
    await performMonsterHeroAttack(thief, game, { random: limit => limit - 1, rollOne: () => 1 });
    assert.ok(thief.minvent.includes(ring), 'Adornment bypasses the ordinary weighted selection');
    assert.ok(game.inventory.includes(dagger));
    assert.equal(game.uleft, null);
});
function theftMessages() {
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /nymph|monkey|Somebody|She|Something|Someone/, limit: 25 });
    return messages;
}
for (const possessions of ['nothing', 'gold', 'blind']) {
    void test(`a nymph announces an unsuccessful robbery with ${possessions} and flees`, async () => {
        freshObjectRoom({ hero: { blindTurns: possessions === 'blind' ? 20 : 0 } });
        requirePlayingGame(game);
        const purse = possessions === 'gold' ? await addInventoryObject(GOLD_PIECE, { quan: 90 }) : null;
        const thief = await nearbyThief();
        const messages = theftMessages();
        await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
        messages.push(game._pending_message);
        await flushPendingTopline();
        assert.match(messages.join('\n'), possessions === 'blind'
            ? /Somebody tries to rob you, but finds nothing to steal\./
            : possessions === 'gold'
                ? /The water nymph tries to rob you, but isn't interested in gold\./
                : /The water nymph tries to rob you, but there is nothing to steal!/);
        assert.ok(thief.mflee, 'An empty-handed thief ends her attack and flees');
        assert.equal(thief.minvent.length, 0);
        if (purse)
            assert.ok(game.inventory.includes(purse));
    });
}
//# sourceMappingURL=audit_steal.test.js.map