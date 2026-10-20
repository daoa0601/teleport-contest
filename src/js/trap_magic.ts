import { trapName } from './trap_name.js';
import type { Hero } from './hero_types.js';
import type { Trap } from './map_types.js';

export interface TrapMagicResult { changed: boolean; noticed: boolean; heroDied: boolean; }
type TrapTarget = Hero | Monster;
import type { GameState, PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { requirePlayingGame } from './gstate.js';
// Magic releases and activates traps without removing them.
// C trap.c:openholdingtrap(), closeholdingtrap(), openfallingtrap().

import { game, requireLiveGame } from './gstate.js';
import {
    BEAR_TRAP, HOLE, ROCKTRAP, TRAPDOOR, WEB, is_pit,
    TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB,
} from './const.js';
import { canSpotMonster, plineWithContinuation } from './display.js';
import { triggerHeroTrap } from './hero_traps.js';
import { resetHeroTrap } from './terrain_movement.js';
import { gotoLevel } from './level_change.js';
import { triggerImmediateMonsterTrap, finishImmediateMonsterTrap } from './monmove.js';
import { wakeMonster } from './monster_anger.js';
import { monsterName } from './monster_name.js';
import { rewardMonsterRescue } from './untrap.js';
import { rn2 } from './rng.js';
import { cansee, vision_recalc } from './vision.js';

function targetTrap(target: TrapTarget, state: PlayingGameState) {
    const hero = target === state.u || target === state.u.usteed;
    if (!hero && !('mnum' in target)) throw new TypeError('Trap magic requires the live hero or a monster.');
    const x = 'mnum' in target && !hero ? target.mx : state.u.ux;
    const y = 'mnum' in target && !hero ? target.my : state.u.uy;
    return { hero, trap: state.level.traps.find(t => t.tx === x && t.ty === y) };
}
function result(changed: boolean, noticed: boolean, state: GameState): TrapMagicResult {
    return { changed, noticed, heroDied: !!state.program_state.gameover };
}

export async function openHoldingTrap(target: TrapTarget | null | undefined, { state = game }: { state?: GameState } = {}): Promise<TrapMagicResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!target) return result(false, false, state);
    const { hero, trap } = targetTrap(target, state);
    let description;
    let owner;
    if (hero && state.u.utrap) {
        description = new Map([
            [TT_LAVA, 'molten lava'], [TT_INFLOOR, 'ground'],
            [TT_BURIEDBALL, 'your anchor'], [TT_BEARTRAP, 'bear trap'],
            [TT_PIT, 'pit'], [TT_WEB, 'web'],
        ]).get(state.u.utraptype ?? 0) || 'trap';
        owner = state.u.utraptype === TT_BURIEDBALL ? ''
            : trap?.tseen && trap.madeby_u ? 'your ' : 'the ';
    } else {
        if (!trap || ![BEAR_TRAP, WEB].includes(trap.ttyp))
            return result(false, false, state);
        description = trapName(trap.ttyp, { state });
        owner = trap.tseen ? trap.madeby_u ? 'your ' : 'the '
            : /^[aeiou]/i.test(description) ? 'an ' : 'a ';
    }
    if (hero) {
        if (!state.u.utrap) return result(false, false, state);
        const steed = state.u.usteed;
        const subject = !steed ? 'You are'
            : state.u.utraptype === TT_BURIEDBALL
                ? `You and ${monsterName(steed, { article: 'your', state })} are`
                : `${monsterName(steed, { capitalized: true, suppressIt: true, state })} is`;
        // Native prints before reset_utrap(), which can announce levitation.
        await plineWithContinuation(`${subject} released from ${owner}${description}.`);
        state.vision_full_recalc = 1;
        await resetHeroTrap(true, state);
        if (state.vision_full_recalc) vision_recalc(0);
        return result(true, true, state);
    }
    if (!('mnum' in target) || !trap) throw new Error('Monster trap release requires a trapped monster.');
    if (!target.mtrapped) return result(false, false, state);
    target.mtrapped = 0;
    let noticed = false;
    if (canSpotMonster(target)) {
        noticed = true;
        await plineWithContinuation(`${monsterName(target, { capitalized: true, state })} is released from ${owner}${description}.`);
    } else if (trap.tseen && cansee(trap.tx, trap.ty)) {
        noticed = true;
        const text = trap.ttyp === WEB ? `Something is released from ${owner}${description}.`
            : `${owner.charAt(0).toUpperCase()}${owner.slice(1)}${description} opens.`;
        await plineWithContinuation(text);
    }
    if (rn2(2) && Math.max(Math.abs(target.mx - state.u.ux),
        Math.abs(target.my - state.u.uy)) <= 1)
        await rewardMonsterRescue(trap, target, { state });
    return result(true, noticed, state);
}

export async function closeHoldingTrap(target: TrapTarget | null | undefined, { state = game }: { state?: GameState } = {}): Promise<TrapMagicResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!target) return result(false, false, state);
    const { hero, trap } = targetTrap(target, state);
    if (!trap || ![BEAR_TRAP, WEB].includes(trap.ttyp))
        return result(false, false, state);
    return activateTrap(target, hero, trap, state, false);
}

export async function openFallingTrap(target: TrapTarget | null | undefined, {
    trapdoorOnly = false, state = game,
}: { trapdoorOnly?: boolean; state?: GameState } = {}): Promise<TrapMagicResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!target) return result(false, false, state);
    const { hero, trap } = targetTrap(target, state);
    if (!trap || (![TRAPDOOR, ROCKTRAP].includes(trap.ttyp)
        && (trapdoorOnly || (trap.ttyp !== HOLE && !is_pit(trap.ttyp)))))
        return result(false, false, state);
    return activateTrap(target, hero, trap, state, true);
}

async function activateTrap(target: TrapTarget, hero: boolean, trap: Trap, state: PlayingGameState, falling: boolean): Promise<TrapMagicResult> {
    if (hero) {
        if (state.u.utrap) return result(false, false, state);
        await triggerHeroTrap(trap, {
            forceTrap: true, noWebMessage: !falling && !!state.u.usteed, gotoLevel,
        });
        return result(!!state.u.utrap, true, state);
    }
    if (!('mnum' in target)) throw new Error('Monster trap activation requires a monster.');
    if (target.mtrapped) return result(false, false, state);
    const noticed = cansee(trap.tx, trap.ty) || canSpotMonster(target);
    if (falling && (await wakeMonster(target, { attacked: true })).heroDied)
        return result(false, noticed, state);
    const action = await triggerImmediateMonsterTrap(target, state, { force: true });
    await finishImmediateMonsterTrap(action, state);
    // Native mintrap's nonzero results are caught, dead, or moved.
    const changed = !!target.mtrapped || (target.mhp ?? 1) <= 0
        || action.movement.actorLeftLevel || action.movement.actorDied
        || action.movement.moved;
    return result(!!changed, noticed, state);
}
