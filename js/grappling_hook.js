// Applying a grappling hook.
// C ref: apply.c use_grapple().

import {
    IS_AIR, IS_POOL, P_BASIC, P_SKILLED, isok,
} from './const.js';
import { docrt, newsym, pline } from './display.js';
import { finishHeroDeath } from './end.js';
import { wipeEngravingAt } from './engrave.js';
import {
    detachFloorObjectUnit, place_object, stack_object,
} from './floor_object.js';
import { game } from './gstate.js';
import {
    farlookTipUntilDismissed, selectMapPosition,
} from './getpos.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { hitMonsterWithAppliedWeapon } from './hero_ranged_attack.js';
import { findMonsterNearPosition } from './mklev.js';
import {
    MONSTER_FLAGS2, MONSTER_SIZE, monsterTypeName,
} from './monster_data.js';
import { OBJECT_SUBTYPE } from './object_data.js';
import { heroIsPolymorphed, rehumanizeHero } from './polyself.js';
import { rn2, rnd } from './rng.js';
import { ensureHeroSkills } from './skills.js';
import { surfaceName } from './terrain_name.js';
import { moreUntilDismissed } from './tty_prompts.js';
import { cansee, couldsee } from './vision.js';
import { showPagedPickOneMenu } from './windows.js';

const M2_STRONG = 0x04000000;

function hookSkill(hook, state) {
    const skillType = Math.abs(OBJECT_SUBTYPE[hook.otyp] ?? 0);
    return ensureHeroSkills(state)?.[skillType]?.skill ?? 0;
}

function hookRange(skill) {
    if (skill <= P_BASIC) return 4;
    if (skill === P_SKILLED) return 5;
    return 8;
}

function squaredDistanceFromHero(x, y, state) {
    const dx = x - state.u.ux;
    const dy = y - state.u.uy;
    return dx * dx + dy * dy;
}

function monsterAt(x, y, state) {
    return state.level?.monsters?.find(monster =>
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function monsterObject(monster) {
    return monster.name || `the ${monsterTypeName(
        monster.mnum, !!monster.female,
    )}`;
}

async function chooseTarget(describeTarget, state) {
    const firstUse = !state._travelTipShown;
    if (firstUse) {
        const dismissal = await moreUntilDismissed(
            'Where do you want to hit?--More--',
        );
        if (dismissal === 27) {
            state._pending_message = '';
            return null;
        }
        state._travelTipShown = true;
        const tipDismissal = await farlookTipUntilDismissed();
        if (tipDismissal === 27) {
            state._pending_message = '';
            return null;
        }
    }

    return selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy },
        prompt: firstUse
            ? 'Move cursor to the desired position:'
            : state.flags?.verbose === false
                ? 'Where do you want to hit?'
                : "Where do you want to hit?  (For instructions type a '?')",
        goal: 'the spot to hit',
        describe: describeTarget,
    });
}

async function chooseAim(x, y, state) {
    const surface = surfaceName(x, y, state);
    const rows = [
        'Aim for what?',
        '',
        `a - an object on the ${surface}`,
        'b - a monster',
        `c - the ${surface}`,
    ];
    const choices = new Map([['a', 1], ['b', 2], ['c', 3]]);
    const selection = await showPagedPickOneMenu({
        rows, choices, returnCancels: true,
    });
    await docrt();
    return selection;
}

async function snagObject(x, y, holdObject, state) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object) return false;

    await pline(`You snag an object from the ${surfaceName(x, y, state)}!`);
    const unit = detachFloorObjectUnit(object, state);
    if (!await holdObject(unit)) {
        place_object(unit, x, y);
        stack_object(unit, state);
    }
    newsym(x, y);
    return true;
}

async function pullTinyMonster(monster, destination, state) {
    await applyCaitiffPenalty(monster, state);
    await pline(`You pull in ${monsterObject(monster)}!`);
    const oldx = monster.mx;
    const oldy = monster.my;
    monster.mundetected = 0;
    monster.mx = destination.x;
    monster.my = destination.y;
    monster.mtrack = [];
    newsym(oldx, oldy);
    newsym(monster.mx, monster.my);
}

async function damageHero(state) {
    await pline('You hook yourself!');
    let damage = 10 + rn2(10);
    if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
        damage = Math.trunc((damage + 1) / 2);

    if (heroIsPolymorphed(state)) {
        state.u.mh = (state.u.mh ?? 1) - damage;
        if (state.u.mh > 0) return false;
        if (!(state.u.unchanging || state.unchanging)) {
            const restored = rehumanizeHero(state);
            if (restored.changed)
                await pline(`You return to ${restored.race} form!`);
            return false;
        }
    } else {
        state.u.uhp = (state.u.uhp ?? 1) - damage;
        if (state.u.uhp > 0) return false;
    }
    return finishHeroDeath({ killer: 'a grappling hook' });
}

export async function useGrapplingHook(hook, {
    state = game,
    ensureWielded,
    describeTarget,
    holdObject,
    attackMonster = hitMonsterWithAppliedWeapon,
    hurtle,
}) {
    if (state.u?.uswallow) {
        await pline("There's not enough room here to use that.");
        return { spentTime: false };
    }

    const wielded = await ensureWielded();
    if (!wielded?.ready) return { spentTime: false };
    if (wielded.newlyWielded)
        return { spentTime: true, resume: true };

    const target = await chooseTarget(describeTarget, state);
    if (!target) return { spentTime: false };

    const range = hookRange(hookSkill(hook, state));
    if (squaredDistanceFromHero(target.x, target.y, state) > range) {
        await pline('Too far!');
        return { spentTime: false };
    }
    if (!isok(target.x, target.y) || !cansee(target.x, target.y)) {
        await pline("You won't hit anything if you can't see that spot.");
        return { spentTime: false };
    }
    if (!couldsee(target.x, target.y)) {
        await pline("You can't reach that spot from here.");
        return { spentTime: false };
    }

    const skill = hookSkill(hook, state);
    let toHit = rn2(5);
    if (skill >= P_SKILLED) {
        toHit = rn2(4);
        const choice = await chooseAim(target.x, target.y, state);
        if (choice !== null && rn2(skill > P_SKILLED ? 20 : 2) !== 0)
            toHit = choice;
    }

    if (toHit === 2 || rn2(2) === 0) {
        wipeEngravingAt(state.u.ux, state.u.uy, rnd(2), false, state.level);
    }

    if (toHit === 1
        && await snagObject(target.x, target.y, holdObject, state)) {
        return { spentTime: true };
    }

    let hitSurface = toHit === 3;
    if (toHit === 2) {
        const monster = monsterAt(target.x, target.y, state);
        if (monster) {
            const tiny = (MONSTER_SIZE[monster.mnum] ?? 2) === 0;
            if (tiny && rn2(4) === 0) {
                const destination = findMonsterNearPosition(
                    null, state.u.ux, state.u.uy, { state },
                );
                if (destination) {
                    await pullTinyMonster(monster, destination, state);
                    return { spentTime: true };
                }
            }

            const large = (MONSTER_SIZE[monster.mnum] ?? 2) >= 3;
            const strong = !!((MONSTER_FLAGS2[monster.mnum] ?? 0)
                & M2_STRONG);
            if ((!large && !strong) || rn2(4) !== 0) {
                await attackMonster(monster, hook, { state });
                return { spentTime: true };
            }
            hitSurface = true;
        }
    }

    if (hitSurface) {
        const terrain = state.level?.at?.(target.x, target.y)?.typ;
        const surface = surfaceName(target.x, target.y, state);
        if (IS_AIR(terrain) || IS_POOL(terrain)) {
            await pline(`The hook slices through the ${surface}.`);
        } else {
            await pline(`You are yanked toward the ${surface}!`);
            await hurtle(
                Math.sign(target.x - state.u.ux),
                Math.sign(target.y - state.u.uy),
            );
        }
        return { spentTime: true };
    }

    if (toHit > 3 && skill <= P_BASIC) {
        await damageHero(state);
        return { spentTime: true };
    }

    await pline('Nothing happens.');
    return { spentTime: true };
}
