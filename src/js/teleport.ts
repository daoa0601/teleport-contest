
import {
    setHeroGrip, releaseHeroFromMonster, maybeUnhideAt, monsterInAir, sendMonsterToLimbo,
} from './mon.js';
import { monsterHasMapPosition, monsterAtPosition, placeMonsterOnMap, removeMonsterFromMapAt } from './steed.js';
import { updateHeroRegions, updateMonsterRegions } from './region.js';
import { clearMonsterWormFromMap, placeMonsterWormTailRandomly } from './worm.js';
import { game, requireLiveGame, requireGameLevel, requirePlayingGame } from './gstate.js';
import { selectMapPosition } from './getpos.js';
import { formatFeltMessage, pline, plineWithContinuation, impossible } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { currentAttribute, exerciseWisdom } from './attrib.js';
import { castSpell, createMemorizedSpell, knownSpell } from './spell.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu } from './wintty.js';
import { flushPendingTopline } from './topl.js';
import { showPagedPickOneMenu } from './windows.js';
import { addInventoryItem } from './invent.js';
import { finishHeroDeath } from './end.js';
import { dist2, distmin } from './hacklib.js';
import { within_bounded_area } from './rect.js';
import { clampHoleDestination, deleteTrap, seeTrap, mintrap, fillPitWithBoulderAt, resetUtrap, heroIsUnconscious, trapAt } from './trap.js';
import type { HeroTrapOptions } from './trap.js';
import { Is_botlevel, levelAtDepth, levelDepthByName, insideWizardTower, levelIsWizardTower, printDungeon, specialDisplayName, surfaceName, In_quest, In_mines, sameDungeonLevel } from './dungeon.js';
import { propertyIsActive } from './properties.js';
import { bot } from './botl.js';
import { noticeAllMonsters, withMonsterNoticesBlocked, nomul, shouldShowGetposTip, showGetposTip, heroLocomotion, announceInvocationSquare, checkSpecialRoom, exceedsActionCapacity, nearCapacity, SLT_ENCUMBER, roomsAt, switchHeroTerrain, finishDestinationSpotEffects } from './hack.js';
import type { SpotEffectResult } from './hack.js';
import { findVaultGuard, noticeVaultEscape } from './vault.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, docrt, newsym, see_monsters, shieldeff } from './display.js';
import { vision_recalc, couldsee } from './vision.js';
import { leashAttachedToMonster, releaseMonsterLeash, bringLeashedFollowers } from './apply.js';
import { rn2, rnd, rnl } from './rng.js';
import { isok } from './cmd.js';
import { MONSTER_GENO, MONSTER_SYMBOL } from './monster_data.js';
import { AMULET_OF_YENDOR, BOULDER, CORPSE, oc_level, RIN_TELEPORTATION, RIN_TELEPORT_CONTROL, SCR_SCARE_MONSTER, SPE_TELEPORT_AWAY, WAN_TELEPORTATION } from './object_data.js';
import { morehungry } from './eat.js';
import { beginBallAndChainMove, finishBallAndChainMove, heroIsPunished, placeBallAndChain, unplaceBallAndChain } from './ball.js';
import { ACCESSIBLE, ALTAR, CC_INCL_CENTER, CC_NO_FLAGS, CC_RING_PAIRS, CC_SKIP_INACCS, CC_SKIP_MONS, CC_UNSHUFFLED, COLNO, D_CLOSED, D_LOCKED, DOOR, GP_ALLOW_U, GP_ALLOW_XY, GP_AVOID_MONPOS, GP_CHECKSCARY, IS_STWALL, LEVEL_TELEP, MAGIC_PORTAL, MAX_TYPE, MM_IGNORELAVA, MM_IGNOREWATER, RLOC_ERR, RLOC_MSG, RLOC_NOMSG, RLOC_NONE, ROWNO, SHOPBASE, STRAT_APPEARMSG, TELEP_TRAP, TT_BURIEDBALL, VAULT, VIBRATING_SQUARE, WATER, W_NONPASSWALL, ZAP_POS, In_endgame, In_sokoban, Is_stronghold, Is_waterlevel, MIGR_PORTAL, MIGR_RANDOM, M_AP_NOTHING, MON_FLOOR, Upolyd, is_hole, is_pit, A_STR, BOLT_LIM, HOLE, MENU_ITEMFLAGS_SELECTED, NHW_MENU, PICK_ONE } from './const.js';
import { priestIsInOwnTemple, templeRoomAt } from './priest.js';
import { costlySpot, shopkeeperInOwnShop, findObjectOwner, onBillEntry, stolenValue, makeAngryShopkeeper, addShopObjectToBill, costlyAdjacent, removeObjectAndContentsFromBill, leaveHeroShop } from './shk.js';
import { interruptOccupationForMonster, setMonsterApparentHeroPosition } from './monmove.js';
import { monsterName } from './do_name.js';
import { hasCompletedEngraving } from './engrave.js';
import { searchSpecial, somexyspace } from './mkroom.js';
import { setTrack } from './track.js';
import { monsterIsScaredAt } from './monmove.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { heroHasWaterWalking } from './do_wear.js';
import { heroLikesLava, heroSpecies } from './polyself.js';
import type { MonsterFearProbe } from './monmove.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { getLine } from './windows.js';
import { heroIsBlind, setHeroBlindnessTurns, heroIsHallucinating } from './senses.js';
import { buriedBallToPunishment } from './dig.js';
import { depth, placeHeroOnLevel } from './dungeon.js';
import { makeStunned, makeConfused } from './potion.js';
import type { Dungeon, DungeonLocation } from './dungeon_types.js';
import type { WizardLevelDestination } from './dungeon.js';
import { learnObjectType, recordObjectEncounter } from './o_init.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameMap } from './game.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Position, Rectangle, Trap, ArrivalRegion } from './map_types.js';
import { hasShopkeeperData } from './shop_types.js';
import type { MonsterCallLog, MonsterRelocation, MonsterTeleportTrapEvent } from './monster_action_types.js';
import { publishMonsterYelp } from './sounds.js';
import { migrateMonsterOffLevel } from './dog.js';
import { isHomeElemental } from './makemon.js';
import { reviveCorpseImmediately, applyFloorEffects } from './do.js';
import { unlinkObject, placeObject, mksobj} from './mkobj.js';
import { gotoLevel, gotoLevel as changeLevel, scheduleLevelChange } from './do.js';
import {
    monsterIsAmphibious, monsterIsSwimmer, monsterPassesWalls, monsterIsAmorphous, monsterThrowsRocks, is_lord,
    is_prince, monsterHasEyes, monsterIsCovetous, monsterIsEel, monsterCanTeleport, monsterControlsTeleport,
    monsterIsRider, monsterIsSilent,
} from './mondata.js';

// teleport.js - same-level teleportation.
// C ref: teleport.c teleok(), safe_teleds(), teleds(), and tele_trap().

type RandomBelow = (limit: number) => number;
type LevelGameState = GameState & { level: GameMap };
export interface HeroTeleportMovement extends Position { oldx: number; oldy: number }
export interface HeroDestinationRequest { onPrompt: () => Promise<void> }
export interface HeroTeleportOptions<Arrival extends ArrivalResult = DefaultArrival> {
    chooseDestination?: (request: HeroDestinationRequest) => Promise<Position | null>;
    source?: GameObject | null;
    discover?: (() => unknown) | null;
    state?: GameState;
    random?: RandomBelow;
    rollOne?: RandomBelow;
    finishArrival?: (movement: HeroTeleportMovement) => Promise<Arrival>;
    publish?: MessagePublisher;
}
export interface RelocationOptions {
    state?: GameState;
    calls?: MonsterCallLog | null;
    random?: RandomBelow;
    rollOne?: RandomBelow;
    flags?: number;
}
type ArrivalResult = { died?: boolean } | null | undefined | void;
interface TeleportAtWillOptions<Arrival extends ArrivalResult> {
    state?: GameState;
    random?: RandomBelow;
    rollOne?: RandomBelow;
    chooseDestination?: (() => Promise<Position | null>) | null;
    finishArrival?: (movement: HeroTeleportMovement) => Promise<Arrival>;
    publish?: MessagePublisher;
    ignoreRestrictions?: boolean;
}
export interface TeleportAtWillResult<Arrival> {
    moved: boolean;
    died: boolean;
    spentTime: boolean;
    arrival?: Arrival;
}
type HeroTeleportResult<Arrival> =
    | { moved: false; died: boolean }
    | { moved: true; died: boolean; movement: HeroTeleportMovement; arrival: Arrival };
type DefaultArrival = Awaited<ReturnType<typeof finishTeleportArrival>>;
interface HeroTeleportMoveOptions<Arrival extends ArrivalResult> {
    allowDrag?: boolean;
    finishArrival?: (movement: HeroTeleportMovement) => Promise<Arrival>;
}
export interface SafeTeledsOptions<Arrival extends ArrivalResult> {
    random?: RandomBelow;
    rollOne?: RandomBelow;
    allowDrag?: boolean;
    finishArrival?: (movement: HeroTeleportMovement) => Promise<Arrival>;
}
interface HeroTeleportArrival<Arrival> {
    movement: HeroTeleportMovement;
    arrival: Arrival;
}

// Port only: narrow teleportation state to a loaded level.
export function requireLevel(state: GameState): asserts state is LevelGameState {
    if (!state.level) throw new Error('Teleportation requires a dungeon level.');
}

const G_UNIQ = 0x1000;
const S_ANGEL = 27;
const S_DEMON = 56;
const S_ELEMENTAL = 31;
const S_HUMAN = 53;
const S_MIMIC = 13;
const S_VAMPIRE = 48;
const PM_FLOATING_EYE = 28;
const PM_FIRE_ELEMENTAL = 155;
const PM_MINOTAUR = 177;
const PM_DEATH = 311;
const PM_PESTILENCE = 312;
const PM_FAMINE = 313;
const PM_SALAMANDER = 329;

// Part of C youprop.h:Teleportation()/Teleport_control(): the E<Prop>
// W_RING half, resolved from the worn rings across the equipment aliases.
function wornRing(state: GameState, objectType: number) {
    return [
        state?.uleft, state?.uright,
        state?.u?.uleft, state?.u?.uright,
    ].some(ring => ring?.otyp === objectType);
}

// C youprop.h:Teleportation()
export function heroHasTeleportation(state: GameState) {
    const u = state?.u;
    if (u?._propertySources?.teleportation)
        return propertyIsActive('teleportation', state);
    return !!(u?.teleporting || u?.teleportation
        || (u?.teleportingTurns ?? 0) > 0
        || wornRing(state, RIN_TELEPORTATION));
}

// Part of C teleport.c:dotele(): test teleportation granted by the hero's form.
export function heroFormCanTeleport(state: GameState) {
    return Upolyd(state.u) && state.u.umonnum !== undefined
        && monsterCanTeleport(state.u.umonnum);
}

// Part of C teleport.c:dotele(): combine intrinsic and form-based teleportation.
export function heroCanTeleport(state = game) {
    return heroHasTeleportation(state) || heroFormCanTeleport(state);
}

// C youprop.h:Teleport_control()
export function heroControlsTeleport(state = game) {
    const u = state?.u;
    return !!(u?.teleportControl
        || wornRing(state, RIN_TELEPORT_CONTROL)
        || (Upolyd(u) && u.umonnum !== undefined && monsterControlsTeleport(u.umonnum)));
}

// Part of C teleport.c:tele_trap(): decide why a hero teleport trap is blocked.
export function heroTeleportTrapBlock(state = game) {
    const level = state?.u?.uz;
    const astral = state?.astral_level;
    if (level && astral && level.dnum === astral.dnum) return 'endgame';
    if (state?.u?.antimagic)
        return 'antimagic';
    if (heroTeleportRestricted(state)) return 'level';
    return null;
}

// C teleport.c:m_blocks_teleporting().
function monsterIsDemonRuler(monster: Pick<Monster, 'mnum'>) {
    return MONSTER_SYMBOL[monster?.mnum] === S_DEMON
        && (is_lord(monster?.mnum) || is_prince(monster?.mnum));
}

// Part of C teleport.c:noteleport_level(): check Gehennom's demon court.
// noteleport_level's In_hell half: the demon court in Gehennom, scanned
// through get_iter_mons with the m_blocks_teleporting filter.
function demonCourtBlocksTeleport(monster: Pick<Monster, 'mnum'>, state: GameState) {
    const inHell = !!state?.dungeons?.[state?.u?.uz?.dnum ?? -1]
        ?.flags?.hellish;
    if (!inHell || monsterIsDemonRuler(monster)) return false;
    return state?.level?.monsters?.some(candidate =>
        candidate !== monster && (candidate.mhp ?? 1) > 0
        && monsterIsDemonRuler(candidate)) ?? false;
}

// C teleport.c:noteleport_level().
export function monsterTeleportRestricted(monster: Pick<Monster, 'mnum'>, state = game) {
    if (demonCourtBlocksTeleport(monster, state)) return true;
    if (state?.level?.flags?.noteleport && !monsterIsCovetous(monster))
        return true;
    const stasisUntil = state?.level?.flags?.stasis_until;
    return typeof stasisUntil === 'number' && Number.isFinite(stasisUntil)
        && stasisUntil >= (state?.moves ?? 1);
}

// C teleport.c:tele_restrict(). Adds feedback to the shared level
// restriction when the monster is visible.
export async function reportMonsterTeleportRestriction(monster: Monster, {
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<boolean> {
    if (!monsterTeleportRestricted(monster, state)) return false;
    if (canSeeMonster(monster))
        await publish(`A mysterious force prevents ${monsterName(monster, { state })} from teleporting!`);
    return true;
}

// Part of C teleport.c:noteleport_level(): apply the restriction to the hero's current form.
// The native caller passes gy.youmonst: the hero's active polymorph form decides,
// with the original body when unpolyed.
export function heroTeleportRestricted(state = game) {
    const currentForm = state?.u?.mtimedone
        ? state.u.umonnum : state?.u?.umonster;
    if (currentForm === undefined) throw new Error('Teleportation requires a hero species.');
    return monsterTeleportRestricted({ mnum: currentForm }, state);
}

export type PlacementSubject = null | { kind: 'hero' }
    | { kind: 'monster'; monster: Monster }
    | { kind: 'species'; mnum: number };
export interface PositionOptions {
    state?: GameState;
    gpflags?: number;
    random?: (limit: number) => number;
}

// C teleport.c:goodpos(). Species subjects represent a zeroed temporary actor.
export function goodPosition(x: number, y: number, subject: PlacementSubject, {
    state = game, gpflags = 0, random = rn2,
}: PositionOptions = {}) {
    if (!isok(x, y)) return false;
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    if (!location) return false;
    const isHero = subject?.kind === 'hero';
    let monster: Monster | MonsterFearProbe | null = null;
    if (isHero) {
        const mnum = state.u.umonnum;
        if (mnum === undefined) throw new Error('Hero placement requires a species.');
        monster = { mnum, m_id: 1, mcansee: 0 };
        if (state.u.mcham !== undefined) monster.cham = state.u.mcham;
    } else if (subject?.kind === 'monster') {
        monster = subject.monster;
    } else if (subject?.kind === 'species') {
        monster = { mnum: subject.mnum };
    }
    const ignoreWater = !!(gpflags & MM_IGNOREWATER);
    const ignoreLava = !!(gpflags & MM_IGNORELAVA);
    const avoidMonsters = !!(gpflags & GP_AVOID_MONPOS);

    if (!(gpflags & GP_ALLOW_U) && state.u.ux === x && state.u.uy === y
        && !isHero && !(monster === state.u.ustuck && state.u.uswallow)
        && !(state.u.usteed && monster === state.u.usteed)) return false;

    const occupant = monsterAtPosition(level, x, y);
    if (occupant && avoidMonsters) return false;

    const pool = isPoolAt(x, y, state);
    const lava = isLavaAt(x, y, state);
    if (monster) {
        const mnum = monster.mnum;
        if (occupant && (occupant !== monster || ('wormno' in monster && monster.wormno))) return false;
        if (pool && !ignoreWater) {
            const surface = !Is_waterlevel(state.u.uz, state) && location.typ !== WATER;
            if (isHero) {
                return propertyIsActive('swimming', state)
                    || propertyIsActive('magicalBreathing', state)
                    || monsterIsAmphibious(monster.mnum)
                    || (surface && (propertyIsActive('levitation', state)
                        || propertyIsActive('flying', state) || heroHasWaterWalking(state)));
            }
            return monsterIsSwimmer(monster.mnum) || (surface && monsterInAir(monster, state));
        } else if (monsterIsEel(mnum) && random(13) && !ignoreWater) {
            return false;
        } else if (lava && !ignoreLava) {
            if (mnum === PM_FLOATING_EYE) return false;
            if (isHero) {
                const boots = state.uarmf || state.u.uarmf;
                return propertyIsActive('levitation', state) || propertyIsActive('flying', state)
                    || (!Is_waterlevel(state.u.uz, state) && propertyIsActive('fireResistance', state)
                        && heroHasWaterWalking(state) && !!boots?.oerodeproof)
                    || heroLikesLava(state);
            }
            return monsterInAir(monster, state)
                || mnum === PM_FIRE_ELEMENTAL || mnum === PM_SALAMANDER;
        }
        if (monsterPassesWalls(monster.mnum)
            && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL))) return true;
        if (monsterIsAmorphous(monster) && location.typ === DOOR
            && (location.doormask & (D_CLOSED | D_LOCKED))) return true;
        if (gpflags & GP_CHECKSCARY) {
            const scary = monster.m_id
                ? monsterIsScaredAt(monster, state, x, y)
                : monsterTypeScaredFromPosition(mnum, x, y, state);
            if (scary) return false;
        }
    }
    const accessible = ACCESSIBLE(location.typ)
        && !(location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)));
    if (!accessible && !(pool && ignoreWater) && !(lava && ignoreLava)) return false;
    if (!monsterThrowsRocks(monster?.mnum ?? -1) && level.objects[x]?.[y]?.some(
        object => object.otyp === BOULDER,
    )) return false;
    if (avoidMonsters && level.exclusionZones?.some(zone =>
        zone.type === 'monster-generation'
        && x >= zone.lx && x <= zone.hx && y >= zone.ly && y <= zone.hy)) return false;
    return true;
}

// C teleport.c:goodpos_onscary().
function monsterTypeScaredFromPosition(mndx: number, x: number, y: number, state: GameState) {
    const symbol = MONSTER_SYMBOL[mndx] ?? 0;
    if (symbol === S_HUMAN || symbol === S_ANGEL
        || [PM_DEATH, PM_PESTILENCE, PM_FAMINE].includes(mndx)
        || ((MONSTER_GENO[mndx] ?? 0) & G_UNIQ)) return false;
    const location = state.level?.at?.(x, y);
    if (location?.typ === ALTAR && symbol === S_VAMPIRE) return true;
    if (state.level?.objects?.[x]?.[y]?.some(
        object => object.otyp === SCR_SCARE_MONSTER,
    )) return true;
    const inHell = !!state.dungeons?.[state.u?.uz?.dnum ?? -1]?.flags?.hellish;
    const inFinalDungeon = !!state.u?.uz && !!state.astral_level
        && state.u.uz.dnum === state.astral_level.dnum;
    if (inHell || inFinalDungeon || mndx === PM_MINOTAUR
        || !monsterHasEyes(mndx)) return false;
    return hasCompletedEngraving('Elbereth', x, y, state);
}

export interface EnextoOptions {
    state?: GameState;
    random?: (limit: number) => number;
    calls?: { push(label: string): unknown } | null;
}

// C teleport.c:enexto(). The first complete search avoids scary squares;
// only total failure triggers an independently shuffled unrestricted search.
export function enexto(
    mdat: number | null | undefined, xx: number, yy: number,
    options: EnextoOptions = {},
): Position | null {
    return enexto_core(mdat, xx, yy, GP_CHECKSCARY, options)
        || enexto_core(mdat, xx, yy, 0, options);
}

// C teleport.c:enexto_gpflags().
export function enexto_gpflags(
    mdat: number | null | undefined, xx: number, yy: number, entflags: number,
    options: EnextoOptions = {},
): Position | null {
    return enexto_core(mdat, xx, yy, GP_CHECKSCARY | entflags, options)
        || enexto_core(mdat, xx, yy, entflags, options);
}

// C teleport.c:enexto_core(). Search the rings near <xx,yy> first, then the
// rest of the map in expanding distance; the scary-square retry belongs to
// the callers above. Exposing the core lets callbacks distinguish enexto
// failure from a later makemon()/make_familiar() construction failure.
export function enexto_core(
    mdat: number | null | undefined, xx: number, yy: number, entflags: number,
    { state = game, random = rn2, calls = null }: EnextoOptions = {},
): Position | null {
    const species = mdat ?? state.u.umonster;
    if (species === undefined) throw new Error('Nearby placement requires a monster species.');
    const subject: PlacementSubject = { kind: 'species', mnum: species };
    const fits = (point: Position) =>
        goodPosition(point.x, point.y, subject, { state, gpflags: entflags, random });
    const nearby = collect_coords(xx, yy, 3, CC_NO_FLAGS, { random, calls });
    const close = nearby.find(fits);
    if (close) return close;
    // NEW_ENEXTO deliberately reshuffles the near rings while collecting the
    // complete map, then skips their count because they were already tested.
    const all = collect_coords(xx, yy, 0, CC_NO_FLAGS, { random, calls });
    const distant = all.slice(nearby.length).find(fits);
    if (distant) return distant;
    if ((entflags & GP_ALLOW_XY) && fits({ x: xx, y: yy })) return { x: xx, y: yy };
    return null;
}

// C teleport.c:collect_coords(). Expanding square rings around <cx,cy>,
// completely collected before the next ring begins and shuffled within the
// ring (or, with CC_RING_PAIRS, within each odd/even ring pair) unless
// CC_UNSHUFFLED is set. CC_INCL_CENTER starts with ring 0; CC_SKIP_MONS and
// CC_SKIP_INACCS reject occupied and non-ZAP_POS squares, then the caller's
// filter runs, as in C. A zero maxradius means the whole usable map;
// column 0 is never used.
export function collect_coords(
    cx: number, cy: number, maxradius = 0, ccflags = CC_NO_FLAGS,
    {
        state = game, random = rn2, calls = null,
        filter = null,
    }: {
        state?: GameState;
        random?: (limit: number) => number;
        calls?: { push(label: string): unknown } | null;
        filter?: ((x: number, y: number) => boolean) | null;
    } = {},
): Position[] {
    const coords: Position[] = [];
    const includeCenter = (ccflags & CC_INCL_CENTER) !== 0;
    const scramble = (ccflags & CC_UNSHUFFLED) === 0;
    const ringPairs = scramble && (ccflags & CC_RING_PAIRS) !== 0;
    const skipMons = (ccflags & CC_SKIP_MONS) !== 0;
    const skipInaccessible = (ccflags & CC_SKIP_INACCS) !== 0;
    const rowRange = cy < ROWNO / 2 ? ROWNO - 1 - cy : cy;
    const colRange = cx < COLNO / 2 ? COLNO - 1 - cx : cx;
    const finalRadius = maxradius
        ? Math.min(maxradius, Math.max(rowRange, colRange))
        : Math.max(rowRange, colRange);
    let pass = 0;
    let n = 0;
    for (let radius = includeCenter ? 0 : 1; radius <= finalRadius; radius++) {
        if (!ringPairs || (radius % 2) !== 0 || radius === 0) {
            pass = coords.length;
            n = 0;
        }
        const lox = cx - radius, hix = cx + radius;
        const loy = cy - radius, hiy = cy + radius;
        for (let y = Math.max(loy, 0); y <= Math.min(hiy, ROWNO - 1); y++) {
            for (let x = Math.max(lox, 1); x <= Math.min(hix, COLNO - 1); x++) {
                if (x !== lox && x !== hix && y !== loy && y !== hiy)
                    continue;
                if (skipMons && state.level && monsterAtPosition(state.level, x, y))
                    continue;
                if (skipInaccessible && !ZAP_POS(state.level?.at?.(x, y)?.typ ?? -1))
                    continue;
                if (filter && !filter(x, y))
                    continue;
                coords.push({ x, y });
                n++;
            }
        }
        if (scramble && (!ringPairs || (radius % 2) === 0 || radius === finalRadius)) {
            while (n > 1) {
                const k = random(n);
                if (calls) calls.push(`rn2(${n})`);
                if (k) {
                    const current = coords[pass];
                    const chosen = coords[pass + k];
                    if (!current || !chosen || k < 0 || k >= n)
                        throw new RangeError(`Invalid coordinate shuffle index ${k} for ${n} entries`);
                    coords[pass] = chosen;
                    coords[pass + k] = current;
                }
                pass++;
                n--;
            }
        }
    }
    return coords;
}

// Part of C dungeon.h:within_bounded_area(): the bounded-area test over the
// port's Rectangle record (rect.ts within_bounded_area() is the scalar port).
function inside(area: Rectangle | null | undefined, x: number, y: number) {
    return !!area && within_bounded_area(x, y, area.lx, area.ly, area.hx, area.hy);
}

// C teleport.c:tele_jump_ok().
function crossesTeleportBoundary(state: GameState, fromX: number, fromY: number, toX: number, toY: number) {
    // C tele_jump_ok() returns FALSE for an off-map target; this predicate
    // answers the inverted question, so an off-map target counts as blocked.
    if (!isok(toX, toY)) return true;
    for (const region of [
        state?.level?.downTeleportRegion,
        state?.level?.upTeleportRegion,
    ]) {
        const area = region?.exclude;
        if (!area || area.lx <= 0) continue;
        if (inside(area, fromX, fromY) !== inside(area, toX, toY))
            return true;
    }
    return false;
}

// Part of C teleport.c:teleok(): permit harmless destination traps for a floating hero.
function trapAllowedAtDestination(state: GameState, trap: Trap | undefined, allowTrap: boolean) {
    if (!trap || allowTrap) return true;
    if (trap.ttyp === VIBRATING_SQUARE) return true;
    const floating = propertyIsActive('levitation', state) || propertyIsActive('flying', state);
    return floating && (is_pit(trap.ttyp) || is_hole(trap.ttyp));
}

// C teleport.c:teleok().
export function heroTeleportDestinationOk(
    x: number, y: number, { state = game, allowTrap = false }: { state?: GameState; allowTrap?: boolean } = {},
) {
    if (!isok(x, y)) return false;
    const trap = trapAt(state, x, y);
    if (!trapAllowedAtDestination(state, trap, allowTrap)) return false;
    if (!goodPosition(x, y, { kind: 'hero' }, { state })) return false;
    if (crossesTeleportBoundary(state, state.u.ux, state.u.uy, x, y)) return false;
    updateHeroRegions(state, x, y);
    return true;
}

// C teleport.c:safe_teleds().  Forty completely random tries come first;
// collect_coords(CC_RING_PAIRS | CC_SKIP_INACCS) then supplies the shuffled
// candidate rings around the hero, and the first viable trap square is kept
// as the backup spot.  The occupancy probe keeps this port's strict live-
// monster predicate in C's filter slot.
export async function safe_teleds<Arrival extends ArrivalResult>(
    state: GameState,
    options: SafeTeledsOptions<Arrival> & { finishArrival: (movement: HeroTeleportMovement) => Promise<Arrival> },
): Promise<HeroTeleportArrival<Arrival> | null>;
// C teleport.c:safe_teleds()
export async function safe_teleds(
    state?: GameState, options?: SafeTeledsOptions<DefaultArrival>,
): Promise<HeroTeleportArrival<DefaultArrival> | null>;
// C teleport.c:safe_teleds()
export async function safe_teleds(
    state: GameState = game,
    {
        random = rn2, rollOne = rnd, allowDrag = false,
        finishArrival = movement => finishTeleportArrival(movement, { announceTeleport: false }),
    }: SafeTeledsOptions<ArrivalResult> = {},
): Promise<HeroTeleportArrival<ArrivalResult> | null> {
    let destination: Position | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
        const x = rollOne(COLNO - 1);
        const y = random(ROWNO);
        if (heroTeleportDestinationOk(x, y, { state })) {
            destination = { x, y };
            break;
        }
    }

    if (!destination) {
        // collect_coords' rings: 1 or 2 steps first, then 3 or 4, on up.
        // C always sets CC_SKIP_MONS and adds CC_SKIP_INACCS only without
        // Passes_walls (teleport.c:747-749); the live-monster predicate
        // keeps this port's mhp>0 occupant test in C's filter slot.
        const ccflags = state.u.passesWalls
            ? CC_RING_PAIRS
            : CC_RING_PAIRS | CC_SKIP_INACCS;
        const candidates = collect_coords(state.u.ux, state.u.uy, 0, ccflags, {
            state, random,
            filter: (x, y) => !state.level?.monsters?.some(monster =>
                monsterHasMapPosition(monster, state) && (monster.mhp ?? 1) > 0
                && monster.mx === x && monster.my === y),
        });
        let trappedFallback: Position | null = null;
        for (const point of candidates) {
            if (heroTeleportDestinationOk(point.x, point.y, { state })) {
                destination = point;
                break;
            }
            if (!trappedFallback
                && state.level?.traps?.some(trap =>
                    trap.tx === point.x && trap.ty === point.y)
                && heroTeleportDestinationOk(point.x, point.y, {
                    state, allowTrap: true,
                })) trappedFallback = point;
        }
        destination ||= trappedFallback;
    }
    if (!destination) return null;
    return await teleds(destination.x, destination.y, state, { allowDrag, finishArrival });
}

// C teleport.c:tele()/scrolltele(NULL). The reader returns coordinates or null.
export function teleportHero<Arrival extends ArrivalResult>(
    options: HeroTeleportOptions<Arrival> & { finishArrival: (movement: HeroTeleportMovement) => Promise<Arrival> },
): Promise<HeroTeleportResult<Arrival>>;
// C teleport.c:scrolltele()
export function teleportHero(options?: HeroTeleportOptions): Promise<HeroTeleportResult<DefaultArrival>>;
// C teleport.c:scrolltele()
export async function teleportHero({
    chooseDestination, source = null, discover = null, state = game,
    random = rn2, rollOne = rnd, finishArrival = finishTeleportArrival,
    publish = plineWithContinuation,
}: HeroTeleportOptions<ArrivalResult> = {}): Promise<HeroTeleportResult<ArrivalResult>> {
    let sourceDiscovered = false;
    const discoverSource = async () => {
        if (!source || sourceDiscovered) return;
        sourceDiscovered = true;
        await discover?.();
    };
    if (heroTeleportRestricted(state) && !state.flags.debug) {
        await publish(
            'A mysterious force prevents you from teleporting!',
        );
        await discoverSource();
        return { moved: false, died: false };
    }
    if (!heroIsBlind(state)) setHeroBlindnessTurns(0, state);
    const onWizardTower = levelIsWizardTower(state);
    if ((state.u.uhave?.amulet || onWizardTower) && !random(3)) {
        await publish(formatFeltMessage('disoriented for a moment.', state));
        if (!state.flags.debug || await promptYesNo('Override?', 'n') !== 'y')
            return { moved: false, died: false };
    }

    const controlled = ((heroControlsTeleport(state) || source?.blessed) && !heroIsStunned(state))
        || state.flags.debug;
    let destination = null;
    let acceptedChoice = false;
    if (controlled) {
        if (heroIsUnconscious(state)) {
            await publish(
                'Being unconscious, you cannot control your teleport.',
            );
        } else {
            if (typeof chooseDestination !== 'function')
                throw new TypeError('controlled teleport needs a destination reader');
            destination = await chooseDestination({ onPrompt: discoverSource });
            if (!destination) return { moved: false, died: false };
            acceptedChoice = heroTeleportDestinationOk(destination.x, destination.y, { state });
            if (!acceptedChoice) {
                await publish('Sorry...');
                destination = null;
            }
        }
    }
    await discoverSource();
    let movement: HeroTeleportMovement;
    let arrival: ArrivalResult;
    if (destination) {
        ({ movement, arrival } = await teleds(destination.x, destination.y, state, { finishArrival }));
    } else {
        // scrolltele() ends with safe_teleds(TELEDS_TELEPORT).
        const landing = await safe_teleds(state, { random, rollOne, finishArrival });
        if (!landing) return { moved: false, died: false };
        ({ movement, arrival } = landing);
    }
    const died = !!arrival?.died || !!state.program_state.gameover;
    if (!died && acceptedChoice
        && state.u.ux === state._travelTarget?.x
        && state.u.uy === state._travelTarget?.y) state._travelTarget = null;
    return { moved: true, died, movement, arrival };
}

// C youprop.h:Stunned() as teleport.c:872/1190 reads it: the projected
// stun flag or its timeout.
function heroIsStunned(state: GameState) {
    return !!(state?.u?.stunned || (state?.u?.stunnedTurns ?? 0) > 0);
}

// Part of C teleport.c:teleport_pet(): the non-forced pet-following case.
// A steed never follows; a cursed
// leash yelps and holds the pet; any other leash goes slack and releases it.
export async function teleportPetVictim(monster: Monster, state: GameState): Promise<boolean> {
    if (monster === state.u?.usteed) return false;
    if (!monster.mleashed) return true;
    const leash = leashAttachedToMonster(monster, state);
    if (!leash) {
        await releaseMonsterLeash(monster, false, { state });
        return true;
    }
    if (leash.cursed) {
        await publishMonsterYelp(monster);
        return false;
    }
    await plineWithContinuation('Your leash goes slack.');
    await releaseMonsterLeash(monster, false, { state });
    return true;
}

// C teleport.c:dotele(). The command and drowning escape use the same
// trap admission, spell fallback, follower checks, and nutrition costs.
export function teleportHeroAtWill<Arrival extends ArrivalResult>(
    options: TeleportAtWillOptions<Arrival> & { finishArrival: (movement: HeroTeleportMovement) => Promise<Arrival> },
): Promise<TeleportAtWillResult<Arrival>>;
// C teleport.c:dotele()
export function teleportHeroAtWill(options?: TeleportAtWillOptions<DefaultArrival>): Promise<TeleportAtWillResult<DefaultArrival>>;
// C teleport.c:dotele()
// Also C teleport.c:vault_tele(): inlined here for one-use teleport traps.
export async function teleportHeroAtWill({
    state = game, random = rn2, rollOne = rnd, chooseDestination = null,
    finishArrival = finishTeleportArrival, publish = plineWithContinuation,
    ignoreRestrictions = false,
}: TeleportAtWillOptions<ArrivalResult> = {}): Promise<TeleportAtWillResult<ArrivalResult>> {
    requirePlayingGame(state);
    const hero = state.u;
    const old = { x: hero.ux, y: hero.uy, ...hero.uz };
    let trap = trapAt(state, hero.ux, hero.uy);
    if (trap && !trap.tseen) trap = undefined;
    if (trap?.ttyp === LEVEL_TELEP) {
        if (await promptYesNo('There is a level teleporter here. Trigger it?') === 'y') {
            await triggerLevelTeleportTrap(trap, gotoLevel, true);
            return { moved: false, died: !!state.program_state.gameover, spentTime: true };
        }
        trap = undefined;
    } else if (trap?.ttyp === TELEP_TRAP) {
        if (trap.once) {
            await publish('This is a vault teleport, usable once only.');
            if (await promptYesNo('Jump in?') === 'n') trap = undefined;
            else {
                deleteTrap(trap, state);
                await newsym(hero.ux, hero.uy);
            }
        }
    } else trap = undefined;
    if (trap)
        await publish(`You ${heroLocomotion('jump', state)} onto the teleportation trap.`);
    if (!trap && !ignoreRestrictions) {
        // dotele()'s !trap && !break_the_rules block: intrinsic admission,
        // the spell fallback, and the direct energy cost. A spell completes
        // dotele() itself; the direct intrinsic teleport continues below.
        const teleportation = heroHasTeleportation(state);
        const requiredLevel = state.urole.key === 'wizard' ? 8 : 12;
        let cast = false;
        if (!teleportation || hero.ulevel < requiredLevel && !heroFormCanTeleport(state)) {
            const known = knownSpell(SPE_TELEPORT_AWAY, state);
            cast = (known === 'fresh' || known === 'stale')
                && !(hero.confused || (hero.confusionTurns ?? 0) > 0);
            if (!cast) {
                await publish(!teleportation
                    ? known === 'unknown' ? "You don't know that spell." : "You can't cast that spell."
                    : 'You are not able to teleport at will.');
                return {
                    moved: hero.ux !== old.x || hero.uy !== old.y
                        || hero.uz.dnum !== old.dnum || hero.uz.dlevel !== old.dlevel,
                    died: !!state.program_state.gameover,
                    spentTime: false,
                };
            }
        }
        const level = oc_level(SPE_TELEPORT_AWAY);
        if (level === undefined) throw new Error('Teleport-away has no spell level');
        const energy = 5 * level;
        const failure = hero.uhunger <= 10 ? 'are too weak from hunger'
            : currentAttribute(A_STR, state) < 4 ? 'lack the strength'
                : energy > hero.uen ? 'lack the energy' : null;
        if (failure) {
            await publish(`You ${failure} ${cast ? 'for a teleport spell' : 'to teleport'}.`);
            return {
                moved: hero.ux !== old.x || hero.uy !== old.y
                    || hero.uz.dnum !== old.dnum || hero.uz.dlevel !== old.dlevel,
                died: !!state.program_state.gameover,
                spentTime: false,
            };
        }
        if (exceedsActionCapacity(state)) {
            await publish('Your concentration falters from carrying so much.');
            return {
                moved: hero.ux !== old.x || hero.uy !== old.y
                    || hero.uz.dnum !== old.dnum || hero.uz.dlevel !== old.dlevel,
                died: !!state.program_state.gameover,
                spentTime: true,
            };
        }
        if (cast) {
            exerciseWisdom(true, state);
            const enclosingMove = state.context.move;
            const result = await castSpell(SPE_TELEPORT_AWAY, { atSelf: true, state });
            state.context.move = enclosingMove;
            return {
                moved: hero.ux !== old.x || hero.uy !== old.y
                    || hero.uz.dnum !== old.dnum || hero.uz.dlevel !== old.dlevel,
                died: !!state.program_state.gameover,
                spentTime: result.spentTime,
            };
        }
        hero.uen -= energy;
        state.context.botl = true;
    }
    if (!await bringLeashedFollowers(state, random)) {
        await publish('You shudder for a moment.');
        return { moved: false, died: false, spentTime: false };
    }

    let destination: Position | null = null;
    if (trap?.once) {
        const vault = searchSpecial(VAULT, state);
        const point = { x: 0, y: 0 };
        if (vault && somexyspace(vault, point, state)
            && heroTeleportDestinationOk(point.x, point.y, { state })) destination = point;
    } else if (trap?.teledest && isok(trap.teledest.x, trap.teledest.y)) {
        destination = trap.teledest;
    } else {
        state._travelTarget = null;
    }
    let result: HeroTeleportResult<ArrivalResult>;
    if (destination) {
        const { movement, arrival } = await teleds(destination.x, destination.y, state, { finishArrival });
        result = { moved: true, movement, arrival,
            died: !!arrival?.died || !!state.program_state.gameover };
    } else {
        result = await teleportHero({
            state, random, rollOne, finishArrival, publish,
            chooseDestination: chooseDestination ? () => chooseDestination() : askTeleportDestination,
        });
    }
    if (result.died) return { ...result, spentTime: true };
    await bringLeashedFollowers(state, random);
    if (!trap) await morehungry(100, { state });
    return { ...result, died: !!state.program_state.gameover, spentTime: true };
}

// C teleport.c:rloc()
export async function randomMonsterRelocation(monster: Monster | null, {
    state = game, calls = [], random = rn2, rollOne = rnd, flags = RLOC_NONE,
}: RelocationOptions = {}): Promise<MonsterRelocation | null> {
    if (!monster) return null;
    requireLiveGame(state);
    requireLevel(state);
    if (monster === state.u.usteed) {
        const oldx = monster.mx, oldy = monster.my;
        const teleport = await teleportHero({ chooseDestination: askTeleportDestination });
        // Native rloc succeeds even when tele is cancelled or restricted.
        return {
            oldx, oldy, x: monster.mx, y: monster.my,
            moved: monster.mx !== oldx || monster.my !== oldy,
            died: teleport.died,
        };
    }
    if (monster.iswiz && monster.mx) {
        const heroInTower = insideWizardTower(state.u.ux, state.u.uy, state);
        const downLadder = heroInTower ? wizardStairway(state, true, false) : null;
        const stair = heroInTower
            ? downLadder || wizardStairway(state, true, true)
            : wizardStairway(state, false, true);
        if (stair && goodPosition(stair.sx, stair.sy, { kind: 'monster', monster }, { state, random }))
            return await relocateMonsterTo(monster, stair.sx, stair.sy, {
                state, random, rollOne, calls, flags,
            });
    }
    if (state._monTelecontrol && monster.mx) {
        const destination = await controlMonsterTeleport(monster, {
            x: monster.mx, y: monster.my,
        }, { state, flags, random, mode: 'random' });
        if (destination)
            return await relocateMonsterTo(monster, destination.x, destination.y, {
                state, random, rollOne, calls, flags,
            });
    }
    for (let attempt = 0; attempt < 50; attempt++) {
        const x = rollOne(COLNO - 1);
        calls?.push(`rnd(${COLNO - 1})`);
        const y = random(ROWNO);
        calls?.push(`rn2(${ROWNO})`);
        if (monsterTeleportDestinationOk(monster, state, x, y, random))
            return await relocateMonsterTo(monster, x, y, { state, random, rollOne, calls, flags });
    }

    // collect_coords(CC_INCL_CENTER | CC_UNSHUFFLED | CC_SKIP_MONS), then
    // rloc()'s own shuffle instead of ring order (C teleport.c:1861-1878).
    const ccflags = CC_INCL_CENTER | CC_UNSHUFFLED | CC_SKIP_MONS;
    const candidates = monsterPassesWalls(monster.mnum)
        ? collect_coords(Math.trunc(COLNO / 2), Math.trunc(ROWNO / 2), 0, ccflags, { state })
        : collect_coords(Math.trunc(COLNO / 2), Math.trunc(ROWNO / 2), 0, ccflags | CC_SKIP_INACCS, { state });
    let fallback = null;
    for (let index = 0; index < candidates.length; index++) {
        const remaining = candidates.length - index;
        const offset = random(remaining);
        calls?.push(`rn2(${remaining})`);
        if (offset) {
            const left = candidates[index];
            const right = candidates[index + offset];
            if (!left || !right) throw new RangeError('Relocation shuffle index is out of range.');
            candidates[index] = right;
            candidates[index + offset] = left;
        }
        const candidate = candidates[index];
        if (!candidate) throw new Error('Relocation candidate is missing.');
        const { x, y } = candidate;
        if (monsterTeleportDestinationOk(monster, state, x, y, random))
            return await relocateMonsterTo(monster, x, y, { state, random, rollOne, calls, flags });
        if (!fallback && goodPosition(x, y, { kind: 'monster', monster }, { state, random }))
            fallback = { x, y };
    }
    if (fallback)
        return await relocateMonsterTo(monster, fallback.x, fallback.y, { state, random, rollOne, calls, flags });
    if (flags & RLOC_ERR) await impossible("rloc(): couldn't relocate monster", { state });
    return null;
}

const shudder = 'You shudder for a moment.';

export type LevelChange = (...args: Parameters<typeof changeLevel>) => unknown;

type LevelRequest =
    | { random: true; depth?: never; destination?: never }
    | { random?: false; depth: number; destination?: never }
    | { random?: false; depth?: never; destination: DungeonLocation };

// C teleport.c:level_tele().
export async function levelTeleport({ state = game,
    gotoLevel = (...args: Parameters<typeof changeLevel>) => { scheduleLevelChange(args); },
    menuRequested = false }: {
    state?: GameState; gotoLevel?: LevelChange; menuRequested?: boolean;
} = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const wizard = !!state.flags.debug;
    if (state.iflags.debug_fuzzer) {
        let dnum;
        do dnum = rn2(state.dungeons.length);
        while (dnum === state.astral_level?.dnum || dungeonAt(state, dnum).flags.unconnected
            || !dungeonAt(state, dnum).num_dunlevs);
        hero.ucamefrom = { ...hero.uz };
        await gotoLevel({ dnum, dlevel: 1 + rn2(dungeonAt(state, dnum).num_dunlevs) });
        return;
    }
    if ((hero.uhave?.amulet || In_endgame(hero.uz) || In_sokoban(hero.uz)) && !wizard) {
        await plineWithContinuation(formatFeltMessage('very disoriented for a moment.', state));
        return;
    }

    const controlled = (heroControlsTeleport(state)
        && !(hero.stunned || (hero.stunnedTurns ?? 0) > 0)) || wizard;
    const request: LevelRequest | null = controlled
        ? await readLevelRequest(state, menuRequested) : { random: true };
    if (!request) return;
    let newDepth = request.depth;
    const forced = request.destination;
    if (request.random) {
        newDepth = randomTeleportDepth(state);
        if (newDepth === depth(hero.uz)) {
            await plineWithContinuation(shudder);
            return;
        }
    } else if (!forced) {
        if (newDepth === undefined) throw new Error('Controlled level teleport has no requested depth');
        if (newDepth === 0) {
            await teleportToNowhere(state);
            return;
        }
        // C dungeon.h:Is_knox(): the explicit-state form of Is_knox_level().
        if (sameDungeonLevel(state.u.uz, state.knox_level) && newDepth > 0) {
            await plineWithContinuation(shudder);
            return;
        }
        if (In_quest(hero.uz) && newDepth > 0)
            newDepth += dungeonAt(state, hero.uz.dnum).depth_start - 1;
    }

    if (hero.utrap && hero.utraptype === TT_BURIEDBALL)
        await buriedBallToPunishment(state);
    if (!(await bringLeashedFollowers(state)) && !forced) {
        await plineWithContinuation(shudder);
        return;
    }
    if (In_endgame(hero.uz)) {
        // teleport.c: the In_endgame() branch runs for the wizard menu too;
        // it never passes the "You materialize on a different level!"
        // deferred message, so traveling between the planes stays silent.
        const levels = dungeonAt(state, hero.uz.dnum).num_dunlevs;
        let depthRequest = newDepth;
        if (forced && depthRequest === undefined)
            depthRequest = forced.dlevel - levels;
        if (depthRequest === undefined) throw new Error('Endgame teleport has no requested depth');
        if (depthRequest >= 0 || depthRequest <= -levels) {
            await plineWithContinuation("You can't get there from here.");
            return;
        }
        await gotoLevel({ dnum: hero.uz.dnum, dlevel: levels + depthRequest });
        return;
    }
    if (newDepth !== undefined && newDepth < 0 && !forced) {
        await teleportAboveDungeon(newDepth, state, gotoLevel);
        return;
    }

    if (!forced && newDepth === undefined) throw new Error('Level teleport has no destination');
    const destination = forced || (newDepth !== undefined
        ? await destinationAtDepth(newDepth, state) : null);
    if (!destination) return;
    await gotoLevel({ dnum: destination.dnum, dlevel: destination.dlevel }, {
        arrival: 'random',
        postMessage: state.flags.verbose ? 'You materialize on a different level!' : '',
    });
}

// Part of C teleport.c:level_tele(): its wizard-menu entry into the
// Elemental Planes grants the real Amulet before deferred_goto() starts.
// Object construction, inventory identity, and prinv() precede
// getbones()/mklev().  Destination placement finishes before tty asks
// for acknowledgement.
async function endgamePrerequisite(destination: DungeonLocation) {
    if (!In_endgame(destination) || In_endgame(game.u?.uz)
        || game.u?.uhave?.amulet) return;
    const amulet = await addInventoryItem(
        await mksobj(AMULET_OF_YENDOR, true, false),
    );
    // teleport.c prints the grant with prinv(); its doname()->xname() path
    // observes the visible object and appends it to the Amulet disco[] class
    // before the destination transaction begins.
    recordObjectEncounter(amulet.otyp);
    if (!game.u.uhave) game.u.uhave = {};
    game.u.uhave.amulet = 1;
    const message = `Endgame prerequisite: ${
        amulet.invlet
    } - the Amulet of Yendor.`;
    await pline(message);
}

// Part of C teleport.c:level_tele(): the wizard level-teleport menu path,
// 'm ^V' or '?', which calls dungeon.c:print_dungeon(TRUE) and then grants
// the endgame prerequisite before forcing the destination.
export async function chooseWizardLevelDestination(): Promise<{ destination: WizardLevelDestination } | null> {
    const { rows, choices } = printDungeon(true);
    const destination = await showPagedPickOneMenu({
        rows, choices, prompt: 'Level teleport to where:',
    });
    if (!destination) return null;
    await endgamePrerequisite(destination);
    return { destination };
}

// Part of C teleport.c:level_tele(): read and interpret the requested destination.
async function readLevelRequest(state: PlayingGameState, menuRequested: boolean): Promise<LevelRequest | null> {
    const wizard = !!state.flags.debug;
    menuRequested ||= !!state.iflags.menu_requested;
    state.iflags.menu_requested = false;
    if (menuRequested && wizard) return chooseWizardLevelDestination();
    for (let attempt = 1; attempt <= 10; attempt++) {
        const help = attempt > 1
            ? wizard ? ' [type a number, name, or ? for a menu]' : ' [type a number or name]'
            : '';
        const text = await getLine(`To what level do you want to teleport?${help}`,
            character => character >= ' ');
        if (text === '*') return { random: true };
        // A confused cancellation can itself be misread as random teleport.
        if ((state.u.confused || (state.u.confusionTurns ?? 0) > 0) && rnl(5)) {
            await plineWithContinuation('Oops...');
            return { random: true };
        }
        if (text === null) return null;
        if (wizard && text === '?') return chooseWizardLevelDestination();
        const requested = levelDepthByName(text, state) || Number.parseInt(text, 10) || 0;
        if (requested || /^-?\d/.test(text))
            return !requested && attempt === 10 ? { random: true } : { depth: requested };
    }
    return { random: true };
}

// C teleport.c:random_teleport_level(). The 1-in-5 no-op is evaluated even
// in branches which forbid random travel.
export function randomTeleportDepth(state: GameState = game, random = rn2, rollOne = rnd): number {
    requirePlayingGame(state);
    const hero = state.u;
    const current = depth(hero.uz, state.dungeons);
    const dungeon = dungeonAt(state, hero.uz.dnum);
    // C dungeon.h:Is_knox(): the explicit-state form of Is_knox_level().
    if (!random(5) || sameDungeonLevel(state.u.uz, state.knox_level) || In_endgame(hero.uz)) return current;
    let minimum = 1;
    let maximum = dungeon.depth_start + dungeon.num_dunlevs - 1;
    if (In_quest(hero.uz)) {
        minimum = dungeon.depth_start;
        const locate = requiredSpecialLevel(state, 'x-loca');
        if (dungeon.dunlev_ureached < locate.dlevel)
            maximum = minimum + locate.dlevel - 1;
    } else if (dungeon.flags?.hellish && !hero.uevent?.invoked) maximum--;
    let destination = random(current + 3 - minimum) + minimum;
    if (destination >= current) destination++;
    if (destination > maximum) {
        destination = maximum;
        if (hero.uz.dlevel === dungeon.num_dunlevs) destination -= rollOne(3);
    }
    if (destination < minimum) {
        destination = minimum;
        if (destination === current) destination = Math.min(maximum, destination + rollOne(3));
    }
    return destination;
}


// Part of C teleport.c:level_tele(): clamp and resolve the requested dungeon depth.
async function destinationAtDepth(requested: number, state: PlayingGameState): Promise<DungeonLocation | null> {
    const hero = state.u;
    const dungeon = dungeonAt(state, hero.uz.dnum);
    if (hero.uz.dnum === state.medusa_level?.dnum
        && requested >= dungeon.depth_start + dungeon.num_dunlevs) {
        const valley = state.valley_level;
        if (!valley) throw new Error('The dungeon graph has no Gehennom entrance');
        return { dnum: valley.dnum, dlevel: 1 };
    }
    const bottom = In_quest(hero.uz) ? requiredSpecialLevel(state, 'x-strt')
        : In_mines(hero.uz) ? requiredSpecialLevel(state, 'minend') : state.sanctum_level;
    const bottomDungeon = dungeonAt(state, bottom?.dnum ?? hero.uz.dnum);
    const deepest = bottomDungeon.depth_start + bottomDungeon.num_dunlevs - 1;
    if (!state.flags.debug && dungeon.flags?.hellish
        && !hero.uevent?.invoked && requested >= deepest) {
        requested = deepest - 1;
        await plineWithContinuation('Sorry...');
    }
    if (In_quest(hero.uz)) requested = Math.max(requested, depth(requiredSpecialLevel(state, 'x-strt')));
    const destination = levelAtDepth(requested, { state });
    if (sameDungeonLevel(destination, hero.uz) && requested !== depth(hero.uz)) {
        await plineWithContinuation(`You can't get there from ${requested > deepest ? 'anywhere' : 'here'}.`);
        return null;
    }
    return destination;
}


// Part of C teleport.c:level_tele(): handle level-zero suicide and life saving.
async function teleportToNowhere(state: PlayingGameState): Promise<void> {
    if (await promptYesNoQuit('Go to Nowhere.  Are you sure?') !== 'y') return;
    const action = monsterIsSilent(heroSpecies(state)) ? 'writhe' : 'scream';
    await plineWithContinuation(`You ${action} in agony as your body begins to warp...`);
    await flushPendingTopline();
    await plineWithContinuation('You cease to exist.');
    if (state.inventory.length)
        await plineWithContinuation(`Your possessions land on the ${surfaceName(state.u.ux, state.u.uy, state)} with a thud.`);
    if (await finishHeroDeath({ killer: 'committed suicide', deathCause: 'committed suicide',
        deathLineShown: true })) return;
    await plineWithContinuation('An energized cloud of dust begins to coalesce.');
    await plineWithContinuation(`Your body rematerializes${state.inventory.length ? ', and you gather up all your possessions' : ''}.`);
}

// Part of C teleport.c:level_tele(): handle destinations above the dungeon.
async function teleportAboveDungeon(destination: number, state: PlayingGameState, gotoLevel: LevelChange): Promise<void> {
    if (state.u.ushops0?.length) {
        const generating = state.in_mklev;
        state.in_mklev = true;
        try {
            await leaveHeroShop(state.u.ushops0, { newLevel: true, state });
            state.u.ushops0 = [];
            state.u.ushops = [];
        } finally {
            if (generating === undefined) delete state.in_mklev;
            else state.in_mklev = generating;
        }
    }
    let killer = null;
    if (destination <= -10) {
        await plineWithContinuation('You arrive in heaven.');
        await plineWithContinuation('"Thou art early, but we\'ll admit thee."');
        killer = 'went to heaven prematurely';
    } else if (destination === -9) {
        await plineWithContinuation(formatFeltMessage('deliriously happy.', state));
        await plineWithContinuation("(In fact, you're on Cloud 9!)");
        await flushPendingTopline();
    } else await plineWithContinuation('You are now high above the clouds...');
    let escape;
    if (!killer) {
        if (propertyIsActive('levitation', state)) escape = 'float gently down to earth';
        else if (propertyIsActive('flying', state)) escape = 'fly down to the ground';
        else {
            await plineWithContinuation("Unfortunately, you don't know how to fly.");
            await plineWithContinuation('You plummet a few thousand feet to your death.');
            killer = `teleported out of the dungeon and fell to ${state.flags.female ? 'her' : 'his'} death`;
        }
    }
    if (killer) {
        const previous = state.u.uz;
        state.u.uz = { dnum: 0, dlevel: destination <= -10 ? -10 : 0 };
        if (await finishHeroDeath({ killer, deathCause: killer, deathLineShown: true })) return;
        state.u.uz = previous;
        escape = 'find yourself back on the surface';
    }
    await plineWithContinuation(`You ${escape}.`);
    await gotoLevel({ dnum: 0, dlevel: 0 });
}

// Port only: require a dungeon entry for level teleportation.
function dungeonAt(state: GameState, dnum: number): Dungeon {
    const dungeon = state.dungeons[dnum];
    if (!dungeon) throw new Error(`Level teleport cannot find dungeon ${dnum}`);
    return dungeon;
}

// Port only: require a named special-level destination.
function requiredSpecialLevel(state: GameState, name: string): DungeonLocation {
    const level = state.specialLevels?.get(name);
    if (!level) throw new Error(`Level teleport cannot find special level ${name}`);
    return level;
}

// C teleport.c:control_mon_tele(). False selection resumes the caller's policy.
export async function controlMonsterTeleport(monster: Monster, defaultPoint: Position, {
    state = game, mode = 'random', flags = RLOC_NONE, random = rn2,
}: Omit<RelocationOptions, 'calls' | 'rollOne'> & { mode?: 'random' | 'near' } = {}) {
    requireLiveGame(state);
    requireLevel(state);
    let start = { ...defaultPoint };
    if (!isok(start.x, start.y)) start = { x: monster.mx, y: monster.my };
    if (!isok(start.x, start.y)) start = { x: state.u.ux, y: state.u.uy };
    if (!state.flags.debug || !state._monTelecontrol) return null;

    const destination = await askMonsterTeleportDestination(monster, start);
    if (destination && !(destination.x === state.u.ux && destination.y === state.u.uy)) {
        const { x, y } = destination;
        const valid = mode === 'random'
            ? monsterTeleportDestinationOk(monster, state, x, y, random)
            : goodPosition(x, y, { kind: 'monster', monster }, { state, gpflags: flags, random });
        if (valid) return destination;
        if (!state.flags.debug_fuzzer && await promptYesNo(
            `<${monster.mx},${monster.my}> is not considered viable; force anyway?`,
        ) === 'y') return destination;
    }
    await plineWithContinuation(`${mode === 'random' ? 'Picking random' : 'Using derived'} destination.`);
    return null;
}

// C teleport.c:stairway_find_forwiz().
function wizardStairway(state: GameState, ladder: boolean, up: boolean) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (!!stair.isladder === ladder && !!stair.up === up
            && stair.tolev.dnum === state.u.uz?.dnum) return stair;
    }
    return null;
}

// C teleport.c:rloc_pos_ok().
function monsterTeleportDestinationOk(monster: Monster, state: LevelGameState, x: number, y: number, random: RandomBelow) {
    if (!goodPosition(x, y, { kind: 'monster', monster }, {
        state, random, gpflags: GP_CHECKSCARY,
    })) return false;

    if (!monster.mx) {
        const migrationFlags = monster.migrationFlags ?? 0;
        const towerBoundary = state.level.downTeleportRegion?.exclude;
        if (towerBoundary?.lx && levelIsWizardTower(state))
            return !!(migrationFlags & 2) === inside(towerBoundary, x, y);
        const arrival = migrationFlags & 1
            ? state.level.upTeleportRegion : state.level.downTeleportRegion;
        if (arrival?.lx)
            return inside(arrival, x, y)
                && (!arrival.exclude?.lx || !inside(arrival.exclude, x, y));
        return true;
    }

    const roomno = state.level.at(x, y)?.roomno;
    if (shopkeeperInOwnShop(monster, state)) {
        if (roomno !== monster.eshk?.shoproom) return false;
    } else if (priestIsInOwnTemple(monster, state)) {
        const priest = monster.epri || monster.mextra?.epri;
        if (roomno !== priest?.shroom) return false;
    }
    return !crossesTeleportBoundary(state, monster.mx, monster.my, x, y);
}



// C teleport.c:rloc_to_core(). Direct placements suppress messages by default.
export async function relocateMonsterTo(monster: Monster, x: number, y: number, {
    state = game, random = rn2, rollOne = rnd, calls = null, flags = RLOC_NOMSG,
}: RelocationOptions = {}): Promise<MonsterRelocation> {
    requireLiveGame(state);
    requireLevel(state);
    const gameWasOver = state.program_state.gameover;
    const oldx = monster.mx;
    const oldy = monster.my;
    const residentShopkeeper = monster.isshk && shopkeeperInOwnShop(monster, state);
    const relocation = { oldx, oldy, x, y, moved: oldx !== x || oldy !== y };
    if (oldx === x && oldy === y && monsterAtPosition(state.level, x, y) === monster)
        return relocation;

    let appear = !!((monster.mstrategy ?? 0) & STRAT_APPEARMSG);
    const report = !state.in_mklev && !(flags & RLOC_NOMSG)
        && (!!(flags & RLOC_MSG) || appear);
    let seenAtBothEnds = false;
    if (oldx && report && canSpotMonster(monster)) {
        seenAtBothEnds = couldsee(x, y) || canSenseMonster(monster);
        if (!seenAtBothEnds)
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} vanishes!`);
        appear = false;
    }

    const segments = monster.wormno ? monster.wormSegments?.length ?? 0 : 0;
    if (oldx) {
        if (monster.wormno) await clearMonsterWormFromMap(monster);
        else {
            removeMonsterFromMapAt(oldx, oldy, state);
            await newsym(oldx, oldy);
        }
    }
    monster.mtrack = [];
    await placeMonsterOnMap(monster, x, y);
    updateMonsterRegions(monster, state);
    if (monster.wormno)
        await placeMonsterWormTailRandomly(monster, segments, { state, random });

    const hero = state.u;
    if (hero.ustuck === monster) {
        if (hero.uswallow) {
            await placeHeroOnLevel(x, y, state);
            await checkSpecialRoom();
            await docrt();
        } else if (Math.abs(x - hero.ux) > 1 || Math.abs(y - hero.uy) > 1) {
            await releaseHeroFromMonster(monster, { state, rollOne });
        }
    }
    await maybeUnhideAt(x, y, state);
    await newsym(x, y);
    setMonsterApparentHeroPosition(monster, state, random, calls);

    if (report && (canSpotMonster(monster) || appear || hero.ustuck === monster)) {
        const distance = dist2(x, y, hero.ux, hero.uy);
        const near = distance <= 2 ? ' next to you'
            : distance <= BOLT_LIM * BOLT_LIM ? ' close by' : '';
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_APPEARMSG;
        if (hero.ustuck === monster && (hero.ux !== hero.ux0 || hero.uy !== hero.uy0)) {
            await plineWithContinuation(`You and ${monsterName(monster, { state })} teleport together.`);
        } else if (seenAtBothEnds && (couldsee(x, y) || canSenseMonster(monster))) {
            const oldDistance = dist2(oldx, oldy, hero.ux, hero.uy);
            const suffix = near || (oldDistance === distance ? ''
                : distance < oldDistance ? ' closer to you' : ' farther away');
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} vanishes and reappears${suffix}.`);
        } else {
            const name = monsterName(monster, {
                state, capitalized: true, article: appear ? 'a' : 'the',
            });
            await plineWithContinuation(`${name} ${appear ? 'suddenly ' : ''}${
                heroIsBlind(state) ? 'arrives' : 'appears'}${near}!`);
        }
        if (state._currentWand?.otyp === WAN_TELEPORTATION)
            learnObjectType(WAN_TELEPORTATION, state);
    }

    if (residentShopkeeper && hasShopkeeperData(monster) && !shopkeeperInOwnShop(monster, state))
        await makeAngryShopkeeper(monster, state);
    const inventory = monster.minvent;
    const firstObject = inventory?.[0];
    if (inventory && firstObject && !costlySpot(x, y, state)) {
        const owner = findObjectOwner(firstObject, oldx, oldy, state);
        const peaceful = !owner || owner.mpeaceful;
        for (const object of inventory) {
            if (object.no_charge) object.no_charge = false;
            else if (owner && onBillEntry(object, owner))
                await stolenValue(object, oldx, oldy, peaceful, { silent: false, state });
        }
    }
    // C dochugw(FALSE): new arrivals have no previous-sighting exemption.
    await interruptOccupationForMonster(monster, state);
    if (!gameWasOver && state.program_state.gameover) return { ...relocation, died: true };
    if (monster.mtrapped && !monster.wormno) {
        requirePlayingGame(state);
        await mintrap(monster, state, {
            random,
            describeMonster: target => monsterName(target, { state, capitalized: true }),
        });
    }
    return relocation;
}

// C teleport.c:tele_to_rnd_pet(). Each pet gets reservoir-sampling odds;
// the chosen pet supplies exactly one candidate square, with no fallback.
export async function teleportHeroToRandomPet(state = game) {
    requirePlayingGame(state);
    if (heroTeleportRestricted(state)) {
        // C tele_to_rnd_pet(): the magic-whistle caller screens this, so the
        // diagnostic fires only for other entry points.
        await impossible('attempt to teleport hero to be near a pet'
            + ' on no-teleport level', { state });
        return false;
    }
    let selected = null;
    let count = 0;
    for (const pet of [...state.level.monsters].reverse()) {
        if (pet.mhp <= 0 || !pet.mtame || !pet.mx
            || (pet.mstate ?? MON_FLOOR) !== MON_FLOOR) continue;
        if (rn2(++count) === 0) selected = pet;
    }
    // C distmin(pet->mx, pet->my, u.ux, u.uy).
    if (!selected || distmin(selected.mx, selected.my, state.u.ux, state.u.uy) <= 1) return false;
    const x = selected.mx + rn2(3) - 1;
    const y = selected.my + rn2(3) - 1;
    if (!heroTeleportDestinationOk(x, y, { state })) return false;
    await teleds(x, y, state, { finishArrival: finishTeleportArrival });
    return true;
}

// Part of C teleport.c:tele_trap(): relocate an occupant of the fixed trap destination.
export async function clearFixedTeleportDestination(
    x: number, y: number, state = game, random = rn2,
) {
    const monster = state.level?.monsters?.find(candidate => monsterHasMapPosition(candidate, state) &&
        (candidate.mhp ?? 1) > 0
        && ((candidate.mx === x && candidate.my === y)
            || candidate.wormSegments?.some(segment =>
                segment.x === x && segment.y === y)));
    if (!monster) return { cleared: true, relocation: null };
    const oldx = monster.mx;
    const oldy = monster.my;
    const destination = enexto(
        monster.mnum, monster.mx, monster.my, { state, random },
    );
    if (!destination) return { cleared: false, relocation: null };
    await relocateMonsterTo(monster, destination.x, destination.y, { state, random });
    return {
        cleared: true,
        relocation: {
            monster, oldx, oldy,
            x: destination.x, y: destination.y,
        },
    };
}

// C teleport.c:tele_trap().
// A hero stepping on a teleport trap.  C's static in_tele_trap flag stops
// the spoteffects() recursion when a fixed destination holds another
// teleport trap; the port's _inTeleportTrap flag is that guard.  The
// trapeffect() hero branch (trap.ts) reveals the trap first and hands the
// jump to this; the arrival handler is the port's finishTeleport seam.
export async function teleTrap(
    trap: Trap, finishTeleport: HeroTrapOptions['finishTeleport'],
): Promise<boolean> {
    if (game._inTeleportTrap) return false;
    if (typeof finishTeleport !== 'function')
        throw new TypeError('teleport trap needs an arrival handler');

    game._inTeleportTrap = true;
    try {
        const blocked = heroTeleportTrapBlock();
        if (blocked) {
            if (blocked === 'antimagic')
                await shieldeff(game.u.ux, game.u.uy);
            await plineWithContinuation(formatFeltMessage('a wrenching sensation.'));
            return true;
        }

        if (!await bringLeashedFollowers()) {
            await plineWithContinuation('You shudder for a moment.');
            return true;
        }

        let destination: Position | null = null;
        if (trap.once) {
            deleteTrap(trap, game);
            await newsym(game.u.ux, game.u.uy);

            const vault = searchSpecial(VAULT, game);
            if (vault) {
                const vaultSquare = { x: 0, y: 0 };
                if (somexyspace(vault, vaultSquare, game)
                    && heroTeleportDestinationOk(
                        vaultSquare.x, vaultSquare.y,
                    )) destination = vaultSquare;
            }
        } else if (trap.teledest
            && isok(trap.teledest.x, trap.teledest.y)) {
            setTrack(game);
            const cleared = await clearFixedTeleportDestination(
                trap.teledest.x, trap.teledest.y,
            );
            if (!cleared.cleared) {
                await plineWithContinuation('You shudder for a moment.');
                return true;
            }
            if (cleared.relocation) {
                await newsym(cleared.relocation.oldx, cleared.relocation.oldy);
                await newsym(cleared.relocation.x, cleared.relocation.y);
            }
            destination = trap.teledest;
        } else {
            await teleportHero({ chooseDestination: askTeleportDestination });
            return true;
        }

        if (!destination) {
            // vault_tele() falls back to tele(), including teleport control.
            await teleportHero({ chooseDestination: askTeleportDestination });
            return true;
        }
        await teleds(destination.x, destination.y, game, { finishArrival: finishTeleport });
        return true;
    } finally {
        game._inTeleportTrap = false;
    }
}

// C teleport.c:teleport_pet()
// C teleport_pet(): feedback may wait for input while the leash is attached.
async function teleportMonsterPet(
    monster: Monster, state: GameState, force: boolean, publish: MessagePublisher,
): Promise<boolean> {
    if (monster === state.u.usteed) return false;
    if (!monster.mleashed) return true;
    const leash = leashAttachedToMonster(monster, state);
    if (!leash) {
        await impossible(`${monsterName(monster, { state, capitalized: true })} is leashed, without a leash.`, { state });
    } else if (leash.cursed && !force) {
        await publishMonsterYelp(monster);
        return false;
    } else {
        await publish('Your leash goes slack.');
    }
    await releaseMonsterLeash(monster, false, { state });
    return true;
}

// C teleport.c:mtele_trap().
// Also C teleport.c:mvault_tele(): inlined here for one-use teleport traps.
export async function teleportMonsterFromTrap(
    monster: Monster, trap: Trap, {
        state = game, calls = [], random = rn2, rollOne = rnd, publish = plineWithContinuation,
    }: RelocationOptions & { publish?: MessagePublisher } = {},
): Promise<MonsterTeleportTrapEvent> {
    requireLevel(state);
    const event: MonsterTeleportTrapEvent = {
        kind: 'teleport-trap', trap,
        trapSquare: { x: monster.mx, y: monster.my },
        visible: canSeeMonster(monster) || monster === state.u.usteed,
        relocation: null,
        damage: 0,
        killed: false,
    };
    if (monsterTeleportRestricted(monster, state)) {
        event.restricted = true;
        return event;
    }

    if (!await teleportMonsterPet(monster, state, false, publish)) return event;
    const subject = monsterName(monster, { state, capitalized: true });

    const fixedDestination = trap.teledest
        && isok(trap.teledest.x, trap.teledest.y);
    if (trap.once) {
        const vault = searchSpecial(VAULT, state);
        if (vault) {
            const square = { x: 0, y: 0 };
            if (somexyspace(vault, square, state)
                && goodPosition(square.x, square.y, { kind: 'monster', monster }, { state, random })) {
                event.relocation = await relocateMonsterTo(monster, square.x, square.y, { state, random, rollOne, calls });
            }
        }
        event.relocation ||= await randomMonsterRelocation(monster, { state, calls, random, rollOne, flags: RLOC_NONE });
    } else if (fixedDestination && trap.teledest) {
        const occupiedByHero = state.u?.ux === trap.teledest.x
            && state.u?.uy === trap.teledest.y;
        const occupiedByMonster = monsterAtPosition(
            state.level, trap.teledest.x, trap.teledest.y,
        );
        if (!occupiedByHero && !occupiedByMonster) {
            event.relocation = await relocateMonsterTo(monster, trap.teledest.x, trap.teledest.y, { state, random, rollOne, calls, flags: RLOC_MSG });
        }
    } else {
        event.relocation = await randomMonsterRelocation(monster, { state, calls, random, rollOne, flags: RLOC_NONE });
    }
    if (event.visible) {
        await publish(`${subject} ${canSeeMonster(monster) ? 'seems disoriented.' : 'suddenly disappears!'}`);
        await seeTrap(trap, state);
    }
    return event;
}

// C teleport.c:teleds()
export function teleds<Arrival extends ArrivalResult>(
    x: number, y: number, state: GameState,
    options: HeroTeleportMoveOptions<Arrival> & { finishArrival: (movement: HeroTeleportMovement) => Promise<Arrival> },
): Promise<HeroTeleportArrival<Arrival>>;
// C teleport.c:teleds()
export function teleds(
    x: number, y: number, state?: GameState, options?: HeroTeleportMoveOptions<DefaultArrival>,
): Promise<HeroTeleportArrival<DefaultArrival>>;
// C teleport.c:teleds(). Keep vision, landing effects, and the invocation
// message inside one notice block, including any teleport during landing.
export async function teleds(x: number, y: number, state = game, {
    allowDrag = false,
    finishArrival = movement => finishTeleportArrival(movement, { announceTeleport: false }),
}: HeroTeleportMoveOptions<ArrivalResult> = {}): Promise<HeroTeleportArrival<ArrivalResult>> {
    requirePlayingGame(state);
    requireLiveGame(state);
    requireLevel(state);
    const u = state.u;
    const oldx = u.ux;
    const oldy = u.uy;
    if (u.utraptype === TT_BURIEDBALL) await buriedBallToPunishment(state);
    let ball = state.uball || u.uball;
    let ballActive = !!ball && ball.where !== 'free';
    let ballStillInRange = false;
    if (!ballActive || nearCapacity(state) > SLT_ENCUMBER
        || distmin(oldx, oldy, x, y) > 1) allowDrag = false;
    if (ballActive && ball) {
        if (ball.where !== 'inventory'
            && distmin(x, y, ball.ox, ball.oy) <= 2)
            ballStillInRange = true;
        else if (!allowDrag)
            await unplaceBallAndChain(state);
    }

    await resetUtrap(false, state);
    const wasSwallowed = u.uswallow;
    setHeroGrip(null, state);
    u.ux0 = oldx;
    u.uy0 = oldy;
    // Native hideunder() cannot conceal a mimic: these forms have M1_HIDE,
    // not M1_CONCEAL. u_on_newpos() then reveals every relocated hero.
    if (Upolyd(u) && MONSTER_SYMBOL[u.umonnum] === S_MIMIC)
        u.m_ap_type = M_AP_NOTHING;
    if (wasSwallowed) {
        if (heroIsPunished(state)) {
            ballActive = true;
            ballStillInRange = allowDrag = false;
        }
        await docrt();
    }
    // C teleds() moves a nearby pair before changing the hero's position.
    // Unlike walking, teleportation ignores drag_ball's cause_delay result.
    if (ballActive && (ballStillInRange || allowDrag)) {
        const plan = await beginBallAndChainMove(x, y, { state, allowDrag });
        if (plan && !plan.blocked) {
            await finishBallAndChainMove(plan, state);
        } else {
            ball = state.uball || u.uball;
            ballActive = !!ball && ball.where !== 'free';
            if (ballActive) await unplaceBallAndChain(state);
        }
    }
    await placeHeroOnLevel(x, y, state);
    const oldTrap = state.level.traps.find(trap =>
        trap.tx === oldx && trap.ty === oldy);
    if (oldTrap && is_pit(oldTrap.ttyp)) await fillPitWithBoulderAt(oldx, oldy, state);
    const chain = state.uchain || u.uchain;
    if (ballActive && chain?.where === 'free') await placeBallAndChain(state);
    updateHeroRegions(state);
    await newsym(oldx, oldy);
    await see_monsters();
    state.vision_full_recalc = 1;
    nomul(0, state);
    const movement = { oldx, oldy, x, y };
    const arrival = await withMonsterNoticesBlocked(state, async () => {
        await vision_recalc(0);
        const landing = await finishArrival(movement);
        if (!landing?.died && !state.program_state.gameover) await announceInvocationSquare();
        return landing;
    });
    if (!arrival?.died && !state.program_state.gameover) await noticeAllMonsters(state);
    return { movement, arrival };
}

// Part of C teleport.c:teleds(): the landing tail (C teleport.c:teleds()
// lines 543-571) — the materialize line, switch_terrain(), the vault-guard
// exit check, and spoteffects(TRUE) + invocation_message().  Kept as a
// named continuation because trap paths and liquid rescues pass it (or a
// custom landing) into teleds(); hack.c:spoteffects() itself lives in
// hack.ts.
export async function finishTeleportArrival(
    movement: HeroTeleportMovement, { announceTeleport = true } = {},
): Promise<SpotEffectResult> {
    requirePlayingGame(game);
    await bot();
    if (announceTeleport && game.flags.verbose !== false) {
        const place = movement.oldx === movement.x && movement.oldy === movement.y
            ? 'the same' : 'a different';
        await plineWithContinuation(`You materialize in ${place} location!`);
    }
    if (game.level.requireAt(game.u.ux, game.u.uy).typ
        !== game.level.requireAt(movement.oldx, movement.oldy).typ)
        await switchHeroTerrain(game);
    if (roomsAt(game.level, movement.oldx, movement.oldy, VAULT).length
        && !roomsAt(game.level, game.u.ux, game.u.uy, VAULT).length) {
        const guard = await findVaultGuard(game);
        if (guard) await noticeVaultEscape(guard, game);
    }
    const result = await finishDestinationSpotEffects({
        ...movement, newx: movement.x, newy: movement.y,
    });
    if (result.died || game.program_state.gameover) return { ...result, died: true };
    return result;
}
// C teleport.c:mlevel_tele_trap(). One owner for the hole/trapdoor, magic
// portal, and level-teleport branches; the destination follows the hero's
// current dungeon even for a monster with another home.  Returns the
// migration record when the monster left the level, null otherwise.
export async function mlevel_tele_trap(monster: Monster, trap: Trap, {
    state = game, random = rn2, rollOne = rnd, force = false, publish = plineWithContinuation,
}: RelocationOptions & { force?: boolean; publish?: MessagePublisher } = {}) {
    requirePlayingGame(state);
    if (monster === state.u.ustuck) return null;
    if (!await teleportMonsterPet(monster, state, force, publish)) return null;
    const seen = canSeeMonster(monster) || monster === state.u.usteed;
    const subject = () => monsterName(monster, { state, capitalized: true });
    let destination: DungeonLocation | undefined;
    let kind: 'level-fall-migration' | 'magic-portal-migration' | 'level-migration';
    let mode: number | undefined;
    if (is_hole(trap.ttyp)) {
        if (Is_stronghold(state.u.uz)) {
            if (!state.valley_level) throw new Error('A Castle trapdoor requires the Valley destination');
            destination = { dnum: state.valley_level.dnum, dlevel: state.valley_level.dlevel };
        } else {
            if (Is_botlevel(state.u.uz)) {
                if (seen && trap.tseen) {
                    await publish(`${subject()} avoids the ${trap.ttyp === HOLE ? 'hole' : 'trap'}.`);
                }
                return null;
            }
            if (!trap.dst) throw new Error('A monster fall requires a hole destination');
            destination = clampHoleDestination(trap.dst, state);
        }
        kind = 'level-fall-migration';
        mode = MIGR_RANDOM;
    } else if (trap.ttyp === MAGIC_PORTAL) {
        if (In_endgame(state.u.uz)
            && ((monster.minvent || []).some(object => object.otyp === AMULET_OF_YENDOR)
                || isHomeElemental(monster.mnum) || random(7))) {
            if (seen && MONSTER_SYMBOL[monster.mnum] !== S_ELEMENTAL) {
                await publish(`${subject()} seems to shimmer for a moment.`);
                await seeTrap(trap, state);
            }
            return null;
        }
        // A portal trap keeps whatever destination it carries; a bare
        // fixture portal migrates exactly as teleportMonsterThroughPortal
        // passed the trap through before the merge.
        destination = trap.dst;
        kind = 'magic-portal-migration';
        mode = MIGR_PORTAL;
    } else {
        // LEVEL_TELEP; the NO_TRAP forced-off-level form belongs to the
        // covetous-escape owner.
        if (In_endgame(state.u.uz) || (monster.minvent || []).some(object => object.otyp === AMULET_OF_YENDOR)) {
            if (seen) await publish(`${subject()} seems very disoriented for a moment.`);
            return null;
        }
        const target = randomTeleportDepth(state, random, rollOne);
        if (target === depth(state.u.uz, state.dungeons)) {
            if (seen) await publish(`${subject()} shudders for a moment.`);
            return null;
        }
        destination = levelAtDepth(target, { state });
        kind = 'level-migration';
    }
    if (seen) {
        const effect = is_hole(trap.ttyp)
            ? trap.ttyp === HOLE ? 'falls into a hole' : 'falls through a trap door'
            : 'disappears out of sight';
        await publish(`Suddenly, ${monsterName(monster, { state })} ${effect}.`);
        await seeTrap(trap, state);
    }
    // is_xport(): holes and trap doors do not confuse the traveller.
    if (!is_hole(trap.ttyp) && !monsterControlsTeleport(monster.mnum)) monster.mconf = 1;
    return migrateMonsterOffLevel(monster, state, destination === undefined ? trap : { ...trap, dst: destination },
        mode === undefined ? { kind } : { kind, mode });
}

// Part of C teleport.c:control_mon_tele(): prompt for a controlled monster destination.
// control_mon_tele's getpos prelude, mirroring scrolltele's reader
// below; getpos itself lives in getpos.ts.
export async function askMonsterTeleportDestination(
    monster: Monster, start: Position,
): Promise<Position | null> {
    await plineWithContinuation(`Teleport ${monsterName(monster, {
        article: 'your', suppressIt: true,
    })} @ <${monster.mx},${monster.my}> where?`);
    const goal = `where to teleport ${monsterName(monster, {
        article: 'your', suppressIt: true,
    })}`;
    const firstUse = shouldShowGetposTip();
    if (firstUse) await showGetposTip();
    if (game.flags.verbose)
        await plineWithContinuation("(For instructions type a '?')");
    if (firstUse) await plineWithContinuation(`Move cursor to ${goal}:`);
    const destination = await selectMapPosition({
        start, prompt: game._pending_message, goal, force: false,
    });
    return destination;
}

// Part of C teleport.c:scrolltele(): prompt for a controlled hero destination.
export async function askTeleportDestination({ onPrompt = null }: {
    onPrompt?: (() => void | Promise<void>) | null;
} = {}): Promise<Position | null> {
    const subject = game.u.usteed
        ? `you and ${monsterName(game.u.usteed)}` : 'you';
    await plineWithContinuation(`Where do ${subject} want to be teleported?`);
    await onPrompt?.();
    const firstUse = shouldShowGetposTip();
    if (firstUse) await showGetposTip();
    if (game.flags.verbose)
        await plineWithContinuation("(For instructions type a '?')");
    if (firstUse)
        await plineWithContinuation('Move cursor to the desired position:');

    const target = game._travelTarget;
    const destination = await selectMapPosition({
        start: target && isok(target.x, target.y)
            ? { ...target } : { x: game.u.ux, y: game.u.uy },
        prompt: game._pending_message,
        goal: 'the desired position',
    });
    game._pending_message = '';
    return destination;
}

// Part of C teleport.c:dotelecmd(): dotele()'s command invocation —
// dotele()/teleds() with getpos.c getpos() and priest.c intemple(): a
// successful position teleport returns ECMD_TIME.  Its first getpos use
// still owns the shared Lua tutorial, while the destination room
// separately owns entry effects after relocation.
const teleportAtWill = async (ignoreRestrictions: boolean): Promise<void> => {
    const result = await teleportHeroAtWill({
        ignoreRestrictions, chooseDestination: askTeleportDestination,
    });
    game.context.move = Number(result.spentTime);
};
type TeleportMode = 'n' | 's' | 't' | 'w';

// C teleport.c:dotelecmd(). The #teleport command: normal mode ignores an
// 'm' prefix, while wizard mode picks among teleport modes around dotele()
// (spell.c:tport_spell() inlined in the switch's save/restore).
export async function dotelecmd(): Promise<void> {
    requirePlayingGame(game);
    // normal mode; ignore 'm' prefix if it was given
    if (!game.flags.debug) {
        await teleportAtWill(false);
        return;
    }
    let mode: TeleportMode;
    if (game.iflags.menu_requested) {
        const window = tty_create_nhwindow<TeleportMode>(NHW_MENU);
        try {
            await tty_start_menu(window);
            tty_add_menu(window, { identifier: 'n', selector: 'n', text: 'normal ^T on demand; no spell, obey restrictions' });
            tty_add_menu(window, { identifier: 's', selector: 's', text: 'via spellcast; no intrinsic teleport' });
            tty_add_menu(window, { identifier: 't', selector: 't', text: 'try ^T without having it; no spell' });
            tty_add_menu(window, {
                identifier: 'w', selector: 'w', text: 'debug mode; ignore restrictions',
                itemflags: MENU_ITEMFLAGS_SELECTED,
            });
            tty_end_menu(window, 'Which way do you want to teleport?');
            const result = await tty_select_menu(window, PICK_ONE);
            if (result.cancelled) {
                game.context.move = 0;
                return;
            }
            // if we got 2, use the one which wasn't preselected
            mode = result.selections.find(selection => selection.identifier !== 'w')
                ?.identifier ?? 'w';
        } finally {
            await tty_destroy_nhwindow(window);
        }
    } else {
        mode = 'w';
    }
    if (mode === 'w') {
        await teleportAtWill(true);
        return;
    }
    // the tmode switch: 'n' confers an intrinsic (I_SPECIAL), 's' and 't'
    // suppress both intrinsic and extrinsic sources, including those from
    // polymorph; the spell list hides or gains teleport-away accordingly.
    const hero = game.u;
    const teleporting = hero.teleporting;
    const teleportation = hero.teleportation;
    const turns = hero.teleportingTurns;
    const savedPropertySources = hero._propertySources;
    const sources = hero._propertySources ??= {};
    const savedSources = sources.teleportation;
    sources.teleportation = {
        intrinsic: mode === 'n' ? { ...savedSources?.intrinsic, potion: true } : {},
        worn: mode === 'n' ? savedSources?.worn ?? [] : [],
        invoked: mode === 'n' ? savedSources?.invoked ?? null : null,
        carried: mode === 'n' ? savedSources?.carried ?? [] : [],
    };
    hero.teleportation = hero.teleporting = mode === 'n';
    if (mode !== 'n') hero.teleportingTurns = 0;

    const spells = game.spells;
    const index = spells.findIndex(spell => spell.otyp === SPE_TELEPORT_AWAY);
    // Native NO_SPELL hides the rest of the spell list too. Retain those
    // entries so their identities and letters survive restoration.
    const hidden = index >= 0 && mode !== 's' ? spells.splice(index) : [];
    let added = false;
    try {
        if (index < 0 && spells.length >= 52) {
            await impossible('tport_spell: spellbook full');
        } else if (index < 0 && mode === 's') {
            spells.push(createMemorizedSpell(SPE_TELEPORT_AWAY, 20000, game));
            added = true;
        }
        await teleportAtWill(false);
    } finally {
        if (added) spells.pop();
        spells.push(...hidden);
        if (teleporting === undefined) delete hero.teleporting;
        else hero.teleporting = teleporting;
        if (teleportation === undefined) delete hero.teleportation;
        else hero.teleportation = teleportation;
        if (turns === undefined) delete hero.teleportingTurns;
        else hero.teleportingTurns = turns;
        if (savedSources === undefined) delete sources.teleportation;
        else sources.teleportation = savedSources;
        if (!savedPropertySources && Object.keys(sources).length === 0) delete hero._propertySources;
    }
}

// C teleport.c:u_teleport_mon(). Relocation caused by immediate magic.
export async function teleportMonsterByHero(monster: Monster, {
    state = game, giveFeedback = true,
}: { state?: GameState; giveFeedback?: boolean } = {}) {
    requirePlayingGame(state);
    if ((state.level.flags.stasis_until ?? -1) >= state.moves) {
        if (giveFeedback) await pline(`A mysterious force prevents you teleporting ${monsterName(monster)}!`);
        return false;
    }
    if (monster.ispriest && templeRoomAt(state, monster.mx, monster.my)) {
        if (giveFeedback) await pline(`${monsterName(monster, { capitalized: true })} resists your magic!`);
        return false;
    }
    if (state.u.uswallow && state.u.ustuck === monster && monsterTeleportRestricted(monster, state)) {
        if (giveFeedback) await pline(`You are no longer inside ${monsterName(monster)}!`);
        await releaseHeroFromMonster(monster, { state });
        if (!await randomMonsterRelocation(monster, { state, flags: RLOC_MSG }))
            await sendMonsterToLimbo(monster, state);
        return true;
    }
    if ((monsterIsRider(monster) || monsterControlsTeleport(monster.mnum)) && rn2(13)) {
        const destination = enexto(monster.mnum, state.u.ux, state.u.uy, { state });
        if (destination) {
            await relocateMonsterTo(monster, destination.x, destination.y, { state });
            return true;
        }
    }
    return !!await randomMonsterRelocation(monster, { state, flags: RLOC_MSG });
}

// C dungeons[u.uz.dnum].dname: the dungeon name for a level location.
// Magic portals under the hero.
// C ref: teleport.c domagicportal.
function dungeonName(level: DungeonLocation | undefined) {
    return level ? game.dungeons[level.dnum]?.dname ?? '' : '';
}

// C dungeon.h:In_tutorial(): the tutorial-dungeon test; the port has no
// tutorial_dnum global, so domagicportal matches the dungeon name
// (teleport.c:1476-1477).
function isTutorialLevel(level: DungeonLocation | undefined) {
    return dungeonName(level) === 'The Tutorial';
}

// Part of C teleport.c:domagicportal(): apply and describe portal dizziness.
async function addPortalStun() {
    const hero = game.u;
    const alreadyStunned = !!(hero.stunned
        || (hero.stunnedTurns ?? 0) > 0);
    await makeStunned((hero.stunnedTurns ?? 0) + 3, { talk: false });
    return alreadyStunned ? 'You feel dizzier.' : 'You feel slightly dizzy.';
}

// C teleport.c:domagicportal()
export async function activateMagicPortal(
    trap: Trap, gotoLevel: typeof changeLevel | null | undefined,
): Promise<void> {
    requirePlayingGame(game);
    // C teleport.c:domagicportal() (1450-1451): a buried ball surfaces
    // before the leashed-follower check, so it comes back up even when the
    // portal attempt then shudders.
    if (game.u.utrap && game.u.utraptype === TT_BURIEDBALL)
        await buriedBallToPunishment(game);
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You shudder for a moment.');
        return;
    }
    const { uz, uz0 } = game.u;
    if (uz0 && (uz.dnum !== uz0.dnum || uz.dlevel !== uz0.dlevel)) return;

    await plineWithContinuation('You activated a magic portal!');
    if (In_endgame(game.u?.uz) && !game.u?.uhave?.amulet) {
        await plineWithContinuation(
            formatFeltMessage('dizzy for a moment, but nothing happens...'),
        );
        return;
    }
    if (!trap.dst) throw new Error('Magic portal has no destination.');
    const leavingTutorial = isTutorialLevel(game.u?.uz)
        && !isTutorialLevel(trap.dst);
    // C schedule_goto(): every entry, including a knockback hurtle, defers
    // the real level change. domove() still needs the departure level to
    // wear its engravings.
    // deferred_goto() prints dizziness after that movement tail finishes.
    const preMessage = leavingTutorial ? 'Resuming regular play.' : await addPortalStun();
    scheduleLevelChange([trap.dst, {
        arrival: leavingTutorial ? 'stairs' : 'portal',
    }], gotoLevel ?? undefined, preMessage);
    game.context.move = 1;
}

// Random object relocation, including floor effects and shop ownership.
// C teleport.c:rloco() and goodpos(..., NULL, 0).

// C teleport.c:rloco()
export async function relocateObjectRandomly(object: GameObject, {
    state = game, publish = plineWithContinuation, random = rn2,
}: {
    state?: GameState;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
} = {}): Promise<boolean> {
    requireLiveGame(state);
    if (object.otyp === CORPSE && monsterIsRider({ mnum: object.corpsenm })) {
        const revival = await reviveCorpseImmediately(object, state);
        if (!revival) throw new Error('Corpse revival returned no result for a Rider corpse');
        for (const message of revival.messages) await publish(message);
        if (revival.monster) return false;
    }
    unlinkObject(object, state);
    const oldx = object.ox, oldy = object.oy;
    const region = requireGameLevel(state).downTeleportRegion;
    const { x, y } = relocationPosition(oldx, oldy, region, state, random);
    const result = await applyFloorEffects(object, x, y, { state, publish, random });
    if (result.finished) {
        if (oldx !== 0 || oldy !== 0) await newsym(oldx, oldy);
        return false;
    }
    if (oldx !== 0 || oldy !== 0) {
        await settleRelocatedObject(object, oldx, oldy, x, y, state, publish);
        await newsym(oldx, oldy);
    }
    await placeObject(object, x, y, state);
    await newsym(x, y);
    return true;
}
// Part of C teleport.c:rloco(): select a permitted object destination.
function relocationPosition(
    oldx: number, oldy: number, region: ArrivalRegion | null | undefined,
    state: GameState, random: (limit: number) => number,
): Position {
    const fallRegion = oldx === 0 && region?.lx ? region : null;
    for (let attempt = 0; ; attempt++) {
        const x = random(COLNO - 3) + 2;
        const y = random(ROWNO);
        // Native uses the final candidate after exhausting its position search.
        if (attempt === 3999) return { x, y };
        if (!goodPosition(x, y, null, { state, random })) continue;
        if (fallRegion && (!inside(fallRegion, x, y)
            || (fallRegion.exclude?.lx && inside(fallRegion.exclude, x, y)))) continue;
        if (region?.exclude?.lx
            && insideWizardTower(x, y, state)
                !== insideWizardTower(oldx, oldy, state)) continue;
        return { x, y };
    }
}
// Part of C teleport.c:rloco(): settle shop ownership after object relocation.
async function settleRelocatedObject(
    object: GameObject, oldx: number, oldy: number, x: number, y: number,
    state: GameState, publish: MessagePublisher,
): Promise<void> {
    const level = requireGameLevel(state);
    const owner = findObjectOwner(object, oldx, oldy, state);
    if (!owner || !(costlySpot(oldx, oldy, state)
        || (object.unpaid && costlyAdjacent(owner, oldx, oldy, state)))) return;
    const heroRoom = roomsAt(level, state.u.ux, state.u.uy, SHOPBASE)[0];
    const oldRoom = roomsAt(level, oldx, oldy)[0];
    const heroInShop = heroRoom
        && roomsAt(level, owner.mx, owner.my).includes(heroRoom);
    const sameShop = oldRoom && roomsAt(level, x, y).includes(oldRoom);
    if (heroInShop && sameShop && costlySpot(x, y, state)) {
        if (object.unpaid)
            removeObjectAndContentsFromBill(object, state, { resident: owner });
    } else if (heroInShop && sameShop && costlyAdjacent(owner, x, y, state)) {
        if (!object.unpaid)
            await addShopObjectToBill(object, state, { ininv: false, publish });
    } else {
        await stolenValue(object, oldx, oldy, false, { silent: false, state, publish });
    }
}

// ── moved from src/js/trap.ts ──

// C teleport.c:level_tele_trap(). The level prompt acknowledges the trap
// announcement before accepting its first character.
export async function triggerLevelTeleportTrap(trap: Trap, gotoLevel: HeroTrapOptions['gotoLevel'],
    intentional: boolean): Promise<void> {
    requirePlayingGame(game);
    await seeTrap(trap);
    const hero = game.u;
    // C hack.c:u_locomotion() gives the hero's active movement properties
    // precedence over the species' normal way of moving.
    const locomotion = heroLocomotion('step');
    const verb = intentional ? 'trigger' : `${locomotion} onto`;
    await plineWithContinuation(`You ${verb} a level teleport trap!`);
    if (hero.antimagic && !intentional) await shieldeff(hero.ux, hero.uy);
    if (hero.antimagic && !intentional || In_endgame(hero.uz)) {
        await plineWithContinuation(formatFeltMessage('a wrenching sensation.'));
        return;
    }
    deleteTrap(trap);
    await newsym(hero.ux, hero.uy);
    await levelTeleport({
        gotoLevel: (...args) => { scheduleLevelChange(args, gotoLevel ?? changeLevel); },
    });
    if (game.program_state.gameover) return;
    const controlled = heroControlsTeleport();
    if (heroIsHallucinating(game) || controlled) {
        await plineWithContinuation(`You briefly feel ${heroIsHallucinating(game) ? 'oriented' : 'centered'}.`);
    } else {
        await plineWithContinuation(formatFeltMessage(`${(hero.confusionTurns ?? 0) > 0 || hero.confused ? 'even more ' : ''}disoriented.`));
    }
    if (!controlled) await makeConfused((hero.confusionTurns ?? 0) + 3, { talk: false });
}
