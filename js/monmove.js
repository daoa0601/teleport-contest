// monmove.js — movement-ration state and the first live movement slice.
// C refs: allmain.c moveloop_core(), mon.c mcalcmove()/movemon()/mfndpos(),
// monmove.c m_move()/dochug(), and dogmove.c dog_goal()/dog_move().

import { d, rn2, rnd } from './rng.js';
import { game } from './gstate.js';
import { beginPetRangedTurn } from './dogmove.js';
import {
    beginMonsterSpitAttack, monsterSpitAttack, resolveMonsterSpitFlight,
} from './monster_spit.js';
import {
    MONSTER_POLEARMS,
    objectTypeName, placeAndStackThrownObject, placeThrownObject,
    RANGED_LAUNCHERS, readyRangedMonsterWeapon, selectRangedWeapon,
    throwMonsterWeaponAtHero,
} from './monster_throw.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { levelHasCeiling, monsterInAir } from './mon.js';
import { growMonster } from './monster_growth.js';
import { currentAttribute } from './attrib.js';
import { loseExperienceLevel } from './exper.js';
import {
    heroHasDrainResistance, heroHasFreeAction, heroIsDisplaced,
} from './armor.js';
import { heroHasConflict } from './hero_conflict.js';
import { drainHeroEnergy } from './hero_energy.js';
import {
    applyMonsterAntiMagicTrap, finishMonsterAntiMagicTrap,
} from './anti_magic_trap.js';
import {
    beginMonsterFireTrap, finishMonsterFireTrap,
} from './fire_trap.js';
import {
    beginMonsterLandMine, finishMonsterLandMine, landMineNeedsResume,
} from './landmine_trap.js';
import {
    beginMonsterPitTrap, finishMonsterPitTrap, monsterAvoidsPit,
} from './monster_pit_trap.js';
import {
    beginMonsterRockTrap, finishMonsterRockTrap, rockTrapNeedsResume,
} from './rock_trap.js';
import {
    beginMonsterProjectileTrap, finishMonsterProjectileTrap,
    projectileTrapNeedsResume,
} from './projectile_trap.js';
import {
    beginMonsterSleepGasTrap, finishMonsterSleepGasTrap,
    sleepGasTrapNeedsResume,
} from './sleep_gas_trap.js';
import {
    beginMonsterSqueakyBoard, finishMonsterSqueakyBoard,
} from './squeaky_board_trap.js';
import {
    beginMonsterVibratingSquare, finishMonsterVibratingSquare,
} from './vibrating_square_trap.js';
import {
    applyMonsterPolymorphTrap, finishMonsterPolymorphTrap,
} from './polymorph_trap.js';
import { heroGoldAmount, heroGoldObject } from './hero_gold.js';
import {
    moveExpelledMonster, releaseHeroFromMonster,
} from './hero_expulsion.js';
import { splitObjectStack } from './object_stack.js';
import {
    canProjectMonster, map_invisible, newsym, randomDisplayMonsterName,
    randomDisplayMonsterSubject, swallowed, unmap_invisible,
    plineWithContinuation,
} from './display.js';
import {
    MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_FLAGS2,
    MONSTER_FLAGS3,
    MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME,
    MONSTER_RESISTS, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CORR, AD_DCAY, AD_DREN,
    AD_DRLI, AD_DRST, AD_ELEC, AD_ENCH, AD_FIRE, AD_LEGS, AD_PHYS,
    AD_SAMU, AD_SEDU, AD_SITM, AD_SLIM, AD_SPEL, AD_STCK, AD_STON,
    AD_STUN, AD_WRAP, AD_RUST, AT_BOOM, AT_BREA, AT_ENGL, AT_GAZE,
    AT_MAGC, AT_SPIT, AT_TUCH, AT_WEAP,
} from './monster_attack_types.js';
import {
    AMULET_OF_YENDOR, APPLE, BANANA,
    BELL_OF_OPENING, BULLWHIP,
    BOULDER, CARROT, CANDELABRUM_OF_INVOCATION,
    CLOAK_OF_MAGIC_RESISTANCE,
    CLOVE_OF_GARLIC, CORPSE, DWARVISH_MATTOCK, EGG,
    FAKE_AMULET_OF_YENDOR, FLINT,
    ENORMOUS_MEATBALL, GOLD_PIECE, MEATBALL, MEAT_RING, MEAT_STICK,
    ARROW, AXE, BATTLE_AXE, DART, IRON_SHOES,
    OBJECT_BIMANUAL, OBJECT_CHARGED, OBJECT_DESCRIPTIONS,
    OBJECT_LARGE_DAMAGE, OBJECT_NAMES,
    OBJECT_SMALL_DAMAGE, IRON_CHAIN,
    OBJECT_SUBTYPE, PICK_AXE, ROCK,
    POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_SLEEPING,
    SLIME_MOLD,
    SPE_BOOK_OF_THE_DEAD, TIN, TRIPE_RATION, WAN_SPEED_MONSTER, WAN_STRIKING,
} from './object_data.js';
import { place_object, stack_object } from './floor_object.js';
import {
    makemonNear, mkcorpstat, mksobj,
    summonNastyMonsters, undeadToCorpse,
} from './mklev.js';
import { decideMonsterShapeChange } from './monster_polymorph.js';
import { isZombieMaker, zombieForm } from './corpse_species.js';
import { corpseKeepsMonsterTraits } from './monster_traits.js';
import { getTrack } from './track.js';
import { heroFormSticks, rehumanizeHero } from './polyself.js';
import {
    cansee, clearPath, couldsee, visibleCellsFrom, vision_note_blocker_change,
    vision_recalc,
} from './vision.js';
import { recordVanquished } from './end.js';
import { wipeEngravingAt } from './engrave.js';
import { markQuestLeaderDead } from './quest.js';
import { moveVaultGuard } from './vault.js';
import { collectNearbyCoords } from './u_init.js';
import { shopkeeperInOwnShop } from './shk.js';
import {
    checkMonsterGearNextTurn, findMonsterArmorClass, reassessMonsterArmor,
    nameMonsterForCreationArmorChecks,
} from './monworn.js';
import { inTown } from './room.js';
import {
    createHarmlessGasCloudSelection, createSteamCloud,
} from './regions.js';
import { syncBlindness } from './senses.js';
import { touchPetrifies } from './stoning.js';
import { clearHeroSliming } from './slime.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
import { preventMonsterDeath } from './mondeath.js';
import { priestIsInOwnTemple } from './priest.js';
import {
    addObjectToMonsterInventory, dropObjectFromMonsterInventory,
    linkObjectToMonsterInventory,
    removeObjectFromMonsterInventory,
} from './monster_inventory.js';
import {
    currentMonsterLoad, monsterCanCarryObject, monsterCarryAmount,
} from './monster_carry.js';
export { monsterCanCarryObject } from './monster_carry.js';
import {
    monsterCanFogWithEmptyInventory, monsterCanOozeWithEmptyInventory,
    setMonsterApparentHeroPosition,
} from './monster_perception.js';
import { randomBottleName } from './potion_hit.js';
import {
    adjustMonsterSpeed, monsterSpeedMessage,
} from './monster_speed.js';
import {
    setMonsterPermanentInvisibility,
} from './monster_invisibility.js';
import { msummon } from './minion.js';
import {
    randomMonsterRelocation, monsterIsScaredAt, teleportMonsterFromTrap,
} from './teleport.js';
import {
    monsterGoodPosition, monsterTeleportRestricted,
} from './teleport_rules.js';
import {
    applyMonsterRustTrap, burnArmorByFire, monsterTrapVisibility,
} from './trap.js';
import {
    wereChange,
} from './were.js';
import {
    A_CHA, A_DEX, A_STR,
    ACCESSIBLE, ALLOW_BARS, ALLOW_DIG, ALLOW_M, ALLOW_ROCK, ALLOW_SANCT,
    ALLOW_SSM,
    ALLOW_TRAPS, ALLOW_U, ALLOW_WALL,
    ARROW_TRAP, BEAR_TRAP, BOLT_LIM, COLNO, CORR, DART_TRAP, DOOR, ROWNO,
    D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED,
    Is_firelevel, Is_waterlevel,
    IS_DOOR, IS_LAVA, IS_OBSTRUCTED, IS_POOL, IS_ROOM, IS_STWALL, IS_TREE,
    IS_WALL,
    IRONBARS, LAVAPOOL, LAVAWALL,
    MAGIC_PORTAL, OPENDOOR, TELEP_TRAP,
    ANTI_MAGIC, FIRE_TRAP, HOLE, LANDMINE, MAGIC_TRAP,
    M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING,
    M_AP_OBJECT, POLY_TRAP, RUST_TRAP,
    PIT, ROCKTRAP, ROLLING_BOULDER_TRAP, ROOM, SLP_GAS_TRAP, STONE,
    SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TRAPDOOR,
    G_GONE, G_NOCORPSE,
    NEED_AXE, NEED_HTH_WEAPON, NEED_PICK_AXE, NEED_PICK_OR_AXE,
    NEED_WEAPON, NO_WEAPON_WANTED,
    MM_NOWAIT, NOTONL, STRAT_APPEARMSG, STRAT_WAITFORU, STRAT_WAITMASK,
    UNLOCKDOOR, VIBRATING_SQUARE,
    WATER, W_ACCESSORY, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH,
    W_ARMOR,
    W_ARMS, W_ARMU, W_NONDIGGABLE, W_NONPASSWALL,
    Upolyd, is_pit, isok,
    WEB, WT_TOOMUCH_DIAGONAL,
} from './const.js';

export const NORMAL_SPEED = 12;
export const MSLOW = 1;
export const MFAST = 2;

const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_CLING = 0x00000010;
const M1_WALLWALK = 0x00000008;
const M1_TUNNEL = 0x00000020;
const M1_NEEDPICK = 0x00000040;
const M1_CONCEAL = 0x00000080;
const M1_HIDE = 0x00000100;
const M1_NOEYES = 0x00001000;
const M1_NOHANDS = 0x00002000;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
const M1_SLITHY = 0x00080000;
const M1_UNSOLID = 0x00100000;
const M1_SEE_INVIS = 0x01000000;
const M1_TPORT = 0x02000000;
const M1_ACID = 0x08000000;
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const M1_METALLIVORE = 0x80000000;
const M1_REGEN = 0x00800000;
const M2_WANDER = 0x00800000;
const M2_STRONG = 0x04000000;
const M2_ROCKTHROW = 0x08000000;
const M2_GREEDY = 0x10000000;
const M2_JEWELS = 0x20000000;
const S_EYE = 5;
const S_DOG = 4;
const S_HUMAN = 53;
const S_LEPRECHAUN = 12;
const S_NYMPH = 14;
const S_LIGHT = 25;
const S_VORTEX = 22;
const S_BLOB = 2;
const S_JELLY = 10;
const S_FUNGUS = 32;
const S_ELEMENTAL = 31;
const S_GHOST = 54;
const S_SNAKE = 45;
const S_EEL = 57;
const PM_ETTIN = 174;
const PM_JABBERWOCK = 178;
const PM_FIRE_ELEMENTAL = 155;
const PM_AIR_ELEMENTAL = 154;
const PM_SALAMANDER = 329;
const M2_COLLECT = 0x40000000;
const M2_MAGIC = 0x80000000;
const M3_COVETOUS = 0x001f;
const M3_WANTSAMUL = 0x0001;
const M3_WANTSBELL = 0x0002;
const M3_WANTSBOOK = 0x0004;
const M3_WANTSCAND = 0x0008;
const M3_WANTSARTI = 0x0010;
const PM_FOG_CLOUD = 106;
const PM_ENERGY_VORTEX = 109;
const PM_TENGU = 55;
const PM_BABY_PURPLE_WORM = 113;
const PM_PURPLE_WORM = 115;
const PM_SHRIEKER = 163;
const PM_DEATH = 311;
const PM_FAMINE = 313;
const PM_STALKER = 153;
const PM_LICHEN = 158;
const PM_LEATHER_GOLEM = 253;
const PM_FLESH_GOLEM = 255;
const PM_LIZARD = 326;
const PM_IRON_GOLEM = 259;
const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;
const WAN_MAGIC_MISSILE = 429;
const S_GOLEM = 55;
const POT_SPEED = 302;
const LOW_BOOTS = 163;
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const ROCK_CLASS = 14;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const DOGFOOD = 0;
const CADAVER = 1;
const ACCFOOD = 2;
const MANFOOD = 3;
const APPORT = 4;
const POISON = 5;
const UNDEF = 6;
const PRACTICAL_OBJECT_CLASSES = new Set([
    WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS, FOOD_CLASS,
]);
const MAGICAL_OBJECT_CLASSES = new Set([
    AMULET_CLASS, POTION_CLASS, SCROLL_CLASS,
    WAND_CLASS, RING_CLASS, SPBOOK_CLASS,
]);
const MONSTER_SEARCH_POTIONS = new Set([
    299, // confusion
    300, // blindness
    301, // paralysis
    307, // healing
    308, // extra healing
    309, // gain level
    314, // sleeping
    315, // full healing
    316, // polymorph
    320, // acid
]);
const MONSTER_SEARCH_CONTAINERS = new Set([
    214, // large box
    215, // chest
    216, // ice box
    217, // sack
    218, // oilskin sack
    219, // bag of holding
]);
const MONSTER_SEARCH_SCROLLS = new Set([
    329, // create monster
    333, // teleportation
    339, // fire
    340, // earth
]);

// C monmove.c:can_hide_under_obj().  Floor piles are stored as source-ordered
// arrays in JS, so array membership supplies OBJ_FLOOR/OBJ_AT ownership.
// A non-coin object is always substantial enough; an all-coin prefix needs a
// total quantity of at least ten unless a non-coin follows it.
export function canMonsterHideUnderObjectAt(state, x, y) {
    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (!pile.length) return false;
    const trap = state?.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (trap && !is_pit(trap.ttyp)) return false;

    let coinQuantity = 0;
    for (const object of pile) {
        if ((object.oclass ?? object.class) !== COIN_CLASS) return true;
        coinQuantity += object.quan ?? object.quantity ?? 1;
        if (coinQuantity >= 10) return true;
    }
    return false;
}

const MCF_INDIRECT = 0x01;
const MCF_HOSTILE = 0x04;
const MONSTER_CLERIC_SPELLS = [
    { key: 'open-wounds', level: 0, flags: MCF_HOSTILE },
    { key: 'cure-self', level: 1, flags: MCF_INDIRECT },
    { key: 'confuse-you', level: 2, flags: MCF_HOSTILE },
    { key: 'paralyze', level: 4, flags: MCF_HOSTILE },
    { key: 'blind-you', level: 6, flags: MCF_HOSTILE },
    { key: 'insects', level: 8, flags: MCF_HOSTILE | MCF_INDIRECT },
    { key: 'curse-items', level: 10, flags: MCF_HOSTILE },
    { key: 'lightning', level: 11, flags: MCF_HOSTILE },
    { key: 'fire-pillar', level: 12, flags: MCF_HOSTILE },
    { key: 'geyser', level: 13, flags: MCF_HOSTILE },
];
const MONSTER_WIZARD_SPELLS = [
    { key: 'psi-bolt', level: 0, flags: MCF_HOSTILE },
    { key: 'cure-self', level: 1, flags: MCF_INDIRECT },
    { key: 'haste-self', level: 2, flags: MCF_INDIRECT },
    { key: 'stun-you', level: 3, flags: MCF_HOSTILE },
    { key: 'disappear', level: 4, flags: MCF_INDIRECT },
    { key: 'weaken-you', level: 6, flags: MCF_HOSTILE },
    { key: 'destroy-armor', level: 8, flags: MCF_HOSTILE },
    { key: 'curse-items', level: 10, flags: MCF_HOSTILE },
    { key: 'aggravation', level: 13, flags: MCF_HOSTILE | MCF_INDIRECT },
    { key: 'summon-monsters', level: 15, flags: MCF_HOSTILE | MCF_INDIRECT },
    { key: 'clone-wizard', level: 18, flags: MCF_HOSTILE | MCF_INDIRECT },
    { key: 'death-touch', level: 20, flags: MCF_HOSTILE },
];

function monsterSpellEffectPreview(spell, damage, state) {
    const antimagic = !!state?.u?.antimagic;
    let effectDamage = damage;
    if (antimagic && ['psi-bolt', 'open-wounds'].includes(spell.key))
        effectDamage = Math.trunc((effectDamage + 1) / 2);
    let effectMessage = null;
    if (spell.key === 'psi-bolt') {
        effectMessage = effectDamage <= 5
            ? 'You get a slight headache.'
            : effectDamage <= 10
                ? 'Your brain is on fire!'
                : effectDamage <= 20
                    ? 'Your head suddenly aches painfully!'
                    : 'Your head suddenly aches very painfully!';
    } else if (spell.key === 'open-wounds') {
        effectMessage = effectDamage <= 5
            ? 'Your skin itches badly for a moment.'
            : effectDamage <= 10
                ? 'Wounds appear on your body!'
                : effectDamage <= 20
                    ? 'Severe wounds appear on your body!'
                    : 'Your body is covered with painful wounds!';
    } else if (spell.key === 'blind-you') {
        effectMessage = 'Scales cover your eyes!';
    } else if (spell.key === 'paralyze') {
        const resisted = !!(state?.u?.antimagic
            || heroHasFreeAction(state));
        effectMessage = resisted
            ? 'You stiffen briefly.' : 'You are frozen in place!';
    } else if (spell.key === 'confuse-you') {
        if (antimagic) {
            effectMessage = 'You feel momentarily dizzy.';
        } else if (state?.u?.hallucinating
            || (state?.u?.hallucinationTurns ?? 0) > 0) {
            effectMessage = (state?.u?.confusionTurns ?? 0) > 0
                ? 'You feel trippier!' : 'You feel trippy!';
        } else {
            effectMessage = (state?.u?.confusionTurns ?? 0) > 0
                ? 'You feel more confused!' : 'You feel confused!';
        }
    } else if (spell.key === 'weaken-you') {
        effectMessage = antimagic
            ? 'You feel momentarily weakened.'
            : 'You suddenly feel weaker!';
    } else if (spell.key === 'aggravation') {
        effectMessage = 'You feel that monsters are aware of your presence.';
    } else if (spell.key === 'stun-you') {
        const resisted = antimagic || heroHasFreeAction(state);
        const alreadyStunned = !!state?.u?.stunned
            || (state?.u?.stunnedTurns ?? 0) > 0;
        effectMessage = resisted
            ? alreadyStunned ? null : 'You feel momentarily disoriented.'
            : alreadyStunned
                ? 'You struggle to keep your balance.' : 'You reel...';
    } else if (spell.key === 'curse-items') {
        effectMessage = 'You feel as if you need some help.';
    } else if (spell.key === 'geyser') {
        effectMessage = 'A sudden geyser slams into you from nowhere!';
    } else if (spell.key === 'fire-pillar') {
        effectMessage = 'A pillar of fire strikes all around you!';
    } else if (spell.key === 'lightning') {
        effectMessage = 'A bolt of lightning strikes down at you from above!';
    }
    return { effectDamage, effectMessage };
}

// C weapon.c:hwep[], strongest/preferred first. The object data does not yet
// expose this table, so these names select the matching object types.
const HAND_TO_HAND_WEAPON_PREFERENCE = [
    'tsurugi', 'runesword', 'dwarvish mattock', 'two-handed sword',
    'battle-axe', 'katana', 'unicorn horn', 'crysknife', 'trident',
    'long sword', 'elven broadsword', 'broadsword', 'scimitar',
    'silver saber', 'morning star', 'elven short sword',
    'dwarvish short sword', 'short sword', 'orcish short sword',
    'silver mace', 'mace', 'axe', 'dwarvish spear', 'silver spear',
    'elven spear', 'spear', 'orcish spear', 'flail', 'bullwhip',
    'quarterstaff', 'javelin', 'aklys', 'club', 'pick-axe',
    'rubber hose', 'war hammer', 'silver dagger', 'elven dagger',
    'dagger', 'orcish dagger', 'athame', 'scalpel', 'knife', 'worm tooth',
];
const HAND_TO_HAND_WEAPON_RANK = new Map(
    HAND_TO_HAND_WEAPON_PREFERENCE.map((name, index) => [name, index]),
);

function monsterHasWeaponAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(([attackType]) => attackType === AT_WEAP);
}

function selectHandToHandWeapon(monster) {
    const inventory = monster?.minvent || monster?.inventory || [];
    const strong = !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_STRONG);
    const wearingShield = !!((monster?.misc_worn_check ?? 0) & W_ARMS);
    let best = null;
    let bestRank = Number.POSITIVE_INFINITY;
    for (const object of inventory) {
        if (object?.oclass !== WEAPON_CLASS && object?.class !== 'Weapons')
            continue;
        // C select_hwep() rejects every bimanual candidate unless the
        // monster is strong and has both hands free.  Keep an unusable
        // weapon in minvent; mon_wield_item() simply fails and lets an
        // adjacent AT_WEAP slot continue bare-handed.
        if (OBJECT_BIMANUAL[object.otyp] && (!strong || wearingShield))
            continue;
        // select_hwep() is an allowlist, not a generic "any weapon" choice.
        // In particular, carried polearms are deliberately absent because
        // their close-range owner is the ranged/polearm path.
        const rank = HAND_TO_HAND_WEAPON_RANK.get(objectTypeName(object));
        if (rank === undefined) continue;
        if (!best || rank < bestRank) {
            best = object;
            bestRank = rank;
        }
    }
    return best;
}

// C monmove.c:m_digweapon_check().  A pick-dependent tunneller may select a
// diggable destination while unarmed, but it must spend this action readying
// the appropriate tool before a later turn can enter and excavate the square.
function readyMonsterDiggingWeapon(monster, state, x, y) {
    const loc = state?.level?.at?.(x, y);
    if (!loc || !monsterCanTunnel(monster, state)
        || !((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_NEEDPICK))
        return null;

    const closedDoor = IS_DOOR(loc.typ)
        && !!((loc.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    const tree = IS_TREE(loc.typ);
    const rock = IS_STWALL(loc.typ) && !tree;
    if (!closedDoor && !tree && !rock) return null;

    const inventory = monster?.minvent || monster?.inventory || [];
    const hasShield = inventory.some(object =>
        ((object?.owornmask ?? 0) & W_ARMS) !== 0);
    const isPick = object => object?.otyp === PICK_AXE
        || object?.otyp === DWARVISH_MATTOCK && !hasShield;
    const isAxe = object => object?.otyp === AXE
        || object?.otyp === BATTLE_AXE && !hasShield;
    const accepts = closedDoor
        ? object => isPick(object) || isAxe(object)
        : tree ? isAxe : isPick;
    const current = monsterWieldedWeapon(monster);
    if (accepts(current)) {
        monster.weaponCheck = NO_WEAPON_WANTED;
        return null;
    }
    if (current?.cursed) return null;

    monster.weaponCheck = closedDoor ? NEED_PICK_OR_AXE
        : tree ? NEED_AXE : NEED_PICK_AXE;
    const tool = inventory.find(accepts);
    if (!tool) return null;
    if (current) current.wielded = false;
    monster.mw = tool;
    tool.wielded = true;
    monster.weaponCheck = NO_WEAPON_WANTED;
    return tool;
}

function monsterHasLauncherAndAmmo(monster) {
    const carriedNames = new Set(
        (monster?.minvent || monster?.inventory || []).map(objectTypeName),
    );
    for (const [ammo, launchers] of RANGED_LAUNCHERS) {
        if (carriedNames.has(ammo)
            && Array.from(launchers).some(name => carriedNames.has(name)))
            return true;
    }
    return false;
}

function monsterHasAvailableDistanceAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || []).some(([attackType]) =>
        attackType === AT_SPIT || attackType === AT_BREA
        || attackType === AT_MAGC || attackType === AT_GAZE);
}

function floorObjectClass(object) {
    if (Number.isInteger(object?.oclass)) return object.oclass;
    return {
        Weapons: WEAPON_CLASS,
        Armor: ARMOR_CLASS,
        Rings: RING_CLASS,
        Amulets: AMULET_CLASS,
        Food: FOOD_CLASS,
        Potions: POTION_CLASS,
        Scrolls: SCROLL_CLASS,
        Spellbooks: SPBOOK_CLASS,
        Wands: WAND_CLASS,
        Coins: COIN_CLASS,
        'Gems/Stones': GEM_CLASS,
        Gems: GEM_CLASS,
        Rocks: ROCK_CLASS,
    }[object?.class] ?? 0;
}

// C monmove.c:mon_would_take_item().  Movement targeting and post-move
// pickup must share this policy; otherwise an actor can pursue an object it
// refuses to collect, or walk past one it should have selected as its goal.
function monsterWantsFloorObject(monster, object) {
    if (!monster || !object || object === monster.uball
        || object === monster.uchain) return false;
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    const flags1 = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const oclass = floorObjectClass(object);
    // Unicorns are a source-level exception before searches_for_item(): they
    // ignore every non-gem object, including otherwise useful containers and
    // potions. Mineral gem-class objects are filtered by material elsewhere.
    if ([101, 102, 103].includes(monster.mnum) && oclass !== GEM_CLASS)
        return false;
    // C muse.c:searches_for_item() gives every intelligent, non-animal
    // monster a small set of useful objects independent of its species'
    // COLLECT or MAGIC flags.
    if (!(flags1 & (M1_MINDLESS | M1_ANIMAL))
        && (MONSTER_SEARCH_POTIONS.has(object.otyp)
            || MONSTER_SEARCH_SCROLLS.has(object.otyp)
            || (MONSTER_SEARCH_CONTAINERS.has(object.otyp)
                && !object.olocked && !object.locked
                && !(object.otyp === 219 && object.cursed)))) {
        return true;
    }
    if ((flags & M2_GREEDY) && object.otyp === GOLD_PIECE) return true;
    if ((flags & M2_JEWELS) && oclass === GEM_CLASS) return true;
    if ((flags & M2_COLLECT) && PRACTICAL_OBJECT_CLASSES.has(oclass))
        return true;
    if ((flags & M2_MAGIC) && MAGICAL_OBJECT_CLASSES.has(oclass)) return true;
    if ((flags & M2_ROCKTHROW) && object.otyp === BOULDER) return true;
    return false;
}

function specialFloorPrize(object) {
    return !!(object?.minesPrize || object?.sokoPrize
        || object?.isMinesPrize || object?.isSokoPrize);
}

function monsterRejectsOrdinaryCorpsePickup(monster, object) {
    if (object?.otyp !== CORPSE
        || MONSTER_SYMBOL[monster?.mnum] === S_NYMPH) return false;
    const corpsenm = object.corpsenm;
    const petrifiesOnTouch = touchPetrifies(corpsenm);
    const acidic = !!((MONSTER_FLAGS1[corpsenm] ?? 0) & M1_ACID);
    return !petrifiesOnTouch && corpsenm !== PM_LIZARD && !acidic;
}

// C mon.c:mpickstuff() and monmove.c:postmov().  An interested monster takes
// one eligible floor stack after moving, transfers it from the level's fobj
// chain into minvent, and defers gear selection until a later action.
function pickUpMonsterFloorObject(monster, state) {
    // C mon.c:mpickstuff() leaves a shopkeeper's displayed stock on the
    // floor while they are inside their own shop.  It belongs to the shop's
    // floor chain, not to the resident's personal inventory.
    if (shopkeeperInOwnShop(monster, state)) return null;
    const pile = state?.level?.objects?.[monster.mx]?.[monster.my];
    if (!Array.isArray(pile) || !pile.length) return null;
    const index = pile.findIndex(object => !specialFloorPrize(object)
        && monsterWantsFloorObject(monster, object)
        && !monsterRejectsOrdinaryCorpsePickup(monster, object)
        && monsterCanCarryObject(monster, object));
    if (index < 0) return null;

    const object = pile[index];
    const quantity = object.quan ?? object.quantity ?? 1;
    const carryAmount = monsterCarryAmount(monster, object);
    let carriedObject;
    if (carryAmount < quantity) {
        // mon.c:mpickstuff() splits the carryable portion from the floor
        // parent before extracting it.  splitobj() allocates a distinct id
        // even when the child immediately enters monster inventory.
        carriedObject = splitObjectStack(object, carryAmount, state);
    } else {
        [carriedObject] = pile.splice(index, 1);
    }
    // mpickobj() attaches carrying effects before add_to_minv() head-links the
    // new identity into the source-ordered minvent array.
    addObjectToMonsterInventory(monster, carriedObject, state);
    monster.weaponCheck = NEED_WEAPON;
    checkMonsterGearNextTurn(monster);
    return carriedObject;
}

// C monmove.c:dochug() phase two.  A close weapon attacker may spend its
// whole action readying carried equipment before phase-three movement.  This
// transition is deliberately RNG-free but changes every later actor's stream.
function readyCloseMonsterWeapon(monster, state) {
    if (monster?.mpeaceful || monster?.pet || monster?.mtame
        || !monsterHasWeaponAttack(monster)
        || monster.weaponCheck !== NEED_WEAPON) return null;
    const apparentX = Number.isFinite(monster.mux)
        ? monster.mux : state?.u?.ux;
    const apparentY = Number.isFinite(monster.muy)
        ? monster.muy : state?.u?.uy;
    if (!Number.isFinite(apparentX) || !Number.isFinite(apparentY)
        || dist2(monster.mx, monster.my, apparentX, apparentY) > 8) return null;

    monster.weaponCheck = NEED_HTH_WEAPON;
    const weapon = selectHandToHandWeapon(monster);
    if (!weapon || monster.mw?.otyp === weapon.otyp) {
        monster.weaponCheck = NEED_WEAPON;
        return null;
    }
    if (monster.mw) monster.mw.wielded = false;
    monster.mw = weapon;
    weapon.wielded = true;
    monster.weaponCheck = NEED_WEAPON;
    return weapon;
}

function heroCanReleaseWeapon(object) {
    // C canletgo(): a wielded cursed weapon is welded in place.  The
    // miscellaneous-item caller has already limited this to active weapons.
    return !!object && !object.cursed;
}

function probeMonsterPotionOccupant(
    object, state, random = rn2, calls = [],
) {
    if (!object || (object.oclass ?? object.class) !== POTION_CLASS)
        return null;
    const appearance = state?.objectDescriptions?.[object.otyp]
        ?? game.objectDescriptions?.[object.otyp]
        ?? OBJECT_DESCRIPTIONS[object.otyp];
    const occupantMnum = appearance === 'milky' ? 287
        : appearance === 'smoky' ? 315 : null;
    if (occupantMnum === null
        || ((state?.mvitals?.[occupantMnum]?.mvflags ?? 0) & G_GONE)) {
        return null;
    }
    const born = state?.mvitals?.[occupantMnum]?.born ?? 0;
    const sides = 13 + 2 * born;
    return {
        appearance,
        occupant: appearance === 'milky' ? 'ghost' : 'djinni',
        triggered: recordRandom(random, calls, sides) === 0,
    };
}

// C muse.c find_misc()/use_misc().  JavaScript minvent mirrors the C chain
// head-to-tail.  Scan newest-to-oldest and retain each later viable type,
// exactly matching C's "last viable item wins" loop.
function useMonsterMiscItem(monster, state, random, calls) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if ((flags & (M1_MINDLESS | M1_ANIMAL))
        || dist2(monster.mx, monster.my,
            monster.mux ?? state?.u?.ux ?? monster.mx,
            monster.muy ?? state?.u?.uy ?? monster.my) > 36) return null;
    if (flags & M1_NOHANDS) return null;

    const inventory = monster.minvent || monster.inventory || [];
    const heroWeapon = state?.uwep || state?.u?.uwep || null;
    const heroSwapWeapon = state?.uswapwep || state?.u?.uswapwep || null;
    const apparentX = monster.mux ?? state?.u?.ux ?? monster.mx;
    const apparentY = monster.muy ?? state?.u?.uy ?? monster.my;
    const heroX = state?.u?.ux ?? monster.mx;
    const heroY = state?.u?.uy ?? monster.my;
    const heroSeesInvisible = !!(
        state?.u?.seeInvisible || state?.u?.see_invisible
    );
    const hasGaze = (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(([attackType]) => attackType === AT_GAZE);
    let selected = null;

    for (let index = 0; index < inventory.length; index++) {
        const object = inventory[index];
        // muse.c:find_misc() lets a temple priest use an uncursed gain-level
        // potion, but rejects a cursed one so the resident cannot leave the
        // shrine level. Growth remains deferred across both mquaffmsg()
        // toplines.
        if (object.otyp === POT_GAIN_LEVEL
            && (!object.cursed
                || (!monster.isgd && !monster.isshk
                    && !monster.ispriest))) {
            selected = {
                kind: 'potion-gain-level', object, index,
                deferredEffect: true,
            };
        }
        if (selected?.kind !== 'bullwhip-disarm'
            && object.otyp === BULLWHIP && !monster.mpeaceful && heroWeapon) {
            // Source ordering is intentional: rn2(5) precedes the wielded,
            // location, adjacency, and canletgo predicates.
            const attempt = recordRandom(random, calls, 5) === 0;
            if (attempt && object === monster.mw
                && apparentX === heroX && apparentY === heroY
                && distmin(monster.mx, monster.my, heroX, heroY) <= 1
                && !state?.u?.uswallow
                && (heroCanReleaseWeapon(heroWeapon)
                    || (state?.u?.twoweap
                        && heroCanReleaseWeapon(heroSwapWeapon)))) {
                selected = {
                    kind: 'bullwhip-disarm', object, index,
                    heroWeapon, heroSwapWeapon,
                };
            }
        }
        if (selected?.kind !== 'potion-invisibility'
            && object.otyp === POT_INVISIBILITY && !monster.minvis
            && !monster.invis_blkd
            && (!monster.mpeaceful || heroSeesInvisible)
            && (!hasGaze || monster.mcan)) {
            selected = { kind: 'potion-invisibility', object, index };
        }
        if (selected?.kind !== 'wand-speed-monster'
            && object.otyp === WAN_SPEED_MONSTER && (object.spe ?? 0) > 0
            && monster.mspeed !== MFAST && !monster.isgd) {
            selected = { kind: 'wand-speed-monster', object, index };
        }
        if (selected?.kind !== 'potion-speed'
            && object.otyp === POT_SPEED && monster.mspeed !== MFAST
            && !monster.isgd) {
            selected = { kind: 'potion-speed', object, index };
        }
    }
    if (!selected) return null;

    const occupantProbe = probeMonsterPotionOccupant(
        selected.object, state, random, calls,
    );
    if (occupantProbe?.triggered) {
        return {
            ...selected,
            kind: 'potion-occupant',
            ...occupantProbe,
            deferredOccupant: true,
        };
    }

    if (selected.kind === 'potion-gain-level') return selected;
    if (selected.kind === 'potion-invisibility') {
        // mquaffmsg() can suspend on an older topline.  allmain applies the
        // state change and consumes the potion only after that await resumes.
        return { ...selected, deferredEffect: true };
    }
    if (selected.kind === 'bullwhip-disarm') {
        // use_misc() chooses the destination before any two-weapon target
        // selection.  Removal itself follows the urgent wrap message.
        const whereTo = recordRandom(random, calls, 4);
        let target = selected.heroWeapon;
        if (!heroCanReleaseWeapon(target)
            || (state?.u?.twoweap
                && heroCanReleaseWeapon(selected.heroSwapWeapon)
                && recordRandom(random, calls, 2))) {
            target = selected.heroSwapWeapon;
        }
        return {
            ...selected,
            target,
            whereTo: heroCanReleaseWeapon(target) ? whereTo : 0,
            deferredEffect: true,
        };
    }

    const { object } = selected;
    const wand = object.otyp === WAN_SPEED_MONSTER;
    return {
        ...selected,
        kind: wand ? 'wand-speed-monster' : 'potion-speed',
        deferredEffect: true,
    };
}

function removeMonsterInventoryObject(monster, object) {
    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(object);
    if ((object.quan ?? object.quantity ?? 1) > 1) {
        if (Number.isInteger(object.quan)) object.quan--;
        if (Number.isInteger(object.quantity)) object.quantity--;
    } else if (index >= 0) {
        inventory.splice(index, 1);
    }
    monster.minvent = inventory;
    monster.inventory = inventory;
}

function placeDisarmedHeroWeapon(state, object, x, y) {
    if (state === game) {
        place_object(object, x, y);
        return;
    }
    if (!state.level.objects?.[x]) state.level.objects[x] = [];
    if (!state.level.objects[x][y]) state.level.objects[x][y] = [];
    state.level.objects[x][y].push(object);
    object.ox = x;
    object.oy = y;
    object.where = 'floor';
}

// Complete the state half of a miscellaneous action only after its leading
// tty message has returned.  This preserves use_misc() suspension boundaries.
export function finishDeferredMonsterMiscItem(action, state = game) {
    const monster = action?.monster;
    const misc = action?.movement?.usedMisc;
    if (!monster || !misc?.deferredEffect || misc.effectApplied) return misc;

    if (misc.kind === 'potion-invisibility') {
        setMonsterPermanentInvisibility(monster, !misc.object.cursed);
        removeMonsterInventoryObject(monster, misc.object);
        misc.effectApplied = true;
        return misc;
    }

    if (misc.kind === 'potion-gain-level') {
        removeMonsterInventoryObject(monster, misc.object);
        if (misc.object.cursed) {
            misc.cursedGainLevel = true;
            misc.effectApplied = true;
            return misc;
        }
        misc.growth = growMonster(monster, {
            state,
            rollOne: rnd,
            random: rn2,
            calls: action.calls,
        });
        misc.increase = misc.growth.maxIncrease;
        misc.effectApplied = true;
        return misc;
    }

    if (misc.kind === 'wand-speed-monster'
        || misc.kind === 'potion-speed') {
        if (misc.kind === 'wand-speed-monster') {
            misc.object.spe--;
        } else {
            removeMonsterInventoryObject(monster, misc.object);
        }
        const speed = adjustMonsterSpeed(monster, 1);
        misc.oldSpeed = speed.oldSpeed;
        misc.speedChanged = speed.changed && speed.canDescribe
            && monster.mcanmove !== 0;
        misc.speedMuch = speed.much;
        misc.effectApplied = true;
        return misc;
    }

    if (misc.kind === 'bullwhip-disarm') {
        const target = misc.target;
        if (!target || misc.whereTo === 0) {
            misc.whereTo = 0;
            misc.effectApplied = true;
            return misc;
        }
        const primaryWeaponRemoved = state.uwep === target
            || state.u?.uwep === target;
        for (const slot of ['uwep', 'uswapwep', 'uquiver']) {
            if (state[slot] === target) state[slot] = null;
            if (state.u?.[slot] === target) state.u[slot] = null;
        }
        // wield.c:uwepgone()/setuwep(NULL) records a one-shot transition so
        // the next ordinary melee attack announces bare-handed combat.
        if (primaryWeaponRemoved) state._unweapon = true;
        if (state.u?.twoweap) state.u.twoweap = false;
        target.owornmask = 0;
        target.worn = false;
        target.wielded = false;
        target.alternate = false;
        target.ready = false;
        const heroInventory = state.inventory || [];
        const heroIndex = heroInventory.indexOf(target);
        if (heroIndex >= 0) heroInventory.splice(heroIndex, 1);
        if (misc.whereTo === 3) {
            // muse.c:use_misc(MUSE_BULLWHIP)->mpickobj().  The disarmed
            // identity is free of hero equipment state before the monster
            // applies carrying effects and links it into minvent.
            addObjectToMonsterInventory(monster, target, state);
        } else {
            const x = misc.whereTo === 1 ? monster.mx : state.u.ux;
            const y = misc.whereTo === 1 ? monster.my : state.u.uy;
            placeDisarmedHeroWeapon(state, target, x, y);
        }
        misc.effectApplied = true;
    }
    return misc;
}

// C muse.c:find_defensive(TRUE)/use_defensive(), healing-potion slice used
// by m_move() when mfndpos() finds no legal adjacent square.  The `TRUE`
// escape retry deliberately bypasses the ordinary low-HP gate, so even a
// full-health monster can spend the potion rather than remain boxed in.
function useNoMoveHealingPotion(
    monster, state, random, rollDice, calls,
) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (flags & (M1_NOHANDS | M1_MINDLESS | M1_ANIMAL)) return null;

    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.findIndex(object => object.otyp === POT_HEALING);
    if (index < 0) return null;
    const object = inventory[index];

    // muse.c:precheck() probes shuffled milky/smoky potion appearances
    // before mquaffmsg() and the healing roll.  The nonzero result is the
    // ordinary potion path.  Occupant creation remains an explicit deferred
    // boundary rather than silently skipping the mandatory probe.
    const occupantProbe = probeMonsterPotionOccupant(
        object, state, random, calls,
    );
    if (occupantProbe?.triggered) {
        return {
            kind: 'potion-healing',
            object,
            occupant: occupantProbe.occupant,
            deferredOccupant: true,
        };
    }

    const dice = 6 + 2 * (object.blessed ? 1 : object.cursed ? -1 : 0);
    const amount = rollDice(dice, 4);
    calls.push(`d(${dice},4)`);
    const oldMaximum = monster.mhpmax ?? monster.mhp ?? 1;
    const oldHitPoints = monster.mhp ?? oldMaximum;
    if (oldHitPoints + amount > oldMaximum + 1) {
        monster.mhpmax = oldMaximum + 1;
        monster.mhp = monster.mhpmax;
    } else {
        monster.mhp = oldHitPoints + amount;
        monster.mhpmax = Math.max(oldMaximum, monster.mhp);
    }
    if (!object.cursed && monster.mcansee === 0) {
        monster.mcansee = 1;
        monster.mblinded = 0;
    }
    if ((object.quan ?? 1) > 1) object.quan--;
    else inventory.splice(index, 1);
    monster.minvent = inventory;
    monster.inventory = inventory;
    return {
        kind: 'potion-healing',
        object,
        amount,
    };
}

export function naturalMonsterSpeed(monster) {
    if (Number.isFinite(monster?.mmove)) return monster.mmove;
    return MONSTER_MOVE[monster?.mnum] ?? 0;
}

export function initializeMonsterMovement(monster) {
    if (!monster) return monster;
    if (!Number.isFinite(monster.movement)) monster.movement = 0;
    if (!Number.isFinite(monster.mmove))
        monster.mmove = naturalMonsterSpeed(monster);
    if (!Number.isFinite(monster.mspeed)) monster.mspeed = 0;
    return monster;
}

// JS stores monsters in creation order by appending to level.monsters.
// C's makemon() prepends to fmon, so all scheduler traversals are reversed.
export function monstersInFmonOrder(monsters = []) {
    return Array.from(monsters).reverse();
}

function visibleRegionAt(state, x, y) {
    return (state?.level?.regions || []).some(region => region.visible
        && region.ttl !== -2 && region.cells?.some(cell =>
            cell.x === x && cell.y === y));
}

function createFogEveryturnRegion(state, x, y, random = rn2) {
    if (!state?.level || visibleRegionAt(state, x, y)) return null;
    return createHarmlessGasCloudSelection(
        state, [{ x, y }], { ttl: 4 + random(3) },
    );
}

// C monmove.c:m_everyturn_effect().  movemon_singlemon() runs this before its
// movement-ration check, so an otherwise stationary fog cloud still leaves a
// one-cell harmless vapor region.  A size-one create_gas_cloud() owns only the
// rn1(3,4) TTL draw; the region then suppresses another cloud at that square.
function monsterEveryturnEffect(monster, state, random = rn2) {
    if (!state?.level || monster?.mnum !== PM_FOG_CLOUD
        || visibleRegionAt(state, monster.mx, monster.my)) return null;
    return createFogEveryturnRegion(
        state, monster.mx, monster.my, random,
    );
}

export function runMonsterEveryturnEffects(
    monsters, state, random = rn2, { fmonOrdered = false } = {},
) {
    const effects = [];
    const visits = fmonOrdered
        ? Array.from(monsters || []) : monstersInFmonOrder(monsters || []);
    for (const monster of visits) {
        initializeMonsterMovement(monster);
        if (!schedulable(monster)) continue;
        const effect = monsterEveryturnEffect(monster, state, random);
        if (effect) effects.push({ monster, effect });
    }
    return effects;
}

// C allmain.c invokes the same species hook for `youmonst` after status
// projection and before accepting the next command.  The region persists on
// the level and suppresses another TTL draw while it covers the hero square.
export function heroEveryturnEffect(state = game, random = rn2) {
    if ((state.u?.mtimedone ?? 0) <= 0
        || state.u?.umonnum !== PM_FOG_CLOUD) return null;
    return createFogEveryturnRegion(
        state, state.u.ux, state.u.uy, random,
    );
}

// C ref: mon.c mcalcdistress()/m_calcdistress(). JS appends monsters while C
// prepends them to fmon, so this once-per-global-turn phase traverses the
// reverse of creation order just like movement allocation does. Yielding at
// each transformation lets its messages and consequences finish before the
// next source-ordered random decision.
export function* monsterDistressEvents(
    monsters = [], state = {}, random = rn2,
    distressTurn = state.moves ?? 1,
) {
    for (const monster of monstersInFmonOrder(monsters)) {
        if (!monster) continue;
        if ((MONSTER_MOVE[monster.mnum] ?? 0) === 0) {
            yield { kind: 'stationary-liquid', monster };
            if (monster.dead || (monster.mhp ?? 1) <= 0) continue;
        }
        if ((distressTurn % 20 === 0
                || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_REGEN))
            && Number.isFinite(monster.mhp)
            && Number.isFinite(monster.mhpmax)) {
            monster.mhp = Math.min(monster.mhpmax, monster.mhp + 1);
        }
        if ((monster.mspec_used ?? 0) > 0) monster.mspec_used--;

        const changedShape = decideMonsterShapeChange(
            monster, state, random,
        );
        if (changedShape) {
            yield {
                kind: 'shape-change',
                monster,
                change: changedShape,
            };
        }
        const changedWere = wereChange(monster, state, random);
        if (changedWere) {
            yield {
                kind: 'were-change',
                monster,
                change: changedWere,
            };
        }
        if ((monster.mblinded ?? 0) > 0 && --monster.mblinded === 0)
            monster.mcansee = 1;
        if ((monster.mfrozen ?? 0) > 0 && --monster.mfrozen === 0)
            monster.mcanmove = 1;
        if ((monster.mfleetim ?? 0) > 0 && --monster.mfleetim === 0)
            monster.mflee = 0;
    }
}

// C ref: mon.c mcalcmove(). `random` is injectable for deterministic unit
// tests; production always uses the core PRNG wrapper.
export function mcalcmove(
    monster, moving = true, random = rn2, state = game,
) {
    initializeMonsterMovement(monster);
    let mmove = naturalMonsterSpeed(monster);

    if (monster.mspeed === MSLOW) {
        mmove = mmove < NORMAL_SPEED
            ? Math.trunc((2 * mmove + 1) / 3)
            : 4 + Math.trunc(mmove / 3);
    } else if (monster.mspeed === MFAST) {
        mmove = Math.trunc((4 * mmove + 2) / 3);
    }

    if (monster === state.u?.usteed
        && (state.u?.ugallop ?? 0) > 0
        && state.context?.mv) {
        mmove = Math.trunc((random(2) ? 4 : 5) * mmove / 3);
    }

    if (moving) {
        const adjustment = mmove % NORMAL_SPEED;
        mmove -= adjustment;
        // NetHack performs this draw even when adjustment is zero.
        if (random(NORMAL_SPEED) < adjustment) mmove += NORMAL_SPEED;
    }
    return mmove;
}

export function allocateMonsterMovement(
    monsters = [], random = rn2, state = game,
) {
    const allocations = [];
    for (const monster of monstersInFmonOrder(monsters)) {
        const amount = mcalcmove(monster, true, random, state);
        monster.movement += amount;
        allocations.push({ monster, amount, movement: monster.movement });
    }
    return allocations;
}

function schedulable(monster) {
    return monster && (monster.mhp ?? 1) > 0
        // x=0 is NetHack's off-map sentinel; y=0 is the valid north row.
        && monster.mx !== 0;
}

// The quiet part of mon.c:movemon(): scan in fmon order, debit one ration
// from every eligible actor, and repeat only while an actor retained another
// full ration. Actor behavior is deliberately left to dochug()/dog_move().
export function scanMonsterMovement(monsters = [], options = {}) {
    const heroMovement = options.heroMovement ?? 0;
    const rounds = [];
    const visits = [];
    let somebodyCanMove;

    do {
        somebodyCanMove = false;
        const actors = [];
        const roundVisits = [];
        for (const monster of monstersInFmonOrder(monsters)) {
            initializeMonsterMovement(monster);
            if (!schedulable(monster)) continue;
            roundVisits.push(monster);
            if (monster.movement < NORMAL_SPEED)
                continue;
            monster.movement -= NORMAL_SPEED;
            actors.push(monster);
            if (monster.movement >= NORMAL_SPEED) somebodyCanMove = true;
        }
        visits.push(roundVisits);
        rounds.push(actors);
        if (heroMovement >= NORMAL_SPEED) break;
    } while (somebodyCanMove);

    return {
        rounds,
        visits,
        actors: rounds.flat(),
        somebodyCanMove,
    };
}

function dist2(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function monsterAt(state, x, y, ignore = null) {
    return state?.level?.monsters?.find(monster => monster !== ignore
        && (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y);
}

function speciesIsUnique(mnum) {
    return !!((MONSTER_GENO[mnum] ?? 0) & 0x1000);
}

function zombiePairIsAggressive(attacker, defender, state) {
    if (!isZombieMaker(attacker?.mnum, attacker?.mcan)
        || zombieForm(defender?.mnum) == null) return false;
    if (attacker.mgenmklev && defender.mgenmklev) return false;
    if (sameDungeonLevel(state?.stronghold_level, state?.u?.uz)) return false;
    return !speciesIsUnique(attacker.mnum)
        && !speciesIsUnique(defender.mnum);
}

function monstersAreAggressive(attacker, defender, state) {
    if (!attacker || !defender
        || attacker === defender
        || attacker.mtame && defender.mtame) return false;
    if ([PM_BABY_PURPLE_WORM, PM_PURPLE_WORM].includes(attacker.mnum)
        && defender.mnum === PM_SHRIEKER) return true;
    return zombiePairIsAggressive(attacker, defender, state)
        || zombiePairIsAggressive(defender, attacker, state);
}

function isUnicorn(monster) {
    return monster?.mnum >= 101 && monster?.mnum <= 103;
}

function monsterIsCovetous(monster) {
    return !!((MONSTER_FLAGS3[monster?.mnum] ?? 0) & M3_COVETOUS);
}

function monsterCanTunnel(monster, state) {
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (!(speciesFlags & M1_TUNNEL)
        || state?.level?.flags?.rogue_level
        || state?.level?.flags?.is_rogue_level) return false;
    if (!(speciesFlags & M1_NEEDPICK)) return true;

    const targetX = Number.isFinite(monster?.mux)
        ? monster.mux : state?.u?.ux;
    const targetY = Number.isFinite(monster?.muy)
        ? monster.muy : state?.u?.uy;
    const prefersCloseWeapon = (!monster?.mpeaceful || heroHasConflict(state))
        && Number.isFinite(targetX) && Number.isFinite(targetY)
        && dist2(monster.mx, monster.my, targetX, targetY) <= 8;
    return !prefersCloseWeapon;
}

function monsterCorrodesBars(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(([, damageType]) => damageType === AD_RUST
            || damageType === AD_CORR);
}

function monsterPassesBars(monster) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const size = MONSTER_SIZE[monster?.mnum] ?? 2;
    return !!(flags & (M1_WALLWALK | M1_AMORPHOUS | M1_UNSOLID
        | M1_METALLIVORE))
        || MONSTER_SYMBOL[monster?.mnum] === S_VORTEX
        || size === 0
        || monsterCorrodesBars(monster)
        || !!(flags & M1_SLITHY) && size < 3;
}

function carriedHeroPassesBars(state) {
    const hero = state?.u;
    if (!Upolyd(hero)) return false;
    const flags = MONSTER_FLAGS1[hero.umonnum] ?? 0;
    const size = MONSTER_SIZE[hero.umonnum] ?? 2;
    return !!(flags & M1_UNSOLID) || size === 0;
}

function monAllowFlags(monster, state) {
    let flags = monster?.pet || monster?.mtame
        ? ALLOW_M | ALLOW_TRAPS | ALLOW_SANCT | ALLOW_SSM
        : monster?.mpeaceful ? ALLOW_SANCT | ALLOW_SSM : ALLOW_U;
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (!(speciesFlags & M1_NOHANDS)) flags |= OPENDOOR;
    // mon_allowflags(): phasing monsters admit ordinary rock/wall terrain
    // and boulder squares. W_NONPASSWALL remains an explicit level-author
    // veto which mfndpos() checks per destination.
    if (speciesFlags & M1_WALLWALK) flags |= ALLOW_ROCK | ALLOW_WALL;
    // Ordinary tunnellers do not phase through rock.  ALLOW_DIG asks
    // mfndpos() to admit only the terrain their currently available tool can
    // cut; m_move() may then spend the action wielding that tool before the
    // monster enters the selected square.
    if (monsterCanTunnel(monster, state)) flags |= ALLOW_DIG;
    // An engulfer or holder can carry the hero through bars only when the
    // hero's current form could fit through too.
    if (monsterPassesBars(monster)
        && (monster !== state?.u?.ustuck || carriedHeroPassesBars(state))) {
        flags |= ALLOW_BARS;
    }
    // A unicorn which can escape by teleporting refuses every square directly
    // lined up with its perceived hero position.  On a no-teleport level,
    // mfndpos() retains and marks those squares so m_move() can use one only
    // when no off-line alternative exists.
    if (isUnicorn(monster) && !monsterTeleportRestricted(monster, state))
        flags |= NOTONL;
    // Key ownership is not represented yet. Riders and the Wizard of Yendor
    // will add UNLOCKDOOR when their metadata/state owners are ported.
    return flags;
}

// C ref: trap.c:m_harmless_trap().  mfndpos() marks only harmful traps in
// candidate info; dog_move() then applies its separate hero-seen 1/40 rule.
function monsterTrapIsHarmless(monster, trap, state) {
    if (!trap) return true;
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster?.mnum];
    // trap.c:floor_trigger() is the complete set bypassed by flight.  Magic,
    // anti-magic, polymorph, teleport, and portal traps affect airborne
    // actors and must still participate in known-trap avoidance.
    const floorTriggered = [
        ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, BEAR_TRAP,
        LANDMINE, ROLLING_BOULDER_TRAP, SLP_GAS_TRAP, RUST_TRAP,
        FIRE_TRAP, PIT, SPIKED_PIT, HOLE, TRAPDOOR,
    ].includes(trap.ttyp);
    if (!state?.level?.flags?.sokoban_rules
        && floorTriggered && (speciesFlags & M1_FLY))
        return true;
    if (trap.ttyp === BEAR_TRAP)
        return (MONSTER_SIZE[monster?.mnum] ?? 2) <= 1;
    if (trap.ttyp === WEB) {
        return !!(speciesFlags & (M1_AMORPHOUS | M1_UNSOLID))
            || [94, 96].includes(monster?.mnum)
            || symbol === S_VORTEX
            || monster?.mnum === PM_AIR_ELEMENTAL;
    }
    return [RUST_TRAP, STATUE_TRAP, MAGIC_TRAP, VIBRATING_SQUARE]
        .includes(trap.ttyp);
}

// C ref: monmove.c:m_avoid_kicked_loc().  dokick() retains its directed
// target through the elapsed monster turn, so a cooperative monster which
// can see does not immediately occupy the square the hero just kicked.
export function monsterAvoidsKickedLocation(monster, x, y, state = {}) {
    const kicked = state?._kickedLoc;
    const heroX = state?.u?.ux;
    const heroY = state?.u?.uy;
    return !!(kicked
        && (monster?.mpeaceful || monster?.mtame || monster?.pet)
        && monster?.mcansee !== false && monster?.mcansee !== 0
        && !monster?.mconf && !monster?.mstun && !heroHasConflict(state)
        && kicked.x === x && kicked.y === y
        && Number.isFinite(heroX) && Number.isFinite(heroY)
        && distmin(x, y, heroX, heroY) <= 1);
}

// C ref: monmove.c m_avoid_soko_push_loc(). A peaceful monster must not
// occupy the square two steps from the hero when the intervening square holds
// a boulder: that is the stance the hero needs for a legal Sokoban push.
export function monsterAvoidsSokobanPushLocation(
    monster, x, y, state = {},
) {
    if (!state.level?.flags?.sokoban_rules
        || !(monster?.mpeaceful || monster?.mtame || monster?.pet)
        || monster?.mconf || monster?.mstun || heroHasConflict(state)
        || dist2(x, y, state.u?.ux ?? x, state.u?.uy ?? y) !== 4) {
        return false;
    }
    const bx = x + Math.sign((state.u?.ux ?? x) - x);
    const by = y + Math.sign((state.u?.uy ?? y) - y);
    return (state.level?.objects?.[bx]?.[by] || [])
        .some(object => object.otyp === BOULDER);
}

function resistConflict(monster, state, rollOne, calls) {
    const charisma = state?.u?.acurr?.a?.[A_CHA] ?? 3;
    const monsterLevel = monster?.m_lev
        ?? MONSTER_LEVEL[monster?.mnum] ?? 0;
    const heroLevel = state?.u?.ulevel ?? 1;
    const resistChance = Math.min(19,
        charisma - monsterLevel + heroLevel);
    const roll = rollOne(20);
    calls.push('rnd(20)');
    return roll > resistChance;
}

function monsterDigCapabilities(monster, flags) {
    let rockOk = false;
    let treeOk = false;
    if (!(flags & ALLOW_DIG)) return { rockOk, treeOk };

    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (!(speciesFlags & M1_NEEDPICK))
        return { rockOk: true, treeOk: true };

    const inventory = monster?.minvent || monster?.inventory || [];
    const wielded = monsterWieldedWeapon(monster);
    if (wielded?.cursed
        && (monster?.weaponCheck ?? NO_WEAPON_WANTED)
            === NO_WEAPON_WANTED) {
        return {
            rockOk: [PICK_AXE, DWARVISH_MATTOCK].includes(wielded.otyp),
            treeOk: [AXE, BATTLE_AXE].includes(wielded.otyp),
        };
    }

    const hasShield = inventory.some(object =>
        ((object?.owornmask ?? 0) & W_ARMS) !== 0);
    rockOk = inventory.some(object => object?.otyp === PICK_AXE
        || object?.otyp === DWARVISH_MATTOCK && !hasShield);
    treeOk = inventory.some(object => object?.otyp === AXE
        || object?.otyp === BATTLE_AXE && !hasShield);
    return { rockOk, treeOk };
}

function monsterMayDigLocation(loc) {
    if (!loc) return false;
    return !((IS_STWALL(loc.typ) || IS_TREE(loc.typ))
        && ((loc.wall_info ?? 0) & W_NONDIGGABLE));
}

// C hack.c:bad_rock().  The orthogonal cells around a diagonal move use the
// species' intrinsic tunnelling/passwall abilities, not the allow flags which
// were computed for the destination itself.
function badRockForMonster(monster, state, x, y) {
    const loc = state?.level?.at?.(x, y);
    if (!loc) return true;
    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (state?.level?.flags?.sokoban_rules
        && pile.some(object => object.otyp === BOULDER)) return true;
    if (!IS_OBSTRUCTED(loc.typ)) return false;
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const mayTunnel = !!(flags & M1_TUNNEL)
        && !(flags & M1_NEEDPICK)
        && monsterMayDigLocation(loc);
    const mayPassWall = !!(flags & M1_WALLWALK)
        && !(IS_STWALL(loc.typ)
            && ((loc.wall_info ?? 0) & W_NONPASSWALL));
    return !mayTunnel && !mayPassWall;
}

function monsterCannotSqueezeThrough(monster, state) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (flags & M1_WALLWALK) return false;
    const flexible = !!(flags & (M1_AMORPHOUS | M1_SLITHY | M1_UNSOLID))
        || MONSTER_SYMBOL[monster?.mnum] === S_VORTEX
        || monster?.mnum === PM_AIR_ELEMENTAL
        || monsterCanFogWithEmptyInventory(monster, state);
    if ((MONSTER_SIZE[monster?.mnum] ?? 0) >= 3 && !flexible) return true;
    return currentMonsterLoad(monster) > WT_TOOMUCH_DIAGONAL;
}

// Source-order neighbour generation for ordinary land monsters. The returned
// order is an observable part of NetHack's movement algorithm: x is the outer
// loop and y the inner loop, both increasing.
export function mfndpos(monster, state, flags = monAllowFlags(monster, state)) {
    const positions = [];
    const x = monster.mx;
    const y = monster.my;
    const now = state?.level?.at?.(x, y);
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster?.mnum];
    const levelFlags = state?.level?.flags || {};
    const waterLevel = !!levelFlags.is_waterlevel
        || state === game && Is_waterlevel(state?.u?.uz);
    const inAir = monsterInAir(monster, state);
    let wantPool = symbol === S_EEL;
    // C computes poolok once, before its land fallback for a beached eel.
    // On the Plane of Water even an airborne non-swimmer must stay off pool
    // cells; ordinary levels let airborne monsters cross them.
    const poolOk = !waterLevel && inAir
        || !!(speciesFlags & M1_SWIM) && !wantPool;
    const lavaOk = inAir
        || monster?.mnum === PM_FIRE_ELEMENTAL
        || monster?.mnum === PM_SALAMANDER;
    const { rockOk, treeOk } = monsterDigCapabilities(monster, flags);
    const throughDoor = !!(flags & ALLOW_WALL)
        || !!(flags & ALLOW_DIG) && (rockOk || treeOk);

    for (;;) {
      positions.length = 0;
      for (let nx = Math.max(1, x - 1); nx <= Math.min(79, x + 1); nx++) {
        for (let ny = Math.max(0, y - 1); ny <= Math.min(20, y + 1); ny++) {
            if (nx === x && ny === y) continue;
            // C's NODIAG() is a species rule rather than an mflags bit.
            // Grid bugs only move on Cartesian axes.
            if (monster.mnum === 116 && nx !== x && ny !== y) continue;
            const loc = state?.level?.at?.(nx, ny);
            if (!loc) continue;
            const mayPassWall = !!(flags & ALLOW_WALL)
                && !(IS_STWALL(loc.typ)
                    && ((loc.wall_info ?? 0) & W_NONPASSWALL));
            const mayTunnel = (IS_TREE(loc.typ) ? treeOk : rockOk)
                && monsterMayDigLocation(loc);
            if (IS_OBSTRUCTED(loc.typ) && !mayPassWall && !mayTunnel)
                continue;
            // WATER is the special-level water-wall terrain, not an ordinary
            // pool.  Even flyers and floaters cannot cross it unless their
            // species is also a swimmer.
            if (loc.typ === WATER && !(speciesFlags & M1_SWIM)) continue;
            if (loc.typ === IRONBARS
                && (!(flags & ALLOW_BARS)
                    || ((loc.wall_info ?? 0) & W_NONDIGGABLE)
                        && monsterCorrodesBars(monster))) continue;
            // C mon.c:mfndpos() keeps water and lava as distinct admission
            // predicates.  Grounded land monsters reject both; swimmers can
            // mix land and water, sea monsters initially insist on water,
            // and only airborne/lava-loving species can enter lava.
            if (loc.typ === LAVAWALL
                && (!lavaOk || !(flags & ALLOW_WALL))) continue;
            if (!(poolOk || IS_POOL(loc.typ) === wantPool)
                || !(lavaOk || !IS_LAVA(loc.typ))) continue;
            const engulfingHero = !!(state?.u?.uswallow
                && state.u.ustuck === monster);
            const slipsUnderDoor = !engulfingHero
                && (!!(speciesFlags & M1_AMORPHOUS)
                    || monsterCanFogWithEmptyInventory(monster));
            if (IS_DOOR(loc.typ)
                && !slipsUnderDoor
                && ((loc.doormask & D_CLOSED) && !(flags & OPENDOOR)
                    || (loc.doormask & D_LOCKED) && !(flags & UNLOCKDOOR))
                && !throughDoor) {
                continue;
            }
            if (nx !== x && ny !== y
                && (IS_DOOR(now?.typ)
                    && ((now?.doormask ?? 0) & ~D_BROKEN)
                    || IS_DOOR(loc.typ) && ((loc.doormask ?? 0) & ~D_BROKEN))) {
                continue;
            }

            let info = 0;
            if (monsterIsScaredAt(monster, state, nx, ny)) {
                if (!(flags & ALLOW_SSM)) continue;
                info |= ALLOW_SSM;
            }
            if (state?.u?.ux === nx && state?.u?.uy === ny) {
                // C mon.c:mfndpos() commits this perception update while it
                // enumerates the real hero square, before checking ALLOW_U.
                // A displaced monster therefore keeps the corrected target
                // even when it ultimately selects and moves to another cell.
                monster.mux = state.u.ux;
                monster.muy = state.u.uy;
                if (!(flags & ALLOW_U)) continue;
                info |= ALLOW_U;
            } else {
                const occupant = monsterAt(state, nx, ny, monster);
                if (occupant) {
                    if (!(flags & ALLOW_M)
                        && !monstersAreAggressive(
                            monster, occupant, state,
                        )) continue;
                    info |= ALLOW_M;
                }
            }
            const pile = state?.level?.objects?.[nx]?.[ny] || [];
            if (pile.some(object => object.otyp === BOULDER)) {
                if (!(flags & ALLOW_ROCK)) continue;
                info |= ALLOW_ROCK;
            }
            const heroInvisible = !!(state?.u?.invisible || state?.u?.invis);
            const monsterSeesHero = monster?.mcansee !== false
                && (!heroInvisible || (speciesFlags & M1_SEE_INVIS));
            const targetX = Number.isFinite(monster?.mux)
                ? monster.mux : state?.u?.ux;
            const targetY = Number.isFinite(monster?.muy)
                ? monster.muy : state?.u?.uy;
            const lineDx = nx - targetX;
            const lineDy = ny - targetY;
            if (monsterSeesHero && Number.isFinite(targetX)
                && Number.isFinite(targetY)
                && (!lineDx || !lineDy
                    || lineDy === lineDx || lineDy === -lineDx)) {
                if (flags & NOTONL) continue;
                info |= NOTONL;
            }
            // C rejects a diagonal only when both orthogonal shoulders are
            // bad rock and this particular monster is too large, inflexible,
            // or heavily loaded to squeeze through.  This happens before
            // candidate counting, so it also changes later mtrack RNG ranges.
            if (nx !== x && ny !== y
                && badRockForMonster(monster, state, x, ny)
                && badRockForMonster(monster, state, nx, y)
                && monsterCannotSqueezeThrough(monster, state)) {
                continue;
            }
            const trap = trapAt(state, nx, ny);
            if (trap && !monsterTrapIsHarmless(monster, trap, state)) {
                // C mfndpos(): a hostile may enter an unfamiliar harmful
                // trap, but after mintrap() records that trap type it rejects
                // every later square of that type before candidate counting.
                // Tame actors carry ALLOW_TRAPS and defer their separate
                // avoidance decision to dog_move().
                if (!(flags & ALLOW_TRAPS)
                    && monsterKnowsTrap(monster, trap)) continue;
                info |= ALLOW_TRAPS;
            }
            positions.push({ x: nx, y: ny, info });
        }
      }
      // Eels first consider only water.  If beached with no adjacent pool,
      // C retries the same x-major scan over land so they can crawl away.
      if (positions.length || !wantPool || IS_POOL(now?.typ)) break;
      wantPool = false;
    }
    return positions;
}

function recordRandom(random, calls, range) {
    calls.push(range);
    return random(range);
}

// Live monster scheduling needs the action object across tty continuations,
// but no gameplay branch reads the diagnostic RNG transcript. Keep the
// append-shaped dependency without allocating or retaining one array per
// actor. The empty iterator preserves the one continuation which merges a
// nested action log; there is deliberately nothing to merge in live mode.
const DISCARDED_CALL_LOG = Object.freeze({
    length: 0,
    push() { return 0; },
    *[Symbol.iterator]() {},
});

// C hack.h:AC_VALUE().  Hero AC below zero is deliberately randomized each
// time an attack transaction evaluates it; callers must retain the returned
// threshold across later slots of that same mattacku() invocation.
function sourceHeroArmorClass(state, rollOne, calls) {
    const armorClass = state?.u?.uac ?? 10;
    if (armorClass >= 0) return armorClass;
    const effective = -rollOne(-armorClass);
    calls.push(`rnd(${-armorClass})`);
    return effective;
}

function monsterAttackThreshold(monster, state, rollOne, calls) {
    let threshold = sourceHeroArmorClass(state, rollOne, calls) + 10
        + (monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0);
    if (heroHasNegativeMulti(state)) threshold += 4;
    if (monster.mtrapped) threshold -= 2;
    return Math.max(1, threshold);
}

// C mhitu.c:hitmu().  Negative AC has a second, independent role after a
// hit: once attack effects and knockback finish, it reduces positive damage
// by rnd(-uac), with a floor of one.  This is not the AC_VALUE to-hit draw.
function reduceHeroContactDamage(damage, state, rollOne, calls) {
    const armorClass = state?.u?.uac ?? 10;
    let appliedDamage = damage;
    if (appliedDamage > 0 && armorClass < 0) {
        const reduction = rollOne(-armorClass);
        calls.push(`rnd(${-armorClass})`);
        appliedDamage = Math.max(1, appliedDamage - reduction);
    }
    // mhitu.c:hitmu() applies Half_physical_damage only after negative-AC
    // reduction and rounds odd positive damage upward.
    if (appliedDamage > 0 && (state?.u?.halfPhysicalDamage
        || state?.u?.half_physical_damage)) {
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);
    }
    return appliedDamage;
}

function applyHeroContactDamage(state, damage) {
    const key = Upolyd(state?.u) ? 'mh' : 'uhp';
    state.u[key] = Math.max(0, (state.u[key] ?? 1) - damage);
}

// C mhitu.c:passiveum().  A damaging monster contact completes the old hero
// form's first AT_NONE/AT_BOOM response before mattacku() advances to another
// attack slot.  Even forms without an effective passive retain the rn2(3)
// gate from their first blank AT_NONE slot while polymorphed.
function applyHeroPassiveAfterContact(
    monster, state, random, rollDice, calls, oldFormMnum,
    deferColdAfterMessage = false,
) {
    if (!Number.isInteger(oldFormMnum)) return null;
    const passive = (MONSTER_ATTACKS[oldFormMnum] || [])
        .find(([attackType]) => attackType === 0 || attackType === 14);
    if (!passive) return null;
    const [, damageType = AD_PHYS, dice = 0, sides = 0] = passive;
    let damage = dice > 0
        ? rollDice(dice, sides)
        : sides > 0
            ? rollDice((MONSTER_LEVEL[oldFormMnum] ?? 0) + 1, sides)
            : 0;
    if (dice > 0) calls.push(`d(${dice},${sides})`);
    else if (sides > 0) {
        calls.push(`d(${(MONSTER_LEVEL[oldFormMnum] ?? 0) + 1},${sides})`);
    }

    // The old form selects the passive and its damage dice, but most effects
    // only fire if the hero remains polymorphed after the incoming damage.
    if (!Upolyd(state?.u) || recordRandom(random, calls, 3) === 0) damage = 0;

    let messageKind = null;
    if (damage > 0 && damageType === AD_COLD) {
        if ((MONSTER_RESISTS[monster?.mnum] ?? 0) & 0x02) {
            messageKind = 'cold-resistant';
            damage = 0;
        } else {
            messageKind = 'cold';
            if (deferColdAfterMessage) {
                return {
                    damageType, damage: 0, messageKind,
                    deferredColdDamage: damage,
                    attackerDied: false,
                };
            }
            const healingRemainder = recordRandom(random, calls, 2);
            state.u.mh += Math.trunc((damage + healingRemainder) / 2);
            if ((state.u.mhmax ?? 0) < state.u.mh)
                state.u.mhmax = state.u.mh;
        }
    } else if (damageType !== AD_PHYS) {
        // TODO: apply the remaining non-physical passive effects.
        damage = 0;
    }

    if (damage > 0) {
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
        if (monster.mhp <= 0) monster.dead = true;
    }
    return {
        damageType, damage, messageKind,
        attackerDied: (monster?.mhp ?? 0) <= 0,
    };
}

// C mhitu.c:passiveum(AD_COLD) prints the cold-response line before its
// healing remainder draw and before assess_dmg(). A tty overflow can suspend
// exactly there, so the live actor driver resumes this tail only after that
// line has been accepted.
export function resumeDeferredHeroPassive(
    action, state, random = rn2,
) {
    const passive = action?.movement?.attack?.passive;
    const damage = passive?.deferredColdDamage;
    if (!Number.isFinite(damage)) return passive;

    const healingRemainder = recordRandom(random, action.calls, 2);
    state.u.mh += Math.trunc((damage + healingRemainder) / 2);
    if ((state.u.mhmax ?? 0) < state.u.mh)
        state.u.mhmax = state.u.mh;

    const monster = action.monster;
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    if (monster.mhp <= 0) monster.dead = true;
    passive.damage = damage;
    passive.attackerDied = monster.mhp <= 0;
    delete passive.deferredColdDamage;
    return passive;
}

function heroHasNegativeMulti(state) {
    return !!state?._delayedAction || (state?._helplessTurns ?? 0) > 0
        || (state?._prayerTurnsRemaining ?? 0) > 0;
}

function lineBlockingTerrain(state, x, y) {
    if (!isok(x, y)) return true;
    const loc = state?.level?.at?.(x, y);
    if (!loc || IS_OBSTRUCTED(loc.typ)) return true;
    if (IS_DOOR(loc.typ)
        && ((loc.doormask ?? 0) & (D_CLOSED | D_LOCKED))) return true;
    return loc.typ === WATER || loc.typ === LAVAWALL;
}

// C refs: mthrowu.c:linedup()/lined_up() and monmove.c:m_move().  Hostile
// movement checks whether the monster has a clear throwing line before item
// search and candidate selection. A boulder blocks ordinary sight, but the
// source conditionally treats a boulder-only obstruction as aligned; that
// decision owns rn2(2 + number-of-boulder-squares).
function monsterLinedUpAt(monster, state, random, calls, ax, ay) {
    const bx = monster.mx;
    const by = monster.my;
    const tbx = ax - bx;
    const tby = ay - by;
    if ((!tbx && !tby)
        || (tbx && tby && Math.abs(tbx) !== Math.abs(tby))
        || distmin(ax, ay, bx, by) >= BOLT_LIM) return false;

    const dx = Math.sign(tbx);
    const dy = Math.sign(tby);
    const targetsHero = ax === (state?.u?.ux ?? ax)
        && ay === (state?.u?.uy ?? ay);
    // C linedup() first consults the current COULD_SEE bitmap for the hero
    // target (or clear_path() for a monster target).  A gas region can make
    // that answer false without being blocking_terrain(); the conditional
    // boulder fallback below must then retain its rn2(2) probe even when no
    // boulder is present.
    if (targetsHero
        ? couldSeeFromHero(state, bx, by)
        : clearPath(ax, ay, bx, by)) {
        return true;
    }
    let x = bx;
    let y = by;
    let boulderSpots = 0;
    do {
        x += dx;
        y += dy;
        if (lineBlockingTerrain(state, x, y)) return false;
        const pile = state?.level?.objects?.[x]?.[y] || [];
        if (pile.some(object => object.otyp === BOULDER)) boulderSpots++;
    } while (x !== ax || y !== ay);

    const inventory = monster?.minvent || monster?.inventory || [];
    const ignoresBoulders = !!((MONSTER_FLAGS2[monster?.mnum] ?? 0)
        & M2_ROCKTHROW)
        || inventory.some(object => object?.otyp === WAN_STRIKING);
    if (ignoresBoulders) return true;
    return recordRandom(random, calls, 2 + boulderSpots) < 2;
}

function hostileLinedUp(monster, state, random, calls) {
    return monsterLinedUpWithPerceivedHero(
        monster, state, random, calls,
    );
}

// C mthrowu.c:m_lined_up().  Ranged natural attacks aim at the monster's
// retained apparent hero coordinate, not necessarily the live hero square.
// A polymorphed hero's concealment test precedes the geometric line check.
function monsterLinedUpWithPerceivedHero(monster, state, random, calls) {
    const heroAppearance = state?.u?.m_ap_type ?? M_AP_NOTHING;
    if (Upolyd(state?.u)
        && recordRandom(random, calls, 25) !== 0
        && (state?.u?.uundetected
            || (heroAppearance !== M_AP_NOTHING
                && heroAppearance !== M_AP_MONSTER))) {
        return false;
    }
    return monsterLinedUpAt(
        monster, state, random, calls,
        Number.isFinite(monster?.mux)
            ? monster.mux : state?.u?.ux ?? monster.mx,
        Number.isFinite(monster?.muy)
            ? monster.muy : state?.u?.uy ?? monster.my,
    );
}

const ALWAYS_RESISTANT_OBJECTS = new Set([
    AMULET_OF_YENDOR,
    SPE_BOOK_OF_THE_DEAD,
    CANDELABRUM_OF_INVOCATION,
    BELL_OF_OPENING,
]);

function isQuestArtifact(object, state) {
    if (object?.questArtifact || object?.isQuestArtifact) return true;
    if (!(object?.artifact || object?.oartifact)) return false;
    const roleName = state?.urole?.artifactName?.toLowerCase();
    const objectName = (object?.artifactName || object?.oextra?.oname)
        ?.toLowerCase();
    return !!roleName && roleName === objectName;
}

function objectResistsWithoutRoll(object) {
    return ALWAYS_RESISTANT_OBJECTS.has(object?.otyp)
        || (object?.otyp === CORPSE
            && object?.corpsenm >= PM_DEATH
            && object?.corpsenm <= PM_FAMINE);
}

// C mondata.h:vegan().  dogfood() uses the corpse species' body class, not
// the eater's diet flags, before choosing CADAVER versus MANFOOD.
function veganCorpseSpecies(mnum) {
    if (!Number.isInteger(mnum)) return false;
    const symbol = MONSTER_SYMBOL[mnum];
    return symbol === S_BLOB
        || symbol === S_JELLY
        || symbol === S_FUNGUS
        || symbol === S_VORTEX
        || symbol === S_LIGHT
        || symbol === S_GHOST
        || symbol === S_ELEMENTAL && mnum !== PM_STALKER
        || symbol === S_GOLEM
            && mnum !== PM_FLESH_GOLEM && mnum !== PM_LEATHER_GOLEM;
}

// C dogfood() checks poisoned/trapped objects and the current role's quest
// artifact before calling obj_resists(obj, 0, 95).  obj_resists() itself
// short-circuits the invocation objects and Rider corpses.  Only an ordinary
// object which reaches its final branch owns rn2(100).
function dogFood(monster, object, random, calls, state) {
    const poisoned = !!(object?.opoisoned || object?.poisoned
        || object?.otrapped);
    const poisonResistant = !!((MONSTER_RESISTS[monster?.mnum] ?? 0) & 0x20);
    if (poisoned && !poisonResistant) return POISON;
    if (isQuestArtifact(object, state) || objectResistsWithoutRoll(object))
        return object?.cursed ? UNDEF : APPORT;

    const roll = recordRandom(random, calls, 100);
    const artifact = !!(object?.artifact || object?.oartifact);
    if (artifact && roll < 95) return object?.cursed ? UNDEF : APPORT;
    if (object?.oclass === FOOD_CLASS) {
        const diet = MONSTER_FLAGS1[monster?.mnum] ?? 0;
        const carnivorous = !!(diet & M1_CARNIVORE);
        const herbivorous = !!(diet & M1_HERBIVORE);
        const starving = !!monster?.edog?.mhpmax_penalty;
        const temporarilyBlind = monster?.mcansee === false;
        if (object?.otyp === CORPSE
            && (object?.age ?? (state?.moves ?? 1)) + 50
                <= (state?.moves ?? 1)
            && object?.corpsenm !== PM_LIZARD
            && object?.corpsenm !== PM_LICHEN) return POISON;
        if (object?.otyp === CORPSE) {
            if (veganCorpseSpecies(object.corpsenm))
                return herbivorous ? CADAVER : MANFOOD;
            return carnivorous ? CADAVER : MANFOOD;
        }
        if ([TRIPE_RATION, MEATBALL, MEAT_STICK, ENORMOUS_MEATBALL, MEAT_RING]
            .includes(object?.otyp))
            return carnivorous ? DOGFOOD : MANFOOD;
        if (object?.otyp === EGG)
            return carnivorous ? CADAVER : MANFOOD;
        if (object?.otyp === APPLE)
            return herbivorous ? DOGFOOD
                : starving ? ACCFOOD : MANFOOD;
        if (object?.otyp === CARROT)
            return herbivorous || temporarilyBlind ? DOGFOOD
                : starving ? ACCFOOD : MANFOOD;
        if (object?.otyp === BANANA)
            return herbivorous || starving ? ACCFOOD : MANFOOD;
        if (object?.otyp === CLOVE_OF_GARLIC)
            return herbivorous || starving ? ACCFOOD : MANFOOD;
        if (object?.otyp === TIN) return MANFOOD;
        if (starving) return ACCFOOD;
        // dog.c:dogfood() deliberately ranks later ordinary comestibles
        // (rations and lembas among them) as acceptable food for a
        // carnivore.  They are not fetch objects: ACCFOOD is a provisional
        // food goal which a content pet later abandons to follow its master.
        return object?.otyp > SLIME_MOLD
            ? carnivorous ? ACCFOOD : MANFOOD
            : herbivorous ? ACCFOOD : MANFOOD;
    }
    if (!object?.cursed
        && object?.oclass !== ROCK_CLASS
        && object?.oclass !== BALL_CLASS
        && object?.oclass !== CHAIN_CLASS) return APPORT;
    return UNDEF;
}

function nearbyFloorObjects(monster, state) {
    const objects = [];
    let scanOrder = 0;
    const minX = Math.max(1, monster.mx - 5);
    const maxX = Math.min(79, monster.mx + 5);
    const minY = Math.max(0, monster.my - 5);
    const maxY = Math.min(20, monster.my + 5);
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (const object of state?.level?.objects?.[x]?.[y] || []) {
                objects.push({ object, scanOrder: scanOrder++ });
            }
        }
    }
    // C walks the global fobj chain newest-first, independently of map
    // coordinates.  Explicitly linked runtime drops carry that order; older
    // generated objects retain the established coordinate-order fallback
    // until every construction path shares the same floor-chain owner.
    return objects.sort((a, b) => {
        const ao = a.object._fobjOrder;
        const bo = b.object._fobjOrder;
        if (Number.isFinite(ao) || Number.isFinite(bo)) {
            if (!Number.isFinite(ao)) return 1;
            if (!Number.isFinite(bo)) return -1;
            if (ao !== bo) return bo - ao;
        }
        return a.scanOrder - b.scanOrder;
    }).map(entry => entry.object);
}

function petCouldReachItem(monster, x, y, state) {
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (IS_POOL(state?.level?.at?.(x, y)?.typ)
        && !(speciesFlags & M1_SWIM)) return false;
    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (pile.some(item => item.otyp === BOULDER)) return false;
    // TODO: account for lava-loving pets and rock throwers.
    return true;
}

function petCanReachLocation(monster, mx, my, fx, fy, state) {
    if (mx === fx && my === fy) return true;
    if (!isok(mx, my)) return false;

    // dogmove.c does not run a general pathfinder here.  It recursively takes
    // only neighbours which strictly reduce squared distance to the object.
    // That distinction matters for niche/corner objects: a BFS can find a
    // detour which the C anti-stuck check deliberately rejects.
    const distance = dist2(mx, my, fx, fy);
    for (let x = mx - 1; x <= mx + 1; x++) {
        for (let y = my - 1; y <= my + 1; y++) {
            if (!isok(x, y) || dist2(x, y, fx, fy) >= distance) continue;
            const loc = state?.level?.at?.(x, y);
            if (!loc || IS_OBSTRUCTED(loc.typ)) continue;
            if (IS_DOOR(loc.typ)
                && ((loc.doormask ?? 0) & (D_CLOSED | D_LOCKED))) continue;
            if (!petCouldReachItem(monster, x, y, state)) continue;
            if (petCanReachLocation(monster, x, y, fx, fy, state)) return true;
        }
    }
    return false;
}

function petCanReachObject(monster, object, state) {
    const targetX = object?.ox;
    const targetY = object?.oy;
    if (!Number.isInteger(targetX) || !Number.isInteger(targetY)) return false;
    return petCouldReachItem(monster, targetX, targetY, state)
        && petCanReachLocation(
            monster, monster.mx, monster.my, targetX, targetY, state,
        );
}

function petCanCarryObject(monster, object) {
    return monsterCanCarryObject(monster, object);
}

function couldSeeFromHero(state, x, y) {
    // COULD_SEE is bit 0 in vision.c/js/vision.js.  Focused unit states omit
    // the vision buffer and are treated as unobstructed; live games always
    // carry the current buffer produced by domove()/vision_recalc().
    // C gulpmu() runs vision_recalc(2) as soon as swallowing begins.  No
    // external square remains in the master's sight until disgorgement.
    if (state?.u?.uswallow) return false;
    if (!state?.viz_array) return true;
    return !!(state.viz_array?.[y]?.[x] & 0x1);
}

// C monmove.c:watch_on_duty(). A warning does not consume the watchman's move.
// TODO: add lock-picking and digging warnings, including guard hostility.
function watchOnDutyRng(monster, state, random, calls) {
    if ((monster?.mnum !== PM_WATCHMAN
            && monster?.mnum !== PM_WATCH_CAPTAIN)
        || !monster.mpeaceful) return false;

    const hero = state?.u || {};
    const requestedX = (hero.ux ?? 0) + (hero.dx ?? 0);
    const requestedY = (hero.uy ?? 0) + (hero.dy ?? 0);
    if (!inTown(state?.level, requestedX, requestedY)
        || monster.mcansee === 0) return false;

    const flags1 = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const heroInvisible = !!(
        state?.invisible || hero.invisible || hero.invis
        || (hero.invisibleTurns ?? 0) > 0
    );
    if ((heroInvisible && !(flags1 & M1_SEE_INVIS))
        || state?.underwater || hero.underwater || hero.uinwater
        || !couldSeeFromHero(state, monster.mx, monster.my)) return false;

    return recordRandom(random, calls, 3) === 0;
}

// C ref: monmove.c:disturb().  Sleep is checked inside dochug(), after the
// scheduler has debited this actor's movement.  A failed wake roll therefore
// remains part of the actor's observable RNG slice even though no state or
// screen changes.
export function disturbSleepingMonster(
    monster, state, random = rn2, calls = [],
) {
    if (!monster?.msleeping
        || !couldSeeFromHero(state, monster.mx, monster.my)
        || dist2(
            monster.mx, monster.my,
            state?.u?.ux ?? monster.mx,
            state?.u?.uy ?? monster.my,
        ) > 100) return false;

    const stealth = !!(
        state?.u?.stealth
        || state?.u?.stealthIntrinsic
        || state?.u?.stealthExtrinsic
    );
    if (stealth
        && (monster.mnum !== PM_ETTIN
            || recordRandom(random, calls, 10) === 0)) return false;

    const symbol = MONSTER_SYMBOL[monster.mnum];
    const hardToWake = symbol === S_NYMPH
        || monster.mnum === PM_JABBERWOCK
        || symbol === S_LEPRECHAUN;
    if (hardToWake && recordRandom(random, calls, 50) !== 0) return false;

    const aggravates = !!(
        state?.u?.aggravateMonster
        || state?.u?.aggravate_monster
        || state?.aggravateMonster
        || state?.aggravate_monster
    );
    const classWakesReadily = symbol === S_DOG || symbol === S_HUMAN;
    if (!aggravates && !classWakesReadily) {
        if (recordRandom(random, calls, 7) !== 0) return false;
        // The source evaluates rn2(7) before excluding furniture/object
        // mimics, so keep this check after the draw.
        if (monster.m_ap_type === M_AP_FURNITURE
            || monster.m_ap_type === M_AP_OBJECT) return false;
    }

    monster.msleeping = 0;
    return true;
}

function dogGoal(monster, state, random, calls) {
    // Preserve the object-screening side effects before falling back to the
    // hero.  Preferred nearby food owns the goal outright; this is what lets
    // a pony pursue a just-thrown carrot instead of its master's square.
    const ux = state?.u?.ux ?? monster.mx;
    const uy = state?.u?.uy ?? monster.my;
    // dog_move() computes this before dog_goal() and uses it again while
    // scoring movement candidates, including when dog_goal() finds food.
    const whistletime = monster?.edog?.whistletime ?? 0;
    const moveOffset = state?.urole?.key === 'tourist'
            && (state?._liveQuietTurnRequested || state?._ordinaryDescentLive)
        ? 1 : 0;
    // The scheduler can pre-increment JS bookkeeping before executing the
    // source movemon() pass.  Its override is the active C `svm.moves` for
    // every role, including Wizards; dog_goal() must consume that turn for
    // whistle age instead of the already-prepared next turn.
    const sourceMove = Number.isInteger(state?._statusTurnOverride)
        ? state._statusTurnOverride
        : Math.max(0, (state?.moves ?? 1) - moveOffset);
    const whappr = sourceMove - whistletime < 5;
    let foodGoal = null;
    let foodType = UNDEF;
    let apportGoal = null;
    const inMastersSight = couldSeeFromHero(state, monster.mx, monster.my);
    const dogHasInventory = !!(monster.minvent?.length
        || monster.inventory?.length);
    const petTile = state?.level?.at?.(monster.mx, monster.my);
    const heroTile = state?.level?.at?.(ux, uy);
    const lightingAllowsFetch = !petTile?.lit || !!heroTile?.lit;
    const nearbyObjects = nearbyFloorObjects(monster, state);
    for (const object of nearbyObjects) {
        const type = dogFood(monster, object, random, calls, state);
        const cursedAtLocation = (state?.level?.objects?.[object.ox]?.[object.oy]
            || []).some(item => item.cursed);
        if (!cursedAtLocation && type < MANFOOD && (type < foodType
            || type === foodType && foodGoal
                && dist2(object.ox, object.oy, monster.mx, monster.my)
                    < dist2(foodGoal.ox, foodGoal.oy, monster.mx, monster.my))) {
            foodGoal = object;
            foodType = type;
        } else if (!cursedAtLocation && type >= MANFOOD && type < UNDEF
            // C stores both food and fetch candidates in gg.gtyp.  Once a
            // preferred food has lowered it below MANFOOD, every later
            // APPORT object is inferior and skips the rn2(8) gate.
            && !foodGoal && !apportGoal && inMastersSight
            && !dogHasInventory && lightingAllowsFetch
            // dogmove.c:dog_goal().  MANFOOD is worth evaluating even when
            // the pet cannot see it directly; ordinary APPORT objects still
            // require m_cansee(), whose source macro is clear_path().
            && (type === MANFOOD
                || clearPath(
                    monster.mx, monster.my, object.ox, object.oy,
                ))
            && petCanReachObject(monster, object, state)
            && (monster.edog?.apport ?? 0) > recordRandom(random, calls, 8)
            && petCanCarryObject(monster, object)) {
            apportGoal = object;
        }
    }

    let goalX = ux;
    let goalY = uy;
    // C keeps a tempting cadaver as a provisional goal until after the floor
    // scan.  A content pet ignores it and falls back to following its master;
    // only preferred dog food, or food whose hunger time has arrived, wins.
    const hungryTime = monster?.edog?.hungrytime ?? 0;
    if (foodGoal) {
        if (foodType === DOGFOOD || sourceMove >= hungryTime)
            return { x: foodGoal.ox, y: foodGoal.oy, appr: 1, whappr };
        // A superior but currently unappetizing cadaver still overwrites an
        // earlier APPORT candidate in C's single gtyp slot.  The content pet
        // follows its master; it must not fall back to the inferior object.
    } else if (apportGoal) {
        return { x: apportGoal.ox, y: apportGoal.oy, appr: 1, whappr };
    }
    const udist = dist2(monster.mx, monster.my, ux, uy);
    // initedog() starts whistletime at zero. During the opening moves this
    // makes dog_move() treat the pet as recently called even though the hero
    // has not used a whistle yet; that short-lived state is observable in
    // candidate choice and suppresses away-from-goal alternatives.
    // Monster scans now run before the next global-turn increment, matching
    // moveloop_core(): `moves` is the source turn currently being spent.
    // The generic Wizard loop commits the just-finished hero action by
    // incrementing `moves` before the following monster scan.  The live
    // Knight loop instead retains C's movement-ration ordering.  Project the
    // former back to svm.moves for dog_goal()'s whistle-age comparison.
    let appr = udist >= 9 ? 1 : monster.mflee ? -1 : 0;
    if (udist > 1) {
        const heroTile = state?.level?.at?.(ux, uy);
        if (!IS_ROOM(heroTile?.typ ?? 0)
            || recordRandom(random, calls, 4) === 0 || whappr
            || dogHasInventory && recordRandom(
                random, calls, Math.max(1, monster.edog?.apport ?? 1),
            ) !== 0) appr = 1;
    }
    // C dog_goal(): when an otherwise content pet has no approach direction,
    // preferred food in the hero's live inventory makes it follow closely.
    // Inventory order is observable because dogfood() calls obj_resists()
    // before classifying each item and stops at the first DOGFOOD entry.
    if (appr === 0) {
        const heroLocation = state?.level?.at?.(ux, uy);
        const onStairs = !!heroLocation?.ladder
            || [state?.level?.upstair, state?.level?.dnstair].some(stair =>
                stair?.x === ux && stair?.y === uy);
        if (onStairs) {
            appr = 1;
        } else {
            // NetHack keeps carried gold as the `$` head of gi.invent.  The
            // fallback exists only for a legacy restored aggregate which has
            // not yet been materialized by a mutating command.
            const carried = !heroGoldObject(state) && heroGoldAmount(state) > 0
                ? [{ otyp: GOLD_PIECE, oclass: 12, cursed: false },
                    ...(state?.inventory || [])]
                : state?.inventory || [];
            for (const object of carried) {
                if (dogFood(monster, object, random, calls, state) === DOGFOOD) {
                    appr = 1;
                    break;
                }
            }
            if (appr === 0) {
                const portal = state?.level?.traps?.find(trap =>
                    trap.ttyp === MAGIC_PORTAL);
                if (portal && dist2(ux, uy, portal.tx, portal.ty) <= 2)
                    appr = 1;
            }
        }
    }
    if (monster.mconf) appr = 0;

    // C dog_goal(): a pet which cannot currently see its master follows the
    // newest adjacent hero track instead of targeting the hero through rock.
    // This changes candidate scoring without adding an RNG call, making it a
    // classic screen-equal/stream-different boundary.
    if (!couldSeeFromHero(state, monster.mx, monster.my)) {
        const track = getTrack(monster.mx, monster.my, state);
        if (track) {
            goalX = track.x;
            goalY = track.y;
            if (monster.edog?.ogoal) monster.edog.ogoal.x = 0;
        } else if (monster.edog?.ogoal?.x
            && (monster.edog.ogoal.x !== monster.mx
                || monster.edog.ogoal.y !== monster.my)) {
            goalX = monster.edog.ogoal.x;
            goalY = monster.edog.ogoal.y;
            monster.edog.ogoal.x = 0;
        } else {
            // C dog_goal(): if the master and every recent track are out of
            // view, do_clear_area(..., wantdoor) chooses the square visible
            // from the pet which is closest to the hero.
            let bestDistance = (COLNO + 2) * (COLNO + 2);
            let best = null;
            const clearAreaCells = visibleCellsFrom(
                monster.mx, monster.my, 9,
            );
            for (const cell of clearAreaCells) {
                const distance = dist2(cell.x, cell.y, ux, uy);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = cell;
                }
            }
            if (best && (best.x !== monster.mx || best.y !== monster.my)) {
                goalX = best.x;
                goalY = best.y;
                if (monster.edog?.ogoal) {
                    monster.edog.ogoal.x = goalX;
                    monster.edog.ogoal.y = goalY;
                }
            }
        }
    } else if (monster.edog?.ogoal) {
        monster.edog.ogoal.x = 0;
    }
    return { x: goalX, y: goalY, appr, whappr };
}

// C dog_invent() screens the first object at the pet's current square before
// dog_goal() walks fobj.  Pickup/eating state transitions are separate owner
// blocks, but dogfood()'s obj_resists() draw already belongs to movement.
function petEatingDelay(object) {
    // dog_nutrition() uses objects[otyp].oc_delay for ordinary food.  Accept
    // live object metadata as the primary owner and retain the source tripe
    // value until the complete generated delay table is projected here.
    if (Number.isInteger(object?.oc_delay)) return object.oc_delay;
    if (Number.isInteger(object?.delay)) return object.delay;
    if (object?.otyp === CORPSE) {
        const bodyWeight = MONSTER_BODY_META[object.corpsenm]?.[0] ?? 0;
        return 3 + (bodyWeight >> 6);
    }
    if (object?.otyp === TRIPE_RATION) return 2;
    return 1;
}

function petInventoryAction(monster, state, random, rollOne, calls) {
    if (monster?.meating || monster?.mfrozen || monster?.msleeping) return null;
    const carried = monster.minvent || monster.inventory || [];
    const udist = dist2(
        monster.mx, monster.my,
        state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my,
    );
    if (carried.length) {
        const apport = Math.max(1, monster.edog?.apport ?? 1);
        let release = recordRandom(random, calls, udist + 1) === 0;
        if (!release) release = recordRandom(random, calls, apport) === 0;
        if (release && recordRandom(random, calls, 10) < apport) {
            const dropped = [...carried];
            for (const object of dropped)
                dropObjectFromMonsterInventory(monster, object, state);
            if ((monster.edog?.apport ?? 1) > 1) monster.edog.apport--;
            if (monster.edog) {
                monster.edog.dropdist = udist;
                monster.edog.droptime = state?.moves ?? 1;
            }
            return { dropped };
        }
        return null;
    }
    const object = state?.level?.objects?.[monster.mx]?.[monster.my]?.[0];
    if (!object) return null;
    // dog_invent() rejects the nofetch classes before dogfood().  In
    // particular, a pet standing on a statue must not consume an
    // obj_resists() draw here; dog_goal() will still inspect that same floor
    // object through the global fobj scan.
    const fetchableClass = object.oclass !== BALL_CLASS
        && object.oclass !== CHAIN_CLASS && object.oclass !== ROCK_CLASS;
    if (!fetchableClass) return null;
    const edible = dogFood(monster, object, random, calls, state);
    if (edible <= CADAVER) {
        const quantity = object.quantity ?? object.quan ?? 1;
        if (quantity > 1) {
            rollOne(2);
            calls.push('rnd(2)');
        }
        recordRandom(random, calls, 100);
        // dog_eat() always classifies the consumed object.  invlet controls
        // only whether DOGFOOD rewards apport; generated floor food still
        // owns dogfood()'s obj_resists() call.
        dogFood(monster, object, random, calls, state);
        monster.meating = petEatingDelay(object);
        const pile = state.level.objects[monster.mx][monster.my];
        if (quantity > 1) {
            object.quantity = quantity - 1;
            object.quan = object.quantity;
        } else {
            pile.shift();
        }
        return { ateFood: object };
    }
    const carryAmount = fetchableClass
        ? monsterCarryAmount(monster, object) : 0;
    if (carryAmount > 0 && !object.cursed) {
        // C dog_invent(): a failed pickup leaves the floor pile unchanged.
        const apport = Math.max(1, monster.edog?.apport ?? 1);
        if (recordRandom(random, calls, 20) < apport + 3) {
            const approach = recordRandom(random, calls, Math.max(1, udist));
            if (approach !== 0 || recordRandom(random, calls, apport) === 0) {
                const pile = state.level.objects[monster.mx][monster.my];
                const quantity = object.quan ?? object.quantity ?? 1;
                let pickedUp = object;
                if (carryAmount !== quantity) {
                    pickedUp = splitObjectStack(
                        object, carryAmount, state,
                    );
                    pickedUp.where = 'free';
                    calls.push('rnd(2)');
                } else {
                    const index = pile.indexOf(object);
                    if (index >= 0) pile.splice(index, 1);
                }
                // dogmove.c:dog_invent()->mpickobj().  The floor extraction
                // above precedes carrying effects and final minvent linkage.
                addObjectToMonsterInventory(
                    monster, pickedUp, state,
                );
                return { pickedUp };
            }
        }
    }
    return null;
}

function trapAt(state, x, y) {
    return state?.level?.traps?.find(trap => trap.tx === x && trap.ty === y);
}

function monsterKnowsTrap(monster, trap) {
    const bit = 1 << ((trap?.ttyp ?? 0) - 1);
    return bit > 0 && !!((monster?.mtrapseen ?? 0) & bit);
}

function monsterLearnsTrap(monster, trap) {
    const bit = 1 << ((trap?.ttyp ?? 0) - 1);
    if (bit > 0) monster.mtrapseen = (monster.mtrapseen ?? 0) | bit;
}

// C mondata.c:mons_see_trap().  Trap knowledge belongs to each observer,
// rather than to the level or monster class.  An unlit trigger teaches only
// adjacent sighted, thinking monsters; a lit trigger can teach observers up
// to seven squares away when clear_path() succeeds.
export function monstersSeeTrap(state, trap) {
    if (!trap) return;
    const tile = state?.level?.at?.(trap.tx, trap.ty);
    const maxDistance = tile?.lit ? 49 : 2;
    for (const observer of state?.level?.monsters || []) {
        if (!observer || (observer.mhp ?? 1) <= 0) continue;
        const flags = MONSTER_FLAGS1[observer.mnum] ?? 0;
        if ((flags & (M1_ANIMAL | M1_MINDLESS | M1_NOEYES))
            || observer.mcansee === false || observer.mcansee === 0) {
            continue;
        }
        if (dist2(observer.mx, observer.my, trap.tx, trap.ty) > maxDistance)
            continue;
        if (!clearPath(observer.mx, observer.my, trap.tx, trap.ty)) continue;
        monsterLearnsTrap(observer, trap);
    }
}

async function finishMonsterCombatDeath(
    aggressor, defender, state, {
        random, rollOne, calls, killingAttack, publish,
    },
) {
    const visible = state === game
        ? cansee(defender.mx, defender.my)
        : !!(state?.viz_array?.[defender.my]?.[defender.mx] & 0x2);
    const death = await finishEnvironmentalMonsterDeath(defender, state, {
        visible,
        spotted: state === game
            ? canProjectMonster(defender, defender.mx, defender.my)
            : visible,
        random,
        publish,
        zombifyCorpse: killingAttackMakesZombie(
            aggressor, defender, killingAttack,
        ),
    });
    if (death.survived) {
        return {
            survived: true, corpseCreated: false, corpse: null,
            growth: null, aggressor,
        };
    }
    const growth = growMonster(aggressor, {
        victim: defender,
        state,
        random,
        rollOne,
        calls,
    });
    return {
        survived: false,
        corpseCreated: !!death.corpse,
        corpse: death.corpse,
        growth,
        aggressor,
    };
}

function killingAttackMakesZombie(aggressor, defender, attack) {
    return !monsterWieldedWeapon(aggressor)
        && isZombieMaker(aggressor?.mnum, aggressor?.mcan)
        && [1, 2, AT_TUCH].includes(attack?.attackType)
        && zombieForm(defender?.mnum) != null;
}

// C mon.c:mondied() owns ordinary corpse eligibility and construction before
// the dead actor is detached.  Pet combat and environmental trap deaths share
// this producer; grow_up() remains exclusively with the pet-combat caller.
function createOrdinaryMonsterCorpse(
    defender, state, random, calls, { zombify = false } = {},
) {
    const x = defender.mx, y = defender.my;
    if (defender.mnum === PM_IRON_GOLEM) {
        const chainCount = d(2, 6);
        calls.push('d(2,6)');
        let lastChain = null;
        for (let index = 0; index < chainCount; index++) {
            lastChain = mksobj(IRON_CHAIN, true, false);
            placeThrownObject(state, lastChain, x, y);
        }
        return lastChain;
    }
    const frequency = (MONSTER_GENO[defender.mnum] ?? 0) & 0x7;
    const corpseDenominator = 2 + Number(frequency < 2)
        + Number((MONSTER_SIZE[defender.mnum] ?? 0) === 0);
    if (recordRandom(random, calls, corpseDenominator) === 0) {
        const corpseForm = undeadToCorpse(defender.mnum);
        // C make_corpse() handles zombies and mummies before its default
        // G_NOCORPSE rejection.  Those special actors deliberately carry
        // G_NOCORPSE to prevent wish/random generation of an undead corpse,
        // but death still creates the converted living corpse.  Ordinary
        // no-corpse species (for example grid bugs) stop here after paying
        // corpse_chance() and before mkcorpstat() object initialization.
        if (corpseForm === defender.mnum
            && ((MONSTER_GENO[defender.mnum] ?? 0) & G_NOCORPSE)) {
            return null;
        }
        // C make_corpse() converges through mkcorpstat(), not a direct
        // corpsenm assignment.  If mksobj() chose a timerless lichen/lizard
        // as its temporary identity, this override must rebuild the ordinary
        // corpse timer before grow_up().
        const leaderId = state.quest_status?.leader_m_id;
        const savedMonster = corpseForm !== defender.mnum
            || corpseKeepsMonsterTraits(defender, leaderId)
            ? defender : null;
        const corpse = mkcorpstat(
            CORPSE, savedMonster, corpseForm, x, y, 8, { zombify },
        );
        // C make_corpse() converts zombies and mummies back to their living
        // corpse form and backdates it past TAINT_AGE.
        corpse.name = `${MONSTER_NAME[corpseForm] || 'monster'} corpse`;
        if (defender.name) corpse.oname = defender.name;
        const sourceMove = Math.max(1, (state?.moves ?? 1)
            - Number(state?.urole?.key === 'wizard'));
        if (corpseForm !== defender.mnum) corpse.age = sourceMove - 51;
        // The object layer does not yet derive corpse weight from permonst.
        // Set the kobold corpse weight used by can_carry() on the next action.
        if (corpseForm === 59) corpse.owt = 400;
        return corpse;
    }
    return null;
}

// C mon.c:m_detach(..., TRUE) -> steal.c:relobj().  Ordinary death releases
// every carried identity before corpse creation.  The resulting floor order
// is observable both through glyph choice and through dog_goal()'s fobj scan.
// Migration/disappearance deliberately do not use this helper.
function releaseDeadMonsterInventory(defender, state) {
    const x = defender.mx, y = defender.my;
    const carried = defender.minvent || defender.inventory || [];
    for (const object of carried) {
        // extract_from_minvent() clears carrier-owned equipment state before
        // mdrop_obj() places and stacks the same object identity.
        object.owornmask = 0;
        object.worn = false;
        object.wornSlot = null;
        object.wielded = false;
        object.alternate = false;
        object.ready = false;
        placeThrownObject(state, object, x, y);
        stack_object(object, state);
    }
    defender.minvent = [];
    defender.inventory = defender.minvent;
    defender.hasInventory = false;
    defender.mw = null;
}

function detachDeadMonster(defender, state) {
    const x = defender.mx, y = defender.my;
    const defenderName = MONSTER_NAME[defender.mnum] || 'monster';
    releaseDeadMonsterInventory(defender, state);
    defender.mhp = 0;
    defender.dead = true;
    markQuestLeaderDead(defender, state);
    if (state === game) unmap_invisible(x, y, false);
    state.level.monsters = state.level.monsters.filter(monster =>
        monster !== defender);
    recordVanquished(defender, defenderName, { state });
}

// C mhitm.c:mattackm() handles an AT_WEAP slot before its to-hit roll.
// An unarmed weapon attacker first calls mon_wield_item(); selecting a new
// carried weapon consumes the complete counterattack action.
function monsterVersusMonsterWieldAction(aggressor, defender, attack) {
    if (attack?.attackType !== AT_WEAP) return null;
    const currentWeapon = monsterWieldedWeapon(aggressor);
    if (aggressor.weaponCheck !== NEED_WEAPON && currentWeapon) return null;

    aggressor.weaponCheck = NEED_HTH_WEAPON;
    const selectedWeapon = selectHandToHandWeapon(aggressor);
    if (!selectedWeapon
        || selectedWeapon.otyp === currentWeapon?.otyp) {
        aggressor.weaponCheck = NEED_WEAPON;
        return null;
    }
    if (currentWeapon) currentWeapon.wielded = false;
    aggressor.mw = selectedWeapon;
    selectedWeapon.wielded = true;
    aggressor.weaponCheck = NEED_WEAPON;
    return {
        kind: 'monster-wield', aggressor, defender,
        weapon: selectedWeapon, deferredWield: true,
    };
}

function monsterMeleeAttack(
    aggressor, defender, attacks, state, random, rollDice, rollOne, calls,
) {
    // C mhitm.c:mattackm() marks its aggressor as having acted in the current
    // source turn before the first attack slot.  dog_move() consults this
    // stamp when deciding whether a struck defender may counterattack out of
    // sequence; even a miss therefore prevents another action this round.
    aggressor.mlstmv = sourceMonsterTurn(state);
    const threshold = findMonsterArmorClass(defender)
        + (aggressor?.m_lev ?? MONSTER_LEVEL[aggressor?.mnum] ?? 0);
    const results = [];
    let struck = false;

    for (let index = 0; index < attacks.length; index++) {
        if ((defender?.mhp ?? 1) <= 0) break;
        const attack = attacks[index];
        const wield = monsterVersusMonsterWieldAction(
            aggressor, defender, attack,
        );
        if (wield) return wield;
        const roll = rollOne(20 + index);
        calls.push(`rnd(${20 + index})`);
        const hit = threshold > roll;
        let damage = 0;
        if (hit) {
            damage = rollDice(attack.damn, attack.damd);
            calls.push(`d(${attack.damn},${attack.damd})`);
            // mdamagem() checks generic knockback before applying damage,
            // including for an ultimately fatal physical hit.
            recordRandom(random, calls, 3);
            recordRandom(random, calls, 6);
            defender.mhp = Math.max(0, (defender.mhp ?? 1) - damage);
            struck = true;
        }
        // passivemm() is reached after every attempted contact attack while
        // the defender survives, including an ordinary miss.
        if ((defender.mhp ?? 0) > 0) recordRandom(random, calls, 3);
        results.push({ ...attack, roll, threshold, hit, damage });
    }
    const defenderDied = (defender?.mhp ?? 0) <= 0;
    return {
        kind: 'monster-attack', aggressor, defender, results, struck,
        defenderDied,
        death: null,
        deathPending: defenderDied,
        contactAttacks: attacks,
        nextAttackIndex: results.length,
    };
}

function sourceMonsterMeleeAttacks(monster) {
    const attackNames = {
        1: 'claw', 2: 'bite', 3: 'kick', 4: 'butt', 5: 'touch',
        6: 'sting', 7: 'hug', [AT_WEAP]: 'weapon',
    };
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        // Attack type zero terminates the native attack array.  Recognized
        // nonzero slots remain real attacks even when their damage dice are
        // 0d0, as with a lichen's sticky touch.
        .filter(([attackType]) => attackNames[attackType])
        .map(([attackType, damageType, damn, damd]) => ({
            type: attackNames[attackType], attackType, damageType, damn, damd,
        }));
}

function sourceMonsterTurn(state) {
    if (Number.isInteger(state?._statusTurnOverride))
        return state._statusTurnOverride;
    if (Number.isInteger(state?._maintenanceMove))
        return state._maintenanceMove;
    return state?.moves ?? 1;
}

function defenderCanAnswerPetAttack(
    aggressor, defender, state, random, calls,
) {
    return recordRandom(random, calls, 4) !== 0
        && defender.mlstmv !== sourceMonsterTurn(state)
        && !monsterIsScaredAt(
            defender, state, aggressor.mx, aggressor.my,
        )
        && distmin(defender.mx, defender.my,
            aggressor.mx, aggressor.my) <= 1;
}

function defenderCanAnswerMovementAttack(defender, random, calls) {
    if (recordRandom(random, calls, 4) === 0) return false;
    if ((defender.movement ?? 0)
        <= recordRandom(random, calls, NORMAL_SPEED)) return false;
    defender.movement = defender.movement > NORMAL_SPEED
        ? defender.movement - NORMAL_SPEED : 0;
    return true;
}

function defenderCanCounterattack(
    attack, state, random, calls,
) {
    if (!attack.struck || attack.defenderDied) return false;
    if (attack.retaliationRule === 'movement') {
        return defenderCanAnswerMovementAttack(
            attack.defender, random, calls,
        );
    }
    return attack.retaliationRule === 'pet'
        && defenderCanAnswerPetAttack(
            attack.aggressor, attack.defender, state, random, calls,
        );
}

function beginMonsterMeleeAttack(
    aggressor, defender, attacks, state, random, rollDice, rollOne, calls,
    retaliationRule,
) {
    const firstAttack = attacks[0];
    const wield = monsterVersusMonsterWieldAction(
        aggressor, defender, firstAttack,
    );
    if (wield) return wield;

    if (state?._deferVisibleMonsterContact && firstAttack) {
        aggressor.mlstmv = sourceMonsterTurn(state);
        const threshold = findMonsterArmorClass(defender)
            + (aggressor.m_lev ?? MONSTER_LEVEL[aggressor.mnum] ?? 0);
        const roll = rollOne(20);
        calls.push('rnd(20)');
        return {
            kind: 'monster-attack', aggressor, defender,
            results: [{
                ...firstAttack, roll, threshold,
                hit: threshold > roll, damage: 0,
            }],
            struck: false, defenderDied: false, death: null,
            deferredContact: true,
            contactAttacks: attacks,
            pendingResultIndex: 0,
            nextAttackIndex: 1,
            retaliationRule,
        };
    }

    const result = monsterMeleeAttack(
        aggressor, defender, attacks, state,
        random, rollDice, rollOne, calls,
    );
    if (result.kind !== 'monster-attack') return result;
    result.retaliationRule = retaliationRule;
    if (defenderCanCounterattack(result, state, random, calls)) {
        result.counterattack = monsterMeleeAttack(
            defender, aggressor, sourceMonsterMeleeAttacks(defender), state,
            random, rollDice, rollOne, calls,
        );
    }
    return result;
}

function petAttacksMonster(
    pet, target, state, random, rollDice, rollOne, calls,
) {
    const attacks = sourceMonsterMeleeAttacks(pet);
    return beginMonsterMeleeAttack(
        pet, target, attacks, state, random, rollDice, rollOne, calls,
        'pet',
    );
}

// C mondata.c:max_passive_dmg().  dog_move() uses the defender's maximum
// passive retaliation, multiplied by the pet's number of contact attacks, as
// a deterministic safety gate before any melee to-hit roll is allowed.
export function maxPassiveMonsterDamage(defender, aggressor) {
    const contactTypes = new Set([1, 2, 3, 4, 5, 6, 7, 11, 16, AT_WEAP]);
    const contactCount = (MONSTER_ATTACKS[aggressor?.mnum] || [])
        .filter(([attackType]) => contactTypes.has(attackType)).length;
    if (!contactCount) return 0;

    const resistance = MONSTER_RESISTS[aggressor?.mnum] ?? 0;
    for (const [attackType, damageType, dice, sides]
        of MONSTER_ATTACKS[defender?.mnum] || []) {
        if (attackType !== 0 && attackType !== 14) continue;
        const resisted = (damageType === AD_FIRE && (resistance & 0x01))
            || (damageType === AD_COLD && (resistance & 0x02))
            || (damageType === AD_ELEC && (resistance & 0x10))
            || (damageType === AD_ACID && (resistance & 0x40));
        if (resisted) return 0;
        if (![AD_PHYS, AD_FIRE, AD_COLD, AD_ELEC, AD_ACID]
            .includes(damageType)) return 0;
        const count = dice || ((MONSTER_LEVEL[defender.mnum] ?? 0) + 1);
        return count * sides * contactCount;
    }
    return 0;
}

function petAttacksHero(pet, state, random, rollDice, rollOne, calls) {
    // PM_PONY: AT_KICK 1d6 followed by AT_BITE 1d2. mattacku() raises the
    // to-hit die from rnd(20) to rnd(21) for the second attack.
    const attacks = [
        { type: 'kick', die: 20, damn: 1, damd: 6 },
        { type: 'bite', die: 21, damn: 1, damd: 2 },
    ];
    const threshold = sourceHeroArmorClass(state, rollOne, calls) + 10
        + (pet.m_lev ?? MONSTER_LEVEL[pet.mnum] ?? 0)
        + (heroHasNegativeMulti(state) ? 4 : 0);
    const results = [];
    for (const attack of attacks) {
        const roll = rollOne(attack.die);
        calls.push(`rnd(${attack.die})`);
        const hit = threshold > roll;
        let damage = 0;
        if (hit) {
            damage = rollDice(attack.damn, attack.damd);
            calls.push(`d(${attack.damn},${attack.damd})`);
            // Physical attacks check knockback after rolling damage.
            recordRandom(random, calls, 3);
            recordRandom(random, calls, 6);
            damage = reduceHeroContactDamage(
                damage, state, rollOne, calls,
            );
            state.u.uhp = Math.max(0, (state.u.uhp ?? 1) - damage);
        }
        results.push({ ...attack, roll, threshold, hit, damage });
    }
    return { kind: 'pet-hero-attack', aggressor: pet, results };
}

function finishPetMovePlan(
    monster, state, plan, random, rollDice, rollOne, calls,
) {
    const {
        oldx, oldy, nix, niy, selectedInfo, reluctant, inventoryAction,
        wieldedWeapon,
    } = plan;
    if (selectedInfo & ALLOW_U) {
        const attack = petAttacksHero(
            monster, state, random, rollDice, rollOne, calls,
        );
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false, attack,
            deferredPostFlee: true,
            wieldedWeapon,
            ...inventoryAction,
        };
    }

    monster.mx = nix;
    monster.my = niy;
    if (nix !== oldx || niy !== oldy) {
        if (!Array.isArray(monster.mtrack)) monster.mtrack = [];
        monster.mtrack.unshift({ x: oldx, y: oldy });
        monster.mtrack.length = Math.min(monster.mtrack.length, 4);
    }
    const movement = {
        oldx, oldy, x: nix, y: niy,
        moved: nix !== oldx || niy !== oldy,
        wieldedWeapon,
        ...inventoryAction,
    };
    if (movement.moved && reluctant) movement.reluctant = true;
    return movement;
}

function movePet(
    monster, state, random, rollDice, rollOne, calls,
    resumeAfterInventory = false,
) {
    const oldx = monster.mx;
    const oldy = monster.my;
    const inventoryAction = resumeAfterInventory ? null
        : petInventoryAction(monster, state, random, rollOne, calls);
    if (inventoryAction?.ateFood) {
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false,
            ...inventoryAction,
        };
    }
    // dog_invent() narrates a visible pickup/drop before dog_goal() and the
    // rest of dog_move().  Let the async tty owner suspend at that precise
    // point; resumeAfterInventory skips the already-committed inventory
    // transaction after the acknowledgement.
    if (inventoryAction?.pickedUp || inventoryAction?.dropped) {
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false,
            deferredPetMove: true,
            ...inventoryAction,
        };
    }
    const goal = dogGoal(monster, state, random, calls);
    let allowFlags = monAllowFlags(monster, state);
    if (heroHasConflict(state)) {
        // dog_move() first tests the pet's own resistance. Ordinary edogs keep
        // moving either way; the result matters for guardian angels.
        resistConflict(monster, state, rollOne, calls);
        // mon_allowflags() independently tests whether Conflict permits this
        // monster to consider the hero's square as an attack destination.
        if (!resistConflict(monster, state, rollOne, calls))
            allowFlags |= ALLOW_U;
    }
    const candidates = mfndpos(monster, state, allowFlags);
    const uncursedCount = candidates.filter(({ x, y }) =>
        !(state?.level?.objects?.[x]?.[y] || []).some(object => object.cursed)).length;
    let nix = oldx;
    let niy = oldy;
    let nidist = dist2(nix, niy, goal.x, goal.y);
    let chcnt = 0;
    let reluctant = false;
    let selectedInfo = 0;

    for (const candidate of candidates) {
        const { x: nx, y: ny } = candidate;
        if (candidate.info & ALLOW_M) {
            const target = monsterAt(state, nx, ny, monster);
            if (!target) continue;
            const petLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
            const balk = petLevel
                + Math.trunc((5 * (monster.mhp ?? 1))
                    / Math.max(1, monster.mhpmax ?? monster.mhp ?? 1)) - 2;
            if ((target.m_lev ?? MONSTER_LEVEL[target.mnum] ?? 0) >= balk)
                continue;
            // C dogmove.c:dog_move().  Outside Conflict, two tame monsters
            // are allies even when mfndpos() marks the occupied square with
            // ALLOW_M.  Keep scanning movement candidates rather than
            // manufacturing a zero-hit attack transaction between pets.
            if (target.mtame && monster.mtame && !heroHasConflict(state))
                continue;
            if (maxPassiveMonsterDamage(target, monster)
                >= (monster.mhp ?? 1)) continue;
            const attack = petAttacksMonster(
                monster, target, state, random, rollDice, rollOne, calls,
            );
            return {
                oldx, oldy, x: oldx, y: oldy, moved: false, attack,
                deferredPostFlee: !!attack.deferredContact,
                ...inventoryAction,
            };
        }
        if (monsterAvoidsKickedLocation(monster, nx, ny, state))
            continue;
        if (monsterAvoidsSokobanPushLocation(monster, nx, ny, state))
            continue;
        // dog_move() handles traps before inspecting the candidate's object
        // pile.  A pet usually refuses a harmful trap the hero has seen, but
        // an unseen trap remains eligible even when the pet knows its type.
        const trap = trapAt(state, nx, ny);
        if ((candidate.info & ALLOW_TRAPS) && trap?.tseen && !monster.mleashed
            && recordRandom(random, calls, 40) !== 0) continue;

        // dogmove.c examines every reachable, uncursed object on a candidate
        // square before applying its cursed-square avoidance roll.  Cursed
        // objects set the reluctance flag without calling dogfood(); ordinary
        // objects still own dogfood()'s obj_resists() draw even when the pet
        // ultimately rejects the square because something cursed is below.
        let cursed = false;
        let edible = null;
        for (const object of state?.level?.objects?.[nx]?.[ny] || []) {
            if (object.cursed) cursed = true;
            else {
                const foodType = dogFood(
                    monster, object, random, calls, state,
                );
                if (foodType < MANFOOD
                    && (foodType < ACCFOOD
                        || (monster.edog?.hungrytime ?? 0)
                            <= (state?.moves ?? 1))) {
                    edible = object;
                    break;
                }
            }
        }
        if (edible) {
            monster.mx = nx;
            monster.my = ny;
            if (!Array.isArray(monster.mtrack)) monster.mtrack = [];
            monster.mtrack.unshift({ x: oldx, y: oldy });
            monster.mtrack.length = Math.min(monster.mtrack.length, 4);
            const quantity = edible.quantity ?? edible.quan ?? 1;
            if (quantity > 1) {
                rollOne(2);
                calls.push('rnd(2)');
            }
            // dog_eat() commits movement and nutrition before its visible
            // line.  Reward classification, consumption, postmov(), and
            // dochug()'s tail remain on the far side of that tty boundary.
            monster.meating = petEatingDelay(edible);
            return {
                oldx, oldy, x: nx, y: ny, moved: true,
                ateFood: edible, eatingQuantity: quantity,
                deferredPetEating: true,
                ...inventoryAction,
            };
        }
        if (cursed && uncursedCount > 0
            && recordRandom(random, calls, 13 * uncursedCount)) continue;

        // C dog_move(): only distant, unleashed pets probabilistically avoid
        // recent locations. `uncursedCount` is the source `k`, so it controls
        // both the random range and the track-age cutoff.
        if (!monster.mleashed
            && distmin(oldx, oldy, state?.u?.ux ?? goal.x,
                state?.u?.uy ?? goal.y) > 5) {
            const trackCount = Math.min(
                4, Math.max(0, uncursedCount - 1),
            );
            let avoid = false;
            for (let j = 0; j < trackCount; j++) {
                const track = monster.mtrack?.[j];
                const trackRange = 4 * (uncursedCount - j);
                if (track?.x === nx && track?.y === ny) {
                    if (recordRandom(random, calls, trackRange)) {
                        avoid = true;
                        break;
                    }
                }
            }
            if (avoid) continue;
        }

        const ndist = dist2(nx, ny, goal.x, goal.y);
        const direction = (ndist - nidist) * goal.appr;
        let choose = direction < 0;
        if (direction === 0) {
            choose = recordRandom(random, calls, ++chcnt) === 0;
        } else if (direction > 0 && !goal.whappr) {
            if (oldx === nix && oldy === niy) {
                choose = recordRandom(random, calls, 3) === 0;
            }
            if (!choose) choose = recordRandom(random, calls, 12) === 0;
        }
        if (!choose) continue;
        nix = nx;
        niy = ny;
        nidist = ndist;
        selectedInfo = candidate.info;
        reluctant = cursed;
        if (direction < 0) chcnt = 0;
    }

    const movePlan = {
        oldx, oldy, nix, niy, selectedInfo, reluctant, inventoryAction,
    };
    const rangedTurn = beginPetRangedTurn(monster, state, {
        random: range => recordRandom(random, calls, range),
        rollOne: range => {
            const result = rollOne(range);
            calls.push(`rnd(${range})`);
            return result;
        },
    });
    movePlan.wieldedWeapon = rangedTurn.readiedWeapon;
    const current = rangedTurn.current;
    if (current && (current.attack.launched || rangedTurn.usedWeapon)) {
        const attack = current.kind === 'spit'
            ? { spitAttack: current.attack }
            : current.kind === 'weapon'
                ? { rangedAttacks: [current.attack] }
                : { petBreath: current.attack };
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false,
            wieldedWeapon: rangedTurn.readiedWeapon,
            petRangedTurn: rangedTurn,
            ...attack,
            actionCompleted: true,
        };
    }
    if (current?.attack.cough || current?.attack.dryRattle) {
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false,
            petRangedAttack: current.attack,
            petRangedTurn: rangedTurn,
            petMovePlan: movePlan,
            deferredPetRangedNoise: true,
        };
    }
    return finishPetMovePlan(
        monster, state, movePlan, random, rollDice, rollOne, calls,
    );
}

function monsterCouldReachFloorItem(monster, x, y, state) {
    const flags1 = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const flags2 = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    if (IS_POOL(state?.level?.at?.(x, y)?.typ) && !(flags1 & M1_SWIM))
        return false;
    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (pile.some(object => object.otyp === BOULDER)
        && !(flags2 & M2_ROCKTHROW)) return false;
    return true;
}

// C monmove.c:m_search_items().  The square scan is x-major and lets a later
// target at the same distmin replace an earlier one.  This is intentionally
// not a pathfinder: mfndpos() owns the actual next-square legality check.
function monsterFloorItemGoal(monster, state) {
    const originX = monster.mx;
    const originY = monster.my;
    let radius = 5;
    if (!monster.mpeaceful
        && distmin(monster.mux, monster.muy, originX, originY) < 5) radius--;

    const minX = Math.max(1, originX - radius);
    const maxX = Math.min(COLNO - 1, originX + radius);
    const minY = Math.max(0, originY - radius);
    const maxY = Math.min(ROWNO - 1, originY + radius);
    let goal = null;
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            const pile = state?.level?.objects?.[x]?.[y];
            const trap = trapAt(state, x, y);
            const knownTrap = trap && monsterKnowsTrap(monster, trap);
            if (!Array.isArray(pile) || !pile.length
                || radius < distmin(originX, originY, x, y)
                || !monsterCouldReachFloorItem(monster, x, y, state)
                // monmove.c:m_search_items() does not let an attractive
                // object override the pursuit goal when its square carries
                // a trap type this particular monster already knows.
                || knownTrap
                || !clearPath(originX, originY, x, y)) continue;

            const occupant = monsterAt(state, x, y, monster);
            if (occupant && (occupant.mcanmove === 0 || occupant.mundetected
                || occupant.mappearance || !naturalMonsterSpeed(occupant)))
                continue;

            for (const object of pile) {
                // Ordinary rocks dominate floor chains and C deliberately
                // excludes them from goal search even for rock throwers.
                if (object.otyp === ROCK || specialFloorPrize(object)) continue;
                if (!monsterWantsFloorObject(monster, object)) continue;
                if (!monsterCanCarryObject(monster, object)) continue;
                radius = distmin(originX, originY, x, y);
                goal = { x, y, object };
                break;
            }
        }
    }
    return { goal, radius };
}

// C monmove.c:m_balks_at_approaching().  A nearby monster which can still
// use a ranged attack does not blindly close to melee range.  Ordinary
// launchers, polearms, breath/spit/gaze, and spells back away; an aklys tries
// to stay inside its squared-distance return band.
function monsterApproachPolicy(monster, state, oldPolicy, targetX, targetY) {
    const distance = dist2(
        monster.mx, monster.my, targetX, targetY,
    );
    const heroInvisible = !!(state?.u?.invisible || state?.u?.invis
        || (state?.u?.invisibleTurns ?? 0) > 0);
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const seesInvisible = !!(speciesFlags & M1_SEE_INVIS);
    const canSeeHero = monster.mcansee !== false
        && (!heroInvisible || seesInvisible)
        && couldSeeFromHero(state, monster.mx, monster.my);
    if (monster.mpeaceful || distance >= 25 || !canSeeHero)
        return { policy: oldPolicy, min: 0, max: 0 };

    if (monsterHasLauncherAndAmmo(monster))
        return { policy: -1, min: 0, max: 0 };

    const wielded = monsterWieldedWeapon(monster);
    const wieldedName = objectTypeName(wielded);
    if (wielded && MONSTER_POLEARMS.has(wieldedName) && distance <= 5)
        return { policy: -1, min: 0, max: 0 };
    if (wieldedName === 'aklys')
        return { policy: -2, min: 4, max: 16 };

    const badlyHurt = (monster.mhp ?? 0)
        < Math.trunc(((monster.mhpmax ?? 0) + 1) / 3);
    if (monsterHasAvailableDistanceAttack(monster)
        && (badlyHurt || !(monster.mspec_used ?? 0)))
        return { policy: -1, min: 0, max: 0 };

    return { policy: oldPolicy, min: 0, max: 0 };
}

function moveHostile(
    monster, state, random, rollDice, rollOne, calls, options = {},
) {
    const oldx = monster.mx;
    const oldy = monster.my;
    // monmove.c:m_move() refreshes the apparent target before every actor
    // specialization, including shk_move(), pri_move(), and gd_move().  This
    // second refresh is RNG-visible for an invisible or displaced hero and
    // can update retained mux/muy before the special actor returns.
    if (!options.afterRestrictedTenguTeleport)
        setMonsterApparentHeroPosition(monster, state, random, calls);
    if (!options.afterRestrictedTenguTeleport) {
        const priestMovement = movePriest(monster, state, random, calls);
        if (priestMovement) return priestMovement;
        const shopMovement = moveShopkeeper(monster, state, random, calls);
        if (shopMovement) return shopMovement;
    }
    let restrictedTenguTeleport = false;
    const finishMovement = movement => {
        if (restrictedTenguTeleport)
            movement.restrictedTenguTeleport = true;
        return movement;
    };
    // monmove.c:m_move() gives every tengu its innate one-in-five teleport
    // probe before swallowed-state and ordinary candidate movement.  A
    // noteleport level rejects the relocation only after that draw.  The
    // successful unrestricted rloc()/mnexto() branches own separate
    // whole-level placement transactions and remain explicit future work.
    if (!options.afterRestrictedTenguTeleport
        && monster.mnum === PM_TENGU) {
        const wantsTeleport = recordRandom(random, calls, 5) === 0;
        if (wantsTeleport && !monster.mcan) {
            if (monsterTeleportRestricted(monster, state)) {
                restrictedTenguTeleport = true;
                // tele_restrict() emits its line before m_move() chooses an
                // ordinary destination or dochug() performs the trailing
                // distfleeck().  Return a continuation so tty can suspend at
                // that precise source boundary.
                return finishMovement({
                    oldx, oldy, x: oldx, y: oldy, moved: false,
                    deferredAfterRestrictedTenguTeleport: true,
                });
            } else {
                const randomRelocation = (monster.mhp ?? 0) < 7
                    || !!monster.mpeaceful
                    || recordRandom(random, calls, 2) !== 0;
                if (randomRelocation) {
                    const relocation = randomMonsterRelocation(
                        monster, state, calls, random, rollOne,
                    );
                    return finishMovement(relocation || {
                        oldx, oldy, x: oldx, y: oldy, moved: false,
                        tenguTeleportFailed: true,
                    });
                }
                const relocation = relocateMonsterNextToHero(
                    monster, state, calls, random,
                );
                return finishMovement(relocation ? {
                    ...relocation,
                    deferredTenguRelocation: true,
                    tenguRelocation: { appearMessage: false },
                } : {
                    oldx, oldy, x: oldx, y: oldy, moved: false,
                    tenguTeleportFailed: true,
                });
            }
        }
    }
    if (state?.u?.uswallow && state.u.ustuck !== monster
        && !monster?.mflee) {
        // monmove.c:m_move() returns MMOVE_MOVED immediately while a
        // different monster has swallowed the hero.  It neither changes
        // coordinates nor enters candidate selection/postmov hooks.
        return finishMovement({
            oldx, oldy, x: oldx, y: oldy, moved: true,
            swallowedHold: true,
        });
    }
    // mon_allowflags() owns Conflict resistance after m_move()'s swallowed
    // early-return and special-monster branches, but before mfndpos().
    if (heroHasConflict(state))
        resistConflict(monster, state, rollOne, calls);
    const heroX = state?.u?.ux ?? oldx;
    const heroY = state?.u?.uy ?? oldy;
    let gx = Number.isFinite(monster.mux) ? monster.mux : heroX;
    let gy = Number.isFinite(monster.muy) ? monster.muy : heroY;
    // m_move() establishes the base approach mode before refreshing its
    // short-range visual target and applying ranged-distance policy.
    let appr = monster.mflee ? -1
        : monster.mconf || monster.mcansee === false || monster.mcansee === 0
            ? 0 : 1;
    // C m_move() does not pursue the hero's omniscient coordinates through
    // long, unseen passages.  Outside its short direct-vision envelope, an
    // eyed monster follows the newest adjacent entry in the hero track.  The
    // goal swap consumes no randomness, but it changes which equally legal
    // candidate wins and can therefore alter a later candidate-count range.
    const monsterTile = state?.level?.at?.(oldx, oldy);
    const apparentTargetTile = state?.level?.at?.(gx, gy);
    const shouldSee = couldSeeFromHero(state, oldx, oldy)
        && (apparentTargetTile?.lit || !monsterTile?.lit)
        && dist2(oldx, oldy, gx, gy) <= 36;
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    // C m_move() distinguishes geometric COULD_SEE from the hero's rendered
    // sight.  An invisible hero in a dark but unobstructed corridor can make
    // a non-perceiving monster abandon directed pursuit before item search
    // and mfndpos()'s random reservoir.  This test precedes the unconditional
    // peaceful-milling clause, so a sighted peaceful actor still owns rn2(11).
    const heroInvisible = !!state?.invisible || !!state?.u?.invisible
        || !!state?.u?.invis || (state?.u?.invisibleTurns ?? 0) > 0;
    if (!monster.mconf
        && monster.mcansee !== false && monster.mcansee !== 0
        && shouldSee && heroInvisible && !(speciesFlags & M1_SEE_INVIS)
        && recordRandom(random, calls, 11) !== 0) {
        appr = 0;
    }
    if (monster.mpeaceful) appr = 0;
    // set_apparxy() has already established mux/muy.  m_move() never
    // replaces that apparent target with the omniscient hero coordinate;
    // it substitutes the hero's track only when the apparent target is not
    // in this short direct-vision envelope.
    if (!shouldSee && !(speciesFlags & M1_NOEYES)) {
        const track = getTrack(oldx, oldy, state);
        if (track) {
            gx = track.x;
            gy = track.y;
        }
    }
    let nix = oldx;
    let niy = oldy;
    let nidist = dist2(nix, niy, gx, gy);
    let selected = false;
    let selectedInfo = 0;
    // C m_move() makes stalkers, bats, and lights intermittently wander even
    // while hostile.  This roll is part of the approach decision and must
    // precede item search and mfndpos()'s random-reservoir selection.
    const symbol = MONSTER_SYMBOL[monster?.mnum];
    if (appr === 1 && (monster?.mnum === 153 || symbol === 28 || symbol === 25)
        && recordRandom(random, calls, 3) === 0) {
        appr = 0;
    }
    const approach = monsterApproachPolicy(
        monster, state, appr, monster.mux ?? gx, monster.muy ?? gy,
    );
    appr = approach.policy;
    // C m_move() makes ordinary peaceful monsters mill randomly rather than
    // approach the hero.  The item-search gate precedes mfndpos() and is
    // observable even when its nonzero result suppresses the unported search.
    let searchForItems;
    if (monster.mpeaceful) {
        searchForItems = recordRandom(random, calls, 10) === 0;
    } else {
        const inLine = hostileLinedUp(monster, state, random, calls)
            && distmin(oldx, oldy, gx, gy)
                <= (currentAttribute(A_STR, state) / 2 + 1);
        searchForItems = appr !== 1 || !inLine;
    }
    if (searchForItems && !state?.level?.flags?.is_rogue_level) {
        const itemSearch = monsterFloorItemGoal(monster, state);
        // monmove.c:m_search_items() maps an attractive object already
        // beneath the actor to MMOVE_DONE before mfndpos().  postmov() still
        // runs, so the shared pickup owner transfers the object and dochug()
        // performs its trailing distfleeck without a phase-four attack.
        if (itemSearch.goal
            && itemSearch.goal.x === oldx
            && itemSearch.goal.y === oldy) {
            return finishMovement({
                oldx, oldy, x: oldx, y: oldy,
                moved: false,
                actionCompleted: true,
                itemGoalUnderfoot: itemSearch.goal.object,
            });
        }
        if (itemSearch.goal) {
            gx = itemSearch.goal.x;
            gy = itemSearch.goal.y;
        }
        // m_search_items() deliberately reuses its reduced search radius as
        // a ranged-positioning signal.  At four squares, a ranged attacker
        // resumes approaching; at three or fewer it keeps backing away from
        // the remembered hero square.
        if (itemSearch.radius < 5 && appr === -1) {
            if (distmin(oldx, oldy, monster.mux, monster.muy) <= 3) {
                gx = monster.mux;
                gy = monster.muy;
            } else {
                appr = 1;
            }
        }
    }
    // C computes nidist only after m_search_items() has had a chance to
    // replace the pursuit square.  Retaining the pre-search distance makes a
    // shortsighted monster abandon a nearby item goal based on the much more
    // distant remembered hero square.
    nidist = dist2(nix, niy, gx, gy);
    const candidates = mfndpos(monster, state);
    if (!candidates.length && !isUnicorn(monster)) {
        const usedDefensive = useNoMoveHealingPotion(
            monster, state, random, rollDice, calls,
        );
        if (usedDefensive) {
            return finishMovement({
                oldx, oldy, x: oldx, y: oldy, moved: false,
                usedDefensive,
                actionCompleted: true,
            });
        }
    }
    // C monmove.c:m_move() deliberately disables directed pursuit for a
    // sufficiently distant hostile on Lua levels marked `shortsighted`.
    // `couldsee()` selects the 12-square visible threshold; otherwise the
    // monster starts milling beyond six squares.  This adjustment happens
    // after mfndpos() and before its random candidate reservoir.
    if (!monster.mpeaceful && state?.level?.flags?.shortsighted
        && nidist > (couldSeeFromHero(state, oldx, oldy) ? 144 : 36)
        && appr === 1) {
        appr = 0;
    }
    const trackCount = Math.min(4, Math.max(0, candidates.length - 1));
    const avoidHeroLine = isUnicorn(monster)
        && monsterTeleportRestricted(monster, state)
        && candidates.some(candidate => !(candidate.info & NOTONL));
    let choiceCount = 0;
    candidateLoop:
    for (const candidate of candidates) {
        if (avoidHeroLine && (candidate.info & NOTONL)) continue;
        // C m_move(): an approaching monster probabilistically avoids recent
        // track squares before comparing distance.  The range depends on both
        // candidate count and track age, so this is observable even when the
        // rejected square would not ultimately win.
        if (appr !== 0) {
            for (let j = 0; j < trackCount; j++) {
                const track = monster.mtrack?.[j];
                if (track?.x === candidate.x && track?.y === candidate.y) {
                    const trackRange = 4 * (candidates.length - j);
                    if (recordRandom(random, calls, trackRange)) {
                        continue candidateLoop;
                    }
                }
            }
        }
        const ndist = dist2(candidate.x, candidate.y, gx, gy);
        // monmove.c starts m_move() with MMOVE_NOTHING.  Its final selection
        // clause therefore accepts the first surviving candidate even when it
        // is not closer than the monster's current square.  Later candidates
        // can replace that fallback only by improving on the selected square.
        if (appr === 0) {
            if (recordRandom(random, calls, ++choiceCount) !== 0 && selected)
                continue;
        } else if (appr === 1) {
            if (selected && ndist >= nidist) continue;
        } else if (appr === -1) {
            if (selected && ndist < nidist) continue;
        } else if (appr === -2) {
            const nearer = ndist < nidist;
            const inRetreatBand = ndist <= approach.min && !nearer;
            const inAdvanceBand = ndist >= approach.max && nearer;
            if (selected && !inRetreatBand && !inAdvanceBand) continue;
        }
        nix = candidate.x;
        niy = candidate.y;
        nidist = ndist;
        selectedInfo = candidate.info;
        selected = true;
    }
    // m_move() includes ALLOW_U in its candidate reservoir, then resolves a
    // selected hero square after the sampling loop.  It returns
    // MMOVE_NOTHING so dochug() can perform the phase-four attack without
    // ever placing the monster on top of the hero.
    if (selectedInfo & ALLOW_U) {
        monster.mux = heroX;
        monster.muy = heroY;
        return finishMovement({
            oldx, oldy, x: oldx, y: oldy, moved: false,
            attemptedHero: true,
        });
    }
    if (selectedInfo & ALLOW_M) {
        const defender = monsterAt(state, nix, niy, monster);
        if (defender) {
            const attack = beginMonsterMeleeAttack(
                monster, defender, sourceMonsterMeleeAttacks(monster),
                state, random, rollDice, rollOne, calls, 'movement',
            );
            if (attack.kind === 'monster-wield') {
                return finishMovement({
                    oldx, oldy, x: oldx, y: oldy, moved: false,
                    actionCompleted: true,
                    wieldedWeapon: attack.weapon,
                });
            }
            return finishMovement({
                oldx, oldy, x: oldx, y: oldy, moved: false,
                actionCompleted: true,
                attack,
                deferredPostFlee: !!attack.deferredContact,
            });
        }
    }
    const diggingWeapon = selected
        ? readyMonsterDiggingWeapon(monster, state, nix, niy) : null;
    if (diggingWeapon) {
        return finishMovement({
            oldx, oldy, x: oldx, y: oldy, moved: false,
            wieldedWeapon: diggingWeapon,
            preparedDigging: true,
        });
    }
    monster.mx = nix;
    monster.my = niy;
    if (nix !== oldx || niy !== oldy) {
        if (!Array.isArray(monster.mtrack)) monster.mtrack = [];
        monster.mtrack.unshift({ x: oldx, y: oldy });
        monster.mtrack.length = Math.min(monster.mtrack.length, 4);
    }
    return finishMovement({
        oldx, oldy, x: nix, y: niy, moved: nix !== oldx || niy !== oldy,
    });
}

// C mthrowu.c:thrwmu()/m_throw().  A weapon attacker which moved but did not
// reach the hero can throw its selected missile down a clear line.  Retreating
// heroes give it a distance-scaled hesitation roll; a zero proceeds with the
// throw.  Intermediate flight squares each own forcehit's rn2(5) before the
// missile reaches an intervening monster.
// C mhitu.c:mattacku() -> muse.c:find_offensive()/use_offensive().
// Offensive potions preempt an AT_WEAP actor's launcher and ammunition.  The
// first live branch is one sleeping potion aimed directly at the hero; other
// potion types, stacks, and intervening targets retain distinct effect
// owners. Bottle naming itself is shared with hero-thrown potionhit().
function maybeThrowOffensiveSleepingPotion(
    monster, movement, state, random, rollOne, calls,
) {
    if (!movement?.phaseFourOffensiveEvaluated
        || !movement.phaseFourOffensiveLinedUp
        || monster?.seenSleepResistance) return null;
    const inventory = monster?.minvent || monster?.inventory || [];
    // find_offensive()'s nomore(MUSE_POT_SLEEPING) keeps the first
    // matching identity in the source minvent chain when there are duplicate
    // sleeping-potion stacks.
    const potion = inventory.find(object => object?.otyp === POT_SLEEPING);
    if (!potion
        || (potion.quan ?? potion.quantity ?? 1) !== 1) return null;

    const heroX = state?.u?.ux;
    const heroY = state?.u?.uy;
    const targetX = Number.isFinite(monster?.mux) ? monster.mux : heroX;
    const targetY = Number.isFinite(monster?.muy) ? monster.muy : heroY;
    if (targetX !== heroX || targetY !== heroY) return null;
    const distance = distmin(monster.mx, monster.my, targetX, targetY);
    const dx = Math.sign(targetX - monster.mx);
    const dy = Math.sign(targetY - monster.my);
    const path = [];
    let x = monster.mx;
    let y = monster.my;
    for (let step = 0; step < distance; step++) {
        x += dx;
        y += dy;
        if (x === heroX && y === heroY) break;
        if (state.level?.monsters?.some(candidate =>
            candidate !== monster && !candidate.dead
            && (candidate.mhp ?? 1) > 0
            && candidate.mx === x && candidate.my === y)) return null;
        path.push({ x, y });
    }
    if (x !== heroX || y !== heroY) return null;

    const potionIndex = inventory.indexOf(potion);
    if (potionIndex >= 0) inventory.splice(potionIndex, 1);
    monster.minvent = inventory;
    monster.inventory = inventory;
    potion.where = 'free';
    potion.ox = potion.oy = 0;

    // m_throw() checks forcehit after each non-stopping intermediate square.
    for (let index = 0; index < path.length; index++)
        recordRandom(random, calls, 5);

    const dexterity = state?.u?.acurr?.a?.[A_DEX] ?? 10;
    const catchChance = Math.max(
        1, 100 - dexterity
            - (['monk', 'rogue'].includes(state?.urole?.key) ? 20 : 0),
    );
    const catchEligible = !state?.blind
        && !(state?.u?.blindTurns > 0)
        && !state?.u?.confused && !state?.u?.stunned
        && !state?.u?.fumbling;
    const caught = catchEligible
        && recordRandom(random, calls, catchChance) === 0;
    const appearance = state?.objectDescriptions?.[potion.otyp]
        ?? game.objectDescriptions?.[potion.otyp]
        ?? OBJECT_DESCRIPTIONS[potion.otyp]
        ?? objectTypeName(potion);
    if (caught) {
        (state.inventory ||= []).push(potion);
        potion.where = 'invent';
        movement.actionCompleted = true;
        return {
            kind: 'offensive-sleeping-potion', object: potion,
            appearance, flightPath: path, flightGlyph: '!',
            heroTarget: true, caught: true,
        };
    }

    const bottleName = randomBottleName(
        state, range => recordRandom(random, calls, range),
    );
    const damage = rollOne(2);
    calls.push('rnd(2)');
    const preHitHp = state.u.uhp ?? 1;
    state.u.uhp = Math.max(0, preHitHp - damage);
    movement.actionCompleted = true;
    return {
        kind: 'offensive-sleeping-potion', object: potion,
        appearance, flightPath: path, flightGlyph: '!',
        heroTarget: true, caught: false, bottleName, damage, preHitHp,
        impactMessage: `The ${bottleName} crashes on your head and breaks into shards.`,
        evaporationMessage: `The ${appearance} potion evaporates.`,
        deferredVaporEffect: true,
    };
}

function heroHasMagicResistance(state) {
    const cloak = state?.uarmc || state?.u?.uarmc;
    return !!(state?.u?.antimagic
        || cloak?.otyp === CLOAK_OF_MAGIC_RESISTANCE);
}

// C mhitu.c:mattacku() -> muse.c:find_offensive()/use_offensive().
// find_offensive() aims at the monster's retained apparent hero coordinate;
// displacement can therefore select a striking wand whose ray never crosses
// the real hero.  Selection owns lined_up() before inventory inspection, then
// mzapwand() presents the zap line before charge decrement and mbhit()'s
// rn1(8,6).  Keep the post-line work deferred so tty can suspend the same
// actor transaction on an older topline.
function maybeBeginOffensiveWand(
    monster, state, random, calls, { linedUp = undefined } = {},
) {
    const flags1 = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (monster?.mpeaceful || state?.u?.uswallow
        || (flags1 & (M1_ANIMAL | M1_MINDLESS | M1_NOHANDS))) {
        return { probed: false, action: null };
    }

    const aimed = linedUp === undefined
        ? hostileLinedUp(monster, state, random, calls) : linedUp;
    const heroMagicResistance = heroHasMagicResistance(state);
    if (!aimed || monster?.seenMagicResistance) {
        return { probed: true, action: null };
    }

    const heroX = state?.u?.ux;
    const heroY = state?.u?.uy;
    const targetX = Number.isFinite(monster?.mux) ? monster.mux : heroX;
    const targetY = Number.isFinite(monster?.muy) ? monster.muy : heroY;
    const reflectionSkip = distmin(
        monster.mx, monster.my, targetX, targetY,
    ) <= 1 || !!monster?.seenReflection;
    const inventory = monster?.minvent || monster?.inventory || [];
    // find_offensive() walks minvent head-to-tail and keeps the last viable
    // *type*.  For this projected striking/magic-missile slice, retaining each
    // later eligible object reproduces that oldest-viable final selection.
    let wand = null;
    for (const object of inventory) {
        if ((object?.otyp === WAN_STRIKING
                || object?.otyp === WAN_MAGIC_MISSILE && !reflectionSkip)
            && (object.spe ?? 0) > 0) {
            wand = object;
        }
    }
    if (!wand) return { probed: true, action: null };

    return {
        probed: true,
        action: {
            kind: wand.otyp === WAN_MAGIC_MISSILE
                ? 'offensive-wand-magic-missile'
                : 'offensive-wand-striking',
            object: wand,
            targetX,
            targetY,
            rayDx: Math.sign(targetX - monster.mx),
            rayDy: Math.sign(targetY - monster.my),
            heroTarget: targetX === heroX && targetY === heroY
                && distmin(monster.mx, monster.my, heroX, heroY) === 1,
            heroMagicResistance,
            firstShotForcedMiss: !monster.mwandexp,
            deferredEffect: true,
        },
    };
}

function beginHeroAttackOrStrikingWand(
    monster, state, random, rollOne, rollDice, calls,
) {
    const threshold = monsterAttackThreshold(
        monster, state, rollOne, calls,
    );
    const offensive = maybeBeginOffensiveWand(
        monster, state, random, calls,
    );
    if (offensive.action) return { offensiveWand: offensive.action };
    return {
        attack: basicMonsterAttack(
            monster, state, random, rollOne, rollDice, calls,
            0, threshold, null, !!state?._deferVisibleMonsterContact,
            false, offensive.probed,
        ),
    };
}

function maybeThrowRangedWeapon(
    monster, movement, state, random, rollOne, calls,
) {
    // dochug() only enters mattacku() when the second distfleeck() still
    // considers the apparent target in range.  thrwmu() may ready a launcher
    // before it checks for a usable missile or clear line, but it is never
    // reached at all for an actor beyond BOLT_LIM.
    if (!monsterHasWeaponAttack(monster)
        || !reachesDistantPhaseFour(monster, movement, state)) return null;
    const wieldedWeapon = readyRangedMonsterWeapon(monster);
    if (wieldedWeapon) return { wieldedWeapon };
    const weapon = selectRangedWeapon(monster);
    if (!weapon || !hostileLinedUp(monster, state, random, calls)) return null;

    const heroX = state?.u?.ux ?? monster.mx;
    const heroY = state?.u?.uy ?? monster.my;
    const distance = distmin(monster.mx, monster.my, heroX, heroY);
    const previousDistance = distmin(
        monster.mx, monster.my,
        state?.u?.ux0 ?? heroX, state?.u?.uy0 ?? heroY,
    );
    if (distance > previousDistance
        && recordRandom(random, calls, Math.max(1, BOLT_LIM - distance)) !== 0)
        return null;

    return throwMonsterWeaponAtHero(monster, state, weapon, {
        random: range => recordRandom(random, calls, range),
        rollOne,
    });
}

function reachesDistantPhaseFour(monster, movement, state) {
    if (!movement || movement.deferredPostFlee
        || movement.pickupConsumedAction || movement.swallowedHold
        || movement.eating
        || monster?.mpeaceful || monster?.pet || monster?.mtame
        || (monster?.mhp ?? 1) <= 0) return false;
    const targetX = Number.isFinite(monster?.mux)
        ? monster.mux : state?.u?.ux ?? monster.mx;
    const targetY = Number.isFinite(monster?.muy)
        ? monster.muy : state?.u?.uy ?? monster.my;
    const targetDistance = dist2(monster.mx, monster.my, targetX, targetY);
    return targetDistance >= 3 && targetDistance <= BOLT_LIM * BOLT_LIM;
}

// C mhitu.c:mattacku() -> mthrowu.c:breamu()/breamm().  The launch gate is
// part of the quiet actor slice, but dobuzz() is resumable presentation: a
// floor-effect or hit line can fill tty's topline before the ray has applied
// its next target's damage.
function maybeBreatheAtHero(
    monster, movement, state, random, rollOne, calls,
) {
    const attacks = (MONSTER_ATTACKS[monster?.mnum] || [])
        .filter(([attackType]) => attackType === AT_BREA);
    if (!attacks.length || !reachesDistantPhaseFour(monster, movement, state))
        return null;

    if (!movement.phaseFourArmorClassEvaluated) {
        sourceHeroArmorClass(state, rollOne, calls);
        movement.phaseFourArmorClassEvaluated = true;
    }
    if (!monsterLinedUpWithPerceivedHero(monster, state, random, calls))
        return null;

    const [, damageType, dice, sides] = attacks[0];
    if (monster.mcan) {
        return {
            attempted: true, launched: false, cough: true,
            damageType, dice, sides,
        };
    }
    if ((monster.mspec_used ?? 0)
        || recordRandom(random, calls, 3) === 0) {
        return {
            attempted: true, launched: false,
            damageType, dice, sides,
        };
    }

    const targetX = Number.isFinite(monster.mux)
        ? monster.mux : state?.u?.ux ?? monster.mx;
    const targetY = Number.isFinite(monster.muy)
        ? monster.muy : state?.u?.uy ?? monster.my;
    return {
        attempted: true, launched: true, deferredRay: true,
        damageType, dice, sides,
        targetX, targetY,
        x: monster.mx, y: monster.my,
        dx: Math.sign(targetX - monster.mx),
        dy: Math.sign(targetY - monster.my),
    };
}

// C ref: mkmaze.c:fumaroles(). Steam vents use the same cloud builder as
// fire striking water.
export function fumaroles(state = game) {
    let cloudCount = rn2(3);
    let minimumSize = 5;
    if (Is_firelevel(state.u?.uz)) {
        cloudCount++;
        minimumSize += 5;
    }
    if ((state.level?.flags?.temperature || 0) > 0) {
        cloudCount++;
        minimumSize += 5;
    }

    let heard = false;
    let loud = false;
    for (let count = cloudCount; count > 0; count--) {
        const x = rn2(COLNO - 4) + 3;
        const y = rn2(ROWNO - 4) + 3;
        if (state.level?.at?.(x, y)?.typ !== LAVAPOOL) continue;
        createSteamCloud(
            state, x, y, rn2(10) + minimumSize, rn2,
        );
        heard = true;
        const dx = x - (state.u?.ux ?? 0);
        const dy = y - (state.u?.uy ?? 0);
        if (dx * dx + dy * dy < 15) loud = true;
    }
    return { heard, loud };
}

function rayArmorClass(target, state) {
    return target === state.u
        ? state.u?.uac ?? 10
        : findMonsterArmorClass(target);
}

function fireRayHits(target, state, random, rollOne, calls) {
    let roll = recordRandom(random, calls, 20);
    if (roll === 0) {
        roll = rollOne(10);
        calls.push('rnd(10)');
    }
    let armorClass = rayArmorClass(target, state);
    if (armorClass < 0) {
        armorClass = -rollOne(-armorClass);
        calls.push(`rnd(${-armorClass})`);
    }
    return 3 - roll < armorClass;
}

function monsterAtRayCell(state, x, y, aggressor) {
    return state?.level?.monsters?.find(monster =>
        monster !== aggressor && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function rayPositionOpen(state, x, y) {
    if (!isok(x, y)) return false;
    const loc = state?.level?.at?.(x, y);
    if (!loc || IS_OBSTRUCTED(loc.typ)) return false;
    return !(IS_DOOR(loc.typ)
        && ((loc.doormask ?? 0) & (D_CLOSED | D_LOCKED)));
}

// Resume dobuzz() for a natural fire breath.  Message delivery is injected
// by allmain so an await keeps the same C actor transaction alive across tty
// acknowledgements; every mutation and core draw remains owned here.
export async function resolveDeferredMonsterBreath(
    action, state, emitMessage, random = rn2, rollDice = d, rollOne = rnd,
) {
    const breath = action?.movement?.breathAttack;
    if (!breath?.deferredRay) return breath || null;
    const monster = action.monster;
    const calls = action.calls;
    if (breath.damageType !== AD_FIRE) {
        breath.deferredRay = false;
        return breath;
    }

    if (!breath.started) {
        breath.started = true;
        const sourceSeen = !state.blind
            && !!(state.viz_array?.[monster.my]?.[monster.mx] & 0x2);
        if (sourceSeen && emitMessage)
            await emitMessage(`The ${MONSTER_NAME[monster.mnum]} breathes fire!`);
        breath.range = 7 + recordRandom(random, calls, 7);
        breath.lastFloorMessage = null;
    }

    while (breath.range > 0) {
        breath.range--;
        breath.x += breath.dx;
        breath.y += breath.dy;
        if (!rayPositionOpen(state, breath.x, breath.y)) break;

        const loc = state.level.at(breath.x, breath.y);
        if (IS_POOL(loc.typ)) {
            const cloudSize = rollOne(5);
            calls.push('rnd(5)');
            createSteamCloud(
                state, breath.x, breath.y, cloudSize, random,
            );
            if (breath.lastFloorMessage !== 'hissing') {
                breath.lastFloorMessage = 'hissing';
                if (emitMessage) await emitMessage(
                    state.deaf ? null : state.blind
                        ? 'You hear hissing gas.' : 'Some water evaporates.',
                );
            }
        } else {
            breath.lastFloorMessage = null;
        }

        const target = monsterAtRayCell(
            state, breath.x, breath.y, monster,
        );
        if (target) {
            if (fireRayHits(target, state, random, rollOne, calls)) {
                let damage = 0;
                if (!((MONSTER_RESISTS[target.mnum] ?? 0) & 0x01)) {
                    damage = rollDice(breath.dice, 6);
                    calls.push(`d(${breath.dice},6)`);
                    const torso = await burnArmorByFire(
                        target, state, emitMessage, calls, random,
                    );
                    if (torso && recordRandom(random, calls, 3) === 0) {
                        // destroy_items()/ignite_items() retain their own
                        // future branch; this gate is source-visible even for
                        // an empty monster inventory.
                    }
                    target.mhp = Math.max(0, (target.mhp ?? 1) - damage);
                }
                const seen = !state.blind
                    && !!(state.viz_array?.[target.my]?.[target.mx] & 0x2);
                const died = (target.mhp ?? 0) <= 0;
                if (died) {
                    const deathMessage = seen
                        ? `The ${MONSTER_NAME[target.mnum]
                        } is killed by the blast of fire!`
                        : null;
                    await finishMonsterRayDeath(target, {
                        deathMessage,
                        visible: seen,
                        spotted: canProjectMonster(
                            target, target.mx, target.my,
                        ),
                    }, state, emitMessage || plineWithContinuation, random);
                } else if (emitMessage) {
                    await emitMessage(
                        `The blast of fire hits ${
                            seen ? `the ${MONSTER_NAME[target.mnum]}` : 'it'
                        }!`,
                    );
                }
                breath.range -= 2;
            }
            continue;
        }

        if (breath.x === state.u?.ux && breath.y === state.u?.uy
            && breath.range >= 0
            && fireRayHits(state.u, state, random, rollOne, calls)) {
            breath.range -= 2;
            if (emitMessage)
                await emitMessage('The blast of fire hits you!');
            const damage = rollDice(breath.dice, 6);
            calls.push(`d(${breath.dice},6)`);
            const torso = await burnArmorByFire(
                state.u, state, emitMessage, calls, random,
            );
            if (torso) {
                recordRandom(random, calls, 3);
                recordRandom(random, calls, 3);
            }
            state.u.uhp = Math.max(0, (state.u.uhp ?? 1) - damage);
        }
    }

    if (recordRandom(random, calls, 3) === 0)
        monster.mspec_used = 8 + recordRandom(random, calls, 18);
    breath.deferredRay = false;
    breath.finished = true;
    return breath;
}

// C mhitu.c:mattacku() -> mthrowu.c:spitmu()/spitmm().  Object construction
// and the distance-scaled launch trial occur before any projectile traversal.
// A successful launch is deliberately left suspended so allmain can project
// the visible launch line (and any tty pager) before m_throw() advances RNG.
function maybeSpitAtHero(
    monster, movement, state, random, rollOne, calls,
) {
    const attack = monsterSpitAttack(monster);
    if (!attack || !reachesDistantPhaseFour(monster, movement, state))
        return null;

    if (!movement.phaseFourArmorClassEvaluated) {
        sourceHeroArmorClass(state, rollOne, calls);
        movement.phaseFourArmorClassEvaluated = true;
    }
    const targetX = Number.isFinite(monster.mux)
        ? monster.mux : state?.u?.ux ?? monster.mx;
    const targetY = Number.isFinite(monster.muy)
        ? monster.muy : state?.u?.uy ?? monster.my;
    if (!monster.mcan
        && !monsterLinedUpWithPerceivedHero(
            monster, state, random, calls,
        )) return null;
    return beginMonsterSpitAttack(monster, targetX, targetY, {
        attack,
        random: range => recordRandom(random, calls, range),
    });
}

export function resumeDeferredSpitAttack(
    action, state, random = rn2, rollOne = rnd,
) {
    const spit = action?.movement?.spitAttack;
    if (!spit?.deferredFlight) return spit || null;
    const result = resolveMonsterSpitFlight(action.monster, spit, state, {
        random: range => recordRandom(random, action.calls, range),
        rollOne: range => {
            const result = rollOne(range);
            action.calls.push(`rnd(${range})`);
            return result;
        },
    });
    return result;
}

function pointsOnline(x0, y0, x1, y1) {
    const dx = x0 - x1;
    const dy = y0 - y1;
    return !dx || !dy || dy === dx || dy === -dx;
}

function sameDungeonLevel(a, b) {
    return !!a && !!b
        && a.dnum === b.dnum && a.dlevel === b.dlevel;
}

// C refs: priest.c:pri_move()/move_special().  A shrine priest which remains
// in its own temple chooses an altar-adjacent goal with two rn1(3,-1) draws,
// then takes the legal room step which most directly approaches that goal.
// This special movement runs before ordinary floor-object goals and combat.
function movePriest(monster, state, random, calls) {
    const epri = monster?.epri || monster?.mextra?.epri;
    if (!monster?.ispriest || !epri) return null;
    const roomno = state?.level?.at?.(monster.mx, monster.my)?.roomno;
    if (roomno !== epri.shroom
        || !sameDungeonLevel(epri.shrlevel, state?.u?.uz)) return null;

    const oldx = monster.mx, oldy = monster.my;
    const shrine = epri.shrpos || {};
    const goalX = (shrine.x ?? oldx) + recordRandom(random, calls, 3) - 1;
    const goalY = (shrine.y ?? oldy) + recordRandom(random, calls, 3) - 1;
    if (oldx === goalX && oldy === goalY) {
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false, priest: true,
        };
    }

    let avoid = true;
    let approach = true;
    if (monster.mconf) {
        avoid = false;
        approach = false;
    } else if (state?.u?.invisible || state?.u?.invis) {
        avoid = false;
    }

    const candidates = mfndpos(monster, state);
    const pickMove = avoidOnline => {
        let nextX = oldx, nextY = oldy;
        let nextInfo = 0, choiceCount = 0;
        let bestDistance = dist2(oldx, oldy, goalX, goalY);
        for (const candidate of candidates) {
            const loc = state?.level?.at?.(candidate.x, candidate.y);
            if (!IS_ROOM(loc?.typ)) continue;
            if (avoidOnline && (candidate.info & NOTONL)
                && !(candidate.info & ALLOW_M)) continue;
            const better = !approach
                ? recordRandom(random, calls, ++choiceCount) === 0
                : dist2(candidate.x, candidate.y, goalX, goalY)
                    < bestDistance;
            if (!better && !(candidate.info & ALLOW_M)) continue;
            nextX = candidate.x;
            nextY = candidate.y;
            nextInfo = candidate.info;
            bestDistance = dist2(nextX, nextY, goalX, goalY);
        }
        return { nextX, nextY, nextInfo };
    };

    let selected = pickMove(avoid);
    if (avoid && selected.nextX === oldx && selected.nextY === oldy
        && pointsOnline(oldx, oldy, state?.u?.ux, state?.u?.uy)) {
        selected = pickMove(false);
    }
    if (selected.nextInfo & ALLOW_M
        || monsterAt(state, selected.nextX, selected.nextY, monster)
        || (state?.u?.ux === selected.nextX
            && state?.u?.uy === selected.nextY)) {
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false, priest: true,
        };
    }
    monster.mx = selected.nextX;
    monster.my = selected.nextY;
    return {
        oldx, oldy, x: selected.nextX, y: selected.nextY,
        moved: selected.nextX !== oldx || selected.nextY !== oldy,
        priest: true,
    };
}

// C refs: shk.c:shk_move() and priest.c:move_special().  A peaceful,
// debt-free shopkeeper normally waits near its home square.  When the hero
// lines up with it, a shopkeeper exactly at home deliberately mills among the
// legal shop-room neighbours; move_special's reservoir sampling owns one
// rn2(++chcnt) per eligible square.  This is visible during long travel even
// when the shop itself never enters the viewport.
function moveShopkeeper(monster, state, random, calls) {
    if (!monster?.isshk || !monster?.eshk || !monster.mpeaceful) return null;

    const oldx = monster.mx;
    const oldy = monster.my;
    const home = monster.eshk.shk;
    if (!home) return null;
    const heroX = state?.u?.ux ?? oldx;
    const heroY = state?.u?.uy ?? oldy;
    const following = !!monster.eshk.following;
    const debt = (monster.eshk.robbed ?? 0) || (monster.eshk.billct ?? 0)
        || (monster.eshk.debit ?? 0);
    const atHome = oldx === home.x && oldy === home.y;
    const online = pointsOnline(oldx, oldy, heroX, heroY);
    const door = monster.eshk.shd;
    const uOnDoor = !!door && heroX === door.x && heroY === door.y;

    // The current shop model has no digging-tool admission blocker.  Under
    // the ordinary debt-free branch shk_move() returns immediately unless the
    // shopkeeper is lined up with the hero.
    if (!following && !debt && dist2(oldx, oldy, home.x, home.y) < 3
        && !online) {
        return { oldx, oldy, x: oldx, y: oldy, moved: false };
    }

    let goalX = home.x;
    let goalY = home.y;
    let appr = 1;
    if (!following && !debt && atHome && online) {
        appr = 0;
        goalX = goalY = 0;
    }

    const currentRoom = state?.level?.at?.(oldx, oldy)?.roomno;
    const inHisShop = currentRoom === monster.eshk.shoproom;
    const candidates = mfndpos(monster, state);
    let avoid = uOnDoor;
    if (!uOnDoor && state?.u?.ushops
        && dist2(heroX, heroY, home.x, home.y) > 8) {
        avoid = true;
    }
    if (monster.mconf) {
        avoid = false;
        appr = 0;
    } else if (avoid && uOnDoor
        && !candidates.some(candidate => !(candidate.info & NOTONL))) {
        // move_special() abandons avoidance when every legal square remains
        // on-line with the hero; otherwise NOTONL squares are filtered.
        avoid = false;
    }
    let nextX = oldx;
    let nextY = oldy;
    let chcnt = 0;
    let bestDistance = dist2(oldx, oldy, goalX, goalY);
    for (const candidate of candidates) {
        const loc = state?.level?.at?.(candidate.x, candidate.y);
        if (!(IS_ROOM(loc?.typ)
            || (!inHisShop || following))) continue;
        if (avoid && (candidate.info & NOTONL)
            && !(candidate.info & ALLOW_M)) continue;
        if (!appr) {
            if (recordRandom(random, calls, ++chcnt) !== 0) continue;
        } else {
            const candidateDistance = dist2(
                candidate.x, candidate.y, goalX, goalY,
            );
            if (candidateDistance >= bestDistance) continue;
            bestDistance = candidateDistance;
        }
        nextX = candidate.x;
        nextY = candidate.y;
    }

    monster.mx = nextX;
    monster.my = nextY;
    return {
        oldx, oldy, x: nextX, y: nextY,
        moved: nextX !== oldx || nextY !== oldy,
        shopkeeper: true,
    };
}

function trapAtMonster(monster, state) {
    return trapAt(state, monster.mx, monster.my);
}

// C ref: trap.c mintrap()/trapeffect_bear_trap().  An actor already held by
// a bear trap gets its 1-in-40 escape attempt at the start of m_move(); one
// which has just selected a destination triggers that square from postmov().
// Keep d(2,4) as one dice operation rather than two visible rn2(4) calls.
function releaseFromMonsterTrap(monster, state, random, calls) {
    const trap = trapAtMonster(monster, state);
    if (!trap) {
        monster.mtrapped = 0;
        return { held: false, escaped: false };
    }
    if (recordRandom(random, calls, 40) !== 0)
        return { held: true, escaped: false, trap };
    monster.mtrapped = 0;
    return { held: false, escaped: true, trap };
}

function placeAndStackTrapMissile(object, state, x, y) {
    if (state === game) place_object(object, x, y);
    else placeThrownObject(state, object, x, y);
    return stack_object(object, state);
}

function migrateMonsterOffLevel(monster, state, trap, {
    kind, mode, confused = false,
}) {
    const x = monster.mx, y = monster.my;
    const visible = !state?.blind && !(state?.u?.blindTurns > 0)
        && !!(state?.viz_array?.[y]?.[x] & 0x2)
        && (!monster.minvis || state?.u?.seeInvisible
            || state?.u?.see_invisible);
    state.level.monsters = (state.level.monsters || [])
        .filter(candidate => candidate !== monster);
    if (!Array.isArray(state._migratingMonsters))
        state._migratingMonsters = [];
    if (confused) monster.mconf = 1;
    monster.migrating = true;
    monster.migrationMode = mode;
    monster.migrationOrigin = { ...(state.u?.uz || {}) };
    monster.migrationDestination = { ...(trap.dst || {}) };
    monster.migrationSource = { x, y };
    monster.mx = 0;
    monster.my = 0;
    state._migratingMonsters.push(monster);
    return {
        kind, trap, visible, destination: monster.migrationDestination,
        damage: 0, killed: false,
    };
}

function triggerMonsterTrap(
    monster, state, movement, random, rollDice, rollOne, calls,
) {
    const trap = trapAtMonster(monster, state);
    if (!trap || monster.mtrapped) return null;
    if (trap.ttyp === MAGIC_PORTAL) {
        // trap.c:mintrap()->trapeffect_magic_portal() treats a fixed portal
        // as inescapable, then routes monsters through mlevel_tele_trap().
        // migrate_to_level() removes the actor from fmon and stores its
        // destination out of map before postmov() can return to dochug(), so
        // there is no trailing distfleeck() draw for this action.
        // TODO: handle leashes and the endgame Amulet restriction for pets.
        if (monster.pet || (monster.mtame ?? 0) > 0) return null;
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = migrateMonsterOffLevel(monster, state, trap, {
            kind: 'magic-portal-migration',
            mode: 'portal',
            confused: true,
        });
        movement.trap = event;
        movement.actorLeftLevel = true;
        movement.actionCompleted = true;
        return event;
    }
    if (trap.ttyp === TELEP_TRAP) {
        const fixedDestination = trap.teledest
            && isok(trap.teledest.x, trap.teledest.y);
        if (!fixedDestination && monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }

        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = teleportMonsterFromTrap(monster, trap, {
            state, calls, random, rollOne,
        });
        movement.trap = event;
        movement.actionCompleted = true;
        if (event.relocation) {
            movement.x = event.relocation.x;
            movement.y = event.relocation.y;
            movement.moved = movement.oldx !== movement.x
                || movement.oldy !== movement.y;
        }
        return event;
    }
    if (trap.ttyp === RUST_TRAP) {
        const visible = !state?.blind && !(state?.u?.blindTurns > 0)
            && !!(state?.viz_array?.[monster.my]?.[monster.mx] & 0x2)
            && (!monster.minvis || state?.u?.seeInvisible
                || state?.u?.see_invisible);
        if (visible) trap.tseen = true;
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = applyMonsterRustTrap(monster, state, {
            roll: range => recordRandom(random, calls, range),
        });
        event.trap = trap;
        event.visible = visible;
        if (event.completelyRusted) {
            monster.mhp = 0;
            event.killed = true;
            movement.actorDied = true;
            movement.actionCompleted = true;
            movement.deferredAfterRustTrapMessage = true;
        }
        movement.trap = event;
        return event;
    }
    if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
        if (monsterAvoidsPit(monster)) return null;
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = beginMonsterPitTrap(monster, trap, state);
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) {
        // trap.c:trapeffect_hole()->mlevel_tele_trap().  A grounded,
        // non-huge ordinary actor migrates to the trap's fixed destination.
        // migrate_to_level() unlinks it from fmon, so postmov() terminates
        // before dochug()'s trailing distfleeck and the allocation loop no
        // longer sees it.  Flight and huge-monster behavior remain the
        // harmless trap eligibility already shared with mfndpos().
        const airborne = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY);
        const tooLarge = (MONSTER_SIZE[monster.mnum] ?? 2) >= 4;
        if (airborne || tooLarge || !trap.dst) return null;
        // mintrap() grants thinking monsters implicit knowledge of holes
        // (but not trap doors) even before mtrapseen records the type.  The
        // destination remains legal to mfndpos(); this later gate usually
        // declines the effect after the actor has entered the square.
        const implicitlyKnowsHole = trap.ttyp === HOLE
            && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_MINDLESS);
        if ((monsterKnowsTrap(monster, trap) || implicitlyKnowsHole)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        // TODO: offer to release an uncursed leash before migration.
        if (monster.mleashed) return null;
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = migrateMonsterOffLevel(monster, state, trap, {
            kind: 'level-fall-migration',
            mode: 'random',
        });
        movement.trap = event;
        movement.actorLeftLevel = true;
        movement.actionCompleted = true;
        return event;
    }
    if (trap.ttyp === ROLLING_BOULDER_TRAP) {
        // trap.c:trapeffect_rolling_boulder_trap()->launch_obj().  Airborne
        // actors do not depress the trigger.  A monster which already knows
        // the trap gets mintrap()'s ordinary three-in-four avoidance chance.
        if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY) return null;
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);

        const visible = !state?.blind && !(state?.u?.blindTurns > 0)
            && !!(state?.viz_array?.[monster.my]?.[monster.mx] & 0x2)
            && (!monster.minvis || state?.u?.seeInvisible
                || state?.u?.see_invisible);
        const wasSeen = !!trap.tseen;
        const launch = trap.launch || { x: trap.tx, y: trap.ty };
        const endpoint = trap.launch2 || { x: trap.tx, y: trap.ty };
        const sourcePile
            = state.level.objects?.[launch.x]?.[launch.y] || [];
        const boulder = sourcePile.find(object => object.otyp === BOULDER);
        if (!boulder) {
            const event = {
                kind: 'rolling-boulder', trap, visible, wasSeen,
                released: false, damage: 0, killed: false,
            };
            movement.trap = event;
            return event;
        }
        sourcePile.splice(sourcePile.indexOf(boulder), 1);
        boulder.where = 'free';

        // The launch line always crosses the trigger square.  ohitmon()
        // resolves that accidental target before the boulder continues to
        // the opposite endpoint.
        const hitRoll = rollOne(20);
        calls.push('rnd(20)');
        const hitThreshold = 5 + findMonsterArmorClass(monster);
        const hit = hitRoll <= hitThreshold;
        const monsterHpBefore = monster.mhp ?? 1;
        let damage = 0;
        if (hit) {
            const damageTable = (MONSTER_SIZE[monster.mnum] ?? 2) >= 3
                ? OBJECT_LARGE_DAMAGE : OBJECT_SMALL_DAMAGE;
            const damageSides = Math.max(1, damageTable[BOULDER] || 1);
            damage = rollOne(damageSides);
            calls.push(`rnd(${damageSides})`);
            monster.mhp = Math.max(0, monsterHpBefore - damage);
        }
        if (visible) trap.tseen = true;
        const killed = monster.mhp <= 0;
        const event = {
            kind: 'rolling-boulder', trap, visible, wasSeen,
            released: true, boulder,
            launch: { ...launch }, endpoint: { ...endpoint },
            hitRoll, hitThreshold, hit,
            monsterHpBefore, monsterHpAfter: monster.mhp,
            damage, killed, deferredDeath: killed,
            deferredPlacement: true,
        };
        movement.trap = event;
        if (killed) {
            movement.actorDied = true;
            movement.actionCompleted = true;
            movement.deferredAfterRollingBoulderMessage = true;
        }
        return event;
    }
    if (trap.ttyp === SQKY_BOARD) {
        const event = beginMonsterSqueakyBoard(monster, trap, state);
        if (!event) return null;
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const avoided = {
                kind: 'known-trap-avoided', trap, damage: 0,
            };
            movement.trap = avoided;
            return avoided;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === SLP_GAS_TRAP) {
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = beginMonsterSleepGasTrap(monster, trap, state, {
            rollOne: range => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (sleepGasTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === ARROW_TRAP || trap.ttyp === DART_TRAP) {
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = beginMonsterProjectileTrap(monster, trap, state, {
            random: range => recordRandom(random, calls, range),
            rollOne: range => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (projectileTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === ROCKTRAP) {
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = beginMonsterRockTrap(monster, trap, state, {
            random: range => recordRandom(random, calls, range),
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
        });
        movement.trap = event;
        if (rockTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === LANDMINE) {
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);

        const event = beginMonsterLandMine(monster, trap, state, {
            random: range => recordRandom(random, calls, range),
            rollOne: range => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (landMineNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === FIRE_TRAP) {
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = beginMonsterFireTrap(monster, trap, state, {
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
        });
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === WEB) {
        // trap.c:mintrap() checks learned-trap avoidance, then projects trap
        // knowledge, before delegating to trapeffect_web().  Only the effect
        // discovers that webmakers cross safely, so they still learn an
        // unknown web and own later avoidance probes.
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        if ([94, 96].includes(monster.mnum)) return null;
        monster.mtrapped = 1;
        if (!state?.viz_array
            || (state.viz_array?.[monster.my]?.[monster.mx] & 0x2)) {
            trap.tseen = true;
        }
        const event = { kind: 'web-trap', trap, damage: 0, killed: false };
        movement.trap = event;
        return event;
    }
    if (trap.ttyp === MAGIC_TRAP) {
        // mintrap() still triggers traps which m_harmless_trap() allowed the
        // monster to enter.  A monster which has learned this trap type gets
        // the ordinary 3-in-4 avoidance check before the effect selector.
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const fire = recordRandom(random, calls, 21) === 0;
        if (fire) {
            const event = beginMonsterFireTrap(monster, trap, state, {
                rollDice: (count, sides) => {
                    const result = rollDice(count, sides);
                    calls.push(`d(${count},${sides})`);
                    return result;
                },
            });
            movement.trap = event;
            movement.deferredAfterMonsterTrap = true;
            return event;
        }
        const event = {
            kind: 'magic-trap', trap, damage: 0, killed: false,
        };
        movement.trap = event;
        return event;
    }
    if (trap.ttyp === ANTI_MAGIC) {
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const effect = applyMonsterAntiMagicTrap(monster, {
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
            rollOne: sides => {
                const result = rollOne(sides);
                calls.push(`rnd(${sides})`);
                return result;
            },
        });
        const { inSight, seeSquare } = monsterTrapVisibility(monster, state);
        const visibleEffect = effect.resisted || effect.energyDrain > 0;
        if (inSight && visibleEffect) trap.tseen = true;
        const event = {
            trap, ...effect, inSight, seeSquare, visible: inSight,
        };
        if (inSight && effect.energyDrain > 0)
            movement.deferredAfterMonsterTrap = true;
        if (effect.killed) {
            movement.actorDied = true;
            movement.actionCompleted = true;
            movement.deferredAfterMonsterTrap = true;
        }
        movement.trap = event;
        return event;
    }
    if (trap.ttyp === POLY_TRAP) {
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = applyMonsterPolymorphTrap(monster, trap, state, {
            random: range => recordRandom(random, calls, range),
        });
        movement.trap = event;
        if (!event.finished) movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === VIBRATING_SQUARE) {
        if (monsterKnowsTrap(monster, trap)
            && recordRandom(random, calls, 4) !== 0) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
        monsterLearnsTrap(monster, trap);
        monstersSeeTrap(state, trap);
        const event = beginMonsterVibratingSquare(monster, trap, state);
        movement.trap = event;
        if (!event.finished) movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp !== BEAR_TRAP) return null;
    // MZ_SMALL and smaller pass through a bear trap.  The starting pony is
    // MZ_LARGE and has none of the airborne/amorphous exceptions.
    if ((MONSTER_SIZE[monster.mnum] ?? 0) <= 1) return null;

    // mintrap(): a monster which has learned this trap type usually evades a
    // newly entered trap.  Hero knowledge (trap.tseen) is deliberately a
    // different state bit and is consulted earlier by dog_move().
    if (monsterKnowsTrap(monster, trap)
        && recordRandom(random, calls, 4) !== 0) {
        const event = { kind: 'known-trap-avoided', trap, damage: 0 };
        movement.trap = event;
        return event;
    }
    monsterLearnsTrap(monster, trap);
    monstersSeeTrap(state, trap);

    monster.mtrapped = 1;
    const inSight = !state?.viz_array
        || !!(state.viz_array?.[monster.my]?.[monster.mx] & 0x2);
    if (inSight) {
        // trap.c sets mtrapped before the visible caught pline, but rolls
        // damage only after that call returns.  A pending reluctance message
        // can suspend tty inside the pline, so preserve that exact boundary.
        const event = {
            kind: 'bear-trap', trap, damage: 0, killed: false,
            deferredDamage: true,
        };
        movement.trap = event;
        movement.deferredAfterBearTrapMessage = true;
        return event;
    }
    const damage = rollDice(2, 4);
    calls.push('d(2,4)');
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    const event = { kind: 'bear-trap', trap, damage, killed: monster.mhp <= 0 };
    movement.trap = event;
    return event;
}

// C trap.c:mintrap() entry for actors placed by a source effect rather than
// by m_move()/postmov().  The trap engine remains the single state/RNG owner;
// this boundary intentionally does not run tunneling, pickup, concealment,
// distfleeck(), or an attack tail.  Callers must present and resume any
// deferred trap event before continuing their own source transaction.
export function triggerImmediateMonsterTrap(
    monster,
    state = game,
) {
    const calls = DISCARDED_CALL_LOG;
    const movement = {
        oldx: monster?.mx,
        oldy: monster?.my,
        x: monster?.mx,
        y: monster?.my,
        moved: false,
        immediateTrap: true,
    };
    const event = triggerMonsterTrap(
        monster, state, movement, rn2, d, rnd, calls,
    );
    return { monster, movement, event, calls };
}

function handleMonsterDoor(monster, state, movement, rollOne = rnd, calls = []) {
    if (!movement?.moved) return;
    const door = state?.level?.at?.(monster.mx, monster.my);
    if (!door || !IS_DOOR(door.typ)) return;
    const allowFlags = monAllowFlags(monster, state);
    // C postmov()/mb_trapped(): admission happens while the door is still
    // closed, then its trap destroys the door and damages/stuns the actor.
    // This precedes the action's trailing distfleeck() and owns rnd(15).
    if ((door.doormask & D_TRAPPED)
        && (door.doormask & (D_CLOSED | D_LOCKED))) {
        door.doormask = D_NODOOR;
        const damage = rollOne(15);
        calls.push('rnd(15)');
        monster.mstun = 1;
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
        movement.doorExplosion = {
            damage, killed: monster.mhp <= 0,
        };
        return;
    }
    // C postmov(): mfndpos() first permits a capable monster to enter the
    // closed-door square, then postmov() changes that door to D_ISOPEN.
    if (door.doormask === D_CLOSED && (allowFlags & OPENDOOR)) {
        door.doormask = D_ISOPEN;
        movement.openedDoor = true;
    }
}

function nextHeroAttackIndex(monster, attackIndex) {
    const attacks = MONSTER_ATTACKS[monster?.mnum] || [];
    for (let index = attackIndex + 1; index < attacks.length; index++) {
        const attackType = attacks[index]?.[0] ?? 0;
        // mhitu.c handles these adjacent natural contact methods through the
        // same to-hit/hitmu path.  AT_MAGC remains in the same mattacku()
        // attack table but owns castmu() instead of a to-hit roll.  Weapon,
        // gaze, engulfing, and ranged slots retain separate future owners.
        if ((attackType >= 1 && attackType <= 7)
            || attackType === AT_MAGC
            || (monster?.mnum === PM_ENERGY_VORTEX
                && attackType === AT_ENGL)) return index;
    }
    return null;
}

function retainHeroAttackContinuation(result, monster, attackIndex) {
    const nextAttackIndex = nextHeroAttackIndex(monster, attackIndex);
    if (nextAttackIndex !== null) result.nextAttackIndex = nextAttackIndex;
    return result;
}

// C steal.c:steal().  Inventory stacks are candidates as objects rather than
// by quantity.  Worn armor and accessories receive five tickets; weapons
// (including the primary and alternate weapon) still receive one.  Keep
// selection in the synchronous hitmu() slice so its rn2() stays before any
// removal prose can suspend on tty --More--.
function selectHeroItemForTheft(state, random, calls) {
    const inventory = state?.inventory || [];
    const wornObjects = new Set([
        state?.uarm, state?.uarmc, state?.uarmh, state?.uarms,
        state?.uarmg, state?.uarmf, state?.uarmu,
        state?.uleft, state?.uright, state?.uamul, state?.ublindf,
        state?.u?.uleft, state?.u?.uright,
    ].filter(Boolean));
    const candidates = [];
    let total = 0;
    for (const object of inventory) {
        if (object === state?.uskin
            || (object?.oclass ?? object?.class) === COIN_CLASS) continue;
        // When body armor is present, steal() omits the cloak from this
        // weighted pass; its later equipment-dependency rewrites remain
        // separate from candidate weighting.
        if (state?.uarm && object === state?.uarmc) continue;
        const wornMask = object?.owornmask ?? 0;
        const weighted = wornObjects.has(object)
            || !!(wornMask & (W_ARMOR | W_ACCESSORY));
        const weight = weighted ? 5 : 1;
        candidates.push({ object, weight });
        total += weight;
    }
    if (!total) return { object: null, total: 0, ticket: null };
    let ticket = recordRandom(random, calls, total);
    const initialTicket = ticket;
    for (const candidate of candidates) {
        ticket -= candidate.weight;
        if (ticket < 0) {
            return {
                object: candidate.object, total, ticket: initialTicket,
            };
        }
    }
    return { object: null, total, ticket: initialTicket };
}

// C do_wear.c:some_armor().  Torso priority is deterministic; each later
// occupied slot gets an independent one-in-four replacement opportunity.
function selectHeroDisenchantmentTarget(state, random, calls) {
    let object = state?.uarmc || state?.uarm || state?.uarmu || null;
    for (const candidate of [
        state?.uarmh, state?.uarmg, state?.uarmf, state?.uarms,
    ]) {
        if (candidate
            && (!object || recordRandom(random, calls, 4) === 0)) {
            object = candidate;
        }
    }
    if (object) return object;
    const fallback = recordRandom(random, calls, 5);
    return [
        null,
        state?.uright || state?.u?.uright,
        state?.uleft || state?.u?.uleft,
        state?.uamul || state?.u?.uamul,
        state?.ublindf || state?.u?.ublindf,
    ][fallback] || null;
}

function drainHeroItemByDisenchanter(object, random, calls) {
    if (!object) return false;
    const enchantment = Number.isInteger(object.spe)
        ? object.spe : Number.isInteger(object.enchantment)
            ? object.enchantment : 0;
    const objectClass = object.oclass ?? object.class;
    const chargeable = !!OBJECT_CHARGED[object.otyp]
        || objectClass === WEAPON_CLASS || objectClass === ARMOR_CLASS
        || object.class === 'Weapons' || object.class === 'Armor';
    if (!chargeable || enchantment <= 0) return false;
    if ([AMULET_OF_YENDOR, SPE_BOOK_OF_THE_DEAD,
        CANDELABRUM_OF_INVOCATION, BELL_OF_OPENING].includes(object.otyp)) {
        return false;
    }
    const artifact = !!(object.oartifact || object.artifact);
    if (recordRandom(random, calls, 100) < (artifact ? 90 : 10))
        return false;
    object.spe = enchantment - 1;
    object.enchantment = object.spe;
    return true;
}

// C mon.c:mnexto()->teleport.c:enexto().  All three rings are collected and
// shuffled before goodpos() selects a destination; the relocating monster's
// old square remains occupied during that selection and is rejected.
function relocateMonsterNextToHero(
    monster, state, calls, random = rn2,
) {
    if (!monster) return null;
    const oldx = monster.mx, oldy = monster.my;
    const candidates = collectNearbyCoords(
        state.u?.ux ?? oldx, state.u?.uy ?? oldy, 3, random, calls,
    );
    const destination = candidates.find(({ x, y }) =>
        (x !== oldx || y !== oldy)
        && expulsionDestinationOk(monster, state, x, y));
    if (!destination) return null;
    monster.mx = destination.x;
    monster.my = destination.y;
    monster.mtrack = [];
    return {
        oldx, oldy,
        x: monster.mx, y: monster.my,
        moved: oldx !== monster.mx || oldy !== monster.my,
    };
}

// Successful non-animal AD_SITM theft relocates the aggressor before
// hitmu() reaches its shared knockback tail.
export function relocateMonsterAfterTheft(
    action, state, random = rn2, rollOne = rnd,
) {
    return randomMonsterRelocation(
        action?.monster, state, action?.calls || [], random, rollOne,
    );
}

function basicMonsterAttack(
    monster, state, random, rollOne, rollDice, calls, attackIndex = 0,
    retainedThreshold = null, retainedAttackRoll = null,
    deferVisibleContact = !!state?._deferVisibleMonsterContact,
    weaponSwingComplete = false,
    offensiveProbeComplete = false,
) {
    // C evaluates AC_VALUE once at mattacku() entry, before selecting the
    // first attack slot.  Negative AC therefore owns rnd(-uac), and every
    // resumed natural slot reuses the same derived threshold.
    let threshold = retainedThreshold;
    if (!Number.isFinite(threshold))
        threshold = monsterAttackThreshold(monster, state, rollOne, calls);
    const [
        sourceAttackType = 0, sourceDamageType = AD_PHYS,
        sourceDice = 0, sourceSides = 0,
    ] = MONSTER_ATTACKS[monster.mnum]?.[attackIndex] ?? [];
    let damageType = sourceDamageType;
    let dice = sourceDice;
    let sides = sourceSides;
    const oldFormMnum = Upolyd(state?.u) ? state.u.umonnum : null;
    // mhitu.c:getmattk() keeps a recently released elemental engulfer from
    // immediately swallowing again.  It preserves the elemental damage but
    // substitutes a touch method until mcalcdistress() ages mspec_used out.
    const attackType = monster.mspec_used && sourceAttackType === AT_ENGL
        && [AD_FIRE, AD_COLD, AD_ELEC, AD_ACID].includes(damageType)
        ? AT_TUCH : sourceAttackType;
    const alreadyEngulfing = attackType === AT_ENGL
        && state?.u?.uswallow && state.u.ustuck === monster;
    if (attackType === AT_MAGC
        && (damageType === AD_SPEL || damageType === AD_CLRC)) {
        // mhitu.c:mattacku() enters castmu() without a to-hit die.  Spell
        // choice and fumble precede the casting line.  Base spell damage is
        // rolled only after that line returns from tty; a long actor name can
        // therefore move d() to the acknowledgement input.
        let spell = chooseMonsterSpell(
            monster, damageType, state, random, calls,
        );
        if (!spell) return retainHeroAttackContinuation({
            kind: 'hero-spell', threshold, attackType, damageType,
            attackIndex, cast: false,
        }, monster, attackIndex);
        // C castmu() starts cnt at 40.  choose_monster_spell() already tests
        // usefulness while walking the spell table; the do/while condition
        // tests the returned spell once more, but there is no third probe
        // after the loop.  Stateful usefulness checks such as geyser's
        // rn2(5) make that exact call count observable.
        let attempts = 39;
        while (attempts-- > 0
            && monsterSpellUseless(monster, spell, state, random, calls)) {
            spell = chooseMonsterSpell(
                monster, damageType, state, random, calls,
            );
        }
        if (attempts < 0) {
            return retainHeroAttackContinuation({
                kind: 'hero-spell', threshold, attackType, damageType,
                attackIndex, spell: spell.key, cast: false,
            }, monster, attackIndex);
        }
        if (monster.mcan || monster.mspec_used
            || !(monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0)) {
            const blind = !!state?.blind
                || (state?.u?.blindTurns ?? 0) > 0;
            const canSeeCaster = !blind
                && couldsee(monster.mx, monster.my)
                && (!monster.minvis || heroCanSeeInvisible(state));
            let curseKind = null;
            if (canSeeCaster) {
                curseKind = spell.flags & MCF_INDIRECT
                    ? 'visible-undirected' : 'visible-directed';
            } else if (!((state?.moves ?? 0) % 4)
                || recordRandom(random, calls, 4) === 0) {
                if (!state?.deaf) curseKind = 'audible';
            }
            return retainHeroAttackContinuation({
                kind: 'hero-spell', threshold, attackType, damageType,
                attackIndex, spell: spell.key, cast: false,
                blocked: true, curseKind,
            }, monster, attackIndex);
        }
        const monsterLevel = monster.m_lev
            ?? MONSTER_LEVEL[monster.mnum] ?? 0;
        monster.mspec_used = monsterLevel < 8 ? 10 - monsterLevel : 2;
        const fumble = recordRandom(
            random, calls, Math.max(1, monsterLevel * 10),
        ) < (monster.mconf ? 100 : 20);
        if (fumble) {
            return retainHeroAttackContinuation({
                kind: 'hero-spell', threshold, attackType, damageType,
                attackIndex, spell: spell.key, cast: false, fumbled: true,
            }, monster, attackIndex);
        }
        const spellDice = sides
            ? Math.trunc(monsterLevel / 2) + dice
            : Math.trunc(monsterLevel / 2) + 1;
        const spellSides = sides || 6;
        return retainHeroAttackContinuation({
            kind: 'hero-spell', threshold, attackType, damageType,
            attackIndex, spell: spell.key, cast: true,
            spellDice, spellSides, deferredSpellDamage: true,
            directed: !(spell.flags & MCF_INDIRECT),
            deferredSpellEffect: true,
        }, monster, attackIndex);
    }
    // mhitu.c:mattacku() probes find_offensive() once before the attack
    // table.  Its initial lined_up() call is RNG-visible for a concealed
    // polymorphed hero even when no carried item is ultimately usable.
    if (attackIndex === 0 && !retainedAttackRoll && !weaponSwingComplete
        && !offensiveProbeComplete
        && !monster.mpeaceful && !state?.u?.uswallow
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0)
            & (M1_ANIMAL | M1_MINDLESS | M1_NOHANDS))) {
        hostileLinedUp(monster, state, random, calls);
    }
    // mhitu.c:mattacku() computes AC_VALUE before walking the attack table.
    // A natural-contact actor which is adjacent to its displaced image but
    // has not found the real hero therefore owns the AC draw, then wildmiss()
    // skips its remaining non-spell slots without a to-hit roll.
    const apparentX = Number.isFinite(monster?.mux)
        ? monster.mux : state?.u?.ux;
    const apparentY = Number.isFinite(monster?.muy)
        ? monster.muy : state?.u?.uy;
    const foundHero = apparentX === state?.u?.ux
        && apparentY === state?.u?.uy;
    const apparentDx = (monster?.mx ?? apparentX) - apparentX;
    const apparentDy = (monster?.my ?? apparentY) - apparentY;
    const apparentNearby = Math.abs(apparentDx) <= 1
        && Math.abs(apparentDy) <= 1
        && !(monster?.mnum === 116
            && apparentDx !== 0 && apparentDy !== 0);
    if (attackType >= 1 && attackType <= 7
        && apparentNearby && !foundHero && heroIsDisplaced(state)
        && monster?.mcansee !== false
        && !(state?.u?.invisible || state?.u?.invis)) {
        return {
            kind: 'hero-attack', threshold, hit: false, roll: null,
            attackType, damageType, attackIndex,
            effect: 'displaced-wild-miss',
        };
    }
    // monattk.h defines AT_BOOM as an explosion when the monster is killed.
    // mhitu.c:mattacku() has no AT_BOOM case, so a living gas spore's slot
    // reaches the switch default and performs no adjacent attack.  Keep the
    // death-time explosion owner separate from this live attack dispatcher.
    if (attackType === AT_BOOM) {
        const nextAttackIndex = nextHeroAttackIndex(monster, attackIndex);
        if (nextAttackIndex === null) return null;
        return basicMonsterAttack(
            monster, state, random, rollOne, rollDice, calls,
            nextAttackIndex, threshold, null, deferVisibleContact,
        );
    }
    // mhitu.c:mattacku() keeps ranged-only methods in the same six-slot
    // attack table, but AT_BREA and AT_SPIT have no adjacent action.  They
    // consume neither a to-hit die nor damage RNG; the loop advances with
    // the original slot index intact, so a following bite in slot 1 rolls
    // rnd(21), not rnd(20).  Resolve that zero-RNG control edge internally
    // rather than exposing a synthetic miss to the tty continuation driver.
    if (attackType === AT_BREA || attackType === AT_SPIT) {
        const nextAttackIndex = nextHeroAttackIndex(monster, attackIndex);
        if (nextAttackIndex === null) return null;
        return basicMonsterAttack(
            monster, state, random, rollOne, rollDice, calls,
            nextAttackIndex, threshold, null, deferVisibleContact,
        );
    }
    if (attackType === AT_ENGL && damageType === AD_DREN
        && monster?.mnum === PM_ENERGY_VORTEX
        && monster.mspec_used && !alreadyEngulfing) {
        return retainHeroAttackContinuation({
            kind: 'hero-attack', threshold, hit: false, roll: null,
            attackType, damageType, attackIndex,
            effect: 'engulf-cooldown-miss',
        }, monster, attackIndex);
    }
    // An AT_WEAP slot gets a last close-range wield attempt even when the
    // actor reached mattacku() with weapon_check=NO_WEAPON_WANTED.  A legal
    // replacement consumes the action; failure is zero-RNG and leaves the
    // slot active as a bare-handed attack using its declared damage dice.
    if (attackType === AT_WEAP) {
        const currentWeapon = monsterWieldedWeapon(monster);
        if (monster.weaponCheck === NEED_WEAPON || !currentWeapon) {
            monster.weaponCheck = NEED_HTH_WEAPON;
            const selectedWeapon = selectHandToHandWeapon(monster);
            if (selectedWeapon
                && selectedWeapon.otyp !== currentWeapon?.otyp) {
                if (currentWeapon) currentWeapon.wielded = false;
                monster.mw = selectedWeapon;
                selectedWeapon.wielded = true;
                monster.weaponCheck = NEED_WEAPON;
                return {
                    kind: 'monster-wield',
                    weapon: selectedWeapon,
                    threshold,
                    attackIndex,
                };
            }
            monster.weaponCheck = NEED_WEAPON;
        }
        const wieldedWeapon = monsterWieldedWeapon(monster);
        if (wieldedWeapon && deferVisibleContact && !weaponSwingComplete) {
            return {
                kind: 'hero-attack', threshold,
                attackType, damageType, attackIndex,
                deferredWeaponSwing: true,
                weapon: wieldedWeapon,
            };
        }
    }
    // getmattk() converts a lich's first cold touch to weaker physical
    // damage when the defender resists cold.  The attack method and message
    // remain a touch, but master-lich 3d6 becomes 2d6 and bypasses the cold
    // cancellation/item-destruction path.
    const heroColdResistant = !!(state?.u?.coldResistance
        || state?.u?.cold_resistance
        || (Number.isInteger(oldFormMnum)
            && ((MONSTER_RESISTS[oldFormMnum] ?? 0) & 0x02)));
    if (attackIndex === 0 && attackType === AT_TUCH
        && damageType === AD_COLD && heroColdResistant) {
        damageType = AD_PHYS;
        dice = Math.trunc((dice + 1) / 2);
        if (sides === 10) sides = 6;
    }
    const toHitSides = 20 + attackIndex;
    let roll = null;
    let hit = true;
    if (retainedAttackRoll) {
        roll = retainedAttackRoll.roll;
        hit = retainedAttackRoll.hit;
    } else if (!alreadyEngulfing) {
        roll = rollOne(toHitSides);
        calls.push(`rnd(${toHitSides})`);
        hit = threshold > roll;
    }
    // C hitmu() reveals a concealed attacker before rolling base damage.
    // That pline can suspend behind an older tty topline, so preserve the
    // already-consumed attack die and resume this same slot afterward.
    const hiddenUnder = hit && !retainedAttackRoll && monster.mundetected
        && (((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL)
            || MONSTER_SYMBOL[monster.mnum] === S_EEL);
    if (hiddenUnder) {
        const object = state?.level?.objects?.[monster.mx]?.[monster.my]?.[0];
        const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
        const what = blind && object && !object.dknown
            ? 'something'
            : IS_POOL(state?.level?.at?.(monster.mx, monster.my)?.typ)
                    && !state?.u?.underwater
                ? 'the water'
                : object?.name || object?.description || 'something';
        if (blind) map_invisible(monster.mx, monster.my);
        monster.mundetected = 0;
        return {
            kind: 'hero-attack', roll, threshold, hit,
            attackType, damageType, attackIndex,
            deferredRevealUnder: true,
            revealUnderMessage: `${
                blind ? 'Something' : `The ${MONSTER_NAME[monster.mnum]}`
            } was hidden under ${what}!`,
        };
    }
    let damage = 0;
    // mhitu.c:hitmu() rolls the AT_WEAP slot's declared base damage, then
    // weapon.c:dmgval() rolls the wielded weapon's small-target die.  The
    // visible hit line precedes knockback and HP subtraction.
    const contactWeapon = attackType === AT_WEAP
        ? monsterWieldedWeapon(monster) : null;
    if (hit && contactWeapon && damageType === AD_PHYS) {
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const weaponDamage = rollPhysicalWeaponDamageAgainstHero(
            contactWeapon, state, {
                rollOne: range => {
                    calls.push(`rnd(${range})`);
                    return rollOne(range);
                },
                rollDice: (count, sides) => {
                    calls.push(`d(${count},${sides})`);
                    return rollDice(count, sides);
                },
            },
        );
        damage += weaponDamage;
        if (deferVisibleContact) {
            return retainHeroAttackContinuation({
                kind: 'hero-attack', roll, threshold, hit, damage,
                attackType, damageType, effect: 'physical-weapon',
                oldFormMnum, deferredPostHit: true,
            }, monster, attackIndex);
        }
        recordRandom(random, calls, 3);
        recordRandom(random, calls, 6);
        damage = reduceHeroContactDamage(damage, state, rollOne, calls);
        applyHeroContactDamage(state, damage);
        const passive = damage > 0 ? applyHeroPassiveAfterContact(
            monster, state, random, rollDice, calls, oldFormMnum,
        ) : null;
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'physical-weapon', passive,
        }, monster, attackIndex);
    } else if (hit && monster.mnum === 116 && !deferVisibleContact) {
        // PM_GRID_BUG: AT_BITE AD_ELEC 1d1.  The electric special checks
        // magic cancellation, optionally checks inventory destruction, then
        // the shared post-hit knockback path consumes its distance/chance
        // draws even though an electric bite cannot knock the hero back.
        damage = rollDice(1, 1);
        calls.push('d(1,1)');
        const armorProtection = state?.u?._magicNegation ?? 0;
        const negated = recordRandom(random, calls, 10)
            < 3 * armorProtection;
        if (!negated) {
            recordRandom(random, calls, 20);
        } else {
            damage = 0;
        }
        recordRandom(random, calls, 3);
        recordRandom(random, calls, 6);
        damage = reduceHeroContactDamage(damage, state, rollOne, calls);
        applyHeroContactDamage(state, damage);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType,
            effect: negated ? 'electric-avoided' : 'electric-zap',
        }, monster, attackIndex);
    } else if (hit && [7, 8, 9].includes(damageType)
        && dice > 0 && sides > 0) {
        // uhitm.c:mhitm_ad_drst() family.  Poisonous natural attacks roll
        // their physical damage first, then magic cancellation; only a
        // non-negated attack reaches the one-in-eight attribute-poison gate.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const armorProtection = state?.u?._magicNegation ?? 0;
        const negated = !!monster.mcan
            || recordRandom(random, calls, 10) < 3 * armorProtection;
        if (deferVisibleContact) {
            return retainHeroAttackContinuation({
                kind: 'hero-attack', roll, threshold, hit, damage,
                attackType, effect: 'poisonous-natural',
                poisonAttribute: damageType - 7,
                negated, deferredPoisonCheck: !negated,
                deferredPostHit: true,
            }, monster, attackIndex);
        }
        let poisoned = false;
        if (!negated) poisoned = recordRandom(random, calls, 8) === 0;
        recordRandom(random, calls, 3);
        recordRandom(random, calls, 6);
        damage = reduceHeroContactDamage(damage, state, rollOne, calls);
        applyHeroContactDamage(state, damage);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, effect: 'poisonous-natural',
            poisonAttribute: damageType - 7, poisoned,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_SAMU
        && dice > 0 && sides > 0) {
        // uhitm.c:mhitm_ad_samu() retains ordinary claw damage.  After
        // hitmsg(), it always spends the one-in-twenty theft gate; a hero
        // without quest/invocation objects simply has nothing to steal.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'amulet-theft-natural',
            deferredAmuletTheftGate: true,
            deferredPostHit: true, oldFormMnum,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_STCK) {
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const armorProtection = state?.u?._magicNegation ?? 0;
        const negated = !!monster.mcan
            || recordRandom(random, calls, 10) < 3 * armorProtection;
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'sticking-natural', negated,
            deferredStickingAfterHit: true, oldFormMnum,
        }, monster, attackIndex);
    } else if (hit && !alreadyEngulfing && attackType !== AT_ENGL
        && damageType === AD_FIRE
        && dice > 0 && sides > 0) {
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'fire-natural',
            deferredFireNegation: true,
        }, monster, attackIndex);
    } else if (hit && attackType === AT_TUCH && damageType === AD_COLD
        && dice > 0 && sides > 0) {
        // hmon() rolls base damage before mhitm_ad_cold(), but the latter
        // projects hitmsg() before checking magic cancellation.  Leave that
        // check deferred so an already-full tty topline can suspend between
        // d() and rn2(10).
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'cold-natural',
            deferredColdNegation: true,
        }, monster, attackIndex);
    } else if (hit && !alreadyEngulfing && attackType !== AT_ENGL
        && damageType === AD_ELEC
        && dice > 0 && sides > 0) {
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'electric-natural',
            deferredElectricNegation: true,
        }, monster, attackIndex);
    } else if (alreadyEngulfing && dice > 0 && sides > 0) {
        // A monster already holding the hero re-enters mattacku() (and thus
        // AC_VALUE) but gulpmu() bypasses the attack die.  Each engulf tick
        // rolls fresh damage, ages the swallow timer, and applies its effect.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        if ((state.u.uswldtim ?? 0) > 0) state.u.uswldtim--;
        let effectMessage = null;
        if (damageType === 3 && !monster?.mcan
            && recordRandom(random, calls, 2) !== 0) {
            if (state.u.coldResistance || state.u.cold_resistance) {
                damage = 0;
                effectMessage = 'You feel mildly chilly.';
            } else {
                effectMessage = 'You are freezing to death!';
                applyHeroContactDamage(state, damage);
            }
        } else if (damageType === AD_ELEC && !monster?.mcan
            && recordRandom(random, calls, 2) !== 0) {
            if (state.u.shockResistance || state.u.shock_resistance) {
                damage = 0;
                effectMessage = 'You seem unhurt.';
            } else {
                effectMessage = 'The air around you crackles with electricity.';
                applyHeroContactDamage(state, damage);
            }
        } else {
            damage = 0;
        }
        let deferredExpulsion = (state.u.uswldtim ?? 0) === 0;
        let completedEnergyDrainSlot = false;
        if (monster?.mnum === PM_ENERGY_VORTEX && attackIndex === 0
            && !deferredExpulsion) {
            const drain = resolveEnergyVortexDrainSlot(
                monster, state, calls, random, rollOne, rollDice,
            );
            if (drain.message) {
                effectMessage = [effectMessage, drain.message]
                    .filter(Boolean).join('  ');
            }
            deferredExpulsion = drain.deferredExpulsion;
            completedEnergyDrainSlot = true;
        }
        const engulfTick = retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit: true, damage,
            attackType, damageType, effect: 'engulf-tick', effectMessage,
            deferredExpulsion,
        }, monster, attackIndex);
        if (completedEnergyDrainSlot)
            delete engulfTick.nextAttackIndex;
        return engulfTick;
    } else if (hit && attackType === AT_ENGL && dice > 0 && sides > 0) {
        // mhitu.c:gulpmu() rolls base engulf damage, moves the attacker onto
        // the hero, and prints its urgent engulf line before setting
        // uswallow or rolling the swallow timer/effect.  The tty pager can
        // therefore split this transaction immediately after d().
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const engulfOldX = monster.mx;
        const engulfOldY = monster.my;
        monster.mx = state.u.ux;
        monster.my = state.u.uy;
        state.u.ustuck = monster;
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, attackIndex, effect: 'engulf',
            deferredEngulf: true, engulfOldX, engulfOldY,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_SITM) {
        // hitmu() records the attack's declared zero dice before dispatching
        // AD_SITM through mhitm_ad_sedu().  A successful nymph theft ends the
        // aggressor's attack sequence, so do not retain its second claw slot.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const theft = selectHeroItemForTheft(state, random, calls);
        return {
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'item-theft',
            deferredItemTheft: true, stolenObject: theft.object,
            theftWeight: theft.total, theftTicket: theft.ticket,
        };
    } else if (hit && damageType === AD_LEGS) {
        // uhitm.c:mhitm_ad_legs().  The declared sting damage and chosen
        // side precede the special contact line.  Wound duration, attribute
        // exercise, knockback, and HP damage all remain after that pline, so
        // a tty pager can suspend one xan slot at the same source boundary.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const legSide = recordRandom(random, calls, 2)
            ? 'right' : 'left';
        const boots = state?.uarmf || state?.u?.uarmf;
        const airborneHero = !!(state?.u?.usteed
            || state?.u?.levitating || state?.u?.levitation
            || state?.u?.flying || state?.u?.flight);
        const attackerFlies = !!((MONSTER_FLAGS1[monster.mnum] ?? 0)
            & M1_FLY);
        let legContact = 'prick';
        let deferredLegEffect = true;
        if (airborneHero && !attackerFlies) {
            legContact = 'reach';
            damage = 0;
            deferredLegEffect = false;
        } else if (monster.mcan) {
            legContact = 'nuzzle';
            damage = 0;
            deferredLegEffect = false;
        } else if (boots) {
            const exposed = recordRandom(random, calls, 2) !== 0
                && [LOW_BOOTS, IRON_SHOES].includes(boots.otyp);
            if (exposed) {
                legContact = 'exposed-prick';
            } else if (recordRandom(random, calls, 5) === 0) {
                legContact = 'boot-prick';
            } else {
                legContact = 'boot-scratch';
                damage = 0;
                deferredLegEffect = false;
            }
        }
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'leg-natural',
            legSide, legContact, deferredLegEffect,
            deferredPostHit: !deferredLegEffect, oldFormMnum,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_BLND
        && dice > 0 && sides > 0) {
        // hitmu() rolls the declared damage before mhitm_ad_blnd().  A raven
        // claw converts that amount into blindness duration, prints its
        // special line before toggling sight, then still enters the shared
        // knockback tail with zero HP damage.
        const blindIncrement = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const blindfolded = !!(state?.ublindf || state?.u?.ublindf);
        const noEyes = !!(state?.u?.noEyes || state?.u?.eyeless);
        const helmet = state?.uarmh || state?.u?.uarmh;
        const visored = /visored helmet/i.test(
            helmet?.description || helmet?.appearance || helmet?.name || '',
        );
        const blindApplicable = !blindfolded && !noEyes && !visored;
        const heroWasBlind = !!state?.blind
            || (state?.u?.blindTurns ?? 0) > 0;
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage: 0,
            attackType, damageType, effect: 'blind-natural',
            blindIncrement, blindApplicable,
            blindMessage: blindApplicable && !heroWasBlind,
            deferredBlindEffect: true,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_STUN) {
        // uhitm.c:mhitm_ad_stun().  The kick's declared damage and hitmsg
        // precede cancellation and the one-in-four stun gate.  A selected
        // effect adds the full damage to HStun, then halves only the HP
        // damage before entering the common knockback/contact tail.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'stun-natural',
            deferredStunGate: true, oldFormMnum,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_SLIM) {
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const armorProtection = state?.u?._magicNegation ?? 0;
        const cancelled = !!monster.mcan;
        const negated = cancelled
            || recordRandom(random, calls, 10) < 3 * armorProtection;
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'slime-natural',
            slimeNegated: negated,
            slimeCancelled: cancelled,
            deferredSlimeEffect: true,
            oldFormMnum,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_STON) {
        // mhitm_ad_ston() rolls the declared 0d0 before hitmsg().  Its hiss
        // gate belongs after that visible contact line, so keep the remaining
        // effect explicitly deferred at the tty boundary.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'stoning-natural',
            deferredStoningEffect: true,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_RUST) {
        // uhitm.c:mhitm_ad_rust() still receives hitmu()'s declared 0d0
        // damage and publishes hitmsg() before cancellation or erode_armor().
        // Armor erosion is a separately resumable message owner; shared
        // knockback gates follow it before mattacku() advances attack slots.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const completelyRustableForm = Upolyd(state?.u)
            && state.u.umonnum === 259;
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType,
            effect: monster.mcan
                ? 'cancelled-rust-natural' : 'rust-natural',
            oldFormMnum,
            deferredRustRehumanize: !monster.mcan
                && completelyRustableForm,
            deferredRustArmor: !monster.mcan
                && !completelyRustableForm,
            deferredPostHit: !!monster.mcan,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_CORR) {
        // uhitm.c:mhitm_ad_corr() keeps the bite's declared 3d8 damage, but
        // hitmsg() and erode_armor(ERODE_CORRODE) both precede the common
        // knockback and HP-damage tail.  Keep armor erosion resumable across
        // tty exactly as for rust without conflating primary/secondary state.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType,
            effect: monster.mcan
                ? 'cancelled-corrosion-natural' : 'corrosion-natural',
            oldFormMnum,
            deferredCorrosionArmor: !monster.mcan,
            deferredPostHit: !!monster.mcan,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_DCAY) {
        // uhitm.c:mhitm_ad_dcay() follows the same hitmsg/cancellation/armor
        // continuation shape as rust, but erodes secondary rot state and
        // deliberately disables grease protection.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const completelyRottableForm = Upolyd(state?.u)
            && [PM_LEATHER_GOLEM, 254].includes(state.u.umonnum);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType,
            effect: monster.mcan
                ? 'cancelled-decay-natural' : 'decay-natural',
            oldFormMnum,
            deferredDecayRehumanize: !monster.mcan
                && completelyRottableForm,
            deferredDecayArmor: !monster.mcan
                && !completelyRottableForm,
            deferredPostHit: !!monster.mcan,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_ENCH) {
        // uhitm.c:mhitm_ad_ench().  Base damage and magic negation precede
        // hitmsg(); some_armor(), drain resistance, and the state mutation
        // precede the optional "less effective" pline which can force the
        // earlier hit line through tty.
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const armorProtection = state?.u?._magicNegation ?? 0;
        const negated = !!monster.mcan
            || recordRandom(random, calls, 10) < 3 * armorProtection;
        let drainedObject = null;
        if (!negated) {
            const target = selectHeroDisenchantmentTarget(
                state, random, calls,
            );
            if (drainHeroItemByDisenchanter(target, random, calls))
                drainedObject = target;
        }
        const quantity = drainedObject?.quantity
            ?? drainedObject?.quan ?? 1;
        const drainTypeKnown = drainedObject
            && (drainedObject.typeKnown
                || state?._knownObjectTypes?.has(drainedObject.otyp));
        const drainObjectClass = drainedObject?.oclass
            ?? drainedObject?.class;
        const drainObjectName = drainTypeKnown && drainObjectClass === RING_CLASS
            ? `ring of ${OBJECT_NAMES[drainedObject.otyp]}`
            : drainedObject?.name || OBJECT_NAMES[drainedObject?.otyp]
                || 'item';
        const drainMessage = drainedObject
            ? `Your ${drainObjectName} ${
                quantity === 1 ? 'seems' : 'seem'
            } less effective.`
            : null;
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType,
            effect: negated
                ? 'cancelled-enchantment-natural' : 'enchantment-natural',
            drainedObject, drainMessage,
            deferredPostHit: true, oldFormMnum,
        }, monster, attackIndex);
    } else if (hit && damageType === AD_DRLI) {
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: 'life-drain-natural',
            deferredLifeDrainGate: true, oldFormMnum,
        }, monster, attackIndex);
    } else if (hit
        && (attackType !== AT_WEAP || !monsterWieldedWeapon(monster))
        && damageType === AD_PHYS
        && dice > 0 && sides > 0) {
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        const physicalEffect = attackType === AT_WEAP
            ? 'physical-unarmed-weapon' : 'physical-natural';
        // hitmu() rolls ordinary physical damage before pline() announces the
        // hit, but knockback and HP subtraction happen after that message.
        // The tty can suspend inside pline() for --More--, so the live actor
        // driver must be able to resume this same contact after input.
        if (deferVisibleContact) {
            return retainHeroAttackContinuation({
                kind: 'hero-attack', roll, threshold, hit, damage,
                attackType, damageType,
                effect: physicalEffect, oldFormMnum,
                deferredPostHit: true,
            }, monster, attackIndex);
        }
        // hitmu() enters mhitm_knockback() after ordinary physical damage.
        // Attack eligibility is tested only after both chance gates.
        recordRandom(random, calls, 3);
        recordRandom(random, calls, 6);
        damage = reduceHeroContactDamage(damage, state, rollOne, calls);
        applyHeroContactDamage(state, damage);
        const passive = damage > 0 ? applyHeroPassiveAfterContact(
            monster, state, random, rollDice, calls, oldFormMnum,
        ) : null;
        return retainHeroAttackContinuation({
            kind: 'hero-attack', roll, threshold, hit, damage,
            attackType, damageType, effect: physicalEffect, passive,
        }, monster, attackIndex);
    }
    return retainHeroAttackContinuation({
        kind: 'hero-attack', roll, threshold, hit, damage, attackType,
    }, monster, attackIndex);
}

// Resume mattacku() after mswings() has crossed any older tty topline.
// Weapon selection, AC_VALUE(), and the offensive probe are already owned by
// the pre-swing half; the attack die and damage begin only here.
export function resumeDeferredHeroWeaponSwing(
    action, state, random = rn2, rollOne = rnd, rollDice = d,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredWeaponSwing) return attack;
    attack.deferredWeaponSwing = false;
    const resumed = basicMonsterAttack(
        action.monster, state, random, rollOne, rollDice, action.calls,
        attack.attackIndex, attack.threshold, null, true, true,
    );
    action.movement.attack = resumed;
    return resumed;
}

function energyDrainDice(state, dice = 2, sides = 6) {
    const level = Math.max(state.u?.ulevel ?? 1, 6);
    if ((state.u?.uen ?? 0) <= 5 * level && dice > 1) {
        dice--;
        if ((state.u?.uenmax ?? 0) <= 2 * level && sides > 3)
            sides -= 3;
    } else if ((state.u?.uen ?? 0) > 12 * level) {
        dice++;
        if ((state.u?.uenmax ?? 0) > 20 * level) sides += 3;
    }
    return { dice, sides };
}

function resolveEnergyVortexDrainSlot(
    monster, state, calls, random = rn2, rollOne = rnd, rollDice = d,
) {
    if ((state.u?.uswldtim ?? 0) > 0) state.u.uswldtim--;
    const adjusted = energyDrainDice(state);
    const amount = rollDice(adjusted.dice, adjusted.sides);
    calls.push(`d(${adjusted.dice},${adjusted.sides})`);
    let message = null;
    if (!monster?.mcan && recordRandom(random, calls, 4) !== 0) {
        message = drainHeroEnergy(state, amount, {
            rollOne: sides => {
                const result = rollOne(sides);
                calls.push(`rnd(${sides})`);
                return result;
            },
        });
    }
    return {
        message,
        deferredExpulsion: (state.u?.uswldtim ?? 0) === 0,
    };
}

// Resume gulpmu() after the player dismisses the initial engulf message.
export function resumeDeferredHeroEngulf(
    action, state, random = rn2, rollOne = rnd, rollDice = d,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredEngulf) return null;
    const monster = action.monster;
    const calls = action.calls;
    state.u.ustuck = monster;
    // C gulpmu() flushes the urgent engulf line, then shuts down the entire
    // old sight field before uswallow is set.  Live gameplay owns the global
    // vision buffers; focused pure-state tests intentionally omit this tty
    // transaction.
    if (state === game) vision_recalc(2);
    state.u.uswallow = 1;
    state.vision_full_recalc = 1;
    swallowed(true);
    const durationSides = (monster?.m_lev
        ?? MONSTER_LEVEL[monster?.mnum] ?? 0) + 5;
    let duration = rollOne(durationSides);
    calls.push(`rnd(${durationSides})`);
    if (duration < 2) duration = 2;
    state.u.uswldtim = duration - 1;

    let message = null;
    // AD_COLD.  A cancelled vortex skips the effect gate entirely.
    if (attack.damageType === 3 && !monster?.mcan
        && recordRandom(random, calls, 2) !== 0) {
        if (state.u.coldResistance || state.u.cold_resistance) {
            attack.appliedDamage = 0;
            message = 'You feel mildly chilly.';
        } else {
            attack.appliedDamage = attack.damage;
            state.u.uhp = Math.max(
                0, (state.u.uhp ?? 1) - attack.appliedDamage,
            );
            message = 'You are freezing to death!';
        }
    } else if (attack.damageType === AD_ELEC && !monster?.mcan
        && recordRandom(random, calls, 2) !== 0) {
        if (state.u.shockResistance || state.u.shock_resistance) {
            attack.appliedDamage = 0;
            message = 'You seem unhurt.';
        } else {
            attack.appliedDamage = attack.damage;
            applyHeroContactDamage(state, attack.appliedDamage);
            message = 'The air around you crackles with electricity.';
        }
    } else {
        attack.appliedDamage = 0;
    }
    if (monster?.mnum === PM_ENERGY_VORTEX && attack.attackIndex === 0) {
        const drain = resolveEnergyVortexDrainSlot(
            monster, state, calls, random, rollOne, rollDice,
        );
        if (drain.message)
            message = [message, drain.message].filter(Boolean).join('  ');
        attack.deferredExpulsion = drain.deferredExpulsion;
        // Slot 1 was completed inside the swallowed transaction above; do
        // not expose it again through the ordinary continuation walker.
        delete attack.nextAttackIndex;
    }
    attack.deferredEngulf = false;
    attack.engulfResolved = true;
    return { message, duration: state.u.uswldtim };
}

// Continue mhitm_ad_cold() after its hit message.
export function resumeDeferredHeroColdSpecial(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredColdNegation) return action;
    const armorProtection = state?.u?._magicNegation ?? 0;
    const cancelled = !!action.monster?.mcan;
    attack.coldOriginalDamage = attack.damage ?? 0;
    attack.negated = cancelled
        || recordRandom(random, action.calls, 10) < 3 * armorProtection;
    if (cancelled) {
        attack.damage = 0;
        attack.coldEffectMessage = null;
    } else if (attack.negated) {
        attack.damage = 0;
        attack.coldEffectMessage = 'You avoid harm.';
    } else {
        attack.coldEffectMessage = "You're covered in frost!";
        if (state.u.coldResistance || state.u.cold_resistance) {
            attack.damage = 0;
            attack.coldResistanceMessage
                = "The frost doesn't seem cold!";
        }
    }
    attack.deferredColdInventory = !attack.negated;
    if (attack.negated) delete attack.coldOriginalDamage;
    attack.deferredPostHit = true;
    attack.deferredColdNegation = false;
    return action;
}

// Continue mhitm_ad_fire() after its hit message. Fire can burn slime and
// carried objects before the ordinary contact damage is applied.
export function resumeDeferredHeroFireSpecial(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredFireNegation) return action;
    const armorProtection = state?.u?._magicNegation ?? 0;
    const cancelled = !!action.monster?.mcan;
    attack.fireOriginalDamage = attack.damage ?? 0;
    attack.negated = cancelled
        || recordRandom(random, action.calls, 10) < 3 * armorProtection;
    if (cancelled) {
        attack.damage = 0;
        attack.fireEffectMessage = null;
    } else if (attack.negated) {
        attack.damage = 0;
        attack.fireEffectMessage = 'You avoid harm.';
    } else {
        attack.fireEffectMessage = "You're on fire!";
        if (state.u.fireResistance || state.u.fire_resistance) {
            attack.damage = 0;
            attack.fireResistanceMessage = "The fire doesn't feel hot!";
        }
    }
    if (!attack.negated && clearHeroSliming(state)) {
        attack.slimeBurnedMessage
            = 'The slime that covers you is burned away!';
    }
    attack.deferredFireInventory = !attack.negated;
    if (attack.negated) delete attack.fireOriginalDamage;
    attack.deferredPostHit = true;
    attack.deferredFireNegation = false;
    return action;
}

// Continue mhitm_ad_elec() after its hit message.
export function resumeDeferredHeroElectricSpecial(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredElectricNegation) return action;
    const armorProtection = state?.u?._magicNegation ?? 0;
    const cancelled = !!action.monster?.mcan;
    attack.electricOriginalDamage = attack.damage ?? 0;
    attack.negated = cancelled
        || recordRandom(random, action.calls, 10) < 3 * armorProtection;
    if (cancelled) {
        attack.damage = 0;
        attack.electricEffectMessage = null;
    } else if (attack.negated) {
        attack.damage = 0;
        attack.electricEffectMessage = 'You avoid harm.';
    } else if (state.u.shockResistance || state.u.shock_resistance) {
        attack.damage = 0;
        attack.electricEffectMessage = 'You get zapped!';
        attack.electricResistanceMessage = "The zap doesn't shock you!";
    } else {
        attack.electricEffectMessage = 'You get zapped!';
    }
    attack.deferredElectricInventory = !attack.negated;
    if (attack.negated) delete attack.electricOriginalDamage;
    attack.deferredPostHit = true;
    attack.deferredElectricNegation = false;
    return action;
}

// Resume mhitm_ad_drli() after hitmsg().  A selected level loss and its
// message precede shared knockback and the touch's ordinary HP damage.
export function resumeDeferredHeroLifeDrain(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredLifeDrainGate) return action;
    const selected = recordRandom(random, action.calls, 3) === 0;
    const drainResistant = heroHasDrainResistance(state);
    if (selected && !drainResistant) {
        const armorProtection = state.u?._magicNegation ?? 0;
        const negated = !!action.monster?.mcan
            || recordRandom(random, action.calls, 10) < 3 * armorProtection;
        if (!negated) {
            const loss = loseExperienceLevel(state);
            attack.lifeDrainMessage = `Goodbye level ${loss.oldLevel}.`;
            attack.lifeDrain = loss;
        }
    }
    attack.deferredLifeDrainGate = false;
    attack.deferredPostHit = true;
    return action;
}

// Resume mhitm_ad_stun() after hitmsg().  make_stunned() receives the full
// pre-halving damage; only the ordinary HP tail is reduced on selection.
export function resumeDeferredHeroStun(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredStunGate) return action;
    if (!action.monster?.mcan
        && recordRandom(random, action.calls, 4) === 0) {
        const oldTurns = state.u?.stunnedTurns ?? 0;
        state.u.stunnedTurns = oldTurns + Math.max(0, attack.damage ?? 0);
        state.u.stunned = state.u.stunnedTurns > 0;
        if (oldTurns === 0) attack.stunMessage = 'You stagger...';
        attack.damage = Math.trunc((attack.damage ?? 0) / 2);
        attack.stunSelected = true;
    }
    attack.deferredStunGate = false;
    attack.deferredPostHit = true;
    return action;
}

// C mhitu.c:expels() crosses a tty boundary inside unstuck()->docrt().  Split
// the state release from the post-redraw cooldown/relocation so allmain can
// suspend on that message window without consuming mnexto()'s RNG early.
export function beginDeferredHeroExpulsion(action, state) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredExpulsion || attack.expulsionBegun) return null;
    const monster = action.monster;
    attack.expulsionBegun = true;
    return releaseHeroFromMonster(monster, state);
}

function covetousObjectMatchesMask(object, mask, state) {
    if (!object) return false;
    if (mask === M3_WANTSAMUL) return object.otyp === AMULET_OF_YENDOR;
    if (mask === M3_WANTSBELL) return object.otyp === BELL_OF_OPENING;
    if (mask === M3_WANTSBOOK) return object.otyp === SPE_BOOK_OF_THE_DEAD;
    if (mask === M3_WANTSCAND)
        return object.otyp === CANDELABRUM_OF_INVOCATION;
    return mask === M3_WANTSARTI && isQuestArtifact(object, state);
}

function covetousExternalTargetExists(monster, state, mask) {
    const speciesFlags = MONSTER_FLAGS3[monster?.mnum] ?? 0;
    if (!(speciesFlags & mask)) return false;
    const ownsTarget = (monster?.minvent || monster?.inventory || [])
        .some(object => covetousObjectMatchesMask(object, mask, state));
    if (ownsTarget) return false;
    if ((state?.inventory || [])
        .some(object => covetousObjectMatchesMask(object, mask, state))) {
        return true;
    }
    for (let x = 0; x < (state?.level?.objects?.length || 0); x++) {
        const column = state.level.objects[x];
        for (let y = 0; y < (column?.length || 0); y++) {
            if ((column[y] || []).some(object =>
                covetousObjectMatchesMask(object, mask, state))) return true;
        }
    }
    return !!state?.level?.monsters?.some(candidate =>
        candidate !== monster && (candidate.mhp ?? 1) > 0
        && (candidate.minvent || candidate.inventory || []).some(object =>
            covetousObjectMatchesMask(object, mask, state)));
}

function covetousTargetMasks(state) {
    const invoked = !!state?.u?.uevent?.invoked;
    const masks = state?.context?.made_amulet
        ? [M3_WANTSAMUL] : [];
    masks.push(...(invoked
        ? [M3_WANTSARTI, M3_WANTSBOOK, M3_WANTSBELL, M3_WANTSCAND]
        : [M3_WANTSBOOK, M3_WANTSBELL, M3_WANTSCAND, M3_WANTSARTI]));
    return masks;
}

// wizard.c:tactics(STRAT_GROUND).  When a covetous monster already occupies
// the artifact square, rloc_to() is a no-op and mpickobj() transfers the
// object before ordinary m_move().  Other ground/hero/monster target
// relocations remain separate branches; this exact-square case owns no RNG.
function covetousPicksUpTargetUnderfoot(monster, state) {
    if (!monsterIsCovetous(monster)) return null;
    const pile = state?.level?.objects?.[monster.mx]?.[monster.my];
    if (!Array.isArray(pile) || !pile.length) return null;
    for (const mask of covetousTargetMasks(state)) {
        if (!((MONSTER_FLAGS3[monster.mnum] ?? 0) & mask)) continue;
        const index = pile.findIndex(object =>
            covetousObjectMatchesMask(object, mask, state));
        if (index < 0) continue;
        const [object] = pile.splice(index, 1);
        addObjectToMonsterInventory(
            monster, object, state, { atFront: true },
        );
        return object;
    }
    return null;
}

// C wizard.c strategy(): this predicate identifies the full-health,
// no-artifact-target STRAT_NONE branch.  The wounded stair-healing and
// concrete artifact pursuit branches have different relocation owners and
// deliberately do not enter the harass roll below.
function covetousUsesHarassStrategy(monster, state) {
    if (!monsterIsCovetous(monster)
        || shopkeeperInOwnShop(monster, state)
        || priestIsInOwnTemple(monster, state)) return false;
    const hp = Math.max(0, monster.mhp ?? 0);
    const maxHp = Math.max(1, monster.mhpmax ?? hp);
    if (Math.floor((hp * 3) / maxHp) !== 3) return false;
    return !covetousTargetMasks(state).some(mask =>
        covetousExternalTargetExists(monster, state, mask));
}

function covetousTeleportDestination(monster, state, random, calls) {
    // NEW_ENEXTO gathers and shuffles all three rings before goodpos() tests
    // its first candidate.  If GP_CHECKSCARY rejects every coordinate,
    // enexto() performs a second independently shuffled pass without it.
    for (const checkScary of [true, false]) {
        const candidates = collectNearbyCoords(
            state?.u?.ux ?? monster.mx,
            state?.u?.uy ?? monster.my,
            3, random, calls,
        );
        const destination = candidates.find(({ x, y }) =>
            // teleport.c:enexto_core()->goodpos() sees the relocating actor
            // still occupying its old square, so that shuffled candidate is
            // rejected just like any other MON_AT location.
            (x !== monster.mx || y !== monster.my)
            && expulsionDestinationOk(monster, state, x, y)
            && (!checkScary || !monsterIsScaredAt(
                monster, state, x, y,
            )));
        if (destination) return destination;
    }
    return null;
}

function runCovetousHarassTactics(monster, state, random, calls) {
    if (!covetousUsesHarassStrategy(monster, state)) return null;
    // tactics() replaces the previous strategy while retaining the two
    // waiting bits and its one-shot relocation presentation bit.
    monster.mstrategy = (monster.mstrategy ?? 0)
        & (STRAT_WAITMASK | STRAT_APPEARMSG);
    if (monsterTeleportRestricted(monster, state)
        || recordRandom(random, calls, monster.mflee ? 33 : 5) !== 0) {
        return null;
    }
    const destination = covetousTeleportDestination(
        monster, state, random, calls,
    );
    if (!destination) return null;
    const oldx = monster.mx;
    const oldy = monster.my;
    const appearMessage = !!(monster.mstrategy & STRAT_APPEARMSG);
    monster.mstrategy &= ~STRAT_APPEARMSG;
    monster.mx = destination.x;
    monster.my = destination.y;
    monster.mtrack = [];
    return {
        oldx, oldy,
        x: monster.mx, y: monster.my,
        moved: oldx !== monster.mx || oldy !== monster.my,
        deferredCovetousRelocation: true,
        covetousRelocation: { appearMessage },
    };
}

export function finishDeferredHeroExpulsion(
    action, state, random = rn2, rollOne = rnd,
) {
    const attack = action?.movement?.attack;
    if (!attack?.expulsionBegun || !attack.deferredExpulsion) return null;
    const monster = action.monster;
    const calls = action.calls;
    const movement = moveExpelledMonster(monster, state, {
        random, rollOne, calls,
    });
    attack.deferredExpulsion = false;
    attack.expulsionBegun = false;
    return movement;
}

// Continue an ordinary natural hit after its visible hit message has been
// accepted.  C ref: mhitu.c:hitmu() -> mhitm_knockback(), then losehp().
export function resumeDeferredHeroContact(
    action, state, random = rn2, rollOne = rnd,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredPostHit) return action;
    const calls = action.calls;
    // mhitm_ad_drst() prints hitmsg() after magic cancellation but before the
    // one-in-eight poison gate.  A tty pager can therefore split those two
    // draws across captured input steps.
    if (attack.deferredPoisonCheck) {
        attack.poisoned = recordRandom(random, calls, 8) === 0;
        attack.deferredPoisonCheck = false;
        // mhitm_ad_drst() calls poisoned() before hitmu() reaches
        // mhitm_knockback().  The poison notice can itself suspend in tty,
        // so leave the post-hit tail resumable until the display owner has
        // completed that nested transaction.
        if (attack.poisoned) {
            attack.deferredPoisonEffect = true;
            return action;
        }
    }
    if (attack.deferredPoisonEffect) return action;
    if (attack.deferredAmuletTheftGate) {
        const stealGate = recordRandom(random, calls, 20);
        attack.deferredAmuletTheftGate = false;
        const theftTarget = (state.inventory || []).find(object =>
            object?.questArtifact || object?.isQuestArtifact
            || [AMULET_OF_YENDOR, BELL_OF_OPENING,
                SPE_BOOK_OF_THE_DEAD, CANDELABRUM_OF_INVOCATION]
                .includes(object?.otyp));
        if (stealGate === 0 && theftTarget) {
            // Actual worn-item removal, theft, and relocation remain a named
            // continuation.  A successful gate with no special target is a
            // source no-op and must continue into knockback/passive handling.
            attack.deferredAmuletTheft = true;
            attack.amuletTheftTarget = theftTarget;
            return action;
        }
    }
    if (attack.deferredAmuletTheft) return action;
    if (attack.deferredColdInventory) {
        const destructionGate = recordRandom(random, calls, 20);
        const attackerLevel = action.monster?.m_lev
            ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        if (attackerLevel > destructionGate) {
            attack.deferredElementalInventory = {
                damageType: 'cold',
                sourceDamage: attack.coldOriginalDamage ?? 0,
            };
            attack.deferredColdInventory = false;
            return action;
        }
        attack.deferredColdInventory = false;
        delete attack.coldOriginalDamage;
    }
    if (attack.deferredFireInventory) {
        const destructionGate = recordRandom(random, calls, 20);
        const attackerLevel = action.monster?.m_lev
            ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        if (attackerLevel > destructionGate) {
            attack.deferredElementalInventory = {
                damageType: 'fire',
                sourceDamage: attack.fireOriginalDamage ?? 0,
            };
            attack.deferredFireInventory = false;
            return action;
        }
        attack.deferredFireInventory = false;
        delete attack.fireOriginalDamage;
    }
    if (attack.deferredElectricInventory) {
        const destructionGate = recordRandom(random, calls, 20);
        const attackerLevel = action.monster?.m_lev
            ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        if (attackerLevel > destructionGate) {
            attack.deferredElementalInventory = {
                damageType: 'electric',
                sourceDamage: attack.electricOriginalDamage ?? 0,
            };
            attack.deferredElectricInventory = false;
            return action;
        }
        attack.deferredElectricInventory = false;
        delete attack.electricOriginalDamage;
    }
    recordRandom(random, calls, 3);
    recordRandom(random, calls, 6);
    attack.appliedDamage = reduceHeroContactDamage(
        attack.damage, state, rollOne, calls,
    );
    const wasPolymorphed = Upolyd(state?.u);
    applyHeroContactDamage(state, attack.appliedDamage);
    if (wasPolymorphed && (state.u?.mh ?? 0) < 1) {
        // mhitu.c:mdamageu() rehumanizes atomically before passiveum() sees
        // the old form.  Retain the returned presentation transaction for
        // the async actor driver, but make the body change live now so
        // passiveum's Upolyd-only gate does not consume rn2(3).
        attack.contactRehumanized = rehumanizeHero(state);
    }
    if (attack.appliedDamage > 0) {
        attack.passive = applyHeroPassiveAfterContact(
            action.monster, state, random, d, calls,
            attack.oldFormMnum
                ?? (Upolyd(state?.u) ? state.u.umonnum : null),
            true,
        );
    }
    attack.deferredPostHit = false;
    return action;
}

export function resumeDeferredHeroSticking(action, state) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredStickingAfterHit) return action;
    if (!attack.negated && !state.u?.ustuck && !heroFormSticks(state)) {
        state.u.ustuck = action.monster;
        attack.stuckHero = true;
        if (action.monster?.mnum === 293)
            attack.stickingMessage = 'The barbs stick to you!';
    }
    attack.deferredStickingAfterHit = false;
    attack.deferredPostHit = true;
    return action;
}

// Resume hitmu() after its concealed-attacker line has crossed tty.  The
// mattacku() to-hit die belongs before that line; base damage and every later
// contact effect belong after it.
export function resumeDeferredHeroReveal(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredRevealUnder) return attack;
    const resumed = basicMonsterAttack(
        action.monster, state, random, rollOne, rollDice, action.calls,
        attack.attackIndex, attack.threshold,
        { roll: attack.roll, hit: attack.hit },
        true,
    );
    action.movement.attack = resumed;
    return resumed;
}

// Resume mhitm_ad_legs() after the xan's special contact line has crossed
// tty.  set_wounded_legs() owns the duration and one-time Dexterity penalty;
// its two exercise() calls precede hitmu()'s shared knockback/damage tail.
export function resumeDeferredHeroLegs(
    action, state, random = rn2, rollOne = rnd,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredLegEffect) return action;
    const u = state?.u;
    const dexterity = u?.acurr?.a?.[A_DEX] ?? 10;
    const durationSides = Math.max(1, 60 - dexterity);
    const duration = rollOne(durationSides);
    action.calls.push(`rnd(${durationSides})`);

    const wasWounded = (u?._woundedLegTurns ?? 0) > 0;
    if (u) {
        u._woundedLegTurns = Math.max(u._woundedLegTurns ?? 0, duration);
        if (!u._woundedLegSide) {
            u._woundedLegSide = attack.legSide;
        } else if (u._woundedLegSide !== attack.legSide) {
            u._woundedLegSide = 'both';
        }
        if (!wasWounded && u.acurr?.a) u.acurr.a[A_DEX]--;
        if (!Array.isArray(u._exercise)) u._exercise = Array(6).fill(0);
        // attrib.c:exercise() suppresses physical exercise in monster form.
        if (!Upolyd(u)) {
            u._exercise[A_STR] -= recordRandom(random, action.calls, 2);
            u._exercise[A_DEX] -= recordRandom(random, action.calls, 2);
        }
    }
    attack.deferredLegEffect = false;
    attack.deferredPostHit = true;
    return action;
}

// Resume mhitm_ad_blnd() after its special contact line has crossed tty.
// make_blinded() precedes hitmu()'s shared knockback probes and contributes no
// HP damage; keeping those phases together preserves the next attack/actor
// boundary when the blindness line itself requires acknowledgement.
export function resumeDeferredHeroBlindness(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredBlindEffect) return false;
    let toggled = false;
    if (attack.blindApplicable) {
        const oldTurns = state?.u?.blindTurns ?? 0;
        // uhitm.c:mhitm_ad_blnd() passes the full declared damage to
        // make_blinded(), which adds it to the current timeout even when the
        // hero is already blind.  The one-turn repeated-blindness behavior in
        // mhitu.c belongs to engulfing attacks, not ordinary raven contact.
        const increment = attack.blindIncrement ?? 0;
        if (state?.u)
            state.u.blindTurns = oldTurns + increment;
        toggled = !state.blind && oldTurns <= 0;
        syncBlindness(state);
        state.vision_full_recalc = 1;
    }
    recordRandom(random, action.calls, 3);
    recordRandom(random, action.calls, 6);
    attack.deferredBlindEffect = false;
    attack.blindResolved = true;
    return toggled;
}

// Resume mhitm_ad_ston() after hitmsg() has crossed tty.  A cockatrice touch
// first owns its one-in-three hiss/petrification gate, then the shared
// mhitm_knockback() prefix runs even though the declared contact is 0d0 and
// the attack method can never actually knock the hero back.
export function resumeDeferredHeroStoning(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredStoningEffect) return action;
    const special = recordRandom(random, action.calls, 3);
    attack.stoningSpecialTriggered = special === 0;
    if (attack.stoningSpecialTriggered) {
        attack.deferredStoningSpecial = true;
        const monster = action.monster;
        const name = MONSTER_NAME[monster?.mnum] || 'monster';
        const deaf = !!state?.deaf || (state?.u?.deafTurns ?? 0) > 0;
        const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
        const hallucinating = !!state?.u?.hallucinating
            || (state?.u?.hallucinationTurns ?? 0) > 0;
        if (monster?.mcan) {
            if (!deaf)
                attack.stoningSpecialMessage = `You hear a cough from the ${name}!`;
        } else if (hallucinating && !blind) {
            if (!deaf) attack.stoningSpecialMessage = 'You hear hissing.';
            attack.stoningSpecialFollowup
                = `The ${name} appears to be blowing you a kiss...`;
        } else if (!deaf) {
            attack.stoningSpecialMessage
                = `You hear the ${name}'s hissing!`;
        } else if (!blind) {
            attack.stoningSpecialMessage = `The ${name} seems to grimace.`;
        }
        if (!monster?.mcan) {
            attack.stoningPetrificationSelected
                = recordRandom(random, action.calls, 10) === 0;
            // do_stone_u(), including new-moon override and resistance/
            // delayed-polyform handling, remains a separate successor.
            if (attack.stoningPetrificationSelected)
                attack.deferredHeroPetrification = true;
        }
    }
    recordRandom(random, action.calls, 3);
    recordRandom(random, action.calls, 6);
    attack.deferredStoningEffect = false;
    attack.stoningContactResolved = true;
    return action;
}

// Resume mattacku() at the next natural attack slot.  The tty driver calls
// this only after the preceding hit/miss message and post-hit tail have both
// completed, keeping one C actor transaction alive across pline() suspension.
export function continueDeferredHeroAttack(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const previous = action?.movement?.attack;
    const attackIndex = previous?.nextAttackIndex;
    if (attackIndex === undefined || attackIndex === null) return null;
    if (previous?.passive?.attackerDied
        || action?.monster?.dead
        || (action?.monster?.mhp ?? 1) <= 0) return null;
    // executeLiveQuietMonsterScan() clears its broad deferral marker after
    // the first synchronous actor slice.  A later slot is still inside that
    // same visible mattacku() transaction, so force only this contact through
    // the deferred hit/message path and restore the caller's marker.
    const previousDeferral = state?._deferVisibleMonsterContact;
    if (state) state._deferVisibleMonsterContact = true;
    let attack;
    try {
        attack = basicMonsterAttack(
            action.monster, state, random, rollOne, rollDice,
            action.calls, attackIndex, previous.threshold,
        );
    } finally {
        if (state) state._deferVisibleMonsterContact = previousDeferral;
    }
    action.movement.attack = attack;
    return attack;
}

// C mattacku() keeps walking its six-slot table after an AT_WEAP slot spends
// that slot wielding a replacement.  Resume at the following attack index;
// beginning a fresh sequence would incorrectly swing the new weapon at slot0.
export function resumeDeferredHeroAttackAfterWield(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const movement = action?.movement;
    const pending = movement?.deferredHeroWield;
    if (!pending) return null;
    delete movement.deferredHeroWield;
    const attackIndex = nextHeroAttackIndex(
        action.monster, pending.attackIndex,
    );
    if (attackIndex === null) {
        movement.attack = null;
        return null;
    }
    const attack = basicMonsterAttack(
        action.monster, state, random, rollOne, rollDice, action.calls,
        attackIndex, pending.threshold, null, true,
    );
    movement.attack = attack;
    return attack;
}

// Resume castmu() after the casting line.  Damage is pre-rolled before the
// concrete effect line, but not before a casting line which itself pages.
export function rollDeferredHeroSpellDamage(
    action, state, rollDice = d,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredSpellDamage) return attack;
    let damage = rollDice(attack.spellDice, attack.spellSides);
    action.calls.push(`d(${attack.spellDice},${attack.spellSides})`);
    if (state?.u?.halfSpellDamage || state?.u?.half_spell_damage)
        damage = Math.trunc((damage + 1) / 2);
    const spell = (attack.damageType === AD_CLRC
        ? MONSTER_CLERIC_SPELLS : MONSTER_WIZARD_SPELLS)
        .find(candidate => candidate.key === attack.spell);
    const preview = monsterSpellEffectPreview(spell, damage, state);
    attack.damage = damage;
    attack.effectDamage = preview.effectDamage;
    attack.spellEffectMessage = preview.effectMessage;
    attack.deferredSpellDamage = false;
    return attack;
}

// Resume mcastu.c:mcast_spell() after its effect message has crossed tty.
// The first concrete owner is PSI_BOLT; applying its pre-rolled damage can
// kill only the current monster form, in which case allmain projects the
// shared polyself.c:rehumanize() transaction rather than treating the hero as
// ordinarily dead.
export function resumeDeferredHeroSpell(
    action, state, random = rn2, rollOne = rnd,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredSpellEffect) return null;
    attack.deferredSpellEffect = false;
    if (attack.spell === 'blind-you') {
        const turns = state.u?.halfSpellDamage
            || state.u?.half_spell_damage ? 100 : 200;
        const wasBlind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
        state.u.blindTurns = turns;
        syncBlindness(state);
        state.vision_full_recalc = 1;
        attack.toggledBlindness = !wasBlind;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'paralyze') {
        const resisted = !!(state.u?.antimagic
            || heroHasFreeAction(state));
        const monsterLevel = action.monster?.m_lev
            ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        let duration = resisted ? 1 : 4 + monsterLevel;
        if (state.u?.halfSpellDamage || state.u?.half_spell_damage)
            duration = Math.trunc((duration + 1) / 2);
        state._helplessTurns = duration;
        state._helplessReason = 'paralyzed by a monster';
        state._helplessDoneMessage = 'You can move again.';
        const wasPolymorphed = Upolyd(state?.u);
        applyHeroContactDamage(state, duration);
        attack.appliedDamage = duration;
        attack.paralyzed = true;
        attack.rehumanize = wasPolymorphed && (state.u?.mh ?? 0) < 1;
        attack.heroDied = !wasPolymorphed && (state.u?.uhp ?? 0) < 1;
        return attack;
    }
    if (attack.spell === 'confuse-you') {
        const antimagic = !!state.u?.antimagic;
        if (!antimagic) {
            const monsterLevel = action.monster?.m_lev
                ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
            let duration = monsterLevel;
            if (state.u?.halfSpellDamage || state.u?.half_spell_damage)
                duration = Math.trunc((duration + 1) / 2);
            state.u.confusionTurns = (state.u.confusionTurns ?? 0) + duration;
        }
        attack.appliedDamage = 0;
        attack.confusedHero = !antimagic;
        return attack;
    }
    if (attack.spell === 'cure-self') {
        const healing = d(3, 6);
        action.calls.push('d(3,6)');
        const monster = action.monster;
        monster.mhp = Math.min(
            monster.mhpmax ?? monster.mhp ?? healing,
            (monster.mhp ?? 0) + healing,
        );
        attack.appliedDamage = 0;
        attack.healedMonster = healing;
        return attack;
    }
    if (attack.spell === 'disappear') {
        const monster = action.monster;
        setMonsterPermanentInvisibility(monster);
        attack.monsterDisappeared = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'weaken-you') {
        const antimagic = !!state.u?.antimagic;
        attack.appliedDamage = 0;
        if (antimagic) {
            attack.weakenedHero = false;
            return attack;
        }

        const monsterLevel = action.monster?.m_lev
            ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        let lossSides = Math.max(1, monsterLevel - 6);
        if (state.u?.halfSpellDamage || state.u?.half_spell_damage)
            lossSides = Math.trunc((lossSides + 1) / 2);
        let strengthLoss = rollOne(lossSides);
        action.calls.push(`rnd(${lossSides})`);

        const wasPolymorphed = Upolyd(state.u);
        const attributes = state.u?.acurr?.a;
        const currentStrength = attributes?.[A_STR] ?? 3;
        let reducedStrength = currentStrength - strengthLoss;
        let frailtyDamage = 0;
        while (reducedStrength < 3) {
            reducedStrength++;
            strengthLoss--;
            frailtyDamage += 3 + recordRandom(random, action.calls, 4);
        }

        if (frailtyDamage) {
            applyHeroContactDamage(state, frailtyDamage);
            if (wasPolymorphed && (state.u.mh ?? 0) > 0) {
                state.u.mhmax = Math.max(
                    1, (state.u.mhmax ?? 1) - frailtyDamage,
                );
                state.u.mh = Math.min(state.u.mh, state.u.mhmax);
            } else if (!wasPolymorphed) {
                const minimumHp = Math.max(1, state.u.ulevel ?? 1);
                state.u.uhpmax = Math.max(
                    minimumHp, (state.u.uhpmax ?? 1) - frailtyDamage,
                );
                state.u.uhp = Math.min(state.u.uhp, state.u.uhpmax);
            }
        }

        const rehumanize = wasPolymorphed && (state.u.mh ?? 0) < 1;
        if (attributes && strengthLoss > 0 && !rehumanize) {
            attributes[A_STR] = reducedStrength;
            if (!Array.isArray(state.u._exercise))
                state.u._exercise = Array(6).fill(0);
            state.u._exercise[A_STR] = 0;
        }
        attack.strengthLoss = strengthLoss;
        attack.frailtyDamage = frailtyDamage;
        attack.weakenedHero = strengthLoss > 0 || frailtyDamage > 0;
        attack.rehumanize = rehumanize;
        attack.heroDied = !wasPolymorphed && (state.u.uhp ?? 0) < 1;
        return attack;
    }
    if (attack.spell === 'summon-monsters') {
        attack.deferredSummonMonsters = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'death-touch') {
        attack.deferredDeathTouch = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'clone-wizard') {
        attack.deferredCloneWizard = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'haste-self') {
        attack.deferredHasteSelf = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'aggravation') {
        attack.deferredAggravation = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'stun-you') {
        const resisted = !!(state.u?.antimagic
            || heroHasFreeAction(state));
        let duration = 1;
        if (!resisted) {
            const dexterity = state.u?.acurr?.a?.[A_DEX] ?? 10;
            const dice = dexterity < 12 ? 6 : 4;
            duration = d(dice, 4);
            action.calls.push('d(' + dice + ',4)');
            if (state.u?.halfSpellDamage || state.u?.half_spell_damage)
                duration = Math.trunc((duration + 1) / 2);
            duration += state.u?.stunnedTurns ?? 0;
        }
        state.u.stunnedTurns = duration;
        state.u.stunned = duration > 0;
        attack.stunnedHero = true;
        attack.stunDuration = duration;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'destroy-armor') {
        attack.deferredDestroyArmor = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'fire-pillar') {
        attack.deferredFirePillar = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'lightning') {
        attack.deferredLightningSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'insects') {
        attack.deferredInsectSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'curse-items') {
        attack.deferredCurseItems = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'geyser') {
        attack.deferredGeyserSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (!['psi-bolt', 'open-wounds'].includes(attack.spell)) {
        attack.unimplementedSpellEffect = true;
        return attack;
    }
    const wasPolymorphed = Upolyd(state?.u);
    applyHeroContactDamage(state, attack.effectDamage ?? attack.damage ?? 0);
    attack.appliedDamage = attack.effectDamage ?? attack.damage ?? 0;
    attack.rehumanize = wasPolymorphed && (state.u?.mh ?? 0) < 1;
    attack.heroDied = !wasPolymorphed && (state.u?.uhp ?? 0) < 1;
    return attack;
}

function heroCanSeeInvisible(state) {
    return !!(state?.u?.seeInvisible || state?.u?.see_invisible
        || (state?.u?.seeInvisibleTurns ?? 0) > 0);
}

function monsterSpellHasAggravatables(caster, state) {
    return !!state?.level?.monsters?.some(monster =>
        monster !== caster && !monster.dead && (monster.mhp ?? 1) > 0
        && (((monster.mstrategy ?? 0) & STRAT_WAITFORU)
            || monster.msleeping || monster.mcanmove === 0
            || (monster.mfrozen ?? 0) > 0));
}

function monsterSpellUseless(monster, spell, state, random = rn2, calls = []) {
    if ((spell.flags & MCF_HOSTILE) && monster.mpeaceful) return true;
    if (spell.key === 'cure-self')
        return (monster.mhp ?? 0) >= (monster.mhpmax ?? 0);
    if (spell.key === 'blind-you')
        return !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
    if (spell.key === 'haste-self')
        return monster.permspeed === MFAST || monster.mspeed === MFAST;
    if (spell.key === 'disappear') {
        return !!monster.minvis || !!monster.invis_blkd
            // mcastu.c keeps peaceful monsters visible to a hero who lacks
            // See_invisible.  choose_monster_spell() then continues down the
            // same spell table without consuming another selection draw.
            || (!!monster.mpeaceful && !heroCanSeeInvisible(state));
    }
    if (spell.key === 'death-touch') {
        const resisted = !!(state?.u?.antimagic
            || state?.u?.hallucinating
            || (state?.u?.hallucinationTurns ?? 0) > 0);
        return resisted && recordRandom(random, calls, 2) === 0;
    }
    if (spell.key === 'geyser')
        return recordRandom(random, calls, 5) === 0;
    if (spell.key === 'clone-wizard') return !monster.iswiz;
    if (spell.key === 'aggravation'
        && !monsterSpellHasAggravatables(monster, state)) {
        return recordRandom(random, calls, 100) !== 0;
    }
    return false;
}

// C mcastu.c:choose_monster_spell().  Selection is observable even when a
// peaceful caster rejects the directed/hostile result and proceeds to move.
function chooseMonsterSpell(monster, damageType, state, random, calls) {
    const list = damageType === AD_CLRC ? MONSTER_CLERIC_SPELLS
        : damageType === AD_SPEL ? MONSTER_WIZARD_SPELLS : null;
    if (!list?.length) return null;
    const maxLevel = list.at(-1).level;
    let spellValue = recordRandom(
        random, calls, Math.max(1, monster.m_lev || 1),
    );
    if (spellValue > maxLevel
        && recordRandom(random, calls, Math.max(1, maxLevel)) !== 0) {
        spellValue = recordRandom(random, calls, Math.max(1, maxLevel));
    }
    for (let index = list.length - 1; index >= 0; index--) {
        const spell = list[index];
        if (spell.level <= spellValue
            && !monsterSpellUseless(
                monster, spell, state, random, calls,
            )) return spell;
    }
    return list[0];
}

function movementSpellSelections(monster, state, random, calls) {
    if (monster.mspec_used
        || dist2(monster.mx, monster.my,
            state?.u?.ux ?? monster.mx,
            state?.u?.uy ?? monster.my) > 49) return null;
    for (const [attackType, damageType] of MONSTER_ATTACKS[monster.mnum] || []) {
        if (attackType !== AT_MAGC
            || (damageType !== AD_CLRC && damageType !== AD_SPEL)) continue;
        const spell = chooseMonsterSpell(
            monster, damageType, state, random, calls,
        );
        if (!spell) continue;
        // castmu(FALSE,FALSE) selects once.  Directed or currently-useless
        // spells miss without spending the action; a successful indirect
        // spell bypasses m_move() and owns the whole actor transaction.
        if (!(spell.flags & MCF_INDIRECT)
            || monsterSpellUseless(
                monster, spell, state, random, calls,
            )) continue;
        const monsterLevel = monster.m_lev
            ?? MONSTER_LEVEL[monster.mnum] ?? 0;
        if (monster.mcan || monster.mspec_used || !monsterLevel) {
            return {
                spell: spell.key, cast: false, blocked: true,
                damageType, directed: false,
            };
        }
        monster.mspec_used = monsterLevel < 8 ? 10 - monsterLevel : 2;
        const fumble = recordRandom(
            random, calls, Math.max(1, monsterLevel * 10),
        ) < (monster.mconf ? 100 : 20);
        if (fumble) {
            return {
                spell: spell.key, cast: false, fumbled: true,
                damageType, directed: false,
            };
        }
        return {
            spell: spell.key, cast: true, damageType, directed: false,
            deferredSpellEffect: true,
        };
    }
    return null;
}

async function monsterSummonSpellEffect(monster, state) {
    let effect = { count: 0, created: [], message: null };
    const summoned = await summonNastyMonsters(monster);
    effect = {
        ...effect,
        ...(summoned.deferredDemonSummon
            ? await msummon(monster) : summoned),
    };
    for (const created of effect.created || []) {
        const hostileState = created.mpeaceful;
        if (created._nastyBirthPeaceful !== undefined)
            created.mpeaceful = created._nastyBirthPeaceful;
        newsym(created.mx, created.my);
        created.mpeaceful = hostileState;
        delete created._nastyBirthPeaceful;
    }
    if (effect.count > 0) {
        if (monster?.iswiz) {
            effect.message = `"Destroy the thief, my pet${
                effect.count === 1 ? '' : 's'
            }!"`;
        } else {
            const one = effect.count === 1;
            const appearance = one
                ? 'A monster appears' : 'Monsters appear';
            const heroX = state?.u?.ux ?? monster?.mux;
            const heroY = state?.u?.uy ?? monster?.muy;
            const wrongTarget = monster?.mux !== heroX
                || monster?.muy !== heroY;
            const cannotSeeInvisible = !((MONSTER_FLAGS1[
                monster?.mnum
            ] ?? 0) & M1_SEE_INVIS);
            if ((state?.invisible || state?.u?.invisible)
                && cannotSeeInvisible && wrongTarget) {
                effect.message = `${appearance} ${
                    one ? 'at' : 'around'
                } a spot near you!`;
            } else if (heroIsDisplaced(state) && wrongTarget) {
                effect.message = `${appearance} ${
                    one ? 'by' : 'around'
                } your displaced image!`;
            } else {
                effect.message = `${appearance} from nowhere!`;
            }
        }
    }
    return effect;
}

export async function resolveDeferredHeroSummonMonsters(action, state) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredSummonMonsters) return null;
    const effect = await monsterSummonSpellEffect(action.monster, state);
    attack.summonedMonsters = effect.created || [];
    attack.deferredSummonMonsters = false;
    return effect;
}

const WIZARD_CLONE_APPEARANCE_NAMES = [
    'human', 'water demon', 'vampire', 'red dragon', 'troll', 'umber hulk',
    'xorn', 'xan', 'cockatrice', 'floating eye', 'guardian naga', 'trapper',
];

export async function beginDeferredHeroCloneWizard(action, state) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredCloneWizard || attack.cloneWizard) return null;
    const clone = await makemonNear(
        285, state.u?.ux ?? 0, state.u?.uy ?? 0, MM_NOWAIT,
    );
    if (!clone) {
        attack.deferredCloneWizard = false;
        return null;
    }
    attack.cloneWizard = clone;
    newsym(clone.mx, clone.my);
    const hallucinating = !!(state.u?.hallucinating
        || (state.u?.hallucinationTurns ?? 0) > 0);
    if (hallucinating) {
        nameMonsterForCreationArmorChecks(
            clone, () => randomDisplayMonsterName(),
        );
    }
    // makemon() repaints after the complete creation wear pass, then formats
    // its visible announcement.  clonewiz() performs another repaint later,
    // after fake-Amulet and wizapp state have been installed.
    newsym(clone.mx, clone.my);
    const subject = hallucinating
        ? randomDisplayMonsterSubject(true) : 'The Wizard of Yendor';
    return {
        clone,
        message: `${subject} suddenly appears next to you!`,
    };
}

export function finishDeferredHeroCloneWizard(action, state, random = rn2) {
    const attack = action?.movement?.attack;
    const clone = attack?.cloneWizard;
    if (!attack?.deferredCloneWizard || !clone) return null;
    clone.msleeping = 0;
    clone.mtame = 0;
    clone.mpeaceful = 0;
    if (!state.u?.uhave?.amulet
        && recordRandom(random, action.calls, 2) !== 0) {
        const fake = mksobj(FAKE_AMULET_OF_YENDOR, true, false);
        // wizard.c:clonewiz() uses add_to_minv(), not mpickobj(): a newly
        // minted fake Amulet links directly without carrying effects.
        linkObjectToMonsterInventory(clone, fake);
    }
    const protectedFromShapechangers = !!(
        state.u?.protectionFromShapeChangers
        || state.u?.protection_from_shape_changers
    );
    if (!protectedFromShapechangers) {
        const appearanceIndex = recordRandom(
            random, action.calls, WIZARD_CLONE_APPEARANCE_NAMES.length,
        );
        clone.m_ap_type = M_AP_MONSTER;
        clone.mappearance = MONSTER_NAME.indexOf(
            WIZARD_CLONE_APPEARANCE_NAMES[appearanceIndex],
        );
    }
    newsym(clone.mx, clone.my);
    attack.deferredCloneWizard = false;
    return clone;
}

function monsterHasteSelfEffect(monster, state) {
    const speed = adjustMonsterSpeed(monster, 1);
    const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
    const inSight = !blind
        && !!(state?.viz_array?.[monster.my]?.[monster.mx] & 0x2);
    const canSeeInvisible = !!(state?.u?.seeInvisible
        || state?.u?.see_invisible);
    const visible = inSight && !monster.mundetected
        && (!monster.minvis || canSeeInvisible);
    const subject = `The ${MONSTER_NAME[monster.mnum]}`;
    const message = visible && monster.mcanmove !== 0
        ? monsterSpeedMessage(speed, subject) : null;
    return { message, oldSpeed: speed.oldSpeed, speed: speed.speed };
}

export function resolveDeferredHeroHasteSelf(action, state) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredHasteSelf) return null;
    const effect = monsterHasteSelfEffect(action.monster, state);
    attack.hasteSelf = effect;
    attack.deferredHasteSelf = false;
    return effect;
}

export function aggravateMonsters(
    state, random = rn2, calls = [],
) {
    const affected = [];
    for (const monster of state.level?.monsters || []) {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0) continue;
        const wasSleeping = !!monster.msleeping;
        const wasWaiting = !!((monster.mstrategy ?? 0)
            & (STRAT_WAITFORU | STRAT_APPEARMSG));
        monster.mstrategy = (monster.mstrategy ?? 0)
            & ~(STRAT_WAITFORU | STRAT_APPEARMSG);
        monster.msleeping = 0;
        let unfroze = false;
        if (monster.mcanmove === 0
            && recordRandom(random, calls, 5) === 0) {
            monster.mfrozen = 0;
            monster.mcanmove = 1;
            unfroze = true;
        }
        if (wasSleeping || wasWaiting || unfroze)
            affected.push(monster);
    }
    return affected;
}

export function resolveDeferredHeroAggravation(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredAggravation) return null;
    const affected = aggravateMonsters(
        state, random, action.calls,
    );
    attack.aggravatedMonsters = affected;
    attack.deferredAggravation = false;
    return affected;
}

// Resume a successful castmu(FALSE,FALSE) after its casting line has crossed
// the tty boundary.  The source effect can create actors, so it remains async
// and only then returns to dochug() for the second distfleeck/phase-four tail.
export async function resumeDeferredMovementSpell(
    action, state, random = rn2, rollOne = rnd, rollDice = d,
) {
    const movement = action?.movement;
    const spellCast = movement?.spellCast;
    if (!movement?.deferredAfterMovementSpell
        || !spellCast?.deferredSpellEffect) return null;

    let effect = { count: 0, created: [], message: null };
    if (spellCast.spell === 'summon-monsters') {
        effect = await monsterSummonSpellEffect(action.monster, state);
    } else if (spellCast.spell === 'haste-self') {
        effect = {
            ...effect,
            ...monsterHasteSelfEffect(action.monster, state),
        };
    } else if (spellCast.spell === 'disappear') {
        // C mcastu.c:mcast_disappear() makes invisibility permanent, repaints
        // the actor square, and leaves an invisible marker when the hero saw
        // the square but can no longer spot the caster.
        const monster = action.monster;
        const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
        const inSight = !blind
            && !!(state?.viz_array?.[monster.my]?.[monster.mx] & 0x2);
        const canSeeInvisible = !!(state?.u?.seeInvisible
            || state?.u?.see_invisible);
        const wasVisible = inSight && !monster.mundetected
            && (!monster.minvis || canSeeInvisible);
        setMonsterPermanentInvisibility(monster);
        newsym(monster.mx, monster.my);
        const stillVisible = inSight && !monster.mundetected
            && (!monster.minvis || canSeeInvisible);
        if (inSight && !stillVisible)
            map_invisible(monster.mx, monster.my);
        if (wasVisible) {
            effect.message = `The ${MONSTER_NAME[monster.mnum]} suddenly ${
                canSeeInvisible ? 'becomes transparent' : 'disappears'
            }!`;
        }
    } else {
        spellCast.unimplementedSpellEffect = true;
    }

    spellCast.deferredSpellEffect = false;
    movement.deferredAfterMovementSpell = false;
    movement.spellEffect = effect;
    finishDochugAfterMovement(
        action.monster, movement, state, random, rollOne, rollDice,
        action.calls,
    );
    return effect;
}

// C monmove.c:postmov() calls mdig_tunnel() after every successful move by
// a tunneling species.  mdig_tunnel() rolls the prospective debris pile
// before inspecting the destination, so an ordinary ROOM move still owns
// rnd(12) even though no terrain changes.
function monsterTunnelAfterMove(
    monster, movement, state, random, rollOne, calls,
) {
    if (!movement?.moved
        || !((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_TUNNEL)
        || state?.level?.flags?.rogue_level) return null;
    const pile = rollOne(12);
    calls.push('rnd(12)');
    movement.tunnelProbe = { pile };
    const loc = state?.level?.at?.(monster.mx, monster.my);
    if (loc && IS_WALL(loc.typ)
        && !((loc.wall_info ?? 0) & W_NONDIGGABLE)) {
        if (state?.flags?.verbose !== false) {
            const wallNoise = recordRandom(random, calls, 5);
            movement.tunnelProbe.wallNoise = wallNoise;
            if (wallNoise === 0)
                movement.tunnelProbe.crashingRockAudible = true;
        }
        if (state.level.flags?.is_maze_lev) {
            loc.typ = ROOM;
            loc.flags = 0;
        } else if (state.level.flags?.is_cavernous_lev
            && !state.level.flags?.town) {
            loc.typ = CORR;
            loc.flags = 0;
        } else {
            loc.typ = DOOR;
            loc.doormask = D_NODOOR;
        }
        vision_note_blocker_change(monster.mx, monster.my);
        if (state === game) newsym(monster.mx, monster.my);
    } else if (loc?.typ === STONE
        && !((loc.wall_info ?? 0) & W_NONDIGGABLE)) {
        loc.typ = CORR;
        loc.flags = 0;
        if (pile > 0 && pile < 5) {
            const debris = mksobj(pile === 1 ? BOULDER : ROCK, true, false);
            if (state === game) {
                place_object(debris, monster.mx, monster.my);
            } else {
                debris.ox = monster.mx;
                debris.oy = monster.my;
                debris.where = 'floor';
                if (!state.level.objects[monster.mx])
                    state.level.objects[monster.mx] = [];
                if (!state.level.objects[monster.mx][monster.my])
                    state.level.objects[monster.mx][monster.my] = [];
                state.level.objects[monster.mx][monster.my].unshift(debris);
            }
            movement.tunnelProbe.debris = debris;
        }
        vision_note_blocker_change(monster.mx, monster.my);
        if (state === game) newsym(monster.mx, monster.my);
    }
    return movement.tunnelProbe;
}

function maybeSpinMonsterWeb(monster, movement, state, random, rollDice, calls) {
    if (!movement?.moved || ![94, 96].includes(monster?.mnum)
        || monster.mcanmove === 0 || monster.msleeping || monster.mspec_used
        || trapAt(state, monster.mx, monster.my)) return null;

    // count_webbing_walls() deliberately checks only the four cardinal
    // anchors.  Diagonal rock can visually surround a spider without being
    // able to hold a web, and must not inflate the creation probability.
    const webbingWalls = [
        [monster.mx, monster.my - 1],
        [monster.mx + 1, monster.my],
        [monster.mx, monster.my + 1],
        [monster.mx - 1, monster.my],
    ].reduce((count, [x, y]) => count
        + (IS_OBSTRUCTED(state?.level?.at?.(x, y)?.typ) ? 1 : 0), 0);
    const existingWebs = (state?.level?.traps || [])
        .filter(trap => trap.ttyp === WEB).length;
    const probability = ((monster.mnum === 96 ? 15 : 5)
        * (webbingWalls + 1)) - (3 * existingWebs);
    const roll = recordRandom(random, calls, 1000);
    if (roll >= probability) return { roll, probability, created: false };

    const trap = {
        ttyp: WEB, tx: monster.mx, ty: monster.my, tseen: false,
    };
    if (!state.level.traps) state.level.traps = [];
    state.level.traps.push(trap);
    monster.mspec_used = rollDice(4, 4);
    calls.push('d(4,4)');
    return { roll, probability, created: true, trap };
}

function postMoveHideUnder(monster, movement, state, random, calls) {
    const hidesUnder = !!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_CONCEAL);
    const eel = MONSTER_SYMBOL[monster?.mnum] === S_EEL;
    if (!movement?.moved || (!hidesUnder && !eel)) return;
    const helpless = monster.mcanmove === 0 || monster.msleeping
        || (monster.mfrozen ?? 0) > 0 || monster.helpless;
    if (!monster.mundetected
        && (helpless || recordRandom(random, calls, 5) === 0)) return;
    const pile = state?.level?.objects?.[monster.mx]?.[monster.my] || [];
    const inPool = IS_POOL(state?.level?.at?.(monster.mx, monster.my)?.typ);
    const canHideUnderPile = hidesUnder && canMonsterHideUnderObjectAt(
        state, monster.mx, monster.my,
    );
    const oldUndetected = !!monster.mundetected;
    monster.mundetected = canHideUnderPile || (eel && inPool) ? 1 : 0;
    if (!monster.mundetected) return;

    const inSight = !state?.viz_array
        || !!(state.viz_array?.[monster.my]?.[monster.mx] & 0x2);
    const canSeeInvisible = !!(state?.u?.seeInvisible
        || state?.u?.see_invisible);
    // hideunder() snapshots canseemon() before changing mundetected.  An eel
    // which was already hidden remains unseen while renewing that state even
    // if its water square lies inside the geometric vision field.
    const seen = !oldUndetected
        && inSight && (!monster.minvis || canSeeInvisible);
    movement.hideUnder = {
        seen,
        object: canHideUnderPile ? pile[0] : null,
        under: eel ? 'the water' : null,
        verb: eel ? 'dive'
            : MONSTER_SYMBOL[monster.mnum] === S_SNAKE ? 'slither' : 'hide',
        oldUndetected,
    };
    if (seen) movement.deferredAfterHideUnder = true;
}

// C mon.c:maybe_unhide_at(), called immediately after place_monster().  A
// concealer which leaves its object (or an eel which leaves water) is exposed
// before postmov() decides whether to attempt hiding again.  That ordering is
// RNG-visible because a newly exposed actor reaches postmov's rn2(5).
function revealMonsterAfterLeavingHidingPlace(monster, movement, state) {
    if (!movement?.moved || !monster?.mundetected) return;
    const hidesUnder = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL);
    const eel = MONSTER_SYMBOL[monster.mnum] === S_EEL;
    if ((hidesUnder && !canMonsterHideUnderObjectAt(
        state, monster.mx, monster.my,
    )) || (eel && !IS_POOL(state?.level?.at?.(
        monster.mx, monster.my,
    )?.typ))) {
        monster.mundetected = 0;
    }
}

function finishDochugAfterMovement(
    monster, movement, state, random, rollOne, rollDice, calls,
) {
    if (!movement.deferredPostFlee)
        recordRandom(random, calls, 5); // distfleeck() after movement
    // m_move() maps a successful defensive escape action to MMOVE_DONE.
    // dochug() still owns the trailing distfleeck(), then suppresses phase
    // four for this actor.
    if (movement.actionCompleted) return;
    if (!movement.deferredPostFlee && !movement.pickupConsumedAction) {
        // dochug() only returns immediately for MMOVE_MOVED when the actor is
        // now adjacent.  MMOVE_NOTHING instead falls through phase four, so
        // an adjacent wanderer which entered m_move() but stayed on its old
        // square still receives its ordinary mattacku() sequence.
        const targetX = Number.isFinite(monster?.mux)
            ? monster.mux : state?.u?.ux ?? movement?.x;
        const targetY = Number.isFinite(monster?.muy)
            ? monster.muy : state?.u?.uy ?? movement?.y;
        const dx = (monster?.mx ?? movement?.x ?? 0) - targetX;
        const dy = (monster?.my ?? movement?.y ?? 0) - targetY;
        const adjacent = Math.abs(dx) <= 1 && Math.abs(dy) <= 1
            && !(monster?.mnum === 116 && dx !== 0 && dy !== 0);
        const hostile = !monster?.mpeaceful && !monster?.pet
            && !monster?.mtame;
        if (!movement.moved && !movement.eating && !movement.attack
            && adjacent && hostile && !heroHasConflict(state)) {
            if (state?.u?.uswallow && state.u.ustuck !== monster) {
                movement.swallowedAttackSkipped = true;
            } else {
                const phaseFour = beginHeroAttackOrStrikingWand(
                    monster, state, random, rollOne, rollDice, calls,
                );
                if (phaseFour.offensiveWand) {
                    movement.offensiveWand = phaseFour.offensiveWand;
                    movement.actionCompleted = true;
                } else if (phaseFour.attack?.kind === 'monster-wield') {
                    movement.wieldedWeapon = phaseFour.attack.weapon;
                    movement.deferredHeroWield = {
                        attackIndex: phaseFour.attack.attackIndex,
                        threshold: phaseFour.attack.threshold,
                    };
                } else {
                    movement.attack = phaseFour.attack;
                }
            }
            return;
        }
        // C dochug() does not return immediately after MMOVE_MOVED when a
        // distant actor has a natural ranged attack, a weapon attack, or an
        // offensive inventory action.  The first two predicates short
        // circuit; otherwise find_offensive() reaches lined_up() before it
        // scans inventory. That probe remains RNG-visible for a concealed
        // polymorphed hero even when an empty-handed actor has no offensive
        // action.
        const postMoveTargetX = Number.isFinite(monster?.mux)
            ? monster.mux : state?.u?.ux ?? movement?.x;
        const postMoveTargetY = Number.isFinite(monster?.muy)
            ? monster.muy : state?.u?.uy ?? movement?.y;
        const postMoveNearby = Math.abs(
            (monster?.mx ?? movement?.x) - postMoveTargetX,
        ) <= 1 && Math.abs(
            (monster?.my ?? movement?.y) - postMoveTargetY,
        ) <= 1;
        const flags1 = MONSTER_FLAGS1[monster?.mnum] ?? 0;
        const canProbeOffensiveInventory = movement?.moved
            && !postMoveNearby
            && !monsterHasAvailableDistanceAttack(monster)
            && !monsterHasWeaponAttack(monster)
            && !monster?.mpeaceful && !monster?.pet && !monster?.mtame
            && !(flags1 & (M1_ANIMAL | M1_MINDLESS | M1_NOHANDS))
            && !state?.u?.uswallow;
        if (canProbeOffensiveInventory)
            hostileLinedUp(monster, state, random, calls);
        distantPhaseFourAttackSetup(
            monster, movement, state, random, rollOne, calls,
        );
        if (movement.phaseFourOffensiveEvaluated) {
            const offensive = maybeBeginOffensiveWand(
                monster, state, random, calls,
                { linedUp: movement.phaseFourOffensiveLinedUp },
            );
            if (offensive.action) {
                movement.offensiveWand = offensive.action;
                movement.actionCompleted = true;
                return;
            }
        }
        const offensivePotion = maybeThrowOffensiveSleepingPotion(
            monster, movement, state, random, rollOne, calls,
        );
        if (offensivePotion) {
            movement.offensivePotion = offensivePotion;
            return;
        }
        const breathAttack = maybeBreatheAtHero(
            monster, movement, state, random, rollOne, calls,
        );
        if (breathAttack) movement.breathAttack = breathAttack;
        const spitAttack = maybeSpitAtHero(
            monster, movement, state, random, rollOne, calls,
        );
        if (spitAttack) movement.spitAttack = spitAttack;
        const rangedAttack = maybeThrowRangedWeapon(
            monster, movement, state, random, rollOne, calls,
        );
        if (rangedAttack?.wieldedWeapon)
            movement.wieldedWeapon = rangedAttack.wieldedWeapon;
        else if (rangedAttack) movement.rangedAttack = rangedAttack;
    }
}

// C monmove.c:dochug() lets MMOVE_NOTHING fall through to phase-four
// mattacku() whenever the actor remains in range.  Only MMOVE_MOVED applies
// the extra natural-ranged/weapon/offensive-item continuation gate.
// mattacku() evaluates AC_VALUE() before selecting the concrete attack slot,
// so even a stationary distant melee-only actor owns this draw before all of
// its concrete attack slots reject the distance.
function distantPhaseFourAttackSetup(
    monster, movement, state, random, rollOne, calls,
) {
    if (!reachesDistantPhaseFour(monster, movement, state)
        || (movement.moved
            && !monsterHasAvailableDistanceAttack(monster)
            && !monsterHasWeaponAttack(monster))) return;
    if (!movement.phaseFourArmorClassEvaluated) {
        sourceHeroArmorClass(state, rollOne, calls);
        movement.phaseFourArmorClassEvaluated = true;
    }
    // mhitu.c:mattacku() calls find_offensive() after evaluating AC and
    // before entering the six-slot attack table.  Natural-ranged and AT_WEAP
    // actors reach phase four without the earlier m_move() item probe, so a
    // concealed polymorphed hero makes this m_lined_up() call RNG-visible
    // even when the monster carries no usable offensive object.
    const flags1 = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (!movement.phaseFourOffensiveEvaluated
        && !monster?.mpeaceful && !state?.u?.uswallow
        && !(flags1 & (M1_ANIMAL | M1_MINDLESS | M1_NOHANDS))) {
        movement.phaseFourOffensiveLinedUp = hostileLinedUp(
            monster, state, random, calls,
        );
        movement.phaseFourOffensiveEvaluated = true;
    }
}

// Complete the portion of m_move()/postmov()/dochug() which follows an
// ordinary hostile or pet destination choice. Message-producing movement
// can resume here without repeating set_apparxy(), species checks, or path
// selection.
function completeMovedMonsterAction(
    monster, movement, state, random, rollDice, rollOne, calls,
    { trapAlreadyHandled = false } = {},
) {
    revealMonsterAfterLeavingHidingPlace(monster, movement, state);
    if (!movement.swallowedHold)
        handleMonsterDoor(monster, state, movement, rollOne, calls);
    if (!movement.doorMessagePresented
        && (movement.openedDoor || movement.doorExplosion)) {
        // C postmov() publishes UnblockDoor/mb_trapped feedback before trap,
        // tunneling, pickup, concealment, and dochug()'s trailing
        // distfleeck().  A full older topline can therefore split this exact
        // actor after the door state change but before any of those tails.
        movement.deferredAfterDoorMessage = true;
        return movement;
    }
    // dog_move() reports MMOVE_MOVED even when candidate selection leaves
    // a pet on its original square, so postmov() still rechecks a trap there.
    if (!trapAlreadyHandled && !movement.swallowedHold
        && (movement.moved || monster?.pet || monster?.mtame))
        triggerMonsterTrap(
            monster, state, movement, random, rollDice, rollOne, calls,
        );
    if (movement.deferredAfterMonsterTrap) return movement;
    // postmov() maps both a trap-killed actor and an actor moved off-level to
    // an immediate terminal result.  Neither reaches tunneling, pickup,
    // concealment, the second distfleeck(), or phase-four attacks.
    if (movement.actorLeftLevel || movement.actorDied) return movement;
    if (movement.actionCompleted) {
        if (movement.itemGoalUnderfoot
            && !movement.swallowedHold && !monster?.pet && !monster?.mtame) {
            const pickedUp = pickUpMonsterFloorObject(monster, state);
            if (pickedUp) {
                movement.pickedUpHostile = pickedUp;
                movement.pickupConsumedAction = true;
                movement.deferredAfterPickupMessage = true;
                return movement;
            }
        }
        // dochug() recomputes distfleeck() for every non-died m_move status,
        // including MMOVE_DONE, before its switch suppresses phase four.
        finishDochugAfterMovement(
            monster, movement, state, random, rollOne, rollDice, calls,
        );
        return movement;
    }
    if (!movement.swallowedHold)
        monsterTunnelAfterMove(
            monster, movement, state, random, rollOne, calls,
        );
    if (!movement.swallowedHold && !monster?.pet && !monster?.mtame) {
        const pickedUp = pickUpMonsterFloorObject(monster, state);
        if (pickedUp) {
            movement.pickedUpHostile = pickedUp;
            movement.pickupConsumedAction = true;
            // C mpickstuff() emits its visible pickup line before it returns
            // to m_move().  maybe_spin_web(), concealment, and dochug()'s
            // trailing distfleeck therefore belong after that tty boundary.
            movement.deferredAfterPickupMessage = true;
            return movement;
        }
    }
    if (!movement.swallowedHold)
        maybeSpinMonsterWeb(
            monster, movement, state, random, rollDice, calls,
        );

    // monmove.c:postmov() completes conceal/eel hiding before returning to
    // dochug(); the latter's second distfleeck and phase-four attacks follow.
    postMoveHideUnder(monster, movement, state, random, calls);
    if (!movement.deferredAfterHideUnder
        && !movement.deferredAfterMovementSpell
        && !movement.deferredAfterBearTrapMessage)
        finishDochugAfterMovement(
            monster, movement, state, random, rollOne, rollDice, calls,
        );
    return movement;
}

function continueAfterMonsterTrap(
    action, state, random, rollDice, rollOne, calls,
) {
    if (action.movement?.immediateTrap) return action;
    completeMovedMonsterAction(
        action.monster, action.movement, state,
        random, rollDice, rollOne, calls,
        { trapAlreadyHandled: true },
    );
    return action;
}

export async function resumeDeferredMonsterTrap(
    action, state, {
        random = rn2,
        rollDice = d,
        rollOne = rnd,
        publish = plineWithContinuation,
        monsterName,
        describeMonster,
        revealTrap,
    } = {},
) {
    const movement = action?.movement;
    const event = movement?.trap;
    if (!movement?.deferredAfterMonsterTrap) return action;
    delete movement.deferredAfterMonsterTrap;

    const calls = action.calls || DISCARDED_CALL_LOG;
    const finishDeath = (monster, options) =>
        finishEnvironmentalMonsterDeath(monster, state, options);
    const recordedRandom = range => recordRandom(random, calls, range);
    const recordedRollOne = range => {
        const result = rollOne(range);
        calls.push(`rnd(${range})`);
        return result;
    };

    switch (event?.kind) {
    case 'projectile-trap':
    case 'spent-projectile-trap':
        await finishMonsterProjectileTrap(
            action.monster, event, state, {
                finishDeath,
                publish,
                random,
                rollOne: recordedRollOne,
                describeMonster,
            },
        );
        break;
    case 'anti-magic-drain':
    case 'anti-magic-damage': {
        const death = await finishMonsterAntiMagicTrap(
            action.monster, event, {
                finishDeath,
                random,
                publish,
                describeMonster,
            },
        );
        if (death) {
            event.death = death;
            if (death.survived) {
                event.killed = false;
                movement.actorDied = false;
                movement.actionCompleted = false;
            }
        }
        break;
    }
    case 'fire-trap':
        await finishMonsterFireTrap(action.monster, event, state, {
            finishDeath,
            publish,
            random,
            rollOne,
            monsterName,
            describeMonster,
        });
        break;
    case 'land-mine':
        await finishMonsterLandMine(action.monster, event, state, {
            finishDeath,
            publish,
            random: recordedRandom,
            rollOne: recordedRollOne,
            monsterName,
            describeMonster,
        });
        break;
    case 'pit-trap':
        await finishMonsterPitTrap(action.monster, event, {
            finishDeath,
            publish,
            random,
            rollOne: recordedRollOne,
            describeMonster,
            state,
        });
        break;
    case 'falling-rock':
    case 'spent-rock-trap':
        await finishMonsterRockTrap(action.monster, event, state, {
            finishDeath,
            publish,
            random,
            monsterName,
            describeMonster,
        });
        break;
    case 'sleep-gas':
        await finishMonsterSleepGasTrap(action.monster, event, {
            publish,
            describeMonster,
        });
        break;
    case 'squeaky-board':
        await finishMonsterSqueakyBoard(action.monster, event, state, {
            publish,
            monsterName,
            describeMonster,
        });
        break;
    case 'vibrating-square':
        await finishMonsterVibratingSquare(action.monster, event, {
            publish,
            describeMonster,
            revealTrap,
        });
        break;
    case 'polymorph-trap':
        await finishMonsterPolymorphTrap(event, {
            finishDeath,
            publish,
            revealTrap,
            rollOne: recordedRollOne,
            state,
        });
        break;
    default:
        throw new Error(`Unknown deferred monster trap: ${event?.kind}`);
    }

    if (event.killed) {
        movement.actorDied = true;
        movement.actionCompleted = true;
        return action;
    }
    continueAfterMonsterTrap(
        action, state, random, rollDice, rollOne, calls,
    );
    return action;
}

export function resumeDeferredMonsterDoor(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const movement = action?.movement;
    if (!movement?.deferredAfterDoorMessage) return action;
    delete movement.deferredAfterDoorMessage;
    movement.doorMessagePresented = true;
    completeMovedMonsterAction(
        action.monster, movement, state, random, rollDice, rollOne,
        action.calls,
    );
    return action;
}

// Resume m_move() immediately after mpickstuff() has crossed its optional
// visible pline.  Invisible/non-verbose pickup reaches this continuation in
// the same capture; a full topline can suspend before any of this tail runs.
export function resumeDeferredMonsterPickup(
    action, state, random = rn2, rollOne = rnd, rollDice = d,
) {
    const movement = action?.movement;
    if (!movement?.deferredAfterPickupMessage) return action;
    delete movement.deferredAfterPickupMessage;
    maybeSpinMonsterWeb(
        action.monster, movement, state, random, rollDice, action.calls,
    );
    postMoveHideUnder(
        action.monster, movement, state, random, action.calls,
    );
    if (!movement.deferredAfterHideUnder
        && !movement.deferredAfterMovementSpell
        && !movement.deferredAfterBearTrapMessage) {
        finishDochugAfterMovement(
            action.monster, movement, state, random, rollOne, rollDice,
            action.calls,
        );
    }
    return action;
}

// First non-combat slice of monmove.c:dochug(), m_move(), and dog_move().
// distfleeck() always draws the brave-gremlin roll; ordinary starting actors
// then choose and own a live adjacent destination before the post-move draw.
export function quietMonsterActionRng(
    monster, state, random = rn2, rollDice = d, rollOne = rnd,
    options = {},
) {
    const calls = DISCARDED_CALL_LOG;
    if (!options.afterCovetousRelocation) {
        // monmove.c:dochug() erodes text beneath every awake, mobile actor
        // before confusion/fleeing checks and the first set_apparxy().
        wipeEngravingAt(monster.mx, monster.my, 1, false, state?.level);
        // Status recovery and fleeing checks happen before movement. Do not
        // repeat them when a message pauses a later covetous relocation.
        if (monster.mconf && recordRandom(random, calls, 50) === 0)
            monster.mconf = 0;
        if (monster.mstun && recordRandom(random, calls, 10) === 0)
            monster.mstun = 0;
        if (monster.mflee) {
            const teleports = recordRandom(random, calls, 40) === 0
                && !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_TPORT)
                && !monster.iswiz
                && !monsterTeleportRestricted(monster, state);
            if (teleports) {
                const relocation = randomMonsterRelocation(
                    monster, state, calls, random, rollOne,
                );
                return {
                    calls,
                    movement: relocation ? {
                        ...relocation,
                        deferredFleeingRelocation: true,
                        fleeingRelocation: { appearMessage: false },
                    } : {
                        oldx: monster.mx, oldy: monster.my,
                        x: monster.mx, y: monster.my, moved: false,
                        fleeingTeleportFailed: true,
                    },
                };
            }
            if (!(monster.mfleetim ?? 0)
                && (monster.mhp ?? 0) === (monster.mhpmax ?? 0)
                && recordRandom(random, calls, 25) === 0) {
                monster.mflee = 0;
            }
        }
    }
    setMonsterApparentHeroPosition(monster, state, random, calls);
    if (!options.afterCovetousRelocation) {
        const pickedCovetousTarget = covetousPicksUpTargetUnderfoot(
            monster, state,
        );
        const tacticsMovement = pickedCovetousTarget ? null
            : runCovetousHarassTactics(
                monster, state, random, calls,
            );
        if (tacticsMovement) return { calls, movement: tacticsMovement };
        if (monsterIsCovetous(monster))
            setMonsterApparentHeroPosition(monster, state, random, calls);
    }
    recordRandom(random, calls, 5); // distfleeck() before movement
    const apparentX = Number.isFinite(monster?.mux)
        ? monster.mux : state?.u?.ux ?? monster?.mx ?? 0;
    const apparentY = Number.isFinite(monster?.muy)
        ? monster.muy : state?.u?.uy ?? monster?.my ?? 0;
    const dx = (monster?.mx ?? 0) - apparentX;
    const dy = (monster?.my ?? 0) - apparentY;
    const miscItem = useMonsterMiscItem(monster, state, random, calls);
    if (miscItem) {
        return {
            calls,
            movement: {
                oldx: monster.mx, oldy: monster.my,
                x: monster.mx, y: monster.my, moved: false,
                usedMisc: miscItem,
            },
        };
    }
    watchOnDutyRng(monster, state, random, calls);
    const wieldedWeapon = readyCloseMonsterWeapon(monster, state);
    if (wieldedWeapon) {
        return {
            calls,
            movement: {
                oldx: monster.mx, oldy: monster.my,
                x: monster.mx, y: monster.my, moved: false,
                wieldedWeapon,
            },
        };
    }
    // monnear(): grid bugs cannot reach or attack a diagonal target.  They
    // must enter m_move() first, which can place them in the hero's path and
    // stop an active run before the next hero step.
    const nearby = Math.abs(dx) <= 1 && Math.abs(dy) <= 1
        && !(monster?.mnum === 116 && dx !== 0 && dy !== 0);
    // dochug() tests an adjacent invisible actor's one-in-three movement
    // opportunity before the leprechaun, wanderer, conflict, blindness, and
    // peaceful clauses.  A nonzero draw falls through to phase-four attack.
    let invisibleMoves = false;
    if (nearby && !monster.mflee && !monster.mconf && !monster.mstun
        && monster.minvis) {
        invisibleMoves = recordRandom(random, calls, 3) === 0;
    }
    // dochug(): the wanderer roll is evaluated before the final peaceful
    // clause. A tame pony still enters dog_move() when this roll is nonzero,
    // but the draw itself remains observable whenever it is next to the hero.
    let wandererMoves = false;
    if (nearby && !monster.mflee && !monster.mconf && !monster.mstun
        && !invisibleMoves
        && ((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_WANDER)) {
        // monmove.c:dochug() puts `is_wanderer() && !rn2(4)` in the
        // movement predicate.  A zero therefore sends an adjacent hostile
        // through m_move() instead of falling through to mattacku().
        wandererMoves = recordRandom(random, calls, 4) === 0;
    }
    // m_move() handles an eating monster before pet-special movement.  The
    // outer dochug() checks have already run, and it still performs the
    // second distfleeck() after decrementing the meal timer.
    if (monster.meating > 0) {
        monster.meating--;
        recordRandom(random, calls, 5);
        return {
            calls,
            movement: {
                oldx: monster.mx, oldy: monster.my,
                x: monster.mx, y: monster.my, moved: false, eating: true,
            },
        };
    }
    // A nearby hostile which is otherwise able to fight bypasses m_move()
    // and its second distfleeck(), then reaches dochug() phase four. Peaceful
    // pets still enter dog_move(), including its pre-move mintrap check.
    if (nearby && !monster?.pet && !monster?.mtame && !monster?.mpeaceful
        && !monster?.mflee && !monster?.mconf && !monster?.mstun
        && !invisibleMoves && !wandererMoves && !heroHasConflict(state)) {
        if (state?.u?.uswallow && state.u.ustuck !== monster) {
            // mhitu.c:mattacku() computes its non-random range state, then
            // returns immediately: only u.ustuck can affect a swallowed hero.
            // This is an attack-entry gate, so there is no second distfleeck.
            return {
                calls,
                movement: {
                    oldx: monster.mx, oldy: monster.my,
                    x: monster.mx, y: monster.my, moved: false,
                    swallowedAttackSkipped: true,
                },
            };
        }
        const phaseFour = beginHeroAttackOrStrikingWand(
            monster, state, random, rollOne, rollDice, calls,
        );
        const movement = {
            oldx: monster.mx, oldy: monster.my,
            x: monster.mx, y: monster.my, moved: false,
        };
        if (phaseFour.offensiveWand) {
            movement.offensiveWand = phaseFour.offensiveWand;
            movement.actionCompleted = true;
        } else if (phaseFour.attack?.kind === 'monster-wield') {
            movement.wieldedWeapon = phaseFour.attack.weapon;
            movement.deferredHeroWield = {
                attackIndex: phaseFour.attack.attackIndex,
                threshold: phaseFour.attack.threshold,
            };
        } else {
            movement.attack = phaseFour.attack;
        }
        return {
            calls,
            movement,
        };
    }

    // Peaceful actors always enter dochug()'s movement branch.  Before
    // m_move(), every clerical/wizard magic attack gets one opportunity to
    // choose an undirected spell.  The Pri-strt guardians and leader are at
    // full health, so all selected spells are rejected and movement follows.
    const movementSpell = movementSpellSelections(
        monster, state, random, calls,
    );

    let trapRelease = null;
    let movement = movementSpell?.cast ? {
        oldx: monster.mx, oldy: monster.my,
        x: monster.mx, y: monster.my, moved: false,
        spellCast: movementSpell,
        deferredAfterMovementSpell: true,
    } : null;
    if (!movement && monster.mtrapped) {
        trapRelease = releaseFromMonsterTrap(monster, state, random, calls);
        if (trapRelease.held) {
            movement = {
                oldx: monster.mx, oldy: monster.my,
                x: monster.mx, y: monster.my, moved: false,
                trapped: true,
            };
        }
    }
    // monmove.c:m_move() lets a conceal-capable actor retain a valid
    // floor-object hiding place before visibility setup or destination
    // selection.  MMOVE_NOTHING still returns to dochug(), which performs
    // its trailing distfleeck() and may subsequently attack.
    if (!movement
        && ((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_CONCEAL)
        && canMonsterHideUnderObjectAt(
            state, monster.mx, monster.my,
        )
        && recordRandom(random, calls, 10) !== 0) {
        movement = {
            oldx: monster.mx, oldy: monster.my,
            x: monster.mx, y: monster.my, moved: false,
            retainedHidingPlace: true,
        };
    }
    if (!movement) {
        if (monster?.pet || monster?.mtame) {
            movement = movePet(
                monster, state, random, rollDice, rollOne, calls,
            );
            // dog_move() reports MMOVE_MOVED after ordinary destination
            // selection even when the selected coordinate is the origin.
            // Keep that source status separate from actual displacement:
            // postmov() still owns its old/destination redraws and trap
            // check, while movement-only door and tracking branches do not.
            if (!movement.deferredPetMove
                && !movement.deferredPetEating
                && !movement.deferredPetRangedNoise
                && !movement.petBreath?.launched
                && !movement.spitAttack?.launched
                && !movement.rangedAttacks?.length
                && !movement.actorDied && !movement.actorLeftLevel)
                movement.petPostmov = true;
        } else if (monster?.isgd && monster?._egd) {
            movement = moveVaultGuard(monster, state, random, calls);
        } else {
            // C dochug(): Conflict gives every ordinary hostile its own
            // resistance check before m_move(), even with nothing to attack.
            movement = moveHostile(
                monster, state, random, rollDice, rollOne, calls,
            );
        }
        if (trapRelease?.escaped) movement.trapEscape = trapRelease;
        if (movement.deferredPetMove
            || movement.deferredPetEating
            || movement.deferredPetRangedNoise
            || movement.petBreath?.launched
            || movement.spitAttack?.launched
            || movement.rangedAttacks?.length
            || movement.deferredAfterRestrictedTenguTeleport)
            return { calls, movement };
        completeMovedMonsterAction(
            monster, movement, state, random, rollDice, rollOne, calls,
        );
        return { calls, movement };
    }
    // monmove.c:postmov() completes conceal/eel hiding before returning to
    // dochug(); the latter's second distfleeck and phase-four attacks follow.
    postMoveHideUnder(monster, movement, state, random, calls);
    if (!movement.deferredAfterHideUnder
        && !movement.deferredAfterMovementSpell
        && !movement.deferredAfterBearTrapMessage)
        finishDochugAfterMovement(
            monster, movement, state, random, rollOne, rollDice, calls,
        );
    return { calls, movement };
}

// Resume m_move() immediately after tele_restrict() has emitted the visible
// failed-teleport line.  The same actor still owns ordinary destination
// selection, postmov(), the second distfleeck(), and any phase-four attack.
export function resumeDeferredRestrictedTenguTeleport(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const deferred = action?.movement;
    if (!deferred?.deferredAfterRestrictedTenguTeleport) return action;
    const movement = moveHostile(
        action.monster, state, random, rollDice, rollOne, action.calls,
        { afterRestrictedTenguTeleport: true },
    );
    if (deferred.trapEscape) movement.trapEscape = deferred.trapEscape;
    action.movement = movement;
    completeMovedMonsterAction(
        action.monster, movement, state, random, rollDice, rollOne,
        action.calls,
    );
    return action;
}

// Resume dochug() after rloc_to_core() has tried to emit the covetous
// monster's arrival line.  pline() can suspend there on an older topline, so
// the second set_apparxy(), distfleeck(), and contact attack must remain
// unconsumed until the tty pager is dismissed.
export function resumeDeferredCovetousRelocation(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    if (!action?.movement?.deferredCovetousRelocation) return action;
    const continuation = quietMonsterActionRng(
        action.monster, state, random, rollDice, rollOne,
        { afterCovetousRelocation: true },
    );
    action.calls.push(...continuation.calls);
    action.movement = continuation.movement;
    return action;
}

export function resumeDeferredMonsterHideUnder(
    action, state, random = rn2, rollOne = rnd, rollDice = d,
) {
    const movement = action?.movement;
    if (!movement?.deferredAfterHideUnder) return action;
    delete movement.deferredAfterHideUnder;
    finishDochugAfterMovement(
        action.monster, movement, state, random, rollOne, rollDice,
        action.calls,
    );
    return action;
}

export function resumeDeferredMonsterStrikingWand(
    action, state, random = rn2, rollOne = rnd,
) {
    const offensive = action?.movement?.offensiveWand;
    if (offensive?.kind !== 'offensive-wand-striking'
        || !offensive.deferredEffect) return null;

    offensive.deferredEffect = false;
    offensive.object.spe = Math.max(0, (offensive.object.spe ?? 1) - 1);
    offensive.range = 6 + recordRandom(random, action.calls, 8);

    // zap.c:bhit() follows sign(mux-mx),sign(muy-my), not a recomputed line
    // to the live hero. A false-target ray can cross ordinary floor objects
    // before a wall. Each one reaches
    // bhito()->breaks()->breaktest()->obj_resists(); the nonzero rolls leave
    // those non-breakable objects intact, while an occupied square shortens
    // the remaining ray by one.  Direct adjacent hero rays retain the
    // established contact owner below.
    if (!offensive.heroTarget) {
        let x = action.monster.mx;
        let y = action.monster.my;
        let remaining = offensive.range;
        offensive.rayPath = [];
        while (remaining-- > 0) {
            x += offensive.rayDx;
            y += offensive.rayDy;
            if (!isok(x, y)) break;
            offensive.rayPath.push({ x, y });

            const pile = state?.level?.objects?.[x]?.[y] || [];
            let pileAffected = false;
            for (const object of pile) {
                if (objectResistsWithoutRoll(object)) {
                    pileAffected = true;
                    continue;
                }
                recordRandom(random, action.calls, 100);
                // TODO: break eligible floor objects after a failed resist.
                pileAffected = true;
            }
            if (pileAffected) remaining--;
            if (lineBlockingTerrain(state, x, y)) break;
        }
        return offensive;
    }

    // The supported live rays reach the adjacent hero first.  Resistance is
    // resolved here rather than used as a find_offensive() eligibility gate.
    // A non-resistant first shot still consumes the mbhitm() to-hit roll but
    // is forced to miss until the attacker gains wand experience.
    if (offensive.heroMagicResistance) {
        action.monster.seenMagicResistance = true;
        offensive.message = 'Boing!';
        offensive.identifiesType = true;
    } else {
        const experienced = !!action.monster.mwandexp;
        offensive.attackRoll = rollOne(20);
        action.calls.push('rnd(20)');
        const armorClass = state?.u?.uac ?? 10;
        offensive.hit = experienced
            && offensive.attackRoll < 10 + armorClass;
        if (offensive.hit) {
            offensive.message = 'The wand hits you!';
            // muse.c:mbhitm() emits the hit line before d(2,12) and
            // losehp().  A full tty topline can therefore suspend this
            // source stack with the old HP row still painted.
            offensive.deferredHitDamage = true;
            offensive.identifiesType = false;
        } else {
            offensive.message = 'The wand misses you.';
            offensive.identifiesType = false;
        }
    }
    return offensive;
}

export function resumeDeferredMonsterMagicMissileWand(
    action, state, random = rn2,
) {
    const offensive = action?.movement?.offensiveWand;
    if (offensive?.kind !== 'offensive-wand-magic-missile'
        || !offensive.deferredEffect) return null;

    offensive.deferredEffect = false;
    offensive.object.spe = Math.max(0, (offensive.object.spe ?? 1) - 1);
    offensive.range = 7 + recordRandom(random, action.calls, 7);
    return offensive;
}

export function resolveMonsterMagicMissileContact(
    action, target, state, random = rn2, rollOne = rnd, rollDice = d,
) {
    const hit = fireRayHits(
        target, state, random, rollOne, action.calls,
    );
    let damage = 0;
    if (hit) {
        damage = rollDice(2, 6);
        action.calls.push('d(2,6)');
        target.mhp = Math.max(0, (target.mhp ?? 1) - damage);
    }
    return { target, hit, damage, killed: hit && target.mhp <= 0 };
}

export function finishMonsterMagicMissileDeath(
    action, target, state, random = rn2,
) {
    finishRangedKilledMonster(target, state, random, action.calls);
    return target;
}

export function beginHeroMagicMissileContact(
    action, state, random = rn2, rollOne = rnd,
) {
    return fireRayHits(
        state.u, state, random, rollOne, action.calls,
    );
}

export function finishHeroMagicMissileDamage(
    action, state, rollDice = d,
) {
    let damage = rollDice(2, 6);
    action.calls.push('d(2,6)');
    if (state?.u?.halfSpellDamage || state?.u?.half_spell_damage)
        damage = Math.trunc((damage + 1) / 2);
    state.u.uhp = Math.max(0, (state.u.uhp ?? 1) - damage);
    return damage;
}

// Resume muse.c:mbhitm() after "The wand hits you!" has crossed any tty
// continuation boundary.  Fatal losehp() never returns to mbhitm(), so only
// a surviving impact reaches learnit and identifies the striking wand.
export function finishDeferredMonsterStrikingWandHit(
    action, state, rollDice = d,
) {
    const offensive = action?.movement?.offensiveWand;
    if (offensive?.kind !== 'offensive-wand-striking'
        || !offensive.deferredHitDamage) return offensive || null;

    delete offensive.deferredHitDamage;
    offensive.damage = rollDice(2, 12);
    action.calls.push('d(2,12)');
    if (state?.u?.halfSpellDamage
        || state?.u?.half_spell_damage) {
        offensive.damage = Math.trunc((offensive.damage + 1) / 2);
    }
    offensive.preHitHp = state.u.uhp ?? 1;
    state.u.uhp = Math.max(0, offensive.preHitHp - offensive.damage);
    offensive.fatal = state.u.uhp < 1;
    offensive.identifiesType = !offensive.fatal;
    return offensive;
}

// Resume visible bear-trap handling after its caught message has crossed tty.
// Source sets mtrapped before pline(), then seetrap(), damage, and dochug's
// trailing distfleeck() occur only after the acknowledgement returns.
export function resumeDeferredMonsterBearTrap(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const movement = action?.movement;
    const event = movement?.trap;
    if (!movement?.deferredAfterBearTrapMessage
        || event?.kind !== 'bear-trap' || !event.deferredDamage) return action;
    delete movement.deferredAfterBearTrapMessage;
    event.deferredDamage = false;
    event.trap.tseen = true;
    const damage = rollDice(2, 4);
    action.calls.push('d(2,4)');
    action.monster.mhp = Math.max(0, (action.monster.mhp ?? 1) - damage);
    event.damage = damage;
    event.killed = action.monster.mhp <= 0;
    if (!movement.immediateTrap) {
        finishDochugAfterMovement(
            action.monster, movement, state, random, rollOne, rollDice,
            action.calls,
        );
    }
    return action;
}

// Resume a visible rolling boulder after tty has installed its hit/miss and
// optional kill lines.  ohitmon() has already consumed hit/damage RNG and
// reduced HP; fatal detach/corpse work precedes launch_obj() continuing the
// free in-flight boulder to its opposite endpoint.
export function resumeDeferredMonsterRollingBoulderDeath(
    action, state, random = rn2,
) {
    const movement = action?.movement;
    const event = movement?.trap;
    if (event?.kind !== 'rolling-boulder' || !event.released) return action;
    if (movement?.deferredAfterRollingBoulderMessage
        && event.deferredDeath) {
        delete movement.deferredAfterRollingBoulderMessage;
        event.deferredDeath = false;
        detachDeadMonster(action.monster, state);
        const corpse = createOrdinaryMonsterCorpse(
            action.monster, state, random, action.calls,
        );
        event.death = { corpseCreated: !!corpse, corpse };
    }
    return action;
}

export function resumeDeferredMonsterRustTrap(
    action, state, random = rn2,
) {
    const movement = action?.movement;
    const event = movement?.trap;
    if (!movement?.deferredAfterRustTrapMessage
        || event?.kind !== 'rust-trap' || !event.killed) return action;
    delete movement.deferredAfterRustTrapMessage;
    detachDeadMonster(action.monster, state);
    const corpse = createOrdinaryMonsterCorpse(
        action.monster, state, random, action.calls || DISCARDED_CALL_LOG,
    );
    event.death = { corpseCreated: !!corpse, corpse };
    return action;
}

// launch_obj() keeps rolling after ohitmon() returns.  Endpoint placement is
// later than death/corpse resolution and every remaining per-cell delay.
export function finishDeferredMonsterRollingBoulderPlacement(action, state) {
    const movement = action?.movement;
    const event = movement?.trap;
    if (event?.kind !== 'rolling-boulder' || !event.released) return action;
    if (event.deferredPlacement) {
        event.deferredPlacement = false;
        event.boulder = placeAndStackTrapMissile(
            event.boulder, state, event.endpoint.x, event.endpoint.y,
        );
        if (state === game)
            vision_note_blocker_change(event.endpoint.x, event.endpoint.y);
    }
    return action;
}

export function resumeDeferredMonsterRollingBoulder(
    action, state, random = rn2,
) {
    resumeDeferredMonsterRollingBoulderDeath(action, state, random);
    return finishDeferredMonsterRollingBoulderPlacement(action, state);
}

export function resumeDeferredPetRangedNoise(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const deferred = action?.movement;
    if (!deferred?.deferredPetRangedNoise) return action;
    const monster = action.monster;
    const movement = finishPetMovePlan(
        monster, state, deferred.petMovePlan,
        random, rollDice, rollOne, action.calls,
    );
    if (!movement.actorDied && !movement.actorLeftLevel)
        movement.petPostmov = true;
    action.movement = movement;
    completeMovedMonsterAction(
        monster, movement, state, random, rollDice, rollOne, action.calls,
    );
    return action;
}

// Resume dog_move() after dog_invent() has committed and tty has had the
// chance to acknowledge its pickup/drop message.  C remains inside the same
// actor transaction here: dog_goal(), destination choice, postmov(), the
// second distfleeck(), and any ranged action all occur after that boundary.
export function resumeDeferredPetMove(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    if (!action?.movement?.deferredPetMove) return action;
    const monster = action.monster;
    const calls = action.calls;
    const movement = movePet(
        monster, state, random, rollDice, rollOne, calls, true,
    );
    if (!movement.actorDied && !movement.actorLeftLevel)
        movement.petPostmov = true;
    revealMonsterAfterLeavingHidingPlace(monster, movement, state);
    handleMonsterDoor(monster, state, movement, rollOne, calls);
    if (movement.moved || monster?.pet || monster?.mtame)
        triggerMonsterTrap(
            monster, state, movement, random, rollDice, rollOne, calls,
        );
    if (movement.deferredAfterMonsterTrap) {
        action.movement = movement;
        return action;
    }
    postMoveHideUnder(monster, movement, state, random, calls);
    if (!movement.deferredAfterHideUnder)
        finishDochugAfterMovement(
            monster, movement, state, random, rollOne, rollDice, calls,
        );
    action.movement = movement;
    return action;
}

// Resume dog_eat() after its visible line has crossed tty.  The object is
// still on the destination square while the older topline owns --More--.
export function resumeDeferredPetEating(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const movement = action?.movement;
    if (!movement?.deferredPetEating) return action;
    const monster = action.monster;
    const object = movement.ateFood;
    const calls = action.calls;

    // distant_name()/artifact lookup and the later reward classification
    // independently reach obj_resists() after dog_eat()'s pline returns.
    recordRandom(random, calls, 100);
    dogFood(monster, object, random, calls, state);

    const pile = state.level.objects?.[movement.x]?.[movement.y] || [];
    const quantity = movement.eatingQuantity ?? object?.quan
        ?? object?.quantity ?? 1;
    if (quantity > 1) {
        object.quantity = quantity - 1;
        object.quan = object.quantity;
    } else {
        const index = pile.indexOf(object);
        if (index >= 0) pile.splice(index, 1);
    }

    delete movement.deferredPetEating;
    movement.eatingMessageHandled = true;
    if (!movement.actorDied && !movement.actorLeftLevel)
        movement.petPostmov = true;
    completeMovedMonsterAction(
        monster, movement, state, random, rollDice, rollOne, calls,
    );
    return action;
}

function heroSensesMonster(state, monster) {
    if (state?.u?.uswallow && state.u.ustuck !== monster) return false;
    const distance = dist2(
        monster.mx, monster.my,
        state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my,
    );
    if ((state?.underwater || state?.u?.uinwater)
        && (distance > 2
            || !IS_POOL(state?.level?.at?.(monster.mx, monster.my)?.typ))) {
        return false;
    }
    if (state?.u?.detectMonsters || state?.detectMonsters) return true;
    if ((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_MINDLESS) return false;

    const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
    if (blind && (state?.u?.blindTelepathy || state?.u?.telepathy))
        return true;
    const wornTelepathy = [state?.uarmh, state?.uamul]
        .filter(object => object?.otyp === 100 || object?.otyp === 201).length;
    const range = Math.max(
        wornTelepathy ? BOLT_LIM * BOLT_LIM : -1,
        state?.u?.unblind_telepat_range ?? -1,
    );
    return range >= 0 && distance <= range;
}

// C mon.c:restrap(), non-mimic hider branch.  The probability probe belongs
// before dochug(), even when it fails and the actor subsequently moves.  A
// successful piercer/lurker attempt in ordinary room terrain sets
// mundetected and consumes the action.  Mimic disguise synthesis remains
// separate because set_mimic_sym() owns object/furniture construction RNG.
function attemptMonsterRestrap(monster, state, random, calls) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (!(flags & M1_HIDE)
        || monster.mcan || monster.m_ap_type
        || !state?.viz_array
        || (state.viz_array?.[monster.my]?.[monster.mx] & 0x2)) {
        return false;
    }
    if (recordRandom(random, calls, 3) !== 0
        || state?.u?.ustuck === monster) return false;

    const trap = state?.level?.traps?.find(candidate =>
        candidate.tx === monster.mx && candidate.ty === monster.my);
    if (monster.mtrapped && trap && !is_pit(trap.ttyp)) return false;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const ceilingHider = ((flags & M1_CLING) && symbol !== 20)
        || !!(flags & M1_FLY);
    if (ceilingHider && !levelHasCeiling(state)) return false;
    if (heroSensesMonster(state, monster)
        && distmin(monster.mx, monster.my,
            state?.u?.ux ?? monster.mx,
            state?.u?.uy ?? monster.my) <= 1) return false;

    if (symbol === 20) return false;
    if (state?.level?.at?.(monster.mx, monster.my)?.typ === ROOM) {
        monster.mundetected = 1;
        return true;
    }
    return false;
}

export function finishMonsterLiquidDeath(
    monster, state, random, calls, leaveCorpse,
) {
    const x = monster.mx;
    const y = monster.my;
    detachDeadMonster(monster, state);
    const corpse = leaveCorpse
        ? createOrdinaryMonsterCorpse(monster, state, random, calls)
        : null;
    if (state === game) {
        unmap_invisible(x, y, false);
        newsym(x, y);
    }
    return {
        oldx: x, oldy: y, x, y,
        moved: false, dead: true,
        actionCompleted: true,
        corpse,
    };
}

export async function finishEnvironmentalMonsterDeath(
    monster, state, {
        deathMessage = null,
        visible = true,
        spotted = visible,
        noCorpse = false,
        zombifyCorpse = false,
        random = rn2,
        publish = plineWithContinuation,
    } = {},
) {
    const recovery = await preventMonsterDeath(monster, {
        creditedKill: deathMessage,
        visible,
        spotted,
        petSpotted: spotted,
        state,
        publish,
        random,
    });
    if (recovery.survived)
        return { monster, survived: true, corpse: null };

    const calls = [];
    const x = monster.mx;
    const y = monster.my;
    detachDeadMonster(monster, state);
    const corpse = noCorpse ? null : createOrdinaryMonsterCorpse(
        monster, state, random, calls, { zombify: zombifyCorpse },
    );
    if (state === game) newsym(x, y);
    return { monster, survived: false, corpse };
}

export function finishMonsterRayDeath(
    monster, death, state = game, publish = plineWithContinuation,
    random = rn2,
) {
    return finishEnvironmentalMonsterDeath(monster, state, {
        deathMessage: death.deathMessage,
        random,
        publish,
        noCorpse: death.noCorpse,
        visible: death.visible ?? cansee(monster.mx, monster.my),
        spotted: death.spotted
            ?? canProjectMonster(monster, monster.mx, monster.my),
    });
}

export function runQuietMonsterActions(
    actors, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    return actors.map(monster => {
        const calls = DISCARDED_CALL_LOG;
        // C movemon_singlemon() reassesses newly acquired/replacement armor
        // after movement debit but before hider state, Conflict, or dochug().
        // Dressing is RNG-free and may freeze the actor for the armor delay.
        const equipment = reassessMonsterArmor(monster);
        if (equipment?.consumed) {
            return {
                monster, calls,
                movement: {
                    oldx: monster.mx, oldy: monster.my,
                    x: monster.mx, y: monster.my,
                    moved: false, equipment,
                },
            };
        }
        // C mon.c:movemon_singlemon() debits movement before restrap().
        // These early returns belong only to is_hider() (M1_HIDE): a cobra
        // with M1_CONCEAL remains active after hiding beneath an object and
        // can spend another movement ration in this same movemon() pass.
        const restrapped = attemptMonsterRestrap(
            monster, state, random, calls,
        );
        const isHider = !!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_HIDE);
        if (isHider && (restrapped
            || monster.m_ap_type === M_AP_FURNITURE
            || monster.m_ap_type === M_AP_OBJECT
            || monster.mundetected)) {
            return {
                monster, calls,
                movement: {
                    oldx: monster.mx, oldy: monster.my,
                    x: monster.mx, y: monster.my,
                    moved: false, hidden: true,
                },
            };
        }
        // Eels get one pre-dochug opportunity to hide again.  A stranded eel
        // still owns the 1-in-4 probe, but hideunder() fails on dry terrain.
        const eel = MONSTER_SYMBOL[monster.mnum] === S_EEL;
        const eelInSight = !!(state?.viz_array?.[monster.my]?.[monster.mx] & 0x2);
        const canSeeInvisible = !!(state?.u?.seeInvisible
            || state?.u?.see_invisible);
        const canSeeMonster = !state?.blind
            && !(state?.u?.blindTurns > 0)
            && eelInSight && (!monster.minvis || canSeeInvisible)
            && !monster.mundetected;
        const nextToHero = distmin(
            monster.mx, monster.my,
            state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my,
        ) <= 1;
        if (eel && !monster.mundetected
            && (monster.mflee || !nextToHero)
            && !canSeeMonster
            && recordRandom(random, calls, 4) === 0
            && IS_POOL(state?.level?.at?.(
                monster.mx, monster.my,
            )?.typ)) {
            monster.mundetected = 1;
            return {
                monster, calls,
                movement: {
                    oldx: monster.mx, oldy: monster.my,
                    x: monster.mx, y: monster.my, moved: false, hidden: true,
                },
            };
        }
        // C movemon_singlemon() gives a nearby, mutually visible monster a
        // Conflict resistance check before dochug() starts.  This is separate
        // from mon_allowflags()'s later check, so an actor can legitimately
        // own two rnd(20) calls in one scan even when there is nobody adjacent
        // for fightm() to attack.
        const inSight = !state?.viz_array
            || !!(state.viz_array?.[monster.my]?.[monster.mx] & 0x2);
        if (heroHasConflict(state) && !monster.iswiz
            && couldSeeFromHero(state, monster.mx, monster.my)
            && inSight
            && dist2(monster.mx, monster.my,
                state?.u?.ux ?? monster.mx,
                state?.u?.uy ?? monster.my) <= BOLT_LIM * BOLT_LIM) {
            resistConflict(monster, state, rollOne, calls);
        }
        // monmove.c:dochug() checks the strategy wait mask before ordinary
        // sleep disturbance.  A squeaky board wakes indeterminate sleep, but
        // wake_nearto() deliberately preserves meditation for unique
        // monsters such as the Wizard.  WAITFORU is released only once the
        // actor can see the hero or has been hurt.
        if (((monster.mstrategy ?? 0) & STRAT_WAITFORU)
            && ((monster.mhp ?? 0) < (monster.mhpmax ?? monster.mhp ?? 0)
                || (monster.mcansee !== 0
                    && couldSeeFromHero(
                        state, monster.mx, monster.my,
                    )))) {
            monster.mstrategy &= ~STRAT_WAITFORU;
        }
        if ((monster.mstrategy ?? 0) & STRAT_WAITMASK) {
            return {
                monster, calls,
                movement: {
                    oldx: monster.mx, oldy: monster.my,
                    x: monster.mx, y: monster.my,
                    moved: false, waiting: true,
                },
            };
        }
        // Frozen and sleeping actors are rejected by dochug(), after the
        // shared hider, eel, and Conflict phases above.  In particular, a
        // sleeping piercer still owns restrap()'s one-in-three probe.
        if (monster.mcanmove === 0 || (monster.mfrozen ?? 0) > 0) {
            return {
                monster, calls,
                movement: {
                    oldx: monster.mx, oldy: monster.my,
                    x: monster.mx, y: monster.my,
                    moved: false, immobile: true,
                },
            };
        }
        // movemon_singlemon() has already debited this actor's movement.
        // dochug() gives a movable sleeper one source-ordered disturbance
        // attempt before returning ahead of set_apparxy()/distfleeck().
        let wokeFromDisturb = false;
        if (monster.msleeping) {
            wokeFromDisturb = disturbSleepingMonster(
                monster, state, random, calls,
            );
            if (!wokeFromDisturb) {
                return {
                    monster, calls,
                    movement: {
                        oldx: monster.mx, oldy: monster.my,
                        x: monster.mx, y: monster.my,
                        moved: false, sleeping: true,
                    },
                };
            }
        }
        const { calls: actionCalls, movement } = quietMonsterActionRng(
            monster, state, random, rollDice, rollOne,
        );
        calls.push(...actionCalls);
        if (wokeFromDisturb) movement.wokeFromDisturb = true;
        return { monster, calls, movement };
    });
}

function continueMonsterContactAttack(
    attack, state, random, rollOne, calls,
) {
    const nextAttackIndex = attack.nextAttackIndex ?? 1;
    const nextAttack = attack.contactAttacks?.[nextAttackIndex];
    if (nextAttack) {
        const threshold = attack.results[0]?.threshold ?? 0;
        const roll = rollOne(20 + nextAttackIndex);
        calls.push(`rnd(${20 + nextAttackIndex})`);
        attack.results.push({
            ...nextAttack, roll, threshold,
            hit: threshold > roll, damage: 0,
        });
        attack.pendingResultIndex = attack.results.length - 1;
        attack.nextAttackIndex = nextAttackIndex + 1;
        attack.deferredContact = true;
        return;
    }

    if (defenderCanCounterattack(attack, state, random, calls)) {
        const { aggressor, defender } = attack;
        const counterattacks = sourceMonsterMeleeAttacks(defender);
        const counterattack = counterattacks[0];
        if (counterattack) {
            defender.mlstmv = sourceMonsterTurn(state);
            attack.counterattack = monsterVersusMonsterWieldAction(
                defender, aggressor, counterattack,
            );
            if (!attack.counterattack) {
                const threshold = findMonsterArmorClass(aggressor)
                    + (defender.m_lev ?? MONSTER_LEVEL[defender.mnum] ?? 0);
                const roll = rollOne(20);
                calls.push('rnd(20)');
                attack.counterattack = {
                    kind: 'monster-attack', aggressor: defender,
                    defender: aggressor, struck: false, defenderDied: false,
                    deferredContact: true,
                    results: [{
                        ...counterattack, roll, threshold,
                        hit: threshold > roll, damage: 0,
                    }],
                    contactAttacks: counterattacks,
                    pendingResultIndex: 0,
                    nextAttackIndex: 1,
                };
            }
            attack.postCounterFleePending = true;
        }
    }
    if (!attack.postCounterFleePending) recordRandom(random, calls, 5);
    attack.deferredContact = false;
}

// Continue a pet contact attack after tty has accepted its hit/miss message.
// C's mattackm() emits that message before damage, passive retaliation, death
// construction, and dochug()'s second distfleeck(), so a --More-- prompt can
// split one actor transaction at precisely this boundary.
export function resumeDeferredMonsterContact(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const attack = action?.movement?.attack;
    if (!attack?.deferredContact) return action;
    const resultIndex = attack.pendingResultIndex ?? 0;
    const result = attack.results[resultIndex];
    const { defender } = attack;
    const calls = action.calls;

    if (result.hit) {
        result.damage = rollDice(result.damn, result.damd);
        calls.push(`d(${result.damn},${result.damd})`);
        recordRandom(random, calls, 3);
        recordRandom(random, calls, 6);
        defender.mhp = Math.max(0, (defender.mhp ?? 1) - result.damage);
        attack.struck = true;
    }
    if ((defender.mhp ?? 0) > 0) recordRandom(random, calls, 3);

    attack.defenderDied = (defender.mhp ?? 0) <= 0;
    if (attack.defenderDied) {
        // mhitm.c prints the visible death line before monkilled() enters
        // corpse_chance()/grow_up().  tty may suspend that pline(), so leave
        // construction pending for the scheduler-facing continuation.
        attack.deathPending = true;
    }

    if (attack.deathPending) {
        attack.postDeathFleePending = true;
        attack.deferredContact = false;
    } else {
        continueMonsterContactAttack(
            attack, state, random, rollOne, calls,
        );
    }
    action.movement.deferredPostFlee = false;
    return action;
}

function continueMonsterCounterattack(action, random, rollOne) {
    const attack = action.movement.attack;
    const counterattack = attack.counterattack;
    const nextAttackIndex = counterattack.nextAttackIndex ?? 1;
    const nextAttack = counterattack.contactAttacks?.[nextAttackIndex];
    if (nextAttack) {
        const threshold = counterattack.results[0]?.threshold ?? 0;
        const roll = rollOne(20 + nextAttackIndex);
        action.calls.push(`rnd(${20 + nextAttackIndex})`);
        counterattack.results.push({
            ...nextAttack, roll, threshold,
            hit: threshold > roll, damage: 0,
        });
        counterattack.pendingResultIndex = counterattack.results.length - 1;
        counterattack.nextAttackIndex = nextAttackIndex + 1;
        counterattack.deferredContact = true;
        return;
    }

    counterattack.deferredContact = false;
    if (attack.postCounterFleePending) {
        recordRandom(random, action.calls, 5);
        attack.postCounterFleePending = false;
    }
}

// Finish the counterattack only after its visible hit/miss line has entered
// tty's topline transaction.  In C, passivemm() and damage occur after that
// pline(), so a later message can suspend between the to-hit roll and tail.
export function resumeDeferredMonsterCounterattack(
    action, state, random = rn2, rollDice = d, rollOne = rnd,
) {
    const counterattack = action?.movement?.attack?.counterattack;
    if (!counterattack?.deferredContact) return action;
    const resultIndex = counterattack.pendingResultIndex ?? 0;
    const result = counterattack.results[resultIndex];
    if (result.hit) {
        result.damage = rollDice(result.damn, result.damd);
        action.calls.push(`d(${result.damn},${result.damd})`);
        recordRandom(random, action.calls, 3);
        recordRandom(random, action.calls, 6);
        counterattack.defender.mhp = Math.max(
            0, (counterattack.defender.mhp ?? 1) - result.damage,
        );
        counterattack.struck = true;
    }
    if ((counterattack.defender.mhp ?? 0) > 0)
        recordRandom(random, action.calls, 3);
    counterattack.defenderDied = (counterattack.defender.mhp ?? 0) <= 0;
    if (counterattack.defenderDied) counterattack.deathPending = true;

    if (counterattack.deathPending)
        counterattack.deferredContact = false;
    else continueMonsterCounterattack(action, random, rollOne);
    return action;
}

// A visible mattackm() weapon switch has the same tty ownership as a visible
// hit or miss, but no damage/passive tail.  Once its line has crossed tty,
// return to dog_move()/dochug() and consume the pet actor's trailing flee
// check in the same transaction.
export function resumeDeferredMonsterCounterWield(
    action, state, random = rn2,
) {
    const attack = action?.movement?.attack;
    const counterattack = attack?.counterattack;
    if (counterattack?.kind !== 'monster-wield'
        || !counterattack.deferredWield) return action;
    counterattack.deferredWield = false;
    if (attack.postCounterFleePending) {
        recordRandom(random, action.calls, 5);
        attack.postCounterFleePending = false;
    }
    return action;
}

export async function finishDeferredMonsterCounterattackDeath(
    action, state, {
        random = rn2,
        rollOne = rnd,
        publish = plineWithContinuation,
    } = {},
) {
    const attack = action?.movement?.attack;
    const counterattack = attack?.counterattack;
    if (!counterattack?.deathPending || counterattack.death) return action;
    const death = await finishMonsterCombatDeath(
        counterattack.aggressor, counterattack.defender, state, {
            random,
            rollOne,
            calls: action.calls,
            killingAttack: counterattack.results?.at(-1),
            publish,
        },
    );
    counterattack.deathPending = false;
    if (death.survived) {
        counterattack.defenderDied = false;
        recordRandom(random, action.calls, 3);
        continueMonsterCounterattack(action, random, rollOne);
        return action;
    }
    counterattack.death = death;
    attack.postCounterFleePending = false;
    return action;
}

export async function finishDeferredMonsterDeath(
    action, state, {
        random = rn2,
        rollOne = rnd,
        publish = plineWithContinuation,
    } = {},
) {
    const attack = action?.movement?.attack;
    if (!attack?.deathPending || attack.death) return action;
    const death = await finishMonsterCombatDeath(
        attack.aggressor, attack.defender, state, {
            random,
            rollOne,
            calls: action.calls,
            killingAttack: attack.results?.at(-1),
            publish,
        },
    );
    attack.deathPending = false;
    if (death.survived) {
        attack.defenderDied = false;
        attack.postDeathFleePending = false;
        recordRandom(random, action.calls, 3);
        continueMonsterContactAttack(
            attack, state, random, rollOne, action.calls,
        );
        action.movement.deferredPostFlee = false;
        return action;
    }
    attack.death = death;
    if (attack.postDeathFleePending) {
        recordRandom(random, action.calls, 5);
        attack.postDeathFleePending = false;
    }
    return action;
}
