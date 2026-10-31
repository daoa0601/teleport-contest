// Monster creation: species selection, birth, and starting inventory.
// C ref: makemon.c — mkclass, rndmonst, peace_minded, makemon, m_initweap,
// m_initinv, set_mimic_sym, create_critters.
import { armorBonus } from './armor.js';
import { artifactByName, nameArtifact } from './artifacts.js';
import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE, Align2amask, BLCORNER, COLNO, CROSSWALL, DELPHI, GP_AVOID_MONPOS, GP_CHECKSCARY, G_GENOD, G_GONE, G_NOCORPSE, HWALL, IS_DOOR, IS_WALL, In_V_tower, In_endgame, In_hell, In_mines, In_quest, In_sokoban, Is_airlevel, Is_astralevel, Is_earthlevel, Is_firelevel, Is_knox_level, Is_rogue_level, Is_stronghold, Is_waterlevel, MM_ADJACENTOK, MM_ANGRY, MM_ASLEEP, MM_EMIN, MM_EPRI, MM_FEMALE, MM_IGNOREWATER, MM_MALE, MM_MINVIS, MM_NOCOUNTBIRTH, MM_NOGRP, MM_NONAME, MM_NOTAIL, MM_NOWAIT, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, M_AP_TYPE, NO_MINVENT, ROOMOFFSET, ROWNO, SCORR, SDOOR, SHOPBASE, STRAT_APPEARMSG, STRAT_CLOSE, STRAT_WAITFORU, TDWALL, TEMPLE, TLCORNER, TRWALL, TUWALL, VAULT, ZOO, isok, } from './const.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster, canSenseMonster, newsym } from './display.js';
import { level_difficulty, specialLevelAt } from './dungeon.js';
import { hatchableEggSpecies } from './egg_species.js';
import { game, requireGameLevel } from './gstate.js';
import { depth as depth_of_level } from './hacklib.js';
import { nextIdent } from './ident.js';
import { beginObjectBurn } from './light.js';
import { mkobj, mkobj_at, mksobj, rndmonnum, set_corpsenm } from './mkobj.js';
import { occupied } from './mkroom.js';
import { monsterAlignmentType, setMonsterMalign } from './monster_alignment.js';
import { finishMonsterBirth } from './monster_birth.js';
import { allocateMonsterBirthExtensions } from './monster_birth_extensions.js';
import { MONSTER_ALIGNMENT, MONSTER_CLASS_SYMBOLS, MONSTER_COLOR, MONSTER_DIFFICULTY, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_HAS_WEAPON_ATTACK, MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SOUND, MONSTER_SYMBOL, SPECIAL_PM, monsterClassSymbol, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsWhirly, requireMonsterData, } from './monster_data.js';
import { randomGhostName, setMonsterGivenName } from './monster_given_name.js';
import { hideMonsterUnder } from './monster_hiding.js';
import { adjustedMonsterLevel, isHomeElemental, newMonsterHitPoints, } from './monster_hit_points.js';
import { addCreatedObjectToMonsterInventory, linkCreatedObjectToMonsterInventory, restoreMonsterInventoryOwnership, } from './monster_inventory.js';
import { setMonsterPermanentInvisibility } from './monster_invisibility.js';
import { monsterHasMapPosition, monsterOccupiesPosition } from './monster_location.js';
import { setMonsterApparentHeroPosition } from './monster_perception.js';
import { initialShapechangedBirth } from './monster_polymorph.js';
import { propagateMonsterSpecies } from './monster_population.js';
import { giveMonsterStartingObject } from './monster_starting_inventory.js';
import { initializeMonsterWormBody } from './monster_worm.js';
import { initializeMonsterArmor } from './monworn.js';
import { randomDefensiveMonsterItem, randomMiscMonsterItem, randomOffensiveMonsterItem, } from './muse.js';
import { addCreatedObjectToContainer } from './object_container.js';
import { AXE, BOULDER, BULLWHIP, CLOAK_OF_MAGIC_RESISTANCE, CLOAK_OF_PROTECTION, CORPSE, CREAM_PIE, CRYSTAL_BALL, DAGGER, DART, DILITHIUM_CRYSTAL, DWARVISH_CLOAK, DWARVISH_IRON_HELM, DWARVISH_MATTOCK, DWARVISH_MITHRIL_COAT, DWARVISH_ROUNDSHIELD, DWARVISH_SHORT_SWORD, DWARVISH_SPEAR, EGG, ELVEN_ARROW, ELVEN_BOOTS, ELVEN_BOW, ELVEN_BROADSWORD, ELVEN_CLOAK, ELVEN_DAGGER, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_SHIELD, ELVEN_SHORT_SWORD, ELVEN_SPEAR, FIGURINE, GOLD_PIECE, HELMET, IRON_SHOES, LARGE_BOX, LEATHER_ARMOR, LEATHER_CLOAK, LEATHER_GLOVES, LEATHER_JACKET, LUCKSTONE, LUMP_OF_ROYAL_JELLY, MACE, MIRROR, OBJECT_WEIGHT, ORCISH_ARROW, ORCISH_BOW, ORCISH_CHAIN_MAIL, ORCISH_CLOAK, ORCISH_DAGGER, ORCISH_HELM, ORCISH_SHIELD, ORCISH_SHORT_SWORD, PICK_AXE, POT_OBJECT_DETECTION, POT_SICKNESS, QUARTERSTAFF, RING_MAIL, RIN_INVISIBILITY, ROBE, ROCK, SCIMITAR, SLIME_MOLD, SLING, SMALL_SHIELD, SPEAR, SPE_DIG, SPLINT_MAIL, STATUE, TALLOW_CANDLE, TIN, URUK_HAI_SHIELD, WAX_CANDLE, } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { OBJECT_TIMER_KIND, stopObjectTimer } from './object_timers.js';
import { rndClass } from './objnam.js';
import { deliverOrcRaidLoot } from './orc_raid.js';
import { registerQuestLeader } from './quest.js';
import { createParticularMonster } from './read_creation.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { questMonsterAlignment, questMonsterFlags2, questMonsterFlags3, questMonsterSound, } from './role_monsters.js';
import { inTown, roomForIndex } from './room.js';
import { maybeGiveDomesticSaddle } from './steed.js';
import { goodPosition } from './teleport_rules.js';
import { block_point, visionCellBlocksLight } from './vision.js';
import { objectWeight } from './weight.js';
import { findMonsterNearPosition, findMonsterNearPositionCore, makemonNear, } from './mklev.js';
import { getShopItem } from './shknam.js';
import { questMonsterType } from './quest_pager.js';
// Object/class constants (normally from objects.js, not in contest template)
const RANDOM_CLASS = 0;
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const M1_MINDLESS = 0x00010000;
const G_NOGEN = 0x0200;
const G_IGNORE = 0x8000;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const ROCK_CLASS = 14;
const PLACEHOLDER_MONSTERS = new Set([72, 169, 260, 264]);
// Trap-type constants used by birth-time trap memory (trap.h).
const PIT = 11;
const HOLE = 13;
const TRAPDOOR = 14;
const CROSSBOW_BOLT = 23;
const ARROW = 18;
const KNIFE = 40;
const ATHAME = 38;
const BATTLE_AXE = 45;
const SHORT_SWORD = 46;
const SILVER_SABER = 51;
const SILVER_MACE = 74;
const TWO_HANDED_SWORD = 55;
const STILETTO = 41;
const PARTISAN = 59;
const RANSEUR = 60;
const SPETUM = 61;
const GLAIVE = 62;
const LUCERN_HAMMER = 69;
const AKLYS = 80;
const CLUB = 77;
const RUBBER_HOSE = 78;
const SHURIKEN = 25;
const BOW = 83;
const CROSSBOW = 88;
const PLATE_MAIL = 121;
const CRYSTAL_PLATE_MAIL = 122;
const DENTED_POT = 95;
const BANDED_MAIL = 125;
const STUDDED_LEATHER_ARMOR = 131;
const LARGE_SHIELD = 156;
const LOW_BOOTS = 163;
const HIGH_BOOTS = 165;
const MUMMY_WRAPPING = 138;
const TIN_WHISTLE = 245;
const CANDELABRUM_OF_INVOCATION = 262;
const BELL_OF_OPENING = 263;
const BEC_DE_CORBIN = 70;
const PM_BAT = 126;
const PM_GIANT_BAT = 127;
const PM_RAVEN = 128;
const PM_VAMPIRE_BAT = 129;
const MS_BRIBE = 33;
const LONG_SWORD = 54;
const POT_HEALING = 307;
const POT_EXTRA_HEALING = 308;
const WAN_DIGGING = 428;
const SKELETON_KEY = 221;
const WAN_STRIKING = 417;
const WAN_MAGIC_MISSILE = 429;
const WAN_NOTHING = 416;
const WAN_FIRE = 430;
const WAN_COLD = 431;
const WAN_DEATH = 433;
const PM_SHOPKEEPER = 271;
const PM_GUARD = 272;
const PM_HORNED_DEVIL = 291;
const PM_ERINYS = 292;
const PM_BALROG = 302;
const PM_YEENOGHU = 304;
const PM_ORCUS = 305;
const PM_DISPATER = 307;
const PM_ASMODEUS = 309;
const PM_MINOTAUR = 177;
const PM_ETTIN = 174;
const PM_ALIGNED_CLERIC = 275;
const PM_HIGH_CLERIC = 276;
const PM_MORDOR_ORC = 74;
const PM_URUK_HAI = 75;
const PM_ORC_SHAMAN = 76;
const PM_ORC_CAPTAIN = 77;
const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;
const PM_SOLDIER = 277;
const PM_SERGEANT = 278;
const PM_LIEUTENANT = 280;
const PM_CAPTAIN = 281;
const K_RATION = 294;
const C_RATION = 295;
const BUGLE = 256;
const PM_VLAD_THE_IMPALER = 228;
const PM_ARCHAEOLOGIST = 331;
const PM_WIZARD_OF_YENDOR = 285;
const PM_CROESUS = MONSTER_NAME.indexOf('Croesus');
const PM_PESTILENCE = 312;
const PM_WIZARD = 343;
const PM_SALAMANDER = 329;
const S_MIMIC = 13;
const S_ANGEL = 27;
const S_DEMON = 56;
const FLINT = 473;
const PM_HOBBIT = 43;
const PM_GIANT_EEL = 319;
const PM_WUMPUS = 84;
const PM_LONG_WORM = 114;
const PM_BLACK_LIGHT = 119;
const PM_STALKER = 153;
const CHAIN_MAIL = 128;
const M2_DWARF = 0x00000020;
const M2_DEMON = 0x00000100;
const M2_JEWELS = 0x20000000;
const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_MINION = 0x00001000;
const M2_GIANT = 0x00002000;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const M2_HOSTILE = 0x00100000;
const M2_PEACEFUL = 0x00200000;
const M2_NASTY = 0x02000000;
const M2_STRONG = 0x04000000;
const M2_GREEDY = 0x10000000;
const G_LGROUP = 0x0040;
const G_SGROUP = 0x0080;
// C makemon.c:cmp_init_mongen_order().
function monsterGenerationOrder() {
    // C makemon.c:init_mongen_order() sorts once, on first use. Alignment
    // abuse may have changed Erinys difficulty before this first selection.
    game._monsterGenerationOrder ??= Array.from({ length: SPECIAL_PM }, (_, mndx) => mndx).sort((left, right) => {
        const leftKey = (requireMonsterData(MONSTER_SYMBOL, left) << 8)
            | requireMonsterData(MONSTER_DIFFICULTY, left);
        const rightKey = (requireMonsterData(MONSTER_SYMBOL, right) << 8)
            | requireMonsterData(MONSTER_DIFFICULTY, right);
        return leftKey - rightKey || left - right;
    });
    return game._monsterGenerationOrder;
}
// C makemon.c:mk_gen_ok().
export function mkclassAligned(monsterClass, spc = 0, atyp = A_NONE) {
    const G_FREQ = 0x0007;
    const G_HELL = 0x0400;
    const G_NOHELL = 0x0800;
    const G_UNIQ = 0x1000;
    const S_LICH = 38;
    const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
    const inHell = !!currentDungeon?.flags?.hellish;
    const maxMonsterLevel = level_difficulty() >> 1;
    const heroLevel = game.u?.ulevel || 1;
    if (monsterClass < 1 || monsterClass >= MONSTER_CLASS_SYMBOLS.length)
        return null;
    const classMembers = monsterGenerationOrder().filter(mndx => MONSTER_SYMBOL[mndx] === monsterClass);
    if (!classMembers.length)
        return null;
    const zeroFrequencyClass = !MONSTER_GENO.some((geno, mndx) => MONSTER_SYMBOL[mndx] === monsterClass
        && (geno & G_FREQ));
    const weights = new Map();
    let totalWeight = 0;
    let previousDifficulty = 0;
    let ignoreGone = false;
    if (spc & G_IGNORE) {
        ignoreGone = true;
        spc &= ~G_IGNORE;
    }
    for (const mndx of classMembers) {
        const difficulty = requireMonsterData(MONSTER_DIFFICULTY, mndx);
        const strongerThanPrevious = difficulty > previousDifficulty;
        previousDifficulty = difficulty;
        if (atyp !== A_NONE
            && Math.sign(requireMonsterData(MONSTER_ALIGNMENT, mndx)) !== Math.sign(atyp)) {
            continue;
        }
        let generationMask = G_NOGEN | G_UNIQ;
        if (rn2(9) || monsterClass === S_LICH)
            generationMask |= inHell ? G_NOHELL : G_HELL;
        generationMask &= ~spc;
        const geno = requireMonsterData(MONSTER_GENO, mndx);
        const gone = !!((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GONE);
        if (!(geno & generationMask)
            && (ignoreGone || !gone)
            && !PLACEHOLDER_MONSTERS.has(mndx)
            && MONSTER_NAME[mndx] !== 'mail daemon') {
            if (totalWeight && difficulty > maxMonsterLevel
                && strongerThanPrevious
                && rn2(2)) {
                break;
            }
            const frequency = geno & G_FREQ;
            if (frequency || zeroFrequencyClass) {
                const weight = (frequency || 1) + 1
                    - Number(adjustedMonsterLevel(mndx) > heroLevel * 2);
                weights.set(mndx, weight);
                totalWeight += weight;
            }
        }
    }
    if (!totalWeight)
        return null;
    let choice = rnd(totalWeight);
    for (const mndx of classMembers) {
        const weight = weights.get(mndx) || 0;
        if ((choice -= weight) <= 0)
            return mndx;
    }
    return null;
}
export function mkclass(monsterClass, spc = 0) {
    return mkclassAligned(monsterClass, spc, A_NONE);
}
// C makemon.c:align_shift() caches Is_special(&u.uz) until svm.moves
// changes.  Zero-time wizard level travel can therefore construct more than
// one level on the same move while retaining the first level's alignment.
// Keep that source lifetime explicit instead of reading the destination
// descriptor afresh for every reservoir candidate.
function rndmonstAlignment() {
    const moves = game.moves ?? 0;
    if (game._rndmonstAlignmentMove !== moves) {
        game._rndmonstAlignmentMove = moves;
        game._rndmonstAlignment = specialLevelAt();
    }
    // C caches only the special-level descriptor. For an ordinary level it
    // reads the current dungeon on each call, even within the same move.
    return game._rndmonstAlignment
        ? game._rndmonstAlignment.alignment
        : game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.alignment ?? null;
}
// C makemon.c:uncommon().
// C makemon.c:temperature_shift().
function rndmonstReservoir(minAdjustment = 0, maxAdjustment = 0) {
    const zlevel = level_difficulty();
    const heroLevel = game.u?.ulevel || 1;
    const minDifficulty = Math.trunc(zlevel / 6) + minAdjustment;
    const maxDifficulty = Math.trunc((zlevel + heroLevel) / 2)
        + maxAdjustment;
    let totalWeight = 0;
    let selected = -1;
    const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
    const inHell = !!currentDungeon?.flags?.hellish;
    for (let mndx = 0; mndx < SPECIAL_PM; mndx++) {
        const difficulty = requireMonsterData(MONSTER_DIFFICULTY, mndx);
        const geno = requireMonsterData(MONSTER_GENO, mndx);
        if (difficulty < minDifficulty || difficulty > maxDifficulty)
            continue;
        if (Is_rogue_level(game.u.uz) && !/^[A-Z]$/.test(monsterClassSymbol(mndx)))
            continue;
        if (In_endgame(game.u.uz) && !Is_astralevel(game.u.uz)
            && wrongElementalPlaneSpecies(mndx))
            continue;
        if (geno & (0x0200 | 0x1000))
            continue; // G_NOGEN | G_UNIQ
        if ((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GONE)
            continue;
        if (inHell) {
            if ((MONSTER_ALIGNMENT[mndx] || 0) > A_NEUTRAL
                || (geno & 0x0800))
                continue; // lawful or G_NOHELL
        }
        else if (geno & 0x0400)
            continue; // G_HELL
        let weight = geno & 0x0007;
        // C align_shift(): a special level's fixed alignment changes the
        // selection weights before the caller can replace the species.
        const levelAlign = rndmonstAlignment();
        const monsterAlign = MONSTER_ALIGNMENT[mndx] || 0;
        if (levelAlign === A_LAWFUL)
            weight += Math.trunc((monsterAlign + 20) / 8);
        else if (levelAlign === A_NEUTRAL)
            weight += Math.trunc((20 - Math.abs(monsterAlign)) / 4);
        else if (levelAlign === A_CHAOTIC)
            weight += Math.trunc((20 - monsterAlign) / 8);
        // makemon.c:temperature_shift().  Gehennom begins hot in
        // mklev.c and cold special levels can override that inherited flag.
        const temperature = game.level?.flags?.temperature || 0;
        const preferredResistance = temperature > 0 ? 0x01
            : temperature < 0 ? 0x02 : 0; // MR_FIRE / MR_COLD
        if (preferredResistance
            && (requireMonsterData(MONSTER_RESISTS, mndx) & preferredResistance)) {
            weight += 3;
        }
        if (weight > 0) {
            totalWeight += weight;
            if (rn2(totalWeight) < weight)
                selected = mndx;
        }
    }
    return selected >= 0 ? selected : null;
}
// C makemon.c:wrong_elem_type(). Elementals belong only on their own
// plane; other species need the relevant swimming, resistance, or air trait.
function wrongElementalPlaneSpecies(mndx) {
    const monsterClass = MONSTER_SYMBOL[mndx];
    if (monsterClass === 31)
        return !isHomeElemental(mndx); // S_ELEMENTAL
    if (Is_earthlevel(game.u.uz))
        return false;
    const flags = requireMonsterData(MONSTER_FLAGS1, mndx);
    if (Is_waterlevel(game.u.uz))
        return !(flags & 0x02); // M1_SWIM
    if (Is_firelevel(game.u.uz))
        return !(requireMonsterData(MONSTER_RESISTS, mndx) & 0x01); // MR_FIRE
    if (Is_airlevel(game.u.uz)) {
        const species = { mnum: mndx };
        return !((flags & 0x01) && monsterClass !== 20) // flyer, excluding S_TRAPPER
            && monsterClass !== 5 && monsterClass !== 25 // S_EYE / S_LIGHT floaters
            && !monsterIsAmorphous(species)
            && !monsterIsNoncorporeal(species)
            && !monsterIsWhirly(species);
    }
    return false;
}
export function rndmonstAdj(minAdjustment = 0, maxAdjustment = 0) {
    const dnum = game.u?.uz?.dnum ?? 0;
    if (game.dungeons?.[dnum]?.dname === 'The Quest' && rn2(7)) {
        const questMonster = questMonsterType();
        if (questMonster != null)
            return questMonster;
    }
    return rndmonstReservoir(minAdjustment, maxAdjustment);
}
// C ref: makemon.c peace_minded().  Random level monsters must resolve their
// attitude before inventory creation; the live hero alignment record is an
// input, so prayer and other alignment mutations remain observable here.
export function peaceMinded(mndx) {
    const flags = questMonsterFlags2(mndx);
    if (flags & M2_PEACEFUL)
        return true;
    if (flags & M2_HOSTILE)
        return false;
    const sound = questMonsterSound(mndx);
    if (sound === 36 || sound === 38)
        return true;
    if (sound === 37)
        return false;
    // Erinyes are the one species whose attitude is controlled directly by
    // alignment abuse instead of the ordinary co-aligned random chance.
    if (mndx === PM_ERINYS)
        return !(game.u?.ualign?.abuse ?? 0);
    const race = game.urace;
    if (!race)
        throw new Error('monster attitude requires a chosen hero race');
    if (flags & race.lovemask)
        return true;
    if (flags & race.hatemask)
        return false;
    const monsterAlignment = questMonsterAlignment(mndx);
    const heroAlignment = game.u?.ualign?.type || 0;
    if (Math.sign(monsterAlignment) !== Math.sign(heroAlignment))
        return false;
    if (monsterAlignment < 0 && game.u?.uhave?.amulet)
        return false;
    const record = Math.max(-15, game.u?.ualign?.record ?? 0);
    // Deity minions use a deterministic straying check.  This gate precedes
    // the ordinary two-roll co-aligned attitude calculation.
    if (flags & M2_MINION)
        return record >= 0;
    return !!rn2(16 + record) && !!rn2(2 + Math.abs(monsterAlignment));
}
// C ref: makemon.c's post-placement species switch.  This runs after
// peace_minded() and before shapechanging, group construction, and inventory.
// Keep it shared with ambient births: leprechauns always start asleep, while
// nymphs and jabberwocks own the same conditional sleep roll everywhere.
export function initialMonsterSleepState(mndx, forceAsleep = false) {
    let sleeping = forceAsleep ? 1 : 0;
    const monsterClass = MONSTER_SYMBOL[mndx];
    if (monsterClass === 12) { // S_LEPRECHAUN
        sleeping = 1;
    }
    else if (monsterClass === 14
        || monsterClass === 36) { // S_NYMPH or S_JABBERWOCK
        if (rn2(5) && !game.u?.uhave?.amulet)
            sleeping = 1;
    }
    return sleeping;
}
// C makemon.c:m_initgrp().
async function initMonsterGroup(mndx, x, y, countRange, mmflags) {
    let count = Math.trunc(rnd(countRange) / ((game.u?.ulevel ?? 1) < 3 ? 4
        : (game.u?.ulevel ?? 1) < 5 ? 2 : 1));
    if (!count)
        count = 1;
    let centerX = x, centerY = y;
    while (count-- > 0) {
        // m_initgrp() screens attitude before asking enexto() for a member.
        if (peaceMinded(mndx))
            continue;
        const member = await makemonNear(mndx, centerX, centerY, mmflags | MM_NOGRP);
        if (member) {
            member.mpeaceful = 0;
            member.mavenge = 0;
            setMonsterMalign(member);
            centerX = member.mx;
            centerY = member.my;
        }
    }
}
// makemon.c:m_initweap() classes with an explicit switch arm.  Even when a
// particular arm gives no weapon, it skips the default rnd(14-2*bias) table
// and proceeds directly to the common rn2(75) tail.
const M_INITWEAP_SWITCH_CLASSES = new Set([
    34, // S_GIANT
    53, // S_HUMAN
    27, // S_ANGEL
    8, // S_HUMANOID
    37, // S_KOP
    15, // S_ORC
    41, // S_OGRE
    46, // S_TROLL
    11, // S_KOBOLD
    29, // S_CENTAUR
    49, // S_WRAITH
    52, // S_ZOMBIE
    57, // S_LIZARD
    56, // S_DEMON
]);
function questMonsterRepresentsRole(mndx, role) {
    return MONSTER_SYMBOL[mndx] === 53 && game.urole?.key === role
        && (MONSTER_SOUND[mndx] === 36 || MONSTER_SOUND[mndx] === 37);
}
function receivesClericEquipment(mndx) {
    return MONSTER_SYMBOL[mndx] === 53
        && (MONSTER_SOUND[mndx] === 41 || questMonsterRepresentsRole(mndx, 'priest'));
}
function levelMonsterAt(x, y, ignore = null) {
    // C MON_AT(x, y) is purely positional: a dying monster keeps its square
    // until m_detach, so mhp does not filter occupancy here.
    return game.level?.monsters?.find(monster => monsterHasMapPosition(monster, game) && monster !== ignore
        && monsterOccupiesPosition(monster, x, y));
}
// C ref: makemon.c makemon_rnd_goodpos().  The random phase owns a complete
// x/y pair for every rejected candidate.  Level generation skips the
// visibility-avoidance pass, then falls back to a deterministic wrapped scan
// only if all fifty random candidates fail.
function randomMonsterPosition(mndx, gpflags) {
    const subject = mndx == null ? null : { kind: 'species', mnum: mndx };
    let x = 0, y = 0, good = false, tryCount = 0;
    do {
        x = rn1(COLNO - 3, 2);
        y = rn2(ROWNO);
        good = (!game.in_mklev
            && !!((game.viz_array?.[y]?.[x] ?? 0) & 0x02))
            ? false : goodPosition(x, y, subject, { gpflags });
    } while (++tryCount < 50 && !good);
    if (good)
        return { x, y };
    // gi.in_mklev makes C start directly with the second, visibility-agnostic
    // scan.  Runtime callers first scan unseen squares; the compact vision
    // bit mirrors cansee() without introducing a level-generation cycle.
    const firstPass = game.in_mklev || game.blind ? 1 : 0;
    const xOffset = x;
    const yOffset = y;
    for (let visiblePass = firstPass; visiblePass < 2; visiblePass++) {
        if (!visiblePass)
            gpflags &= ~GP_CHECKSCARY;
        for (let dx = 0; dx < COLNO; dx++) {
            for (let dy = 0; dy < ROWNO; dy++) {
                const candidateX = ((dx + xOffset) % (COLNO - 1)) + 1;
                const candidateY = ((dy + yOffset) % (ROWNO - 1)) + 1;
                x = candidateX;
                y = candidateY;
                if (!visiblePass
                    && !!((game.viz_array?.[candidateY]?.[candidateX] ?? 0) & 0x02)) {
                    continue;
                }
                if (goodPosition(candidateX, candidateY, subject, { gpflags }))
                    return { x: candidateX, y: candidateY };
            }
        }
        if (!visiblePass && (mndx === null || MONSTER_MOVE[mndx])) {
            for (let stair = game.stairs; stair; stair = stair.next) {
                if (stair.tolev.dnum === game.u.uz?.dnum && !rn2(2)) {
                    x = stair.sx;
                    y = stair.sy;
                    break;
                }
            }
            if (goodPosition(x, y, subject, { gpflags }))
                return { x, y };
        }
    }
    return null;
}
// C makemon.c:set_mimic_sym(). Selection precedes inventory generation;
// object-backed disguises also own their represented species or fruit.
export async function setMimicAppearance(monster) {
    if (game.u?.protectionFromShapeChangers || game.protectionFromShapeChangers)
        return;
    const { type, appearance } = await chooseMimicAppearance(monster.mx, monster.my);
    monster.m_ap_type = type;
    monster.mappearance = appearance;
    if (type === M_AP_OBJECT
        && [STATUE, FIGURINE, CORPSE, EGG, TIN].includes(appearance)) {
        let represented = rndmonnum();
        const vital = game.mvitals?.[represented];
        if (!vital)
            throw new Error(`missing species history for mimic appearance ${represented}`);
        const noCorpse = !!(vital.mvflags & G_NOCORPSE);
        if (appearance === CORPSE && noCorpse)
            represented = rn1(PM_WIZARD - PM_ARCHAEOLOGIST + 1, PM_ARCHAEOLOGIST);
        else if ((appearance === EGG && !hatchableEggSpecies(represented))
            || (appearance === TIN && noCorpse)) {
            // The pinned C tests the integer hatch result for zero here,
            // rather than comparing it with NON_PM (-1).
            represented = -1;
        }
        monster.mcorpsenm = represented;
    }
    else if (type === M_AP_OBJECT && appearance === SLIME_MOLD) {
        const fruit = game.context.current_fruit;
        if (fruit === undefined)
            throw new Error('fruit history must precede mimic creation');
        monster.mcorpsenm = fruit;
        game.flags.made_fruit = true;
    }
    else if (type === M_AP_FURNITURE && appearance === 33) { // S_altar
        const alignment = rn2(3) - 1;
        monster.mcorpsenm = In_hell(game.u.uz) && rn2(3)
            ? 0 : Align2amask(alignment);
    }
    else if (monster.mcorpsenm != null)
        monster.mcorpsenm = -1;
    // C makemon.c:set_mimic_sym() ends by joining the blocker table only
    // when the disguise actually obstructs light.  It never digs the cell
    // back out here, so a non-blocking mimic must not request a recalc.
    if (visionCellBlocksLight(requireGameLevel(), monster.mx, monster.my))
        block_point(monster.mx, monster.my);
}
async function chooseMimicAppearance(x, y) {
    const level = requireGameLevel();
    const object = (appearance) => ({ type: M_AP_OBJECT, appearance });
    const furniture = (appearance) => ({ type: M_AP_FURNITURE, appearance });
    const floorObject = level.objects[x]?.[y]?.[0];
    if (floorObject)
        return object(floorObject.otyp);
    const location = level.at(x, y);
    if (!location)
        throw new RangeError(`mimic position (${x}, ${y}) is outside its level`);
    if (IS_DOOR(location.typ) || IS_WALL(location.typ)
        || location.typ === SDOOR || location.typ === SCORR) {
        const left = level.at(x - 1, y)?.typ;
        const horizontal = x !== 0 && left !== undefined
            && [HWALL, TLCORNER, TRWALL, BLCORNER, TDWALL, CROSSWALL, TUWALL].includes(left);
        if (Is_rogue_level(game.u.uz))
            return furniture(horizontal ? 2 : 1);
        return furniture(horizontal ? 16 : 15); // S_hcdoor / S_vcdoor
    }
    if (level.flags.is_maze_lev
        && !(In_mines(game.u.uz) && inTown(level, game.u.ux, game.u.uy))
        && !In_sokoban(game.u.uz) && rn2(2))
        return object(STATUE);
    const roomIndex = location.roomno - ROOMOFFSET;
    if (roomIndex < 0 && !level.traps.some(trap => trap.tx === x && trap.ty === y))
        return object(BOULDER);
    const roomType = roomForIndex(level, roomIndex)?.rtype ?? 0;
    if (roomType === ZOO || roomType === VAULT)
        return object(GOLD_PIECE);
    if (roomType === DELPHI)
        return rn2(2) ? object(STATUE) : furniture(37); // S_fountain
    if (roomType === TEMPLE)
        return furniture(33); // S_altar
    // C's first two syms entries choose furniture; the last two choose the
    // generic strange object. Shops exclude the furniture entries.
    const furnitureClass = 18; // MAXOCLASSES
    const classes = [
        furnitureClass, furnitureClass, RING_CLASS, WAND_CLASS, WEAPON_CLASS,
        FOOD_CLASS, COIN_CLASS, SCROLL_CLASS, POTION_CLASS, ARMOR_CLASS,
        AMULET_CLASS, TOOL_CLASS, ROCK_CLASS, GEM_CLASS, SPBOOK_CLASS, 0, 0,
    ];
    let objectClass;
    if (roomType >= SHOPBASE) {
        if (rn2(10) >= depth_of_level(game.u.uz))
            return object(0);
        objectClass = getShopItem(roomType - SHOPBASE);
        if (objectClass < 0)
            return object(-objectClass);
        if (roomType - SHOPBASE === 10 && objectClass > furnitureClass)
            return object(rn2(2) ? LUMP_OF_ROYAL_JELLY : SLIME_MOLD);
        if (objectClass === RANDOM_CLASS || objectClass >= furnitureClass)
            objectClass = classes[rn2(classes.length - 2) + 2];
    }
    else
        objectClass = classes[rn2(classes.length)];
    if (objectClass === undefined)
        throw new RangeError('mimic object-class selection exceeded its table');
    if (objectClass === furnitureClass) {
        const appearance = [25, 25, 26, 26, 33, 34, 35, 36][rn2(8)];
        if (appearance === undefined)
            throw new RangeError('mimic furniture selection exceeded its table');
        return furniture(appearance);
    }
    if (objectClass === 0)
        return object(0);
    if (objectClass === COIN_CLASS)
        return object(GOLD_PIECE);
    const temporary = await mkobj(objectClass, false);
    const appearance = temporary.otyp;
    await deleteObject(temporary);
    return object(appearance);
}
export async function makemon(mdat, x, y, mmflags, requestedByHero = false) {
    const level = requireGameLevel();
    if (game.iflags.debug_mongen || mdat == null && level.flags.rndmongen === false)
        return null;
    const gpflags = GP_AVOID_MONPOS | GP_CHECKSCARY | (mmflags & MM_IGNOREWATER);
    if (x === 0 && y === 0) {
        const point = randomMonsterPosition(mdat, gpflags);
        if (!point)
            return null;
        x = point.x;
        y = point.y;
    }
    else if (!game.in_mklev && x === game.u.ux && y === game.u.uy) {
        const point = findMonsterNearPosition(mdat, x, y, {
            ignoreWater: !!(mmflags & MM_IGNOREWATER), gpflags: GP_AVOID_MONPOS,
        });
        if (!point)
            return null;
        x = point.x;
        y = point.y;
        requestedByHero = true;
    }
    if (!isok(x, y)) {
        await impossible(`makemon trying to create a monster at <${x},${y}>?`);
        return null;
    }
    if (levelMonsterAt(x, y)) {
        if (!(mmflags & MM_ADJACENTOK))
            return null;
        // The occupied-square branch has only the scary-square-aware search.
        const point = findMonsterNearPositionCore(mdat, x, y, gpflags, game);
        if (!point)
            return null;
        x = point.x;
        y = point.y;
    }
    let mndx = mdat;
    if (mndx == null) {
        // C accepts the 51st result even if every preceding type was
        // unsuitable; the bound prevents an impossible map from looping.
        let tryCount = 0;
        do {
            mndx = rndmonstAdj();
            if (mndx == null)
                return null;
            ++tryCount;
        } while (tryCount <= 50
            && ((tryCount === 1 && In_sokoban(game.u.uz)
                && !!((MONSTER_FLAGS2[mndx] ?? 0) & 0x08000000)) // M2_ROCKTHROW
                || !goodPosition(x, y, { kind: 'species', mnum: mndx }, {
                    gpflags,
                })));
    }
    if (mdat != null
        && ((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GENOD))
        return null;
    propagateMonsterSpecies(mndx, !(mmflags & MM_NOCOUNTBIRTH), false);
    const monsterId = nextIdent();
    const { level: baseLevel, hp } = newMonsterHitPoints(mndx);
    const genderFlags = questMonsterFlags2(mndx);
    const isNeutralDemon = !!(genderFlags & M2_DEMON)
        && !(genderFlags & (M2_LORD | M2_PRINCE));
    const isQuestLeaderType = mndx === game.urole?.ldrnum;
    const isQuestNemesis = mndx === game.urole?.neminum;
    const femaleOk = !(genderFlags & (M2_MALE | M2_NEUTER));
    const maleOk = !(genderFlags & (M2_FEMALE | M2_NEUTER));
    const monsterFemale = (genderFlags & M2_FEMALE) ? true
        : ((mmflags & MM_FEMALE) && femaleOk) ? true
            : (genderFlags & M2_MALE) ? false
                : ((mmflags & MM_MALE) && maleOk) ? false
                    : (genderFlags & M2_NEUTER) ? false
                        : isQuestLeaderType
                            ? game.quest_status?.ldrgend === 1
                            : isQuestNemesis
                                ? game.quest_status?.nemgend === 1
                                : !!rn2(2);
    // makemon.c honors MM_ANGRY before consulting peace_minded().  This is
    // RNG-visible for co-aligned neutral species such as fallback garter
    // snakes; hostile ant summons happened to short-circuit the same helper.
    let peaceful = (mmflags & MM_ANGRY) ? false : peaceMinded(mndx);
    // makemon.c species switch: elves meet orcs hostile, and a unicorn
    // sharing the sign of the hero's alignment is peaceful.
    if (MONSTER_SYMBOL[mndx] === 15 && game.urace?.name === 'elf') { // S_ORC
        peaceful = false;
    }
    else if (MONSTER_SYMBOL[mndx] === 21 // S_UNICORN
        && (genderFlags & M2_JEWELS) !== 0
        && Math.sign(game.u?.ualign?.type ?? 0)
            === Math.sign(MONSTER_ALIGNMENT[mndx] ?? 0)) {
        peaceful = true;
    }
    let monsterSleeping = initialMonsterSleepState(mndx, !!(mmflags & MM_ASLEEP));
    // C links the primary actor before group construction.  Reserve its
    // creation-order slot now so enexto() sees the occupied center and the
    // final JS array retains primary-then-members order.
    if (!level.monsters)
        level.monsters = [];
    const monsterInventory = [];
    const pendingMonster = {
        m_id: monsterId, cham: -1,
        mnum: mndx, mx: x, my: y, mhp: hp, mhpmax: hp,
        m_lev: baseLevel, female: monsterFemale,
        mcanmove: 1, mcansee: 1, mgenmklev: !!game.in_mklev,
        mux: 0, muy: 0,
        msleeping: monsterSleeping, mpeaceful: peaceful ? 1 : 0,
        malign: 0,
        mwandexp: Is_stronghold(game.u.uz) || Is_knox_level(game.u.uz)
            || In_endgame(game.u.uz) || In_hell(game.u.uz)
            || In_V_tower(game.u.uz) || In_quest(game.u.uz),
        minvent: monsterInventory,
        inventory: monsterInventory,
        hasInventory: false,
    };
    const monsterIndex = level.monsters.push(pendingMonster) - 1;
    allocateMonsterBirthExtensions(pendingMonster, mmflags);
    if (!(requireMonsterData(MONSTER_FLAGS1, mndx) & M1_MINDLESS)) {
        if (In_sokoban(game.u.uz))
            pendingMonster.mtrapseen = (1 << (PIT - 1)) | (1 << (HOLE - 1));
        if (Is_stronghold(game.u.uz))
            pendingMonster.mtrapseen = (pendingMonster.mtrapseen ?? 0) | (1 << (TRAPDOOR - 1));
    }
    if (MONSTER_SOUND[mndx] === 36 || MONSTER_SOUND[mndx] === 37)
        pendingMonster.mtrapseen = -1; // quest leaders and nemeses know every trap
    if (mmflags & MM_MINVIS) {
        setMonsterPermanentInvisibility(pendingMonster);
        await newsym(pendingMonster.mx, pendingMonster.my);
    }
    if (mndx === PM_STALKER || mndx === PM_BLACK_LIGHT)
        setMonsterPermanentInvisibility(pendingMonster);
    const isMimic = MONSTER_SYMBOL[mndx] === S_MIMIC;
    if (isMimic)
        await setMimicAppearance(pendingMonster);
    // C makemon() creates the hiding object before fixed possessions such
    // as Scorpius's Bell, so inventory flags cannot change this object.
    if (game.in_mklev
        && (MONSTER_SYMBOL[mndx] === 19 || MONSTER_SYMBOL[mndx] === 45)
        && x && y) {
        await mkobj_at(RANDOM_CLASS, x, y, true);
    }
    let generatedGhostName = null;
    if (mndx === 287 && !(mmflags & MM_NONAME)) { // PM_GHOST
        generatedGhostName = randomGhostName();
    }
    const shaped = await initialShapechangedBirth(pendingMonster);
    if (shaped) {
        if (requestedByHero) {
            await newsym(shaped.mx, shaped.my);
            setMonsterApparentHeroPosition(shaped, game, rn2);
        }
        setMonsterMalign(shaped);
        level.monsters[monsterIndex] = shaped;
        return finishMonsterBirth(shaped, mmflags);
    }
    let roamingMinion = null;
    let hasMonsterInventory = false;
    const allowMonsterInventory = !(mmflags & NO_MINVENT);
    const mongets = async (otyp) => {
        const object = await giveMonsterStartingObject(pendingMonster, otyp);
        if (otyp)
            hasMonsterInventory = true;
        return object;
    };
    // C makemon() grants fixed possessions before ordinary equipment.
    // The Wizard count advances even when NO_MINVENT suppresses his book.
    let fixedItem = 0;
    if (mndx === PM_VLAD_THE_IMPALER)
        fixedItem = CANDELABRUM_OF_INVOCATION;
    else if (mndx === PM_WIZARD_OF_YENDOR) {
        game.context.no_of_wizards = (game.context.no_of_wizards ?? 0) + 1;
        if (game.context.no_of_wizards === 1 && Is_earthlevel(game.u.uz))
            fixedItem = SPE_DIG;
    }
    else if (mndx === PM_CROESUS)
        fixedItem = TWO_HANDED_SWORD;
    else if (questMonsterSound(mndx) === 37)
        fixedItem = BELL_OF_OPENING; // MS_NEMESIS
    else if (mndx === PM_PESTILENCE)
        fixedItem = POT_SICKNESS;
    if (allowMonsterInventory && fixedItem)
        await mongets(fixedItem);
    if (game.in_mklev) {
        if ((isNeutralDemon || mndx === PM_GIANT_EEL
            || mndx === PM_WUMPUS || mndx === PM_LONG_WORM)
            && !game.u?.uhave?.amulet && rn2(5)) {
            monsterSleeping = 1;
            pendingMonster.msleeping = 1;
        }
    }
    else if (requestedByHero) {
        // makemon.c owns this initialization when its original requested
        // coordinate was the hero's occupied square, but only outside level
        // creation.  enexto() has already moved the actor, so preserve that
        // caller fact separately from final x/y.
        await newsym(pendingMonster.mx, pendingMonster.my);
        setMonsterApparentHeroPosition(pendingMonster, game, rn2);
    }
    // makemon() establishes these attitudes before inventory selection.
    // Peaceful monsters decline invisibility items when the hero cannot see
    // invisible, including princes made peaceful despite MM_ANGRY.
    const bribingPrince = (genderFlags & M2_DEMON) !== 0 && (genderFlags & M2_PRINCE) !== 0
        && MONSTER_SOUND[mndx] === MS_BRIBE;
    const wieldedArtifact = game.uwep?.oartifact;
    const baneWielded = wieldedArtifact !== undefined
        && (wieldedArtifact === artifactByName('Excalibur')?.id || wieldedArtifact === artifactByName('Demonbane')?.id);
    if (bribingPrince) {
        pendingMonster.mpeaceful = baneWielded ? 0 : 1;
        pendingMonster.minvis = pendingMonster.perminvis = true;
        pendingMonster.mavenge = 0;
    }
    if (mndx === PM_RAVEN && game.uwep?.otyp === BEC_DE_CORBIN)
        pendingMonster.mpeaceful = 1;
    if (mndx === PM_LONG_WORM)
        await initializeMonsterWormBody(pendingMonster, {
            allowTail: !(mmflags & MM_NOTAIL),
        });
    // Ordinary clerics always become roamers; ordinary Angels have a
    // one-in-three chance. Callers requesting priest/minion data own its
    // alignment themselves. This birth state also applies under NO_MINVENT.
    const becomesRoamer = [PM_ALIGNED_CLERIC, PM_HIGH_CLERIC].includes(mndx)
        ? !(mmflags & (MM_EPRI | MM_EMIN))
        : mndx === MONSTER_NAME.indexOf('Angel') && !(mmflags & MM_EMIN) && !rn2(3);
    if (becomesRoamer) {
        const minAlign = rn2(3) - 1;
        const renegade = !!(mmflags & MM_ANGRY) || rn2(3) === 0;
        const minionPeaceful = minAlign === (game.u?.ualign?.type ?? 0)
            ? !renegade : renegade;
        roamingMinion = {
            min_align: minAlign,
            renegade,
            mpeaceful: minionPeaceful ? 1 : 0,
        };
        pendingMonster.isminion = 1;
        pendingMonster.emin = { parentmid: monsterId, min_align: minAlign, renegade };
        pendingMonster.mpeaceful = roamingMinion.mpeaceful;
    }
    // Native creation finishes attitude and kill credit before group members
    // can announce their arrival and wait for the player's input.
    setMonsterMalign(pendingMonster);
    if (mdat == null && !(mmflags & MM_NOGRP)) {
        const geno = MONSTER_GENO[mndx] || 0;
        if ((geno & G_SGROUP) && rn2(2)) {
            await initMonsterGroup(mndx, x, y, 3, mmflags);
        }
        else if (geno & G_LGROUP) {
            await initMonsterGroup(mndx, x, y, rn2(3) ? 10 : 3, mmflags);
        }
    }
    const initializeMonsterEquipment = allowMonsterInventory && !Is_rogue_level(game.u.uz);
    let skipCommonMonsterInventory = false;
    // C makemon.c:m_initthrow(). Throwing stacks bypass mongets(): the raw
    // mksobj() result goes straight into the inventory, so demons keep any
    // blessing, the quantity is replaced with rn1(oquan, 3), and orcish
    // arrows are always created poisoned.
    const mInitthrow = async (otyp, oquan) => {
        const object = await mksobj(otyp, true, false);
        object.quan = 3 + rn2(oquan);
        object.quantity = object.quan;
        object.owt = (OBJECT_WEIGHT[otyp] ?? 1) * object.quan;
        if (otyp === ORCISH_ARROW)
            object.opoisoned = true;
        await addCreatedObjectToMonsterInventory(pendingMonster, object, game);
        hasMonsterInventory = true;
    };
    const mkmonmoney = async (amount) => {
        if (amount <= 0)
            return;
        const gold = await mksobj(GOLD_PIECE, false, false);
        gold.quan = amount;
        gold.quantity = amount;
        gold.owt = objectWeight(gold);
        await linkCreatedObjectToMonsterInventory(pendingMonster, gold);
        hasMonsterInventory = true;
    };
    const giveOffensiveMonsterItem = async () => {
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem)
                await mongets(offensiveItem);
        }
    };
    const giveGeneralMonsterWeapon = async () => {
        const bias = ((genderFlags & M2_LORD) ? 1 : 0)
            + ((genderFlags & M2_PRINCE) ? 2 : 0)
            + ((genderFlags & M2_NASTY) ? 1 : 0);
        switch (rnd(14 - 2 * bias)) {
            case 1:
                if (genderFlags & M2_STRONG)
                    await mongets(BATTLE_AXE);
                else
                    await mInitthrow(DART, 12);
                break;
            case 2:
                if (genderFlags & M2_STRONG)
                    await mongets(TWO_HANDED_SWORD);
                else {
                    await mongets(CROSSBOW);
                    await mInitthrow(CROSSBOW_BOLT, 12);
                }
                break;
            case 3:
                await mongets(BOW);
                await mInitthrow(18, 12); // ARROW
                break;
            case 4:
                if (genderFlags & M2_STRONG)
                    await mongets(LONG_SWORD);
                else
                    await mInitthrow(DAGGER, 3);
                break;
            case 5:
                await mongets((genderFlags & M2_STRONG) ? LUCERN_HAMMER : AKLYS);
                break;
            default:
                break;
        }
        await giveOffensiveMonsterItem();
    };
    // C m_initweap() and m_initinv() both return on Rogue levels. Fixed
    // possessions from makemon() above and its saddle probe below are separate.
    if (!initializeMonsterEquipment) {
        // NO_MINVENT and Rogue levels bypass ordinary equipment creation.
    }
    else if (mndx === PM_VLAD_THE_IMPALER) {
        // Vlad is a vampire prince and extra-nasty, reducing the ordinary
        // armament table to rnd(8).  His fixed Candelabrum above exists
        // before this shared weapon/offensive-item tail.
        await giveGeneralMonsterWeapon();
    }
    else if (mndx >= 59 && mndx <= 61) { // kobold through kobold leader
        // C ref: makemon.c m_initweap(), S_KOBOLD.
        if (!rn2(4))
            await mInitthrow(DART, 12);
        await giveOffensiveMonsterItem();
    }
    else if (mndx >= 70 && mndx <= 73) {
        // C ref: makemon.c m_initweap(), S_ORC.  Goblins, hobgoblins,
        // corpses-only base orcs, and hill orcs all use the default armament
        // branch; the goblin form short-circuits the dagger/scimitar choice.
        if (rn2(2))
            await mongets(ORCISH_HELM);
        if (rn2(2)) {
            const weapon = mndx === 70 || rn2(2) === 0
                ? ORCISH_DAGGER : SCIMITAR;
            await mongets(weapon);
        }
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 27
        && (requireMonsterData(MONSTER_FLAGS1, mndx) & 0x00020000)
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C ref: m_initweap(), humanoid S_ANGEL.  Minion weapons and shields
        // deliberately bypass mongets()/ordinary object initialization.
        const isLord = !!(genderFlags & 0x00000400);
        const weapon = await mksobj(rn2(3) ? LONG_SWORD : SILVER_MACE, false, false);
        const promote = !rn2(20) || isLord;
        if (promote && monsterAlignmentType(pendingMonster) === A_LAWFUL) {
            nameArtifact(weapon, artifactByName(weapon.otyp === LONG_SWORD ? 'Sunsword' : 'Demonbane'));
        }
        weapon.blessed = true;
        weapon.cursed = false;
        weapon.oerodeproof = true;
        weapon.spe = rn2(4) + (weapon.otyp === SILVER_MACE ? 3 : 0);
        await addCreatedObjectToMonsterInventory(pendingMonster, weapon, game);
        hasMonsterInventory = true;
        const shield = await mksobj(!rn2(4) || isLord ? 158 : LARGE_SHIELD, false, false);
        shield.oerodeproof = true;
        shield.spe = 0;
        await addCreatedObjectToMonsterInventory(pendingMonster, shield, game);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 8 && mndx === PM_HOBBIT) {
        // C ref: makemon.c m_initweap(), S_HUMANOID/PM_HOBBIT.
        const weaponRoll = rn2(3);
        if (weaponRoll === 0)
            await mongets(DAGGER);
        else if (weaponRoll === 1)
            await mongets(ELVEN_DAGGER);
        else {
            await mongets(SLING);
            await mInitthrow(!rn2(4) ? FLINT : ROCK, 6);
        }
        if (!rn2(10))
            await mongets(ELVEN_MITHRIL_COAT);
        if (!rn2(10))
            await mongets(DWARVISH_CLOAK);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 8
        && (genderFlags & M2_DWARF)) {
        // C ref: makemon.c m_initweap(), S_HUMANOID/is_dwarf().  Keep the
        // complete equipment tree together because every optional item feeds
        // the same ordinary object constructor and erosion rules.
        if (rn2(7))
            await mongets(DWARVISH_CLOAK);
        if (rn2(7))
            await mongets(IRON_SHOES);
        if (!rn2(4)) {
            await mongets(DWARVISH_SHORT_SWORD);
            if (rn2(2)) {
                await mongets(DWARVISH_MATTOCK);
            }
            else {
                await mongets(rn2(2) ? AXE : DWARVISH_SPEAR);
                await mongets(DWARVISH_ROUNDSHIELD);
            }
            await mongets(DWARVISH_IRON_HELM);
            if (!rn2(3))
                await mongets(DWARVISH_MITHRIL_COAT);
        }
        else {
            await mongets(!rn2(3) ? PICK_AXE : DAGGER);
        }
        await giveOffensiveMonsterItem();
    }
    else if (mndx >= 264 && mndx <= 269) { // ordinary elf species
        // C ref: makemon.c m_initweap(), is_elf().  Clothing probes precede
        // the mutually exclusive primary loadout; monarchs then receive two
        // extra utility probes before the common offensive-item tail.
        if (rn2(2))
            await mongets(rn2(2) ? ELVEN_MITHRIL_COAT : ELVEN_CLOAK);
        if (rn2(2))
            await mongets(ELVEN_LEATHER_HELM);
        else if (!rn2(4))
            await mongets(ELVEN_BOOTS);
        if (rn2(2))
            await mongets(ELVEN_DAGGER);
        switch (rn2(3)) {
            case 0: {
                if (!rn2(4))
                    await mongets(ELVEN_SHIELD);
                if (rn2(3))
                    await mongets(ELVEN_SHORT_SWORD);
                await mongets(ELVEN_BOW);
                await mInitthrow(ELVEN_ARROW, 12);
                break;
            }
            case 1:
                await mongets(ELVEN_BROADSWORD);
                if (rn2(2))
                    await mongets(ELVEN_SHIELD);
                break;
            case 2:
                if (rn2(2)) {
                    await mongets(ELVEN_SPEAR);
                    await mongets(ELVEN_SHIELD);
                }
                break;
        }
        if (mndx === 269) { // PM_ELVEN_MONARCH
            if (rn2(3) || (game.in_mklev && Is_earthlevel(game.u?.uz)))
                await mongets(PICK_AXE);
            if (!rn2(50))
                await mongets(CRYSTAL_BALL);
        }
        await giveOffensiveMonsterItem();
    }
    else if ([
        PM_SOLDIER, PM_SERGEANT, PM_LIEUTENANT, PM_CAPTAIN,
        PM_WATCHMAN, PM_WATCH_CAPTAIN, PM_GUARD,
    ].includes(mndx)) {
        // C ref: makemon.c m_initweap()/m_initinv(), human mercenaries.
        // Soldiers, the watch, and vault guards share an armor budget;
        // armor gained in each round gates whether later slots are attempted.
        let primaryWeapon = 0;
        let secondaryWeapon = 0;
        if (mndx === PM_SOLDIER || mndx === PM_WATCHMAN) {
            if (!rn2(3)) {
                primaryWeapon = PARTISAN + rn2(12);
                secondaryWeapon = rn2(2) ? DAGGER : KNIFE;
            }
            else {
                primaryWeapon = rn2(2) ? SPEAR : SHORT_SWORD;
            }
        }
        else if (mndx === PM_SERGEANT) {
            primaryWeapon = rn2(2) ? 81 : MACE; // FLAIL
        }
        else if (mndx === PM_LIEUTENANT) {
            primaryWeapon = rn2(2) ? 52 : LONG_SWORD; // BROADSWORD
        }
        else if (mndx === PM_CAPTAIN || mndx === PM_WATCH_CAPTAIN) {
            primaryWeapon = rn2(2) ? LONG_SWORD : SILVER_SABER;
        }
        else {
            if (!rn2(4))
                primaryWeapon = DAGGER;
            if (!rn2(7))
                secondaryWeapon = SPEAR;
        }
        if (primaryWeapon)
            await mongets(primaryWeapon);
        if (!secondaryWeapon && primaryWeapon !== DAGGER && !rn2(4))
            secondaryWeapon = KNIFE;
        if (secondaryWeapon)
            await mongets(secondaryWeapon);
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem)
                await mongets(offensiveItem);
        }
        let mercenaryAc = mndx === PM_GUARD ? -1
            : (mndx === PM_SOLDIER || mndx === PM_WATCHMAN) ? 3
                : mndx === PM_SERGEANT ? 0
                    : (mndx === PM_LIEUTENANT
                        || mndx === PM_WATCH_CAPTAIN) ? -2 : -3;
        const addArmor = async (otyp) => {
            const object = await mongets(otyp);
            mercenaryAc += armorBonus(object);
        };
        if (mercenaryAc < -1 && rn2(5))
            await addArmor(rn2(5) ? PLATE_MAIL : CRYSTAL_PLATE_MAIL);
        else if (mercenaryAc < 3 && rn2(5))
            await addArmor(rn2(3) ? SPLINT_MAIL : BANDED_MAIL);
        else if (rn2(5))
            await addArmor(rn2(3) ? RING_MAIL : STUDDED_LEATHER_ARMOR);
        else
            await addArmor(LEATHER_ARMOR);
        if (mercenaryAc < 10 && rn2(3))
            await addArmor(HELMET);
        else if (mercenaryAc < 10 && rn2(2))
            await addArmor(DENTED_POT);
        if (mercenaryAc < 10 && rn2(3))
            await addArmor(SMALL_SHIELD);
        else if (mercenaryAc < 10 && rn2(2))
            await addArmor(LARGE_SHIELD);
        if (mercenaryAc < 10 && rn2(3))
            await addArmor(LOW_BOOTS);
        else if (mercenaryAc < 10 && rn2(2))
            await addArmor(HIGH_BOOTS);
        if (mercenaryAc < 10 && rn2(3))
            await addArmor(LEATHER_GLOVES);
        else if (mercenaryAc < 10 && rn2(2))
            await addArmor(LEATHER_CLOAK);
        if (mndx === PM_WATCHMAN) {
            if (rn2(3))
                await mongets(TIN_WHISTLE);
        }
        else if (mndx === PM_GUARD) {
            const whistle = await mksobj(TIN_WHISTLE, true, false);
            whistle.cursed = true;
            whistle.buc = 'cursed';
            await addCreatedObjectToMonsterInventory(pendingMonster, whistle, game);
            hasMonsterInventory = true;
        }
        else if (mndx !== PM_WATCH_CAPTAIN) {
            if (!rn2(3))
                await mongets(K_RATION);
            if (!rn2(2))
                await mongets(C_RATION);
            if (mndx !== PM_SOLDIER && !rn2(3))
                await mongets(BUGLE);
            // Ordinary soldiers usually stop before the defensive and
            // miscellaneous magic-item reservoirs.
            if (mndx === PM_SOLDIER && rn2(13))
                skipCommonMonsterInventory = true;
        }
    }
    else if (mndx === PM_SHOPKEEPER) {
        // C refs: makemon.c m_initweap() and m_initinv().  Shopkeepers have
        // no class-specific weapon, but are armed and therefore still reach
        // the final offensive-item roll before receiving their fixed kit.
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem)
                await mongets(offensiveItem);
        }
        await mongets(SKELETON_KEY);
        const firstKitItem = rn2(4);
        if (firstKitItem === 0)
            await mongets(WAN_MAGIC_MISSILE);
        if (firstKitItem <= 1)
            await mongets(POT_EXTRA_HEALING);
        if (firstKitItem <= 2)
            await mongets(POT_HEALING);
        await mongets(WAN_STRIKING);
    }
    else if (MONSTER_SYMBOL[mndx] === 56
        && (genderFlags & M2_DEMON)
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C m_initweap(), S_DEMON: fixed demon weapons are added before the
        // same bias-sensitive general armament table used by normal monsters.
        if (mndx === PM_BALROG) {
            await mongets(BULLWHIP);
            await mongets(52); // BROADSWORD
        }
        else if (mndx === PM_ORCUS) {
            await mongets(WAN_DEATH);
        }
        else if (mndx === PM_HORNED_DEVIL) {
            await mongets(rn2(4) ? 33 : BULLWHIP); // TRIDENT
        }
        else if (mndx === PM_DISPATER) {
            await mongets(WAN_STRIKING);
        }
        else if (mndx === PM_YEENOGHU) {
            await mongets(81); // FLAIL
        }
        await giveGeneralMonsterWeapon();
    }
    else if (MONSTER_HAS_WEAPON_ATTACK.has(mndx) && receivesClericEquipment(mndx)) {
        // C makemon() skips m_initweap() for unarmed species, even when
        // the hero's role makes them Cleric quest representatives.
        const mace = await mksobj(MACE, false, false);
        mace.spe = rnd(3);
        if (!rn2(2)) {
            mace.cursed = true;
            mace.buc = 'cursed';
        }
        await addCreatedObjectToMonsterInventory(pendingMonster, mace, game);
        hasMonsterInventory = true;
        const offensiveRoll = rn2(75);
        if (baseLevel > offensiveRoll) {
            const offensiveItem = randomOffensiveMonsterItem(pendingMonster);
            if (offensiveItem)
                await mongets(offensiveItem);
        }
    }
    else if (mndx === MONSTER_NAME.indexOf('ninja')) {
        await mongets(rn2(4) ? SHURIKEN : DART);
        await mongets(rn2(4) ? SHORT_SWORD : AXE);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_HAS_WEAPON_ATTACK.has(mndx)
        && ['student', 'attendant', 'abbot', 'acolyte', 'guide', 'apprentice']
            .includes(MONSTER_NAME[mndx] ?? '')) {
        // C makemon() calls m_initweap() only for armed species. Abbots
        // appear in its guardian switch but have no weapon attack.
        if (rn2(2))
            await mongets(rn2(3) ? DAGGER : KNIFE);
        if (rn2(5))
            await mongets(rn2(3) ? LEATHER_JACKET : LEATHER_CLOAK);
        if (rn2(3))
            await mongets(rn2(3) ? LOW_BOOTS : HIGH_BOOTS);
        if (rn2(3))
            await mongets(POT_HEALING);
        await giveOffensiveMonsterItem();
    }
    else if (['chieftain', 'page', 'roshi', 'warrior'].includes(MONSTER_NAME[mndx] ?? '')) {
        await mongets(rn2(3) ? LONG_SWORD : SHORT_SWORD);
        await mongets(rn2(3) ? CHAIN_MAIL : LEATHER_ARMOR);
        if (rn2(2))
            await mongets(rn2(2) ? LOW_BOOTS : HIGH_BOOTS);
        if (!rn2(3))
            await mongets(LEATHER_CLOAK);
        if (!rn2(3)) {
            await mongets(BOW);
            await mInitthrow(ARROW, 12);
        }
        await giveOffensiveMonsterItem();
    }
    else if (mndx === MONSTER_NAME.indexOf('hunter')) {
        await mongets(rn2(3) ? SHORT_SWORD : DAGGER);
        if (rn2(2))
            await mongets(rn2(2) ? LEATHER_JACKET : LEATHER_ARMOR);
        await mongets(BOW);
        await mInitthrow(ARROW, 12);
        await giveOffensiveMonsterItem();
    }
    else if (mndx === MONSTER_NAME.indexOf('thug')) {
        await mongets(CLUB);
        await mongets(rn2(3) ? DAGGER : KNIFE);
        if (rn2(2))
            await mongets(LEATHER_GLOVES);
        await mongets(rn2(2) ? LEATHER_JACKET : LEATHER_ARMOR);
        await giveOffensiveMonsterItem();
    }
    else if (mndx === MONSTER_NAME.indexOf('neanderthal')) {
        await mongets(CLUB);
        await mongets(LEATHER_ARMOR);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 37) { // S_KOP
        if (!rn2(4))
            await mInitthrow(CREAM_PIE, 2);
        if (!rn2(3))
            await mongets(rn2(2) ? CLUB : RUBBER_HOSE);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 15
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_ORC
        // C ref: makemon.c m_initweap(), S_ORC.  The common helm probe
        // precedes a subtype-specific equipment graph; an orc captain chooses
        // one of the two ranked subtypes before entering the same graph.
        if (rn2(2))
            await mongets(ORCISH_HELM);
        const orcSubtype = mndx === 77 // PM_ORC_CAPTAIN
            ? (rn2(2) ? 74 : 75) : mndx;
        if (orcSubtype === 74) { // PM_MORDOR_ORC
            if (!rn2(3))
                await mongets(SCIMITAR);
            if (!rn2(3))
                await mongets(ORCISH_SHIELD);
            if (!rn2(3))
                await mongets(KNIFE);
            if (!rn2(3))
                await mongets(ORCISH_CHAIN_MAIL);
        }
        else if (orcSubtype === 75) { // PM_URUK_HAI
            if (!rn2(3))
                await mongets(ORCISH_CLOAK);
            if (!rn2(3))
                await mongets(ORCISH_SHORT_SWORD);
            if (!rn2(3))
                await mongets(IRON_SHOES);
            if (!rn2(3)) {
                await mongets(ORCISH_BOW);
                await mInitthrow(ORCISH_ARROW, 12);
            }
            if (!rn2(3))
                await mongets(URUK_HAI_SHIELD);
        }
        else if (mndx !== 76 && rn2(2)) { // not PM_ORC_SHAMAN
            await mongets(mndx === 70 || !rn2(2) ? ORCISH_DAGGER : SCIMITAR);
        }
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 46) { // S_TROLL
        if (!rn2(2)) {
            const polearms = [RANSEUR, PARTISAN, GLAIVE, SPETUM];
            const polearm = polearms[rn2(polearms.length)];
            if (polearm === undefined)
                throw new RangeError('troll polearm selection exceeded its table');
            await mongets(polearm);
        }
        // The class switch only chooses the ordinary weapon.  Every armed
        // troll still reaches m_initweap()'s shared level-versus-rn2(75)
        // offensive-item tail; high-level Olog-hai make the winning branch
        // observable during summon-nasties.
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 49
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_WRAITH
        // C ref: makemon.c:m_initweap().  Armed wraith-class monsters receive
        // both fixed weapons before the shared offensive-item reservoir.
        await mongets(KNIFE);
        await mongets(LONG_SWORD);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 52
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_ZOMBIE
        // C ref: makemon.c m_initweap(), S_ZOMBIE.  Armed skeletons first
        // probe for leather armor and a knife/short sword, then rejoin the
        // shared offensive-item tail.
        if (!rn2(4))
            await mongets(LEATHER_ARMOR);
        if (!rn2(4))
            await mongets(rn2(3) ? KNIFE : SHORT_SWORD);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 34
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) { // S_GIANT
        // C ref: makemon.c m_initweap().  Giants independently probe for a
        // throwing boulder (ettins get a club) and, except for ettins, a
        // heavy melee weapon before the common offensive-item reservoir.
        if (rn2(2))
            await mongets(mndx === PM_ETTIN ? CLUB : BOULDER);
        if (mndx !== PM_ETTIN && !rn2(5))
            await mongets(rn2(2) ? TWO_HANDED_SWORD : BATTLE_AXE);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 41) { // S_OGRE
        const range = mndx === 205 ? 3 : mndx === 204 ? 6 : 12;
        await mongets(!rn2(range) ? BATTLE_AXE : CLUB);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 29) { // S_CENTAUR
        // Forest centaurs use bows; the other two species use crossbows.
        // The missile stack is created only when the class probe succeeds.
        if (rn2(2)) {
            const forest = mndx === 131;
            await mongets(forest ? BOW : CROSSBOW);
            await mInitthrow(forest ? 18 : CROSSBOW_BOLT, 12); // ARROW
        }
        await giveOffensiveMonsterItem();
    }
    else if (mndx === PM_SALAMANDER) {
        // C ref: makemon.c m_initweap(), S_LIZARD/PM_SALAMANDER.  The fixed
        // polearm choice replaces the generic bias-sensitive weapon table,
        // then rejoins its ordinary offensive-item tail.
        await mongets(rn2(7) ? SPEAR : rn2(3) ? 33 : STILETTO);
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_SYMBOL[mndx] === 33 // S_GNOME
        && MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        // C ref: makemon.c m_initweap(), default class armament.  Gnomes do
        // not have a dedicated switch case, so armed gnomes reach this table;
        // leader/ruler ranks narrow it through the lord/prince bias.
        const bias = ((genderFlags & 0x00000400) ? 1 : 0)
            + ((genderFlags & 0x00000800) ? 2 : 0)
            + ((genderFlags & M2_NASTY) ? 1 : 0);
        const weaponRoll = rnd(14 - (2 * bias));
        switch (weaponRoll) {
            case 1:
                if (genderFlags & M2_STRONG)
                    await mongets(BATTLE_AXE);
                else
                    await mInitthrow(DART, 12);
                break;
            case 2:
                if (genderFlags & M2_STRONG)
                    await mongets(TWO_HANDED_SWORD);
                else {
                    await mongets(CROSSBOW);
                    await mInitthrow(CROSSBOW_BOLT, 12);
                }
                break;
            case 3:
                await mongets(BOW);
                await mInitthrow(18, 12); // ARROW
                break;
            case 4:
                if (genderFlags & M2_STRONG)
                    await mongets(LONG_SWORD);
                else
                    await mInitthrow(DAGGER, 3);
                break;
            case 5:
                await mongets((genderFlags & M2_STRONG) ? LUCERN_HAMMER : AKLYS);
                break;
            default:
                break;
        }
        await giveOffensiveMonsterItem();
    }
    else if (MONSTER_HAS_WEAPON_ATTACK.has(mndx)) {
        if (M_INITWEAP_SWITCH_CLASSES.has(requireMonsterData(MONSTER_SYMBOL, mndx))) {
            // This explicit class arm has no additional behavior in the
            // currently ported constructor, but it still bypasses default.
            await giveOffensiveMonsterItem();
        }
        else {
            // C m_initweap()'s default switch arm first runs the
            // bias-sensitive general weapon table; the rn2(75) probe is its
            // tail, not a replacement for that table.
            await giveGeneralMonsterWeapon();
        }
    }
    // m_initinv(), m_dowear(), and the domestic-saddle probe share the same
    // allow_minvent gate.  NO_MINVENT must consume none of their RNG and must
    // leave an empty minvent even for species with fixed starting objects.
    if (initializeMonsterEquipment && receivesClericEquipment(mndx)) {
        // C ref: makemon.c m_initinv(), Priest/Cleric quest-leader branch.
        await mongets(rn2(7) ? ROBE
            : rn2(3) ? CLOAK_OF_PROTECTION : CLOAK_OF_MAGIC_RESISTANCE);
        await mongets(SMALL_SHIELD);
        await mkmonmoney(rn1(10, 20));
    }
    else if (initializeMonsterEquipment && questMonsterRepresentsRole(mndx, 'monk')) {
        await mongets(rn2(11) ? ROBE : CLOAK_OF_MAGIC_RESISTANCE);
    }
    if (initializeMonsterEquipment && MONSTER_SYMBOL[mndx] === 14) { // S_NYMPH
        // C ref: makemon.c m_initinv(), S_NYMPH.
        if (!rn2(2))
            await mongets(MIRROR);
        if (!rn2(2))
            await mongets(POT_OBJECT_DETECTION);
    }
    if (initializeMonsterEquipment && mndx === PM_MINOTAUR) {
        // C ref: makemon.c:m_initinv(), S_GIANT.  This probe belongs to the
        // explicit minotaur constructor, before the common defensive and
        // miscellaneous inventory reservoirs.
        if (!rn2(8) || (game.in_mklev && Is_earthlevel(game.u?.uz)))
            await mongets(WAN_DIGGING);
    }
    else if (initializeMonsterEquipment && MONSTER_SYMBOL[mndx] === 34
        && (genderFlags & M2_GIANT)) {
        // C ref: makemon.c m_initinv(), is_giant().  Each iteration chooses
        // one weighted gem/glass type, creates it without ordinary object
        // initialization, and replaces its stack size with rn1(2,3).
        for (let count = rn2(Math.trunc(baseLevel / 2)); count > 0; count--) {
            const gem = await mksobj(rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1), false, false);
            gem.quan = rn1(2, 3);
            gem.quantity = gem.quan;
            gem.owt = (OBJECT_WEIGHT[gem.otyp] ?? 1) * gem.quan;
            await addCreatedObjectToMonsterInventory(pendingMonster, gem, game);
            hasMonsterInventory = true;
        }
    }
    if (initializeMonsterEquipment && MONSTER_SYMBOL[mndx] === 12) { // S_LEPRECHAUN
        await mkmonmoney(d(level_difficulty(), 30));
    }
    if (initializeMonsterEquipment && mndx === MONSTER_NAME.indexOf('Nazgul')) {
        const ring = await mksobj(RIN_INVISIBILITY, false, false);
        ring.cursed = true;
        await addCreatedObjectToMonsterInventory(pendingMonster, ring, game);
        hasMonsterInventory = true;
    }
    if (initializeMonsterEquipment && MONSTER_SYMBOL[mndx] === 39) { // S_MUMMY
        if (rn2(7))
            await mongets(MUMMY_WRAPPING);
    }
    if (initializeMonsterEquipment && MONSTER_SYMBOL[mndx] === 38) { // S_LICH
        if (mndx === 185 && !rn2(13)) { // PM_MASTER_LICH
            await mongets(rn2(7) ? ATHAME : WAN_NOTHING);
        }
        else if (mndx === 186 && !rn2(3)) { // PM_ARCH_LICH
            const weapon = await mksobj(rn2(3) ? ATHAME : QUARTERSTAFF, true, !rn2(13));
            if (weapon.spe < 2)
                weapon.spe = rnd(3);
            if (!rn2(4))
                weapon.oerodeproof = true;
            await addCreatedObjectToMonsterInventory(pendingMonster, weapon, game);
            hasMonsterInventory = true;
        }
    }
    if (initializeMonsterEquipment && MONSTER_SYMBOL[mndx] === 33) { // S_GNOME
        // C ref: makemon.c m_initinv(), S_GNOME.  During Mines generation
        // the candle chance is 1/20 (1/60 elsewhere).
        const candleChance = game.in_mklev && In_mines(game.u.uz) ? 20 : 60;
        if (!rn2(candleChance)) {
            const candle = await mksobj(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, true, false);
            candle.quan = candle.quantity = 1;
            candle.owt = objectWeight(candle);
            await addCreatedObjectToMonsterInventory(pendingMonster, candle, game);
            hasMonsterInventory = true;
            if (candle.where !== 'gone' && !level.at(x, y)?.lit)
                beginObjectBurn(candle);
        }
    }
    if (initializeMonsterEquipment && MONSTER_SYMBOL[mndx] === 43) { // S_QUANTMECH
        // C ref: makemon.c m_initinv().  The class switch evaluates the rare
        // Schrödinger-box probe before its PM_QUANTUM_MECHANIC species test,
        // so genetic engineers consume the same rn2(20) even though they can
        // never receive the box.  Keep the success path as a real contained-
        // object transaction so later discovery can observe the same owner.
        if (!rn2(20) && mndx === 210) { // PM_QUANTUM_MECHANIC
            const box = await mksobj(LARGE_BOX, false, false);
            const cat = await mksobj(CORPSE, true, false);
            box.spe = 1;
            set_corpsenm(cat, 33); // PM_HOUSECAT
            stopObjectTimer(cat, OBJECT_TIMER_KIND.ROT_CORPSE);
            cat.otrapped = false;
            await addCreatedObjectToContainer(box, cat);
            box.owt = objectWeight(box);
            await addCreatedObjectToMonsterInventory(pendingMonster, box, game);
            hasMonsterInventory = true;
        }
    }
    if (initializeMonsterEquipment && mndx === 298 && !rn2(4))
        await mongets(SPEAR); // PM_ICE_DEVIL
    if (initializeMonsterEquipment && mndx === PM_ASMODEUS) {
        // C makemon.c:m_initinv(), S_DEMON.  Asmodeus has no weapon attack,
        // so his fixed cold/fire wands are inventory declarations rather
        // than m_initweap() gear and precede both common magic reservoirs.
        await mongets(WAN_COLD);
        await mongets(WAN_FIRE);
    }
    // m_initinv() finishes with level-gated defensive and miscellaneous item
    // choices for every monster.
    if (initializeMonsterEquipment && !skipCommonMonsterInventory) {
        const defensiveRoll = rn2(50);
        if (baseLevel > defensiveRoll) {
            const defensiveItem = randomDefensiveMonsterItem(pendingMonster);
            if (defensiveItem)
                await mongets(defensiveItem);
        }
        const miscellaneousRoll = rn2(100);
        if (baseLevel > miscellaneousRoll) {
            const miscellaneousItem = randomMiscMonsterItem(pendingMonster);
            if (miscellaneousItem)
                await mongets(miscellaneousItem);
        }
    }
    // C ref: makemon.c m_initinv().  Greedy monsters get a final gold gate
    // after the defensive and miscellaneous reservoirs.  Amount dice depend
    // on whether class-specific equipment already populated the inventory.
    if (initializeMonsterEquipment && (genderFlags & M2_GREEDY)
        && !monsterInventory.some(object => object.otyp === GOLD_PIECE)
        && !rn2(5)) {
        const amount = d(level_difficulty(), hasMonsterInventory ? 5 : 10);
        if (amount > 0) {
            await mkmonmoney(amount);
        }
    }
    const classIndex = MONSTER_SYMBOL[mndx] || 0;
    // C makemon.c initializes strategic presentation state for waiting and
    // covetous species unless the caller explicitly supplies MM_NOWAIT.
    // STRAT_APPEARMSG is consumed by the first visible relocation message;
    // it cannot be reconstructed later from the monster's current species.
    const flags3 = questMonsterFlags3(mndx);
    let monsterStrategy = 0;
    if (!(mmflags & MM_NOWAIT)) {
        if (flags3 & 0x0040)
            monsterStrategy |= STRAT_WAITFORU;
        if (flags3 & 0x0080)
            monsterStrategy |= STRAT_CLOSE;
        if (flags3 & (0x00c0 | 0x001f))
            monsterStrategy |= STRAT_APPEARMSG;
    }
    // makemon.c's S_BAT type initialization calls
    // mon_adjust_speed(MFAST) for native bats born in Gehennom.  This is a
    // permanent-speed property of the actor, not a projection of its current
    // species; vampire bases which immediately shapechange into a bat do not
    // pass through this birth-time branch.
    const hellishNativeBat = [PM_BAT, PM_GIANT_BAT, PM_VAMPIRE_BAT].includes(mndx)
        && !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    const monster = {
        m_id: monsterId,
        mnum: mndx, cham: pendingMonster.cham ?? -1,
        mx: x, my: y, mhp: hp, mhpmax: hp,
        m_lev: baseLevel, female: monsterFemale,
        mwandexp: pendingMonster.mwandexp ?? false,
        msleeping: monsterSleeping,
        mpeaceful: pendingMonster.mpeaceful,
        mavenge: pendingMonster.mavenge ?? 0,
        malign: pendingMonster.malign,
        mcanmove: 1, mcansee: 1,
        mgenmklev: !!game.in_mklev,
        seen_resistance: 0,
        mux: pendingMonster.mux, muy: pendingMonster.muy,
        mundetected: false,
        minvis: !!pendingMonster.minvis,
        perminvis: !!pendingMonster.perminvis,
        movement: 0, mmove: MONSTER_MOVE[mndx] ?? 0,
        permspeed: hellishNativeBat ? 2 : 0,
        mspeed: hellishNativeBat ? 2 : 0,
        symbol: monsterClassSymbol(mndx),
        color: requireMonsterData(MONSTER_COLOR, mndx),
        hasInventory: hasMonsterInventory,
        minvent: monsterInventory,
        inventory: monsterInventory,
        mstrategy: monsterStrategy,
        // makemon() allocates weapon_check as NO_WEAPON_WANTED (zero).
        // m_initweap() only supplies inventory; the first AT_WEAP slot will
        // request NEED_HTH_WEAPON if no weapon is currently wielded.  Later
        // pickup, polymorph, and loss paths explicitly set NEED_WEAPON.
        weaponCheck: 0,
    };
    if (pendingMonster.mextra)
        monster.mextra = pendingMonster.mextra;
    if (pendingMonster.edog)
        monster.edog = pendingMonster.edog;
    if (pendingMonster.emin)
        monster.emin = pendingMonster.emin;
    if (pendingMonster.epri)
        monster.epri = pendingMonster.epri;
    if (pendingMonster.eshk)
        monster.eshk = pendingMonster.eshk;
    if (pendingMonster._egd)
        monster._egd = pendingMonster._egd;
    if (pendingMonster.mcorpsenm !== undefined)
        monster.mcorpsenm = pendingMonster.mcorpsenm;
    if (pendingMonster.mtrapseen !== undefined)
        monster.mtrapseen = pendingMonster.mtrapseen;
    if (roamingMinion) {
        monster.isminion = 1;
        monster.maligntyp = roamingMinion.min_align;
    }
    if (mndx === PM_LONG_WORM) {
        if (pendingMonster.wormno !== undefined)
            monster.wormno = pendingMonster.wormno;
        if (pendingMonster.wormSegments !== undefined)
            monster.wormSegments = pendingMonster.wormSegments;
        if (pendingMonster.wormHead !== undefined)
            monster.wormHead = pendingMonster.wormHead;
        if (pendingMonster.wormGrowTime !== undefined)
            monster.wormGrowTime = pendingMonster.wormGrowTime;
    }
    if (Number.isInteger(pendingMonster.cham))
        monster.cham = pendingMonster.cham;
    if (mndx === PM_WIZARD_OF_YENDOR) {
        monster.iswiz = true;
    }
    restoreMonsterInventoryOwnership(monster);
    if (allowMonsterInventory) {
        await initializeMonsterArmor(monster);
        await maybeGiveDomesticSaddle(monster);
        monster.hasInventory = monsterInventory.length > 0;
    }
    if (isMimic) {
        monster.m_ap_type = pendingMonster.m_ap_type ?? M_AP_NOTHING;
        monster.mappearance = pendingMonster.mappearance ?? 0;
        if (pendingMonster.mcorpsenm != null)
            monster.mcorpsenm = pendingMonster.mcorpsenm;
    }
    if (generatedGhostName != null)
        setMonsterGivenName(monster, generatedGhostName);
    registerQuestLeader(monster);
    level.monsters[monsterIndex] = monster;
    // makemon() asks hideunder() for spiders, snakes, and eels. Its
    // terrain, trap, and corpse checks also apply during level creation.
    if (game.in_mklev && [19, 45, 57].includes(classIndex))
        await hideMonsterUnder(monster);
    if (allowMonsterInventory)
        await deliverOrcRaidLoot(monster, game);
    return finishMonsterBirth(monster, mmflags);
}
// Direct-coordinate creation for source callers which deliberately bypass
// enexto(), such as savebones() creating the dead hero's ghost on u.ux/u.uy.
export async function makemonAt(mnum, x, y, flags = 0) {
    return makemon(mnum, x, y, flags);
}
// C makemon.c:create_critters().  Wands, scrolls, and spells all create
// monsters through the ordinary constructor.  The return value says whether
// the hero saw or sensed at least one result.
export async function createCritters(count, mnum = null, neverAsk = false) {
    let known = false;
    let ask = !!game.flags.debug && !neverAsk;
    while (count-- > 0) {
        if (ask) {
            if (await createParticularMonster()) {
                known = true;
                continue;
            }
            ask = false;
        }
        if (mnum == null && game.level?.flags?.rndmongen === false)
            continue;
        let monster = null;
        if (mnum == null && game.u?.uinwater) {
            const wetPosition = findMonsterNearPosition(PM_GIANT_EEL, game.u.ux, game.u.uy);
            if (wetPosition) {
                monster = await makemon(null, wetPosition.x, wetPosition.y, 0);
            }
            else {
                monster = await makemonNear(null, game.u.ux, game.u.uy, 0, true);
            }
        }
        else {
            monster = await makemonNear(mnum, game.u.ux, game.u.uy, 0, true);
        }
        if (!monster)
            continue;
        const appearance = M_AP_TYPE(monster);
        const visible = canSeeMonster(monster);
        const seenInOwnForm = visible
            && (appearance === M_AP_NOTHING || appearance === M_AP_MONSTER);
        if (seenInOwnForm || canSenseMonster(monster))
            known = true;
    }
    return known;
}
//# sourceMappingURL=makemon.js.map