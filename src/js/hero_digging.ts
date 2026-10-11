// Hero pick-axe/axe digging occupation.
// C refs: dig.c dig_typ(), use_pick_axe2() digging branches, dig(),
// mkcavepos()/mkcavearea(); hack.c may_dig(); weapon.c abon().

import { monsterHasMapPosition } from './monster_location.js';
import { deleteTrap } from './trap_lifecycle.js';
import {
    RLOC_NOMSG,
    A_STR, A_DEX, COULD_SEE, CORR, DBWALL, D_BROKEN, D_CLOSED, D_LOCKED,
    D_NODOOR, D_TRAPPED, DIGTYP_BOULDER, DIGTYP_DOOR, DIGTYP_ROCK,
    DIGTYP_STATUE, DIGTYP_TREE, DIGTYP_UNDIGGABLE, DOOR, IN_SIGHT,
    IS_ALTAR, IS_DOOR, IS_OBSTRUCTED, IS_STWALL, IS_TREE, IS_WALL,
    LANDMINE, BEAR_TRAP, HOLE, TRAPDOOR, MM_NOMSG, ROOM, SCORR,
    SDOOR, SHOPBASE, SHOP_DOOR_COST, SHOP_PIT_COST, STONE,
    TRAP_EXPLANATIONS, TT_PIT, Upolyd, W_NONDIGGABLE, Is_earthlevel, is_pit,
} from './const.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { altarWrath } from './pray.js';
import { adjustHeroAlignment } from './alignment.js';
import { angerTemplePriest } from './priest.js';
import { heroFootName } from './body_parts.js';
import {
    feel_location, flush_screen, newsym, pline, plineWithContinuation,
} from './display.js';
import { game, requireGameLevel } from './gstate.js';
import type { GameState, DiggingContext } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MapLocation, Trap } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { DiggingOccupation } from './occupation_types.js';
import { pitsAreConjoined } from './pit_connections.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { placeObject, placeCreatedObject, remove_object } from './floor_object.js';
import { loseHeroHp } from './hero_damage.js';
import { woundHeroLegs } from './hero_legs.js';
import { triggerHeroTrap } from './hero_traps.js';
import { resetHeroTrap } from './terrain_movement.js';
import { dist2, isok } from './hacklib.js';
import { level_difficulty } from './dungeon.js';
import { carriedObjectOwner } from './shk.js';
import { makemonAt, mksobj } from './mklev.js';
import { MONSTER_FLAGS1, MONSTER_NAME, monsterTypeName, requireMonsterData } from './monster_data.js';
import { adjustedMonsterLevel } from './monster_hit_points.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import {
    APPLE, BANANA, BOULDER, EUCALYPTUS_LEAF, OBJECT_BIMANUAL, ORANGE, PEAR,
    STATUE,
} from './object_data.js';
import { objectName, ownedObjectAction } from './objnam.js';
import {
    heroMonsterForm, heroIsFlying,
} from './polyself.js';
import { randomMonsterRelocation } from './teleport.js';
import { inTown, roomsAt } from './room.js';
import { rn2, rnd, rnl } from './rng.js';
import { heroIsBlind } from './senses.js';
import { breakStatue, fractureRock } from './rock_breakage.js';
import {
    heroStrengthDamageBonus, rollPhysicalWeaponDamageAgainstHero,
} from './weapon_damage.js';
import { isAxe, isPick, willWeld } from './weapon_type.js';
import { vision_note_blocker_change } from './vision.js';
// Peer dig modules; see docs/porting-status.md handoff for the split.
import { digCheck, digCheckFailMessage, digHole } from './digging_terrain.js';
import {
    addShopDamage, payForShopDamage, shopDig,
} from './shop_damage.js';

const PM_EARTH_ELEMENTAL = MONSTER_NAME.indexOf('earth elemental');
const PM_XORN = MONSTER_NAME.indexOf('xorn');
const M1_WALLWALK = 0x00000008; // monflag.h: passes_walls(ptr)

const TREE_FRUITS = [APPLE, ORANGE, PEAR, BANANA, EUCALYPTUS_LEAF];

// C dig.c d_action[] for "You start <action>." messages.
const DIG_ACTIONS = [
    'swinging', 'digging', 'chipping the statue', 'hitting the boulder',
    'chopping at the door', 'cutting the tree',
] as const;

// C dig.c d_target[] for "You hit the <target>..." messages.
const DIG_TARGETS = ['', 'rock', 'statue', 'boulder', 'door', 'tree'] as const;

export type DiggingTarget = typeof DIGTYP_UNDIGGABLE | typeof DIGTYP_ROCK
    | typeof DIGTYP_STATUE | typeof DIGTYP_BOULDER | typeof DIGTYP_DOOR
    | typeof DIGTYP_TREE;

// C hack.h enum digcheck_result.  digging_terrain.js digCheck() returns
// these numeric values; the failure gate must match C's >= DIGCHECK_FAILED.
const DIGCHECK_PASSED = 1;
const DIGCHECK_PASSED_DESTROY_TRAP = 2;
const DIGCHECK_FAILED = 4;

function trapAt(x: number, y: number, state: GameState): Trap | null {
    return state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y) || null;
}

function monsterAt(x: number, y: number, state: GameState): Monster | null {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

function objectAt(x: number, y: number, otyp: number, state: GameState): GameObject | null {
    return (state.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === otyp) || null;
}

function closedDoorAt(location: MapLocation | null | undefined): boolean {
    // C dokick.c closed_door(): DOOR terrain with a closed or locked mask.
    return location?.typ === DOOR
        && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
}

// C dig.c pick_can_reach(): whether a pick can reach a statue or boulder
// that sits in (or beside) a pit.
function pickCanReach(tool: GameObject, x: number, y: number, state: GameState): boolean {
    const trap = trapAt(x, y, state);
    const targetInPit = !!(trap && is_pit(trap.ttyp) && trap.tseen);

    if ((state.u.utrap ?? 0) > 0 && state.u.utraptype === TT_PIT) {
        if (targetInPit)
            return pitsAreConjoined(trap, trapAt(state.u.ux, state.u.uy, state));
        return !!OBJECT_BIMANUAL[tool.otyp];
    }
    if (OBJECT_BIMANUAL[tool.otyp] || heroIsFlying(state)) return true;
    return !targetInPit;
}

// C dig.c dig_typ(): what is actually being dug at <x,y> with this tool.
// Returns the numeric DIGTYP_* constants from const.js.
export function diggingTarget(tool: GameObject | null | undefined, x: number, y: number, state = game): DiggingTarget {
    if (!isok(x, y) || !tool || (!isPick(tool) && !isAxe(tool)))
        return DIGTYP_UNDIGGABLE;
    const level = state.level;
    if (!level) return DIGTYP_UNDIGGABLE;
    const location = level.at(x, y);
    if (!location) return DIGTYP_UNDIGGABLE;
    const typ = location.typ;

    if (isAxe(tool))
        return closedDoorAt(location) ? DIGTYP_DOOR
            : IS_TREE(typ) ? DIGTYP_TREE
                : DIGTYP_UNDIGGABLE;
    return objectAt(x, y, STATUE, state) && pickCanReach(tool, x, y, state)
        ? DIGTYP_STATUE
        : objectAt(x, y, BOULDER, state) && pickCanReach(tool, x, y, state)
            ? DIGTYP_BOULDER
            : closedDoorAt(location) ? DIGTYP_DOOR
                : IS_TREE(typ) ? DIGTYP_UNDIGGABLE
                    : IS_OBSTRUCTED(typ)
                      && (!level.flags?.arboreal || IS_WALL(typ))
                        ? DIGTYP_ROCK
                        : DIGTYP_UNDIGGABLE;
}

// C hack.c may_dig(): only ROCKs and TREEs carry W_NONDIGGABLE.
export function mayDig(x: number, y: number, state = game): boolean {
    const location = state.level?.at(x, y);
    if (!location) return false;
    return !((IS_STWALL(location.typ) || IS_TREE(location.typ))
        && ((location.wall_info ?? 0) & W_NONDIGGABLE));
}

// C dig.c is_digging(): whether the dig occupation is currently running.
export function isDigging(state = game): boolean {
    return state._occupation?.key === 'dig';
}

// C dig.c:holetime(). Any active digging in a shop counts, not only downward digging.
export function diggingTimeToHole(state = game): number {
    if (!isDigging(state) || !state.u.ushops?.length) return -1;
    const digging = state.context.digging;
    if (!digging) throw new Error('Active digging requires a digging context.');
    return Math.trunc((250 - digging.effort) / 20);
}

export function ensureDiggingContext(state: GameState): DiggingContext {
    if (!state.context.digging)
        state.context.digging = {
            pos: { x: 0, y: 0 },
            level: { dnum: 0, dlevel: 0 },
            down: false, chew: false, warned: false,
            effort: 0, lastdigtime: 0, quiet: false,
        };
    return state.context.digging;
}

function onDiggingLevel(digging: DiggingContext, state: GameState): boolean {
    const uz = state.u.uz;
    return !!uz && digging.level.dnum === uz.dnum && digging.level.dlevel === uz.dlevel;
}

// C memset(&svc.context.digging, 0, ...) after a completed or aborted dig.
export function clearDiggingContext(state: GameState): void {
    const digging = state.context?.digging;
    if (!digging) return;
    digging.pos.x = 0;
    digging.pos.y = 0;
    digging.level.dnum = 0;
    digging.level.dlevel = 0;
    digging.down = false;
    digging.chew = false;
    digging.warned = false;
    digging.effort = 0;
    digging.lastdigtime = 0;
    digging.quiet = false;
}

// C weapon.c abon().  cmd.js meleeAttributeBonus() holds the same human
// ladder; dig.c needs the polymorphed-form branch too.
function heroAttackBonus(state: GameState): number {
    if (Upolyd(state.u)) {
        const form = heroMonsterForm(state);
        return form == null ? 0 : adjustedMonsterLevel(form) - 3;
    }
    const strength = currentAttribute(A_STR, state);
    const dexterity = currentAttribute(A_DEX, state);
    let bonus = strength < 6 ? -2
        : strength < 8 ? -1
            : strength < 17 ? 0
                : strength < 1850 ? 1
                    : strength < 1900 ? 2 : 3;
    if ((state.u?.ulevel ?? 1) < 3) bonus++;
    return bonus + (dexterity < 4 ? -3
        : dexterity < 6 ? -2
            : dexterity < 8 ? -1
                : dexterity < 14 ? 0 : dexterity - 14);
}

// C weapon.c greatest_erosion(): worst of fire and rot damage.
function greatestErosion(object: Pick<GameObject, 'oeroded' | 'oeroded2'>): number {
    return Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0);
}

function maybeHalfPhysical(damage: number, state: GameState): number {
    return state.u.halfPhysicalDamage
        ? Math.ceil(damage / 2) : damage;
}

function feelNewsym(x: number, y: number, state: GameState): void {
    // C display.c feel_newsym(): blind heroes feel the changed location.
    if (heroIsBlind(state)) feel_location(x, y);
    else newsym(x, y);
}

// C objnam.c yname()/yobjnam(): mid-sentence "your pick-axe".
// carriedObjectOwner() yields the sentence-start possessive, including the
// shopkeeper form for unpaid goods; lowercase it for use after a verb.
function ownedNameMidSentence(object: GameObject, state: GameState): string {
    const owner = carriedObjectOwner(object, state);
    return `${
        owner.charAt(0).toLowerCase()}${owner.slice(1)
    } ${objectName(object, state)}`;
}

function articleFor(name: string): string {
    return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`;
}

// C trap.c b_trapped("door", NO_PART): the trapped-door explosion from
// finishing a dig through it.  force_bolt.js owns the parallel message
// pair for zapped doors; this port covers the dig owner.
async function explodeDoorTrap(state: GameState): Promise<void> {
    const lvl = level_difficulty();
    const damage = rnd(5 + (lvl < 5 ? lvl : 2 + Math.trunc(lvl / 2)));
    await pline('KABOOM!!  The door was booby-trapped!');
    await wakeMonstersNearWithMessages(
        state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state,
    );
    await loseHeroHp(maybeHalfPhysical(damage, state), 'explosion', { state });
    await exerciseAttribute(A_STR, false, state);
    // make_stunned(HStun & TIMEOUT + dmg): stack onto any current timeout.
    state.u.stunnedTurns = (state.u.stunnedTurns ?? 0) + damage;
    state.u.stunned = true;
}

export async function placeTreeFruit(
    x: number, y: number, state: GameState = game, random: typeof rn2 = rn2,
): Promise<void> {
    // C mkobj.c rnd_treefruit_at(): mksobj_at(ROLL_FROM(treefruits), ...).
    const fruitType = TREE_FRUITS[random(TREE_FRUITS.length)];
    if (fruitType === undefined) throw new RangeError('Tree fruit selection is outside the fruit table.');
    const fruit = await mksobj(fruitType, true, false);
    placeCreatedObject(fruit, x, y, state);
}

// C dig.c rm_waslit().
function rmWasLit(state: GameState): boolean {
    const hero = state.u;
    const level = requireGameLevel(state);
    const own = level.at(hero.ux, hero.uy);
    if (own?.typ === ROOM && own.waslit) return true;
    for (let x = hero.ux - 2; x < hero.ux + 3; x++)
        for (let y = hero.uy - 1; y < hero.uy + 2; y++)
            if (isok(x, y) && level.at(x, y)?.waslit) return true;
    return false;
}

// C dig.c mkcavepos().
async function mkcavepos(x: number, y: number, dist: number, waslit: boolean, rockit: boolean, state: GameState): Promise<void> {
    if (!isok(x, y)) return;
    const location = requireGameLevel(state).at(x, y);
    if (!location) return;
    if (rockit) {
        if (IS_OBSTRUCTED(location.typ)) return;
        if (trapAt(x, y, state)) return;
        const monster = monsterAt(x, y, state);
        if (monster && !(requireMonsterData(MONSTER_FLAGS1, monster.mnum) & M1_WALLWALK)) {
            // C rloc(mtmp, RLOC_NOMSG): relocate without a message.
            await randomMonsterRelocation(monster, { state, flags: RLOC_NOMSG });
        }
    } else if (location.typ === ROOM) {
        return;
    }

    vision_note_blocker_change(x, y);
    location.seenv = 0;
    location.doormask = 0;
    if (dist < 3) location.lit = !rockit;
    if (waslit) location.waslit = !rockit;
    location.horizontal = false;
    const visibilityRow = state.viz_array?.[y];
    if (visibilityRow)
        visibilityRow[x] = dist < 3 ? (IN_SIGHT | COULD_SEE) : COULD_SEE;
    location.typ = rockit ? STONE : ROOM;
    feelNewsym(x, y, state);
}

// C dig.c mkcavearea(): the Earth plane's collapsing/created cave.
async function mkcavearea(rockit: boolean, state: GameState): Promise<void> {
    const hero = state.u;
    const level = requireGameLevel(state);
    const heroLocation = level.at(hero.ux, hero.uy);
    if (!heroLocation) throw new Error('Cave digging requires the hero to occupy a map cell.');
    let xmin = hero.ux, xmax = hero.ux, ymin = hero.uy, ymax = hero.uy;
    const waslit = rmWasLit(state);

    if (rockit)
        await plineWithContinuation(
            'Crash!  The ceiling collapses around you!',
        );
    else
        await plineWithContinuation(`A mysterious force ${
        heroLocation.typ === CORR
            ? 'creates a' : 'extends the'
    } cave around you!`);

    for (let dist = 1; dist <= 2; dist++) {
        xmin--;
        xmax++;
        if (dist < 2) {
            ymin--;
            ymax++;
            for (let i = xmin + 1; i < xmax; i++) {
                await mkcavepos(i, ymin, dist, waslit, rockit, state);
                await mkcavepos(i, ymax, dist, waslit, rockit, state);
            }
        }
        for (let i = ymin; i <= ymax; i++) {
            await mkcavepos(xmin, i, dist, waslit, rockit, state);
            await mkcavepos(xmax, i, dist, waslit, rockit, state);
        }
        await flush_screen(1);
    }

    if (!rockit && heroLocation.typ === CORR) {
        heroLocation.typ = ROOM;
        if (waslit) heroLocation.waslit = true;
        newsym(hero.ux, hero.uy);
    }
    state.vision_full_recalc = 1;
}

// C dig.c use_pick_axe2() digging-target branches: fresh-versus-continue
// wording, context reset, and the dig occupation setup.  The caller has
// already wielded the tool and resolved the target square.
export async function startHeroDigging(
    tool: GameObject, x: number, y: number, { down = false, state = game } = {},
): Promise<{ spentTime: true }> {
    const heroLevel = state.u.uz;
    if (!heroLevel) throw new Error('Digging requires a hero dungeon location.');
    const ispick = isPick(tool);
    const verbing = ispick ? 'digging' : 'chopping';
    const digging = ensureDiggingContext(state);
    const occupation: DiggingOccupation = { key: 'dig', text: verbing, didDigMessage: false };
    state._occupation = occupation;
    const moves = state.moves ?? 0;

    if (!down) {
        const digTarget = diggingTarget(tool, x, y, state);
        digging.quiet = false;
        if (digging.pos.x !== x || digging.pos.y !== y
            || !onDiggingLevel(digging, state) || digging.down) {
            if (state.flags?.autodig && digTarget === DIGTYP_ROCK
                && !digging.down
                && state.u.ux === digging.pos.x
                && state.u.uy === digging.pos.y
                && moves <= digging.lastdigtime + 2
                && moves >= digging.lastdigtime) {
                // Repeated autodigging stays silent for two moves.
                occupation.didDigMessage = true;
                digging.quiet = true;
            }
            digging.down = false;
            digging.chew = false;
            digging.warned = false;
            digging.pos.x = x;
            digging.pos.y = y;
            digging.level.dnum = heroLevel.dnum;
            digging.level.dlevel = heroLevel.dlevel;
            digging.effort = 0;
            if (!digging.quiet)
                await pline(`You start ${DIG_ACTIONS[digTarget]}.`);
        } else {
            await pline(`You ${
                digging.chew ? 'begin' : 'continue'
            } ${DIG_ACTIONS[digTarget]}.`);
            digging.chew = false;
        }
    } else {
        if (digging.pos.x !== state.u.ux || digging.pos.y !== state.u.uy
            || !onDiggingLevel(digging, state) || !digging.down) {
            digging.chew = false;
            digging.down = true;
            digging.warned = false;
            digging.pos.x = state.u.ux;
            digging.pos.y = state.u.uy;
            digging.level.dnum = heroLevel.dnum;
            digging.level.dlevel = heroLevel.dlevel;
            digging.effort = 0;
            await pline(`You start ${verbing} downward.`);
            if (state.u.ushops?.length) {
                await shopDig(0, state);
                addShopDamage(
                    state.u.ux, state.u.uy, SHOP_PIT_COST, state,
                );
            }
        } else {
            await pline(`You continue ${verbing} downward.`);
        }
    }
    return { spentTime: true };
}

// C dig.c dig(): one dig occupation tick.  Returns true to keep digging.
export async function continueHeroDigging(state = game): Promise<boolean> {
    const digging = state.context?.digging;
    if (!digging) return false;
    const dpx = digging.pos.x;
    const dpy = digging.pos.y;
    const hero = state.u;
    const uwep = state.uwep || state.u?.uwep || null;
    const ispick = !!uwep && isPick(uwep);
    const verb = !uwep || ispick ? 'dig into' : 'chop through';
    const level = state.level;
    const location = level?.at(dpx, dpy);
    if (!level || !location) return false;

    // A nymph may have stolen the pick-axe, or the hero teleported away.
    if (hero.uswallow || !uwep || (!ispick && !isAxe(uwep))
        || !onDiggingLevel(digging, state)
        || (digging.down ? (dpx !== hero.ux || dpy !== hero.uy)
            : dist2(dpx, dpy, hero.ux, hero.uy) > 2))
        return false;

    let dcresult = DIGCHECK_PASSED;
    if (digging.down) {
        dcresult = await digCheck('you', hero.ux, hero.uy, state);
        if (dcresult >= DIGCHECK_FAILED) {
            await digCheckFailMessage(
                dcresult, 'you', hero.ux, hero.uy, { state },
            );
            return false;
        }
    } else {
        if (IS_TREE(location.typ) && !mayDig(dpx, dpy, state)
            && diggingTarget(uwep, dpx, dpy, state) === DIGTYP_TREE) {
            await pline('This tree seems to be petrified.');
            return false;
        }
        if (IS_OBSTRUCTED(location.typ) && !mayDig(dpx, dpy, state)
            && diggingTarget(uwep, dpx, dpy, state) === DIGTYP_ROCK) {
            await pline(`This ${
                location.typ === DBWALL ? 'drawbridge' : 'wall'
            } is too hard to ${verb}.`);
            return false;
        }
    }

    if (hero.fumbling && !rn2(3)) {
        switch (rn2(3)) {
        case 0:
            if (!willWeld(uwep)) {
                await pline(
                    `You fumble and drop ${
                        ownedNameMidSentence(uwep, state)
                    }.`,
                );
                await dropInventoryObjectAtHero(uwep, { state });
            } else {
                const plural = (uwep.quan ?? uwep.quantity ?? 1) > 1;
                const bounced = ownedObjectAction(uwep, 'bounce', state);
                if (hero.usteed) {
                    const steed = hero.usteed;
                    const steedName = steed.name
                        || `the ${monsterTypeName(steed.mnum, !!steed.female)}`;
                    await pline(
                        `${bounced} and ${plural ? 'hit' : 'hits'} ${steedName}!`,
                    );
                } else {
                    await pline(
                        `Ouch!  ${bounced} and ${plural ? 'hit' : 'hits'} you!`,
                    );
                }
                await woundHeroLegs('right', 5 + rnd(5), state);
            }
            break;
        case 1:
            await pline(
                `Bang!  You hit with the broad side of ${
                    objectName(uwep, state)
                }!`,
            );
            await wakeMonstersNearWithMessages(
                hero.ux, hero.uy, (hero.ulevel ?? 1) * 20, state,
            );
            break;
        default:
            await pline('Your swing misses its mark.');
            break;
        }
        return false;
    }

    digging.effort += 10 + rn2(5) + heroAttackBonus(state) + (uwep.spe ?? 0)
        - greatestErosion(uwep) + (state.udaminc ?? 0);
    if (state.urace?.name === 'dwarf') digging.effort *= 2;

    if (digging.down) {
        const trap = trapAt(dpx, dpy, state);

        if (digging.effort > 250 || trap?.ttyp === HOLE) {
            await digHole({ state });
            clearDiggingContext(state);
            return false;
        }

        if (digging.effort <= 50
            || (trap && (trap.ttyp === TRAPDOOR || is_pit(trap.ttyp)))) {
            return true;
        } else if (trap && (trap.ttyp === LANDMINE
            || (trap.ttyp === BEAR_TRAP && !((hero.utrap ?? 0) > 0)))) {
            // Digging onto a set object trap triggers it; #untrap first.
            const result = await triggerHeroTrap(trap, { forceTrap: true });
            if (result.died) return false;
            clearDiggingContext(state);
            return false;
        } else if (trap && trap.ttyp === BEAR_TRAP && (hero.utrap ?? 0) > 0) {
            if (rnl(7) > (hero.fumbling ? 1 : 4)) {
                let damage = rollPhysicalWeaponDamageAgainstHero(
                    uwep, state, { rollOne: rnd },
                ) + heroStrengthDamageBonus(state);
                if (damage < 1) damage = 1;
                else if (state.uarmf || state.u?.uarmf)
                    damage = Math.trunc((damage + 1) / 2);
                await pline(`You hit yourself in the ${heroFootName(state)}.`);
                await loseHeroHp(
                    maybeHalfPhysical(damage, state),
                    `chopping off your own ${heroFootName(state)}`,
                    { state },
                );
            } else {
                await pline(
                    `You destroy the bear trap with ${
                        ownedNameMidSentence(uwep, state)
                    }.`,
                );
                deleteTrap(trap, state);
                // C reset_utrap(TRUE): falling out of the trap may settle
                // flight/levitation state before the dig resumes.
                await resetHeroTrap(true, state);
            }
            digging.effort = 0;
            return false;
        } else if (trap && dcresult === DIGCHECK_PASSED_DESTROY_TRAP) {
            const trapName = TRAP_EXPLANATIONS[trap.ttyp] ?? 'trap';
            if (ispick) {
                await pline(`You destroy ${
                    trap.tseen ? `the ${trapName}` : articleFor(trapName)
                } with ${ownedNameMidSentence(uwep, state)}.`);
            }
            deleteTrap(trap, state);
            digging.effort = 0;
            return false;
        }

        if (IS_ALTAR(location.typ)) {
            await altarWrath(dpx, dpy, state);
            await angerTemplePriest(state);
        }

        // Make a pit at the hero's own square.
        if (await digHole({ pitOnly: true, state })) {
            digging.level.dnum = 0;
            digging.level.dlevel = -1;
        }
        return false;
    }

    if (digging.effort > 100) {
        let digtxt = null;
        let dmgtxt = null;
        const shopedge = roomsAt(level, dpx, dpy, SHOPBASE).length > 0;
        const digtyp = diggingTarget(uwep, dpx, dpy, state);
        let cleanedUp = false;

        const statue = objectAt(dpx, dpy, STATUE, state);
        const boulder = objectAt(dpx, dpy, BOULDER, state);
        if (digtyp === DIGTYP_STATUE && statue) {
            const shattered = await breakStatue(statue, dpx, dpy, { state });
            digtxt = shattered ? 'The statue shatters.' : null;
        } else if (digtyp === DIGTYP_BOULDER && boulder) {
            await fractureRock(boulder, dpx, dpy, { state });
            const other = objectAt(dpx, dpy, BOULDER, state);
            if (other) {
                // Another boulder here: restack it to the top.
                remove_object(other, state);
                await placeObject(other, dpx, dpy, state);
            }
            digtxt = 'The boulder falls apart.';
        } else if (location.typ === STONE || location.typ === SCORR
            || IS_TREE(location.typ)) {
            if (Is_earthlevel(state.u?.uz)) {
                if (uwep.blessed && !rn2(3)) {
                    await mkcavearea(false, state);
                    cleanedUp = true;
                } else if ((uwep.cursed && !rn2(4))
                    || (!uwep.blessed && !rn2(6))) {
                    await mkcavearea(true, state);
                    cleanedUp = true;
                }
            }
            if (!cleanedUp) {
                if (digtyp === DIGTYP_TREE) {
                    digtxt = 'You cut down the tree.';
                    location.typ = ROOM;
                    location.flags = 0;
                    if (!rn2(5)) await placeTreeFruit(dpx, dpy, state);
                    if (state.urace?.name === 'elf'
                        || state.urole?.key === 'ranger')
                        adjustHeroAlignment(-1, state);
                } else {
                    digtxt = 'You succeed in cutting away some rock.';
                    location.typ = CORR;
                    location.flags = 0;
                }
            }
        } else if (IS_WALL(location.typ)) {
            if (shopedge) {
                await addShopDamage(
                    dpx, dpy, 10 * currentAttribute(A_STR, state), state,
                );
                dmgtxt = 'damage';
            }
            if (level.flags?.is_maze_lev) {
                location.typ = ROOM;
                location.flags = 0;
            } else if (level.flags?.is_cavernous_lev
                && !inTown(level, dpx, dpy)) {
                location.typ = CORR;
                location.flags = 0;
            } else {
                location.typ = DOOR;
                location.doormask = D_NODOOR;
            }
            digtxt = 'You make an opening in the wall.';
        } else if (location.typ === SDOOR) {
            // cvt_sdoor_to_door(): the hidden door becomes a real one.
            location.typ = DOOR;
            digtxt = 'You break through a secret door!';
            if (!((location.doormask ?? 0) & D_TRAPPED))
                location.doormask = D_BROKEN;
        } else if (closedDoorAt(location)) {
            digtxt = `You break through the door with your ${
                objectName(uwep, state)
            }.`;
            if (shopedge) {
                await addShopDamage(dpx, dpy, SHOP_DOOR_COST, state);
                dmgtxt = 'break';
            }
            if (!((location.doormask ?? 0) & D_TRAPPED))
                location.doormask = D_BROKEN;
        } else {
            // The statue or boulder got taken in the meantime.
            return false;
        }

        if (!cleanedUp) {
            vision_note_blocker_change(dpx, dpy);
            feelNewsym(dpx, dpy, state);
            if (digtxt && !digging.quiet) await pline(digtxt);
            if (dmgtxt) await payForShopDamage(dmgtxt, { state });

            if (Is_earthlevel(state.u?.uz) && !rn2(3)) {
                const mndx = rn2(2) ? PM_EARTH_ELEMENTAL : PM_XORN;
                if (await makemonAt(mndx, dpx, dpy, MM_NOMSG))
                    await pline('The debris from your digging comes to life!');
            }
            if (IS_DOOR(location.typ)
                && ((location.doormask ?? 0) & D_TRAPPED)) {
                location.doormask = D_NODOOR;
                await explodeDoorTrap(state);
                vision_note_blocker_change(dpx, dpy);
                newsym(dpx, dpy);
            }
        }
        digging.lastdigtime = state.moves ?? 0;
        digging.quiet = false;
        digging.level.dnum = 0;
        digging.level.dlevel = -1;
        return false;
    }

    // Not enough effort has been spent yet.
    const digTarget = diggingTarget(uwep, dpx, dpy, state);
    if (IS_WALL(location.typ) || digTarget === DIGTYP_DOOR) {
        if (roomsAt(level, dpx, dpy, SHOPBASE).length) {
            await pline(`This ${
                IS_DOOR(location.typ) ? 'door' : 'wall'
            } seems too hard to ${verb}.`);
            return false;
        }
    } else if (digTarget === DIGTYP_UNDIGGABLE
        || (digTarget === DIGTYP_ROCK && !IS_OBSTRUCTED(location.typ))) {
        // The statue or boulder got taken.
        return false;
    }

    const occupation = state._occupation?.key === 'dig' ? state._occupation : null;
    if (!occupation?.didDigMessage) {
        await pline(
            `You hit the ${DIG_TARGETS[digTarget]} with all your might.`,
        );
        await wakeMonstersNearWithMessages(
            hero.ux, hero.uy, (hero.ulevel ?? 1) * 20, state,
        );
        if (state._occupation?.key === 'dig') state._occupation.didDigMessage = true;
    }
    return true;
}
