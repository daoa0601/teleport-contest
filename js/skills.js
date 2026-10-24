// skills.js - Hero weapon/fighting/spell skill state and commands.
// C refs: skills.h, u_init.c:skill_init(), weapon.c:doenhance().
import { formatFeltMessage } from './hero_speech.js';
import { OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL, OBJECT_SUBTYPE } from './object_data.js';
import { MAXULEV, PICK_NONE, PICK_ONE, P_BASIC, P_EXPERT, P_FIRST_SPELL, P_ISRESTRICTED, P_LAST_SPELL, P_LAST_WEAPON, P_NONE, P_SKILLED, P_SKILL_LIMIT, P_BARE_HANDED_COMBAT, P_RIDING, P_TWO_WEAPON_COMBAT, P_UNSKILLED, TIP_ENHANCE, } from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { flushPendingTopline, plineWithContinuation } from './display.js';
import { recordObjectKnowledge } from './object_knowledge.js';
import { promptYesNo } from './query.js';
import { showInventoryWindow } from './windows.js';
import { ATR_INVERSE } from './terminal.js';
import { rn2 } from './rng.js';
export const SKILL_NAMES = [
    'no skill',
    'dagger', 'knife', 'axe', 'pick-axe', 'short sword', 'broadsword',
    'long sword', 'two-handed sword', 'saber', 'club', 'mace',
    'morning star', 'flail', 'hammer', 'quarterstaff', 'polearms', 'spear',
    'trident', 'lance', 'bow', 'sling', 'crossbow', 'dart', 'shuriken',
    'boomerang', 'whip', 'unicorn horn',
    'attack spells', 'healing spells', 'divination spells',
    'enchantment spells', 'clerical spells', 'escape spells',
    'matter spells',
    'bare handed combat', 'two weapon combat', 'riding',
];
export const SKILL_GROUPS = [
    { heading: 'Fighting Skills', first: 35, last: 37 },
    { heading: 'Weapon Skills', first: 1, last: 27 },
    { heading: 'Spellcasting Skills', first: 28, last: 34 },
];
export const SKILL_LEVEL_NAMES = [
    'Restricted', 'Unskilled', 'Basic', 'Skilled',
    'Expert', 'Master', 'Grand Master',
];
// u_init.c Skill_A and Skill_K.  Role maximums are distinct from the startup
// inventory snapshot which promotes only weapons already carried to Basic.
const ARCHEOLOGIST_MAXIMUMS = new Map([
    [1, 2], [2, 2], [4, 4], [5, 2], [9, 4], [10, 3], [15, 3], [21, 3],
    [23, 2], [25, 4], [26, 4], [27, 3], [28, 2], [29, 2], [30, 4],
    [34, 2], [37, 2], [36, 2], [35, 4],
]);
const BARBARIAN_MAXIMUMS = new Map([
    [1, 2], [3, 4], [4, 3], [5, 4], [6, 3], [7, 3], [8, 4], [9, 3],
    [10, 3], [11, 3], [12, 3], [13, 2], [14, 4], [15, 2], [17, 3],
    [18, 3], [20, 2], [28, 2], [33, 2], [37, 2], [36, 2], [35, 5],
]);
const CAVEMAN_MAXIMUMS = new Map([
    [1, 2], [2, 3], [3, 3], [4, 2], [10, 4], [11, 4], [12, 2], [13, 3],
    [14, 3], [15, 4], [16, 3], [17, 4], [18, 3], [20, 3], [21, 4],
    [28, 2], [34, 3], [25, 4], [27, 2], [35, 5],
]);
const HEALER_MAXIMUMS = new Map([
    [1, 3], [2, 4], [5, 3], [9, 2], [10, 3], [11, 2], [15, 4], [16, 2],
    [17, 2], [18, 2], [21, 3], [23, 4], [24, 3], [27, 4], [29, 4],
    [35, 2],
]);
const KNIGHT_MAXIMUMS = new Map([
    [1, 2], [2, 2], [3, 3], [4, 2], [5, 3], [6, 3], [7, 4], [8, 3],
    [9, 3], [10, 2], [11, 3], [12, 3], [13, 2], [14, 2], [16, 3],
    [17, 3], [18, 2], [19, 4], [20, 2], [22, 3], [28, 3], [29, 3],
    [32, 3], [37, 4], [36, 3], [35, 4],
]);
const MONK_MAXIMUMS = new Map([
    [15, 2], [17, 2], [22, 2], [24, 2], [28, 2], [29, 4], [30, 2],
    [31, 2], [32, 3], [33, 3], [34, 2], [35, 6],
]);
const PRIEST_MAXIMUMS = new Map([
    [10, 4], [11, 4], [12, 4], [13, 4], [14, 4], [15, 4], [16, 3],
    [17, 3], [18, 3], [19, 2], [20, 2], [21, 2], [22, 2], [23, 2],
    [24, 2], [25, 2], [27, 3], [29, 4], [30, 4], [32, 4], [35, 2],
]);
const RANGER_MAXIMUMS = new Map([
    [1, 4], [2, 3], [3, 3], [4, 2], [5, 2], [12, 2], [13, 3], [14, 2],
    [15, 2], [16, 3], [17, 4], [18, 2], [20, 4], [21, 4], [22, 4],
    [23, 4], [24, 3], [25, 4], [26, 2], [29, 2], [30, 4], [33, 2],
    [37, 2], [35, 2],
]);
const ROGUE_MAXIMUMS = new Map([
    [1, 4], [2, 4], [5, 4], [6, 3], [7, 3], [8, 2], [9, 3], [10, 3],
    [11, 3], [12, 2], [13, 2], [14, 2], [16, 2], [17, 2], [22, 4],
    [23, 4], [24, 3], [30, 3], [33, 3], [34, 3], [37, 2], [36, 4],
    [35, 4],
]);
const SAMURAI_MAXIMUMS = new Map([
    [1, 2], [2, 3], [5, 4], [6, 3], [7, 4], [8, 4], [9, 2], [13, 3],
    [15, 2], [16, 3], [17, 3], [19, 3], [20, 4], [24, 4], [28, 2],
    [30, 2], [32, 3], [37, 3], [36, 4], [35, 5],
]);
const TOURIST_MAXIMUMS = new Map([
    [1, 4], [2, 3], [3, 2], [4, 2], [5, 4], [6, 2], [7, 2], [8, 2],
    [9, 3], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2],
    [17, 2], [18, 2], [19, 2], [20, 2], [21, 2], [22, 2], [23, 4],
    [24, 2], [25, 2], [26, 2], [27, 3], [30, 2], [31, 2], [33, 3],
    [37, 2], [36, 3], [35, 3],
]);
const VALKYRIE_MAXIMUMS = new Map([
    [1, 4], [3, 4], [4, 3], [5, 3], [6, 3], [7, 4], [8, 4], [9, 2],
    [14, 4], [15, 2], [16, 3], [17, 4], [18, 2], [19, 3], [21, 2],
    [28, 2], [33, 2], [37, 3], [36, 3], [35, 4],
]);
const WIZARD_MAXIMUMS = new Map([
    [1, 4], [2, 3], [3, 3], [5, 2], [10, 3], [11, 2], [15, 4],
    [16, 3], [17, 2], [18, 2], [21, 3], [23, 4], [24, 2], [28, 4],
    [29, 3], [30, 4], [31, 3], [32, 3], [33, 4], [34, 4], [37, 2],
    [35, 2],
]);
// weapon.c:skill_init() grants these independently of carried weapons.
const ROLE_STARTING_MAGIC_SKILLS = {
    healer: [29],
    monk: [29],
    priest: [32],
    wizard: [28, 31],
};
export function practiceNeededToAdvance(level) {
    return level * level * 20;
}
function roleMaximums(game) {
    const key = game.urole?.key;
    if (!key)
        return null;
    return {
        archeologist: ARCHEOLOGIST_MAXIMUMS,
        barbarian: BARBARIAN_MAXIMUMS,
        caveman: CAVEMAN_MAXIMUMS,
        healer: HEALER_MAXIMUMS,
        knight: KNIGHT_MAXIMUMS,
        monk: MONK_MAXIMUMS,
        priest: PRIEST_MAXIMUMS,
        ranger: RANGER_MAXIMUMS,
        rogue: ROGUE_MAXIMUMS,
        samurai: SAMURAI_MAXIMUMS,
        tourist: TOURIST_MAXIMUMS,
        valkyrie: VALKYRIE_MAXIMUMS,
        wizard: WIZARD_MAXIMUMS,
    }[key];
}
// Startup precedes skill_init(); admission uses the role's skill list.
export function roleAllowsSpellbook(otyp, state) {
    const skill = OBJECT_SUBTYPE[otyp];
    return skill !== undefined && skill >= P_FIRST_SPELL
        && skill <= P_LAST_SPELL && !!roleMaximums(state)?.has(skill);
}
// Native weapon.c:weapon_hit_bonus().
export function weaponSkillHitBonus(weapon, state = game) {
    const weaponSkill = weaponSkillType(weapon);
    const skill = attackSkillType(weapon, state);
    let bonus = 0;
    if (skill !== P_NONE && skill <= P_LAST_WEAPON) {
        const level = proficiency(skill, state);
        bonus = level <= P_UNSKILLED ? -4 : level === P_BASIC ? 0
            : level === P_SKILLED ? 2 : level === P_EXPERT ? 3 : -4;
    }
    else if (skill === P_TWO_WEAPON_COMBAT) {
        const level = Math.min(proficiency(skill, state), proficiency(weaponSkill, state));
        bonus = level <= P_UNSKILLED ? -9 : level === P_BASIC ? -7
            : level === P_SKILLED ? -5 : level === P_EXPERT ? -3 : -9;
    }
    else if (skill === P_BARE_HANDED_COMBAT) {
        const level = Math.max(proficiency(skill, state), P_UNSKILLED);
        bonus = Math.trunc((level + 1) * (usesMartialArts(state) ? 2 : 1) / 2);
    }
    if (state.u.usteed) {
        const riding = proficiency(P_RIDING, state);
        if (riding <= P_UNSKILLED)
            bonus -= 2;
        else if (riding === P_BASIC)
            bonus--;
        if (state.u.twoweap)
            bonus -= 2;
    }
    return bonus;
}
// weapon.c:weapon_dam_bonus().
export function weaponSkillDamageBonus(weapon, state = game) {
    const weaponSkill = weaponSkillType(weapon);
    const skill = attackSkillType(weapon, state);
    let bonus = 0;
    if (skill !== P_NONE && skill <= P_LAST_WEAPON) {
        const level = proficiency(skill, state);
        bonus = level <= P_UNSKILLED ? -2 : level === P_BASIC ? 0
            : level === P_SKILLED ? 1 : level === P_EXPERT ? 2 : -2;
    }
    else if (skill === P_TWO_WEAPON_COMBAT) {
        const level = Math.min(proficiency(skill, state), proficiency(weaponSkill, state));
        bonus = level <= P_UNSKILLED ? -3 : level === P_BASIC ? -1
            : level === P_SKILLED ? 0 : level === P_EXPERT ? 1 : -3;
    }
    else if (skill === P_BARE_HANDED_COMBAT) {
        const level = Math.max(proficiency(skill, state), P_UNSKILLED);
        bonus = Math.trunc(level * (usesMartialArts(state) ? 3 : 1) / 2);
    }
    if (state.u.usteed && skill !== P_TWO_WEAPON_COMBAT) {
        const riding = proficiency(P_RIDING, state);
        if (riding === P_SKILLED)
            bonus++;
        else if (riding === P_EXPERT)
            bonus += 2;
    }
    return bonus;
}
export function weaponSkillType(weapon) {
    if (!weapon)
        return P_BARE_HANDED_COMBAT;
    if (![2, 6, 13].includes(weapon.oclass))
        return P_NONE;
    const skill = OBJECT_SUBTYPE[weapon.otyp];
    if (skill === undefined)
        throw new RangeError(`Weapon ${weapon.otyp} has no skill type`);
    return Math.abs(skill);
}
function attackSkillType(weapon, state) {
    return state.u.twoweap && weapon !== null
        && (weapon === (state.uwep || state.u.uwep)
            || weapon === (state.uswapwep || state.u.uswapwep))
        ? P_TWO_WEAPON_COMBAT : weaponSkillType(weapon);
}
function proficiency(skill, state) {
    const entry = ensureHeroSkills(state)?.[skill];
    if (!entry)
        throw new Error(`Hero combat requires initialized skill ${skill}`);
    return entry.skill;
}
function usesMartialArts(state) {
    return state.urole?.key === 'monk' || state.urole?.key === 'samurai';
}
// Native weapon.c:use_skill(). Practice can accumulate at a role's ceiling;
// only the transition into eligibility produces advancement feedback.
export async function useHeroSkill(skill, degree = 1, { state = game } = {}) {
    requireLiveGame(state);
    const proficiency = ensureHeroSkills(state)?.[skill];
    if (skill === P_NONE || !proficiency || proficiency.skill === P_ISRESTRICTED)
        return;
    const wasEligible = canAdvanceHeroSkill(skill, { state });
    // Native P_ADVANCE is an unsigned short, including on very long games.
    proficiency.advance = (proficiency.advance + degree) & 0xffff;
    if (!wasEligible && canAdvanceHeroSkill(skill, { state }))
        await giveMayAdvanceMessage(skill, state);
}
export function canAdvanceHeroSkill(skill, { state = game, speedy = false } = {}) {
    const proficiency = ensureHeroSkills(state)?.[skill];
    if (!proficiency || proficiency.skill === P_ISRESTRICTED
        || proficiency.skill >= proficiency.maxSkill
        || (state.u.skillRecord?.length || 0) >= P_SKILL_LIMIT)
        return false;
    if (state.flags.debug && speedy)
        return true;
    return proficiency.advance >= practiceNeededToAdvance(proficiency.skill)
        && (state.u.weapon_slots || 0) >= slotsRequiredToAdvance(skill, proficiency.skill);
}
async function giveMayAdvanceMessage(skill, state) {
    const kind = skill === P_NONE ? '' : skill <= P_LAST_WEAPON ? 'weapon '
        : skill <= P_LAST_SPELL ? 'spell casting ' : 'fighting ';
    await plineWithContinuation(formatFeltMessage(`more confident in your ${kind}skills.`, state));
    const tip = 1 << TIP_ENHANCE;
    if (state.flags.tips !== false && !((state.context.tips ?? 0) & tip)) {
        state.context.tips = (state.context.tips || 0) | tip;
        await plineWithContinuation('(Tip: use the #enhance command to advance them.)');
    }
}
export function ensureHeroSkills(game) {
    if (game.u.weaponSkills)
        return game.u.weaponSkills;
    const maximums = roleMaximums(game);
    if (!maximums)
        return null;
    const skills = Array.from({ length: SKILL_NAMES.length }, () => ({
        skill: 0, maxSkill: 0, advance: 0,
    }));
    for (const [skill, maxSkill] of maximums) {
        const proficiency = requiredSkill(skills, skill);
        proficiency.skill = 1;
        proficiency.maxSkill = maxSkill;
    }
    const startingMagic = game.urole ? ROLE_STARTING_MAGIC_SKILLS[game.urole.key] ?? [] : [];
    for (const skill of startingMagic) {
        const proficiency = requiredSkill(skills, skill);
        proficiency.skill = Math.max(proficiency.skill, 2);
    }
    // skill_init() observes the startup inventory once.  weapon_type()
    // accepts weapons, weapon-tools, and gems, then normalizes negative
    // missile skills; is_ammo() excludes only launcher ammunition
    // (bow/sling/crossbow), not darts, shuriken, or boomerangs.
    for (const item of game.inventory || []) {
        if (!item._startingInventory)
            continue;
        if (![2, 6, 13].includes(item.oclass))
            continue;
        const subtype = OBJECT_SUBTYPE[item.otyp];
        if (subtype === undefined || !Number.isInteger(subtype) || subtype === 0)
            continue;
        const skill = Math.abs(subtype);
        if (subtype < 0 && skill >= 20 && skill <= 22)
            continue;
        const proficiency = skills[skill];
        if (!proficiency?.maxSkill)
            continue;
        proficiency.skill = Math.max(proficiency.skill, 2);
    }
    // High-potential fighters begin Basic in unarmed/martial combat.
    const unarmed = requiredSkill(skills, 35);
    if (unarmed.maxSkill > 4)
        unarmed.skill = 2;
    // Knight's starting pony grants Basic riding.
    const riding = requiredSkill(skills, 37);
    if (game.urole?.key === 'knight' && riding.maxSkill)
        riding.skill = 2;
    // u_init.c:pauper_reinit() removes every initially Basic-or-better
    // proficiency while retaining the role's advancement ceiling.
    if (game.u?.uroleplay?.pauper) {
        for (const state of skills) {
            if (state.skill > 1) {
                state.skill = 1;
                state.advance = 0;
            }
        }
        game.u.weapon_slots = 2;
    }
    for (const state of skills.slice(1)) {
        if (!state.skill)
            continue;
        state.advance = practiceNeededToAdvance(state.skill - 1);
    }
    game.u.weaponSkills = skills;
    game.u.skillRecord = [];
    if (!game.u.uroleplay?.pauper)
        identifySpellbooksForSkills(game);
    return skills;
}
function requiredSkill(skills, skill) {
    const proficiency = skills[skill];
    if (!proficiency)
        throw new RangeError(`Hero skill ${skill} is missing`);
    return proficiency;
}
function initializedSkills(state) {
    const skills = ensureHeroSkills(state);
    if (!skills)
        throw new Error('Hero skills require an initialized role');
    return skills;
}
function slotsRequiredToAdvance(skill, level) {
    if (skill <= 27 || skill === 36)
        return level;
    return Math.trunc((level + 1) / 2);
}
export async function adjustWeaponSkillSlots(change, state = game) {
    const hero = state.u;
    if (!hero || !Number.isInteger(change) || change === 0)
        return;
    if (hero.weapon_slots === undefined || !Number.isInteger(hero.weapon_slots))
        hero.weapon_slots = 0;
    if (change > 0) {
        const skills = initializedSkills(state);
        const available = () => skills.filter((_proficiency, skill) => canAdvanceHeroSkill(skill, { state })).length;
        const before = available();
        hero.weapon_slots += change;
        if (available() > before)
            await giveMayAdvanceMessage(P_NONE, state);
        return;
    }
    const skills = ensureHeroSkills(state);
    const record = hero.skillRecord || (hero.skillRecord = []);
    for (let remaining = -change; remaining > 0; remaining--) {
        if (hero.weapon_slots > 0) {
            hero.weapon_slots--;
            continue;
        }
        const skill = record.pop();
        if (skill === undefined)
            continue;
        const skillState = skills?.[skill];
        if (!skillState || skillState.skill <= 1)
            continue;
        skillState.skill--;
        hero.weapon_slots = slotsRequiredToAdvance(skill, skillState.skill) - 1;
    }
}
// C weapon.c:drain_weapon_skill(). Refunded slots can train another skill.
export async function drainHeroWeaponSkills(count, state = game) {
    const skills = initializedSkills(state);
    const record = state.u.skillRecord ||= [];
    const forgotten = new Set();
    for (let remaining = count; remaining > 0 && record.length; remaining--) {
        const [skill] = record.splice(rn2(record.length), 1);
        if (skill === undefined)
            throw new Error('The drained skill record is missing');
        const proficiency = requiredSkill(skills, skill);
        if (proficiency.skill <= 1)
            throw new Error(`Cannot drain unadvanced skill ${skill}`);
        proficiency.skill--;
        state.u.weapon_slots = (state.u.weapon_slots || 0)
            + slotsRequiredToAdvance(skill, proficiency.skill);
        const current = practiceNeededToAdvance(proficiency.skill);
        const previous = practiceNeededToAdvance(proficiency.skill - 1);
        if (proficiency.advance >= current)
            proficiency.advance = previous + rn2(current - previous);
        forgotten.add(skill);
    }
    for (const skill of [...forgotten].sort((left, right) => left - right)) {
        const amount = requiredSkill(skills, skill).skill >= P_BASIC ? 'some of ' : '';
        await plineWithContinuation(`You forget ${amount}your training in ${skillName(skill, state)}.`);
    }
}
export function unrestrictHeroSkill(type, state = game) {
    const skill = ensureHeroSkills(state)?.[type];
    if (skill && skill.skill === 0) {
        skill.skill = 1;
        skill.maxSkill = 2;
        skill.advance = 0;
    }
}
// Native skill_advance(), reached only through a selectable #enhance entry.
export async function advanceHeroSkill(state, skill, { speedy = false } = {}) {
    requireLiveGame(state);
    if (!canAdvanceHeroSkill(skill, { state, speedy }))
        return null;
    const proficiency = requiredSkill(initializedSkills(state), skill);
    state.u.weapon_slots = (state.u.weapon_slots || 0)
        - slotsRequiredToAdvance(skill, proficiency.skill);
    proficiency.skill++;
    (state.u.skillRecord ||= []).push(skill);
    const degree = proficiency.skill >= proficiency.maxSkill ? 'most' : 'more';
    await plineWithContinuation(`You are now ${degree} skilled in ${skillName(skill, state)}.`);
    if (skill >= P_FIRST_SPELL && skill <= P_LAST_SPELL)
        identifySpellbooksForSkills(state);
    return proficiency;
}
export function skillName(skill, state = game) {
    if (skill === 35
        && (state.urole?.key === 'monk' || state.urole?.key === 'samurai')) {
        return 'martial arts';
    }
    const name = SKILL_NAMES[skill];
    if (name === undefined)
        throw new RangeError(`Hero skill ${skill} has no name`);
    return name;
}
export async function doenhance() {
    game.context.tips = (game.context.tips || 0) | (1 << TIP_ENHANCE);
    let speedy = false;
    if (game.flags.debug) {
        await flushPendingTopline();
        speedy = await promptYesNo('Advance skills without practice?') === 'y';
    }
    game.context.move = 0;
    for (;;) {
        const { items, available } = enhancementMenu(speedy, game);
        let title = available ? 'Pick a skill to advance:' : 'Current skills:';
        if (game.flags.debug && !speedy) {
            const slots = game.u.weapon_slots || 0;
            title += `  (${slots} slot${slots === 1 ? '' : 's'} available)`;
        }
        const selection = await showInventoryWindow([{ items }], {
            title, pickMode: available ? PICK_ONE : PICK_NONE,
        });
        if (selection.value === undefined)
            return;
        await advanceHeroSkill(game, selection.value, { speedy });
        const more = initializedSkills(game).some((_proficiency, skill) => canAdvanceHeroSkill(skill, { speedy }));
        if (!more)
            return;
        if (!speedy) {
            await plineWithContinuation(formatFeltMessage('you could be more dangerous!'));
            return;
        }
    }
}
function enhancementMenu(speedy, state) {
    const skills = initializedSkills(state);
    const available = skills.filter((_proficiency, skill) => canAdvanceHeroSkill(skill, { state, speedy })).length;
    const waiting = skills.filter((_proficiency, skill) => !canAdvanceHeroSkill(skill, { state, speedy }) && couldAdvanceSkill(skill, state)).length;
    const peaked = skills.filter((_proficiency, skill) => !canAdvanceHeroSkill(skill, { state, speedy }) && !couldAdvanceSkill(skill, state)
        && skillHasPeaked(skill, state)).length;
    const marked = available + waiting + peaked > 0;
    const items = [];
    if (waiting) {
        const heroLevel = state.u.ulevel;
        if (heroLevel === undefined)
            throw new Error('Skill advancement requires the hero experience level');
        const when = heroLevel < MAXULEV ? "when you're more experienced"
            : 'if skill slots become available';
        items.push({ text: `(Skill${waiting === 1 ? '' : 's'} flagged by "*" may be enhanced ${when}.)` });
    }
    if (peaked)
        items.push({ text: `(Skill${peaked === 1 ? '' : 's'} flagged by "#" cannot be enhanced any further.)` });
    if (waiting || peaked)
        items.push({ text: '' });
    const longest = Math.max(...skills.map((proficiency, skill) => proficiency.skill ? skillName(skill, state).length : 0));
    for (const group of SKILL_GROUPS) {
        items.push({ text: group.heading, attr: ATR_INVERSE });
        for (let skill = group.first; skill <= group.last; skill++) {
            const proficiency = requiredSkill(skills, skill);
            if (proficiency.skill === P_ISRESTRICTED)
                continue;
            const selectable = canAdvanceHeroSkill(skill, { state, speedy });
            const prefix = !marked || selectable ? '' : couldAdvanceSkill(skill, state) ? '  * '
                : skillHasPeaked(skill, state) ? '  # ' : '    ';
            const name = skillName(skill, state);
            const level = SKILL_LEVEL_NAMES[proficiency.skill];
            if (level === undefined)
                throw new RangeError(`Unknown proficiency level ${proficiency.skill}`);
            let text;
            if (state.flags.debug) {
                const practice = `${String(proficiency.advance).padStart(5)}(${String(practiceNeededToAdvance(proficiency.skill)).padStart(4)})`;
                text = state.iflags.menu_tab_sep ? ` ${prefix}${name}\t${level}\t${practice}`
                    : ` ${prefix}${name.padEnd(longest)} ${level.padEnd(12)} ${practice}`;
            }
            else {
                text = state.iflags.menu_tab_sep ? ` ${prefix}${name}\t[${level}]`
                    : ` ${prefix} ${name.padEnd(longest)} [${level}]`;
            }
            items.push(selectable ? { text, value: skill } : { text });
        }
    }
    return { items, available };
}
function couldAdvanceSkill(skill, state) {
    const proficiency = state.u.weaponSkills?.[skill];
    return !!proficiency && proficiency.skill !== P_ISRESTRICTED && proficiency.skill < proficiency.maxSkill
        && (state.u.skillRecord?.length || 0) < P_SKILL_LIMIT
        && proficiency.advance >= practiceNeededToAdvance(proficiency.skill);
}
function skillHasPeaked(skill, state) {
    const proficiency = state.u.weaponSkills?.[skill];
    return !!proficiency && proficiency.skill !== P_ISRESTRICTED && proficiency.skill >= proficiency.maxSkill
        && proficiency.advance >= practiceNeededToAdvance(proficiency.skill);
}
// Native spell.c:skill_based_spellbook_id() grants knowledge without an
// encounter or Wisdom exercise, and reevaluates every school after a gain.
function identifySpellbooksForSkills(state) {
    if (state.urole?.key !== 'wizard')
        return;
    const skills = initializedSkills(state);
    for (let type = 0; type < OBJECT_SPELL_CATEGORY.length; type++) {
        if (!OBJECT_SPELL_CATEGORY[type])
            continue;
        const category = OBJECT_SUBTYPE[type];
        const spellLevel = OBJECT_SPELL_LEVEL[type];
        if (category === undefined || spellLevel === undefined)
            throw new Error(`Spellbook ${type} has incomplete skill data`);
        const skill = requiredSkill(skills, category).skill;
        const level = skill >= P_EXPERT ? 7 : skill === P_SKILLED ? 5
            : skill === P_BASIC ? 3 : state.u.uroleplay?.pauper ? 0 : 1;
        if (spellLevel <= level)
            recordObjectKnowledge(type, state);
    }
}
//# sourceMappingURL=skills.js.map