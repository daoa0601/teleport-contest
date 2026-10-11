import { answerPrompts } from './support/input-boundaries.js';
import type { RoleKey } from '../js/roles.js';
import type { InitializedHero } from '../js/hero_types.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { A_INT, A_WIS, NOT_HUNGRY, P_EXPERT } from '../js/const.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, OBJECT_NAMES, SPE_CONFUSE_MONSTER, SPE_CURE_BLINDNESS,
    SPE_CURE_SICKNESS, SPE_HEALING, SPE_PROTECTION,
    WAN_DEATH, WAN_NOTHING,
} from '../js/object_data.js';
import { castSpell, forceLearnSpell } from '../js/spell.js';
import { currentSpellKnowledge, spellSkillType } from '../js/spell_casting_rules.js';
import { advanceSpellProtection } from '../js/spell_misc_effects.js';
import { ensureHeroSkills } from '../js/skills.js';
import { rhack } from '../js/cmd.js';
import { backfireWand } from '../js/wand_charge.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { hitMonsterWithAppliedWeapon, hitMonsterWithThrownObject } from '../js/hero_ranged_attack.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { trainSpellSkill } from './support/spells.js';

const HALBERD = OBJECT_NAMES.indexOf('halberd');

function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

function caster(type: number | null, { role = 'wizard', hero = {} }: { role?: RoleKey; hero?: Partial<InitializedHero> } = {}) {
    freshObjectRoom({ role, gameplaySeed: 41n, hero: {
        ulevel: 30, uen: 200, uenmax: 200, uenpeak: 200,
        uhp: 100, uhpmax: 200, uhs: NOT_HUNGRY, ...hero,
    } });
    requirePlayingGame(game);
    for (const attribute of [A_INT, A_WIS]) {
        game.u.acurr.a[attribute] = 18;
        game.u.amax.a[attribute] = 18;
    }
    game.spells = [];
    ensureHeroSkills(game);
    if (type !== null) forceLearnSpell(type);
    const input = resetInputState();
    return input;
}

void test('self healing spends energy, heals real HP, and leaves memory and inventory intact', async () => {
    const input = caster(SPE_HEALING);
    requirePlayingGame(game);
    const carried = await addInventoryObject(WAN_NOTHING);
    const spell = game.spells[0];
    const knowledge = currentSpellKnowledge(spell);
    input.feed('.');

    const result = await castSpell(SPE_HEALING);

    assert.equal(result.spentTime, true);
    assert.ok(game.u.uhp > 100);
    assert.equal(game.u.uen, 195);
    assert.equal(currentSpellKnowledge(spell), knowledge);
    assert.equal(game.inventory.length, 1);
    assert.equal(game.inventory[0], carried);
    assert.equal(game.u.uconduct.literate || 0, 0);
});

void test('directional healing restores its living target instead of the hero', async () => {
    const input = caster(SPE_HEALING);
    requirePlayingGame(game);
    const target = await createMonsterAt('jackal', 11, 10);
    target.mhp = 2;
    target.mhpmax = 40;
    input.feed('l');

    await castSpell(SPE_HEALING);

    assert.ok(target.mhp > 2);
    assert.equal(game.u.uhp, 100);
    assert.equal(game.u.uen, 195);
});

void test('cancelled spell direction releases its energy in the retained direction', async () => {
    const input = caster(SPE_HEALING);
    requirePlayingGame(game);
    const target = await createMonsterAt('jackal', 11, 10);
    target.mhp = 2;
    target.mhpmax = 40;
    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    input.feed('\x1b');

    const result = await castSpell(SPE_HEALING);

    assert.equal(result.spentTime, true);
    assert.ok(target.mhp > 2);
    assert.equal(game.u.uen, 195);
});

void test('carrying an unread spellbook does not permit casting its spell', async () => {
    caster(null);
    requirePlayingGame(game);
    await addInventoryObject(SPE_HEALING);

    const result = await castSpell(SPE_HEALING);

    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 200);
    assert.equal(game.u.uhp, 100);
});

void test('forced spell effects bypass learning and energy without training the hero', async () => {
    caster(null, { hero: { uen: 0 } });
    requirePlayingGame(game);
    const skill = spellSkillType(SPE_HEALING);
    assert.ok(game.u.weaponSkills != null, 'Expected game.u.weaponSkills to be initialized');
    const entry = game.u.weaponSkills[skill];
    assert.ok(entry);
    const practice = entry.advance;

    const result = await castSpell(SPE_HEALING, { force: true, atSelf: true });

    assert.equal(result.spentTime, true);
    assert.ok(game.u.uhp > 100);
    assert.equal(game.u.uen, 0);
    assert.equal(game.spells.length, 0);
    assert.equal(entry.advance, practice);
});

void test('successful casting trains the live school by spell level', async () => {
    caster(SPE_PROTECTION);
    requirePlayingGame(game);
    const skill = spellSkillType(SPE_PROTECTION);
    assert.ok(game.u.weaponSkills != null, 'Expected game.u.weaponSkills to be initialized');
    const entry = game.u.weaponSkills[skill];
    assert.ok(entry);
    const practice = entry.advance;

    await castSpell(SPE_PROTECTION);

    assert.equal(entry.advance, practice + 1);
    assert.ok(game.u.uspellprot != null, 'Expected game.u.uspellprot to be initialized');
    assert.ok(game.u.uspellprot > 0);
});

void test('protection has diminishing gains and does not restart its current decay period', async () => {
    const input = caster(SPE_PROTECTION);
    requirePlayingGame(game);
    await castSpell(SPE_PROTECTION);
    const first = game.u.uspellprot;
    assert.ok(first != null, 'Expected first to be initialized');
    assert.equal(game.u.uac, 10 - first);
    await advanceSpellProtection();
    const remaining = game.u.usptime;
    await answerPrompts(castSpell(SPE_PROTECTION), input, [
        { prompt: /begins to shimmer with a golden haze\.--More--/, keys: ' ' },
    ]);
    assert.ok(game.u.uspellprot != null, 'Expected game.u.uspellprot to be initialized');
    assert.ok(game.u.uspellprot > first);
    assert.ok(game.u.uspellprot < first * 2);
    assert.equal(game.u.usptime, remaining);
});

void test('expert protection lasts twenty ticks and its last point expires before feedback', async () => {
    const input = caster(SPE_PROTECTION, { role: 'priest' });
    requirePlayingGame(game);
    await trainSpellSkill(SPE_PROTECTION, P_EXPERT, { input });
    await castSpell(SPE_PROTECTION);
    assert.equal(game.u.uspmtime, 20);
    game.u.uspellprot = 1;
    game.u.usptime = 1;
    await answerPrompts(advanceSpellProtection(), input, [
        { prompt: /begins to shimmer with a golden haze\.--More--/, keys: ' ' },
    ]);
    assert.equal(game.u.uspellprot, 0);
    assert.equal(game.u.uac, 10);
    assert.match(game._pending_message, /haze around you disappears/);
});

void test('prayer invulnerability freezes protection decay through the real turn loop', async () => {
    const input = caster(SPE_PROTECTION);
    requirePlayingGame(game);
    await castSpell(SPE_PROTECTION);
    await answerPrompts(flushPendingTopline(), input, [
        { prompt: /begins to shimmer with a golden haze\.--More--/, keys: ' ' },
    ]);
    game.u.usptime = 4;
    game.u.invulnerable = true;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    game.context.move = 0;
    input.feed('..');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.u.usptime, 4);
});

void test('protection waits for its first haze message before granting armor', async () => {
    caster(SPE_PROTECTION);
    requirePlayingGame(game);
    const input = resetInputState();
    await plineWithContinuation('An earlier message that leaves little room for another long sentence.');
    const casting = castSpell(SPE_PROTECTION);
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.uspellprot || 0, 0);
        assert.equal(game.u.uac, 10);
    } finally {
        input.feed(' ');
        await casting;
    }
    assert.ok(game.u.uspellprot != null, 'Expected game.u.uspellprot to be initialized');
    assert.ok(game.u.uspellprot > 0);
});

void test('cure blindness clears sticky goop and deafness without restoring HP', async () => {
    caster(SPE_CURE_BLINDNESS, { hero: { blindTurns: 20, ucreamed: 10, deafTurns: 10 } });
    requirePlayingGame(game);
    await castSpell(SPE_CURE_BLINDNESS);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.u.ucreamed, 0);
    assert.equal(game.u.deafTurns, 0);
    assert.equal(game.u.uhp, 100);
});

void test('cure sickness removes slime and its recorded killer without healing wounds', async () => {
    caster(SPE_CURE_SICKNESS, { hero: { slimedTurns: 8, slimed: true, slimeKiller: 'a green slime' } });
    requirePlayingGame(game);
    await castSpell(SPE_CURE_SICKNESS);
    assert.equal(game.u.slimedTurns, 0);
    assert.equal(game.u.slimeKiller, undefined);
    assert.equal(game.u.uhp, 100);
});

void test('confusion magic is spent on a surviving melee contact and confuses its target', async () => {
    const input = caster(SPE_CONFUSE_MONSTER);
    game.flags.verbose = true;
    requirePlayingGame(game);
    await castSpell(SPE_CONFUSE_MONSTER);
    await answerPrompts(flushPendingTopline(), input, [
        { prompt: /Your hands begin to glow red\.--More--/, keys: ' ' },
    ]);
    const charges = game.u.umconf;
    const target = await createMonsterAt('hill giant', 11, 10);
    target.mhp = target.mhpmax = 200;

    await answerPrompts(rhack('l'.charCodeAt(0)), input, [
        { prompt: /You hit the hill giant\.  Your hands stop glowing red\.--More--/, keys: ' ' },
    ]);

    assert.ok(target.mhp < 200);
    assert.equal(target.mconf, 1);
    assert.ok(charges != null, 'Expected charges to be initialized');
    assert.equal(game.u.umconf, charges - 1);
});

void test('an already confused target does not consume another magical touch', async () => {
    const input = caster(SPE_CONFUSE_MONSTER);
    requirePlayingGame(game);
    await castSpell(SPE_CONFUSE_MONSTER);
    await answerPrompts(flushPendingTopline(), input, [
        { prompt: /Your hands begin to glow red\.--More--/, keys: ' ' },
    ]);
    const target = await createMonsterAt('hill giant', 11, 10);
    target.mhp = target.mhpmax = 200;
    target.mconf = 1;
    const charges = game.u.umconf;

    await rhack('l'.charCodeAt(0));

    assert.ok(target.mhp < 200);
    assert.equal(game.u.umconf, charges);
});

void test('a harmless melee contact still spends confusing touch on a shade', async () => {
    const input = caster(SPE_CONFUSE_MONSTER);
    requirePlayingGame(game);
    await castSpell(SPE_CONFUSE_MONSTER);
    await answerPrompts(flushPendingTopline(), input, [
        { prompt: /Your hands begin to glow red\.--More--/, keys: ' ' },
    ]);
    grantIntrinsicProperty('seeInvisible', 'outside');
    const shade = await createMonsterAt('shade', 11, 10);
    shade.mhp = shade.mhpmax = 50;
    const charges = game.u.umconf;

    await answerPrompts(rhack('l'.charCodeAt(0)), input, [
        { prompt: /Your attack passes harmlessly through the shade\.--More--/, keys: ' ' },
    ]);

    assert.equal(shade.mhp, 50);
    assert.ok(charges != null, 'Expected charges to be initialized');
    assert.equal(game.u.umconf, charges - 1);
});

void test('applied polearms carry a confusing touch but thrown weapons do not', async () => {
    const input = caster(SPE_CONFUSE_MONSTER);
    game.flags.verbose = true;
    requirePlayingGame(game);
    await castSpell(SPE_CONFUSE_MONSTER);
    await answerPrompts(flushPendingTopline(), input, [
        { prompt: /Your hands begin to glow red\.--More--/, keys: ' ' },
    ]);
    const polearm = await addInventoryObject(HALBERD);
    await setPrimaryWeapon(polearm);
    const target = await createMonsterAt('hill giant', 12, 10);
    target.mhp = target.mhpmax = 200;
    const charges = game.u.umconf;
    await answerPrompts(hitMonsterWithAppliedWeapon(target, polearm), input, [
        { prompt: /The halberd hits the hill giant\.  Your hands stop glowing red\.--More--/, keys: ' ' },
    ]);
    assert.equal(target.mconf, 1);
    assert.ok(charges != null, 'Expected charges to be initialized');
    assert.equal(game.u.umconf, charges - 1);

    target.mconf = 0;
    const thrown = await knownObject(HALBERD);
    await hitMonsterWithThrownObject(target, thrown);
    assert.equal(game.u.umconf, charges - 1);
    assert.equal(target.mconf, 0);
});

void test('a final-charge death wand backfire rolls a single ordinary damage die', async () => {
    caster(null);
    requirePlayingGame(game);
    const wand = await addInventoryObject(WAN_DEATH, { spe: -1 });
    await backfireWand(wand);
    assert.ok(game.u.uhp >= 94 && game.u.uhp <= 99);
    assert.equal(wand.where, 'gone');
});

void test('life saving finishes a backfire and removes the exploding wand', async () => {
    const input = caster(null, { hero: { uhp: 1 } });
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const wand = await addInventoryObject(WAN_DEATH, { spe: 5 });
    await answerPrompts(backfireWand(wand), input, [
        { prompt: /amulet of life saving \(being worn\)\.--More--/, keys: ' ' },
        { prompt: /wand of death suddenly explodes!--More--/, keys: ' ' },
        { prompt: /You die\.\.\.  But wait\.\.\.  Your medallion begins to glow!--More--/, keys: ' ' },
    ]);
    assert.ok(!game.program_state.gameover);
    assert.ok(game.u.uhp > 0);
    assert.equal(wand.where, 'gone');
    assert.equal(amulet.where, 'gone');
});
