import { formatFeltMessage, formatSeenMessage, publishHeardMessage } from './hero_speech.js';
import { objectMaterial } from './object_material.js';
import { heroLocomotion } from './hero_locomotion.js';
import { isLavaAt } from './terrain_properties.js';
import { surfaceName } from './terrain_name.js';
// Trap effects on the hero.
// C refs: trap.c dotrap(), trapeffect_*(), launch_obj(), and teleport.c
// tele_trap().

import { heroIsHallucinating } from './senses.js';
import { triggerHeroMagicTrapEffect } from './hero_magic_trap.js';
import { launchRollingBoulder } from './rolling_boulder.js';
import { deleteTrap } from './trap_lifecycle.js';
import { maybeDestroyWeb } from './web_trap.js';
import {
    currentAttribute, exerciseAttribute,
} from './attrib.js';
import { armorSimpleName, objectIsHardHelmet } from './armor.js';
import { heroArmName, heroFootName, heroHeadName, heroLegName, monsterFootName } from './body_parts.js';
import {
    A_CON, A_DEX, A_STR, ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP,
    FIRE_TRAP, DISMOUNT_POLY, In_endgame, In_quest, is_pit,
    HOLE, M_SEEN_SLEEP,
    LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, PIT, POLY_TRAP, ROCKTRAP,
    ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP,
    SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TRAPDOOR,
    TELEP_TRAP, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT,
    TT_WEB, VAULT, VIBRATING_SQUARE, WEB, isok, Is_stronghold,
    squeakyBoardNoteWithArticle,
} from './const.js';
import {
    displayLiquidName, flush_screen, lastDirtyMapCursor, newsym, pline,
    plineWithContinuation, shieldeff, show_glyph_cell,
} from './display.js';
import { game, requirePlayingGame, requireGameLevel } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Trap, Position } from './map_types.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { DisplayGlyph } from './display.js';
import type { HeroHurtleOptions } from './hero_hurtle.js';
import { buriedBallNear, buriedBallToPunishment } from './buried_object.js';
import { loseHeroHp } from './hero_damage.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { makeConfused } from './hero_mental_status.js';
import { refreshMovementProperties, setPropertyTimeout } from './properties.js';
import { levelTeleport } from './level_teleport.js';
import { gotoLevel as changeLevel, scheduleLevelChange } from './level_change.js';
import { heroLiquidEffects } from './hack.js';
import { dungeonDepth } from './hacklib.js';
import { clampHoleDestination } from './hole_destination.js';
import { shopDig } from './shop_damage.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { explodeLandMine } from './landmine_explosion.js';
import {
    placeCreatedObject, placeObject, placeObjectSynchronously, remove_object,
    stack_object,
} from './floor_object.js';
import {
    canFallThrough, splitHeroMonsterForm,
} from './mklev.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { searchSpecial, somexyspace } from './mkroom.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterTypeName,
    monsterIsAmorphous, monsterIsUnsolid, monsterIsWhirly,
} from './monster_data.js';
import {
    ARROW, BOULDER, DART, HEAVY_IRON_BALL, OBJECT_BIMANUAL,
    CORPSE, OBJECT_NAMES, ROCK, SADDLE,
} from './object_data.js';
import { deleteObject } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { impactDrop } from './object_migration.js';
import { heroPassesWalls } from './hero_species.js';
import { d, rn2, rnd } from './rng.js';
import { artifactById } from './artifacts.js';
import {
    fallWithIronBall, heroIsPunished,
    placeBallAndChain, unplaceBallAndChain,
} from './ball.js';
import { pitsAreConjoined } from './pit_connections.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import { hitSteedWithTrapMissile } from './projectile_trap.js';
import { dismountHero } from './steed.js';
import { holdingMonsterName, holdingMonsterSubject } from './hero_expulsion.js';
import { finishMonsterTrapDeath } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import type { MonsterDeathOptions } from './monster_death.js';
import { specialPrototypeAt } from './dungeon.js';
import { setTrack } from './track.js';
import {
    bringLeashedFollowers, clearFixedTeleportDestination, heroControlsTeleport, heroTeleportDestinationOk,
    heroTeleportTrapBlock, moveHeroByTeleport, teleportHero,
} from './teleport.js';
import { CLR_GREEN } from './terminal.js';
import { cansee } from './vision.js';
import { triggerHeroFireTrap } from './fire_trap.js';
import { activateMagicPortal } from './magic_portal.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { poisonHero } from './poison.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { makeTrapMissile } from './trap_missile.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { stopHeroOccupation } from './occupation.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { ceilingName } from './terrain_name.js';
import { putHeroToSleep } from './hero_sleep.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
} from './monster_perception.js';
import {
    monsterIsBreathless, monsterIsHelpless, monsterResistsSleep,
    putMonsterToSleep,
} from './monster_sleep.js';
import { feelTrap, seeTrap, splashLitObject, waterDamageObject } from './trap.js';
import { heroIsPolymorphed, returnHeroToHumanForm } from './polyself.js';
import { finishHeroDeath } from './end.js';
import { triggerHeroAntiMagicTrap } from './anti_magic_trap.js';
import { woundHeroLegs } from './hero_legs.js';
import { monsterLearnsTrap, monstersSeeTrap } from './trap_knowledge.js';
import { trapName } from './trap_name.js';
import { resetHeroTrap } from './terrain_movement.js';
import { monsterName } from './monster_name.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { objectName, observeObjectForNaming, killerObjectName, ownedObjectName, simpleObjectNameWithArticle } from './objnam.js';
import { finishImmediateMonsterTrap, trapTriggeredByFloor, triggerImmediateMonsterTrap } from './monmove.js';
import { askTeleportDestination } from './cmd.js';
import { observeObject } from './object_knowledge.js';
import { triggerHeroPolymorphTrap } from './hero_polymorph_trap.js';

export interface HeroTrapOptions extends Pick<HeroHurtleOptions, 'finishTeleport' | 'gotoLevel'> {
    viaSitting?: boolean;
    failedUntrap?: boolean;
    forceTrap?: boolean;
    forceBungle?: boolean;
    noWebMessage?: boolean;
    tookPlunge?: boolean;
    recursiveTrap?: boolean;
}

export interface HeroTrapResult {
    died: boolean;
    shortCircuited: boolean;
}

export interface HoleFall {
    destination: DungeonLocation;
    arrival: 'random' | 'falling';
}

const M1_CLING = 0x00000010;
const M1_HIDE = 0x00000100;
const S_MIMIC = 13;
const M1_WALLWALK = 0x00000008;
const M1_BREATHLESS = 0x00000400;
const M1_UNSOLID = 0x00100000;
const PM_CAVE_SPIDER = 94;
const PM_GIANT_SPIDER = 96;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const PM_PIT_FIEND = 300;
const IRON = 11;
const MZ_HUGE = 4;
const M2_STRONG = 0x04000000;

function heroMonsterForm(): number {
    requirePlayingGame(game);
    return game.u.umonnum;
}

function heroFormFlags() {
    return MONSTER_FLAGS1[heroMonsterForm()] ?? 0;
}

function physicalDamage(amount: number) {
    if (game.u?.halfPhysicalDamage)
        amount = Math.trunc((amount + 1) / 2);
    return amount;
}

type TrapEquipmentSlot = 'uarm' | 'uarmc' | 'uarmf' | 'uarmg' | 'uarmh'
    | 'uarms' | 'uarmu' | 'uwep' | 'uswapwep';

function heroObject(slot: TrapEquipmentSlot): GameObject | null {
    return game[slot] || game.u?.[slot] || null;
}

function heroIronShoes() {
    const boots = heroObject('uarmf');
    return boots && objectMaterial(boots.otyp) === IRON ? boots : null;
}

function heroWearsIronShoes() {
    return !!heroIronShoes();
}

async function triggerPit(
    trap: Trap,
    { viaSitting = false, tookPlunge = false, recursiveTrap = false } = {},
) {
    requirePlayingGame(game);
    const hero = game.u;
    const formFlags = heroFormFlags();
    const sokoban = !!game.level.flags?.sokoban_rules;
    const previousPit = game.level.traps.find(candidate =>
        candidate.tx === hero.ux0 && candidate.ty === hero.uy0);
    const fromPit = !!hero.utrap && hero.utraptype === TT_PIT
        && previousPit && is_pit(previousPit.ttyp);
    const conjoined = fromPit && pitsAreConjoined(previousPit, trap);
    const adjacent = fromPit && (hero.dx || hero.dy);
    const alreadyKnown = !!trap.tseen;
    const flying = hero.flying || game.flying;
    // C trap.c:1836: plunged is TOOKPLUNGE only.  FAILEDUNTRAP never
    // reaches a pit: untrap() refuses pit targets before try_disarm().
    const plunged = tookPlunge;
    if (!sokoban && (hero.levitating || game.levitating
        || (flying && !plunged && !viaSitting))) return;
    feelTrap(trap);
    if (!sokoban && (formFlags & M1_CLING) && !plunged) {
        if (alreadyKnown) {
            await plineWithContinuation(
                formatSeenMessage(`${trap.madeby_u ? 'your' : 'a'} ${trap.ttyp === SPIKED_PIT ? 'spiked ' : ''}pit below you.`));
        } else {
            await plineWithContinuation(
                `${trap.madeby_u ? 'Your' : 'A'} pit ${trap.ttyp === SPIKED_PIT ? 'full of spikes ' : ''}opens up under you!`);
            await plineWithContinuation("You don't fall in!");
        }
        return;
    }
    const steed = hero.usteed;
    const steedName = steed ? holdingMonsterName(steed) : '';
    const deliberate = !sokoban && !steed && game.context.nopick && alreadyKnown;
    if (!sokoban) {
        if (steed) {
            await plineWithContinuation(recursiveTrap
                ? `You and ${steedName} fall into ${trap.madeby_u ? 'your' : 'a'} pit!`
                : `You lead ${steedName.replace(/^the /, 'the poor ')} into ${trap.madeby_u ? 'your' : 'a'} pit!`);
        } else if (deliberate) {
            await plineWithContinuation(`You carefully ${heroLocomotion('lower yourself')} into the pit.`);
        } else if (conjoined) {
            await plineWithContinuation('You move into an adjacent pit.');
        } else if (adjacent) {
            await plineWithContinuation(
                `You stumble over debris${rn2(5) === 0 ? ' between the pits' : ''}.`);
        } else {
            await plineWithContinuation(
                `You ${plunged ? (flying ? 'dive' : 'plunge') : 'fall'} into ${trap.madeby_u ? 'your' : 'a'} pit!`);
        }
    }
    const role = String(game.urole?.key || game.urole?.name || '').toLowerCase();
    if (role === 'ranger' && !trap.madeby_u && !trap.once && In_quest(hero.uz)
        && specialPrototypeAt(hero.uz.dnum, hero.uz.dlevel)?.endsWith('-loca')) {
        await plineWithContinuation('Fortunately it has a bottom after all...');
        trap.once = 1;
    } else if (heroMonsterForm() === 218 || heroMonsterForm() === PM_PIT_FIEND) {
        await plineWithContinuation("How pitiful.  Isn't that the pits?");
    }
    let spiked = trap.ttyp === SPIKED_PIT;
    if (spiked && heroWearsIronShoes()) {
        await plineWithContinuation('Your boots protect you from the sharp iron spikes.');
        spiked = false;
    } else if (spiked) {
        await plineWithContinuation(steed
            ? `${holdingMonsterSubject(steed).replace(/^The /, 'The poor ')} ${conjoined ? 'steps' : 'lands'} on a set of sharp iron spikes!`
            : `You ${conjoined ? 'step' : 'land'} on a set of sharp iron spikes!`);
    }
    setHeroTrap(rn2(6) + 2, TT_PIT);
    game.context.botl = true;
    if (steed) {
        // C steedintrap(): a ridden steed takes the pit's hit instead of the hero.
        steed.mx = hero.ux;
        steed.my = hero.uy;
        if (steed.mhp > 0) steed.mhp -= rnd(trap.ttyp === PIT ? 6 : 10);
        if (steed.mhp <= 0) {
            // m_detach() dismounts; steedintrap()'s dismount_steed() then
            // finds no steed.
            await finishMonsterTrapDeath(steed, game, { damageType: AD_PHYS });
        }
        return;
    }
    const mortality = hero.umortality || 0;
    if (spiked) {
        const damage = physicalDamage(rnd(conjoined ? 4 : adjacent ? 6 : 10));
        const killer = plunged ? 'deliberately plunged into a pit of iron spikes'
            : conjoined || deliberate ? 'stepped into a pit of iron spikes'
                : adjacent ? 'stumbled into a pit of iron spikes'
                    : 'fell into a pit of iron spikes';
        if (await loseHeroHp(damage, killer, { deathCause: killer })) return;
        if (rn2(6) === 0) {
            const poison = await poisonHero({
                reason: 'spikes',
                killer: conjoined || adjacent || deliberate
                    ? 'stepping on poison spikes' : 'fall onto poison spikes',
                attribute: A_STR,
                fatal: (hero.umortality || 0) > mortality ? 0 : 8,
            });
            if (poison.died) return;
        }
    } else if (!conjoined && !deliberate && !(plunged && (flying || (formFlags & M1_CLING)))) {
        const killer = plunged ? 'deliberately plunged into a pit' : 'fell into a pit';
        if (await loseHeroHp(physicalDamage(rnd(adjacent ? 3 : 6)), killer,
            { deathCause: killer })) return;
    }
    const ball = game.uball || hero.uball;
    if (heroIsPunished(game) && ball && !game.inventory.includes(ball)) {
        await unplaceBallAndChain(game);
        if (await fallWithIronBall(game)) return;
        await placeBallAndChain(game);
    }
    if (!conjoined) await selfTouchPetrifyingWeapons({ messageStart: 'Falling, you' });
    game.vision_full_recalc = 1;
    await exerciseAttribute(A_STR, false);
    await exerciseAttribute(A_DEX, false);
}

function webTrapDuration(strength: number) {
    if (strength <= 3) return rn2(6) + 6;
    if (strength < 6) return rn2(6) + 4;
    if (strength < 9) return rn2(4) + 4;
    if (strength < 12) return rn2(4) + 2;
    if (strength < 15) return rn2(2) + 2;
    if (strength < 18) return rnd(2);
    if (strength < 69) return 1;
    return 0;
}

async function triggerWeb(
    trap: Trap,
    { viaSitting = false, failedUntrap = false, forceTrap = false,
        noWebMessage = false } = {},
) {
    requirePlayingGame(game);
    const hero = game.u;
    feelTrap(trap);
    const form = heroMonsterForm();
    if (await maybeDestroyWeb(hero, trap, { message: !noWebMessage })) return;
    if (form === PM_CAVE_SPIDER || form === PM_GIANT_SPIDER) {
        if (!noWebMessage) await plineWithContinuation(trap.madeby_u
            ? 'You take a walk on your web.'
            : 'There is a spider web here.');
        return;
    }
    const steed = hero.usteed;
    if (!noWebMessage) {
        const verb = viaSitting || failedUntrap || forceTrap ? 'are caught by'
            : steed ? `lead ${monsterName(steed, {
                article: steed.name && !heroIsHallucinating(game) ? 'none' : 'the',
                adjective: 'poor', suppressSaddle: true,
            })} into` : `${heroLocomotion('stumble')} into`;
        await plineWithContinuation(`You ${verb} ${trap.madeby_u ? 'your' : 'a'} spider web!`);
    }
    setHeroTrap(1, TT_WEB);
    game.context.botl = true;
    let strength = currentAttribute(A_STR, game);
    if (steed && !noWebMessage) {
        steed.mx = hero.ux;
        steed.my = hero.uy;
        const action = await triggerImmediateMonsterTrap(steed, game, { force: forceTrap });
        await finishImmediateMonsterTrap(action, game);
        if (!steed.mtrapped) {
            await resetHeroTrap(false);
            return;
        }
        steed.mtrapped = 0;
        if ((MONSTER_FLAGS2[steed.mnum] ?? 0) & M2_STRONG) strength = 17;
        noWebMessage = true;
    }
    const turns = webTrapDuration(strength);
    setHeroTrap(turns, TT_WEB);
    if (!turns) {
        if (!noWebMessage) await plineWithContinuation(`You tear through ${trap.madeby_u ? 'your' : 'a'} web!`);
        deleteTrap(trap);
        newsym(hero.ux, hero.uy);
    }
}

// C trap.c:trapeffect_landmine() guards steedintrap() with a static
// recursive_mine flag: the dying steed's dismount must not re-enter the
// still-armed mine before it is converted to a pit.
let landmineSteedHitInProgress = false;

// C trap.c:keep_saddle_with_steedcorpse(): the blast can scatter the dead
// steed's corpse away from the saddle; the captured saddle follows the
// corpse.  C walks fobj and each container's contents, but only moves the
// saddle when get_obj_location() resolves the corpse to a map square; a
// contained corpse has no location, so C leaves the saddle in place yet
// still stops searching.
export async function keepSaddleWithSteedcorpse(
    steedMid: number, saddle: GameObject,
): Promise<void> {
    if (saddle.where !== 'floor') return; // the blast may destroy the saddle
    const visit = async (objects: GameObject[] | null | undefined): Promise<boolean> => {
        for (const object of [...(objects || [])]) {
            if (object.otyp === CORPSE && object.oextra?.omonst?.m_id === steedMid) {
                if (object.where === 'floor') {
                    remove_object(saddle, game);
                    await placeObject(saddle, object.ox, object.oy, game);
                    await stack_object(saddle, game);
                }
                return true;
            }
            if (await visit(object.contents)) return true;
        }
        return false;
    };
    for (const column of game.level?.objects ?? []) {
        if (!column) continue;
        for (const pile of column) if (await visit(pile)) return;
    }
}

async function triggerLandmine(trap: Trap, {
    failedUntrap = false, forceTrap = false, forceBungle = false,
} = {}) {
    const hero = game.u;
    let damage = rnd(16);
    if (heroWearsIronShoes()) damage = Math.trunc((damage + 3) / 4);
    const forcetrap = forceTrap || failedUntrap;
    const airborne = !forcetrap && (hero.levitating || game.levitating
        || hero.flying || game.flying);
    let steedMid = 0;
    let saddle: GameObject | null = null;
    if (airborne) {
        const alreadySeen = !!trap.tseen;
        if (!alreadySeen && rn2(3) !== 0) return;
        feelTrap(trap);
        await plineWithContinuation(`${alreadySeen ? 'There is' : 'You discover'} ${
            trap.madeby_u ? 'the trigger of your mine' : 'a trigger'} in a pile of soil below you.`);
        if (alreadySeen && rn2(3) !== 0) return;
        await plineWithContinuation(`KAABLAMM!!!  ${
            forceBungle ? 'Your inept attempt sets' : 'The air currents set'} ${
            alreadySeen ? `${trap.madeby_u ? 'your' : 'a'} land mine` : 'it'} off!`);
    } else {
        if (landmineSteedHitInProgress) return;
        feelTrap(trap);
        await plineWithContinuation(
            `KAABLAMM!!!  You triggered ${trap.madeby_u ? 'your' : 'a'} land mine!`,
        );
        const steed = hero.usteed;
        if (steed) steedMid = steed.m_id;
        landmineSteedHitInProgress = true;
        try {
            if (steed) {
                // C steedintrap() LANDMINE: thitm(0, steed, NULL, rnd(16), FALSE).
                // m_detach() dismounts a dying steed; steedintrap()'s own
                // dismount_steed() then finds no steed.
                steed.mx = hero.ux;
                steed.my = hero.uy;
                if (steed.mhp > 0) steed.mhp -= rnd(16);
                if (steed.mhp <= 0) {
                    await finishMonsterTrapDeath(steed, game, { damageType: AD_PHYS });
                }
            }
        } finally {
            landmineSteedHitInProgress = false;
        }
        if (game.program_state.gameover) return;
        saddle = objectAtHero(SADDLE);
        await woundHeroLegs('left', rn2(35) + 41);
        await woundHeroLegs('right', rn2(35) + 41);
        await exerciseAttribute(A_DEX, false);
    }
    trap.ttyp = PIT;
    trap.madeby_u = false;
    if (await loseHeroHp(physicalDamage(damage), 'land mine')) return;
    const finishMonsterDeath = async (monster: Monster, death: MonsterDeathOptions = {}) => {
        const killed = await finishHeroMonsterKill(
            monster, monster.mx, monster.my, {
                showKillMessage: false,
                noCorpse: death.noCorpse ?? false,
            },
        );
        return { monster, survived: !killed };
    };
    await explodeLandMine(trap, game, {
        publish: plineWithContinuation,
        random: rn2,
        rollOne: rnd,
        seeSquare: cansee(hero.ux, hero.uy),
        heroCaused: true,
        finishMonsterDeath,
        finishMonsterKill: finishHeroMonsterKill,
        resolveLiquid: () => heroLiquidEffects({
            state: game,
            publish: plineWithContinuation,
        }),
    });
    if (game.program_state.gameover) return;
    if (steedMid && saddle && !hero.usteed) await keepSaddleWithSteedcorpse(steedMid, saddle);
    newsym(hero.ux, hero.uy);
    const landing = await triggerHeroTrapAt(hero.ux, hero.uy, { recursiveTrap: true });
    if (landing.died) return;
    await fillPitWithBoulderAt(hero.ux, hero.uy, game);
}

// C trap.c:set_utrap(): only a change between trapped and free marks the
// status line, since the trapped conditions follow u.utrap.
// C set_utrap() always ends in float_vs_flight(), which sets disp.botl even
// when a caller already counted u.utrap down to zero (trapmove()).
export function setHeroTrap(turns: number, type: number, state: GameState = game): void {
    state.context.botl = true;
    state.u.utrap = turns;
    state.u.utraptype = turns ? type : 0;
    refreshMovementProperties(state);
}

export function clearHeroTrap(state: GameState = game) {
    setHeroTrap(0, 0, state);
}

function reduceHeroTrapDuration(): number {
    const hero = game.u;
    if (hero.utrap === undefined)
        throw new Error('An active hero trap requires a remaining duration.');
    return --hero.utrap;
}

// C pline.c:upstart(), applied to the one trapmove() steed name.
function upstart(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// C Norep() compares pline.c's previous individual message.
async function repeatableTrapMessage(message: string): Promise<void> {
    if (game._lastPlineMessage !== message) await pline(message);
    else game._pending_message = '';
}

function objectAtHero(type: number): GameObject | null {
    const hero = game.u;
    return (game.level?.objects?.[hero.ux]?.[hero.uy] || [])
        .find(object => object.otyp === type) || null;
}

function trapAtHero() {
    const hero = game.u;
    return game.level?.traps?.find(
        trap => trap.tx === hero.ux && trap.ty === hero.uy,
    ) || null;
}

async function fillHeroPitWithBoulder() {
    await fillPitWithBoulderAt(game.u.ux, game.u.uy);
}

function heroEscapesPitEasily() {
    const form = heroMonsterForm();
    return form === PM_PIT_FIEND || (MONSTER_SIZE[form] ?? 2) >= MZ_HUGE;
}

export async function climbOutOfPit() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!hero.utrap || hero.utraptype !== TT_PIT) return;
    const pit = trapName(PIT);
    if (heroPassesWalls()) {
        await pline(`You ascend from the ${pit}.`);
        clearHeroTrap();
        await fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }

    const creviceRoll = rn2(2);
    if (creviceRoll === 0 && objectAtHero(BOULDER)) {
        await plineWithContinuation(`Your ${heroLegName(game)} gets stuck in a crevice.`);
        await pline(`You free your ${heroLegName(game)}.`);
        return;
    }

    const canLeaveByAir = hero.flying || game.flying
        || !!(heroFormFlags() & M1_CLING);
    if (canLeaveByAir && !game.level?.flags?.sokoban_rules) {
        const locomotion = heroLocomotion('climb');
        await pline(`You ${locomotion} from the ${pit}.`);
        clearHeroTrap();
        await fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }

    if (reduceHeroTrapDuration() <= 0 || heroEscapesPitEasily()) {
        clearHeroTrap();
        const locomotion = game.level.flags.sokoban_rules && hero.levitating
            ? 'struggle against the air currents and float' : hero.usteed ? 'ride' : 'crawl';
        await pline(`You ${locomotion} to the edge of the ${pit}.`);
        await fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }
    if (hero.dz || game.flags?.verbose !== false) {
        if (hero.usteed) {
            await repeatableTrapMessage(`${monsterName(hero.usteed, {
                article: 'your', capitalized: true, suppressSaddle: true,
            })} is still in a pit.`);
            return;
        }
        const hallucinating = heroIsHallucinating(game);
        const message = hallucinating && rn2(5) === 0
            ? "You've fallen, and you can't get up."
            : 'You are still in a pit.';
        await repeatableTrapMessage(message);
    }
}

function heroWieldsSting() {
    const weapon = game.uwep || game.u?.uwep;
    return artifactById(weapon?.oartifact)?.name === 'Sting';
}

async function struggleInWeb(steedName: string | null) {
    requirePlayingGame(game);
    const hero = game.u;
    if (heroWieldsSting()) {
        clearHeroTrap();
        await pline('Sting cuts through the web!');
        return;
    }
    if (reduceHeroTrapDuration() <= 0) {
        clearHeroTrap();
        await pline(steedName
            ? `${upstart(steedName)} breaks out of the web.`
            : 'You disentangle yourself.');
    } else if (game.flags?.verbose !== false) {
        await repeatableTrapMessage(steedName
            ? `${upstart(steedName)} is stuck to the web.`
            : 'You are stuck to the web.');
    }
}

// C dig.c:buried_ball_to_freedom(). The ball stays where it was buried,
// which may be beside the hero rather than directly underneath them.
export async function freeHeroFromBuriedBall(state: GameState = game) {
    if (state.u.utrap && state.u.utraptype !== TT_BURIEDBALL) return false;
    const ball = buriedBallNear(state.u.ux, state.u.uy, state);
    if (!ball) return false;
    const { ox: x, oy: y } = ball;
    unlinkObject(ball, state);
    placeObjectSynchronously(ball, x, y, state);
    await stack_object(ball, state);
    await resetHeroTrap(true, state);
    const level = requireGameLevel(state);
    level.engravings = (level.engravings || []).filter(
        engraving => engraving.x !== x || engraving.y !== y,
    );
    newsym(x, y);
    return true;
}

async function struggleInFloor(
    targetX: number, targetY: number, anchored: boolean, steedName: string | null,
): Promise<boolean> {
    requirePlayingGame(game);
    const hero = game.u;
    const ball = anchored ? buriedBallNear(hero.ux, hero.uy, game) : null;
    if (ball) {
        const dx = targetX - ball.ox;
        const dy = targetY - ball.oy;
        if (dx * dx + dy * dy <= 2) {
            if (game.flags?.verbose !== false)
                await repeatableTrapMessage("You move within the chain's reach.");
            return true;
        }
    }

    if (reduceHeroTrapDuration() > 0) {
        if (game.flags?.verbose !== false) {
            const message = anchored
                ? (steedName
                    ? `You and ${steedName} are chained to the buried ball.`
                    : 'You are chained to the buried ball.')
                : (steedName
                    ? `${upstart(steedName)} is stuck in the ${surfaceName(hero.ux, hero.uy)}.`
                    : `You are stuck in the ${surfaceName(hero.ux, hero.uy)}.`);
            await repeatableTrapMessage(message);
        }
        return false;
    }

    if (steedName) {
        await pline(`${upstart(steedName)} finally ${anchored ? 'wrenches the ball' : 'lurches'} free.`);
    } else {
        await pline(anchored
            ? 'You finally wrench the ball free.'
            : 'You finally wriggle free.');
    }
    if (ball) await buriedBallToPunishment();
    else clearHeroTrap();
    return false;
}

export async function heroCanMoveFromTrap(targetX: number, targetY: number): Promise<boolean> {
    const hero = game.u;
    if (!hero?.utrap) return true;
    requirePlayingGame(game);
    // C hack.c:trapmove() formats y_monnam(u.usteed) once at entry, and
    // every mounted message in the call reuses that one string.  Compute the
    // name before the switch so a hallucinating rider draws one random
    // identity per attempt even on paths that print no message.
    const steedName = hero.usteed
        ? monsterName(hero.usteed, { state: game, article: 'your', suppressSaddle: true })
        : null;
    switch (hero.utraptype) {
    case TT_BEARTRAP: {
        const subject = steedName ? upstart(steedName) : 'You';
        if (game.flags?.verbose !== false) {
            await plineWithContinuation(`${subject} ${steedName ? 'is' : 'are'} caught in a bear trap.`,
                { noRepeat: true });
        }
        if ((hero.dx && hero.dy) || rn2(5) === 0) hero.utrap--;
        if (hero.utrap <= 0) {
            await plineWithContinuation(`${subject} finally ${steedName ? 'lurches' : 'wriggle'} free.`);
            clearHeroTrap();
        }
        return false;
    }
    case TT_PIT:
        // C domove_core() calls trapmove(x, y, NULL), so the destination
        // pit lookup in trap.c is dead here: every attempted step from a
        // pit goes through climb_pit() and then aborts the move.
        await climbOutOfPit();
        return false;
    case TT_WEB:
        await struggleInWeb(steedName);
        return false;
    case TT_LAVA: {
        if (game.flags?.verbose !== false)
            await repeatableTrapMessage(steedName
                ? `${upstart(steedName)} is stuck in the lava.`
                : 'You are stuck in the lava.');
        if (!isLavaAt(targetX, targetY)) {
            hero.utrap--;
            if ((hero.utrap & 0xff) === 0) {
                clearHeroTrap();
                await pline(steedName
                    ? `You lead ${steedName} to the edge of the ${displayLiquidName('lava', game)}.`
                    : 'You pull yourself to the edge of the lava.');
            }
        }
        hero.umoved = true;
        return false;
    }
    case TT_INFLOOR:
        return struggleInFloor(targetX, targetY, false, steedName);
    case TT_BURIEDBALL:
        return struggleInFloor(targetX, targetY, true, steedName);
    case undefined:
        return false;
    default:
        return false;
    }
}

async function triggerTeleportTrap(trap: Trap, finishTeleport: HeroTrapOptions['finishTeleport']): Promise<boolean> {
    seeTrap(trap);
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

        let destination = null;
        if (trap.once) {
            deleteTrap(trap);
            newsym(game.u.ux, game.u.uy);

            const vault = searchSpecial(VAULT);
            if (vault) {
                const vaultSquare = { x: 0, y: 0 };
                if (somexyspace(vault, vaultSquare)
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
                newsym(cleared.relocation.oldx, cleared.relocation.oldy);
                newsym(cleared.relocation.x, cleared.relocation.y);
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
        const movement = await moveHeroByTeleport(destination.x, destination.y);
        await finishTeleport(movement);
        return true;
    } finally {
        game._inTeleportTrap = false;
    }
}

async function triggerMagicTrap(trap: Trap) {
    seeTrap(trap);
    if (rn2(30) === 0) {
        deleteTrap(trap);
        newsym(trap.tx, trap.ty);
        await plineWithContinuation('You are caught in a magical explosion!');
        if (await loseHeroHp(rnd(10), 'magical explosion')) return;
        await plineWithContinuation('Your body absorbs some of the magical energy!');
        game.u.uenmax = (game.u.uenmax ?? 0) + 2;
        game.u.uen = game.u.uenmax;
        game.u.uenpeak = Math.max(game.u.uenpeak ?? 0, game.u.uenmax);
        return;
    }

    await triggerHeroMagicTrapEffect();
}

async function triggerProjectileTrap(trap: Trap) {
    const hero = game.u;
    const blind = !!game.blind || heroIsBlind(game);
    const arrowTrap = trap.ttyp === ARROW_TRAP;
    const objectType = arrowTrap ? ARROW : DART;
    const noun = arrowTrap ? 'arrow' : 'little dart';
    const subject = arrowTrap ? 'An arrow' : 'A little dart';
    const attackLevel = arrowTrap ? 8 : 7;

    if (trap.once && trap.tseen && rn2(15) === 0) {
        await publishHeardMessage(arrowTrap ? 'a loud click!' : 'a soft click.', plineWithContinuation);
        deleteTrap(trap);
        newsym(trap.tx, trap.ty);
        return;
    }

    trap.once = true;
    seeTrap(trap);
    await plineWithContinuation(`${subject} shoots out at you!`);

    const missile = await makeTrapMissile(objectType, trap);
    if (!arrowTrap && rn2(6) === 0) missile.opoisoned = 1;
    const damage = physicalDamage(
        rollPhysicalWeaponDamageAgainstHero(missile, game),
    );
    const steed = hero.usteed;
    if (steed && rn2(2) === 0) {
        // A killed steed's m_detach() already dismounted the hero, so
        // steedintrap()'s own dismount_steed() finds no steed.
        await hitSteedWithTrapMissile(steed, trap, missile, game);
        return;
    }
    const mortality = hero.umortality || 0;
    const hit = await hitHeroWithObject(missile, damage, attackLevel, {
        name: noun,
    });
    if (hit.died) return;
    if (hit.hit) {
        if (missile.opoisoned) {
            const poison = await poisonHero({
                reason: 'dart',
                killer: 'little dart',
                attribute: A_CON,
                fatal: (hero.umortality || 0) > mortality ? 0 : 10,
                state: game,
                thrownWeapon: true,
                publish: plineWithContinuation,
            });
            if (poison.died) return;
        }
        await deleteObject(missile, game);
        return;
    }

    placeCreatedObject(missile, trap.tx, trap.ty);
    if (!blind) observeObject(missile, game);
    await stack_object(missile, game);
    newsym(trap.tx, trap.ty);
}

// C teleport.c:level_tele_trap(). The level prompt acknowledges the trap
// announcement before accepting its first character.
export async function triggerLevelTeleportTrap(trap: Trap, gotoLevel: HeroTrapOptions['gotoLevel'],
    intentional: boolean): Promise<void> {
    requirePlayingGame(game);
    seeTrap(trap);
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
    newsym(hero.ux, hero.uy);
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

async function triggerSqueakyBoard(
    trap: Trap,
    { viaSitting = false, failedUntrap = false, forceTrap = false } = {},
) {
    requirePlayingGame(game);
    const hero = game.u;
    const blind = !!game.blind || heroIsBlind(game);
    const deaf = !!game.deaf || heroIsDeaf(game);
    const flying = !!(hero.flying || game.flying);
    const airborne = !!(hero.levitating || game.levitating || flying);
    const forced = forceTrap || failedUntrap || (flying && viaSitting);
    if (airborne && !forced) {
        if (!blind) {
            seeTrap(trap);
            const hallucinating = heroIsHallucinating(game);
            await plineWithContinuation(hallucinating
                ? 'You notice a crease in the linoleum.'
                : 'You notice a loose board below you.');
        }
        return;
    }

    seeTrap(trap);
    await plineWithContinuation(deaf
        ? 'A board beneath you vibrates.'
        : `A board beneath you squeaks ${
            squeakyBoardNoteWithArticle(trap.tnote ?? -1) || 'a note'
        } loudly.`);
    await wakeMonstersNearWithMessages(hero.ux, hero.uy, hero.ulevel * 20, game);
}

function heroPassesRocks() {
    const flags = heroFormFlags();
    return !!(flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
}

async function triggerFallingRockTrap(trap: Trap) {
    const hero = game.u;
    const ceiling = ceilingName(hero.ux, hero.uy, game);
    if (trap.once && trap.tseen && rn2(15) === 0) {
        await plineWithContinuation(
            `A trap door in the ${ceiling} opens, but nothing falls out!`,
        );
        deleteTrap(trap);
        newsym(hero.ux, hero.uy);
        return;
    }

    let damage = d(2, 6);
    trap.once = true;
    feelTrap(trap);
    const rock = await makeTrapMissile(ROCK, trap);
    placeCreatedObject(rock, hero.ux, hero.uy);
    observeObjectForNaming(rock);
    await plineWithContinuation(
        `A trap door in the ${ceiling} opens and ${
            withIndefiniteArticle(objectName(rock))
        } falls on your ${heroHeadName(game)}!`,
    );

    let harmless = false;
    const helmet = game.uarmh || hero.uarmh;
    if (helmet) {
        if (heroPassesRocks()) {
            await plineWithContinuation(
                `Unfortunately, you are wearing ${
                    simpleObjectNameWithArticle(helmet)
                }.`,
            );
            damage = 2;
        } else if (objectIsHardHelmet(helmet)) {
            await plineWithContinuation(
                'Fortunately, you are wearing a hard helmet.',
            );
            damage = 2;
        } else if (game.flags?.verbose !== false) {
            await plineWithContinuation(`${ownedObjectName(helmet)} does not protect you.`);
        }
    } else if (heroPassesRocks()) {
        await plineWithContinuation('It passes harmlessly through you.');
        harmless = true;
    }

    if (!(game.blind || heroIsBlind(game)))
        observeObject(rock, game);
    await stack_object(rock, game);
    newsym(hero.ux, hero.uy);
    if (!harmless) {
        if (await loseHeroHp(physicalDamage(damage), 'falling rock')) return;
        await exerciseAttribute(A_STR, false);
    }
}

async function triggerSleepingGasTrap(trap: Trap) {
    const hero = game.u;
    seeTrap(trap);
    const breathless = !!hero.breathless
        || !!(heroFormFlags() & M1_BREATHLESS);
    if (hero.sleepResistance || breathless) {
        await plineWithContinuation('You are enveloped in a cloud of gas!');
        monstersObserveHeroResistance(M_SEEN_SLEEP, game);
    } else {
        await plineWithContinuation('A cloud of gas puts you to sleep!');
        await putHeroToSleep(rnd(25), { state: game });
        monstersForgetHeroResistance(M_SEEN_SLEEP, game);
    }

    const steed = hero.usteed;
    if (!steed || monsterResistsSleep(steed)
        || monsterIsBreathless(steed) || monsterIsHelpless(steed)) return;
    steed.mx = hero.ux;
    steed.my = hero.uy;
    if (!putMonsterToSleep(steed, rnd(25))) return;
    const name = steed.name || `The ${monsterTypeName(
        steed.mnum, !!steed.female,
    )}`;
    await plineWithContinuation(`${name} suddenly falls asleep!`);
}

export async function animateRollingBoulderCell(
    boulder: GameObject, glyph: DisplayGlyph, x: number, y: number, previous: Position | null,
): Promise<Position | null> {
    if (previous) newsym(previous.x, previous.y);
    if (!cansee(x, y)) return null;

    show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, glyph.attr, glyph);
    // Keep the animation cursor after the last map cell the display changed.
    const frameCursor: [number, number] = previous
        ? lastDirtyMapCursor() ?? [x, y + 1]
        : [x, y + 1];
    for (let delay = 0; delay < 2; delay++) {
        await flush_screen(1);
        game.nhDisplay?.setCursor(...frameCursor);
        await game.animationFrame?.();
    }
    return { x, y };
}

async function triggerRollingBoulderTrap(trap: Trap) {
    const wasKnown = !!trap.tseen;
    feelTrap(trap);

    const click = heroIsDeaf(game) ? '' : 'Click!  ';
    await plineWithContinuation(`${click}You trigger a rolling boulder trap!`);

    requirePlayingGame(game);
    const released = await launchRollingBoulder(trap.launch, trap.launch2 ?? trap.launch, {
        state: game, known: wasKnown,
    });
    if (!released) await plineWithContinuation(wasKnown
        ? 'No boulder was released.' : 'Fortunately for you, no boulder was released.');
}

async function triggerBearTrap(trap: Trap, {
    failedUntrap = false, forceTrap = false,
    viaSitting = false,
} = {}) {
    requirePlayingGame(game);
    const hero = game.u;
    const levitating = hero.levitating || game.levitating;
    const flying = hero.flying || game.flying;
    const forced = forceTrap || failedUntrap;

    const damage = d(2, 4);
    if (!forced && !viaSitting && (levitating || flying)) return false;
    feelTrap(trap);
    const subject = trap.madeby_u ? 'Your' : 'A';
    const body = { mnum: heroMonsterForm() };
    if (monsterIsAmorphous(body) || monsterIsWhirly(body) || monsterIsUnsolid(body)) {
        await plineWithContinuation(`${subject} bear trap closes harmlessly through you.`);
        return false;
    }
    if (!hero.usteed && (MONSTER_SIZE[body.mnum] ?? 2) <= 1) {
        await plineWithContinuation(`${subject} bear trap closes harmlessly over you.`);
        return false;
    }
    setHeroTrap(4 + rn2(4), TT_BEARTRAP);
    game.context.botl = true;

    const steed = hero.usteed;
    if (steed) {
        const name = monsterName(steed);
        const possessive = /^it$/i.test(name) ? `${name}s`
            : /^you$/i.test(name) ? `${name}r`
                : name.endsWith('s') ? `${name}'` : `${name}'s`;
        await plineWithContinuation(
            `${subject} bear trap closes on ${possessive} ${monsterFootName(steed.mnum)}!`,
        );
        // C thitm(0, steed, NULL, damage, FALSE): forced damage, no missile.
        steed.mhp -= damage;
        if (steed.mhp <= 0) {
            const death = await finishMonsterTrapDeath(steed, game, { damageType: AD_PHYS });
            if (death.heroDied) return true;
            if (!death.survived) await resetHeroTrap(true);
        }
    } else {
        await plineWithContinuation(`${subject} bear trap closes on your ${heroFootName()}!`);
        if (['owlbear', 'bugbear'].includes(MONSTER_NAME[body.mnum] ?? ''))
            await plineWithContinuation('You howl in anger!');
        const boots = heroIronShoes();
        if (boots) {
            if (!heroIsBlind(game)) observeObject(boots, game);
            await plineWithContinuation(`${ownedObjectName(boots)} protects your leg.`);
        } else {
            const side = rn2(2) ? 'right' : 'left';
            await woundHeroLegs(side, 10 + rn2(10));
            if (await loseHeroHp(physicalDamage(damage), 'bear trap')) return true;
        }
    }
    await exerciseAttribute(A_DEX, false);
    return false;
}

async function wetHeroObject(object: GameObject | null, description: string | null = null) {
    const messages: string[] = [];
    const result = await waterDamageObject(object, messages, game, {
        force: true,
        description,
    });
    for (const message of messages) await plineWithContinuation(message);
    return result;
}

async function rustIronGolemHero() {
    const hero = game.u;
    await plineWithContinuation('You are covered with rust!');
    const damage = physicalDamage(hero.mhmax ?? hero.mh ?? 1);
    hero.mh = (hero.mh ?? 1) - damage;
    if (hero.mh > 0) return;
    if (!(hero.unchanging || game.unchanging)) {
        await returnHeroToHumanForm(game);
        return;
    }
    await finishHeroDeath({ killer: 'rusting away' });
}

async function triggerRustTrap(trap: Trap) {
    const hero = game.u;
    seeTrap(trap);
    const target = rn2(5);

    if (target === 0) {
        await plineWithContinuation(
            `A gush of water hits you on the ${heroHeadName(game)}!`,
        );
        const helmet = heroObject('uarmh');
        await wetHeroObject(
            helmet, helmet ? armorSimpleName(helmet, game) : 'helmet',
        );
    } else if (target === 1) {
        await plineWithContinuation(
            `A gush of water hits your left ${heroArmName(game)}!`,
        );
        const shield = heroObject('uarms');
        const shieldResult = await wetHeroObject(shield, 'shield');
        if (shieldResult === 'nothing') {
            const primary = heroObject('uwep');
            const secondary = heroObject('uswapwep');
            let weapon = null;
            if (hero.twoweap) weapon = secondary;
            else if (primary && OBJECT_BIMANUAL[primary.otyp])
                weapon = primary;
            await wetHeroObject(weapon);
            const gloves = heroObject('uarmg');
            await wetHeroObject(
                gloves, gloves ? armorSimpleName(gloves, game) : 'gloves',
            );
        }
    } else if (target === 2) {
        await plineWithContinuation(
            `A gush of water hits your right ${heroArmName(game)}!`,
        );
        const weapon = heroObject('uwep');
        await wetHeroObject(weapon);
        const gloves = heroObject('uarmg');
        await wetHeroObject(
            gloves, gloves ? armorSimpleName(gloves, game) : 'gloves',
        );
    } else {
        await plineWithContinuation('A gush of water hits you!');
        for (const object of game.inventory || []) {
            if (!object.lamplit || object === heroObject('uwep')) continue;
            if (hero.twoweap && object === heroObject('uswapwep')) continue;
            await splashLitObject(object, plineWithContinuation, game);
        }
        const cloak = heroObject('uarmc');
        const suit = heroObject('uarm');
        const shirt = heroObject('uarmu');
        if (cloak) await wetHeroObject(cloak, armorSimpleName(cloak, game));
        else if (suit) await wetHeroObject(suit, armorSimpleName(suit, game));
        else await wetHeroObject(shirt, 'shirt');
    }

    if (heroIsPolymorphed(game) && hero.umonnum === PM_IRON_GOLEM) {
        await rustIronGolemHero();
    } else if (heroIsPolymorphed(game) && hero.umonnum === PM_GREMLIN
        && rn2(3) !== 0) {
        const clone = await splitHeroMonsterForm(game);
        if (clone) await plineWithContinuation('You multiply!');
    }
}

export async function prepareHoleFall(trap: Trap | null | undefined, { tookPlunge = false } = {}): Promise<HoleFall | null> {
    if (!trap || (trap.ttyp !== HOLE && trap.ttyp !== TRAPDOOR)) return null;
    requirePlayingGame(game);
    const sokoban = !!game.level?.flags?.sokoban_rules;
    const levitating = !!(game.u?.levitating || game.levitating);
    if (game.blind && levitating && !sokoban) return null;

    feelTrap(trap);
    if (!sokoban && !tookPlunge) await plineWithContinuation(trap.ttyp === TRAPDOOR
        ? 'A trap door opens up under you!' : "There's a gaping hole under you!");

    const form = heroMonsterForm();
    const flying = !!(game.u.flying || game.flying);
    const clinging = !!(heroFormFlags() & M1_CLING);
    const hidingAbove = game.u.uundetected && (heroFormFlags() & M1_HIDE)
        && MONSTER_SYMBOL[form] !== S_MIMIC;
    const tooLarge = Number.isInteger(form)
        && (MONSTER_SIZE[form] ?? 0) >= MZ_HUGE;
    const forced = sokoban && canFallThrough(game.u.uz);
    const avoidsFall = levitating || game.u.ustuck
        || (!canFallThrough(game.u.uz) && !game.level.at(game.u.ux, game.u.uy)?.candig)
        || ((flying || clinging || hidingAbove) && !tookPlunge);
    let refusal;
    if (!forced && avoidsFall) refusal = "You don't fall in.";
    else if (!forced && tooLarge) refusal = "You don't fit through.";
    else if (!forced) {
        if (!await bringLeashedFollowers(game)) refusal = 'You are jerked back by your pet!';
    }
    if (refusal) {
        await plineWithContinuation(refusal);
        await impactDrop(null, game.u.ux, game.u.uy, { publish: plineWithContinuation });
        return null;
    }
    if ((flying || clinging) && tookPlunge) await plineWithContinuation(
        `You ${flying ? 'swoop' : 'deliberately drop'} down `
        + `${trap.ttyp === TRAPDOOR ? 'through the trap door' : 'into the gaping hole'}!`,
    );

    if (game.u.ushops?.length) await shopDig(1);
    const current = game.u.uz;
    if (Is_stronghold(current)) {
        if (!game.valley_level) throw new Error('A Castle trapdoor requires the Valley destination');
        return { destination: { ...game.valley_level }, arrival: flying ? 'random' : 'falling' };
    }
    const destination = clampHoleDestination(trap.dst
        ?? { dnum: current.dnum, dlevel: current.dlevel + 1 });
    const distance = dungeonDepth(destination.dnum, destination.dlevel)
        - dungeonDepth(current.dnum, current.dlevel);
    // C fall_through(): only a deliberate plunge while Flying is
    // controlled_flight; a forced Sokoban fall still falls.
    const controlledFlight = flying && tookPlunge;
    if (distance > 1) await plineWithContinuation(
        `You ${controlledFlight ? 'fly' : 'fall'} down a ${distance > 3 ? 'very ' : ''}`
        + `${distance > 2 ? 'deep ' : ''}shaft!`,
    );
    return { destination, arrival: flying ? 'random' : 'falling' };
}

// shortCircuited stops remaining spot effects; died stops the whole action.
export async function triggerHeroTrap(trap: Trap | null | undefined, {
    finishTeleport = null,
    gotoLevel = null,
    viaSitting = false,
    failedUntrap = false,
    forceTrap = false,
    forceBungle = false,
    noWebMessage = false,
    tookPlunge = false,
    recursiveTrap = false,
}: HeroTrapOptions = {}): Promise<HeroTrapResult> {
    if (!trap) return { died: false, shortCircuited: false };
    endVoluntaryMultiTurn();
    requirePlayingGame(game);
    const hero = game.u;
    const pit = is_pit(trap.ttyp);
    const sokobanFall = game.level.flags.sokoban_rules
        && (pit || trap.ttyp === HOLE || trap.ttyp === TRAPDOOR);
    const forced = forceTrap || failedUntrap
        || (trap.ttyp === TELEP_TRAP && trap.teledest
            && isok(trap.teledest.x, trap.teledest.y));
    const owner = trap.madeby_u ? 'your'
        : trap.ttyp === ARROW_TRAP ? 'an' : 'a';
    if (sokobanFall) {
        await plineWithContinuation(`Air currents pull you down into ${owner} ${
            trapName(trap.ttyp, { ignoreHallucination: true })}!`);
    } else if (!forced) {
        const airborne = hero.levitating || game.levitating
            || ((hero.flying || game.flying) && !viaSitting && !tookPlunge);
        if (trapTriggeredByFloor(trap) && airborne) {
            const locomotion = heroLocomotion('step');
            if (trap.tseen) await plineWithContinuation(`You ${locomotion} over ${owner} ${trapName(trap.ttyp)}.`);
            return { died: false, shortCircuited: false };
        }
        const previousPit = game.level.traps.find(candidate =>
            candidate.tx === hero.ux0 && candidate.ty === hero.uy0);
        const fromPit = pit && hero.utrap && hero.utraptype === TT_PIT
            && previousPit && is_pit(previousPit.ttyp);
        const conjoined = fromPit && pitsAreConjoined(previousPit, trap);
        const adjacent = fromPit && (hero.dx || hero.dy);
        if (trap.tseen && !hero.fumbling && trap.ttyp !== MAGIC_PORTAL
            && trap.ttyp !== VIBRATING_SQUARE && trap.ttyp !== ANTI_MAGIC
            && !forceBungle && !tookPlunge && !conjoined && !adjacent
            && (rn2(5) === 0 || (pit && (heroFormFlags() & M1_CLING)))) {
            await plineWithContinuation(`You escape ${owner} ${trapName(trap.ttyp)}.`);
            return { died: false, shortCircuited: false };
        }
    }
    if (hero.usteed) monsterLearnsTrap(hero.usteed, trap);
    monstersSeeTrap(game, trap);
    let died = false;
    let shortCircuited = false;
    switch (trap.ttyp) {
    case HOLE:
    case TRAPDOOR: {
        const fall = await prepareHoleFall(trap, { tookPlunge });
        if (!fall || !gotoLevel) break;
        // C fall_through() leaves domove() on this level until deferred_goto().
        scheduleLevelChange([fall.destination, { arrival: fall.arrival }], gotoLevel);
        break;
    }
    case TELEP_TRAP:
        shortCircuited = await triggerTeleportTrap(trap, finishTeleport);
        break;
    case LEVEL_TELEP:
        await triggerLevelTeleportTrap(trap, gotoLevel, viaSitting || forceTrap);
        break;
    case ARROW_TRAP:
    case DART_TRAP:
        await triggerProjectileTrap(trap);
        break;
    case SQKY_BOARD:
        await triggerSqueakyBoard(trap, { viaSitting, failedUntrap, forceTrap });
        break;
    case ROCKTRAP:
        await triggerFallingRockTrap(trap);
        break;
    case ROLLING_BOULDER_TRAP:
        await triggerRollingBoulderTrap(trap);
        break;
    case SLP_GAS_TRAP:
        await triggerSleepingGasTrap(trap);
        break;
    case RUST_TRAP:
        await triggerRustTrap(trap);
        break;
    case ANTI_MAGIC:
        await triggerHeroAntiMagicTrap(trap);
        break;
    case BEAR_TRAP:
        died = await triggerBearTrap(trap, {
            failedUntrap, forceTrap, viaSitting,
        });
        break;
    case FIRE_TRAP:
        seeTrap(trap);
        died = (await triggerHeroFireTrap()).died;
        break;
    case MAGIC_PORTAL:
        feelTrap(trap);
        if (game.u.utraptype === TT_BURIEDBALL) await buriedBallToPunishment();
        await activateMagicPortal(trap, gotoLevel);
        break;
    case MAGIC_TRAP:
        await triggerMagicTrap(trap);
        break;
    case POLY_TRAP:
        await triggerHeroPolymorphTrap(trap, viaSitting);
        break;
    case PIT:
    case SPIKED_PIT:
        await triggerPit(trap, { viaSitting, tookPlunge, recursiveTrap });
        break;
    case WEB:
        await triggerWeb(trap, { viaSitting, failedUntrap, forceTrap, noWebMessage });
        break;
    case STATUE_TRAP:
        await activateStatueTrapAt(trap.tx, trap.ty);
        break;
    case LANDMINE:
        await triggerLandmine(trap, { failedUntrap, forceTrap, forceBungle });
        break;
    case VIBRATING_SQUARE:
        feelTrap(trap);
        break;
    }
    return {
        died: died || !!game.program_state.gameover,
        shortCircuited: !!shortCircuited,
    };
}

export async function triggerHeroTrapAt(x: number, y: number, options: HeroTrapOptions = {}): Promise<HeroTrapResult> {
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    return triggerHeroTrap(trap, options);
}
