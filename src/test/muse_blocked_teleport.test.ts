import assert from 'node:assert/strict';
import test from 'node:test';
import { TELEP_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { monsterKnowsTrap } from '../js/mondata.js';
import { find_offensive, use_defensive } from '../js/muse.js';
import { WAN_TELEPORTATION } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { createMonsterAt } from './support/monsters.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C muse.c:395-396: when tele_restrict() blocks a monster's self-teleport on
// a no-teleport level, mon_learns_traps(mtmp, TELEP_TRAP) records that
// teleportation is useless there.  The wand spent no charge on the blocked
// attempt beyond mzapwand()'s own, and the knowledge is observable through
// mon_knows_traps().
void test('a blocked monster self-teleport teaches the monster the level blocks teleportation', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.level.flags.noteleport = true;
    const wizard = await createMonsterAt('wizard', 10, 10);
    const wand = await knownObject(WAN_TELEPORTATION, { spe: 3 });
    await addObjectToMonsterInventory(wizard, wand);
    assert.equal(monsterKnowsTrap(wizard, { ttyp: TELEP_TRAP }), false);

    await use_defensive(wizard, { kind: 'teleport-self', object: wand },
        { state: game, publish: async () => {}, random: () => 0 });

    assert.equal(monsterKnowsTrap(wizard, { ttyp: TELEP_TRAP }), true);
});

// The knowledge gates selection afterwards: C muse.c find_offensive()'s
// wand branch requires !noteleport_level(mon) || !mon_knows_traps(mon,
// TELEP_TRAP), so a monster that has been blocked once no longer readies
// the teleport wand while the flag stands.
void test('a wizard that knows the no-teleport level no longer readies its teleport wand', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.level.flags.noteleport = true;
    const wizard = await createMonsterAt('wizard', 10, 10);
    const wand = await knownObject(WAN_TELEPORTATION, { spe: 3 });
    await addObjectToMonsterInventory(wizard, wand);

    const choice = find_offensive(wizard, game, { random: () => 0 });

    assert.notEqual(choice?.kind, 'teleport-self');
    assert.notEqual(choice?.kind, 'teleport-ray');
});
