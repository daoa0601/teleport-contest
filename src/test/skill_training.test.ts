import type { RoleKey } from '../js/roles.js';
import { requireScreenRow } from './support/screen.js';
import type { InputGate } from '../js/input.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    P_ATTACK_SPELL, P_BARE_HANDED_COMBAT, P_BASIC, P_DAGGER, P_HEALING_SPELL,
    P_NONE, P_RIDING, P_SKILLED, P_SKILL_LIMIT, TIP_ENHANCE,
} from '../js/const.js';
import { flushPendingTopline, pline } from '../js/display.js';
import { gainExperienceLevel } from '../js/exper.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, SPE_FIREBALL, SPE_FINGER_OF_DEATH, SPE_FORCE_BOLT } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import {
    adjustWeaponSkillSlots, advanceHeroSkill, canAdvanceHeroSkill, doenhance,
    ensureHeroSkills, practiceNeededToAdvance, useHeroSkill, weaponSkillHitBonus,
} from '../js/skills.js';
import { castSpell, forceLearnSpell } from '../js/spell.js';
import { moveSteedWithHero } from '../js/steed.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshCasterRoom } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { ATR_INVERSE, ATR_NONE } from '../js/terminal.js';

function freshSkills(role: RoleKey = 'wizard', { tips = false, debug = false } = {}) {
    freshObjectRoom({ role, flags: { tips, debug } });
    requirePlayingGame(game);
    const skills = ensureHeroSkills(game);
    assert.ok(skills);
    return skills;
}

function menuText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

async function answer(input: InputGate, key: string) {
    input.feed(key);
    await input.waitUntilBlocked();
}

async function dismissFeedback(input: InputGate) {
    input.feed(' ');
    await flushPendingTopline();
}

void test('practice first becomes advanceable at its threshold and does not repeat its notice', async () => {
    const skills = freshSkills();
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(1);
    await useHeroSkill(P_DAGGER, 19);
    assert.equal(canAdvanceHeroSkill(P_DAGGER), false);
    assert.equal(game._pending_message || '', '');

    await useHeroSkill(P_DAGGER);
    assert.ok(skills != null, 'Expected skills to be initialized');
    assert.ok(skills[P_DAGGER] != null);
    assert.equal(skills[P_DAGGER].advance, 20);
    assert.equal(canAdvanceHeroSkill(P_DAGGER), true);
    assert.equal(game._pending_message, 'You feel more confident in your weapon skills.');
    const input = resetInputState();
    await dismissFeedback(input);
    await useHeroSkill(P_DAGGER, 3);

    assert.equal(skills[P_DAGGER].advance, 23);
    assert.equal(game._pending_message || '', '');
});

void test('restricted and no-skill actions do not train or display confidence', async () => {
    const skills = freshSkills('caveman');
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(10);

    await useHeroSkill(P_HEALING_SPELL, 100);
    await useHeroSkill(P_NONE, 100);

    assert.ok(skills != null, 'Expected skills to be initialized');
    assert.ok(skills[P_HEALING_SPELL] != null);
    assert.equal(skills[P_HEALING_SPELL].advance, 0);
    assert.ok(skills[P_NONE] != null);
    assert.equal(skills[P_NONE].advance, 0);
    assert.equal(game._pending_message || '', '');
});

void test('enough practice without a skill slot remains ineligible and gives no confidence notice', async () => {
    freshSkills();
    requirePlayingGame(game);

    await useHeroSkill(P_DAGGER, 40);

    assert.equal(canAdvanceHeroSkill(P_DAGGER), false);
    assert.equal(await advanceHeroSkill(game, P_DAGGER), null);
    assert.ok(game.u.weaponSkills != null, 'Expected game.u.weaponSkills to be initialized');
    assert.ok(game.u.weaponSkills[P_DAGGER] != null);
    assert.equal(game.u.weaponSkills[P_DAGGER].skill, 1);
    assert.equal(game._pending_message || '', '');
});

void test('gaining a level unlocks already-practiced skills and announces the shared eligibility change', async () => {
    freshSkills();
    requirePlayingGame(game);
    await useHeroSkill(P_ATTACK_SPELL, 60);
    const level = game.u.ulevel;
    const input = resetInputState();
    const gaining = gainExperienceLevel();
    await input.waitUntilBlocked();
    assert.match(menuText(), /Welcome to experience level.*--More--/);
    assert.equal(canAdvanceHeroSkill(P_ATTACK_SPELL), true);
    input.feed(' ');
    await gaining;

    assert.equal(game.u.ulevel, level + 1);
    assert.equal(game.u.weapon_slots, 1);
    assert.equal(game._pending_message, 'You feel more confident in your skills.');
    await dismissFeedback(input);
    await adjustWeaponSkillSlots(1);
    assert.equal(game._pending_message || '', '', 'an extra slot must not repeat existing eligibility');
});

void test('a Basic weapon needs two slots for advancement and practice uses its native unsigned range', async () => {
    freshSkills();
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(2);
    await useHeroSkill(P_DAGGER, 20);
    const input = resetInputState();
    await dismissFeedback(input);
    await advanceHeroSkill(game, P_DAGGER);
    await dismissFeedback(input);
    await useHeroSkill(P_DAGGER, 60);
    assert.equal(canAdvanceHeroSkill(P_DAGGER), false);
    await adjustWeaponSkillSlots(1);
    assert.equal(canAdvanceHeroSkill(P_DAGGER), true);
    await dismissFeedback(input);
    await useHeroSkill(P_DAGGER, 65536 - 80);

    assert.ok(game.u.weaponSkills != null, 'Expected game.u.weaponSkills to be initialized');
    assert.ok(game.u.weaponSkills[P_DAGGER] != null);
    assert.equal(game.u.weaponSkills[P_DAGGER].advance, 0);
    assert.equal(canAdvanceHeroSkill(P_DAGGER), false);
});

void test('the first confidence tip waits for acknowledgment and is shown only once', async () => {
    freshSkills('wizard', { tips: true });
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(2);
    const input = resetInputState();
    const training = useHeroSkill(P_DAGGER, 20);
    await input.waitUntilBlocked();
    assert.match(menuText(), /confident in your weapon skills\.--More--/);
    assert.equal(canAdvanceHeroSkill(P_DAGGER), true, 'practice is committed before the pager');
    input.feed(' ');
    await training;
    assert.ok(game.context.tips != null, 'Expected game.context.tips to be initialized');
    assert.equal(game.context.tips & (1 << TIP_ENHANCE), 1 << TIP_ENHANCE);
    assert.match(game._pending_message, /Tip: use the #enhance command/);
    await dismissFeedback(input);

    await useHeroSkill(P_ATTACK_SPELL, 60);

    assert.equal(game._pending_message, 'You feel more confident in your spell casting skills.');
});

void test('practice feedback preserves unread combat prose before displaying the training message', async () => {
    freshSkills();
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(1);
    await pline('The goblin staggers and barely manages to keep its footing.');
    const input = resetInputState();
    const training = useHeroSkill(P_DAGGER, 20);
    await input.waitUntilBlocked();
    assert.match(menuText(), /goblin staggers.*--More--/);
    input.feed(' ');
    await training;

    assert.equal(game._pending_message, 'You feel more confident in your weapon skills.');
});

void test('ordinary enhancement trains the selected skill, spends slots, and changes combat ability', async () => {
    freshSkills();
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(2);
    await useHeroSkill(P_DAGGER, 20);
    const input = resetInputState();
    await dismissFeedback(input);
    const dagger = await knownObject(DAGGER);
    const before = weaponSkillHitBonus(dagger);
    const enhancing = doenhance();
    await input.waitUntilBlocked();
    assert.match(menuText(), /Pick a skill to advance:/);
    const title = requireScreenRow(0);
    assert.ok(title != null, 'Expected title to be initialized');
    const titleColumn = title.map(cell => cell.ch).join('').indexOf('Pick a skill to advance:');
    assert.ok(title[titleColumn] != null);
    assert.equal(title[titleColumn].attr, ATR_INVERSE);
    const row = menuText().split('\n').find(line => /[-] +dagger +\[Unskilled\]/.test(line));
    assert.ok(row, 'the practiced dagger must be selectable');
    const daggerCells = requireGameDisplay().grid.find(cells => cells.map(cell => cell.ch).join('') === row);
    assert.ok(daggerCells != null, 'Expected daggerCells to be initialized');
    assert.equal(daggerCells[row.indexOf('dagger')]?.attr, ATR_NONE);
    input.feed(row.trim().charAt(0));
    await enhancing;

    assert.ok(game.u.weaponSkills != null, 'Expected game.u.weaponSkills to be initialized');
    assert.ok(game.u.weaponSkills[P_DAGGER] != null);
    assert.equal(game.u.weaponSkills[P_DAGGER].skill, P_BASIC);
    assert.equal(game.u.weapon_slots, 1);
    assert.equal(game.u.skillRecord[0], P_DAGGER);
    assert.ok(weaponSkillHitBonus(dagger) > before);
    assert.match(game._pending_message, /now more skilled in dagger/);
    assert.equal(game.context.move, 0);
});

void test('Basic spells and martial skills require fewer slots than Basic weapons', async () => {
    const skills = freshSkills('monk');
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(1);
    assert.ok(skills != null, 'Expected skills to be initialized');
    assert.ok(skills[P_BARE_HANDED_COMBAT] != null);
    await useHeroSkill(P_BARE_HANDED_COMBAT,
        practiceNeededToAdvance(P_BASIC) - skills[P_BARE_HANDED_COMBAT].advance);
    assert.equal(canAdvanceHeroSkill(P_BARE_HANDED_COMBAT), true);
    const input = resetInputState();
    await dismissFeedback(input);
    await advanceHeroSkill(game, P_BARE_HANDED_COMBAT);

    assert.equal(skills[P_BARE_HANDED_COMBAT].skill, P_SKILLED);
    assert.equal(game.u.weapon_slots, 0);
    assert.match(game._pending_message, /more skilled in martial arts/);
});

void test('practice at a role maximum continues accumulating without offering advancement', async () => {
    const skills = freshSkills('caveman');
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(3);
    await useHeroSkill(P_DAGGER, 20);
    const input = resetInputState();
    await dismissFeedback(input);
    await advanceHeroSkill(game, P_DAGGER);
    assert.match(game._pending_message, /now most skilled in dagger/);
    await dismissFeedback(input);

    await useHeroSkill(P_DAGGER, 60);

    assert.ok(skills != null, 'Expected skills to be initialized');
    assert.ok(skills[P_DAGGER] != null);
    assert.equal(skills[P_DAGGER].advance, 80);
    assert.equal(canAdvanceHeroSkill(P_DAGGER), false);
    assert.equal(game._pending_message || '', '');
});

void test('the advancement limit blocks ordinary and Wizard speedy advancement', async () => {
    freshSkills('wizard', { debug: true });
    requirePlayingGame(game);
    game.u.skillRecord = Array.from({ length: P_SKILL_LIMIT }, () => P_DAGGER);
    await adjustWeaponSkillSlots(100);

    await useHeroSkill(P_ATTACK_SPELL, 100);

    assert.equal(canAdvanceHeroSkill(P_ATTACK_SPELL), false);
    assert.equal(canAdvanceHeroSkill(P_ATTACK_SPELL, { speedy: true }), false);
    assert.equal(await advanceHeroSkill(game, P_ATTACK_SPELL, { speedy: true }), null);
    assert.equal(game._pending_message || '', '');
});

void test('waiting and maxed skills are annotated without becoming selectable', async () => {
    freshSkills('caveman');
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(1);
    await useHeroSkill(P_DAGGER, 20);
    const input = resetInputState();
    await dismissFeedback(input);
    await advanceHeroSkill(game, P_DAGGER);
    await dismissFeedback(input);
    await useHeroSkill(P_DAGGER, 60);
    await useHeroSkill(P_BARE_HANDED_COMBAT, 60);
    const enhancing = doenhance();
    await input.waitUntilBlocked();
    assert.match(menuText(), /flagged by "\*"/);
    assert.match(menuText(), /flagged by "#"/);
    assert.match(menuText(), /\* +bare handed combat/);
    assert.match(menuText(), /# +dagger/);
    await answer(input, 'a');
    assert.match(menuText(), /Current skills:/);
    assert.equal(requireScreenRow(0).find(cell => cell.ch !== ' ')?.attr, ATR_INVERSE);
    input.feed('\x1b');
    await enhancing;

    assert.ok(game.u.weaponSkills != null, 'Expected game.u.weaponSkills to be initialized');
    assert.ok(game.u.weaponSkills[P_BARE_HANDED_COMBAT] != null);
    assert.equal(game.u.weaponSkills[P_BARE_HANDED_COMBAT].skill, P_BASIC);
});

void test('Wizard speedy enhancement is available to every role and still debits slots', async () => {
    freshSkills('caveman', { debug: true });
    requirePlayingGame(game);
    const input = resetInputState();
    const enhancing = doenhance();
    await input.waitUntilBlocked();
    assert.match(menuText(), /Advance skills without practice/);
    await answer(input, 'y');
    const row = menuText().split('\n').find(line => /[-] +bare handed combat/.test(line));
    assert.ok(row);
    await answer(input, row.trim().charAt(0));
    assert.match(menuText(), /now more skilled in bare handed combat\.--More--/);
    await answer(input, ' ');
    assert.match(menuText(), /Pick a skill to advance:/);
    input.feed('\x1b');
    await enhancing;

    assert.ok(game.u.weaponSkills != null, 'Expected game.u.weaponSkills to be initialized');
    assert.ok(game.u.weaponSkills[P_BARE_HANDED_COMBAT] != null);
    assert.equal(game.u.weaponSkills[P_BARE_HANDED_COMBAT].skill, P_SKILLED);
    assert.equal(game.u.weapon_slots, -1);
});

void test('advancing a Wizard school identifies its books without encountering them or exercising Wisdom', async () => {
    freshSkills();
    requirePlayingGame(game);
    await adjustWeaponSkillSlots(1);
    await useHeroSkill(P_ATTACK_SPELL, 60);
    const input = resetInputState();
    await dismissFeedback(input);

    await advanceHeroSkill(game, P_ATTACK_SPELL);

    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.ok(game._knownObjectTypes?.has(SPE_FIREBALL));
    assert.ok(!game._knownObjectTypes?.has(SPE_FINGER_OF_DEATH));
    assert.ok(!game._encounteredObjectTypes?.has(SPE_FIREBALL));
    assert.equal(game.u._exercise?.[2] || 0, 0);
});

void test('successful casting trains its real school until #enhance becomes available', async () => {
    freshCasterRoom();
    requirePlayingGame(game);
    game.flags.tips = false;
    forceLearnSpell(SPE_FORCE_BOLT);
    const skills = ensureHeroSkills(game);
    await adjustWeaponSkillSlots(1);
    await useHeroSkill(P_ATTACK_SPELL, 59);
    assert.equal(canAdvanceHeroSkill(P_ATTACK_SPELL), false);
    const input = resetInputState();
    input.feed('< ');

    await castSpell(SPE_FORCE_BOLT);

    assert.ok(skills != null, 'Expected skills to be initialized');
    assert.ok(skills[P_ATTACK_SPELL] != null);
    assert.equal(skills[P_ATTACK_SPELL].advance, 80);
    assert.equal(canAdvanceHeroSkill(P_ATTACK_SPELL), true);
    assert.match(game._pending_message, /confident in your spell casting skills/);
});

void test('a hundred mounted moves grants real riding practice and its eligibility notice', async () => {
    const skills = freshSkills('knight');
    requirePlayingGame(game);
    game.u.usteed = await createSaddledSteed();
    await adjustWeaponSkillSlots(1);
    await useHeroSkill(P_RIDING, 59);
    for (let move = 0; move < 99; move++) await moveSteedWithHero();
    assert.ok(skills != null, 'Expected skills to be initialized');
    assert.ok(skills[P_RIDING] != null);
    assert.equal(skills[P_RIDING].advance, 79);

    await moveSteedWithHero();

    assert.equal(skills[P_RIDING].advance, 80);
    assert.equal(game.u.urideturns, 0);
    assert.equal(canAdvanceHeroSkill(P_RIDING), true);
    assert.match(game._pending_message, /confident in your fighting skills/);
});
