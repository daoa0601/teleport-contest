import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ensureQuestStatus, registerQuestLeader } from '../js/quest.js';
import { throwInventoryObject } from './support/commands.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('throwing the quest artifact to its peaceful leader completes the quest and returns the artifact', async () => {
    freshObjectRoom({ role: 'healer' });
    const leader = await createMonsterAt('Hippocrates', 11, 10);
    registerQuestLeader(leader);
    leader.msleeping = 0;
    const artifact = await artifactObject('The Staff of Aesculapius', { where: 'inventory', invlet: 'a' });
    game.inventory.push(artifact);
    game.u.uhave = { questart: 1 };
    ensureQuestStatus().touched_artifact = true;
    const health = leader.mhp;
    const input = resetInputState();
    input.display = { async readKey() { return 32; } };
    await throwInventoryObject(artifact);
    assert.equal(game.u.uevent?.qcompleted, 1);
    assert.ok(game.inventory.includes(artifact));
    assert.equal(leader.mhp, health);
    assert.equal(leader.mpeaceful, 1);
});
//# sourceMappingURL=quest_leader_catch.test.js.map