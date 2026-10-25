// A physical blow can throw a much smaller opponent backward.
// C uhitm.c:mhitm_knockback() and m_is_steadfast().

import { releaseHeroFromMonster } from './hero_expulsion.js';
import { formatFeltMessage } from './hero_speech.js';
import { artifactById } from './artifacts.js';
import {
    DOOR, DISMOUNT_KNOCKED, Is_airlevel, Is_waterlevel,
    MGIVENNAME, MM_IGNORELAVA, MM_IGNOREWATER,
    W_SADDLE, isok,
} from './const.js';
import { doorlessDoor } from './hack.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import type { GameState } from './game_state.js';
import type { Hero } from './hero_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import type { HurtleDeathHandler, HurtleLiquidDeathHandler } from './monster_hurtle.js';
import { canKnockHeroToward, hurtleHero } from './hero_hurtle.js';
import {
    AD_PHYS, AD_STCK, AD_WRAP, AT_BUTT, AT_CLAW, AT_ENGL, AT_HUGS, AT_KICK, AT_WEAP,
} from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SYMBOL } from './monster_data.js';
import { hurtleMonster, willMonsterHurtle } from './monster_hurtle.js';
import { setMonsterApparentHeroPosition } from './monster_perception.js';
import { monsterName } from './monster_name.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { LOADSTONE } from './object_data.js';
import { isBluntWeapon, isFlimsyObject } from './object_properties.js';
import { rn2 } from './rng.js';
import { dismountHero } from './steed.js';
import { makeStunned } from './hero_mental_status.js';
import { goodPosition } from './teleport_rules.js';
import { isPoolAt } from './terrain_properties.js';

const M1_FLY = 0x00000001;
const M1_UNSOLID = 0x00100000;
const S_EYE = 5;
const S_LIGHT = 25;

type PhysicalActor = Hero | Monster;

export interface KnockbackAttack {
    attackType: number;
    damageType: number;
}

export interface KnockbackOptions {
    state?: GameState;
    random?: (limit: number) => number;
    publish?: MessagePublisher;
    weaponUsed?: boolean;
    hit?: boolean;
    finishMonsterDeath?: HurtleDeathHandler | undefined;
    finishLiquidDeath?: HurtleLiquidDeathHandler | undefined;
    nameMonster?: (monster: Monster) => string;
    wakeDefender?: (() => Promise<{ heroDied?: boolean } | void>) | undefined;
}

export interface KnockbackOutcome {
    knocked: boolean;
    moved?: boolean;
    heroDied?: boolean;
    defenderDied?: boolean;
    aggressorDied?: boolean;
    defenderLeftLevel?: boolean;
}

function isHeroActor(actor: PhysicalActor, state: GameState): actor is Hero {
    return actor === state.u;
}

function species(actor: PhysicalActor, state: GameState): number {
    if (!isHeroActor(actor, state)) return actor.mnum;
    requireInitializedHero(actor);
    return actor.umonnum;
}

function inventory(actor: PhysicalActor, state: GameState): GameObject[] {
    return isHeroActor(actor, state) ? state.inventory : actor.minvent ?? [];
}

function wieldedWeapon(actor: PhysicalActor, state: GameState): GameObject | null | undefined {
    return isHeroActor(actor, state) ? state.uwep : monsterWieldedWeapon(actor);
}

export function isSteadfast(actor: PhysicalActor, state: GameState): boolean {
    requirePlayingGame(state);
    const mnum = species(actor, state);
    const floating = isHeroActor(actor, state)
        ? actor.levitating || actor.levitation || actor.flying
        : ((MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY)
            || [S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[mnum] ?? -1);
    if (floating || Is_airlevel(state.u.uz)
        || (Is_waterlevel(state.u.uz)
            && !isPoolAt(state.u.ux, state.u.uy, state))) return false;
    if (artifactById(wieldedWeapon(actor, state)?.oartifact)?.name === 'Giantslayer')
        return true;
    return inventory(actor, state).some(object => object.otyp === LOADSTONE)
        || (actor === state.u.usteed
            && state.inventory.some(object => object.otyp === LOADSTONE));
}

export async function tryKnockback(attacker: PhysicalActor, defender: PhysicalActor, attack: KnockbackAttack, {
    state = game, random = rn2, publish = plineWithContinuation,
    weaponUsed = false, hit = true, finishMonsterDeath, finishLiquidDeath,
    nameMonster = monster => monsterName(monster, {
        state, article: 'your',
        suppressSaddle: !!MGIVENNAME(monster) || monster === state.u.usteed,
    }), wakeDefender,
}: KnockbackOptions = {}): Promise<KnockbackOutcome> {
    requirePlayingGame(state);
    const distance = random(3) ? 1 : 2;
    const weapon = weaponUsed ? wieldedWeapon(attacker, state) : null;
    const chance = artifactById(weapon?.oartifact)?.name === 'Ogresmasher' ? 2 : 6;
    if (random(chance) !== 0) return { knocked: false };
    if (attack.damageType !== AD_PHYS
        || ![AT_CLAW, AT_KICK, AT_BUTT, AT_WEAP].includes(attack.attackType))
        return { knocked: false };

    const attackerForm = species(attacker, state);
    if ((MONSTER_ATTACKS[attackerForm] || []).some(([method, damage]) =>
        [AT_ENGL, AT_HUGS].includes(method) || [AD_STCK, AD_WRAP].includes(damage)))
        return { knocked: false };

    const attackerMonster = isHeroActor(attacker, state) ? null : attacker;
    const defenderMonster = isHeroActor(defender, state) ? null : defender;
    const heroAttacks = attackerMonster === null;
    const heroTarget = defenderMonster === null;
    let movingHero = heroTarget;
    const x = defenderMonster?.mx ?? state.u.ux;
    const y = defenderMonster?.my ?? state.u.uy;
    const dx = Math.sign(x - (attackerMonster?.mx ?? state.u.ux));
    const dy = Math.sign(y - (attackerMonster?.my ?? state.u.uy));
    if (heroTarget) {
        if (!canKnockHeroToward(dx, dy)) return { knocked: false };
    } else {
        if (!isok(x + dx, y + dy)) return { knocked: false };
        const doorway = state.level.at(x, y);
        // C tests (defx - magr->mx && defy - magr->my); youmonst.mx/my stay
        // zero, so a hero can never knock a monster out of a real doorway.
        const fromX = attackerMonster?.mx ?? 0;
        const fromY = attackerMonster?.my ?? 0;
        // C hack.c:doorless_door(): a Rogue-level doorway has no door but
        // still blocks diagonal knockback.
        if (x - fromX && y - fromY && doorway?.typ === DOOR && !doorlessDoor(doorway))
            return { knocked: false };
    }

    let target: Monster | null = defenderMonster;
    let dismount = false;
    if (heroTarget && state.u.usteed) {
        const saddle = (state.u.usteed.minvent ?? []).find(object => (object.owornmask ?? 0) & W_SADDLE);
        if (saddle?.cursed) {
            target = state.u.usteed;
            movingHero = false;
        } else dismount = true;
    }
    if ((attackerMonster && (attackerMonster.dead || attackerMonster.mhp <= 0))
        || (target && (target.dead || target.mhp <= 0))) return { knocked: false };
    const attackerSize = MONSTER_SIZE[attackerForm];
    const defenderForm = species(target ?? state.u, state);
    const defenderSize = MONSTER_SIZE[defenderForm];
    if (attackerSize === undefined || defenderSize === undefined)
        throw new Error(`Knockback requires known species sizes (${attackerForm}, ${defenderForm}).`);
    if (attackerSize <= defenderSize + 1) return { knocked: false };
    if (weapon && (isFlimsyObject(weapon) || !isBluntWeapon(weapon)))
        return { knocked: false };
    if (((MONSTER_FLAGS1[attackerForm] ?? 0) & M1_UNSOLID)
        || ((heroAttacks || movingHero) && !hit)) return { knocked: false };

    if (isSteadfast(target ?? state.u, state)) {
        if (movingHero || target === state.u.usteed) {
            await publish(state.u.usteed
                ? `You and ${nameMonster(state.u.usteed)} don't budge.` : "You don't budge.");
        } else if (target && canSeeMonster(target)) {
            await publish(`${monsterName(target, { state, capitalized: true })} doesn't budge.`);
        }
        return { knocked: false };
    }

    const openPath = movingHero
        ? defenderSize < 4 && goodPosition(x + dx, y + dy, { kind: 'hero' }, {
            state, gpflags: MM_IGNOREWATER | MM_IGNORELAVA, random,
        })
        : target && willMonsterHurtle(target, state, x + dx, y + dy);
    const how = dismount ? 'out of your saddle' : openPath ? 'backward' : 'back';
    if (movingHero || (target && canSeeMonster(target))) {
        const subject = attackerMonster ? monsterName(attackerMonster, { state, capitalized: true }) : 'You';
        let object = target ? nameMonster(target) : 'you';
        if (heroTarget && target) object = `you and ${nameMonster(target)}`;
        const strength = random(2) ? 'forceful' : 'powerful';
        const blow = random(2) ? 'blow' : 'strike';
        await publish(`${subject} ${heroAttacks ? 'knock' : 'knocks'} ${object} ${how} with a ${strength} ${blow}!`);
    } else if (heroAttacks && target) {
        await publish(formatFeltMessage(`${monsterName(target, { state, augmentIt: true })} be knocked ${how}!`, state));
    }

    // C uhitm.c:mhitm_knockback() calls unstuck(), which also gives a
    // holder its re-hold cooldown.
    if ((heroAttacks || movingHero) && state.u.ustuck)
        await releaseHeroFromMonster(state.u.ustuck, { state, publish });
    let moved;
    const level = state.level;
    if (movingHero) {
        if (dismount) {
            state.u.dx = dx;
            state.u.dy = dy;
            await dismountHero(DISMOUNT_KNOCKED, { state, random, announce: publish });
        } else await hurtleHero(dx, dy, distance, finishMonsterDeath ? { finishMonsterDeath } : {});
        moved = state.u.ux !== x || state.u.uy !== y;
        // A fatal hurtle ends the game inside C's hurtle(); nothing follows.
        if (state.program_state.gameover) return { knocked: true, moved, heroDied: true };
        if (attackerMonster) setMonsterApparentHeroPosition(attackerMonster, state, random);
        if (!state.u.stunned && !((state.u.stunnedTurns ?? 0) > 0) && random(4) === 0) {
            await makeStunned(distance + 1, { state, publish });
        }
    } else {
        if (!target) throw new Error('Monster knockback requires a monster target.');
        const result = await hurtleMonster(target, dx, dy, distance, {
            state, announce: publish, nameMonster,
            wakeMonster: wakeDefender,
            finishLiquidDeath, finishMonsterDeath,
            monsterMoving: !heroAttacks, random,
        });
        if (result.heroDied)
            return { knocked: true, moved: result.moved, heroDied: true };
        moved = result.moved;
        if (!target.dead && target.mhp > 0 && random(4) === 0) {
            target.mstun = 1;
            if (target === state.u.usteed)
                if (attackerMonster) setMonsterApparentHeroPosition(attackerMonster, state, random);
        }
    }
    return {
        knocked: true, moved,
        defenderDied: heroTarget ? !!state.program_state.gameover : !!target && (!!target.dead || target.mhp <= 0),
        aggressorDied: !!attackerMonster && (!!attackerMonster.dead || attackerMonster.mhp <= 0),
        defenderLeftLevel: level !== state.level
            || (target !== null && !heroTarget && target !== state.u.usteed && !state.level.monsters.includes(target)),
    };
}
