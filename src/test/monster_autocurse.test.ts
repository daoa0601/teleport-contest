import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { checkMonsterGearNextTurn, reassessMonsterArmor } from '../js/monworn.js';
import { DUNCE_CAP } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('a seen monster putting on a dunce cap names the cap as it curses itself', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 12, 10, NO_MINVENT);
    soldier.mpeaceful = 1;
    const cap = await addObjectToMonsterInventory(soldier,
        await knownObject(DUNCE_CAP, { typeKnown: false }));
    assert.ok(cap);
    checkMonsterGearNextTurn(soldier);
    const messages: string[] = [];

    await reassessMonsterArmor(soldier, game, { publish: message => { messages.push(message); } });

    assert.equal(cap.cursed, true);
    assert.equal(messages.at(-1), "The soldier's conical hat glows black for a moment.");
});
