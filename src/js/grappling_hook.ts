// Applying a grappling hook.
// C ref: apply.c use_grapple().

import {
    IS_AIR, KILLED_BY, P_BASIC, P_SKILLED, isok,
} from './const.js';
import { newsym, pline } from './display.js';
import { wipeHeroEngraving } from './engrave.js';
import { pickupFloorObject } from './pickup.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import {
    shouldShowGetposTip, showGetposTip, selectMapPosition,
} from './getpos.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { hitMonsterWithAppliedWeapon } from './hero_ranged_attack.js';
import { findMonsterNearPosition } from './mklev.js';
import { monsterAtPosition } from './monster_location.js';
import { relocateMonsterTo } from './teleport.js';
import {
    MONSTER_FLAGS2, MONSTER_SIZE, monsterTypeName,
} from './monster_data.js';
import { OBJECT_SUBTYPE } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { ensureHeroSkills } from './skills.js';
import { surfaceName } from './terrain_name.js';
import { isPoolAt } from './terrain_properties.js';
import { cansee, couldsee } from './vision.js';
import { showPagedPickOneMenu } from './windows.js';
import type { PositionDescription } from './getpos.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { Position } from './map_types.js';
import type { WieldToolResult } from './wield_tool.js';

export interface GrapplingHookOptions {
    state?: GameState;
    ensureWielded: () => WieldToolResult | Promise<WieldToolResult>;
    describeTarget: PositionDescription;
    attackMonster?: typeof hitMonsterWithAppliedWeapon;
    hurtle: (dx: number, dy: number) => unknown;
}

export interface GrapplingHookResult {
    spentTime: boolean;
    resume?: true;
}

const M2_STRONG = 0x04000000;

function hookSkill(hook: GameObject, state: GameState) {
    const skillType = Math.abs(OBJECT_SUBTYPE[hook.otyp] ?? 0);
    return ensureHeroSkills(state)?.[skillType]?.skill ?? 0;
}

function hookRange(skill: number) {
    if (skill <= P_BASIC) return 4;
    if (skill === P_SKILLED) return 5;
    return 8;
}

function squaredDistanceFromHero(x: number, y: number, state: GameState) {
    const dx = x - state.u.ux;
    const dy = y - state.u.uy;
    return dx * dx + dy * dy;
}

function monsterAt(x: number, y: number, state: GameState) {
    return state.level ? monsterAtPosition(state.level, x, y) : null;
}

function monsterObject(monster: Monster) {
    return monster.name || `the ${monsterTypeName(
        monster.mnum, !!monster.female,
    )}`;
}

async function chooseTarget(describeTarget: PositionDescription, state: GameState) {
    const firstUse = shouldShowGetposTip(state);
    if (firstUse) {
        await pline('Where do you want to hit?');
        await showGetposTip(state);
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

async function chooseAim(x: number, y: number, state: GameState) {
    const surface = surfaceName(x, y, state);
    const rows = [
        'Aim for what?',
        '',
        `a - an object on the ${surface}`,
        'b - a monster',
        `c - the ${surface}`,
    ];
    const choices = new Map([['a', 1], ['b', 2], ['c', 3]]);
    return showPagedPickOneMenu({
        rows, choices,
    });
}

async function snagObject(x: number, y: number, state: GameState) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object) return false;

    await pline(`You snag an object from the ${surfaceName(x, y, state)}!`);
    await pickupFloorObject(object, 1);
    newsym(x, y);
    return true;
}

async function pullTinyMonster(monster: Monster, destination: Position, state: GameState) {
    await pline(`You pull in ${monsterObject(monster)}!`);
    monster.mundetected = 0;
    await relocateMonsterTo(monster, destination.x, destination.y, { state });
}

async function prepareHookAttack(monster: Monster, hook: GameObject, target: Position, state: GameState) {
    const confirmation = state.flags.confirm;
    state.flags.confirm = false;
    try {
        // use_grapple() deliberately proceeds after revealing a hidden target,
        // even when attack_checks() would stop an ordinary melee attack.
        await prepareAppliedWeaponAttack(monster, hook, { state, struckAt: target });
    } finally {
        if (confirmation === undefined) delete state.flags.confirm;
        else state.flags.confirm = confirmation;
    }
    if (!state.program_state.gameover) await applyCaitiffPenalty(monster, state);
}

async function damageHero(state: GameState) {
    await pline('You hook yourself!');
    let damage = 10 + rn2(10);
    if (state.u.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);

    return loseHeroHp(damage, 'a grappling hook', { state, publish: pline, killerFormat: KILLED_BY });
}

export async function useGrapplingHook(hook: GameObject, {
    state = game,
    ensureWielded,
    describeTarget,
    attackMonster = hitMonsterWithAppliedWeapon,
    hurtle,
}: GrapplingHookOptions): Promise<GrapplingHookResult> {
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

    // C use_grapple() evaluates rnd(2) before checking floor reach.
    if (toHit === 2 || rn2(2) === 0) {
        wipeHeroEngraving(rnd(2), state);
    }

    if (toHit === 1
        && await snagObject(target.x, target.y, state)) {
        return { spentTime: true };
    }

    let hitSurface = toHit === 3;
    if (toHit === 2) {
        const monster = monsterAt(target.x, target.y, state);
        if (monster) {
            state.bhitpos = { x: target.x, y: target.y };
            state.notonhead = target.x !== monster.mx || target.y !== monster.my;
            const tiny = (MONSTER_SIZE[monster.mnum] ?? 2) === 0;
            if (tiny && rn2(4) === 0) {
                const destination = findMonsterNearPosition(
                    null, state.u.ux, state.u.uy, { state },
                );
                if (destination) {
                    await prepareHookAttack(monster, hook, target, state);
                    if (state.program_state.gameover) return { spentTime: true };
                    await pullTinyMonster(monster, destination, state);
                    return { spentTime: true };
                }
            }

            const large = (MONSTER_SIZE[monster.mnum] ?? 2) >= 3;
            const strong = !!((MONSTER_FLAGS2[monster.mnum] ?? 0)
                & M2_STRONG);
            if ((!large && !strong) || rn2(4) !== 0) {
                await prepareHookAttack(monster, hook, target, state);
                if (state.program_state.gameover) return { spentTime: true };
                await attackMonster(monster, hook, { state, target, checkCaitiff: false });
                return { spentTime: true };
            }
            hitSurface = true;
        }
    }

    if (hitSurface) {
        const location = state.level?.at(target.x, target.y);
        if (!location) throw new Error('The hook target is outside the dungeon map.');
        const terrain = location.typ;
        const surface = surfaceName(target.x, target.y, state);
        if (IS_AIR(terrain) || isPoolAt(target.x, target.y, state)) {
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
