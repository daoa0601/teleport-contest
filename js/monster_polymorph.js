// Monster shape-changing rules.
// C refs: mon.c:select_newcham_form(), pickvampshape(), and newcham().

import {
    BOLT_LIM, IS_LAVA, IS_POOL, Is_rogue_level, STRAT_WAITFORU, W_ARM,
} from './const.js';
import { canSeeMonster, canSpotMonster, newsym } from './display.js';
import { game } from './gstate.js';
import {
    monsterCanBeLeashed, releaseMonsterLeash,
} from './monster_leash.js';
import { newMonsterHitPoints } from './monster_hit_points.js';
import { dropObjectFromMonsterInventory } from './monster_inventory.js';
import {
    MONSTER_COLOR, MONSTER_DIFFICULTY, MONSTER_FLAGS1, MONSTER_FLAGS2,
    MONSTER_GENO, MONSTER_MOVE, MONSTER_NAME, MONSTER_SYMBOL, SPECIAL_PM,
    monsterClassSymbol, monsterIsPlayerMonster, monsterTypeName,
} from './monster_data.js';
import { setMonsterSpecies } from './monster_species.js';
import {
    adjustMonsterClothingAfterPolymorph, checkMonsterGearNextTurn,
} from './monworn.js';
import { updateMonsterWeaponAfterPolymorph } from './monster_weapon.js';
import {
    BOULDER, CANDELABRUM_OF_INVOCATION, GRAY_DRAGON_SCALE_MAIL,
    GRAY_DRAGON_SCALES, YELLOW_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALES,
} from './object_data.js';
import { rn1, rn2, rnd } from './rng.js';
import {
    initializeMonsterWormBody, removeMonsterWormBody,
} from './monster_worm.js';

const M1_HUMANOID = 0x00020000;
const M1_ANIMAL = 0x00040000;
const M1_CONCEAL = 0x00000080;
const M1_HIDE = 0x00000100;
const M2_NOPOLY = 0x00000001;
const M2_SHAPESHIFTER = 0x00004000;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const M2_ROCKTHROW = 0x08000000;
const S_VAMPIRE = 48;

const PM_WOLF = MONSTER_NAME.indexOf('wolf');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_BLACK_LIGHT = MONSTER_NAME.indexOf('black light');
const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const PM_VAMPIRE_BAT = MONSTER_NAME.indexOf('vampire bat');
const PM_STALKER = MONSTER_NAME.indexOf('stalker');
const PM_JABBERWOCK = MONSTER_NAME.indexOf('jabberwock');
const PM_VAMPIRE = MONSTER_NAME.indexOf('vampire');
const PM_VAMPIRE_LEADER = MONSTER_NAME.indexOf('vampire leader');
const PM_VLAD_THE_IMPALER = MONSTER_NAME.indexOf('Vlad the Impaler');
const PM_DOPPELGANGER = MONSTER_NAME.indexOf('doppelganger');
const PM_SANDESTIN = MONSTER_NAME.indexOf('sandestin');
const PM_CHAMELEON = MONSTER_NAME.indexOf('chameleon');
const PM_ARCHAEOLOGIST = MONSTER_NAME.indexOf('archeologist');
const PM_WIZARD = MONSTER_NAME.indexOf('wizard');
const PM_STUDENT = MONSTER_NAME.indexOf('student');
const PM_APPRENTICE = MONSTER_NAME.indexOf('apprentice');
const PM_GRAY_DRAGON = MONSTER_NAME.indexOf('gray dragon');
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
const POLYMORPH_IMMUNE_MONSTERS = new Set([
    'Nazgul', 'erinys', 'Death', 'Pestilence', 'Famine',
].map(monsterIndexByName));

function monsterIndexByName(name) {
    const mnum = MONSTER_NAME.indexOf(name);
    if (mnum < 0) throw new Error(`Unknown monster identity: ${name}`);
    return mnum;
}

const NASTY_MONSTERS = [
    'cockatrice', 'ettin', 'stalker', 'minotaur',
    'owlbear', 'purple worm', 'xan', 'umber hulk',
    'xorn', 'zruty', 'leocrotta', 'baluchitherium',
    'carnivorous ape', 'fire elemental', 'jabberwock',
    'iron golem', 'ochre jelly', 'green slime',
    'displacer beast', 'genetic engineer',
    'black dragon', 'red dragon', 'arch-lich', 'vampire leader',
    'master mind flayer', 'disenchanter', 'winged gargoyle',
    'storm giant', 'Olog-hai', 'elf-noble', 'elven monarch',
    'ogre tyrant', 'captain', 'gremlin',
    'silver dragon', 'orange dragon', 'green dragon', 'yellow dragon',
    'guardian naga', 'fire giant', 'Aleax', 'couatl',
    'horned devil', 'barbed devil',
].map(monsterIndexByName);

const NASTY_BIG_TO_LITTLE = new Map([
    ['cockatrice', 'chickatrice'],
    ['purple worm', 'baby purple worm'],
    ['black dragon', 'baby black dragon'],
    ['red dragon', 'baby red dragon'],
    ['silver dragon', 'baby silver dragon'],
    ['orange dragon', 'baby orange dragon'],
    ['green dragon', 'baby green dragon'],
    ['yellow dragon', 'baby yellow dragon'],
    ['arch-lich', 'master lich'],
    ['vampire leader', 'vampire'],
    ['master mind flayer', 'mind flayer'],
    ['elf-noble', 'elf'],
    ['elven monarch', 'elf-noble'],
    ['ogre tyrant', 'ogre leader'],
    ['captain', 'lieutenant'],
].map(([large, small]) => [
    monsterIndexByName(large), monsterIndexByName(small),
]));

function monsterIsGenocided(mnum) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & 0x02);
}

function pickNastyShape(difficultyCap) {
    let result = NASTY_MONSTERS[rn2(NASTY_MONSTERS.length)];
    if (Is_rogue_level(game.u?.uz)
        && !/^[A-Z]$/.test(monsterClassSymbol(result))) {
        result = NASTY_MONSTERS[rn2(NASTY_MONSTERS.length)];
    }

    const inHell = !!game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.hellish;
    const outOfPlaceMask = inHell ? 0x0800 : 0x0400;
    const shouldDemote = monsterIsGenocided(result)
        || (difficultyCap > 0
            && (MONSTER_DIFFICULTY[result] ?? 0) >= difficultyCap)
        || !!((MONSTER_GENO[result] ?? 0) & outOfPlaceMask);
    const alternate = shouldDemote
        ? (NASTY_BIG_TO_LITTLE.get(result) ?? result) : result;
    if (alternate !== result && !monsterIsGenocided(alternate)) {
        const name = MONSTER_NAME[alternate] ?? '';
        if (!name.startsWith('baby ')
            && !/(?: hatchling| pup| cub)$/.test(name)) {
            result = alternate;
        }
    }
    return result;
}

function acceptsShapechangerForm(baseMnum, targetMnum) {
    if (!Number.isInteger(targetMnum) || targetMnum < 0
        || monsterIsGenocided(targetMnum)) return false;
    if (monsterIsPlayerMonster(targetMnum) || targetMnum === baseMnum)
        return true;
    return !((MONSTER_FLAGS2[targetMnum] ?? 0) & M2_NOPOLY);
}

function randomShape(baseMnum) {
    let targetMnum = -1;
    let triesLeft = 50;
    do {
        targetMnum = rn2(SPECIAL_PM);
        --triesLeft;
    } while (triesLeft > 0
        && !acceptsShapechangerForm(baseMnum, targetMnum)
        && triesLeft > 40
        && Is_rogue_level(game.u?.uz)
        && !/^[A-Z]$/.test(monsterClassSymbol(targetMnum)));
    return targetMnum;
}

function dragonArmorForm(monster) {
    const armor = (monster?.minvent || monster?.inventory || []).find(
        object => ((object.owornmask ?? 0) & W_ARM) !== 0,
    );
    if (!armor) return null;
    if (armor.otyp >= GRAY_DRAGON_SCALE_MAIL
        && armor.otyp <= YELLOW_DRAGON_SCALE_MAIL) {
        return PM_GRAY_DRAGON + armor.otyp - GRAY_DRAGON_SCALE_MAIL;
    }
    if (armor.otyp >= GRAY_DRAGON_SCALES
        && armor.otyp <= YELLOW_DRAGON_SCALES) {
        return PM_GRAY_DRAGON + armor.otyp - GRAY_DRAGON_SCALES;
    }
    return null;
}

function selectOrdinaryPolymorphForm(monster) {
    const armorForm = dragonArmorForm(monster);
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = armorForm ?? randomShape(-1);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(game.u?.uz);
        if (acceptsShapechangerForm(-1, targetMnum)
            && (!wantsUppercase
                || /^[A-Z]$/.test(monsterClassSymbol(targetMnum)))) {
            return targetMnum;
        }
    }
    return null;
}

function selectDoppelgangerFormOnce() {
    let targetMnum = -1;
    if (!rn2(7)) {
        targetMnum = pickNastyShape(
            (MONSTER_DIFFICULTY[PM_JABBERWOCK] ?? 0) - 1,
        );
    } else if (rn2(3)) {
        if (rn2(13)) rnd(10);
        targetMnum = rn1(
            PM_WIZARD - PM_ARCHAEOLOGIST + 1, PM_ARCHAEOLOGIST,
        );
    } else if (!rn2(3)) {
        targetMnum = rn1(
            PM_APPRENTICE - PM_STUDENT + 1, PM_STUDENT,
        );
        if (targetMnum === game.urole?.guardnum) targetMnum = -1;
    } else {
        let triesLeft = 5;
        do {
            targetMnum = rn2(SPECIAL_PM);
            if ((MONSTER_FLAGS1[targetMnum] ?? 0) & M1_HUMANOID
                && !((MONSTER_FLAGS2[targetMnum] ?? 0) & M2_NOPOLY)) {
                break;
            }
            targetMnum = -1;
        } while (--triesLeft > 0);
    }
    return targetMnum < 0 ? randomShape(PM_DOPPELGANGER) : targetMnum;
}

function selectDoppelgangerForm() {
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = selectDoppelgangerFormOnce();
        if (acceptsShapechangerForm(PM_DOPPELGANGER, targetMnum))
            return targetMnum;
    }
    return null;
}

function selectChameleonForm() {
    const animals = Array.from({ length: SPECIAL_PM }, (_, mnum) => mnum)
        .filter(mnum => (MONSTER_FLAGS1[mnum] ?? 0) & M1_ANIMAL);
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = !rn2(3)
            ? animals[rn2(animals.length)]
            : randomShape(PM_CHAMELEON);
        if (acceptsShapechangerForm(PM_CHAMELEON, targetMnum))
            return targetMnum;
    }
    return null;
}

function selectInitialSandestinForm() {
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = rn2(7)
            ? pickNastyShape((MONSTER_DIFFICULTY[PM_ARCHON] ?? 0) - 1)
            : randomShape(PM_SANDESTIN);
        if (acceptsShapechangerForm(PM_SANDESTIN, targetMnum))
            return targetMnum === PM_SANDESTIN ? null : targetMnum;
    }
    return null;
}

function shapechangerGender(baseMnum, targetMnum, female) {
    const flags = MONSTER_FLAGS2[targetMnum] ?? 0;
    if (flags & M2_MALE) return false;
    if (flags & M2_FEMALE) return true;
    if (flags & M2_NEUTER) return female;

    const toggle = !rn2(10);
    const vampireShape = targetMnum === PM_VAMPIRE
        || targetMnum === PM_VAMPIRE_LEADER
        || targetMnum === PM_VLAD_THE_IMPALER;
    const vampireBase = baseMnum === PM_VAMPIRE
        || baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER;
    return toggle && !(vampireShape || vampireBase) ? !female : female;
}

function pickVampireShape(monster) {
    const baseMnum = monster.cham;
    const uppercaseOnly = Is_rogue_level(game.u?.uz);
    let targetMnum = baseMnum;
    let wolfChance = 10;

    if (baseMnum === PM_VLAD_THE_IMPALER) {
        const inventory = monster.minvent || monster.inventory || [];
        if (inventory.some(object =>
            object.otyp === CANDELABRUM_OF_INVOCATION)) return baseMnum;
        wolfChance = 3;
    }
    if (baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER) {
        const location = game.level?.at?.(monster.mx, monster.my);
        if (!rn2(wolfChance) && !uppercaseOnly
            && !IS_POOL(location?.typ) && !IS_LAVA(location?.typ)) {
            targetMnum = PM_WOLF;
        }
    }
    if (targetMnum === baseMnum) {
        targetMnum = !rn2(4) && !uppercaseOnly
            ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
    }
    if (monsterIsGenocided(targetMnum)
        || (monster.mnum !== baseMnum && !rn2(4))) return baseMnum;
    return targetMnum;
}

function shapechangerProtectionActive() {
    return !!(
        game.u?.protectionFromShapeChangers
        || game.protectionFromShapeChangers
    );
}

function naturalShapechanger(mnum) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_SHAPESHIFTER);
}

function dropBouldersTheNewFormCannotCarry(monster, state) {
    if ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW) return [];
    const boulders = (monster.minvent || monster.inventory || [])
        .filter(object => object.otyp === BOULDER);
    return boulders.map(object =>
        dropObjectFromMonsterInventory(monster, object, state)).filter(Boolean);
}

function initialShapechangedMonster(monster, targetMnum) {
    const baseMnum = monster.mnum;
    const female = shapechangerGender(
        baseMnum, targetMnum, !!monster.female,
    );
    const { level, hp } = newMonsterHitPoints(targetMnum);
    const permanentlyInvisible = targetMnum === PM_STALKER
        || targetMnum === PM_BLACK_LIGHT;
    return {
        m_id: monster.m_id,
        mnum: targetMnum,
        cham: baseMnum,
        mx: monster.mx,
        my: monster.my,
        mhp: hp,
        mhpmax: hp,
        m_lev: level,
        female,
        msleeping: monster.msleeping ?? 0,
        mpeaceful: monster.mpeaceful ? 1 : 0,
        mcanmove: 1,
        minvis: permanentlyInvisible,
        perminvis: permanentlyInvisible,
        movement: 0,
        mmove: MONSTER_MOVE[targetMnum] ?? 0,
        mspeed: 0,
        symbol: monsterClassSymbol(targetMnum),
        color: MONSTER_COLOR[targetMnum],
        hasInventory: false,
        minvent: [],
        inventory: [],
        weaponCheck: 0,
    };
}

export function initialShapechangedBirth(monster) {
    const baseMnum = monster?.mnum;
    if (!naturalShapechanger(baseMnum) || shapechangerProtectionActive())
        return null;

    let targetMnum = null;
    if (baseMnum === PM_DOPPELGANGER) {
        targetMnum = selectDoppelgangerForm();
        if (targetMnum === PM_DOPPELGANGER) targetMnum = null;
    } else if (baseMnum === PM_CHAMELEON) {
        targetMnum = selectChameleonForm();
        if (targetMnum === PM_CHAMELEON) targetMnum = null;
    } else if (baseMnum === PM_SANDESTIN) {
        targetMnum = selectInitialSandestinForm();
    } else if (baseMnum === PM_VAMPIRE || baseMnum === PM_VAMPIRE_LEADER) {
        if (baseMnum === PM_VAMPIRE_LEADER && !rn2(10))
            targetMnum = PM_WOLF;
        else
            targetMnum = !rn2(4) ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
    }
    if (targetMnum == null) {
        monster.cham = baseMnum;
        return null;
    }
    return initialShapechangedMonster(monster, targetMnum);
}

export function changeMonsterForm(
    monster, forcedTargetMnum = null, state = game,
) {
    let baseMnum = Number.isInteger(monster?.cham) && monster.cham >= 0
        ? monster.cham : -1;
    if (baseMnum < 0 && POLYMORPH_IMMUNE_MONSTERS.has(monster?.mnum))
        return null;
    if (baseMnum < 0 && monster?.mcan
        && naturalShapechanger(monster.mnum)
        && !shapechangerProtectionActive()) {
        baseMnum = monster.mnum;
        monster.cham = baseMnum;
        monster.mcan = 0;
    }

    let targetMnum = forcedTargetMnum;
    if (targetMnum == null && baseMnum === PM_DOPPELGANGER) {
        targetMnum = selectDoppelgangerForm();
    } else if (targetMnum == null && baseMnum === PM_CHAMELEON) {
        targetMnum = selectChameleonForm();
    } else if (targetMnum == null && (
        baseMnum === PM_VAMPIRE
        || baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER
    )) {
        targetMnum = pickVampireShape(monster);
    } else if (targetMnum == null) {
        targetMnum = selectOrdinaryPolymorphForm(monster);
    }
    if (targetMnum == null || targetMnum === monster.mnum) return null;

    const oldMnum = monster.mnum;
    if (monster.wormno) removeMonsterWormBody(monster);
    const oldHp = Math.max(1, monster.mhp ?? 1);
    const oldMax = Math.max(1, monster.mhpmax ?? oldHp);
    const female = shapechangerGender(baseMnum, targetMnum, !!monster.female);
    const { level, hp } = newMonsterHitPoints(targetMnum);
    const scaledHp = Math.trunc(oldHp * hp / oldMax);
    const oldNaturallyInvisible = monster.mnum === PM_STALKER
        || monster.mnum === PM_BLACK_LIGHT;
    const naturallyInvisible = targetMnum === PM_STALKER
        || targetMnum === PM_BLACK_LIGHT;

    setMonsterSpecies(monster, targetMnum);
    monster.m_lev = level;
    monster.mhpmax = hp;
    monster.mhp = Math.max(1, Math.min(hp, scaledHp));
    monster.female = female;
    let leashReleased = false;
    let leashReleaseVisible = false;
    if (monster.mleashed && !monsterCanBeLeashed(monster)) {
        leashReleaseVisible = canSeeMonster(monster, monster.mx, monster.my);
        releaseMonsterLeash(monster, state);
        leashReleased = true;
    }
    if (!monster.perminvis || oldNaturallyInvisible)
        monster.perminvis = naturallyInvisible;
    monster.minvis = monster.invis_blkd ? 0 : !!monster.perminvis;
    if (monster.m_ap_type && MONSTER_SYMBOL[targetMnum] !== 13) {
        monster.m_ap_type = 0;
        monster.mappearance = 0;
    }
    if (monster.mundetected
        && !((MONSTER_FLAGS1[targetMnum] ?? 0) & (M1_CONCEAL | M1_HIDE))) {
        monster.mundetected = 0;
    }
    if (baseMnum < 0 && MONSTER_SYMBOL[targetMnum] === S_VAMPIRE
        && naturalShapechanger(targetMnum)
        && !shapechangerProtectionActive()) {
        monster.cham = targetMnum;
    }
    if (targetMnum === PM_LONG_WORM)
        initializeMonsterWormBody(monster);
    monster.meverseen = 0;

    const droppedWeapon = updateMonsterWeaponAfterPolymorph(monster, state);
    const clothing = adjustMonsterClothingAfterPolymorph(monster, state);
    checkMonsterGearNextTurn(monster);
    const droppedBoulders = dropBouldersTheNewFormCannotCarry(monster, state);
    return {
        oldMnum,
        newMnum: targetMnum,
        leashReleased,
        leashReleaseVisible,
        droppedWeapon,
        droppedClothing: clothing.dropped,
        destroyedClothing: clothing.destroyed,
        droppedBoulders,
    };
}

function monsterFormSubject(monster, mnum = monster?.mnum) {
    if (monster?.name) return monster.name;
    const name = monsterTypeName(mnum, !!monster?.female);
    return monster?.mtame ? `Your ${name}` : `The ${name}`;
}

export function changeMonsterFormWithAppearance(
    monster, forcedTargetMnum = null, state = game,
) {
    const oldMnum = monster.mnum;
    const oldSubject = monsterFormSubject(monster, oldMnum);
    const wasSpotted = canSpotMonster(monster);
    const change = changeMonsterForm(monster, forcedTargetMnum, state);
    if (!change) return null;

    newsym(monster.mx, monster.my);
    const newName = monsterTypeName(monster.mnum, !!monster.female);
    const nowSpotted = canSpotMonster(monster);
    let message = null;
    if (wasSpotted && nowSpotted) {
        message = `${oldSubject} turns into a ${newName}!`;
    } else if (wasSpotted) {
        message = `${oldSubject} disappears!`;
    } else if (nowSpotted) {
        const subject = monster.mtame ? `Your ${newName}` : `A ${newName}`;
        message = `${subject} appears!`;
    }
    return { ...change, message };
}

function vampireMayShiftOutOfSight(monster, state) {
    const visible = canSeeMonster(monster, monster.mx, monster.my);
    const dx = monster.mx - (state.u?.ux ?? monster.mx);
    const dy = monster.my - (state.u?.uy ?? monster.my);
    return !visible || dx * dx + dy * dy > BOLT_LIM * BOLT_LIM;
}

export function decideMonsterShapeChange(
    monster, state = game, random = rn2,
) {
    const baseMnum = Number.isInteger(monster.cham) && monster.cham >= 0
        ? monster.cham : null;
    if (baseMnum === null) return null;

    const vampireShifter = baseMnum === PM_VAMPIRE
        || baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER;
    let targetMnum = null;
    let shouldChange = false;
    if (!vampireShifter) {
        if (!(monster.mspec_used ?? 0) && random(6) === 0) {
            monster.mspec_used = 3 + random(10);
            shouldChange = true;
        }
    } else if (!((monster.mstrategy ?? 0) & STRAT_WAITFORU)) {
        const inVampireForm = MONSTER_SYMBOL[monster.mnum] === S_VAMPIRE;
        if (!inVampireForm) {
            if (monster.mhp <= ((monster.mhpmax ?? 0) + 5) / 6
                && random(4) !== 0) {
                targetMnum = baseMnum;
                shouldChange = true;
            } else if (monster.mnum === PM_FOG_CLOUD
                && monster.mhp === monster.mhpmax
                && random(4) === 0
                && vampireMayShiftOutOfSight(monster, state)) {
                shouldChange = true;
            }
        } else if (monster.mhp >= 9 * (monster.mhpmax ?? 0) / 10
            && random(6) === 0
            && vampireMayShiftOutOfSight(monster, state)) {
            shouldChange = true;
        }
    }
    if (!shouldChange) return null;

    const wasFemale = !!monster.female;
    const change = changeMonsterFormWithAppearance(
        monster, targetMnum, state,
    );
    if (change && vampireShifter) {
        const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
        if (!(flags & (M2_MALE | M2_FEMALE | M2_NEUTER)))
            monster.female = wasFemale;
    }
    return change;
}
