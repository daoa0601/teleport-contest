import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE } from '../js/object_data.js';
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

function theftMessages() {
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /nymph|monkey|Somebody|She|Something|Someone/, limit: 25 });
    return messages;
}

for (const possessions of ['nothing', 'gold', 'blind'] as const) {
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
        if (purse) assert.ok(game.inventory.includes(purse));
    });
}
