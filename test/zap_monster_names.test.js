import assert from 'node:assert/strict';
import test from 'node:test';
import { MFAST } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { WAN_SPEED_MONSTER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('zapping speed at a named monster identifies the target in its feedback', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const jackal = await createMonsterAt('jackal', 11, 10);
    setMonsterGivenName(jackal, 'Fido');
    jackal.mpeaceful = 1;
    const wand = await addInventoryObject(WAN_SPEED_MONSTER, { spe: 2 });
    pushKeys(`${wand.invlet}l`);
    await rhack('z'.charCodeAt(0));
    assert.equal(jackal.mspeed, MFAST);
    assert.equal(jackal.mpeaceful, 1);
    assert.equal(game._pending_message, 'Fido is suddenly moving faster.');
    assert.equal(wand.spe, 1);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=zap_monster_names.test.js.map