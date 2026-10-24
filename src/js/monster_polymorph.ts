// Monster shape-changing rules.
// C refs: mon.c:select_newcham_form(), pickvampshape(), and newcham().

import { bypassObject } from './object_bypass.js';
import {
    BOLT_LIM, DOOR, D_CLOSED, D_LOCKED, In_endgame, Is_rogue_level, MGIVENNAME, STRAT_WAITFORU, W_ARM,
    M_AP_MONSTER, M_AP_NOTHING, M_AP_TYPE, MON_FLOOR, NON_PM, ismnum,
} from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation, swallowed } from './display.js';
import { dragonFormForArmor } from './armor.js';
import { game, requireLiveGame } from './gstate.js';
import { placeMonsterAt } from './monster_location.js';
import { expelHero, releaseHeroFromMonster } from './hero_expulsion.js';
import { heroFormSticks } from './hero_species.js';
import { monsterName, monsterFormChangeName, namelessMonsterName } from './monster_name.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { hideMonsterUnder } from './monster_hiding.js';
import {
    monsterCanBeLeashed, releaseMonsterLeashWithFeedback,
} from './monster_leash.js';
import { newMonsterHitPoints } from './monster_hit_points.js';
import { unlinkMonsterObject } from './monster_inventory.js';
import { landFloorObject } from './floor_effects.js';
import {
    MONSTER_COLOR, MONSTER_DIFFICULTY, MONSTER_FLAGS1, MONSTER_FLAGS2,
    MONSTER_GENO, MONSTER_MOVE, MONSTER_NAME, MONSTER_SYMBOL, SPECIAL_PM,
    monsterClassSymbol, monsterIsPlayerMonster, monsterTypeName,
    monsterCanEngulf, monsterDigests, monsterIsAmorphous, monsterIsNoncorporeal,
    monsterIsUnsolid, monsterIsVampireShifter, monsterIsWhirly, monsterSpeciesSticks,
    requireMonsterData,
} from './monster_data.js';
import { setMonsterSpecies } from './monster_species.js';
import {
    adjustMonsterClothingAfterPolymorph, checkMonsterGearNextTurn,
} from './monworn.js';
import { updateMonsterWeaponAfterPolymorph } from './monster_weapon.js';
import { monsterSelfTouchAfterPolymorph } from './monster_stoning.js';
import { setMonsterApparentHeroPosition } from './monster_perception.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { makeMonsterFlee } from './monster_flee.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { finishMonsterEating } from './monster_eating.js';
import { setMimicAppearance } from './mklev.js';
import { smellUnseenMonster } from './monster_smell.js';
import { isHumanWereMonster, isWereMonster, transformWereMonster } from './were.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { adjustRiderAfterSteedPolymorph } from './steed.js';
import { BOULDER } from './object_data.js';
import { monsterCarriesSpecialObject } from './wizard.js';
import { rn1, rn2 } from './rng.js';
import { monsterEmitsLight } from './vision.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { toptenMonsterForm } from './topten.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { relocateMonsterTo } from './teleport.js';
import {
    initializeMonsterWormBody, removeMonsterWormBody,
} from './monster_worm.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { MonsterSelfTouchResult, PetrificationDeathHandler } from './monster_stoning.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

export interface MonsterFormChangeOptions {
    showMessage?: boolean;
    publish?: MessagePublisher;
    finishDeath?: PetrificationDeathHandler;
    creditHero?: boolean;
    polyspot?: boolean;
}

interface MonsterFormChangeIdentity {
    oldMnum: number;
    newMnum: number;
    leashReleased: boolean;
    leashReleaseVisible: boolean;
}

interface MonsterFormChangeEffects {
    droppedWeapon: GameObject | null;
    droppedClothing: GameObject[];
    destroyedClothing: GameObject[];
    droppedBoulders: GameObject[];
    selfTouch: MonsterSelfTouchResult;
    message: string | null;
}

// Expulsion, self-touch or dismounting can end the game before later changes.
export type MonsterFormChange = MonsterFormChangeIdentity & (
    | ({ heroDied: true } & Partial<MonsterFormChangeEffects>)
    | ({ heroDied: false } & MonsterFormChangeEffects)
);

const M1_HUMANOID = 0x00020000;
const M1_ANIMAL = 0x00040000;
const M2_NOPOLY = 0x00000001;
const M2_SHAPESHIFTER = 0x00004000;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const M2_ROCKTHROW = 0x08000000;
const S_VAMPIRE = 48;
const S_LIGHT = 25;

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
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const PM_STUDENT = MONSTER_NAME.indexOf('student');
const PM_APPRENTICE = MONSTER_NAME.indexOf('apprentice');
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
const POLYMORPH_IMMUNE_MONSTERS = new Set([
    'Nazgul', 'erinys', 'Death', 'Pestilence', 'Famine',
].map(monsterIndexByName));
const PLACEHOLDER_MONSTERS = new Set([
    'orc', 'giant', 'elf', 'human',
].map(monsterIndexByName));

function monsterIndexByName(name: string): number {
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

const NASTY_SHAPE_DEMOTIONS: readonly (readonly [string, string])[] = [
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
];
const NASTY_BIG_TO_LITTLE = new Map(NASTY_SHAPE_DEMOTIONS.map(([large, small]): [number, number] => [
    monsterIndexByName(large), monsterIndexByName(small),
]));

function monsterIsGenocided(mnum: number): boolean {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & 0x02);
}

export function pickNastyShape(difficultyCap: number): number {
    let result = pickNastyCandidate();
    if (Is_rogue_level(game.u?.uz)
        && !/^[A-Z]$/.test(monsterClassSymbol(result))) {
        result = pickNastyCandidate();
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

function pickNastyCandidate(): number {
    const result = NASTY_MONSTERS[rn2(NASTY_MONSTERS.length)];
    if (result === undefined) throw new RangeError('Nasty monster selection is outside its species list');
    return result;
}

function acceptsShapechangerForm(baseMnum: number, targetMnum: number): boolean {
    if (!Number.isInteger(targetMnum) || targetMnum < 0
        || monsterIsGenocided(targetMnum) || PLACEHOLDER_MONSTERS.has(targetMnum)) return false;
    if (monsterIsPlayerMonster(targetMnum) || targetMnum === baseMnum)
        return true;
    return !((MONSTER_FLAGS2[targetMnum] ?? 0) & M2_NOPOLY);
}

function randomShape(baseMnum: number): number {
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

function dragonArmorForm(monster: Monster): number | null {
    const armor = (monster?.minvent || monster?.inventory || []).find(
        object => ((object.owornmask ?? 0) & W_ARM) !== 0,
    );
    return dragonFormForArmor(armor);
}

function selectOrdinaryPolymorphForm(monster: Monster): number | null {
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

async function selectDoppelgangerFormOnce(monster: Monster): Promise<number> {
    let targetMnum = -1;
    if (!rn2(7)) {
        targetMnum = pickNastyShape(
            (MONSTER_DIFFICULTY[PM_JABBERWOCK] ?? 0) - 1,
        );
    } else if (rn2(3)) {
        targetMnum = await toptenMonsterForm(monster);
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

async function selectDoppelgangerForm(monster: Monster): Promise<number | null> {
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = await selectDoppelgangerFormOnce(monster);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(game.u.uz);
        if (acceptsShapechangerForm(PM_DOPPELGANGER, targetMnum)
            && (!wantsUppercase || /^[A-Z]$/.test(monsterClassSymbol(targetMnum))))
            return targetMnum;
    }
    return null;
}

function selectChameleonForm(): number | null {
    const animals = Array.from({ length: SPECIAL_PM }, (_, mnum) => mnum)
        .filter(mnum => (MONSTER_FLAGS1[mnum] ?? 0) & M1_ANIMAL);
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = !rn2(3)
            ? pickAnimalShape(animals)
            : randomShape(PM_CHAMELEON);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(game.u.uz);
        if (acceptsShapechangerForm(PM_CHAMELEON, targetMnum)
            && (!wantsUppercase || /^[A-Z]$/.test(monsterClassSymbol(targetMnum))))
            return targetMnum;
    }
    return null;
}

// C pick_animal() gives the Rogue level one extra animal draw. newcham()
// then applies its usual first-five-attempt uppercase preference.
function pickAnimalShape(animals: readonly number[]): number {
    let species = animals[rn2(animals.length)];
    if (species === undefined) throw new RangeError('Chameleon selection is outside its animal list');
    if (Is_rogue_level(game.u.uz) && !/^[A-Z]$/.test(monsterClassSymbol(species)))
        species = animals[rn2(animals.length)];
    if (species === undefined) throw new RangeError('Chameleon selection is outside its animal list');
    return species;
}

function selectSandestinForm(): number | null {
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = rn2(7)
            ? pickNastyShape((MONSTER_DIFFICULTY[PM_ARCHON] ?? 0) - 1)
            : randomShape(PM_SANDESTIN);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(game.u?.uz);
        if (acceptsShapechangerForm(PM_SANDESTIN, targetMnum)
            && (!wantsUppercase || /^[A-Z]$/.test(monsterClassSymbol(targetMnum))))
            return targetMnum;
    }
    return null;
}

export function shapechangerGender(baseMnum: number, targetMnum: number, female: boolean): boolean {
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

function pickVampireShape(monster: Monster): number {
    const baseMnum = monster.cham;
    if (baseMnum === undefined || baseMnum < 0)
        throw new Error(`Vampire ${monster.m_id} has no natural species`);
    const uppercaseOnly = Is_rogue_level(game.u?.uz);
    let targetMnum = baseMnum;
    const keepsSpecialObject = baseMnum === PM_VLAD_THE_IMPALER
        && monsterCarriesSpecialObject(monster);
    if (!keepsSpecialObject) {
        const wolfChance = baseMnum === PM_VLAD_THE_IMPALER ? 3 : 10;
        if ((baseMnum === PM_VAMPIRE_LEADER || baseMnum === PM_VLAD_THE_IMPALER)
            && !rn2(wolfChance) && !uppercaseOnly
            && !isPoolAt(monster.mx, monster.my)
            && !isLavaAt(monster.mx, monster.my)) {
            targetMnum = PM_WOLF;
        } else {
            targetMnum = !rn2(4) && !uppercaseOnly
                ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
        }
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

function naturalShapechanger(mnum: number): boolean {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_SHAPESHIFTER);
}

// C mon.c:rescham()/normal_shape(). The level array reverses fmon's order;
// the snapshot also preserves the next actor while polymorph changes state.
export async function restoreNaturalMonsterShapes(
    state: GameState = game, publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    requireLiveGame(state);
    for (const monster of [...(state.level?.monsters ?? [])].reverse()) {
        if (monster.mhp <= 0 || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR) continue;
        await normalizeMonsterShape(monster, state, publish);
        if (state.program_state.gameover) return;
    }
}

// C mon.c:restore_cham(). This restoration is independent of elapsed turns:
// protection can have changed while the monster's level was unloaded.
export async function restoreMonsterShape(monster: Monster, state: GameState = game): Promise<void> {
    requireLiveGame(state);
    if (state.u.protectionFromShapeChangers || state.protectionFromShapeChangers
        || monster.mcan) {
        await normalizeMonsterShape(monster, state, plineWithContinuation);
    } else if (monster.cham === NON_PM) {
        monster.cham = naturalShapechanger(monster.mnum) ? monster.mnum : NON_PM;
    }
}

export interface MonsterShapeNormalization {
    changed: boolean;
    heroDied: boolean;
}

// C mon.c:normal_shape(), shared by cancellation, protection and restoration.
// A change means a different body, a revealed disguise, or an interrupted meal.
export async function normalizeMonsterShape(
    monster: Monster, state: GameState = game, publish: MessagePublisher = plineWithContinuation,
): Promise<MonsterShapeNormalization> {
    requireLiveGame(state);
    let changed = false;
    const naturalForm = monster.cham;
    if (ismnum(naturalForm)) {
        const cancelled = monster.mcan;
        const change = await changeMonsterForm(monster, naturalForm, state, { showMessage: true, publish });
        changed = !!change;
        if (change?.heroDied || state.program_state.gameover)
            return { changed, heroDied: true };
        monster.cham = NON_PM;
        if (cancelled) monster.mcan = 1;
        newsym(monster.mx, monster.my);
    }
    if (isWereMonster(monster) && !isHumanWereMonster(monster)) {
        changed = await transformWereMonster(monster, state, { publish }) || changed;
        if (state.program_state.gameover) return { changed, heroDied: true };
    }
    const appearance = M_AP_TYPE(monster);
    if (appearance === M_AP_NOTHING) return { changed, heroDied: false };
    if (monster.meating) finishMonsterEating(monster, state);
    else {
        if (appearance !== M_AP_MONSTER) monster.msleeping = 1;
        revealMonsterAppearance(monster);
    }
    return { changed: true, heroDied: false };
}

// C mon.c:restartcham(). Cancellation still forbids changing form; a sleeping
// mimic regains its ordinary disguise once protection stops suppressing it.
export async function restartMonsterShapechanging(state: GameState = game): Promise<void> {
    requireLiveGame(state);
    for (const monster of [...(state.level?.monsters ?? [])].reverse()) {
        if (monster.mhp <= 0 || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR) continue;
        if (!monster.mcan)
            monster.cham = naturalShapechanger(monster.mnum) ? monster.mnum : NON_PM;
        if (MONSTER_SYMBOL[monster.mnum] === 13 && monster.msleeping) { // S_MIMIC
            await setMimicAppearance(monster);
            newsym(monster.mx, monster.my);
        }
    }
}

async function dropBouldersTheNewFormCannotCarry(
    monster: Monster, state: GameState, polyspot: boolean, publish: MessagePublisher,
): Promise<GameObject[]> {
    if ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW) return [];
    const boulders = (monster.minvent || monster.inventory || [])
        .filter(object => object.otyp === BOULDER);
    const dropped: GameObject[] = [];
    for (const object of boulders) {
        if (monster.dead || monster.mhp <= 0) break;
        if (polyspot) {
            bypassObject(object, state);
        }
        unlinkMonsterObject(monster, object);
        const placed = await landFloorObject(object, monster.mx, monster.my, { state, publish });
        if (placed) dropped.push(placed);
    }
    return dropped;
}

function initialShapechangedMonster<T extends Monster>(monster: T, targetMnum: number): T {
    const baseMnum = monster.mnum;
    const female = shapechangerGender(
        baseMnum, targetMnum, !!monster.female,
    );
    const { level, hp } = newMonsterHitPoints(targetMnum);
    const permanentlyInvisible = targetMnum === PM_STALKER
        || targetMnum === PM_BLACK_LIGHT;
    const oldNaturallyInvisible = baseMnum === PM_STALKER
        || baseMnum === PM_BLACK_LIGHT;
    const inventory: GameObject[] = [];
    // Keep the actor already linked on the level while changing its body.
    monster.mnum = targetMnum;
    monster.cham = baseMnum;
    monster.mhp = monster.mhpmax = hp;
    monster.m_lev = level;
    monster.female = female;
    monster.msleeping = monster.msleeping ?? 0;
    monster.mpeaceful = monster.mpeaceful ? 1 : 0;
    monster.mcanmove = 1;
    monster.mcansee = monster.mcansee ?? 1;
    if (!monster.perminvis || oldNaturallyInvisible)
        monster.perminvis = permanentlyInvisible;
    monster.minvis = monster.invis_blkd ? 0 : !!monster.perminvis;
    monster.movement = 0;
    monster.mmove = MONSTER_MOVE[targetMnum] ?? 0;
    monster.mspeed = 0;
    monster.symbol = monsterClassSymbol(targetMnum);
    monster.color = requireMonsterData(MONSTER_COLOR, targetMnum);
    monster.hasInventory = false;
    monster.minvent = monster.inventory = inventory;
    monster.weaponCheck = 0;
    // newcham() owns a fresh worm body, including its tail roll. The
    // caller's MM_NOTAIL only controls an ordinary long-worm birth.
    if (targetMnum === PM_LONG_WORM) initializeMonsterWormBody(monster);
    return monster;
}

export async function initialShapechangedBirth<T extends Monster>(monster: T): Promise<T | null> {
    const baseMnum = monster?.mnum;
    if (!naturalShapechanger(baseMnum) || shapechangerProtectionActive())
        return null;
    monster.cham = baseMnum;
    // makemon() keeps Vlad in his natural body to carry the Candelabrum.
    if (baseMnum === PM_VLAD_THE_IMPALER) return null;
    // newcham() saves this name even with NC_SHOW_MSG disabled, so
    // hallucination must choose it before selecting the new body.
    monsterName(monster);

    let targetMnum: number | null = null;
    if (baseMnum === PM_DOPPELGANGER) {
        targetMnum = await selectDoppelgangerForm(monster);
        if (targetMnum === PM_DOPPELGANGER) targetMnum = null;
    } else if (baseMnum === PM_CHAMELEON) {
        targetMnum = selectChameleonForm();
        if (targetMnum === PM_CHAMELEON) targetMnum = null;
    } else if (baseMnum === PM_SANDESTIN) {
        targetMnum = selectSandestinForm();
    } else if (baseMnum === PM_VAMPIRE || baseMnum === PM_VAMPIRE_LEADER) {
        targetMnum = pickVampireShape(monster);
    }
    if (targetMnum === null || targetMnum === baseMnum
        || !acceptsShapechangerForm(baseMnum, targetMnum))
        return null;
    const changed = initialShapechangedMonster(monster, targetMnum);
    changed.meverseen = 0;
    newsym(changed.mx, changed.my);
    // newcham() ends with mon_break_armor() even for a newborn without
    // armor; its perceived pronouns still draw while the hero hallucinates.
    await adjustMonsterClothingAfterPolymorph(changed, game);
    await refreshNewMonsterFormPerception(changed, game, plineWithContinuation);
    return changed;
}

export async function changeMonsterForm(
    monster: Monster, forcedTargetMnum: number | null = null, state: GameState = game,
    {
        showMessage = false,
        publish = plineWithContinuation,
        finishDeath = (target, options) => finishEnvironmentalMonsterDeath(target, state, options),
        creditHero = !state.context?.mon_moving,
        polyspot = false,
    }: MonsterFormChangeOptions = {},
): Promise<MonsterFormChange | null> {
    requireLiveGame(state);
    let baseMnum = monster.cham !== undefined
        && Number.isInteger(monster.cham) && monster.cham >= 0
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

    const oldMnum = monster.mnum;
    const wasSpotted = canSpotMonster(monster);
    const oldSubject = showMessage ? monsterFormChangeName(monster, { state }) : null;
    const oldName = monsterName(monster, { state });
    const oldWasFluid = monsterIsAmorphous(monster) || monsterIsWhirly(monster);

    let targetMnum = forcedTargetMnum;
    if (targetMnum == null && baseMnum === PM_DOPPELGANGER) {
        targetMnum = await selectDoppelgangerForm(monster);
    } else if (targetMnum == null && baseMnum === PM_SANDESTIN) {
        targetMnum = selectSandestinForm();
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
    if (targetMnum == null || targetMnum === monster.mnum
        || monsterIsGenocided(targetMnum)) return null;

    if (monster.wormno) {
        removeMonsterWormBody(monster);
        placeMonsterAt(monster, monster.mx, monster.my);
    }
    if (M_AP_TYPE(monster) && MONSTER_SYMBOL[targetMnum] !== 13)
        revealMonsterAppearance(monster);
    const oldHp = Math.max(1, monster.mhp ?? 1);
    const oldMax = Math.max(1, monster.mhpmax ?? oldHp);
    const female = shapechangerGender(baseMnum, targetMnum, !!monster.female);
    if (In_endgame(state.u.uz) && monsterIsPlayerMonster(oldMnum)) {
        const name = MGIVENNAME(monster);
        const rank = name.indexOf(' the ');
        if (rank >= 0) setMonsterGivenName(monster, name.slice(0, rank));
    }
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
        leashReleaseVisible = canSeeMonster(monster);
        await releaseMonsterLeashWithFeedback(monster, { state, publish });
        leashReleased = true;
    }
    if (monsterEmitsLight(oldMnum) !== monsterEmitsLight(targetMnum))
        state.vision_full_recalc = 1;
    if (!monster.perminvis || oldNaturallyInvisible)
        monster.perminvis = naturallyInvisible;
    monster.minvis = monster.invis_blkd ? 0 : !!monster.perminvis;
    if (monster.mundetected) await hideMonsterUnder(monster, state);
    if (state.u.ustuck === monster) {
        if (state.u.uswallow) {
            if (!monsterCanEngulf(monster)) {
                if (!monsterIsNoncorporeal(monster) && !monsterIsWhirly(monster)
                    && !monsterIsAmorphous(monster)
                    && MONSTER_SYMBOL[targetMnum] !== S_LIGHT) {
                    const trail = monsterIsVampireShifter(monster)
                        ? ` which was a shapeshifted ${namelessMonsterName(monster, { state })}`
                        : monsterDigests(monster) ? "'s stomach" : '';
                    await publish(`You ${oldWasFluid ? 'emerge from' : 'break out of'} ${oldName}${trail}!`);
                    monster.mhp = 1;
                    showMessage = false;
                }
                const expulsion = await expelHero(monster, {
                    state, publish, message: false, engulfingSpecies: oldMnum,
                });
                if (expulsion.died) return {
                    oldMnum, newMnum: targetMnum, heroDied: true,
                    leashReleased, leashReleaseVisible,
                };
            } else {
                swallowed(false);
            }
        } else if ((!monsterSpeciesSticks(targetMnum) && !heroFormSticks(state))
            || monsterIsUnsolid(monster)) {
            await releaseHeroFromMonster(monster, { state, publish });
        }
    }
    if (targetMnum === PM_LONG_WORM)
        initializeMonsterWormBody(monster);
    monster.meverseen = 0;

    newsym(monster.mx, monster.my);
    let message: string | null = null;
    if (showMessage) {
        const nowSpotted = canSpotMonster(monster);
        if (nowSpotted) {
            if (wasSpotted)
                message = `${oldSubject} turns into ${namelessMonsterName(monster, { state, article: 'a' })}!`;
            else
                message = `${monsterName(monster, {
                    state, capitalized: true, article: monster.mtame ? 'your' : 'a',
                    suppressSaddle: false,
                })} appears!`;
            await publish(message);
        } else {
            if (wasSpotted) {
                message = `${oldSubject} disappears!`;
                await publish(message);
            }
            // C newcham(): a form the hero cannot spot may still reach the nose.
            await smellUnseenMonster(targetMnum, state, publish);
        }
    }
    if (baseMnum < 0 && MONSTER_SYMBOL[targetMnum] === S_VAMPIRE
        && naturalShapechanger(targetMnum)
        && !shapechangerProtectionActive()) {
        monster.cham = targetMnum;
    }
    const droppedWeapon = await updateMonsterWeaponAfterPolymorph(monster, state, { publish, polyspot });
    const clothing = await adjustMonsterClothingAfterPolymorph(monster, state, { publish, polyspot });
    const selfTouch = await monsterSelfTouchAfterPolymorph(monster, {
        finishDeath, creditHero, publish, state,
    });
    if (selfTouch.heroDied) return {
        oldMnum, newMnum: targetMnum, heroDied: true,
        leashReleased, leashReleaseVisible, droppedWeapon,
        droppedClothing: clothing.dropped, destroyedClothing: clothing.destroyed,
        selfTouch, message,
    };
    checkMonsterGearNextTurn(monster);
    const droppedBoulders = selfTouch.survived
        ? await dropBouldersTheNewFormCannotCarry(monster, state, polyspot, publish) : [];
    const steedChange = state.u.usteed === monster
        ? await adjustRiderAfterSteedPolymorph(monster, oldMnum, state, publish) : null;
    if (!steedChange?.died && !state.program_state.gameover)
        await refreshNewMonsterFormPerception(monster, state, publish);
    return {
        oldMnum,
        newMnum: targetMnum,
        heroDied: !!steedChange?.died || !!state.program_state.gameover,
        leashReleased,
        leashReleaseVisible,
        droppedWeapon,
        droppedClothing: clothing.dropped,
        destroyedClothing: clothing.destroyed,
        droppedBoulders,
        selfTouch,
        message,
    };
}

// C mon.c:newcham() tail. A form changed during monster movement gets a
// fresh chance to locate the hero, then tests fear using that new body.
async function refreshNewMonsterFormPerception(
    monster: Monster, state: GameState, publish: MessagePublisher,
): Promise<void> {
    if (!state.context.mon_moving) return;
    if (monster.mux !== state.u.ux || monster.muy !== state.u.uy)
        setMonsterApparentHeroPosition(monster, state, rn2);
    const targetX = monster.mux ?? 0, targetY = monster.muy ?? 0;
    const dx = monster.mx - targetX, dy = monster.my - targetY;
    const nearby = dx * dx + dy * dy < 3
        && !(monster.mnum === PM_GRID_BUG && dx && dy);
    if (!monster.mpeaceful && monsterIsScaredAt(monster, state, targetX, targetY) && nearby)
        await makeMonsterFlee(monster, {
            state, turns: rn1(9, 2), first: true, announce: true, publish,
        });
}

function vampireMayShiftOutOfSight(monster: Monster, state: GameState): boolean {
    const visible = canSeeMonster(monster);
    const dx = monster.mx - (state.u?.ux ?? monster.mx);
    const dy = monster.my - (state.u?.uy ?? monster.my);
    return !visible || dx * dx + dy * dy > BOLT_LIM * BOLT_LIM;
}

export async function decideMonsterShapeChange(
    monster: Monster, state: GameState = game, random = rn2,
    { publish = plineWithContinuation }: { publish?: MessagePublisher } = {},
): Promise<MonsterFormChange | null> {
    const baseMnum = monster.cham !== undefined
        && Number.isInteger(monster.cham) && monster.cham >= 0
        ? monster.cham : null;
    if (baseMnum === null) return null;

    const vampireShifter = baseMnum === PM_VAMPIRE
        || baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER;
    let targetMnum: number | null = null;
    let shouldChange = false;
    if (!vampireShifter) {
        if (!(monster.mspec_used ?? 0) && random(6) === 0) {
            monster.mspec_used = 3 + random(10);
            shouldChange = true;
        }
    } else if (!((monster.mstrategy ?? 0) & STRAT_WAITFORU)) {
        const inVampireForm = MONSTER_SYMBOL[monster.mnum] === S_VAMPIRE;
        if (!inVampireForm) {
            if (monster.mhp <= Math.trunc(((monster.mhpmax ?? 0) + 5) / 6)
                && random(4) !== 0) {
                targetMnum = baseMnum;
                shouldChange = true;
            } else if (monster.mnum === PM_FOG_CLOUD
                && monster.mhp === monster.mhpmax
                && random(4) === 0
                && vampireMayShiftOutOfSight(monster, state)) {
                targetMnum = pickVampireShape(monster);
                shouldChange = targetMnum !== monster.mnum;
            }
            const square = state.level?.at(monster.mx, monster.my);
            if (shouldChange && monsterIsAmorphous(monster)
                && square?.typ === DOOR && square.doormask & (D_CLOSED | D_LOCKED)) {
                const position = findNearbyMonsterPosition(targetMnum, monster.mx, monster.my, { state, random });
                if (position) await relocateMonsterTo(monster, position.x, position.y, { state, random });
            }
        } else if (monster.mhp >= Math.trunc(9 * (monster.mhpmax ?? 0) / 10)
            && random(6) === 0
            && vampireMayShiftOutOfSight(monster, state)) {
            shouldChange = true;
        }
    }
    if (!shouldChange) return null;

    const wasFemale = !!monster.female;
    const change = await changeMonsterForm(
        monster, targetMnum, state, { showMessage: true, publish },
    );
    if (change?.heroDied) return change;
    if (change && vampireShifter) {
        const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
        if (!(flags & (M2_MALE | M2_FEMALE | M2_NEUTER)))
            monster.female = wasFemale;
    }
    return change;
}
