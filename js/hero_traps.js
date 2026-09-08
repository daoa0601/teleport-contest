// Trap effects on the hero.
// C refs: trap.c dotrap(), trapeffect_*(), launch_obj(), and teleport.c
// tele_trap().

import {
    currentAttribute, exerciseAttribute,
} from './attrib.js';
import { objectIsHardHelmet } from './armor.js';
import { heroArmName, heroHeadName } from './body_parts.js';
import {
    A_CON, A_DEX, A_STR, ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP,
    FIRE_TRAP,
    HOLE, ICE, IS_LAVA, IS_POOL, M_SEEN_SLEEP,
    LANDMINE, MAGIC_PORTAL, MAGIC_TRAP, PIT, ROCKTRAP,
    ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP,
    SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TRAPDOOR,
    TELEP_TRAP, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT,
    TT_WEB, VAULT, VIBRATING_SQUARE, WEB, isok,
    squeakyBoardNoteWithArticle,
} from './const.js';
import {
    flush_screen, lastDirtyMapCursor, map_trap, newsym, pline,
    plineWithContinuation, shieldeff, show_glyph_cell,
    transientObjectGlyph,
} from './display.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { refreshMovementProperties } from './properties.js';
import { heroLiquidEffects } from './hack.js';
import {
    hasInternalInvisibility, syncHeroInvisibility,
} from './hero_invisibility.js';
import { distmin } from './hacklib.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { explodeLandMine } from './landmine_explosion.js';
import { igniteItems } from './light.js';
import { place_object, remove_object, stack_object } from './floor_object.js';
import {
    canFallThrough, splitHeroMonsterForm,
} from './mklev.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { somexyspace } from './mkroom.js';
import {
    MONSTER_FLAGS1, MONSTER_SIZE, monsterTypeName,
} from './monster_data.js';
import {
    ARROW, BOULDER, DART, HEAVY_IRON_BALL, OBJECT_BIMANUAL,
    OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_SMALL_DAMAGE, ROCK,
} from './object_data.js';
import { deleteObject } from './object_delete.js';
import { recordObjectEncounter } from './object_knowledge.js';
import { d, rn2, rnd } from './rng.js';
import { stopRun } from './runmode.js';
import { artifactById } from './artifacts.js';
import { attachBuriedBall } from './ball.js';
import { setTrack } from './track.js';
import {
    clearFixedTeleportDestination, heroTeleportDestinationOk,
    heroTeleportTrapBlock, moveHeroByTeleport, prepareHeroTeleport,
    safeTeleportDestination,
} from './teleport.js';
import { CLR_GREEN } from './terminal.js';
import { cansee } from './vision.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';
import { revealVibratingSquare } from './invocation.js';
import { hasInvokedProperty } from './properties.js';
import { triggerHeroFireTrap } from './fire_trap.js';
import { activateMagicPortal } from './magic_portal.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { poisonHero } from './poison.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { makeTrapMissile } from './trap_missile.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
import { wakeMonstersNear } from './monster_wake.js';
import { ceilingName } from './terrain_name.js';
import { simpleObjectNameWithArticle } from './object_grammar.js';
import { putHeroToSleep } from './hero_sleep.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
} from './monster_perception.js';
import {
    monsterIsBreathless, monsterIsHelpless, monsterResistsSleep,
    putMonsterToSleep,
} from './monster_sleep.js';
import { splashLitObject, waterDamageObject } from './trap.js';
import { heroIsPolymorphed, returnHeroToHumanForm } from './polyself.js';
import { finishHeroDeath } from './end.js';
import { triggerHeroAntiMagicTrap } from './anti_magic_trap.js';
import { destroyFireInventory } from './zap.js';
import { woundHeroLegs } from './hero_legs.js';

const M1_CLING = 0x00000010;
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

function heroMonsterForm() {
    return Number.isInteger(game.u?.umonnum) ? game.u.umonnum : null;
}

function heroFormFlags() {
    return MONSTER_FLAGS1[heroMonsterForm()] ?? 0;
}

function loseHitPoints(amount) {
    game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - amount);
}

function physicalDamage(amount) {
    if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
        amount = Math.trunc((amount + 1) / 2);
    return amount;
}

function losePhysicalHitPoints(amount) {
    loseHitPoints(physicalDamage(amount));
}

function heroObject(slot) {
    return game[slot] || game.u?.[slot] || null;
}

function heroIronShoes() {
    const boots = heroObject('uarmf');
    return boots && OBJECT_MATERIAL[boots.otyp] === IRON ? boots : null;
}

function heroWearsIronShoes() {
    return !!heroIronShoes();
}

function heroPassesWalls() {
    return !!game.u?.passesWalls || !!(heroFormFlags() & M1_WALLWALK);
}

async function triggerPit(
    trap,
    { viaSitting = false, failedUntrap = false } = {},
) {
    const hero = game.u;
    const formFlags = heroFormFlags();
    if (!failedUntrap && (hero.levitating || game.levitating
        || ((hero.flying || game.flying) && !viaSitting))) return;
    trap.tseen = true;
    if (formFlags & M1_CLING) {
        await plineWithContinuation(
            `You see ${trap.ttyp === SPIKED_PIT ? 'a spiked pit' : 'a pit'} below you.`,
        );
        return;
    }

    await plineWithContinuation('You fall into a pit!');
    let spiked = trap.ttyp === SPIKED_PIT;
    if (spiked && heroWearsIronShoes()) {
        await plineWithContinuation(
            'Your boots protect you from the sharp iron spikes.',
        );
        spiked = false;
    } else if (spiked) {
        await plineWithContinuation(
            'You land on a set of sharp iron spikes!',
        );
    }
    hero.utrap = rn2(6) + 2;
    hero.utraptype = TT_PIT;
    refreshMovementProperties(game);
    const mortality = hero.umortality || 0;
    const damage = physicalDamage(spiked ? rnd(10) : rnd(6));
    const killer = spiked ? 'fell into a pit of iron spikes' : 'fell into a pit';
    if (await loseHeroHp(damage, killer)) return;
    if (spiked && rn2(6) === 0) {
        const poison = await poisonHero({
            reason: 'spikes', killer: 'fall onto poison spikes', attribute: A_STR,
            fatal: (hero.umortality || 0) > mortality ? 0 : 8,
        });
        if (poison.died) return;
    }
    game.vision_full_recalc = 1;
    exerciseAttribute(A_STR, false);
    exerciseAttribute(A_DEX, false);
}

function webTrapDuration() {
    const strength = currentAttribute(A_STR, game);
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
    trap,
    { viaSitting = false, failedUntrap = false } = {},
) {
    const hero = game.u;
    trap.tseen = true;
    const form = heroMonsterForm();
    if (form === PM_CAVE_SPIDER || form === PM_GIANT_SPIDER) {
        await plineWithContinuation(trap.madeby_u
            ? 'You take a walk on your web.'
            : 'There is a spider web here.');
        return;
    }
    await plineWithContinuation(viaSitting || failedUntrap
        ? 'You are caught by a spider web!'
        : 'You stumble into a spider web!');
    const turns = webTrapDuration();
    hero.utrap = turns;
    hero.utraptype = TT_WEB;
    refreshMovementProperties(game);
    if (!turns) {
        await plineWithContinuation('You tear through the web!');
        const index = game.level.traps.indexOf(trap);
        if (index >= 0) game.level.traps.splice(index, 1);
        newsym(hero.ux, hero.uy);
    }
}

async function triggerLandmine(trap, { failedUntrap = false } = {}) {
    const hero = game.u;
    let damage = rnd(16);
    if (heroWearsIronShoes()) damage = Math.trunc((damage + 3) / 4);
    const airborne = !failedUntrap && (hero.levitating || game.levitating
        || hero.flying || game.flying);
    if (airborne) {
        const alreadySeen = !!trap.tseen;
        if (!alreadySeen && rn2(3) !== 0) return;
        trap.tseen = true;
        await plineWithContinuation(alreadySeen
            ? 'There is a trigger in a pile of soil below you.'
            : 'You discover a trigger in a pile of soil below you.');
        if (alreadySeen && rn2(3) !== 0) return;
        await plineWithContinuation('The air currents set the land mine off!');
    } else {
        trap.tseen = true;
        await plineWithContinuation(
            `KAABLAMM!!!  You triggered ${
                trap.madeby_u ? 'your' : 'a'
            } land mine!`,
        );
        hero._woundedLegTurns = Math.max(
            hero._woundedLegTurns ?? 0, rn2(35) + 41, rn2(35) + 41,
        );
        hero._woundedLegSide = 'both';
        exerciseAttribute(A_DEX, false);
    }
    trap.ttyp = PIT;
    trap.madeby_u = false;
    losePhysicalHitPoints(damage);
    const finishMonsterDeath = async (monster, death) => {
        const killed = await finishHeroMonsterKill(
            monster, monster.mx, monster.my, {
                showKillMessage: false,
                noCorpse: death.noCorpse,
            },
        );
        return { monster, survived: !killed };
    };
    const pit = await explodeLandMine(trap, game, {
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
            burnInventory: fireDamage => destroyFireInventory(
                fireDamage, { state: game, publish: plineWithContinuation },
            ),
            igniteInventory: () => igniteItems(game.inventory, {
                state: game,
                publish: plineWithContinuation,
            }),
        }),
    });
    if (pit) {
        await triggerPit(pit, { failedUntrap });
        fillPitWithBoulderAt(hero.ux, hero.uy, game);
    }
    newsym(hero.ux, hero.uy);
}

export function clearHeroTrap(state = game) {
    state.u.utrap = 0;
    state.u.utraptype = 0;
    refreshMovementProperties(state);
}

async function repeatableTrapMessage(message) {
    if (game._last_message !== message) await pline(message);
    else game._pending_message = '';
}

function objectAtHero(type) {
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

function fillHeroPitWithBoulder() {
    const boulder = objectAtHero(BOULDER);
    const trap = trapAtHero();
    if (!boulder || !trap
        || (trap.ttyp !== PIT && trap.ttyp !== SPIKED_PIT)) return;
    remove_object(boulder);
    const trapIndex = game.level.traps.indexOf(trap);
    if (trapIndex >= 0) game.level.traps.splice(trapIndex, 1);
    newsym(game.u.ux, game.u.uy);
}

function heroEscapesPitEasily() {
    const form = heroMonsterForm();
    return form === PM_PIT_FIEND || (MONSTER_SIZE[form] ?? 2) >= MZ_HUGE;
}

async function climbOutOfPit() {
    const hero = game.u;
    if (heroPassesWalls()) {
        await pline('You ascend from the pit.');
        clearHeroTrap();
        fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }

    const creviceRoll = rn2(2);
    if (creviceRoll === 0 && objectAtHero(BOULDER)) {
        await plineWithContinuation('Your leg gets stuck in a crevice.');
        await pline('You free your leg.');
        return;
    }

    const canLeaveByAir = hero.flying || game.flying
        || !!(heroFormFlags() & M1_CLING);
    if (canLeaveByAir && !game.level?.flags?.sokoban_rules) {
        await pline('You climb from the pit.');
        clearHeroTrap();
        fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }

    hero.utrap--;
    if (hero.utrap <= 0 || heroEscapesPitEasily()) {
        await pline('You crawl to the edge of the pit.');
        clearHeroTrap();
        fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }
    if (game.flags?.verbose !== false) {
        const hallucinating = hero.hallucinating
            || (hero.hallucinationTurns ?? 0) > 0;
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

async function struggleInWeb() {
    const hero = game.u;
    if (heroWieldsSting()) {
        clearHeroTrap();
        await pline('Sting cuts through the web!');
        return;
    }
    hero.utrap--;
    if (hero.utrap <= 0) {
        clearHeroTrap();
        await pline('You disentangle yourself.');
    } else if (game.flags?.verbose !== false) {
        await repeatableTrapMessage('You are stuck to the web.');
    }
}

function surfaceAtHero() {
    const terrain = game.level?.at?.(game.u.ux, game.u.uy)?.typ;
    if (IS_LAVA(terrain)) return 'lava';
    if (IS_POOL(terrain)) return 'water';
    if (terrain === ICE) return 'ice';
    return 'floor';
}

function nearestBuriedBall(state = game) {
    const hero = state.u;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const object of state.level?.buriedObjects || []) {
        if (object.otyp !== HEAVY_IRON_BALL) continue;
        const dx = object.ox - hero.ux;
        const dy = object.oy - hero.uy;
        const distance = dx * dx + dy * dy;
        if (distance <= 8 && distance < nearestDistance) {
            nearest = object;
            nearestDistance = distance;
        }
    }
    return nearest;
}

// C dig.c:buried_ball_to_freedom(). The ball stays where it was buried,
// which may be beside the hero rather than directly underneath them.
export function freeHeroFromBuriedBall(state = game) {
    if (state.u.utrap && state.u.utraptype !== TT_BURIEDBALL) return false;
    const ball = nearestBuriedBall(state);
    if (!ball) return false;
    const { ox: x, oy: y } = ball;
    state.level.buriedObjects.splice(state.level.buriedObjects.indexOf(ball), 1);
    ball.buried = false;
    place_object(ball, x, y, state);
    stack_object(ball, state);
    clearHeroTrap(state);
    state.level.engravings = (state.level.engravings || []).filter(
        engraving => engraving.x !== x || engraving.y !== y,
    );
    newsym(x, y);
    return true;
}

function releaseBuriedBallForLevelChange() {
    if (game.u?.utraptype !== TT_BURIEDBALL) return;
    const ball = nearestBuriedBall();
    if (!ball) return;
    clearHeroTrap();
    attachBuriedBall(ball);
}

async function struggleInFloor(targetX, targetY, anchored) {
    const hero = game.u;
    const ball = anchored ? nearestBuriedBall() : null;
    if (ball) {
        const dx = targetX - ball.ox;
        const dy = targetY - ball.oy;
        if (dx * dx + dy * dy <= 2) {
            if (game.flags?.verbose !== false)
                await repeatableTrapMessage("You move within the chain's reach.");
            return true;
        }
    }

    hero.utrap--;
    if (hero.utrap > 0) {
        if (game.flags?.verbose !== false) {
            const message = anchored
                ? 'You are chained to the buried ball.'
                : `You are stuck in the ${surfaceAtHero()}.`;
            await repeatableTrapMessage(message);
        }
        return false;
    }

    await pline(anchored
        ? 'You finally wrench the ball free.'
        : 'You finally wriggle free.');
    clearHeroTrap();
    if (ball) attachBuriedBall(ball);
    return false;
}

export async function heroCanMoveFromTrap(targetX, targetY) {
    const hero = game.u;
    if (!hero?.utrap) return true;
    switch (hero.utraptype) {
    case TT_BEARTRAP:
        if (game.flags?.verbose !== false)
            await repeatableTrapMessage('You are caught in a bear trap.');
        if ((hero.dx && hero.dy) || rn2(5) === 0) hero.utrap--;
        if (hero.utrap <= 0) {
            clearHeroTrap();
            await pline('You finally wriggle free.');
        }
        return false;
    case TT_PIT:
        await climbOutOfPit();
        return false;
    case TT_WEB:
        await struggleInWeb();
        return false;
    case TT_LAVA:
        if (game.flags?.verbose !== false)
            await repeatableTrapMessage('You are stuck in the lava.');
        if (!IS_LAVA(game.level?.at?.(targetX, targetY)?.typ)) {
            hero.utrap--;
            if ((hero.utrap & 0xff) === 0) {
                clearHeroTrap();
                await pline('You pull yourself to the edge of the lava.');
            }
        }
        hero.umoved = true;
        return false;
    case TT_INFLOOR:
        return struggleInFloor(targetX, targetY, false);
    case TT_BURIEDBALL:
        return struggleInFloor(targetX, targetY, true);
    default:
        return false;
    }
}

async function triggerTeleportTrap(trap, finishTeleport) {
    trap.tseen = true;
    if (game._inTeleportTrap) return false;
    if (typeof finishTeleport !== 'function')
        throw new TypeError('teleport trap needs an arrival handler');

    game._inTeleportTrap = true;
    try {
        const blocked = heroTeleportTrapBlock();
        if (blocked) {
            if (blocked === 'antimagic')
                await shieldeff(game.u.ux, game.u.uy);
            await plineWithContinuation('You feel a wrenching sensation.');
            return true;
        }

        const preparation = prepareHeroTeleport();
        for (const message of preparation.messages)
            await plineWithContinuation(message);
        if (!preparation.allowed) {
            await plineWithContinuation('You shudder for a moment.');
            return true;
        }

        let destination = null;
        if (trap.once) {
            const trapIndex = game.level.traps.indexOf(trap);
            if (trapIndex >= 0) game.level.traps.splice(trapIndex, 1);
            newsym(game.u.ux, game.u.uy);

            const vault = game.level?.rooms?.find(
                room => room?.rtype === VAULT,
            );
            if (vault) {
                const vaultSquare = { x: 0, y: 0 };
                if (somexyspace(vault, vaultSquare)
                    && heroTeleportDestinationOk(
                        vaultSquare.x, vaultSquare.y,
                    )) destination = vaultSquare;
            }
            destination ||= safeTeleportDestination();
        } else if (trap.teledest
            && isok(trap.teledest.x, trap.teledest.y)) {
            setTrack(game);
            const cleared = clearFixedTeleportDestination(
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
            destination = safeTeleportDestination();
        }

        if (!destination) return true;
        const movement = moveHeroByTeleport(destination.x, destination.y);
        await finishTeleport(movement);
        return true;
    } finally {
        game._inTeleportTrap = false;
    }
}

async function triggerMagicTrap(trap) {
    trap.tseen = true;
    if (rn2(30) === 0) {
        const index = game.level.traps.indexOf(trap);
        if (index >= 0) game.level.traps.splice(index, 1);
        const damage = rnd(10);
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
        game.u.uenmax = (game.u.uenmax ?? 0) + 2;
        game.u.uen = game.u.uenmax;
        game.u.uenpeak = Math.max(game.u.uenpeak ?? 0, game.u.uenmax);
        newsym(trap.tx, trap.ty);
        await pline(
            'You are caught in a magical explosion!  Your body absorbs some of the magical energy!',
        );
        return;
    }

    const fate = rnd(20);
    if (fate === 11) {
        await plineWithContinuation('You hear a low hum.');
        const intrinsicInvisible = hasInternalInvisibility(game);
        const otherInvisible = !!(
            game.u?.extrinsicInvisible || game.u?.formInvisible
            || hasInvokedProperty('invisible', game)
        );
        const currentlyInvisible = intrinsicInvisible || otherInvisible;
        if (!currentlyInvisible) {
            if (!game.blind) {
                await plineWithContinuation(
                    game.u?.seeInvisible || game.u?.see_invisible
                        ? 'Gee!  All of a sudden, you can see right through yourself.'
                        : "Gee!  All of a sudden, you can't see yourself.",
                );
            }
        } else if (!otherInvisible) {
            if (!game.blind) {
                await plineWithContinuation(
                    game.u?.seeInvisible || game.u?.see_invisible
                        ? "You can't see through yourself anymore."
                        : 'You can see yourself again!',
                );
            }
        } else {
            await plineWithContinuation(
                `You feel a little more ${
                    intrinsicInvisible ? 'obvious' : 'hidden'
                } now.`,
            );
        }
        const nextIntrinsic = !intrinsicInvisible;
        game.u.intrinsicInvisible = nextIntrinsic;
        if (!nextIntrinsic) game.u.invisibleTurns = 0;
        syncHeroInvisibility(game);
        newsym(game.u.ux, game.u.uy);
        return;
    }
    const message = fate === 13
        ? 'A shiver runs up and down your spine!'
        : fate === 14 ? 'You hear distant howling.'
            : fate === 15 ? 'You suddenly yearn for your distant homeland.'
                : fate === 16 ? 'Your pack shakes violently!'
                    : fate === 17 ? 'You smell charred flesh.'
                        : fate === 18 ? 'You feel tired.' : null;
    if (message) await pline(message);
}

async function triggerProjectileTrap(trap) {
    const hero = game.u;
    const blind = !!game.blind || heroIsBlind(game);
    const deaf = !!game.deaf || heroIsDeaf(game);
    const arrowTrap = trap.ttyp === ARROW_TRAP;
    const objectType = arrowTrap ? ARROW : DART;
    const noun = arrowTrap ? 'arrow' : 'little dart';
    const subject = arrowTrap ? 'An arrow' : 'A little dart';
    const attackLevel = arrowTrap ? 8 : 7;

    if (trap.once && trap.tseen && rn2(15) === 0) {
        if (!deaf) {
            await plineWithContinuation(
                arrowTrap ? 'You hear a loud click!' : 'You hear a soft click.',
            );
        }
        const trapIndex = game.level.traps.indexOf(trap);
        if (trapIndex >= 0) game.level.traps.splice(trapIndex, 1);
        newsym(trap.tx, trap.ty);
        return;
    }

    trap.once = true;
    trap.tseen = true;
    await plineWithContinuation(`${subject} shoots out at you!`);

    const missile = makeTrapMissile(objectType, trap);
    if (!arrowTrap && rn2(6) === 0) missile.opoisoned = 1;
    const damage = physicalDamage(
        rollPhysicalWeaponDamageAgainstHero(missile, game),
    );
    const mortality = hero.umortality || 0;
    const hit = await hitHeroWithObject(missile, damage, attackLevel, {
        name: noun, killer: noun,
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
        deleteObject(missile, game);
        return;
    }

    place_object(missile, trap.tx, trap.ty);
    if (!blind) recordObjectEncounter(objectType, game);
    stack_object(missile, game);
    newsym(trap.tx, trap.ty);
}

async function triggerSqueakyBoard(
    trap,
    { viaSitting = false, failedUntrap = false } = {},
) {
    const hero = game.u;
    const blind = !!game.blind || heroIsBlind(game);
    const deaf = !!game.deaf || heroIsDeaf(game);
    const flying = !!(hero.flying || game.flying);
    const airborne = !!(hero.levitating || game.levitating || flying);
    const forced = failedUntrap || (flying && viaSitting);
    if (airborne && !forced) {
        if (!blind) {
            trap.tseen = true;
            const hallucinating = !!(hero.hallucinating
                || (hero.hallucinationTurns ?? 0) > 0);
            await plineWithContinuation(hallucinating
                ? 'You notice a crease in the linoleum.'
                : 'You notice a loose board below you.');
        }
        return;
    }

    trap.tseen = true;
    await plineWithContinuation(deaf
        ? 'A board beneath you vibrates.'
        : `A board beneath you squeaks ${
            squeakyBoardNoteWithArticle(trap.tnote) || 'a note'
        } loudly.`);
    wakeMonstersNear(hero.ux, hero.uy, 40, game);
}

function heroPassesRocks() {
    const flags = heroFormFlags();
    return !!(flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
}

async function triggerFallingRockTrap(trap) {
    const hero = game.u;
    const ceiling = ceilingName(hero.ux, hero.uy, game);
    if (trap.once && trap.tseen && rn2(15) === 0) {
        await plineWithContinuation(
            `A trap door in the ${ceiling} opens, but nothing falls out!`,
        );
        const trapIndex = game.level.traps.indexOf(trap);
        if (trapIndex >= 0) game.level.traps.splice(trapIndex, 1);
        newsym(hero.ux, hero.uy);
        return;
    }

    let damage = d(2, 6);
    trap.once = true;
    trap.tseen = true;
    const rock = makeTrapMissile(ROCK, trap);
    place_object(rock, hero.ux, hero.uy);
    await plineWithContinuation(
        `A trap door in the ${ceiling} opens and ${
            simpleObjectNameWithArticle(rock)
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
            const name = helmet.name || OBJECT_NAMES[helmet.otyp] || 'helmet';
            await plineWithContinuation(`Your ${name} does not protect you.`);
        }
    } else if (heroPassesRocks()) {
        await plineWithContinuation('It passes harmlessly through you.');
        harmless = true;
    }

    if (!(game.blind || heroIsBlind(game)))
        recordObjectEncounter(ROCK, game);
    stack_object(rock, game);
    newsym(hero.ux, hero.uy);
    if (!harmless) {
        losePhysicalHitPoints(damage);
        exerciseAttribute(A_STR, false);
    }
}

async function triggerSleepingGasTrap(trap) {
    const hero = game.u;
    trap.tseen = true;
    const breathless = !!hero.breathless
        || !!(heroFormFlags() & M1_BREATHLESS);
    if (hero.sleepResistance || hero.sleep_resistance || breathless) {
        await plineWithContinuation('You are enveloped in a cloud of gas!');
        monstersObserveHeroResistance(M_SEEN_SLEEP, game);
    } else {
        await plineWithContinuation('A cloud of gas puts you to sleep!');
        putHeroToSleep(rnd(25), { state: game });
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

function boulderAt(x, y) {
    return game.level?.objects?.[x]?.[y]
        ?.find(object => object.otyp === BOULDER) ?? null;
}

export async function animateRollingBoulderCell(
    boulder, glyph, x, y, previous,
) {
    if (previous) newsym(previous.x, previous.y);
    if (!cansee(x, y)) return null;

    show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, glyph.attr);
    // Keep the animation cursor after the last map cell the display changed.
    const frameCursor = previous
        ? lastDirtyMapCursor() ?? [x, y + 1]
        : [x, y + 1];
    for (let delay = 0; delay < 2; delay++) {
        await flush_screen(1);
        game.nhDisplay?.setCursor(...frameCursor);
        await game.animationFrame?.();
    }
    return { x, y };
}

async function triggerRollingBoulderTrap(trap) {
    const wasKnown = !!trap.tseen;
    map_trap(trap, false);
    newsym(trap.tx, trap.ty);

    const click = game.u?.deaf ? '' : 'Click!  ';
    await pline(`${click}You trigger a rolling boulder trap!`);

    let start = { ...trap.launch };
    let finish = { ...(trap.launch2 || trap.launch) };
    let boulder = boulderAt(start.x, start.y);
    if (!boulder) {
        boulder = boulderAt(finish.x, finish.y);
        if (boulder) [start, finish] = [finish, start];
    }
    if (!boulder) {
        await plineWithContinuation(wasKnown
            ? 'No boulder was released.'
            : 'Fortunately for you, no boulder was released.');
        return;
    }

    remove_object(boulder);
    newsym(start.x, start.y);
    const glyph = transientObjectGlyph(boulder);
    const dx = Math.sign(finish.x - start.x);
    const dy = Math.sign(finish.y - start.y);
    let remaining = distmin(start.x, start.y, finish.x, finish.y);
    let x = start.x;
    let y = start.y;
    let transient = null;

    while (remaining-- > 0) {
        transient = await animateRollingBoulderCell(
            boulder, glyph, x, y, transient,
        );
        x += dx;
        y += dy;

        if (game.u?.ux === x && game.u?.uy === y) {
            const damage = rnd(OBJECT_SMALL_DAMAGE[BOULDER] || 1);
            const dieroll = rnd(20);
            const threshold = (game.u?.uac ?? 10) + 9
                + (boulder.spe ?? 0);
            if (threshold <= dieroll) {
                const miss = game.blind || game.flags?.verbose === false
                    ? 'It misses.'
                    : threshold <= dieroll - 2
                        ? 'A boulder misses you.'
                        : 'You are almost hit by a boulder.';
                await plineWithContinuation(miss);
            } else {
                const punctuation = damage <= 4 ? '.' : '!';
                await plineWithContinuation(
                    game.blind || game.flags?.verbose === false
                        ? `You are hit${punctuation}`
                        : `You are hit by a boulder${punctuation}`,
                );
                game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
            }
        }
    }

    if (transient) newsym(transient.x, transient.y);
    place_object(boulder, finish.x, finish.y);
    newsym(finish.x, finish.y);
}

async function triggerBearTrap(trap, { failedUntrap = false } = {}) {
    const hero = game.u;
    if (!failedUntrap && (hero.levitating || game.levitating
        || hero.flying || game.flying)) return;
    const damage = d(2, 4);
    const previousCapacity = game._encumbranceLevel ?? nearCapacity(game);
    trap.tseen = true;
    hero.utrap = 4 + rn2(4);
    hero.utraptype = TT_BEARTRAP;
    refreshMovementProperties(game);

    await pline('A bear trap closes on your foot!');

    const legSide = rn2(2) ? 'right' : 'left';
    const legTurns = 10 + rn2(10);
    woundHeroLegs(legSide, legTurns);

    const currentCapacity = nearCapacity(game);
    const capacityMessage = encumbranceMessage(
        previousCapacity, currentCapacity,
    );
    game._encumbranceLevel = currentCapacity;
    hero._encumbrance = encumbranceLabel(currentCapacity);
    game._capacityDirty = false;
    if (capacityMessage) await plineWithContinuation(capacityMessage);

    hero.uhp = Math.max(0, (hero.uhp || 0) - damage);
    exerciseAttribute(A_DEX, false);
}

function rustTargetName(object, fallback) {
    return object?.name || OBJECT_NAMES[object?.otyp] || fallback;
}

async function wetHeroObject(object, description) {
    const messages = [];
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

async function triggerRustTrap(trap) {
    const hero = game.u;
    trap.tseen = true;
    const target = rn2(5);

    if (target === 0) {
        await plineWithContinuation(
            `A gush of water hits you on the ${heroHeadName(game)}!`,
        );
        const helmet = heroObject('uarmh');
        await wetHeroObject(
            helmet, rustTargetName(helmet, 'helmet'),
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
            await wetHeroObject(
                weapon, rustTargetName(weapon, 'weapon'),
            );
            const gloves = heroObject('uarmg');
            await wetHeroObject(
                gloves, rustTargetName(gloves, 'gloves'),
            );
        }
    } else if (target === 2) {
        await plineWithContinuation(
            `A gush of water hits your right ${heroArmName(game)}!`,
        );
        const weapon = heroObject('uwep');
        await wetHeroObject(
            weapon, rustTargetName(weapon, 'weapon'),
        );
        const gloves = heroObject('uarmg');
        await wetHeroObject(
            gloves, rustTargetName(gloves, 'gloves'),
        );
    } else {
        await plineWithContinuation('A gush of water hits you!');
        for (const object of game.inventory || []) {
            if (!object.lamplit || object === heroObject('uwep')) continue;
            if (hero.twoweap && object === heroObject('uswapwep')) continue;
            const messages = [];
            splashLitObject(object, messages, game);
            for (const message of messages)
                await plineWithContinuation(message);
        }
        const cloak = heroObject('uarmc');
        const suit = heroObject('uarm');
        const shirt = heroObject('uarmu');
        const torso = cloak || suit || shirt;
        const fallback = cloak ? 'cloak' : shirt ? 'shirt' : 'armor';
        await wetHeroObject(
            torso, rustTargetName(torso, fallback),
        );
    }

    if (heroIsPolymorphed(game) && hero.umonnum === PM_IRON_GOLEM) {
        await rustIronGolemHero();
    } else if (heroIsPolymorphed(game) && hero.umonnum === PM_GREMLIN
        && rn2(3) !== 0) {
        const clone = await splitHeroMonsterForm(game);
        if (clone) await plineWithContinuation('You multiply!');
    }
}

export async function prepareHoleFall(trap) {
    if (!trap || (trap.ttyp !== HOLE && trap.ttyp !== TRAPDOOR)) return null;
    if (!canFallThrough(game.u?.uz)) {
        trap.tseen = true;
        return null;
    }

    const sokoban = !!game.level?.flags?.sokoban_rules;
    const levitating = !!(game.u?.levitating || game.levitating);
    if (game.blind && levitating && !sokoban) return null;

    trap.tseen = true;
    await pline(trap.ttyp === TRAPDOOR
        ? 'A trap door opens up under you!'
        : "There's a gaping hole under you!");

    const form = heroMonsterForm();
    const clinging = !!(heroFormFlags() & M1_CLING);
    const tooLarge = Number.isInteger(form)
        && (MONSTER_SIZE[form] ?? 0) >= MZ_HUGE;
    const avoidsFall = !sokoban && (
        levitating || game.u?.flying || game.flying || clinging
        || game.u?.ustuck
    );
    if (avoidsFall || tooLarge) {
        await pline(tooLarge ? "You don't fit through." : "You don't fall in.");
        return null;
    }

    const current = game.u?.uz || { dnum: 0, dlevel: 1 };
    const bottom = game.dungeons?.[current.dnum]?.num_dunlevs
        ?? current.dlevel + 1;
    const destination = {
        dnum: trap.dst?.dnum ?? current.dnum,
        dlevel: Math.min(
            trap.dst?.dlevel ?? current.dlevel + 1,
            bottom,
        ),
    };
    return { destination, arrival: 'falling' };
}

export async function triggerHeroTrap(trap, {
    finishTeleport = null,
    gotoLevel = null,
    viaSitting = false,
    failedUntrap = false,
} = {}) {
    if (!trap) return false;
    stopRun();
    switch (trap.ttyp) {
    case HOLE:
    case TRAPDOOR: {
        const fall = await prepareHoleFall(trap);
        if (!fall || !gotoLevel) break;
        await gotoLevel(fall.destination, { arrival: fall.arrival });
        return true;
    }
    case TELEP_TRAP:
        return triggerTeleportTrap(trap, finishTeleport);
    case ARROW_TRAP:
    case DART_TRAP:
        await triggerProjectileTrap(trap);
        break;
    case SQKY_BOARD:
        await triggerSqueakyBoard(trap, { viaSitting, failedUntrap });
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
        await triggerBearTrap(trap, { failedUntrap });
        break;
    case FIRE_TRAP:
        await triggerHeroFireTrap(trap);
        break;
    case MAGIC_PORTAL:
        trap.tseen = true;
        releaseBuriedBallForLevelChange();
        return activateMagicPortal(trap, gotoLevel);
    case MAGIC_TRAP:
        await triggerMagicTrap(trap);
        break;
    case PIT:
    case SPIKED_PIT:
        await triggerPit(trap, { viaSitting, failedUntrap });
        break;
    case WEB:
        await triggerWeb(trap, { viaSitting, failedUntrap });
        break;
    case STATUE_TRAP:
        await activateStatueTrapAt(trap.tx, trap.ty);
        break;
    case LANDMINE:
        await triggerLandmine(trap, { failedUntrap });
        break;
    case VIBRATING_SQUARE:
        revealVibratingSquare(trap);
        break;
    }
    return false;
}

export async function triggerHeroTrapAt(x, y, options = {}) {
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    return triggerHeroTrap(trap, options);
}
