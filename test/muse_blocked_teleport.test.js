import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, NO_MINVENT, TELEP_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { monsterKnowsTrap } from '../js/mondata.js';
import { find_defensive, use_defensive } from '../js/muse.js';
import { WAN_TELEPORTATION } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { createMonsterAt } from './support/monsters.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// C muse.c:m_tele(): a blocked teleport teaches the monster about the level.
void test('a blocked monster self-teleport teaches the monster the level blocks teleportation', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.level.flags.noteleport = true;
    const wizard = await createMonsterAt('wizard', 10, 10, MM_ANGRY | NO_MINVENT);
    const wand = await knownObject(WAN_TELEPORTATION, { spe: 3 });
    await addObjectToMonsterInventory(wizard, wand);
    assert.equal(monsterKnowsTrap(wizard, { ttyp: TELEP_TRAP }), false);
    await use_defensive(wizard, { kind: 'teleport-self', object: wand }, { state: game, publish: async () => { }, random: () => 0 });
    assert.equal(monsterKnowsTrap(wizard, { ttyp: TELEP_TRAP }), true);
});
// C muse.c:find_defensive(): known no-teleport levels rule out teleport wands.
void test('a wizard that knows the no-teleport level no longer readies its teleport wand', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.level.flags.noteleport = true;
    const wizard = await createMonsterAt('wizard', 10, 10, MM_ANGRY | NO_MINVENT);
    wizard.mhpmax = 40;
    wizard.mhp = 5;
    wizard.mux = game.u.ux;
    wizard.muy = game.u.uy;
    const wand = await knownObject(WAN_TELEPORTATION, { spe: 3 });
    await addObjectToMonsterInventory(wizard, wand);
    assert.equal(monsterKnowsTrap(wizard, { ttyp: TELEP_TRAP }), false);
    const before = find_defensive(wizard, game, { random: () => 0 });
    assert.ok(before?.kind === 'teleport-self', `the injured wizard should try its teleport wand (got ${before?.kind})`);
    assert.equal(before.object, wand);
    await use_defensive(wizard, before, { state: game, publish: async () => { }, random: () => 0 });
    assert.equal(wand.spe, 2, 'the blocked attempt should leave the wand usable');
    assert.equal(find_defensive(wizard, game, { random: () => 0 }), null, 'the wizard should stop trying the blocked teleport wand');
});
//# sourceMappingURL=muse_blocked_teleport.test.js.map