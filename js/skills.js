// skills.js — Hero weapon/fighting/spell skill state.
// C refs: skills.h, u_init.c:skill_init(), weapon.c:add_skills_to_menu().

import { OBJECT_SUBTYPE } from './object_data.js';

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
    }[game.urole?.key] || null;
}

function currentWeaponSkill(game, skill) {
    if (!Number.isInteger(skill) || skill <= 0) return null;
    const state = ensureHeroSkills(game)?.[skill];
    return state?.skill ?? null;
}

function effectiveWeaponSkill(game, skill) {
    const weaponSkill = currentWeaponSkill(game, skill);
    if (weaponSkill === null) return null;
    if (!game.u?.twoweap && !game.twoweap) return weaponSkill;
    const twoWeaponSkill = currentWeaponSkill(game, 36);
    return Math.min(weaponSkill, twoWeaponSkill ?? 0);
}

// weapon.c:weapon_hit_bonus().  Returning zero for roles whose complete skill
// table has not been ported keeps the owner explicit instead of treating an
// unknown role as source-confirmed Basic.
export function weaponSkillHitBonus(game, skill) {
    const level = effectiveWeaponSkill(game, skill);
    if (level === null) return 0;
    if (game.u?.twoweap || game.twoweap) {
        if (level <= 1) return -9;
        if (level === 2) return -7;
        if (level === 3) return -5;
        return -3;
    }
    if (level <= 1) return -4;
    if (level === 2) return 0;
    if (level === 3) return 2;
    return 3;
}

// weapon.c:weapon_dam_bonus().
export function weaponSkillDamageBonus(game, skill) {
    const level = effectiveWeaponSkill(game, skill);
    if (level === null) return 0;
    if (game.u?.twoweap || game.twoweap) {
        if (level <= 1) return -3;
        if (level === 2) return -1;
        if (level === 3) return 0;
        return 1;
    }
    if (level <= 1) return -2;
    if (level === 2) return 0;
    if (level === 3) return 1;
    return 2;
}

export function recordWeaponPractice(game, skill, degree = 1) {
    if (!Number.isInteger(skill) || skill <= 0) return;
    if (!game.u._weaponPracticeBySkill)
        game.u._weaponPracticeBySkill = Object.create(null);
    game.u._weaponPracticeBySkill[skill] =
        (game.u._weaponPracticeBySkill[skill] || 0) + degree;
    const state = game.u.weaponSkills?.[skill];
    if (state && state.skill > 0) state.advance += degree;
}

export function ensureHeroSkills(game) {
    if (game.u.weaponSkills) return game.u.weaponSkills;
    const maximums = roleMaximums(game);
    if (!maximums) return null;

    const skills = Array.from({ length: SKILL_NAMES.length }, () => ({
        skill: 0, maxSkill: 0, advance: 0,
    }));
    for (const [skill, maxSkill] of maximums) {
        skills[skill].skill = 1;
        skills[skill].maxSkill = maxSkill;
    }

    for (const skill of ROLE_STARTING_MAGIC_SKILLS[game.urole?.key] || [])
        skills[skill].skill = Math.max(skills[skill].skill, 2);

    // skill_init() observes the startup inventory once.  weapon_type()
    // accepts weapons, weapon-tools, and gems, then normalizes negative
    // missile skills; is_ammo() excludes only launcher ammunition
    // (bow/sling/crossbow), not darts, shuriken, or boomerangs.
    for (const item of game.inventory || []) {
        if (!item._startingInventory) continue;
        if (![2, 6, 13].includes(item.oclass)) continue;
        const subtype = OBJECT_SUBTYPE[item.otyp];
        if (!Number.isInteger(subtype) || subtype === 0) continue;
        const skill = Math.abs(subtype);
        if (subtype < 0 && skill >= 20 && skill <= 22) continue;
        if (!skills[skill]?.maxSkill) continue;
        skills[skill].skill = Math.max(skills[skill].skill, 2);
    }
    // High-potential fighters begin Basic in unarmed/martial combat.
    if (skills[35].maxSkill > 4)
        skills[35].skill = 2;
    // Knight's starting pony grants Basic riding.
    if (game.urole?.key === 'knight' && skills[37].maxSkill)
        skills[37].skill = 2;

    for (let skill = 1; skill < skills.length; skill++) {
        const state = skills[skill];
        if (!state.skill) continue;
        state.advance = practiceNeededToAdvance(state.skill - 1)
            + (game.u._weaponPracticeBySkill?.[skill] || 0);
    }
    game.u.weaponSkills = skills;
    game.u.skillRecord = [];
    return skills;
}

export function advanceHeroSkill(game, skill) {
    const state = ensureHeroSkills(game)?.[skill];
    if (!state || state.skill <= 0 || state.skill >= state.maxSkill)
        return null;
    state.skill++;
    game.u.skillRecord.push(skill);
    return state;
}
