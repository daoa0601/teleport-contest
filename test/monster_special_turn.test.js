import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_AMUL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, RIN_CONFLICT } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function conflictRoom(attackerSpecies, defenderSpecies = 'orc') {
    freshObjectRoom({ flags: { verbose: true }, hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const flags = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
    const attacker = await createMonsterAt(attackerSpecies, 11, 10, flags);
    const defender = await createMonsterAt(defenderSpecies, 12, 10, flags);
    attacker.m_lev = 20;
    attacker.mhp = attacker.mhpmax = 300;
    defender.mhp = defender.mhpmax = 300;
    defender.movement = 0;
    vision_recalc(0);
    installPagerInput(resetInputState(), {
        expected: /umber hulk|orc|Archon|worm|vortex|hell hound|Burrrrp|medallion/, limit: 20,
    });
    initRng(1n);
    return { attacker, defender, state: game };
}
void test('an umber hulk uses its confusing gaze after its contact attacks in a live turn', async () => {
    const { attacker, defender, state } = await conflictRoom('umber hulk');
    const action = await runMonsterAction(attacker, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    assert.equal(defender.mconf, 1);
    assert.ok(defender.mhp < 300, 'the preceding contact attacks still damage the target');
    assert.ok(action.conflictFight.attack.results.some(hit => hit.type === 'gaze'));
});
void test('a blinded Archon still blinds an adjacent monster during its actual attack sequence', async () => {
    const { attacker, defender, state } = await conflictRoom('Archon');
    attacker.mcansee = 0;
    attacker.mblinded = 20;
    const action = await runMonsterAction(attacker, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    assert.equal(defender.mcansee, 0);
    assert.ok((defender.mblinded ?? 0) >= 2);
    assert.ok(action.conflictFight.attack.results.some(hit => hit.type === 'gaze'));
});
void test('a purple worm digests a monster and its life-saving amulet during a live turn', async () => {
    const { attacker, defender, state } = await conflictRoom('purple worm');
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    initRng(1n);
    const action = await runMonsterAction(attacker, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    assert.ok(action.conflictFight.attack.results.some(hit => hit.type === 'engulf'));
    assert.equal(state.level.monsters.includes(defender), false);
    assert.equal(amulet.where, 'gone');
    assert.equal(monsterAtPosition(state.level, 12, 10), attacker);
    assert.equal(monsterAtPosition(state.level, 11, 10), null);
    assert.equal(state._monsterEngulf, null);
    assert.equal(state._monsterSwallower, null);
});
void test('resisted steam engulfing restores both surviving monsters to their own squares', async () => {
    const { attacker, defender, state } = await conflictRoom('steam vortex', 'hell hound');
    const action = await runMonsterAction(attacker, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    assert.ok(action.conflictFight.attack.results.some(hit => hit.type === 'engulf' && hit.hit));
    assert.equal(defender.mhp, 300);
    assert.equal(monsterAtPosition(state.level, 11, 10), attacker);
    assert.equal(monsterAtPosition(state.level, 12, 10), defender);
    assert.equal(state._monsterEngulf, null);
    assert.equal(state._monsterSwallower, null);
});
//# sourceMappingURL=monster_special_turn.test.js.map