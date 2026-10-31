// Monster body and terrain rules.
// C ref: mon.c.
import { game, requireInitializedGame } from './gstate.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { isLavaAt, isPoolAt, levelIsWaterLevel, monsterFliesOrFloats, monsterInAir } from './terrain_properties.js';
import { makeMonsterFlee } from './monster_flee.js';
import { ALLOW_ALL, ALLOW_BARS, ALLOW_DIG, ALLOW_M, ALLOW_MDISP, ALLOW_ROCK, ALLOW_SANCT, ALLOW_SSM, ALLOW_TM, ALLOW_TRAPS, ALLOW_U, ALLOW_WALL, A_CHA, BUSTDOOR, COLNO, D_BROKEN, D_CLOSED, D_LOCKED, IRONBARS, IS_DOOR, IS_OBSTRUCTED, IS_STWALL, IS_TREE, LAVAWALL, NOGARLIC, NOTONL, NO_WEAPON_WANTED, OPENDOOR, RLOC_MSG, RLOC_NOMSG, ROWNO, SHOPBASE, TELEP_TRAP, TEMPLE, TRAPNUM, UNLOCKDOOR, W_ARMS, W_NONDIGGABLE, W_NONPASSWALL, WT_TOOMUCH_DIAGONAL, FOUNTAIN, G_GENOD, MON_FLOOR, MSLOW, STRAT_WAITFORU, WATER, isok, } from './const.js';
import { dryFountainAt } from './fountain.js';
import { canSeeMonster, displayLiquidName, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { splitMonster } from './monster_clone.js';
import { MONSTER_FLAGS1, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsNoncorporeal, monsterIsWhirly, monsterYoungerForm, } from './monster_data.js';
import { changeMonsterForm, decideMonsterShapeChange } from './monster_polymorph.js';
import { monsterName } from './monster_name.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { monsterHasFireResistance } from './monster_resistance.js';
import { AXE, BATTLE_AXE, BOULDER, CLOVE_OF_GARLIC, DWARVISH_MATTOCK, EGG, PICK_AXE, } from './object_data.js';
import { OBJECT_TIMER_KIND, objectsInTimerGraph, stopObjectTimer, } from './object_timers.js';
import { d, rn2, rnd } from './rng.js';
import { DISCARDED_CALL_LOG } from './monster_action_types.js';
import { dealWithMonsterOvercrowding, randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { fireDamageChain } from './fire_damage.js';
import { monsterTrapIsHarmless, trapAt, waterDamageChain } from './trap.js';
import { cansee } from './vision.js';
import { AD_COLD, AD_ELEC, AD_FIRE, AT_NONE } from './monster_attack_types.js';
import { adjustMonsterSpeed, mcalcmove, monsterSpeedMessage } from './monster_speed.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { currentAttribute } from './attrib.js';
import { heroHasConflict } from './hero_conflict.js';
import { isZombieMaker, zombieForm } from './corpse_species.js';
import { insideWizardTower, sameDungeonLevel } from './dungeon.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { monsterCorrodesBars, monsterMovementBaseFlags } from './monster_movement_traits.js';
import { wormCrossesBetween } from './monster_worm.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterDisplacementFlags } from './monster_displacement.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { heroIsDisplaced } from './armor.js';
import { monsterCanFog, requirePerceivedHero } from './monster_perception.js';
import { GAS_OK, monsterGasTolerance, visibleRegionAt } from './regions.js';
import { currentMonsterLoad } from './monster_carry.js';
import { pointsOnline } from './hacklib.js';
import { monsterKnowsTrap } from './trap_knowledge.js';
import { hasTrack } from './track.js';
import { inHeroSanctuary } from './priest.js';
import { roomsAt } from './room.js';
import { impossible } from './diagnostics.js';
import { wereChange } from './were.js';
import { badRockForMonster } from './hack.js';
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_CLING = 0x00000010;
const M1_NEEDPICK = 0x00000040;
const M1_MINDLESS = 0x00010000;
const M1_SLITHY = 0x00080000;
const M1_SEE_INVIS = 0x01000000;
const M1_REGEN = 0x00800000;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const M1_TPORT = 0x02000000;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;
const PM_BABY_PURPLE_WORM = 113;
const PM_PURPLE_WORM = 115;
const PM_SHRIEKER = 163;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const S_EEL = 57;
// C mhitm.c:paralyze_monst(). Paralysis also interrupts eating and waiting.
export function paralyzeMonster(monster, turns) {
    monster.mcanmove = 0;
    monster.mfrozen = Math.min(127, turns);
    monster.meating = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
}
// C healmon(). Overhealing can increase the monster's maximum health.
export function healMonster(monster, amount, overheal = 0) {
    const before = monster.mhp;
    monster.mhp = Math.min(monster.mhp + amount, monster.mhpmax + overheal);
    monster.mhpmax = Math.max(monster.mhpmax, monster.mhp);
    return monster.mhp - before;
}
export async function applyMonsterGolemEffects(monster, damageType, damage, { state = game, publish = plineWithContinuation, } = {}) {
    const species = MONSTER_NAME[monster.mnum];
    let healing = 0;
    let slow = false;
    if (species === 'flesh golem') {
        if (damageType === AD_ELEC)
            healing = Math.trunc((damage + 5) / 6);
        else
            slow = damageType === AD_FIRE || damageType === AD_COLD;
    }
    else if (species === 'iron golem') {
        slow = damageType === AD_ELEC;
        if (damageType === AD_FIRE)
            healing = damage;
    }
    else
        return;
    if (slow && monster.mspeed !== MSLOW) {
        const change = adjustMonsterSpeed(monster, -1);
        if (!state.in_mklev && change.changed && change.canDescribe && canSeeMonster(monster)) {
            const message = monsterSpeedMessage(change, monsterSentenceSubject(monster), state);
            if (message)
                await publish(message);
        }
    }
    if (healing && healMonster(monster, healing) && cansee(monster.mx, monster.my))
        await publish(`${monsterSentenceSubject(monster)} seems healthier.`);
}
function speciesWasGenocided(mnum, state) {
    return !!((state.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD);
}
function eggSpeciesWasGenocided(egg, state) {
    const mnum = egg?.corpsenm;
    if (mnum === undefined || !Number.isInteger(mnum) || mnum < 0)
        return true;
    return speciesWasGenocided(mnum, state)
        || speciesWasGenocided(monsterYoungerForm(mnum), state);
}
export function killGenocidedMonster(monster, state) {
    return finishEnvironmentalMonsterDeath(monster, state, { noCorpse: true });
}
// C mon.c:kill_genocided_monsters().  Genocide is not a hero kill: it drops
// carried objects, creates no corpse or experience, and sterilizes eggs.
export async function killGenocidedMonsters(state = game) {
    if (state !== game)
        throw new Error('genocide removal requires the live game state');
    const killed = [];
    const reshaped = [];
    for (const monster of [...(state.level?.monsters || [])].reverse()) {
        if (monster.dead || (monster.mhp ?? 1) <= 0)
            continue;
        const baseWasGenocided = monster.cham !== undefined && Number.isInteger(monster.cham)
            && monster.cham >= 0
            && speciesWasGenocided(monster.cham, state);
        if (!speciesWasGenocided(monster.mnum, state)
            && !baseWasGenocided)
            continue;
        if (monster.cham !== undefined && Number.isInteger(monster.cham) && monster.cham >= 0
            && !baseWasGenocided) {
            const change = await changeMonsterForm(monster, null, state, { showMessage: true });
            if (change?.heroDied)
                return { killed, reshaped, heroDied: true };
            if (change)
                reshaped.push(monster);
            continue;
        }
        const death = await killGenocidedMonster(monster, state);
        killed.push(death);
        if (death.heroDied)
            return { killed, reshaped, heroDied: true };
    }
    const sterileEggs = [];
    for (const object of objectsInTimerGraph(state)) {
        if (object.otyp !== EGG || !eggSpeciesWasGenocided(object, state))
            continue;
        stopObjectTimer(object, OBJECT_TIMER_KIND.HATCH_EGG);
        sterileEggs.push(object);
    }
    return { killed, reshaped, sterileEggs };
}
export function monsterSurvivesPool(monster, { waterWall = false } = {}) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const safeFlags = M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS
        | (waterWall ? 0 : M1_CLING);
    return !!(flags & safeFlags);
}
function heroKeepsSteedAboveLiquid(monster, state, waterWall) {
    if (waterWall || state.u?.usteed !== monster)
        return false;
    return !!(state.u?.flying || state.flying
        || state.u?.levitating || state.u?.levitation || state.levitating);
}
export function rollMonsterPoolReaction(monster, state = game, { random = rn2, rollDice = d } = {}) {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    const waterWall = location?.typ === WATER;
    const waterLevel = levelIsWaterLevel(state);
    const safelyAirborne = !waterWall && !waterLevel
        && monsterFliesOrFloats(monster);
    if (heroKeepsSteedAboveLiquid(monster, state, waterWall)
        || safelyAirborne) {
        return { kind: 'safe' };
    }
    // Breathlessness prevents drowning, but does not protect an iron body
    // from rust. C checks this reaction before the drowning predicates.
    if (monster.mnum === PM_IRON_GOLEM && random(5) === 0) {
        const damage = rollDice(2, 6);
        return {
            kind: 'rust',
            damage,
        };
    }
    if (monsterSurvivesPool(monster, { waterWall }))
        return { kind: 'safe' };
    return { kind: 'drown' };
}
function monsterLikesLava(monster) {
    return monster?.mnum === PM_FIRE_ELEMENTAL
        || monster?.mnum === PM_SALAMANDER;
}
export function monsterLavaReaction(monster, state = game) {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    if (!location || !isLavaAt(monster.mx, monster.my, state))
        return null;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const likesLava = monsterLikesLava(monster);
    if (monsterInAir(monster, state) || (flags & M1_CLING) || likesLava)
        return { kind: 'safe' };
    const fireResistant = monsterHasFireResistance(monster);
    return { kind: fireResistant ? 'scorch' : 'burn' };
}
export async function resolveMonsterLiquid(monster, state = game, { announce = async () => { }, finishDeath, monsterMoving = true, random = rn2, rollDice = d, rollOne = rnd, } = {}) {
    if (!monster)
        return null;
    const calls = [];
    const x = monster.mx;
    const y = monster.my;
    const location = state.level?.at?.(x, y);
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0 || !location)
        return null;
    if (typeof finishDeath !== 'function') {
        throw new TypeError('minliquid requires the monster death handler');
    }
    const sadFeeling = !!monster.mtame && !canSeeMonster(monster);
    const finishFatalLiquid = async (cause, leaveCorpse) => {
        // mondead()/xkilled() own recovery. In particular, xkilled records
        // conduct and pet responsibility before an amulet can save the victim.
        return finishDeath(monster, { state, random, rollOne, leaveCorpse, cause, sadFeeling, publish: announce });
    };
    const waterLevel = levelIsWaterLevel(state);
    const waterWall = location.typ === WATER;
    if (heroKeepsSteedAboveLiquid(monster, state, waterWall))
        return { survived: true };
    const inPool = isPoolAt(x, y, state)
        && (!monsterFliesOrFloats(monster) || waterLevel);
    const inLava = isLavaAt(x, y, state) && !monsterFliesOrFloats(monster);
    const inFountain = location.typ === FOUNTAIN;
    if (monster.mnum === PM_GREMLIN && (inPool || inFountain)
        && random(3) !== 0) {
        const clone = await splitMonster(monster, state, {
            monsterMoving,
            random,
            publish: announce,
        });
        let fountainDried = false;
        if (clone && inFountain) {
            fountainDried = await dryFountainAt(x, y, {
                causedByHero: false, random, state, publish: announce,
            });
        }
        if (inPool) {
            await waterDamageChain(monster.minvent || monster.inventory || [], [], state, { publish: announce });
        }
        return { kind: 'split', survived: true, clone, fountainDried };
    }
    if (inPool || waterWall) {
        const reaction = rollMonsterPoolReaction(monster, state, {
            random, rollDice,
        });
        if (reaction.kind === 'rust') {
            if (state === game && cansee(x, y))
                await announce(`${monsterName(monster, { state, capitalized: true })} rusts.`);
            monster.mhp = (monster.mhp ?? 1) - reaction.damage;
            if (monster.mhpmax > reaction.damage)
                monster.mhpmax -= reaction.damage;
            if (monster.mhp <= 0) {
                const death = await finishFatalLiquid('rust', true);
                if (state.program_state.gameover || monster.dead || monster.mhp <= 0)
                    return death;
            }
            await waterDamageChain(monster.minvent || monster.inventory || [], [], state, { publish: announce });
        }
        else if (reaction.kind === 'drown') {
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if ((flags & M1_TPORT)
                // tele_restrict() reports the blocked escape.
                && !await reportMonsterTeleportRestriction(monster, { state, publish: announce })) {
                const relocation = await randomMonsterRelocation(monster, {
                    state, calls, random, rollOne, flags: RLOC_MSG,
                });
                if (relocation)
                    return { survived: true, relocation };
            }
            if (state === game && cansee(x, y))
                await announce(monsterMoving
                    ? `${monsterName(monster, { state, capitalized: true })} drowns.`
                    : `You drown ${monsterName(monster, { state })}.`);
            if (state.u.uswallow && state.u.ustuck === monster) {
                const name = monsterName(monster, { state, capitalized: true });
                await announce(`${name} sinks as ${displayLiquidName('water', state)} rushes in and flushes you out.`);
            }
            monster.mhp = 0;
            const death = await finishFatalLiquid('drowning', true);
            if (state.program_state.gameover || monster.dead || monster.mhp <= 0)
                return death;
            if (monsterInAir(monster, state))
                return { survived: true };
            await waterDamageChain(monster.minvent || monster.inventory || [], [], state, { publish: announce });
            const relocation = await randomMonsterRelocation(monster, {
                state, calls, random, rollOne, flags: RLOC_NOMSG,
            });
            // C rloc() repaints both squares; minliquid() adds no redraw.
            if (!relocation)
                await dealWithMonsterOvercrowding(monster, state);
            if (state.program_state.gameover)
                return { heroDied: true };
            return { survived: true, relocation };
        }
    }
    else {
        const lava = monsterLavaReaction(monster, state);
        if (lava && lava.kind !== 'safe') {
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if ((flags & M1_TPORT)
                // tele_restrict() reports the blocked escape.
                && !await reportMonsterTeleportRestriction(monster, { state, publish: announce })) {
                const relocation = await randomMonsterRelocation(monster, {
                    state, calls, random, rollOne, flags: RLOC_MSG,
                });
                if (relocation)
                    return { survived: true, relocation };
            }
            if (lava.kind === 'scorch') {
                monster.mhp = (monster.mhp ?? 1) - 1;
                if (state === game && cansee(x, y)) {
                    const verb = monster.mhp <= 0
                        ? 'surrenders to the fire' : 'burns slightly';
                    await announce(`${monsterName(monster, { state, capitalized: true })} ${verb}.`);
                }
            }
            else {
                monster.mhp = 0;
                if (state === game && cansee(x, y)) {
                    const heat = monsterFireDescription(monster, AT_NONE);
                    const verb = heat === 'boiling' ? 'boils away'
                        : heat === 'melting' ? 'melts away' : 'burns to a crisp';
                    await announce(`${monsterName(monster, { state, capitalized: true })} ${verb}.`);
                }
            }
            if (monster.mhp <= 0) {
                const death = await finishFatalLiquid(lava.kind === 'scorch'
                    ? 'lava-scorch' : 'lava-burning', false);
                if (state.program_state.gameover || monster.dead || monster.mhp <= 0)
                    return death;
            }
            if (monsterInAir(monster, state) || monsterLikesLava(monster))
                return { survived: true };
            await fireDamageChain(monster.minvent || monster.inventory || [], {
                carrier: monster,
                publish: announce,
                random,
                state,
            });
            const relocation = await randomMonsterRelocation(monster, {
                state, calls, random, rollOne, flags: RLOC_MSG,
            });
            // C rloc() repaints both squares; minliquid() adds no redraw.
            if (!relocation)
                await dealWithMonsterOvercrowding(monster, state);
            if (state.program_state.gameover)
                return { heroDied: true };
            return { survived: true, relocation };
        }
    }
    if (!inPool && !inLava && MONSTER_SYMBOL[monster.mnum] === S_EEL && !waterLevel
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_BREATHLESS)) {
        if (monster.mhp > 1 && random(monster.mhp) > random(8))
            monster.mhp--;
        const flight = await makeMonsterFlee(monster, {
            state, turns: 2, announce: false, publish: announce, random, rollOne,
        });
        if (flight.heroDied)
            return { heroDied: true };
    }
    return null;
}
const UNDEAD_CORPSE_TYPES = new Map([
    [239, 59], [187, 59], // kobold zombie/mummy -> kobold
    [242, 44], [190, 44], // dwarf zombie/mummy -> dwarf
    [240, 165], [188, 165], // gnome zombie/mummy -> gnome
    [241, 72], [189, 72], // orc zombie/mummy -> orc
    [243, 264], [191, 264], // elf zombie/mummy -> elf
    [226, 260], [227, 260], [244, 260], [192, 260],
    [247, 169], [194, 169], // giant zombie/mummy -> giant
    [245, 174], [193, 174], // ettin zombie/mummy -> ettin
]);
// C mon.c:undead_to_corpse().
export function undeadToCorpse(mndx) {
    return UNDEAD_CORPSE_TYPES.get(mndx) ?? mndx;
}
// ---------------------------------------------------------------------------
// C mon.c:movemon()/mcalcdistress()/mon_allowflags()/mfndpos() and the
// mon.c parts of monster scheduling those functions share.
// ---------------------------------------------------------------------------
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
// JS stores monsters in creation order by appending to level.monsters.
// C's makemon() prepends to fmon, so all scheduler traversals are reversed.
export function monstersInFmonOrder(monsters = []) {
    return Array.from(monsters).reverse();
}
// C mon.c:movemon() schedules a monster when it is alive, on the map, and
// not held in a non-floor state. x=0 is NetHack's off-map sentinel; y=0 is
// the valid north row.
export function schedulable(monster) {
    return (monster &&
        (monster.mhp ?? 1) > 0 &&
        (monster.mstate ?? MON_FLOOR) === MON_FLOOR &&
        monster.mx !== 0);
}
// C ref: mon.c mcalcdistress()/m_calcdistress(). JS appends monsters while C
// prepends them to fmon, so this once-per-global-turn phase traverses the
// reverse of creation order just like movement allocation does. Yielding at
// each transformation lets its messages and consequences finish before the
// next source-ordered random decision.
export async function* monsterDistressEvents(monsters = [], state = requireInitializedGame(), random = rn2, distressTurn = state.moves ?? 1, publish = plineWithContinuation) {
    for (const monster of monstersInFmonOrder(monsters)) {
        if (!schedulable(monster))
            continue;
        if ((MONSTER_MOVE[monster.mnum] ?? 0) === 0) {
            yield { kind: 'stationary-liquid', monster };
            if (monster.dead || (monster.mhp ?? 1) <= 0)
                continue;
        }
        if ((distressTurn % 20 === 0 || (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_REGEN) &&
            isFiniteNumber(monster.mhp) &&
            isFiniteNumber(monster.mhpmax)) {
            monster.mhp = Math.min(monster.mhpmax, monster.mhp + 1);
        }
        if (monster.mspec_used !== undefined && monster.mspec_used > 0)
            monster.mspec_used--;
        const changedShape = await decideMonsterShapeChange(monster, state, random, { publish });
        if (changedShape) {
            yield {
                kind: 'shape-change',
                monster,
                change: changedShape,
            };
            if (changedShape.heroDied)
                return;
        }
        const changedWere = await wereChange(monster, state, random, { publish });
        if (changedWere) {
            yield {
                kind: 'were-change',
                monster,
                change: changedWere,
            };
        }
        if (monster.mblinded !== undefined && monster.mblinded > 0 && --monster.mblinded === 0)
            monster.mcansee = 1;
        if (monster.mfrozen !== undefined && monster.mfrozen > 0 && --monster.mfrozen === 0)
            monster.mcanmove = 1;
        if (monster.mfleetim !== undefined && monster.mfleetim > 0 && --monster.mfleetim === 0)
            monster.mflee = 0;
    }
}
// C mon.c:movemon() movement allocation: every schedulable monster earns
// this turn's movement points before any of them acts.
export function allocateMonsterMovement(monsters = [], random = rn2, state = requireInitializedGame()) {
    for (const monster of monstersInFmonOrder(monsters)) {
        const amount = mcalcmove(monster, true, random, state);
        monster.movement = (monster.movement ?? 0) + amount;
    }
}
function speciesIsUnique(mnum) {
    return !!((MONSTER_GENO[mnum] ?? 0) & 0x1000);
}
// C mon.c:mm_2way_aggression().
function zombiePairIsAggressive(attacker, defender, state) {
    const heroInTower = insideWizardTower(state.u.ux, state.u.uy, state);
    if (insideWizardTower(attacker.mx, attacker.my, state) !== heroInTower ||
        insideWizardTower(defender.mx, defender.my, state) !== heroInTower)
        return false;
    if (!isZombieMaker(attacker.mnum, !!attacker.mcan) || zombieForm(defender?.mnum) == null)
        return false;
    if (attacker.mgenmklev && defender.mgenmklev)
        return false;
    if (sameDungeonLevel(state?.stronghold_level, state?.u?.uz))
        return false;
    return !speciesIsUnique(attacker.mnum) && !speciesIsUnique(defender.mnum);
}
// C mon.c:mm_aggression().
function monsterAggressionFlags(attacker, defender, state) {
    if (attacker.mtame && defender.mtame)
        return 0;
    if ([PM_BABY_PURPLE_WORM, PM_PURPLE_WORM].includes(attacker.mnum) &&
        defender.mnum === PM_SHRIEKER)
        return ALLOW_M | ALLOW_TM;
    return zombiePairIsAggressive(attacker, defender, state) ||
        zombiePairIsAggressive(defender, attacker, state)
        ? ALLOW_M | ALLOW_TM
        : 0;
}
// C mondata.c:resist_conflict(). High-charisma heroes convince monsters
// bound by the ring of conflict's charm more easily; there is always a
// small chance at 19.
export function resistConflict(monster, state, rollOne, calls) {
    const charisma = currentAttribute(A_CHA, state);
    const monsterLevel = monster?.m_lev ?? MONSTER_LEVEL[monster?.mnum] ?? 0;
    const heroLevel = state?.u?.ulevel ?? 1;
    const resistChance = Math.min(19, charisma - monsterLevel + heroLevel);
    const roll = rollOne(20);
    calls.push('rnd(20)');
    return roll > resistChance;
}
// C mon.c:mon_allowflags().
export function monAllowFlags(monster, state, rollOne = rnd, calls = DISCARDED_CALL_LOG) {
    const flags = monsterMovementBaseFlags(monster, state);
    return heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls)
        ? flags | ALLOW_U : flags;
}
function monsterDigCapabilities(monster, flags) {
    let rockOk = false;
    let treeOk = false;
    if (!(flags & ALLOW_DIG))
        return { rockOk, treeOk };
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (!(speciesFlags & M1_NEEDPICK))
        return { rockOk: true, treeOk: true };
    const inventory = monster?.minvent || monster?.inventory || [];
    const wielded = monsterWieldedWeapon(monster);
    if (wielded?.cursed && (monster?.weaponCheck ?? NO_WEAPON_WANTED) === NO_WEAPON_WANTED) {
        return {
            rockOk: [PICK_AXE, DWARVISH_MATTOCK].includes(wielded.otyp),
            treeOk: [AXE, BATTLE_AXE].includes(wielded.otyp),
        };
    }
    const hasShield = inventory.some((object) => ((object?.owornmask ?? 0) & W_ARMS) !== 0);
    rockOk = inventory.some((object) => object?.otyp === PICK_AXE || (object?.otyp === DWARVISH_MATTOCK && !hasShield));
    treeOk = inventory.some((object) => object?.otyp === AXE || (object?.otyp === BATTLE_AXE && !hasShield));
    return { rockOk, treeOk };
}
export function monsterMayDigLocation(loc) {
    if (!loc)
        return false;
    return !((IS_STWALL(loc.typ) || IS_TREE(loc.typ)) && (loc.wall_info ?? 0) & W_NONDIGGABLE);
}
function monsterCannotSqueezeThrough(monster, state) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (flags & M1_WALLWALK)
        return false;
    const flexible = !!(flags & (M1_AMORPHOUS | M1_SLITHY)) ||
        monsterIsWhirly(monster) ||
        monsterIsNoncorporeal(monster) ||
        monsterCanFog(monster, state);
    if ((MONSTER_SIZE[monster?.mnum] ?? 0) >= 3 && !flexible)
        return true;
    return currentMonsterLoad(monster) > WT_TOOMUCH_DIAGONAL;
}
// C mon.c:mfndpos(). Scan x first, then y; finding the real hero updates
// perception before later squares are classified against the apparent hero.
export async function mfndpos(monster, state, flags = monAllowFlags(monster, state)) {
    requirePerceivedHero(monster);
    const positions = [];
    const x = monster.mx, y = monster.my;
    const now = state.level.at(x, y);
    if (!now)
        throw new RangeError('Monster movement started outside the level');
    const speciesFlags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const levelFlags = state.level.flags;
    const waterLevel = sameDungeonLevel(state.u.uz, state.water_level);
    const rogueLevel = sameDungeonLevel(state.u.uz, state.rogue_level);
    const inAir = monsterInAir(monster, state);
    let wantPool = symbol === S_EEL;
    const poolOk = (!waterLevel && inAir) || (!!(speciesFlags & M1_SWIM) && !wantPool);
    const lavaOk = monster.mnum !== PM_FLOATING_EYE &&
        (inAir || monster.mnum === PM_FIRE_ELEMENTAL || monster.mnum === PM_SALAMANDER);
    const { rockOk, treeOk } = monsterDigCapabilities(monster, flags);
    const throughDoor = !!(flags & (ALLOW_WALL | BUSTDOOR)) || rockOk || treeOk;
    const poisonGasOk = monsterGasTolerance(monster, state) === GAS_OK;
    const currentRegion = visibleRegionAt(state, x, y);
    const inPoisonGas = currentRegion?.kind === 'gas-cloud' && !!currentRegion.damage;
    if (monster.mconf)
        flags = (flags | ALLOW_ALL) & ~NOTONL;
    if (!monster.mcansee)
        flags |= ALLOW_SSM;
    for (;;) {
        positions.length = 0;
        for (let nx = Math.max(1, x - 1); nx <= Math.min(COLNO - 1, x + 1); nx++) {
            for (let ny = Math.max(0, y - 1); ny <= Math.min(ROWNO - 1, y + 1); ny++) {
                if (nx === x && ny === y)
                    continue;
                const loc = state.level.at(nx, ny);
                if (!loc)
                    continue;
                const mayPassWall = !!(flags & ALLOW_WALL) &&
                    !(IS_STWALL(loc.typ) && loc.wall_info & W_NONPASSWALL);
                const mayTunnel = (IS_TREE(loc.typ) ? treeOk : rockOk) && monsterMayDigLocation(loc);
                if (IS_OBSTRUCTED(loc.typ) && !mayPassWall && !mayTunnel)
                    continue;
                if (IS_OBSTRUCTED(loc.typ) &&
                    rockOk &&
                    !(speciesFlags & M1_MINDLESS) &&
                    (monster.mpeaceful || monster.mtame) &&
                    (roomsAt(state.level, nx, ny, TEMPLE).length ||
                        roomsAt(state.level, nx, ny, SHOPBASE).length) &&
                    !(roomsAt(state.level, x, y, TEMPLE).length ||
                        roomsAt(state.level, x, y, SHOPBASE).length))
                    continue;
                if (loc.typ === WATER && !(speciesFlags & M1_SWIM))
                    continue;
                if (loc.typ === IRONBARS &&
                    (!(flags & ALLOW_BARS) ||
                        (loc.wall_info & W_NONDIGGABLE && monsterCorrodesBars(monster))))
                    continue;
                const engulfingHero = state.u.uswallow && state.u.ustuck === monster;
                const slipsUnderDoor = !engulfingHero &&
                    (speciesFlags & M1_AMORPHOUS || monsterCanFog(monster, state));
                if (IS_DOOR(loc.typ) &&
                    !slipsUnderDoor &&
                    ((loc.doormask & D_CLOSED && !(flags & OPENDOOR)) ||
                        (loc.doormask & D_LOCKED && !(flags & UNLOCKDOOR))) &&
                    !throughDoor)
                    continue;
                if (!poisonGasOk && !inPoisonGas) {
                    const region = visibleRegionAt(state, nx, ny);
                    if (region?.kind === 'gas-cloud' && region.damage)
                        continue;
                }
                const diagonal = nx !== x && ny !== y;
                if (diagonal &&
                    (monster.mnum === PM_GRID_BUG ||
                        (IS_DOOR(now.typ) && now.doormask & ~D_BROKEN) ||
                        (IS_DOOR(loc.typ) && loc.doormask & ~D_BROKEN) ||
                        (rogueLevel && (IS_DOOR(now.typ) || IS_DOOR(loc.typ))) ||
                        (wormCrossesBetween(x, y, nx, ny, state) &&
                            !monsterAtPosition(state.level, nx, ny) &&
                            !(nx === state.u.ux && ny === state.u.uy))))
                    continue;
                if (loc.typ === LAVAWALL && (!lavaOk || !(flags & ALLOW_WALL)))
                    continue;
                if (!(poolOk || isPoolAt(nx, ny, state) === wantPool) ||
                    !(lavaOk || !isLavaAt(nx, ny, state)))
                    continue;
                const seesHero = monster.mcansee && (!heroIsInvisible(state) || speciesFlags & M1_SEE_INVIS);
                const displacedScare = heroIsDisplaced(state) && seesHero && nx === monster.mux && ny === monster.muy;
                let info = 0;
                if (monsterIsScaredAt(monster, state, displacedScare ? state.u.ux : nx, displacedScare ? state.u.uy : ny)) {
                    if (!(flags & ALLOW_SSM))
                        continue;
                    info |= ALLOW_SSM;
                }
                const atHero = nx === state.u.ux && ny === state.u.uy;
                if (atHero || (nx === monster.mux && ny === monster.muy)) {
                    if (atHero) {
                        monster.mux = state.u.ux;
                        monster.muy = state.u.uy;
                    }
                    if (!(flags & ALLOW_U))
                        continue;
                    info |= ALLOW_U;
                }
                else {
                    const occupant = monsterAtPosition(state.level, nx, ny);
                    if (occupant) {
                        const attackFlags = flags | monsterAggressionFlags(monster, occupant, state);
                        if (attackFlags & ALLOW_M) {
                            info |= ALLOW_M;
                            if (occupant.mtame) {
                                if (!(attackFlags & ALLOW_TM))
                                    continue;
                                info |= ALLOW_TM;
                            }
                        }
                        else {
                            flags &= ~ALLOW_MDISP;
                            if (!(monsterDisplacementFlags(monster, occupant) & ALLOW_MDISP))
                                continue;
                            info |= ALLOW_MDISP;
                        }
                    }
                    if (levelFlags.has_temple &&
                        roomsAt(state.level, nx, ny, TEMPLE).length &&
                        !roomsAt(state.level, x, y, TEMPLE).length &&
                        inHeroSanctuary(null, nx, ny, state)) {
                        if (!(flags & ALLOW_SANCT))
                            continue;
                        info |= ALLOW_SANCT;
                    }
                }
                const pile = state.level.objects[nx]?.[ny] || [];
                if (pile.some((object) => object.otyp === CLOVE_OF_GARLIC)) {
                    if (flags & NOGARLIC)
                        continue;
                    info |= NOGARLIC;
                }
                if (pile.some((object) => object.otyp === BOULDER)) {
                    if (!(flags & ALLOW_ROCK))
                        continue;
                    info |= ALLOW_ROCK;
                }
                if (seesHero && pointsOnline(nx, ny, monster.mux, monster.muy)) {
                    if (flags & NOTONL)
                        continue;
                    info |= NOTONL;
                }
                if (diagonal &&
                    badRockForMonster(monster, state, x, ny) &&
                    badRockForMonster(monster, state, nx, y) &&
                    monsterCannotSqueezeThrough(monster, state))
                    continue;
                const trap = trapAt(state, nx, ny);
                if (trap) {
                    if (trap.ttyp <= 0 || trap.ttyp >= TRAPNUM) {
                        await impossible(`A monster looked at a very strange trap of type ${trap.ttyp}.`, { state });
                        continue;
                    }
                    if (trap.ttyp === TELEP_TRAP &&
                        trap.teledest &&
                        isok(trap.teledest.x, trap.teledest.y) &&
                        hasTrack(nx, ny, state)) {
                        info |= ALLOW_TRAPS;
                    }
                    else if (!monsterTrapIsHarmless(monster, trap, state)) {
                        if (!(flags & ALLOW_TRAPS) && monsterKnowsTrap(monster, trap))
                            continue;
                        info |= ALLOW_TRAPS;
                    }
                }
                positions.push({ x: nx, y: ny, info });
            }
        }
        if (positions.length || !wantPool || isPoolAt(x, y, state))
            break;
        wantPool = false;
    }
    return positions;
}
//# sourceMappingURL=mon.js.map