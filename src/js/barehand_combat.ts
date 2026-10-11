// Native uhitm.c:double_punch(), hmon_hitmon_barehands(), and damage bonuses.
import {
    P_BARE_HANDED_COMBAT, P_BASIC,
    W_ARMG, W_RINGL, W_RINGR,
} from './const.js';
import { specialContactDamage } from './contact_damage.js';
import { canSpotMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { HeroSkill } from './hero_types.js';
import {
    monsterIsAmorphous, monsterIsNoncorporeal, monsterIsShade,
} from './monster_data.js';
import { monsterName } from './monster_name.js';
import { rn2, rnd } from './rng.js';
import { ensureHeroSkills } from './skills.js';

export interface BarehandContact {
    damage: number;
    silverRings: boolean;
    useWeaponSkill: boolean;
    trainWeaponSkill: boolean;
}

export interface BarehandContactOptions {
    state?: GameState;
    twoHits?: number;
}

interface BarehandMessageOptions {
    state?: GameState;
}

function requiredHeroSkill(state: GameState, skill: number): HeroSkill {
    const entry = ensureHeroSkills(state)?.[skill];
    if (!entry) throw new Error(`Hero combat requires initialized skill ${skill}.`);
    return entry;
}

export function barehandSkill(state: GameState = game): number {
    return requiredHeroSkill(state, P_BARE_HANDED_COMBAT).skill;
}

export function heroUsesMartialArts(state: GameState = game): boolean {
    if (!state.urole) throw new Error('Hero combat requires a selected role.');
    return state.urole.key === 'monk' || state.urole.key === 'samurai';
}

export function doublePunch(state: GameState = game): boolean {
    const skill = barehandSkill(state);
    if (state.uwep || state.u.uwep || state.uarms || state.u.uarms || skill <= P_BASIC)
        return false;
    return skill - P_BASIC > rn2(5);
}

// twoHits is native hmd.twohits: 0 for a single attempt, otherwise its
// one-based position. Only the first two attempts can use exposed rings.
export function prepareHeroBarehandContact(
    monster: Monster, { state = game, twoHits = 0 }: BarehandContactOptions = {},
): BarehandContact {
    const usesSkill = !monsterIsShade(monster);
    let damage = usesSkill ? rnd(heroUsesMartialArts(state) ? 4 : 2) : 0;
    const trainsSkill = damage > 1;
    const mask = state.uarmg || state.u.uarmg ? W_ARMG
        : ((twoHits === 0 || twoHits === 1 ? W_RINGR : 0)
            | (twoHits === 0 || twoHits === 2 ? W_RINGL : 0));
    const contact = specialContactDamage(state.u, monster, mask, { state });
    damage += contact.damage;
    return {
        damage, silverRings: !!(contact.silverMask & (W_RINGL | W_RINGR)),
        useWeaponSkill: usesSkill, trainWeaponSkill: trainsSkill,
    };
}

// hmon's silver feedback names the contact material without identifying rings.
export async function showBarehandSilverHit(
    monster: Monster, hit: Pick<BarehandContact, 'silverRings'> | null, { state = game }: BarehandMessageOptions = {},
): Promise<void> {
    if (!hit?.silverRings) return;
    const spotted = canSpotMonster(monster);
    let target = monsterName(monster, { state });
    if (!spotted) target = target.charAt(0).toUpperCase() + target.slice(1);
    if (!monsterIsNoncorporeal(monster) && !monsterIsAmorphous(monster))
        target = `${possessive(target)} flesh`;
    await plineWithContinuation(spotted
        ? `Your silver ring sears ${target}!` : `${target} is seared!`);
}

function possessive(noun: string): string {
    if (noun.toLowerCase() === 'it') return `${noun}s`;
    return noun.endsWith('s') ? `${noun}'` : `${noun}'s`;
}
