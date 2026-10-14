// C trap.c:launch_obj(), ROLL styles. Each square resolves its occupants,
// traps and floor effects before the next square or final placement.
import { heroHasCarriedArtifactFlag } from './artifacts.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import {
    DOOR, D_BROKEN, D_CLOSED, D_LOCKED, IRONBARS, IS_OBSTRUCTED, IS_STWALL,
    IS_TREE, LANDMINE, LEVEL_TELEP, M_AP_MONSTER, MIGR_RANDOM, TELEP_TRAP,
    is_hole, is_pit, isok,
} from './const.js';
import { canSpotMonster, newsym, plineWithContinuation, transientObjectGlyph } from './display.js';
import type { MessagePublisher } from './display.js';
import { levelAtDepth } from './dungeon.js';
import { deleteEngravingAt } from './engrave.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject, placeObjectSynchronously, stack_object } from './floor_object.js';
import { requireInitializedGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import { depth, distmin } from './hacklib.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { formatHeardMessage, formatSeenMessage } from './hero_speech.js';
import { animateRollingBoulderCell } from './hero_traps.js';
import { randomTeleportDepth } from './level_teleport.js';
import type { Position } from './map_types.js';
import { angerMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, monsterIsNonliving, monsterIsVampireShifter } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName, monsterObjectPronoun } from './monster_name.js';
import { applyMonsterPassiveToObject } from './monster_passive.js';
import type { Monster } from './monster_types.js';
import { wakeMonstersNear } from './monster_wake.js';
import { findMonsterArmorClass } from './monworn.js';
import { BOULDER } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { observeObject } from './object_knowledge.js';
import { shipObject } from './object_migration.js';
import { unlinkObject } from './object_location.js';
import { splitObjectStack } from './object_stack.js';
import { relocateObjectRandomly } from './object_teleport.js';
import type { GameObject } from './object_types.js';
import { killerObjectName, objectCombatName } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { projectileHitsIronBars } from './projectile_bars.js';
import { fractureRock } from './rock_breakage.js';
import { d, rn2, rnd } from './rng.js';
import { scatterFloorObjects } from './scatter.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { deleteTrap } from './trap_lifecycle.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { rangedTargetHitBonus } from './weapon_accuracy.js';
import { rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';

interface RollingBoulderOptions {
    state?: PlayingGameState;
    unseen?: boolean;
    known?: boolean;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
}

const M1_WALLWALK = 0x00000008;
const M1_UNSOLID = 0x00100000;
const M2_ROCKTHROW = 0x08000000;

interface LaunchedObject {
    object: GameObject;
    origin: Position;
}

const activeLaunches = new WeakMap<GameState, LaunchedObject>();

// C launch_in_progress()/force_launch_placement(): bones retain the
// in-flight object at its original launch square so the trap can fire again.
export function restoreLaunchedObjectForBones(state: GameState): void {
    const launch = activeLaunches.get(state);
    if (!launch) return;
    unlinkObject(launch.object, state);
    launch.object.otrapped = false;
    placeObjectSynchronously(launch.object, launch.origin.x, launch.origin.y, state);
}

export async function launchRollingBoulder(start: Position, endpoint: Position, {
    state = requireInitializedGame(), unseen = false, known = false, publish = plineWithContinuation,
    random = rn2, rollOne = rnd, rollDice = d,
}: RollingBoulderOptions = {}): Promise<boolean> {
    requirePlayingGame(state);
    const level = state.level;
    let source = start, destination = endpoint;
    let boulder = boulderAt(source, state);
    if (!boulder) {
        boulder = boulderAt(destination, state);
        if (!boulder) return false;
        [source, destination] = [destination, source];
    }
    if (boulder.quan > 1) {
        const single = splitObjectStack(boulder, 1, state);
        if (!single) throw new Error(`Cannot launch one boulder from stack ${boulder.o_id}`);
        boulder = single;
    }
    unlinkObject(boulder, state);
    newsym(source.x, source.y);
    vision_note_blocker_change(source.x, source.y);
    const digging = state.context.digging;
    if (digging?.pos.x === source.x && digging.pos.y === source.y) delete state.context.digging;
    boulder.otrapped = known;
    if (unseen) {
        if (cansee(source.x, source.y)) {
            const name = withIndefiniteArticle(objectCombatName(boulder, { state }));
            await publish(formatSeenMessage(`${name} start to roll.`, state));
        }
        else await hear(heroIsHallucinating(state) ? 'someone bowling.'
            : `rumbling ${(source.x - state.u.ux) ** 2 + (source.y - state.u.uy) ** 2 <= 16 ? 'nearby' : 'in the distance'}.`);
    }

    const dx = Math.sign(destination.x - source.x), dy = Math.sign(destination.y - source.y);
    let remaining = distmin(source.x, source.y, destination.x, destination.y);
    let position = { ...source };
    let resting = { ...destination };
    let transient: Position | null = null;
    let usedUp = false;
    const glyph = transientObjectGlyph(boulder);
    activeLaunches.set(state, { object: boulder, origin: { ...source } });
    try {
        while (remaining-- > 0 && !usedUp && !state.program_state.gameover) {
            transient = await animateRollingBoulderCell(boulder, glyph, position.x, position.y, transient);
            const next = { x: position.x + dx, y: position.y + dy };
            if (!isok(next.x, next.y)) { resting = position; break; }
            position = next;
            const monster = monsterAtPosition(level, position.x, position.y);
            if (monster) {
                if ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW && random(3)) {
                    if (cansee(position.x, position.y))
                        await publish(`${monsterName(monster, { state, capitalized: true })} snatches the boulder.`);
                    boulder.otrapped = false;
                    await addObjectToMonsterInventory(monster, boulder, state);
                    usedUp = true;
                    break;
                }
                usedUp = await hitMonster(monster, boulder);
                if (usedUp || state.program_state.gameover) break;
            } else if (state.u.ux === position.x && state.u.uy === position.y) {
                let damage = rollPhysicalWeaponDamageAgainstHero(boulder, state, { rollOne, rollDice });
                if (state.u.halfPhysicalDamage || heroHasCarriedArtifactFlag('SPFX_HPHDAM', state))
                    damage = Math.trunc((damage + 1) / 2);
                if (state.multi) endVoluntaryMultiTurn(state);
                const hit = await hitHeroWithObject(boulder, damage, 9 + (boulder.spe ?? 0), {
                    state, publish, rollOne, killer: killerObjectName(boulder, state),
                });
                if (hit.died) break;
                if (hit.hit) await stopHeroOccupation(state, publish);
            }
            if (await shipObject(boulder, position.x, position.y, { state, publish, random })) { usedUp = true; break; }
            const trap = level.traps.find(candidate => candidate.tx === position.x && candidate.ty === position.y);
            if (trap?.ttyp === LANDMINE && random(10) > 2) {
                await publish(`KAABLAMM!!!${cansee(position.x, position.y) ? '  The rolling boulder triggers a land mine.' : ''}`);
                deleteTrap(trap, state);
                deleteEngravingAt(position.x, position.y, level);
                await placeObject(boulder, position.x, position.y, state);
                boulder.otrapped = false;
                await fractureRock(boulder, position.x, position.y, { state, publish, random });
                await scatterFloorObjects(position.x, position.y, 4, {
                    state, publish, random, rollOne, rollDice,
                    heroCaused: !state.context.mon_moving,
                    finishMonsterDeath: async (target, deathOptions = {}) => {
                        if (state.context.mon_moving)
                            return finishEnvironmentalMonsterDeath(target, state, { ...deathOptions, publish, random });
                        if (deathOptions.deathMessage) await publish(deathOptions.deathMessage);
                        // Debris uses ohitmon's ordinary missile range, so
                        // an unknown boulder trap still gives hero kill credit.
                        const death = await finishHeroMonsterKillOutcome(target, target.mx, target.my, {
                            showKillMessage: false, publish,
                        });
                        return { survived: !death.killed, heroDied: death.heroDied };
                    },
                });
                newsym(position.x, position.y);
                usedUp = true;
                break;
            }
            if (trap && (trap.ttyp === TELEP_TRAP || trap.ttyp === LEVEL_TELEP)) {
                const newDepth = trap.ttyp === LEVEL_TELEP ? randomTeleportDepth(state, random, rollOne) : null;
                if (newDepth !== depth(state.u.uz, state.dungeons)) {
                    if (cansee(position.x, position.y)) await publish('Suddenly the rolling boulder disappears!');
                    else if (!heroIsDeaf(state)) await hear('a rumbling stop abruptly.');
                    boulder.otrapped = false;
                    if (newDepth === null) await relocateObjectRandomly(boulder, { state, publish, random });
                    else {
                        const location = levelAtDepth(newDepth, { state });
                        boulder.no_charge = false;
                        boulder.where = 'migrating';
                        boulder.ox = location.dnum;
                        boulder.oy = location.dlevel;
                        boulder.owornmask = MIGR_RANDOM;
                        boulder.migration = { source: { ...state.u.uz }, destination: location, arrival: MIGR_RANDOM };
                        (state.migratingObjects ??= []).unshift(boulder);
                    }
                    trap.tseen = true;
                    newsym(trap.tx, trap.ty);
                    usedUp = true;
                    break;
                }
            }
            const floor = await applyFloorEffects(boulder, position.x, position.y, { state, publish, random, verb: 'fall' });
            if (floor.finished) { usedUp = true; break; }
            if (trap && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) { resting = position; break; }
            const other = boulderAt(position, state);
            if (other) {
                const ahead = level.at(position.x + dx, position.y + dy);
                const collision = !remaining || !ahead || IS_OBSTRUCTED(ahead.typ)
                    ? ' as one boulder hits another' : ' as one boulder sets another in motion';
                await hear(`a loud crash${cansee(position.x, position.y) ? collision : ''}!`);
                unlinkObject(other, state);
                other.otrapped = !!boulder.otrapped;
                boulder.otrapped = false;
                await placeObject(boulder, position.x, position.y, state);
                boulder = other;
                wakeMonstersNear(position.x, position.y, 100, state);
            }
            const cell = level.requireAt(position.x, position.y);
            if (cell.typ === DOOR && cell.doormask & (D_CLOSED | D_LOCKED)) {
                if (cansee(position.x, position.y)) await publish('The boulder crashes through a door.');
                cell.doormask = D_BROKEN;
                if (remaining) vision_note_blocker_change(position.x, position.y);
            }
            const ahead = level.at(position.x + dx, position.y + dy);
            if (remaining > 0 && ahead) {
                if (ahead.typ === IRONBARS) {
                    const bars = await projectileHitsIronBars(boulder, {
                        x: position.x, y: position.y, barsX: position.x + dx, barsY: position.y + dy,
                        state, publish, random, forceHit: random(20) === 0,
                    });
                    if (bars.blocked) { resting = position; usedUp = bars.destroyed; break; }
                } else if (IS_STWALL(ahead.typ) || IS_TREE(ahead.typ)) {
                    resting = position;
                    if (!heroIsDeaf(state)) await publish('Thump!');
                    wakeMonstersNear(position.x, position.y, 16, state);
                    break;
                }
            }
        }
    } finally {
        if (transient) newsym(transient.x, transient.y);
        activeLaunches.delete(state);
    }
    if (!usedUp && !state.program_state.gameover) {
        boulder.otrapped = false;
        await placeObject(boulder, resting.x, resting.y, state);
        newsym(resting.x, resting.y);
    }
    return true;

    async function hear(sound: string): Promise<void> {
        const message = formatHeardMessage(sound, state);
        if (message) await publish(message);
    }

    async function hitMonster(monster: Monster, object: GameObject): Promise<boolean> {
        const visible = cansee(position.x, position.y);
        const spotted = canSpotMonster(monster);
        const mimic = !!monster.m_ap_type && monster.m_ap_type !== M_AP_MONSTER;
        if (visible) observeObject(object, state);
        const accuracy = 5 + findMonsterArmorClass(monster) + rangedTargetHitBonus(object, monster, { state });
        if (accuracy < rollOne(20)) {
            if (visible && !mimic) {
                const name = objectCombatName(object, { state });
                const target = state.flags.verbose ? monsterName(monster, { state }) : 'it';
                await publish(`The ${name} misses ${target}.`);
            }
            return false;
        }
        const damage = rollPhysicalWeaponDamage(object, monster, { state, rollOne, rollDice });
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        const harmless = !!(flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
        if (mimic) revealMonsterAppearance(monster);
        monster.msleeping = 0;
        if (visible) {
            const ending = harmless
                ? ` but passes harmlessly through ${monsterObjectPronoun(monster, { state, random })}.`
                : damage > 4 ? '!' : '.';
            const name = objectCombatName(object, { state });
            const target = state.flags.verbose ? monsterName(monster, { state }) : 'it';
            await publish(`The ${name} hits ${target}${ending}`);
        }
        if (!harmless) {
            monster.mhp -= damage;
            if (monster.mhp <= 0) {
                if (visible) await publish(`${monsterName(monster, { state, capitalized: true })} is ${
                    monsterIsNonliving(monster.mnum) || monsterIsVampireShifter(monster) || !spotted ? 'destroyed' : 'killed'}!`);
                if (!state.context.mon_moving && object.otrapped)
                    await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, { showKillMessage: false, publish });
                else await finishEnvironmentalMonsterDeath(monster, state, { publish, random });
            }
        }
        if (!monster.dead && monster.mhp > 0 && !state.context.mon_moving)
            await angerMonster(monster, { attacked: true });
        if (await shipObject(object, position.x, position.y, { state, publish, random })) return true;
        const occupant = monsterAtPosition(level, position.x, position.y);
        const floor = await applyFloorEffects(object, position.x, position.y, { state, publish, random, verb: 'fall' });
        if (floor.finished) return true;
        await placeObject(object, position.x, position.y, state);
        const defender = occupant ?? (state.u.ux === position.x && state.u.uy === position.y ? state.u : null);
        if (defender) await applyMonsterPassiveToObject(defender, object, { state, publish, random });
        object = await stack_object(object, state);
        boulder = object;
        unlinkObject(object, state);
        return false;
    }
}

function boulderAt(position: Position, state: PlayingGameState): GameObject | null {
    return state.level.objects[position.x]?.[position.y]?.find(object => object.otyp === BOULDER) ?? null;
}
