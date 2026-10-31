import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { mhitmAdCold, mhitmAdElec } from '../js/uhitm.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { M_SEEN_COLD, M_SEEN_ELEC, MM_ANGRY, MM_NOGRP, MSLOW, NO_MINVENT, W_ARM, } from '../js/const.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_PROTECTION, OBJECT_NAMES, POT_HEALING, WAN_STRIKING, WHITE_DRAGON_SCALE_MAIL, } from '../js/object_data.js';
import { AD_COLD, AD_ELEC, AT_BITE, AT_CLAW, AT_TUCH } from '../js/monster_attack_types.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
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
function naturalContext(attack, damage, publish) {
    requirePlayingGame(game);
    return {
        state: game, publish, random: () => 0,
        rollDice: (count, sides) => count * sides, rollOne: () => 1,
        attack, damage, specialDamage: 0, target: { x: 11, y: 10 },
    };
}
// C uhitm.c:mhitm_ad_cold() uhitm branch: the resistance line has no
// "seem" softening and shieldeff() precedes it.
void test("a hero's cold claw covers a resisting defender in frost without 'seem'", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const troll = await createMonsterAt('ice troll', 11, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await mhitmAdCold({
        magr: 'youmonst',
        defender: troll,
        context: naturalContext([AT_CLAW, AD_COLD, 2, 6], 12, publish),
    });
    const prose = messages.join('\n');
    const frost = prose.indexOf('The ice troll is covered in frost!');
    const chill = prose.indexOf("The frost doesn't chill the ice troll!");
    assert.ok(frost >= 0 && chill > frost, `frost precedes the resistance line:\n${prose}`);
    assert.ok(!prose.includes('seem'), `the hero branch never softens the line:\n${prose}`);
    assert.equal(result.damage, 0, 'a cold-resistant defender takes no claw damage');
});
// C uhitm.c:mhitm_ad_elec() uhitm branch: the zap line keeps "zapped"
// (not the monster-versus-monster "gets zapped") and golemeffects()
// slows an iron golem that shocks cannot hurt.
void test("a hero's electric touch zaps an iron golem without hurting it", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const golem = await createMonsterAt('iron golem', 11, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await mhitmAdElec({
        magr: 'youmonst',
        defender: golem,
        context: naturalContext([AT_TUCH, AD_ELEC, 2, 6], 12, publish),
    });
    const prose = messages.join('\n');
    const zapped = prose.indexOf('The iron golem is zapped!');
    const shock = prose.indexOf("The zap doesn't shock the iron golem!");
    assert.ok(zapped >= 0 && shock > zapped, `the zap line precedes the resistance line:\n${prose}`);
    assert.equal(result.damage, 0, 'a shock-resistant golem takes no touch damage');
    assert.equal(golem.mspeed, MSLOW, 'golemeffects() slows the iron golem');
});
// C uhitm.c:mhitm_ad_cold() mhitu branch: hitmsg() precedes the magic
// cancellation probe, and a negated cold claw announces "You avoid harm."
// without any frost line.
void test('a negated cold claw keeps its hit line, avoids harm and deals no damage', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const cloak = await addInventoryObject(CLOAK_OF_PROTECTION);
    wearHeroArmor(cloak);
    findArmorClass();
    const troll = await createMonsterAt('ice troll', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    troll.mux = game.u.ux;
    troll.muy = game.u.uy;
    const { messages } = recordedPager(/ice troll|frost|avoid harm|cloak/, 12);
    await performMonsterHeroAttack(troll, game, {
        random: limit => limit === 10 ? 0 : limit - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    const claw = prose.lastIndexOf('The ice troll hits!');
    const avoided = prose.indexOf('You avoid harm.');
    assert.ok(claw >= 0 && avoided > claw, `the cold claw's hit line precedes the negation message:\n${prose}`);
    assert.equal(game.u.uhp, 76, 'the weapon hit and the physical bite each deal their 2d6; the negated cold claw deals none');
});
// C uhitm.c:mhitm_ad_cold() mhitu branch: the frost line, the resistance
// line and the gated inventory destruction keep their native order even
// though the cold damage itself is resisted.
void test('a resisting hero reads the frost lines before the potion freezes', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10, coldResistance: true } });
    requirePlayingGame(game);
    await addInventoryObject(POT_HEALING);
    const troll = await createMonsterAt('ice troll', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    troll.m_lev = 30;
    troll.mux = game.u.ux;
    troll.muy = game.u.uy;
    const { messages } = recordedPager(/ice troll|frost|potion|shatter/, 12);
    await performMonsterHeroAttack(troll, game, {
        random: () => 0, rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    const claw = prose.lastIndexOf('The ice troll hits!');
    const frost = prose.indexOf("You're covered in frost!");
    const cold = prose.indexOf("The frost doesn't seem cold!");
    const shatter = prose.search(/freezes and shatters/);
    assert.ok(claw >= 0 && frost > claw && cold > frost && shatter > cold, `hit line, frost, resistance and shatter keep their order:\n${prose}`);
    assert.ok(game.inventory.every(object => object.otyp !== POT_HEALING), 'the freezing cold consumes the potion');
});
// C uhitm.c:mhitm_ad_elec() mhitu branch: the grid bug's bite line, the
// zap line and the gated wand explosion keep their native order.
void test('a grid bug bite zaps the hero and explodes a carried wand', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    await addInventoryObject(WAN_STRIKING);
    const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    bug.m_lev = 30;
    bug.mux = game.u.ux;
    bug.muy = game.u.uy;
    const { messages } = recordedPager(/grid bug|zap|wand|bit/, 10);
    await performMonsterHeroAttack(bug, game, {
        random: () => 0, rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    const bite = prose.indexOf('The grid bug bites!');
    const zapped = prose.indexOf('You get zapped!');
    const explosion = prose.search(/wand of striking breaks apart and explodes/);
    assert.ok(bite >= 0 && zapped > bite && explosion > zapped, `bite, zap and wand explosion keep their order:\n${prose}`);
    assert.ok(game.inventory.every(object => object.otyp !== WAN_STRIKING), 'the exploding shock consumes the wand');
});
// C uhitm.c:mhitm_ad_cold() mhitm branch: the monster-versus-monster
// resistance line softens with "seem", unlike the hero's own branch.
void test("monster cold contact softens a resisting defender's line with 'seem'", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('ice troll', 11, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('ice troll', 12, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    await resolveMonsterCombatDamage(attacker, defender, [AT_CLAW, AD_COLD, 2, 6], {
        visible: true,
        random: () => 0,
        rollDice: (count, sides) => count * sides,
        publish: async (message) => { messages.push(String(message)); },
    });
    const prose = messages.join('\n');
    const frost = prose.indexOf('The ice troll is covered in frost!');
    const chill = prose.indexOf("The frost doesn't seem to chill the ice troll!");
    assert.ok(frost >= 0 && chill > frost, `frost precedes the softened resistance line:\n${prose}`);
});
// C uhitm.c:mhitm_ad_elec() mhitm branch: the monster-versus-monster zap
// line reads "gets zapped" and the resisting defender takes no damage.
void test('monster electric contact zaps a resisting defender without wounding it', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const attacker = await createMonsterAt('grid bug', 11, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('energy vortex', 12, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const hitPoints = defender.mhp;
    await resolveMonsterCombatDamage(attacker, defender, [AT_BITE, AD_ELEC, 1, 1], {
        visible: true,
        random: () => 0,
        rollDice: (count, sides) => count * sides,
        publish: async (message) => { messages.push(String(message)); },
    });
    const prose = messages.join('\n');
    assert.ok(prose.includes('The energy vortex gets zapped!'), `the monster branch reads "gets zapped":\n${prose}`);
    assert.ok(prose.includes("The zap doesn't shock the energy vortex!"), prose);
    assert.equal(defender.mhp, hitPoints, 'the shock-resistant defender is not wounded');
});
// C uhitm.c:mhitm_ad_cold() mhitu branch: monstseesu(M_SEEN_COLD) runs
// after the resistance line, so every witnessing monster learns the hero
// resists cold.
void test('a resisted cold claw teaches witnessing monsters the hero resists cold', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10, coldResistance: true } });
    requirePlayingGame(game);
    const troll = await createMonsterAt('ice troll', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    troll.mux = game.u.ux;
    troll.muy = game.u.uy;
    const { messages } = recordedPager(/ice troll|frost/, 12);
    await performMonsterHeroAttack(troll, game, {
        random: () => 0, rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    assert.ok(messages.join('\n').includes("The frost doesn't seem cold!"));
    assert.equal((troll.seen_resistance ?? 0) & M_SEEN_COLD, M_SEEN_COLD, 'monstseesu(M_SEEN_COLD) reaches the attacking troll');
});
// C uhitm.c:mhitm_ad_cold() mhitu branch: monstunseesu(M_SEEN_COLD) runs
// right after the frost line when the hero is not resistant.
void test('a chilling cold claw makes witnessing monsters forget cold resistance', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const troll = await createMonsterAt('ice troll', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    troll.seen_resistance = M_SEEN_COLD;
    troll.mux = game.u.ux;
    troll.muy = game.u.uy;
    const { messages } = recordedPager(/ice troll|frost/, 12);
    await performMonsterHeroAttack(troll, game, {
        random: () => 0, rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    assert.ok(messages.join('\n').includes("You're covered in frost!"));
    assert.equal((troll.seen_resistance ?? 0) & M_SEEN_COLD, 0, 'monstunseesu(M_SEEN_COLD) clears the witnessed resistance');
});
// C uhitm.c:mhitm_ad_elec() mhitu branch: monstseesu(M_SEEN_ELEC) and
// monstunseesu(M_SEEN_ELEC) bracket the hero's shock resistance the same
// way cold's helpers do.
void test('a grid bug bite updates witnessing monsters about shock resistance', async () => {
    for (const resistant of [false, true]) {
        await freshObjectRoom({
            hero: { uhp: 100, uhpmax: 100, uac: 10, shockResistance: resistant },
        });
        requirePlayingGame(game);
        const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        bug.seen_resistance = M_SEEN_ELEC;
        bug.mux = game.u.ux;
        bug.muy = game.u.uy;
        const { messages } = recordedPager(/grid bug|zap/, 10);
        await performMonsterHeroAttack(bug, game, {
            random: () => 0, rollOne: () => 1, rollDice: (count, sides) => count * sides,
        });
        await flushPendingTopline();
        const prose = messages.join('\n');
        assert.ok(prose.includes('You get zapped!'), prose);
        assert.equal((bug.seen_resistance ?? 0) & M_SEEN_ELEC, resistant ? M_SEEN_ELEC : 0, `monst${resistant ? 'seesu' : 'unseesu'}(M_SEEN_ELEC) updates the attacking bug`);
    }
});
// C uhitm.c:mhitm_ad_cold() uhitm branch: defended(mdef, AD_COLD) reads
// the defender's worn dragon armor, not just innate resistance.
void test("a hero's cold claw cannot chill a defender in white dragon scale mail", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, MM_NOGRP | NO_MINVENT);
    const mail = await knownObject(WHITE_DRAGON_SCALE_MAIL);
    mail.owornmask = W_ARM;
    soldier.minvent = [mail];
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await mhitmAdCold({
        magr: 'youmonst',
        defender: soldier,
        context: naturalContext([AT_CLAW, AD_COLD, 2, 6], 12, publish),
    });
    const prose = messages.join('\n');
    assert.ok(prose.includes("The frost doesn't chill the soldier!"), `worn white dragon scale mail defends the soldier:\n${prose}`);
    assert.equal(result.damage, 0, 'defended(mdef, AD_COLD) zeroes the claw damage');
});
// C uhitm.c:mhitm_ad_elec() uhitm branch: defended(mdef, AD_ELEC) reads
// the defender's worn blue dragon armor.
void test("a hero's electric touch cannot shock a defender in blue dragon scale mail", async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 11, 10, MM_NOGRP | NO_MINVENT);
    const blueDragonScaleMail = OBJECT_NAMES.indexOf('blue dragon scale mail');
    const mail = await knownObject(blueDragonScaleMail);
    mail.owornmask = W_ARM;
    soldier.minvent = [mail];
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await mhitmAdElec({
        magr: 'youmonst',
        defender: soldier,
        context: naturalContext([AT_TUCH, AD_ELEC, 2, 6], 12, publish),
    });
    const prose = messages.join('\n');
    assert.ok(prose.includes("The zap doesn't shock the soldier!"), `worn blue dragon scale mail defends the soldier:\n${prose}`);
    assert.equal(result.damage, 0, 'defended(mdef, AD_ELEC) zeroes the touch damage');
});
//# sourceMappingURL=uhitm_ad_cold_elec.test.js.map