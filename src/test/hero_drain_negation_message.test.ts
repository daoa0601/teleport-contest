import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_PROTECTION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('magic cancellation reports avoided life drain before a barrow wight curses', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const cloak = await addInventoryObject(CLOAK_OF_PROTECTION);
    wearHeroArmor(cloak);
    const wight = await createMonsterAt('barrow wight', 11, 10, NO_MINVENT);
    wight.mpeaceful = 0;
    wight.mspec_used = 2;
    wight.mux = 10;
    wight.muy = 10;
    const level = game.u.ulevel;
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); input.feed(' '); };

    await performMonsterHeroAttack(wight, game, {
        random: limit => limit === 3 || limit === 10 ? 0 : limit - 1,
        rollOne: () => 1, rollDice: () => 2,
    });
    messages.push(game._pending_message);

    assert.equal(game.u.ulevel, level);
    const displayed = messages.join('\n');
    const avoided = displayed.indexOf('You avoid harm.');
    const cursed = displayed.indexOf('The barrow wight points at you, then curses.');
    assert.ok(avoided >= 0 && cursed > avoided, displayed);
});
