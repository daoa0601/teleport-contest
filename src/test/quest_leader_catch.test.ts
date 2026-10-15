import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { ensureQuestStatus, registerQuestLeader } from '../js/quest.js';
import { throwInventoryObject } from './support/commands.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { description, gridBug, diagonal, verb } of [
    { description: 'an orthogonally adjacent leader', gridBug: false, diagonal: false, verb: 'hands' },
    { description: 'a diagonally adjacent leader', gridBug: false, diagonal: true, verb: 'hands' },
    { description: 'an orthogonally adjacent grid bug leader', gridBug: true, diagonal: false, verb: 'hands' },
    { description: 'a diagonally adjacent grid bug leader', gridBug: true, diagonal: true, verb: 'tosses' },
]) {
    void test(`throwing the quest artifact to ${description} completes the quest and ${verb} it back`, async () => {
        freshObjectRoom({ role: 'healer' });
        const leader = await createMonsterAt('Hippocrates', 11, diagonal ? 11 : 10);
        registerQuestLeader(leader);
        if (gridBug)
            await changeMonsterForm(leader, MONSTER_NAME.indexOf('grid bug'));
        leader.msleeping = 0;
        const artifact = await artifactObject('The Staff of Aesculapius', { where: 'inventory', invlet: 'a' });
        game.inventory.push(artifact);
        game.u.uhave = { questart: 1 };
        ensureQuestStatus().touched_artifact = true;
        const health = leader.mhp;
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        input.display = { async readKey() { return 32; } };

        await throwInventoryObject(artifact, diagonal ? 'n' : 'l');

        messages.push(game._pending_message);
        assert.match(messages.join('\n'), new RegExp(`\\b${verb} .+ back to you\\.`));
        assert.equal(game.u.uevent?.qcompleted, 1);
        assert.ok(game.inventory.includes(artifact));
        assert.equal(leader.mhp, health);
        assert.equal(leader.mpeaceful, 1);
    });
}
