// Trap effects on the hero.
// C refs: trap.c dotrap(), trapeffect_*(), launch_obj(), and teleport.c
// tele_trap().

import {
    adjustAttribute, currentAttribute, exerciseAttribute,
} from './attrib.js';
import {
    A_CON, A_DEX, A_STR, BEAR_TRAP, DART_TRAP, LANDMINE, MAGIC_TRAP, PIT,
    ROLLING_BOULDER_TRAP, SPIKED_PIT, TELEP_TRAP, TT_BEARTRAP, TT_PIT,
    TT_WEB, VAULT, WEB, isok,
} from './const.js';
import {
    flush_screen, lastDirtyMapCursor, map_trap, newsym, pline,
    plineWithContinuation, shieldeff, show_glyph_cell,
    transientObjectGlyph,
} from './display.js';
import { game } from './gstate.js';
import { distmin } from './hacklib.js';
import { mksobj, place_object, remove_object } from './mklev.js';
import { somexyspace } from './mkroom.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import {
    BOULDER, DART, OBJECT_MATERIAL, OBJECT_SMALL_DAMAGE,
} from './object_data.js';
import { d, rn2, rnd } from './rng.js';
import { stopRun } from './runmode.js';
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

const M1_CLING = 0x00000010;
const PM_CAVE_SPIDER = 94;
const PM_GIANT_SPIDER = 96;
const IRON = 11;

function heroMonsterForm() {
    return Number.isInteger(game.u?.umonnum) ? game.u.umonnum : null;
}

function loseHitPoints(amount) {
    game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - amount);
}

function losePhysicalHitPoints(amount) {
    if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
        amount = Math.trunc((amount + 1) / 2);
    loseHitPoints(amount);
}

function heroWearsIronShoes() {
    const boots = game.uarmf || game.u?.uarmf;
    return !!boots && OBJECT_MATERIAL[boots.otyp] === IRON;
}

async function applySpikePoison() {
    if (rn2(6) !== 0) return;
    await plineWithContinuation('The spikes were poisoned!');
    if (game.u?.poisonResistance || game.u?.poison_resistance) {
        await plineWithContinuation("The poison doesn't seem to affect you.");
        return;
    }
    const outcome = rn2(8);
    if (outcome === 0) {
        const loss = 6 + d(4, 6);
        if ((game.u.uhp ?? 1) <= loss) {
            game.u.uhp = 0;
            await plineWithContinuation('The poison was deadly...');
            return;
        }
        const minimumMaximumHitPoints = Math.max(game.u.ulevel ?? 1, 3);
        game.u.uhpmax = Math.max(
            minimumMaximumHitPoints,
            (game.u.uhpmax ?? 1) - Math.trunc(loss / 2),
        );
        loseHitPoints(loss);
        adjustAttribute(A_CON, -1, game);
        adjustAttribute(A_STR, -3, game);
    } else if (outcome > 5) {
        loseHitPoints(rn2(10) + 6);
    } else {
        adjustAttribute(A_STR, -d(2, 2), game);
    }
}

async function triggerPit(trap, { viaSitting = false } = {}) {
    const hero = game.u;
    const formFlags = MONSTER_FLAGS1[heroMonsterForm()] ?? 0;
    if (hero.levitating || game.levitating
        || ((hero.flying || game.flying) && !viaSitting)) return;
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
    losePhysicalHitPoints(spiked ? rnd(10) : rnd(6));
    if (spiked) await applySpikePoison();
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

async function triggerWeb(trap, { viaSitting = false } = {}) {
    const hero = game.u;
    trap.tseen = true;
    const form = heroMonsterForm();
    if (form === PM_CAVE_SPIDER || form === PM_GIANT_SPIDER) {
        await plineWithContinuation(trap.madeby_u
            ? 'You take a walk on your web.'
            : 'There is a spider web here.');
        return;
    }
    await plineWithContinuation(viaSitting
        ? 'You are caught by a spider web!'
        : 'You stumble into a spider web!');
    const turns = webTrapDuration();
    hero.utrap = turns;
    hero.utraptype = TT_WEB;
    if (!turns) {
        await plineWithContinuation('You tear through the web!');
        const index = game.level.traps.indexOf(trap);
        if (index >= 0) game.level.traps.splice(index, 1);
        newsym(hero.ux, hero.uy);
    }
}

async function triggerLandmine(trap) {
    const hero = game.u;
    let damage = rnd(16);
    if (heroWearsIronShoes()) damage = Math.trunc((damage + 3) / 4);
    const airborne = hero.levitating || game.levitating
        || hero.flying || game.flying;
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
            'KAABLAMM!!!  You triggered a land mine!',
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
    await triggerPit(trap);
    newsym(hero.ux, hero.uy);
}

async function triggerTeleportTrap(trap, finishTeleport) {
    trap.tseen = true;
    if (game._inTeleportTrap) return false;
    if (typeof finishTeleport !== 'function')
        throw new TypeError('teleport trap needs an arrival handler');

    game._inTeleportTrap = true;
    stopRun();
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
    stopRun();
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
        const intrinsicInvisible = !!(
            game.u?.intrinsicInvisible
            ?? game.u?.invisible
            ?? game.u?.invis
        );
        const otherInvisible = !!(
            game.u?.extrinsicInvisible || game.u?.formInvisible
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
        game.u.invisible = nextIntrinsic || otherInvisible;
        game.u.invis = game.u.invisible;
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

async function triggerDartTrap(trap) {
    const hero = game.u;
    trap.once = true;
    trap.tseen = true;
    stopRun();

    const dart = mksobj(DART, true, false);
    dart.quan = dart.quantity = 1;
    dart.owt = 1;
    dart.opoisoned = rn2(6) === 0 ? 1 : 0;
    dart.ox = trap.tx;
    dart.oy = trap.ty;
    const damage = rnd(3) + (dart.spe ?? 0);
    const dieroll = rnd(20);
    const hit = (hero.uac ?? 10) + 7 > dieroll;
    if (hit) {
        hero.uhp = Math.max(0, (hero.uhp ?? 1) - damage);
        exerciseAttribute(A_STR, false);
        const punctuation = damage <= 4 ? '.' : '!';
        game._pending_message = 'A little dart shoots out at you!  '
            + `You are hit by a little dart${punctuation}`;
        return;
    }

    place_object(dart, trap.tx, trap.ty);
    newsym(trap.tx, trap.ty);
    game._pending_message = dieroll - ((hero.uac ?? 10) + 7) < 2
        ? 'A little dart shoots out at you!  You are almost hit by a little dart.'
        : 'A little dart shoots out at you!  A little dart misses you.';
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
    stopRun();

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

async function triggerBearTrap(trap) {
    const hero = game.u;
    const damage = d(2, 4);
    const previousCapacity = game._encumbranceLevel ?? nearCapacity(game);
    trap.tseen = true;
    hero.utrap = 4 + rn2(4);
    hero.utraptype = TT_BEARTRAP;
    stopRun();

    await pline('A bear trap closes on your foot!');

    const legSide = rn2(2) ? 'right' : 'left';
    const legTurns = 10 + rn2(10);
    const wasWounded = (hero._woundedLegTurns ?? 0) > 0;
    hero._woundedLegTurns = Math.max(
        hero._woundedLegTurns ?? 0, legTurns,
    );
    if (!hero._woundedLegSide) hero._woundedLegSide = legSide;
    else if (hero._woundedLegSide !== legSide)
        hero._woundedLegSide = 'both';
    if (!wasWounded && hero.acurr?.a) hero.acurr.a[A_DEX]--;

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

export async function triggerHeroTrap(trap, {
    finishTeleport = null,
    viaSitting = false,
} = {}) {
    if (!trap) return false;
    switch (trap.ttyp) {
    case TELEP_TRAP:
        return triggerTeleportTrap(trap, finishTeleport);
    case DART_TRAP:
        await triggerDartTrap(trap);
        break;
    case ROLLING_BOULDER_TRAP:
        await triggerRollingBoulderTrap(trap);
        break;
    case BEAR_TRAP:
        await triggerBearTrap(trap);
        break;
    case MAGIC_TRAP:
        await triggerMagicTrap(trap);
        break;
    case PIT:
    case SPIKED_PIT:
        await triggerPit(trap, { viaSitting });
        break;
    case WEB:
        await triggerWeb(trap, { viaSitting });
        break;
    case LANDMINE:
        await triggerLandmine(trap);
        break;
    }
    return false;
}

export async function triggerHeroTrapAt(x, y, options = {}) {
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    return triggerHeroTrap(trap, options);
}
