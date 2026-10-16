import { requirePlayingGame } from './gstate.js';
// C spell.c:throwspell(), skilled elemental spells, cast_chain_lightning().
import { exerciseAttribute } from './attrib.js';
import { farlookLocationDescription } from './cmd.js';
import { A_WIS, D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, DRAWBRIDGE_UP, EXPL_FIERY, EXPL_FROSTY, IS_STWALL, Is_waterlevel, LAVAPOOL, MOAT, POOL, SPACE_POS, ZAP_POS, isok, xdir, ydir, } from './const.js';
import { canSeeMonster, canSpotMonster, clearMessageWindow, flush_screen, map_invisible, plineWithContinuation, } from './display.js';
import { explode } from './explosion.js';
import { prepareMapPositionHighlights, selectMapPosition, shouldShowGetposTip, showGetposTip } from './getpos.js';
import { game, requireLiveGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import { wakeMonster } from './monster_anger.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { monsterHasShockResistance } from './monster_resistance.js';
import { SPE_CONE_OF_COLD, SPE_MAGIC_MISSILE } from './object_data.js';
import { walkPathCells } from './path_walk.js';
import { clearRayCells, paintRayCell } from './ray.js';
import { rnd, rn2Display } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { adjustSpellDamage } from './spell_damage.js';
import { cansee } from './vision.js';
import { hitMonsterWithRay } from './zap.js';
const CHAIN_LIGHTNING_LIMIT = 100;
const LIGHTNING_SPELL_TYPE = 15;
export async function castSkilledElementalSpell(pseudo, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!await chooseSpellCenter(state))
        return { targeted: false, heroDied: false };
    const center = { x: state.u.dx ?? 0, y: state.u.dy ?? 0 };
    const count = rnd(8) + 1;
    for (let blast = 0; blast < count; blast++) {
        if (!state.u.dx && !state.u.dy && !state.u.dz) {
            const effect = await zapHeroWithObject(pseudo, { ordinary: true, state });
            if (effect.heroDied)
                return { targeted: true, heroDied: true };
            if (effect.damage) {
                const cause = `zapped ${state.flags.female ? 'herself' : 'himself'} with a spell`;
                if (await loseHeroHp(effect.damage, cause, { state, deathCause: cause }))
                    return { targeted: true, heroDied: true };
            }
        }
        else {
            const damage = adjustSpellDamage(Math.trunc(state.u.ulevel / 2) + 1, state);
            await explode(state.u.dx ?? 0, state.u.dy ?? 0, pseudo.otyp - SPE_MAGIC_MISSILE + 10, damage, 0, pseudo.otyp === SPE_CONE_OF_COLD ? EXPL_FROSTY : EXPL_FIERY, { state });
        }
        if (state.program_state.gameover)
            return { targeted: true, heroDied: true };
        state.u.dx = center.x + rnd(3) - 2;
        state.u.dy = center.y + rnd(3) - 2;
        if (!isok(state.u.dx, state.u.dy) || !cansee(state.u.dx, state.u.dy)
            || IS_STWALL(state.level.at(state.u.dx, state.u.dy)?.typ ?? 0) || state.u.uswallow) {
            state.u.dx = center.x;
            state.u.dy = center.y;
        }
    }
    return { targeted: true, heroDied: false };
}
async function chooseSpellCenter(state) {
    if (state.u.uinwater) {
        await plineWithContinuation("You're joking!  In this weather?");
        return false;
    }
    if (Is_waterlevel(state.u.uz)) {
        await plineWithContinuation('You had better wait for the sun to come out.');
        return false;
    }
    const question = 'Where do you want to cast the spell?';
    await plineWithContinuation(question);
    const valid = (x, y) => Math.max(Math.abs(x - state.u.ux), Math.abs(y - state.u.uy)) <= 10
        && isok(x, y) && cansee(x, y) && !IS_STWALL(state.level.at(x, y)?.typ ?? 0);
    prepareMapPositionHighlights(valid);
    const firstUse = shouldShowGetposTip(state);
    if (firstUse)
        await showGetposTip(state);
    if (firstUse)
        await plineWithContinuation('Move cursor to the desired position:');
    const selected = await selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy },
        prompt: firstUse ? 'Move cursor to the desired position:'
            : state.flags.verbose ? `${question}  (For instructions type a '?')` : question,
        goal: 'the desired position',
        describe: farlookLocationDescription,
        isValidLocation: valid,
        highlightHero: false,
    });
    if (!selected)
        return false;
    clearMessageWindow();
    if (Math.max(Math.abs(selected.x - state.u.ux), Math.abs(selected.y - state.u.uy)) > 10) {
        await plineWithContinuation('The spell dissipates over the distance!');
        return false;
    }
    if (state.u.uswallow) {
        await plineWithContinuation('The spell is cut short!');
        await exerciseAttribute(A_WIS, false, state);
        state.u.dx = state.u.dy = 0;
        return true;
    }
    const monster = monsterAtPosition(state.level, selected.x, selected.y);
    const atHero = selected.x === state.u.ux && selected.y === state.u.uy;
    if ((!atHero && !cansee(selected.x, selected.y) && (!monster || !canSpotMonster(monster)))
        || IS_STWALL(state.level.at(selected.x, selected.y)?.typ ?? 0)) {
        await plineWithContinuation('Your mind fails to lock onto that location!');
        return false;
    }
    const center = { x: state.u.ux, y: state.u.uy };
    for (const step of walkPathCells(center.x, center.y, selected.x, selected.y)) {
        if (!isok(step.x, step.y))
            break;
        const location = state.level.at(step.x, step.y);
        if (!location || !ZAP_POS(location.typ)
            && !(location.typ === DOOR && (location.doormask & D_ISOPEN)))
            break;
        center.x = step.x;
        center.y = step.y;
    }
    state.u.dx = center.x;
    state.u.dy = center.y;
    return true;
}
export async function castChainLightning({ state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const displayedBeam = heroIsHallucinating(state) ? rn2Display(6) : 5;
    // The pinned source deliberately leaves this branch without damage.
    if (state.u.uswallow)
        return { heroDied: false };
    const queue = [];
    const painted = new Map();
    await flush_screen(0);
    try {
        for (let direction = 0; direction < 8; direction++)
            await propagateLightning(queue, painted, {
                direction, x: state.u.ux, y: state.u.uy, strength: 2,
            }, displayedBeam, state);
        await state.animationFrame?.();
        let head = 0;
        while (head < queue.length) {
            const layerEnd = queue.length;
            while (head < layerEnd) {
                const zap = queue[head++];
                if (!zap)
                    throw new Error('A pending lightning step is missing.');
                const monster = monsterAtPosition(state.level, zap.x, zap.y);
                if (monster) {
                    // Native uses the previous zap owner's bhitpos here,
                    // rather than this queue entry's coordinates.
                    state.notonhead = monster.mx !== state.bhitpos.x || monster.my !== state.bhitpos.y;
                    const damage = await hitMonsterWithRay(monster, LIGHTNING_SPELL_TYPE, 2, { state });
                    if (damage) {
                        if (monster.mhp <= 0) {
                            const death = await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my);
                            if (death.heroDied || state.program_state.gameover)
                                return { heroDied: true };
                        }
                        else {
                            await plineWithContinuation(`You shock ${monsterName(monster, { state })}${damage > 4 ? '!' : '.'}`);
                            if (!canSeeMonster(monster) && !state.notonhead)
                                map_invisible(zap.x, zap.y);
                        }
                    }
                    else if (canSeeMonster(monster)) {
                        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} resists.`);
                    }
                    if (monster.mhp > 0) {
                        const previousForcefight = state.context.forcefight ?? false;
                        state.context.forcefight = Number(previousForcefight) + 1;
                        try {
                            await wakeMonster(monster, { attacked: false });
                        }
                        finally {
                            state.context.forcefight = previousForcefight;
                        }
                    }
                }
                if (!zap.strength)
                    continue;
                const strength = zap.strength - 1;
                await propagateLightning(queue, painted, { ...zap, strength }, displayedBeam, state);
                const diagonalStrength = strength < 2 ? 0 : strength;
                if (strength >= 2 && state.u.uen > 0)
                    state.u.uen--;
                await propagateLightning(queue, painted, {
                    ...zap, strength: diagonalStrength, direction: (zap.direction + 7) % 8,
                }, displayedBeam, state);
                await propagateLightning(queue, painted, {
                    ...zap, strength: diagonalStrength, direction: (zap.direction + 1) % 8,
                }, displayedBeam, state);
            }
            await state.animationFrame?.();
        }
        await state.animationFrame?.();
        await state.animationFrame?.();
    }
    finally {
        if (!state.program_state.gameover)
            clearRayCells(painted);
    }
    return { heroDied: false };
}
async function propagateLightning(queue, painted, zap, displayedBeam, state) {
    const dx = xdir[zap.direction], dy = ydir[zap.direction];
    if (dx === undefined || dy === undefined)
        throw new RangeError(`Invalid lightning direction ${zap.direction}`);
    const x = zap.x + dx;
    const y = zap.y + dy;
    if (queue.length >= CHAIN_LIGHTNING_LIMIT || !isok(x, y))
        return;
    const location = state.level.at(x, y);
    const open = location && (SPACE_POS(location.typ)
        || [POOL, MOAT, DRAWBRIDGE_UP, LAVAPOOL].includes(location.typ)
        || location.typ === DOOR && !(location.doormask & (D_CLOSED | D_LOCKED)));
    if (!open)
        return;
    const monster = monsterAtPosition(state.level, x, y);
    if (monster?.mpeaceful)
        return;
    const strength = monster ? monsterHasShockResistance(monster) ? 0 : 3 : zap.strength;
    if (!monster && !strength)
        return;
    if (queue.some(queued => queued.x === x && queued.y === y))
        return;
    queue.push({ direction: zap.direction, x, y, strength });
    if (cansee(x, y)) {
        paintRayCell(painted, x, y, dx, dy, displayedBeam);
        await flush_screen(0);
    }
}
//# sourceMappingURL=spell_attack_effects.js.map