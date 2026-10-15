import assert from 'node:assert/strict';
import test from 'node:test';
import { DIED, STONING } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishMonsterAttackDeath } from '../js/monster_attack_death.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function deathRoom() {
    freshObjectRoom({ flags: { bones: false, disclose: 'none', tombstone: false } });
    game.iflags.toptenwin = false;
    const input = resetInputState();
    installPagerInput(input, { expected: /die|stone|body rises|Goodbye|You were|points/i, limit: 8 });
}
void test('ordinary death preserves the undead transformation chosen by the killer', async () => {
    deathRoom();
    const wraith = await createMonsterAt('wraith', 11, 10);
    await finishMonsterAttackDeath(wraith, { deathType: DIED });
    assert.equal(game.u.ugrave_arise, MONSTER_NAME.indexOf('wraith'));
});
void test('petrification clears the helplessness that only prevented last-second recovery', async () => {
    deathRoom();
    const cockatrice = await createMonsterAt('cockatrice', 11, 10);
    game.multi = -3;
    game._helplessTurns = 3;
    game._helplessReason = 'getting stoned';
    await finishMonsterAttackDeath(cockatrice, { deathType: STONING });
    assert.equal(game.multi, 0);
    assert.equal(game._helplessTurns, 0);
    assert.equal(game._helplessReason, null);
});
//# sourceMappingURL=end_remains.test.js.map