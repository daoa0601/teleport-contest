import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { mhitmAdBlnd, mhitmAdDrli, mhitmAdEnch, mhitmAdLegs, mhitmAdStun, } from '../js/uhitm.js';
import { resolveMonsterCombatDamage } from '../js/mhitm.js';
import { wearHeroArmor } from '../js/do_wear.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LEATHER_ARMOR } from '../js/object_data.js';
import { AD_BLND, AD_DRLI, AD_ENCH, AD_LEGS, AD_STUN, AT_BITE, AT_CLAW, AT_STNG, } from '../js/monster_attack_types.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function recordedPager(expected, limit) {
    const input = resetInputState();
    const messages = [];
    installPagerInput(input, { expected, limit });
    input.beforeRead = () => { messages.push(game._pending_message); };
    return { messages };
}
function naturalContext(attack, damage, publish, random = () => 0) {
    requirePlayingGame(game);
    return {
        state: game, publish, random,
        rollDice: (count, sides) => count * sides, rollOne: () => 1,
        attack, damage, specialDamage: 0, target: { x: 11, y: 10 },
    };
}
async function hostileAt(species) {
    const monster = await createMonsterAt(species, game.u.ux + 1, game.u.uy, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monster.msleeping = 0;
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    return monster;
}
// C uhitm.c:mhitm_ad_stun() mhitu branch: hitmsg() precedes the one-in-four
// gate; make_stunned() gets the full kick damage and only the HP tail halves.
void test('a stunning kick staggers the hero before halving its damage', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const abbot = await hostileAt('abbot');
    const { messages } = recordedPager(/abbot|kicks|staggers|stagger/, 12);
    await performMonsterHeroAttack(abbot, game, {
        random: limit => limit === 4 ? 0 : limit - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    const kick = prose.indexOf('The abbot kicks!');
    const stagger = prose.indexOf('You stagger...');
    assert.ok(kick >= 0 && stagger > kick, `the kick line precedes the stagger:\n${prose}`);
    assert.equal(game.u.stunnedTurns, 6, 'make_stunned() receives the full 3d2 kick damage');
    assert.equal(game.u.uhp, 72, 'the claw deals 8d2=16, the halved kick 3, the clerical spell 9');
});
// C uhitm.c:mhitm_ad_drli() mhitu branch: hitmsg() precedes the selection
// gate, magic cancellation and losexp(); the touch keeps its HP damage.
void test('a wraith touch drains a level after its hit line', async () => {
    await freshObjectRoom({ hero: {
            uhp: 100, uhpmax: 100, uac: 10, ulevel: 10, uexp: 2000,
        } });
    requirePlayingGame(game);
    const wraith = await hostileAt('wraith');
    const { messages } = recordedPager(/wraith|touches|Goodbye|level/, 14);
    await performMonsterHeroAttack(wraith, game, {
        random: limit => limit === 3 ? 0 : limit - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    assert.ok(prose.includes('The wraith touches you!'), prose);
    assert.equal(game.u.ulevel, 9, 'losexp() drains exactly one level');
    assert.equal(game.u.uhp, 94, 'the touch deals its 1d6 damage');
});
// C uhitm.c:mhitm_ad_blnd() mhitu branch: the blinding line replaces
// hitmsg(), make_blinded() takes the declared damage, and the claw deals no
// HP damage while still consuming hitmu()'s knockback draws.
void test('a raven claw blinds the hero for its declared damage', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const raven = await hostileAt('raven');
    const { messages } = recordedPager(/raven|bites|blinds/, 12);
    await performMonsterHeroAttack(raven, game, {
        random: limit => limit - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    assert.ok(prose.includes('The raven blinds you!'), prose);
    assert.equal(game.u.blindTurns, 6, 'make_blinded() adds the full declared 1d6 damage');
    assert.equal(game.u.uhp, 94, 'the bite deals 1d6; the blinding claw deals none');
});
// C uhitm.c:mhitm_ad_legs() mhitu branch: the side roll and the contact line
// precede set_wounded_legs(); the sting still deals its full HP damage.
void test('a xan pricks the hero\u2019s left leg and wounds it', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const xan = await hostileAt('xan');
    const { messages } = recordedPager(/xan|pricks|leg/, 12);
    await performMonsterHeroAttack(xan, game, {
        random: limit => limit === 2 ? 0 : limit - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    assert.ok(prose.includes('The xan pricks your left leg!'), prose);
    assert.ok((game.u._woundedLegTurns ?? 0) > 0, 'set_wounded_legs() ran');
    assert.equal(game.u.uhp, 96, 'the sting deals its full 1d4 damage');
});
// C uhitm.c:mhitm_ad_ench() mhitu branch: hitmsg() precedes some_armor(),
// drain_item() and the "less effective" line.
void test('a disenchanter drains worn armor after its hit line', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const armor = await addInventoryObject(LEATHER_ARMOR, { spe: 3 });
    wearHeroArmor(armor);
    const disenchanter = await hostileAt('disenchanter');
    const { messages } = recordedPager(/disenchanter|hits|effective|armor/, 14);
    await performMonsterHeroAttack(disenchanter, game, {
        random: limit => limit - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    const hit = prose.indexOf('The disenchanter hits!');
    const lessEffective = prose.indexOf('less effective.');
    assert.ok(hit >= 0 && lessEffective > hit, `the hit line precedes the drain:\n${prose}`);
    assert.equal(armor.spe, 2, 'the claw drains one enchantment');
});
// C uhitm.c:mhitm_ad_stun() uhitm branch: the stagger line precedes
// mhitm_ad_phys(), which keeps the declared bite damage.
void test("a hero's stunning bite staggers a wolf without softening it", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const wolf = await createMonsterAt('wolf', 11, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await mhitmAdStun({
        magr: 'youmonst',
        defender: wolf,
        context: naturalContext([AT_BITE, AD_STUN, 2, 6], 12, publish),
    });
    assert.deepEqual(messages, ['The wolf staggers for a moment.']);
    assert.equal(wolf.mstun, 1, 'mstun is set');
    assert.equal(result.damage, 12, 'mhitm_ad_phys() keeps the bite damage');
});
// C uhitm.c:mhitm_ad_drli() uhitm branch: the level drain reports
// "becomes weaker!", lowers mhpmax and mhp by 2d6 and returns zero damage.
void test("a hero's life-draining touch weakens a wolf by 2d6", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const wolf = await createMonsterAt('wolf', 11, 10, MM_NOGRP | NO_MINVENT);
    wolf.m_lev = 4;
    wolf.mhpmax = 40;
    wolf.mhp = 40;
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await mhitmAdDrli({
        magr: 'youmonst',
        defender: wolf,
        context: naturalContext([AT_CLAW, AD_DRLI, 2, 6], 12, publish),
    });
    assert.deepEqual(messages, ['The wolf becomes weaker!']);
    assert.equal(wolf.m_lev, 3, 'the defender drops one level');
    assert.equal(wolf.mhpmax, 28, 'mhpmax loses the full 2d6 drain');
    assert.equal(wolf.mhp, 28, 'the drain also removes current hit points');
    assert.equal(result.damage, 0, 'the drain replaces the declared damage');
});
// C uhitm.c:mhitm_ad_blnd() uhitm branch: the defender is blinded for the
// declared damage plus its current blindness, capped at 127.
void test("a hero's blinding claw blinds a wolf and returns zero damage", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const wolf = await createMonsterAt('wolf', 11, 10, MM_NOGRP | NO_MINVENT);
    wolf.mblinded = 10;
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await mhitmAdBlnd({
        magr: 'youmonst',
        defender: wolf,
        context: naturalContext([AT_CLAW, AD_BLND, 2, 6], 12, publish),
    });
    assert.deepEqual(messages, ['The wolf is blinded.']);
    assert.equal(wolf.mcansee, 0, 'the defender stops seeing');
    assert.equal(wolf.mblinded, 22, 'the declared damage extends the blindness');
    assert.equal(result.damage, 0);
});
// C uhitm.c:mhitm_ad_legs() and mhitm_ad_ench() uhitm branches both reduce
// to mhitm_ad_phys(), and neither resets the declared damage.
void test("a hero's leg sting and disenchant touch keep their damage", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const wolf = await createMonsterAt('wolf', 11, 10, MM_NOGRP | NO_MINVENT);
    const quiet = async () => { throw new Error('no message expected'); };
    const legs = await mhitmAdLegs({
        magr: 'youmonst',
        defender: wolf,
        context: naturalContext([AT_STNG, AD_LEGS, 1, 4], 4, quiet),
    });
    const ench = await mhitmAdEnch({
        magr: 'youmonst',
        defender: wolf,
        context: naturalContext([AT_CLAW, AD_ENCH, 1, 4], 4, quiet),
    });
    assert.equal(legs.damage, 4, 'mhitm_ad_legs() has no hero armor probe');
    assert.equal(ench.damage, 4, 'mhitm_ad_ench() has no hero armor probe');
});
// C uhitm.c:mhitm_ad_stun() mhitm branch: a cancelled attacker keeps its
// damage, and an uncancelled one staggers the defender before the physical
// hit.
void test('monster-versus-monster stun staggers the defender', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('wolf', 11, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('pony', 12, 10, MM_NOGRP | NO_MINVENT);
    defender.mhp = 50;
    defender.mhpmax = 50;
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    attacker.mcan = 1;
    const cancelled = await resolveMonsterCombatDamage(attacker, defender, [AT_BITE, AD_STUN, 1, 2], {
        visible: true, random: () => 1,
        rollDice: (count, sides) => count * sides, publish,
    });
    assert.equal(cancelled.damage, 2, 'a cancelled attacker keeps its damage');
    assert.equal(defender.mstun ?? 0, 0, 'a cancelled attacker stuns nobody');
    attacker.mcan = 0;
    const stunned = await resolveMonsterCombatDamage(attacker, defender, [AT_BITE, AD_STUN, 1, 2], {
        visible: true, random: () => 1,
        rollDice: (count, sides) => count * sides, publish,
    });
    assert.deepEqual(messages, ['The pony staggers for a moment.']);
    assert.equal(defender.mstun, 1);
    assert.equal(stunned.damage, 2, 'mhitm_ad_phys() keeps the bite damage');
});
// C uhitm.c:mhitm_ad_drli() mhitm branch: the drain rolls 2d6, lowers
// mhpmax and drops a level.
void test('monster-versus-monster life drain weakens the defender', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('wraith', 11, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('pony', 12, 10, MM_NOGRP | NO_MINVENT);
    defender.m_lev = 4;
    defender.mhpmax = 40;
    defender.mhp = 40;
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_BITE, AD_DRLI, 1, 6], {
        visible: true,
        random: limit => limit === 3 ? 0 : limit - 1,
        rollDice: (count, sides) => count * sides, publish,
    });
    assert.deepEqual(messages, ['The pony becomes weaker!']);
    assert.equal(defender.m_lev, 3, 'the defender drops one level');
    assert.equal(defender.mhpmax, 28, 'mhpmax loses the full 2d6 drain');
    assert.equal(result.damage, 12, 'the drain replaces the declared damage');
});
// C uhitm.c:mhitm_ad_blnd() mhitm branch: the blinding line and a fresh
// d(damn,damd) roll set the defender's blindness.
void test('monster-versus-monster blinding blinds by a fresh damage roll', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('raven', 11, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('wolf', 12, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_BLND, 2, 6], {
        visible: true, random: () => 1,
        rollDice: (count, sides) => count * sides, publish,
    });
    assert.deepEqual(messages, ['The wolf is blinded.']);
    assert.equal(defender.mblinded, 12, 'the blinding rolls its own d(damn,damd)');
    assert.equal(defender.mcansee, 0);
    assert.equal(result.damage, 0);
});
// C uhitm.c:mhitm_ad_legs() and mhitm_ad_ench() mhitm branches: a cancelled
// legs attack deals nothing; every other combination passes the damage
// through mhitm_ad_phys().
void test('monster-versus-monster legs and enchant contact', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('xan', 11, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('pony', 12, 10, MM_NOGRP | NO_MINVENT);
    const publish = async () => { throw new Error('no message expected'); };
    attacker.mcan = 1;
    const cancelledLegs = await resolveMonsterCombatDamage(attacker, defender, [AT_STNG, AD_LEGS, 1, 4], {
        visible: true, random: () => 1,
        rollDice: (count, sides) => count * sides, publish,
    });
    assert.equal(cancelledLegs.damage, 0, 'a cancelled xan deals no damage');
    attacker.mcan = 0;
    const legs = await resolveMonsterCombatDamage(attacker, defender, [AT_STNG, AD_LEGS, 1, 4], {
        visible: true, random: () => 1,
        rollDice: (count, sides) => count * sides, publish,
    });
    const ench = await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_ENCH, 1, 4], {
        visible: true, random: () => 1,
        rollDice: (count, sides) => count * sides, publish,
    });
    assert.equal(legs.damage, 4, 'an uncancelled sting keeps its damage');
    assert.equal(ench.damage, 4, 'there is no monster armor selection');
});
//# sourceMappingURL=uhitm_ad_status.test.js.map