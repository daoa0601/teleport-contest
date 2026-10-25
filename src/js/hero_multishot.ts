// How many objects the hero throws or shoots with one command.
// C refs: dothrow.c multishot_class_bonus() and throw_obj().

import { currentAttribute } from './attrib.js';
import { plineWithContinuation } from './display.js';
import {
    A_DEX, A_STR, P_CROSSBOW, P_DAGGER, P_DART, P_EXPERT, P_KNIFE,
    P_SHURIKEN, P_SKILLED, P_SLING, P_SPEAR,
} from './const.js';
import { game, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { HeroProjectileVolley } from './hero_physical_types.js';
import type { RoleKey, RaceName } from './roles.js';
import {
    ELVEN_ARROW, ELVEN_BOW, OBJECT_SUBTYPE, ORCISH_ARROW, ORCISH_BOW,
    YA, YUMI,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import {
    isLauncherAmmunition, launcherMatchesAmmo,
} from './object_properties.js';
import { rnd } from './rng.js';
import { isQuestArtifact } from './quest.js';
import { ensureHeroSkills } from './skills.js';

export interface HeroVolleyOptions {
    state?: GameState;
    shotLimit?: number;
    random?: (range: number) => number;
}

const WEAPON_CLASS = 2;

function weakMultishot(role: RoleKey, skill: number, state: PlayingGameState) {
    return role === 'wizard' || role === 'priest'
        || (role === 'healer' && skill !== P_KNIFE)
        || (role === 'tourist' && skill !== -P_DART)
        || state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0
        || currentAttribute(A_DEX, state) <= 6;
}

function roleBonus(role: RoleKey, item: GameObject, launcher: GameObject | null, skill: number) {
    if (role === 'caveman')
        return skill === -P_SLING || skill === P_SPEAR ? 1 : 0;
    if (role === 'monk') return skill === -P_SHURIKEN ? 1 : 0;
    if (role === 'ranger') return skill !== P_DAGGER ? 1 : 0;
    if (role === 'rogue') return skill === P_DAGGER ? 1 : 0;
    if (role === 'samurai')
        return item.otyp === YA && launcher?.otyp === YUMI ? 1 : 0;
    return 0;
}

function raceBonus(race: RaceName, item: GameObject, launcher: GameObject | null, skill: number) {
    if (race === 'elf') {
        return item.otyp === ELVEN_ARROW && launcher?.otyp === ELVEN_BOW
            ? 1 : 0;
    }
    if (race === 'orc') {
        return item.otyp === ORCISH_ARROW && launcher?.otyp === ORCISH_BOW
            ? 1 : 0;
    }
    return race === 'gnome' && skill === -P_CROSSBOW ? 1 : 0;
}

export function chooseHeroVolleyCount(item: GameObject, {
    state = game,
    shotLimit = 0,
    random = rnd,
}: HeroVolleyOptions = {}): number {
    requirePlayingGame(state);
    const quantity = Math.max(1, item?.quan ?? item?.quantity ?? 1);
    const launcher = launcherMatchesAmmo(item, state.uwep)
        ? state.uwep ?? null : null;
    const objectClass = item?.oclass || objectClassForType(item?.otyp);
    const canVolley = quantity > 1
        && (isLauncherAmmunition(item) ? !!launcher
            : objectClass === WEAPON_CLASS)
        && !state.u?.confused && !((state.u.confusionTurns ?? 0) > 0)
        && !state.u?.stunned && !((state.u.stunnedTurns ?? 0) > 0);
    if (!canVolley) return 1;

    const skill = OBJECT_SUBTYPE[item.otyp] ?? 0;
    const skillLevel = ensureHeroSkills(state)?.[Math.abs(skill)]?.skill ?? 0;
    const role = state.urole.key;
    const race = state.urace.name;
    const weak = weakMultishot(role, skill, state);
    let maximum = 1;
    if (skillLevel >= P_EXPERT) maximum++;
    if (skillLevel >= P_SKILLED && !weak) maximum++;
    maximum += roleBonus(role, item, launcher, skill);
    if (!weak) {
        maximum += raceBonus(race, item, launcher, skill);
        if (launcher && isQuestArtifact(launcher, state)) maximum++;
    }

    if (maximum > 1 && skill === -P_CROSSBOW
        && currentAttribute(A_STR, state) < (race === 'gnome' ? 16 : 18)) {
        maximum = random(maximum);
    }
    let count = Math.min(random(maximum), quantity);
    if (shotLimit > 0) count = Math.min(count, shotLimit);
    return count;
}

// C endmultishot(TRUE): the current projectile finishes, then the command
// stops. Keep the count live so its remaining contact messages see the limit.
export async function endHeroVolley(
    volley: HeroProjectileVolley, state: GameState = game,
): Promise<void> {
    if (volley.index >= volley.count) return;
    if (!state.context.mon_moving) {
        const index = volley.index;
        const suffix = index % 100 >= 11 && index % 100 <= 13 ? 'th'
            : index % 10 === 1 ? 'st' : index % 10 === 2 ? 'nd'
                : index % 10 === 3 ? 'rd' : 'th';
        await plineWithContinuation(`You stop ${volley.shooting ? 'firing' : 'throwing'} after the ${
            index}${suffix} ${volley.shooting ? 'shot' : 'toss'}.`);
    }
    volley.count = volley.index;
}

// C keeps m_shot in global state, so end.c:savelife() can cut a hero's
// in-flight volley short through endmultishot(FALSE). Track the active
// volley the same way: the throw loop holds this object by reference.
let activeVolley: HeroProjectileVolley | null = null;

export function beginHeroVolley(volley: HeroProjectileVolley): void {
    activeVolley = volley;
}

export function finishHeroVolley(): void {
    activeVolley = null;
}

// C end.c:savelife() -> endmultishot(FALSE): the current missile becomes
// the last one, without the "You stop throwing" announcement.
export function stopRemainingVolleyShots(state: GameState = game): void {
    if (activeVolley && !state.context.mon_moving
        && activeVolley.index < activeVolley.count)
        activeVolley.count = activeVolley.index;
}
