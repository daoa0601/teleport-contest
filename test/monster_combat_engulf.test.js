import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, D_CLOSED, IRONBARS, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, MM_NOGRP, MM_NOWAIT, NO_MINVENT, PIT, POOL, STONE, W_AMUL, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { AT_ENGL } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { resolveMonsterCombatEngulf } from '../js/monster_combat_engulf.js';
import { MONSTER_ATTACKS, MONSTER_NAME, requireMonsterData } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { setMonsterSpecies } from '../js/monster_species.js';
import { AMULET_OF_LIFE_SAVING, OIL_LAMP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
async function engulfRoom(attackerSpecies = 'fog cloud', defenderSpecies = 'orc') {
    const level = freshObjectRoom({ gameplaySeed: 97n, context: { mon_moving: true },
        hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const attacker = await createMonsterAt(attackerSpecies, 11, 10, BIRTH_FLAGS);
    const defender = await createMonsterAt(defenderSpecies, 12, 10, BIRTH_FLAGS);
    attacker.mhp = attacker.mhpmax = 100;
    defender.mhp = defender.mhpmax = 100;
    const attack = requireMonsterData(MONSTER_ATTACKS, attacker.mnum).find(slot => slot[0] === AT_ENGL);
    assert.ok(attack, `${attackerSpecies} needs its native engulf attack`);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /engulfs|swallows|encloses|regurgitated|expelled|released|expels|turns into|goes out|killed|destroyed|medallion|looks much better|falls into|drowns|Burrrrp|fire ant|burn/,
        limit: 20,
    });
    const engulf = () => resolveMonsterCombatEngulf(attacker, defender, attack, {
        state: game, visible: true,
        resolveDamage: (source, target, slot) => resolveMonsterCombatDamage(source, target, slot, {
            state: game, visible: true,
        }),
    });
    return { level, attacker, defender, engulf, input };
}
void test('a living engulf target is damaged, extinguished, and returned to its own square', async () => {
    const { level, attacker, defender, engulf } = await engulfRoom();
    const lamp = await knownObject(OIL_LAMP, { age: 200 });
    await addObjectToMonsterInventory(defender, lamp);
    assert.equal(beginObjectBurn(lamp), true);
    const result = await engulf();
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.ok(defender.mhp > 0 && defender.mhp < 100);
    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.ocarry, defender);
    assert.equal(monsterAtPosition(level, 11, 10), attacker);
    assert.equal(monsterAtPosition(level, 12, 10), defender);
});
for (const obstruction of ['huge defender', 'larger defender', 'trapped attacker', 'trapped defender',
    'defender in rock', 'defender in a closed door', 'defender behind bars', 'attacker behind bars']) {
    void test(`engulf admission refuses a ${obstruction} before extinguishing inventory`, async () => {
        const { level, attacker, defender, engulf } = await engulfRoom('ochre jelly', obstruction === 'huge defender' ? 'giant' : obstruction === 'larger defender' ? 'troll' : 'orc');
        const lamp = await knownObject(OIL_LAMP, { age: 200 });
        await addObjectToMonsterInventory(defender, lamp);
        beginObjectBurn(lamp);
        if (obstruction === 'trapped attacker')
            attacker.mtrapped = 1;
        if (obstruction === 'trapped defender')
            defender.mtrapped = 1;
        if (obstruction === 'defender in rock')
            level.requireAt(12, 10).typ = STONE;
        if (obstruction === 'defender in a closed door') {
            level.requireAt(12, 10).typ = DOOR;
            level.requireAt(12, 10).doormask = D_CLOSED;
        }
        if (obstruction === 'defender behind bars')
            level.requireAt(12, 10).typ = IRONBARS;
        if (obstruction === 'attacker behind bars')
            level.requireAt(11, 10).typ = IRONBARS;
        const result = await engulf();
        assert.equal(result.nativeResult, M_ATTK_MISS);
        assert.equal(defender.mhp, 100);
        assert.equal(lamp.lamplit, true);
        assert.equal(monsterAtPosition(level, 11, 10), attacker);
        assert.equal(monsterAtPosition(level, 12, 10), defender);
    });
}
void test('a whirling engulfer can enclose a large defender through iron bars', async () => {
    const { level, attacker, defender, engulf } = await engulfRoom('fog cloud', 'troll');
    level.requireAt(12, 10).typ = IRONBARS;
    const result = await engulf();
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.ok(defender.mhp < 100);
    assert.equal(monsterAtPosition(level, 11, 10), attacker);
    assert.equal(monsterAtPosition(level, 12, 10), defender);
});
void test('a swallowed vampire reverts and is expelled before digestion consumes its amulet', async () => {
    const { level, attacker, defender, engulf } = await engulfRoom('purple worm', 'vampire');
    const naturalSpecies = MONSTER_NAME.indexOf('vampire');
    defender.cham = naturalSpecies;
    setMonsterSpecies(defender, MONSTER_NAME.indexOf('vampire bat'));
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const result = await engulf();
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(defender.mnum, naturalSpecies);
    assert.ok(defender.mhp > 0);
    assert.equal(amulet.ocarry, defender);
    assert.equal(monsterAtPosition(level, 11, 10), attacker);
    assert.equal(monsterAtPosition(level, 12, 10), defender);
});
void test('a life-saved physical engulf target returns alive to its square', async () => {
    const { level, attacker, defender, engulf } = await engulfRoom();
    defender.mhp = 1;
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const result = await engulf();
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(amulet.where, 'gone');
    assert.ok(defender.mhp > 0);
    assert.equal(monsterAtPosition(level, 11, 10), attacker);
    assert.equal(monsterAtPosition(level, 12, 10), defender);
});
void test('a flaming engulfer leaves the enclosed target lamp lit', async () => {
    const { defender, engulf } = await engulfRoom('fire vortex', 'fire ant');
    const lamp = await knownObject(OIL_LAMP, { age: 200 });
    await addObjectToMonsterInventory(defender, lamp);
    beginObjectBurn(lamp);
    await engulf();
    assert.equal(lamp.lamplit, true);
    assert.equal(lamp.ocarry, defender);
});
void test('digestion returns the attacker home when its wall-phasing victim occupied solid rock', async () => {
    const { level, attacker, defender, engulf } = await engulfRoom('purple worm', 'xorn');
    level.requireAt(12, 10).typ = STONE;
    const result = await engulf();
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(level, defender.mx, defender.my), defender);
    assert.equal(monsterAtPosition(level, 11, 10), attacker);
    assert.equal(monsterAtPosition(level, 12, 10), null);
});
void test('a surviving digester settles into the victim square and triggers its pit', async () => {
    const { level, attacker, defender, engulf } = await engulfRoom('purple worm');
    addTrap(level, PIT, defender.mx, defender.my);
    initRng(97n);
    const result = await engulf();
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.equal(monsterAtPosition(level, 12, 10), attacker);
    assert.equal(monsterAtPosition(level, 11, 10), null);
    assert.equal(attacker.mtrapped, 1);
    assert.ok(attacker.mhp > 0);
});
void test('a digester entering its aquatic victim square must survive the liquid', async () => {
    const { level, attacker, defender, engulf } = await engulfRoom('purple worm');
    level.requireAt(12, 10).typ = POOL;
    const result = await engulf();
    assert.ok(result.nativeResult & M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(level, defender.mx, defender.my), defender);
    assert.notEqual(monsterAtPosition(level, attacker.mx, attacker.my), attacker);
    assert.equal(monsterAtPosition(level, 12, 10), null);
    requirePlayingGame(game);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
});
//# sourceMappingURL=monster_combat_engulf.test.js.map