import assert from 'node:assert/strict';
import test from 'node:test';
import { PANICLOG } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { teleportHeroToRandomPet } from '../js/teleport.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
// C teleport.c:tele_to_rnd_pet() (819-823): the whistle caller screens the
// level, so reaching the routine on a no-teleport level is an impossible
// call, not a silent no-op.
void test('teleporting to a random pet on a no-teleport level reports an impossible call', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.level.flags.noteleport = true;
    const pet = await createMonsterAt('kitten', 15, 10);
    pet.mtame = 1;
    pushKeys(' '.repeat(200));
    const moved = await teleportHeroToRandomPet(game);
    assert.equal(moved, false, 'the diagnostic path never moves the hero');
    assert.notEqual(pet.mx, game.u.ux, 'the pet stays put');
    const reasons = [];
    for (const line of (game.storage.getItem(PANICLOG) || '')
        .split('\n').filter(Boolean)) {
        const record = JSON.parse(line);
        assert.ok(record && typeof record === 'object' && 'reason' in record
            && typeof record.reason === 'string');
        reasons.push(record.reason);
    }
    assert.ok(reasons.includes('attempt to teleport hero to be near a pet'
        + ' on no-teleport level'), 'the no-teleport violation reaches the paniclog');
});
//# sourceMappingURL=pet_teleport_noteleport.test.js.map