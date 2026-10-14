import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { CANDELABRUM_OF_INVOCATION, POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_PARALYSIS, POT_SLEEPING, TWO_HANDED_SWORD, WAN_MAGIC_MISSILE, WAN_STRIKING } from '../js/object_data.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const offensiveTypes = new Set([POT_ACID, POT_BLINDNESS, POT_CONFUSION,
    POT_PARALYSIS, POT_SLEEPING, WAN_MAGIC_MISSILE, WAN_STRIKING]);
for (const noInventory of [false, true]) {
    void test(`Croesus ${noInventory ? 'receives no sword under NO_MINVENT' : 'always receives a two-handed sword'}`, async () => {
        for (let seed = 1; seed <= 16; seed++) {
            freshObjectRoom({ gameplaySeed: seed });
            const croesus = await createMonsterAt('Croesus', 11, 10, noInventory ? NO_MINVENT : 0);
            assert.equal(croesus.minvent.some(object => object.otyp === TWO_HANDED_SWORD), !noInventory, `Croesus sword admission differs at seed ${seed}`);
        }
    });
}
for (const species of ['kobold leader', 'hobbit', 'guard']) {
    void test(`a ${species} can be born with an offensive magic item alongside its ordinary equipment`, async () => {
        let armed = 0;
        for (let seed = 1; seed <= 64; seed++) {
            freshObjectRoom({ gameplaySeed: seed });
            const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | MM_NOWAIT);
            if (monster.minvent.some(object => offensiveTypes.has(object.otyp)))
                armed++;
        }
        assert.ok(armed > 0, `${species} never received an offensive potion or wand across 64 births`);
    });
}
for (const species of ['kobold leader', 'hobbit', 'guard', 'wood nymph', 'Asmodeus']) {
    void test(`${species} receives no ordinary birth equipment on the Rogue level`, async () => {
        for (let seed = 1; seed <= 64; seed++) {
            freshObjectRoom({ gameplaySeed: seed });
            requirePlayingGame(game);
            game.rogue_level = { ...game.u.uz };
            const monster = await createMonsterAt(species, 11, 10, MM_NOGRP | MM_NOWAIT);
            assert.equal(monster.minvent.length, 0, `${species} received equipment on Rogue, seed ${seed}`);
        }
    });
}
void test('Vlad still carries the Candelabrum on the Rogue level', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    const vlad = await createMonsterAt('Vlad the Impaler', 11, 10, MM_NOGRP | MM_NOWAIT);
    assert.equal(vlad.minvent.length, 1);
    assert.equal(vlad.minvent[0]?.otyp, CANDELABRUM_OF_INVOCATION);
});
//# sourceMappingURL=monster_birth_offense.test.js.map