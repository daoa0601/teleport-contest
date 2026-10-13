// C apply.c:jump(), is_valid_jump_pos(), and check_jump().
import {
    ACCESSIBLE, A_STR, D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, IS_STWALL,
    Is_airlevel, Is_waterlevel, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR,
    TT_LAVA, TT_PIT, TT_WEB, isok,
} from './const.js';
import { currentAttribute } from './attrib.js';
import { heroLegName } from './body_parts.js';
import { farlookLocationDescription } from './cmd.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { impossible } from './diagnostics.js';
import { bot, newsym, redrawMap, plineWithContinuation } from './display.js';
import { selectMapPosition, shouldShowGetposTip, showGetposTip } from './getpos.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Position, MapLocation } from './map_types.js';

export interface JumpResult {
    spentTime: boolean;
    heroDied: boolean;
}

interface JumpAdmission {
    spentTime?: boolean;
    message: string | null;
}
import { loseHeroHp } from './hero_damage.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { hurtleJumpTo } from './hero_hurtle.js';
import { woundHeroLegs } from './hero_legs.js';
import { heroPassesWalls, heroSpecies } from './hero_species.js';
import { triggerHeroTrap } from './hero_traps.js';
import { spendHeroNutrition } from './hunger.js';
import { announceInvocationSquare } from './invocation.js';
import { gotoLevel } from './level_change.js';
import { finishDestinationSpotEffects, finishTeleportArrival } from './location_effects.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2 } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { makePlural } from './object_grammar.js';
import { BOULDER, SPE_JUMPING } from './object_data.js';
import { walkPathCells } from './path_walk.js';
import { propertyIsActive } from './properties.js';
import { rn1, rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { castSpell, knownSpell } from './spell.js';
import { stuckSteed } from './steed.js';
import { resetHeroTrap } from './terrain_movement.js';
import { moveHeroByTeleport } from './teleport.js';
import { deleteTrap } from './trap_lifecycle.js';
import { cansee, vision_recalc } from './vision.js';
import { nearCapacity } from './weight.js';

const ANY = 0, HORIZONTAL = 1, VERTICAL = 2, DIAGONAL = 3;

function jumpResult(spentTime: boolean, state: GameState): JumpResult {
    return { spentTime, heroDied: !!state.program_state.gameover };
}

function jumpRestriction(x: number, y: number, magic: number, state: PlayingGameState): string | null {
    const hero = state.u;
    const dx = x - hero.ux, dy = y - hero.uy;
    const distance = dx * dx + dy * dy;
    // Permanent intrinsic jumping is the limited knight's move. Timed,
    // form, and equipment sources permit the ordinary physical range.
    const sources = hero._propertySources?.jumping;
    const versatile = (hero.jumpingTurns ?? 0) > 0
        || Object.keys(sources?.intrinsic || {}).some(origin =>
            !['role', 'experience', 'race', 'outside'].includes(origin))
        || (sources?.worn?.length ?? 0) > 0 || !!sources?.invoked
        || (sources?.carried?.length ?? 0) > 0;
    if (!magic && !versatile && distance !== 5) return 'Illegal move!';
    if (distance > (magic ? 6 + magic * 3 : 9)) return 'Too far!';
    if (!isok(x, y)) return 'You cannot jump there!';
    if (!cansee(x, y)) return 'You cannot see where to land!';

    const passesWalls = heroPassesWalls(state);
    const diagonal = magic || passesWalls || (!dx && !dy) ? ANY
        : !dy ? HORIZONTAL : !dx ? VERTICAL : DIAGONAL;
    let ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax >= 2 * ay) ay = 0;
    else if (ay >= 2 * ax) ax = 0;
    const trajectory = magic || passesWalls || (!ax && !ay) ? ANY
        : !ay ? HORIZONTAL : !ax ? VERTICAL : DIAGONAL;
    const blocksDoor = (location: MapLocation): boolean => location.typ === DOOR
        && !!(location.doormask & D_ISOPEN) && trajectory !== ANY
        && (trajectory === DIAGONAL
            || !!(trajectory & HORIZONTAL) === !!location.horizontal);
    if (diagonal === DIAGONAL && blocksDoor(state.level.requireAt(hero.ux, hero.uy)))
        return "You can't jump diagonally out of a doorway.";
    if (passesWalls) return null;
    const throwsRocks = !!((MONSTER_FLAGS2[heroSpecies(state)] ?? 0) & 0x08000000);
    for (const point of walkPathCells(hero.ux, hero.uy, x, y)) {
        const location = state.level.requireAt(point.x, point.y);
        const boulder = (state.level.objects[point.x]?.[point.y] || [])
            .some(object => object.otyp === BOULDER);
        if (IS_STWALL(location.typ) || blocksDoor(location)
            || (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)))
            || (boulder && !throwsRocks))
            return 'There is an obstacle preventing that jump.';
    }
    return null;
}

async function jumpAdmission(magic: number, state: PlayingGameState): Promise<JumpAdmission | null> {
    const hero = state.u;
    const flags = MONSTER_FLAGS1[heroSpecies(state)] || 0;
    if (!magic && ((flags & 0x6000) === 0x6000 || (flags & 0x80000)))
        return { message: "You can't jump; you have no legs!" };
    if (!magic && !propertyIsActive('jumping', state))
        return { message: "You can't jump very far." };
    if (!magic && hero.usteed && await stuckSteed(false, state))
        return { message: null };
    if (hero.uswallow) return { spentTime: !!magic, message: magic
        ? 'You bounce around a little.' : "You've got to be kidding!" };
    if (hero.uinwater) return { spentTime: !!magic, message: magic
        ? 'You swish around a little.' : 'This calls for swimming, not jumping!' };
    if (hero.ustuck) {
        const holder = hero.ustuck;
        if (holder.mtame && !propertyIsActive('conflict', state) && !holder.mconf) {
            hero.ustuck = null;
            return { spentTime: true, message: `You pull free from ${monsterName(holder)}.` };
        }
        return { spentTime: !!magic, message: magic
            ? `You writhe a little in the grasp of ${monsterName(holder)}!`
            : `You cannot escape from ${monsterName(holder)}!` };
    }
    if (propertyIsActive('levitation', state) || Is_airlevel(hero.uz) || Is_waterlevel(hero.uz))
        return { spentTime: !!magic, message: magic
            ? 'You flail around a little.' : "You don't have enough traction to jump." };
    if (!magic && nearCapacity(state) > 0)
        return { message: 'You are carrying too much to jump!' };
    if (!magic && ((hero.uhunger ?? 900) <= 100 || currentAttribute(A_STR, state) < 6))
        return { message: 'You lack the strength to jump!' };
    if (!magic && ((hero._woundedLegTurns ?? 0) > 0 || hero._woundedLegSide)) {
        if (hero.usteed)
            return { message: `${monsterName(hero.usteed, { capitalized: true })} is in no shape for jumping.` };
        const both = hero._woundedLegSide === 'both';
        const leg = both ? makePlural(heroLegName(state))
            : `${hero._woundedLegSide} ${heroLegName(state)}`;
        return { message: `Your ${leg} ${both ? 'are' : 'is'} in no shape for jumping.` };
    }
    if (hero.usteed && hero.utrap)
        return { message: `${monsterName(hero.usteed, { capitalized: true })} is stuck in a trap.` };
    return null;
}

async function escapeJumpTrap(target: Position, state: PlayingGameState): Promise<boolean> {
    const hero = state.u;
    if (hero.utraptype === undefined)
        throw new Error('Escaping a trap requires its trap type.');
    switch (hero.utraptype) {
    case TT_BEARTRAP: {
        const side = rn2(3) ? 'left' : 'right';
        await plineWithContinuation('You rip yourself free of the bear trap!  Ouch!');
        let damage = rnd(10);
        if (hero.halfPhysicalDamage)
            damage = Math.trunc((damage + 1) / 2);
        await loseHeroHp(damage, 'jumping out of a bear trap', { state });
        if (state.program_state.gameover) return false;
        await woundHeroLegs(side, rn1(1000, 500), state);
        break;
    }
    case TT_PIT:
        await plineWithContinuation('You leap from the pit!');
        break;
    case TT_WEB: {
        await plineWithContinuation('You tear the web apart as you pull yourself free!');
        const web = state.level.traps.find(trap => trap.tx === hero.ux && trap.ty === hero.uy);
        if (web) deleteTrap(web);
        break;
    }
    case TT_LAVA:
        await plineWithContinuation('You pull yourself above the lava!');
        target.x = hero.ux; target.y = hero.uy;
        break;
    case TT_BURIEDBALL:
    case TT_INFLOOR:
        await plineWithContinuation(`You strain your ${makePlural(heroLegName(state))}, but you're still ${hero.utraptype === TT_INFLOOR ? 'stuck in the floor' : 'attached to the buried ball'}.`);
        await woundHeroLegs('left', rn1(10, 11), state);
        await woundHeroLegs('right', rn1(10, 11), state);
        return false;
    default:
        await impossible(`Jumping out of strange trap (${hero.utraptype})?`, { state });
    }
    await resetHeroTrap(true, state);
    return true;
}

export async function jumpHero(magic = 0, { state = game }: { state?: GameState } = {}): Promise<JumpResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!magic && !propertyIsActive('jumping', state)
        && knownSpell(SPE_JUMPING, state) === 'fresh') {
        return castSpell(SPE_JUMPING, { state });
    }
    const admission = await jumpAdmission(magic, state);
    if (admission) {
        if (admission.message) await plineWithContinuation(admission.message);
        return jumpResult(!!admission.spentTime, state);
    }
    const valid = (x: number, y: number): boolean => isok(x, y)
        && (ACCESSIBLE(state.level.requireAt(x, y).typ) || heroPassesWalls(state))
        && !jumpRestriction(x, y, magic, state);
    await plineWithContinuation('Where do you want to jump?');
    const firstUse = shouldShowGetposTip();
    if (firstUse) await showGetposTip();
    const target = await selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy }, goal: 'the desired position',
        prompt: firstUse ? 'Move cursor to the desired position:'
            : state.flags.verbose ? "Where do you want to jump?  (For instructions type a '?')"
                : 'Where do you want to jump?',
        isValidLocation: valid,
        describe: async (x, y) => await farlookLocationDescription(x, y)
            + (valid(x, y) ? '' : ' (invalid target)'),
    });
    if (!target) return jumpResult(false, state);
    const refusal = jumpRestriction(target.x, target.y, magic, state);
    if (refusal) {
        await plineWithContinuation(refusal);
        return jumpResult(false, state);
    }
    const hero = state.u;
    if (hero.usteed && target.x === hero.ux && target.y === hero.uy) {
        await plineWithContinuation(`${monsterName(hero.usteed, { article: 'your', capitalized: true })} isn't capable of jumping in place.`);
        return jumpResult(false, state);
    }
    const wasTrapped = !!hero.utrap;
    if (wasTrapped && !await escapeJumpTrap(target, state)) return jumpResult(true, state);
    if (target.x === hero.ux && target.y === hero.uy) {
        if (wasTrapped) await spendHeroNutrition(rnd(10), { state });
        else {
            const trap = state.level.traps.find(trap => trap.tx === hero.ux && trap.ty === hero.uy);
            if (!trap) {
                await plineWithContinuation(heroIsHallucinating(state)
                    ? 'You hop up and down a bit.' : 'You decide not to jump after all.');
                return jumpResult(false, state);
            }
            await plineWithContinuation(`You jump up and ${propertyIsActive('flying', state) ? 'fly' : 'come'} back down.`);
            await triggerHeroTrap(trap, { forceTrap: true, tookPlunge: true,
                finishTeleport: finishTeleportArrival, gotoLevel });
        }
        return jumpResult(true, state);
    }
    const destination = await hurtleJumpTo(target.x, target.y, {
        finishTeleport: finishTeleportArrival, gotoLevel,
        finishMonsterDeath: (monster, { noCorpse = true } = {}) =>
            finishHeroMonsterKill(monster, monster.mx, monster.my, {
                showKillMessage: false, noCorpse, recordConduct: false,
            }),
    });
    if (state.program_state.gameover) return jumpResult(true, state);
    const movement = await moveHeroByTeleport(destination.x, destination.y, state);
    newsym(movement.oldx, movement.oldy);
    vision_recalc(0);
    await redrawMap();
    await bot();
    await finishDestinationSpotEffects({ ...movement,
        newx: movement.x, newy: movement.y, explicitAttempt: false });
    if (state.program_state.gameover) return jumpResult(true, state);
    await announceInvocationSquare();
    endVoluntaryMultiTurn(state);
    state._helplessTurns = 1;
    state._helplessReason = 'jumping around';
    state._helplessDoneMessage = '';
    await spendHeroNutrition(rnd(25), { state });
    return jumpResult(true, state);
}
