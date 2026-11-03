// Hero petrification from contact, corpses, and eggs.
// C refs: mondata.c touch_petrifies()/poly_when_stoned(),
// pickup.c fatal_corpse_mistake(), trap.c instapetrify(),
// timeout.c stoned_dialogue(); potion.c make_stoned() lives in potion.ts
// (setHeroPetrificationTimeout).

import { heroIsHallucinating, heroIsBlind, heroIsDeaf } from './senses.js';
import { endVoluntaryMultiTurn, nomul } from './hack.js';
import { exerciseAttribute } from './attrib.js';
import { heroHandName } from './body_parts.js';
import { makePlural, withIndefiniteArticle, corpseName, killerObjectName, objectMonsterName } from './objnam.js';
import { objectQuantity } from './mkobj.js';
import type { PetrificationKillerFormat } from './potion.js';
import { A_DEX, G_GENOD, KILLED_BY, KILLED_BY_AN, NEW_MOON, NO_KILLER_PREFIX, STONING, TIMEOUT, W_ARMC, W_ARMF, W_ARMG, W_ARMH } from './const.js';
import { canSpotMonster, randomDisplayMonsterSubject } from './display.js';
import { displayMessageWindow } from './tty_topline.js';
import { pline, plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { finishHeroDeath } from './end.js';
import type { DeathHandler } from './end.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { RandomBelow } from './monster_action_types.js';
import { game, requireLiveGame } from './gstate.js';
import { cureHeroVomiting } from './potion.js';
import { healHeroLegs } from './do.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName, requireMonsterData, monsterIsGolem } from './monster_data.js';
import { AT_NONE, AT_SPIT, AT_EXPL, AT_BOOM, AT_GAZE, AT_BREA, AT_MAGC, AT_CLAW, AT_TUCH, AT_WEAP, AT_KICK, AT_BUTT, AT_HUGS } from './monster_attack_types.js';
import { monsterSentenceSubject } from './ambient_sounds.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { CORPSE, EGG } from './object_data.js';
import { heroHasNoLimbs, heroIsPolymorphed, polymonHero } from './polyself.js';
import { removeIntrinsicProperty, setPropertyTimeout } from './properties.js';
import { clearHeroSliming } from './potion.js';
import { stopHeroOccupation } from './occupation.js';
import { formatHeardMessage } from './hero_speech.js';
import { openingTinMaySaveHero } from './eat.js';
import { uswapwepgone, uwepgone } from './wield.js';
import { rn2 } from './rng.js';
import { resolveImmediatePetrification } from './trap.js';

const PM_CHICKATRICE = 9;
const PM_COCKATRICE = 10;
const PM_MEDUSA = 284;
export const PM_STONE_GOLEM = 257;
const S_GOLEM = 55;
const G_UNIQ = 0x1000;
const M2_PNAME = 0x00080000;


interface PetrificationContactResult {
    touched: boolean;
    died: boolean;
}

export function touchPetrifies(mnum: number | undefined): mnum is typeof PM_CHICKATRICE | typeof PM_COCKATRICE {
    return mnum === PM_CHICKATRICE || mnum === PM_COCKATRICE;
}

export function fleshPetrifies(mnum: number | undefined): mnum is typeof PM_CHICKATRICE | typeof PM_COCKATRICE | typeof PM_MEDUSA {
    return touchPetrifies(mnum) || mnum === PM_MEDUSA;
}

// C mhitm.c:attk_protection(). Bites cannot be insulated by worn armor.
export function contactIsProtected(attackType: number, wornMask: number, usedWeapon = false): boolean {
    if ([AT_NONE, AT_SPIT, AT_EXPL, AT_BOOM, AT_GAZE, AT_BREA, AT_MAGC]
        .includes(attackType)) return true;
    if ([AT_CLAW, AT_TUCH, AT_WEAP].includes(attackType))
        return usedWeapon || !!(wornMask & W_ARMG);
    if (attackType === AT_KICK) return !!(wornMask & W_ARMF);
    if (attackType === AT_BUTT) return !!(wornMask & W_ARMH);
    if (attackType === AT_HUGS)
        return (wornMask & (W_ARMC | W_ARMG)) === (W_ARMC | W_ARMG);
    return false;
}

export function heroResistsStoning(state: GameState = game): boolean {
    return !!state.u?.stoneResistance;
}

export function heroIsPetrifying(state: GameState = game): boolean {
    return !!state.u?.stoned || (state.u?.stonedTurns ?? 0) > 0;
}

export function startHeroPetrification({
    state = game,
    turns = 5,
    killer = '',
    killerFormat = KILLED_BY_AN,
}: { state?: GameState; turns?: number; killer?: string; killerFormat?: PetrificationKillerFormat } = {}): boolean {
    const hero = state.u;
    if (heroIsPetrifying(state)
        || hero.stoneResistance) return false;
    hero.stonedTurns = turns;
    hero.stoned = turns > 0;
    if (hero.stoned) state.context.botl = true;
    hero.stoneKiller = killer;
    hero.stoneKillerFormat = killerFormat;
    return hero.stoned;
}

export function clearHeroPetrification(state: GameState = game): boolean {
    const hero = state.u;
    const wasPetrifying = heroIsPetrifying(state);
    if (wasPetrifying) state.context.botl = true;
    hero.stonedTurns = 0;
    hero.stoned = false;
    delete hero.stoneKiller;
    delete hero.stoneKillerFormat;
    return wasPetrifying;
}





// C mondata.c:poly_when_stoned(): a non-stone golem hero becomes a stone
// golem only if stone golems have not been genocided.
function heroPolymorphsWhenStoned(state: GameState = game): boolean {
    return heroIsPolymorphed(state)
        && formCanBecomeStoneGolem(state.u?.umonnum, state);
}

export function formCanBecomeStoneGolem(mnum: number | undefined, state: GameState = game): boolean {
    const stoneGolemGenocided = !!(
        (state.mvitals?.[PM_STONE_GOLEM]?.mvflags ?? 0) & G_GENOD
    );
    return mnum !== undefined && monsterIsGolem(mnum) && mnum !== PM_STONE_GOLEM
        && !stoneGolemGenocided;
}

export function heroWouldPetrifyFromFlesh(mnum: number | undefined, state: GameState = game): boolean {
    return fleshPetrifies(mnum)
        && !heroResistsStoning(state)
        && !heroPolymorphsWhenStoned(state);
}

export async function selfTouchPetrifyingWeapons({
    messageStart = 'No longer petrify-resistant, you',
    state = game,
    publish = pline,
    die = finishHeroDeath,
}: {
    messageStart?: string;
    state?: GameState;
    publish?: MessagePublisher;
    die?: DeathHandler;
} = {}) {
    if (heroResistsStoning(state))
        return { touched: false, died: false };

    let touched = false;
    for (let slot = 0; slot < 2; slot++) {
        const weapon = slot === 0
            ? state.uwep || state.u?.uwep
            : state.u?.twoweap
                ? state.uswapwep || state.u?.uswapwep : null;
        if (weapon?.otyp !== CORPSE || !touchPetrifies(weapon.corpsenm))
            continue;
        touched = true;
        // C trap.c:selftouch() names the species with obj_pmname(), not
        // corpse_xname(), so unique and personal species stay unadorned.
        const species = objectMonsterName(weapon);
        await publish(`${messageStart} touch the ${species} corpse.`);
        const result = await resolveImmediatePetrification({
            killer: `${withIndefiniteArticle(species)} corpse`,
            state, publish, die,
        });
        if (result.died) return { touched: true, died: true };
        if (!(state.uarmg || state.u?.uarmg) && !heroResistsStoning(state)) {
            // C trap.c:selftouch() unwields through the gone() family.
            if (slot === 0) await uwepgone(state);
            else await uswapwepgone(state);
        }
    }
    return { touched, died: false };
}

// C invent.c:will_feel_cockatrice()/feel_cockatrice(). Unlike picking up a
// corpse, a floor inspection only touches it when blind or explicitly forced.
export function willFeelPetrifyingCorpse(
    object: GameObject,
    { forceTouch = false, state = game }: { forceTouch?: boolean; state?: GameState } = {},
): boolean {
    return (heroIsBlind(state) || forceTouch)
        && !(state.uarmg || state.u?.uarmg) && !heroResistsStoning(state)
        && object.otyp === CORPSE && touchPetrifies(object.corpsenm);
}

export async function feelPetrifyingCorpse(object: GameObject, {
    forceTouch = false, state = game, publish = plineWithContinuation,
}: { forceTouch?: boolean; state?: GameState; publish?: MessagePublisher } = {}): Promise<PetrificationContactResult> {
    if (!willFeelPetrifyingCorpse(object, { forceTouch, state }))
        return { touched: false, died: false };
    const corpse = corpseName(object, { definite: true });
    if (formCanBecomeStoneGolem(state.u.umonnum, state))
        await publish(`You touched ${corpse} with your bare ${makePlural(heroHandName(state))}.`);
    else
        await publish(`Touching ${corpse} is a fatal mistake...`);
    const result = await resolveImmediatePetrification({
        state, publish,
        killer: `touching ${killerObjectName(object, state)} bare-handed`,
    });
    return { touched: true, died: result.died };
}

// C apply.c:use_whip(): a snatched corpse is named by cxname() before it
// moves, and that name is also the death reason.
export async function snatchPetrifyingCorpse(object: GameObject | null | undefined, {
    beforeDeath = null,
}: { beforeDeath?: (() => unknown) | null } = {}): Promise<{ died: boolean } | null> {
    if (!handlesPetrifyingCorpseBareHanded(object)) return null;
    const name = corpseName(object);
    const corpse = objectQuantity(object) === 1 ? withIndefiniteArticle(name) : name;
    return await petrifyFromCorpseContact(`Snatching ${corpse} is a fatal mistake.`, corpse, beforeDeath);
}

export function handlesPetrifyingCorpseBareHanded(object: GameObject | null | undefined): object is GameObject {
    return object?.otyp === CORPSE && touchPetrifies(object.corpsenm)
        && !(game.uarmg || game.u?.uarmg) && !heroResistsStoning();
}

export async function petrifyFromCorpseContact(
    message: string, killer: string, beforeDeath: (() => unknown) | null = null,
): Promise<{ died: boolean } | null> {
    // Pickup and snatching try the golem conversion before warning or
    // placing a snatched corpse on the floor for death cleanup.
    if (formCanBecomeStoneGolem(game.u.umonnum)) {
        const result = await polymonHero(PM_STONE_GOLEM);
        if (result.died) return { died: true };
        if (result.transformed) return null;
    }
    await plineWithContinuation(message);
    await beforeDeath?.();
    const result = await resolveImmediatePetrification({
        killer,
        publish: plineWithContinuation,
    });
    return { died: result.died };
}

export async function eatPetrifyingEgg(object: GameObject | null | undefined): Promise<{ started: boolean; transformed?: boolean }> {
    if (object?.otyp !== EGG || !fleshPetrifies(object.corpsenm)
        || heroResistsStoning()) return { started: false };

    if (formCanBecomeStoneGolem(game.u.umonnum)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }

    const species = corpseSpeciesName(object);
    const started = startHeroPetrification({
        killer: `${species} egg`,
    });
    return { started, transformed: false };
}

export async function hitByPetrifyingEgg(object: GameObject | null | undefined, state: GameState = game): Promise<{ started: boolean; transformed: boolean }> {
    if (object?.otyp !== EGG || !touchPetrifies(object.corpsenm)
        || heroResistsStoning(state)) {
        return { started: false, transformed: false };
    }

    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }

    const started = startHeroPetrification({ state, killer: '', killerFormat: KILLED_BY });
    return { started, transformed: false };
}

function corpseSpeciesName(object: Pick<GameObject, 'corpsenm'>): string {
    if (object.corpsenm === undefined)
        throw new Error('Petrifying contact requires a corpse or egg species.');
    return requireMonsterData(MONSTER_NAME, object.corpsenm);
}

