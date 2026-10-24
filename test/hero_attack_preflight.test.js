import { createMonsterAt } from './support/monsters.js';
import { floorObject } from './support/game-objects.js';
import { ARROW } from '../js/object_data.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_OBJECT, STRAT_WAITMASK, } from '../js/const.js';
import { map_invisible, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_FLAGS1 } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { prepareAppliedWeaponAttack } from '../js/hero_attack_preflight.js';
import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { rhack } from '../js/cmd.js';
const M1_CONCEAL = 0x00000080;
async function target(overrides = {}) {
    const monster = await createMonsterAt(overrides.mnum ?? 0, 12, 10);
    monster.mhp = 10;
    monster.mhpmax = 10;
    monster.mstrategy = STRAT_WAITMASK;
    if (overrides.minvis !== undefined)
        monster.minvis = overrides.minvis;
    if (overrides.msleeping !== undefined)
        monster.msleeping = overrides.msleeping;
    if (overrides.m_ap_type !== undefined)
        monster.m_ap_type = overrides.m_ap_type;
    if (overrides.mappearance !== undefined)
        monster.mappearance = overrides.mappearance;
    if (overrides.m_lev !== undefined)
        monster.m_lev = overrides.m_lev;
    if (overrides.mundetected !== undefined)
        monster.mundetected = overrides.mundetected;
    if (overrides.mpeaceful !== undefined)
        monster.mpeaceful = overrides.mpeaceful;
    if (overrides.mtame !== undefined)
        monster.mtame = overrides.mtame;
    return monster;
}
void test('an unspotted monster is marked and awakened instead of attacked', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const monster = await target({ minvis: true, msleeping: 1 });
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: false, spentTime: true });
    assert.equal(monster.msleeping, 0);
    assert.equal((monster.mstrategy ?? 0) & STRAT_WAITMASK, 0);
    assert.equal(game.level.requireAt(12, 10).remembered_glyph?.kind, 'invisible');
    assert.match(game._pending_message, /something there you can't see/);
});
void test('a disguised monster behind an invisible marker is revealed and attacked', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const monster = await target({
        mnum: 64,
        m_ap_type: M_AP_OBJECT,
        mappearance: 18,
        minvis: true,
    });
    map_invisible(monster.mx, monster.my);
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: true, spentTime: false });
    assert.equal(monster.m_ap_type, 0);
    assert.equal(monster.mappearance, 0);
});
void test('a visible object mimic is stumbled onto without a pole-range grab', async () => {
    freshObjectRoom({ hero: { warning: true } });
    requireFixtureGame(game);
    initRng(4500);
    const monster = await target({
        mnum: 64,
        m_lev: 12,
        m_ap_type: M_AP_OBJECT,
        mappearance: 18,
    });
    newsym(monster.mx, monster.my);
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: false, spentTime: true });
    assert.equal(monster.m_ap_type, 0);
    assert.equal(game.u.ustuck, undefined);
    assert.match(game._pending_message, /That arrow is a small mimic/);
    assert.notEqual(game.level.requireAt(12, 10).remembered_glyph?.kind, 'invisible');
});
void test('a visible monster disguise reports what it really is', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const monster = await target({
        mnum: 64,
        m_ap_type: 3,
        mappearance: 0,
    });
    newsym(monster.mx, monster.my);
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: false, spentTime: true });
    assert.equal(monster.m_ap_type, 0);
    assert.match(game._pending_message, /Wait!  That giant ant is really a small mimic!/);
});
void test('a sensed disguised monster is revealed and awakened before attacking', async () => {
    freshObjectRoom({ hero: { detectMonsters: true } });
    const monster = await target({
        mnum: 64,
        m_ap_type: M_AP_OBJECT,
        mappearance: 18,
        msleeping: 1,
    });
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: true, spentTime: false });
    assert.equal(monster.m_ap_type, 0);
    assert.equal(monster.msleeping, 0);
});
void test('finding a visible hides-under monster spends the action without an invisible marker', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const concealer = MONSTER_FLAGS1.findIndex(flags => (flags & M1_CONCEAL) !== 0);
    assert.notEqual(concealer, -1);
    const monster = await target({ mnum: concealer, mundetected: 1, msleeping: 1 });
    await floorObject(ARROW, 12, 10, { initialize: false, quan: 1, known: false });
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: false, spentTime: true });
    assert.equal(monster.mundetected, 0);
    assert.equal(monster.msleeping, 0);
    assert.notEqual(game.level.requireAt(12, 10).remembered_glyph?.kind, 'invisible');
    assert.match(game._pending_message, /hiding under an uncursed arrow/);
});
void test('an unseen hides-under monster is described as something under the object', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const concealer = MONSTER_FLAGS1.findIndex(flags => (flags & M1_CONCEAL) !== 0);
    const monster = await target({
        mnum: concealer,
        minvis: true,
        mundetected: 1,
        msleeping: 1,
    });
    await floorObject(ARROW, 12, 10, { initialize: false, quan: 1, known: false });
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: false, spentTime: true });
    assert.match(game._pending_message, /something hiding under an uncursed arrow/);
});
void test('hallucination uses the displayed monster name for a revealed hider', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    requireFixtureGame(game);
    initRng(4500);
    const concealer = MONSTER_FLAGS1.findIndex(flags => (flags & M1_CONCEAL) !== 0);
    const monster = await target({ mnum: concealer, mundetected: 1 });
    await floorObject(ARROW, 12, 10, { initialize: false, quan: 1, known: false });
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: false, spentTime: true });
    assert.match(game._pending_message, /^A wild .+ appears!$/);
    assert.doesNotMatch(game._pending_message, /creature is present/);
});
void test('an actually displayed warning permits an unseen attack', async () => {
    freshObjectRoom({ hero: { warning: true } });
    requireFixtureGame(game);
    const monster = await target({ minvis: true, m_lev: 12 });
    newsym(monster.mx, monster.my);
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: true, spentTime: false });
    assert.notEqual(game.level.requireAt(12, 10).remembered_glyph?.kind, 'invisible');
});
void test('declining a peaceful attack does not spend the action', async () => {
    freshObjectRoom({ flags: { verbose: true, confirm: true } });
    const monster = await target({ mpeaceful: 1 });
    pushKeys('n');
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: false, spentTime: false });
    assert.equal((monster.mstrategy ?? 0) & STRAT_WAITMASK, 0);
});
void test('peaceful confirmation uses the definite article for a tame target', async () => {
    freshObjectRoom({ flags: { verbose: true, confirm: true } });
    requireFixtureGame(game);
    const monster = await target({ mpeaceful: 1, mtame: 5 });
    pushKeys('n');
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: false, spentTime: false });
    assert.match(game._last_message, /Really attack the giant ant\?/);
});
void test('forcefight bypasses discovery and peaceful confirmation', async () => {
    freshObjectRoom({
        flags: { verbose: true, confirm: true },
        context: { move: 0, forcefight: true },
    });
    requireFixtureGame(game);
    const monster = await target({ minvis: true, mpeaceful: 1 });
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: true, spentTime: false });
    assert.notEqual(game.level.requireAt(12, 10).remembered_glyph?.kind, 'invisible');
});
void test('an underwater telepath attacks a dry-land hider without a warning', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    // Worn telepathy still senses the monster (tp_sensemon); C's reveal
    // message is suppressed by telepathy or detection alone, not by the
    // underwater gate that sensemon() adds on top.
    const amulet = await knownObject(OBJECT_NAMES.indexOf('amulet of ESP'), {
        invlet: 'a', where: 'inventory',
    });
    game.inventory = [amulet];
    pushKeys('a' + ' '.repeat(20));
    await rhack('P'.charCodeAt(0));
    game.u.uinwater = 1;
    const concealer = MONSTER_FLAGS1.findIndex(flags => (flags & M1_CONCEAL) !== 0);
    const monster = await target({ mnum: concealer, mundetected: 1, msleeping: 1 });
    await floorObject(ARROW, 12, 10, { initialize: false, quan: 1, known: false });
    const result = await prepareAppliedWeaponAttack(monster, null);
    assert.deepEqual(result, { proceed: true, spentTime: false });
    assert.equal(monster.mundetected, 0);
    assert.equal(monster.msleeping, 0);
    assert.doesNotMatch(game._pending_message ?? '', /hiding under|hidden monster/);
});
//# sourceMappingURL=hero_attack_preflight.test.js.map