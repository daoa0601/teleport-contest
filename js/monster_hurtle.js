// Moving a monster after a forceful hit.
// C refs: dothrow.c:will_hurtle()/mhurtle() and
// uhitm.c:mhurtle_to_doom()/mhitm_knockback().
import { monsterHasMapPosition } from './monster_location.js';
import { game, requirePlayingGame } from './gstate.js';
import { IS_WATERWALL, MM_IGNORELAVA, MM_IGNOREWATER, W_ARM, W_ARMC, W_ARMU, } from './const.js';
import { canSeeMonster, canSpotMonster, flush_screen, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { wakeMonster as awakenMonster } from './monster_anger.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { monsterName } from './monster_name.js';
import { MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL, } from './monster_data.js';
import { goodPosition } from './teleport_rules.js';
import { resolveMonsterLiquid } from './mon.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap, } from './trap.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterWearsTorsoArmor, petrifyMonsterImmediately } from './monster_stoning.js';
import { resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { stopHeroOccupation } from './occupation.js';
import { vision_recalc } from './vision.js';
import { rn2, rnd } from './rng.js';
import { updateMonsterRegions } from './regions.js';
import { setMonsterApparentHeroPosition } from './monmove.js';
const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_SLITHY = 0x00080000;
const M1_THICK_HIDE = 0x00200000;
const M1_NOLIMBS = 0x00006000;
const S_EYE = 5;
const S_LIGHT = 25;
const PM_GRID_BUG = 116;
function monsterAt(state, x, y, ignoredMonster) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        monster !== ignoredMonster && !monster.dead
        && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
export function staggerVerb(mnum) {
    const flags = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_EYE || symbol === S_LIGHT)
        return 'wobbles';
    if (flags & M1_FLY)
        return (MONSTER_SIZE[mnum] ?? 2) <= 1
            ? 'flutters' : 'staggers';
    if (flags & M1_SLITHY)
        return 'falters';
    if (flags & M1_AMORPHOUS)
        return 'trembles';
    if ((MONSTER_MOVE[mnum] ?? 0) === 0)
        return 'pulsates';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS)
        return 'falters';
    return 'staggers';
}
// C trap.c:minstapetrify(mon, TRUE) kills through xkilled(XKILL_NOMSG);
// petrifyMonsterImmediately() has already recorded the kill conduct.
function silentHeroStoning(finishMonsterDeath) {
    return (monster, death = {}) => finishMonsterDeath(monster, {
        ...death, showKillMessage: false, recordConduct: false,
    });
}
async function hurtleOneSquare(monster, dx, dy, { state, announce, nameMonster, finishMonsterDeath, monsterMoving, random, }) {
    const oldX = monster.mx;
    const oldY = monster.my;
    const nextX = oldX + dx;
    const nextY = oldY + dy;
    if (!willMonsterHurtle(monster, state, nextX, nextY, random)) {
        const occupant = monsterAt(state, nextX, nextY, monster);
        if (occupant) {
            if (canSeeMonster(monster)
                || canSeeMonster(occupant)) {
                await announce(`${monsterName(monster, { state, capitalized: true })} bumps into ${monsterName(occupant, { state, article: 'a' })}.`);
            }
            await awakenMonster(occupant, { attacked: !monsterMoving });
            const contact = monsterMoving
                ? { publish: announce, finishDeath: finishMonsterDeath }
                : { publish: announce, finishDeath: silentHeroStoning(finishMonsterDeath), creditHero: true };
            if (touchPetrifies(occupant.mnum) && !monsterWearsTorsoArmor(monster)) {
                await petrifyMonsterImmediately(monster, contact);
                await newsym(monster.mx, monster.my);
            }
            if (touchPetrifies(monster.mnum) && !monsterWearsTorsoArmor(occupant)) {
                await petrifyMonsterImmediately(occupant, contact);
                await newsym(occupant.mx, occupant.my);
            }
        }
        else if (nextX === state.u.ux && nextY === state.u.uy) {
            // C Some_Monnam(): an unseen hurtler is "Someone" or "Something".
            await announce(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} bumps into you.`);
            await stopHeroOccupation(state, announce);
            if (touchPetrifies(state.u.umonnum) && !monsterWearsTorsoArmor(monster)) {
                await petrifyMonsterImmediately(monster, {
                    publish: announce, finishDeath: silentHeroStoning(finishMonsterDeath), creditHero: true,
                });
                await newsym(monster.mx, monster.my);
            }
            const torsoArmor = state.inventory.some(object => (object.owornmask ?? 0) & (W_ARM | W_ARMC | W_ARMU));
            if (touchPetrifies(monster.mnum) && !torsoArmor) {
                const noun = nameMonster(monster).replace(/^(?:the|The|your) /u, '');
                await resolveImmediatePetrification({
                    state, publish: announce,
                    killer: `being hit by ${monster.mtame ? 'your' : 'a'} hurtling ${noun}`,
                });
            }
        }
        return { moved: false, dead: !!monster.dead || monster.mhp <= 0, occupant };
    }
    updateMonsterRegions(monster, state, { x: nextX, y: nextY });
    monster.mx = nextX;
    monster.my = nextY;
    await newsym(oldX, oldY);
    if (monster === state.u.usteed) {
        state.u.ux0 = state.u.ux;
        state.u.uy0 = state.u.uy;
        state.u.ux = nextX;
        state.u.uy = nextY;
        await vision_recalc(0);
    }
    await newsym(nextX, nextY);
    await flush_screen(1);
    await state.animationFrame?.();
    setMonsterApparentHeroPosition(monster, state, random);
    if (IS_WATERWALL(state.level.requireAt(nextX, nextY).typ))
        return { moved: true, stopped: true };
    await applyHurtleTrap(monster, { state, announce, finishMonsterDeath, random }, 'in-flight');
    return {
        moved: true,
        dead: !!monster.dead || monster.mhp <= 0,
        stopped: !!monster.mtrapped || !monster.mcanmove
            || monster.mx !== nextX || monster.my !== nextY
            || (monster !== state.u.usteed && !state.level.monsters.includes(monster)),
    };
}
// C dothrow.c:mhurtle_step() calls mintrap(HURTLING) on each square; mhurtle()
// ends with mintrap(FORCEBUNGLE), which still rolls a known trap's avoidance.
async function applyHurtleTrap(monster, options, stage) {
    const { state, announce, finishMonsterDeath, random } = options;
    const action = await triggerImmediateMonsterTrap(monster, state, stage === 'in-flight'
        ? { inAir: true, random } : { forceBungle: true, random });
    await finishImmediateMonsterTrap(action, state, {
        publish: announce,
        random,
        finishDeath: async (target, death) => {
            const outcome = await finishMonsterDeath(target, death);
            if (typeof outcome === 'boolean')
                return { survived: !outcome };
            if ('survived' in outcome)
                return outcome;
            return { survived: !outcome.killed, heroDied: outcome.heroDied };
        },
    });
}
export async function hurtleMonster(monster, dx, dy, distance, options = {}) {
    const { monsterMoving = false, state = game, announce = plineWithContinuation, nameMonster = monsterSentenceSubject, random = rn2, } = options;
    requirePlayingGame(state);
    const wakeMonster = options.wakeMonster
        || (() => awakenMonster(monster, { attacked: !monsterMoving }));
    const finishMonsterDeath = options.finishMonsterDeath
        || ((target, death) => finishEnvironmentalMonsterDeath(target, state, {
            ...death, publish: announce, random,
        }));
    const active = {
        state, announce, nameMonster, random, monsterMoving,
        finishMonsterDeath,
        finishLiquidDeath: options.finishLiquidDeath || ((target, liquid) => finishMonsterDeath(target, {
            random: liquid.random,
            noCorpse: !liquid.leaveCorpse,
            sadFeeling: liquid.sadFeeling,
            publish: liquid.publish,
        })),
    };
    const waking = await wakeMonster();
    if (waking?.heroDied)
        return { moved: false, dead: false, heroDied: true };
    monster.movement = 0;
    monster.mstun = 1;
    if ((MONSTER_SIZE[monster.mnum] ?? 0) >= 4 || monster === state.u.ustuck || monster.mtrapped) {
        if (canSeeMonster(monster))
            await announce(`${monsterName(monster, { state, capitalized: true })} doesn't budge!`);
        return { moved: false, dead: false };
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if (!distance || (!dx && !dy) || (dx && dy && monster.mnum === PM_GRID_BUG))
        return { moved: false, dead: false };
    if (monster.mundetected) {
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
    }
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    let result = { moved: false, dead: false };
    for (let step = 0; step < distance; step++) {
        const next = await hurtleOneSquare(monster, dx, dy, active);
        result = { ...next, moved: result.moved || next.moved };
        if (!next.moved || next.dead || next.stopped)
            break;
    }
    if (!monster.dead && monster.mhp > 0
        && (monster === state.u.usteed || state.level.monsters.includes(monster))) {
        if (state.level.traps.some(trap => trap.tx === monster.mx && trap.ty === monster.my))
            await applyHurtleTrap(monster, active, 'landing');
        else
            await resolveMonsterLiquid(monster, state, {
                announce, finishDeath: active.finishLiquidDeath,
                monsterMoving,
            });
    }
    result.dead = !!monster.dead || monster.mhp <= 0;
    return result;
}
// C dothrow.c:will_hurtle(): the size, holder and trap gates, then goodpos()
// decides the destination. goodpos() draws rn2(13) for an S_EEL monster even
// though MM_IGNOREWATER discards the result, shifting the draws after it.
export function willMonsterHurtle(monster, state, x, y, random = rn2) {
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 4
        || monster === state.u?.ustuck || monster.mtrapped)
        return false;
    return goodPosition(x, y, { kind: 'monster', monster }, {
        state, gpflags: MM_IGNOREWATER | MM_IGNORELAVA, random,
    });
}
export async function tryUnarmedStagger(monster, { skill, damage, dx, dy, state = game, announce = async () => { }, nameMonster = target => monsterName(target, { state, capitalized: true }), wakeMonster = async () => {
    monster.msleeping = 0;
}, finishLiquidDeath, finishMonsterDeath, }) {
    if (rnd(100) >= skill)
        return { staggered: false };
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 3
        || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_THICK_HIDE)) {
        return { staggered: false };
    }
    if (canSpotMonster(monster)) {
        await announce(`${nameMonster(monster)} ${staggerVerb(monster.mnum)} from your powerful strike!`);
    }
    if (damage >= (monster.mhp ?? 1))
        return { staggered: true };
    const hurtle = await hurtleMonster(monster, dx, dy, 1, {
        state,
        announce,
        nameMonster,
        wakeMonster,
        finishLiquidDeath,
        finishMonsterDeath,
    });
    return { staggered: true, ...hurtle };
}
//# sourceMappingURL=monster_hurtle.js.map