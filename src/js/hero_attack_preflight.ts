// Attack permission and hidden-monster discovery before a hero weapon strike.
// C ref: uhitm.c attack_checks().

import { heroIsHallucinating } from './senses.js';
import { observeObjectForNaming } from './objnam.js';
import { artifactById } from './artifacts.js';
import { AD_STCK } from './monster_attack_types.js';
import {
    IS_POOL, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, PARANOID_HIT,
    STRAT_WAITMASK,
} from './const.js';
import {
    canSeeMonster, canSenseMonster, canSpotMonster, glyphAt, map_invisible,
    newsym,
    plineWithContinuation, randomDisplayMonsterName,
} from './display.js';
import { floorObjectDescription } from './floor_object_display.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import { revealMimic } from './mimic.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL,
    requireMonsterData,
} from './monster_data.js';
import { paranoidQuery } from './query.js';

export interface AppliedWeaponAttackOptions {
    state?: GameState;
    // C gb.bhitpos: a struck worm tail can be away from the head.
    struckAt?: Position;
}

export interface AppliedWeaponAttackPermission {
    proceed: boolean;
    spentTime: boolean;
}

const M1_CONCEAL = 0x00000080;
const S_EEL = 57;
const DISGUISE_TYPES = new Set([
    M_AP_OBJECT, M_AP_FURNITURE, M_AP_MONSTER,
]);

function heroIsBlind(state: GameState) {
    return !!(state.blind || state.u?.blind || (state.u?.blindTurns ?? 0) > 0);
}

function heroIsImpaired(state: GameState) {
    const hero = state.u;
    return !!(hero?.confused || (hero?.confusionTurns ?? 0) > 0
        || heroIsHallucinating(state)
        || hero?.stunned || (hero?.stunnedTurns ?? 0) > 0);
}

function shapechangerProtection(state: GameState) {
    return !!(state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers);
}

function targetGlyphState(at: Position, state: GameState) {
    const glyph = glyphAt(at.x, at.y, state);
    return {
        invisible: glyph?.kind === 'invisible',
        warning: glyph?.kind === 'warning',
    };
}

function hasUnrevealedAppearance(monster: Monster, state: GameState) {
    return DISGUISE_TYPES.has(M_AP_TYPE(monster))
        && !shapechangerProtection(state);
}

function hidesUnder(monster: Monster) {
    return !!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_CONCEAL);
}

function isEel(monster: Monster) {
    return MONSTER_SYMBOL[monster?.mnum] === S_EEL;
}

// C dmgtype(mtmp->data, AD_STCK): any attack of the species adheres.
function hasStickyAttack(monster: Monster) {
    return requireMonsterData(MONSTER_ATTACKS, monster.mnum)
        .some(attack => attack[1] === AD_STCK);
}

// C m_next2u(m): the squared euclidean distance to the hero is at most 2.
function isAdjacentToHero(monster: Monster, state: GameState) {
    const dx = monster.mx - (state.u?.ux ?? monster.mx);
    const dy = monster.my - (state.u?.uy ?? monster.my);
    return dx * dx + dy * dy <= 2;
}

function targetName(monster: Monster) {
    if (monster.name) return monster.name;
    const species = MONSTER_NAME[monster.mnum] || 'monster';
    return monster.mtame || monster.pet ? `your ${species}` : `the ${species}`;
}

function indefiniteName(name: string) {
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function locallyVisibleMonsterName(monster: Monster, state: GameState) {
    if (!canSeeMonster(monster)) return null;
    if (heroIsHallucinating(state))
        return randomDisplayMonsterName();
    return monster.name || MONSTER_NAME[monster.mnum] || 'monster';
}

function floorObjectName(x: number, y: number, state: GameState) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object) return null;
    observeObjectForNaming(object, { state });
    return floorObjectDescription(object);
}

async function publishHiddenMonster(monster: Monster, state: GameState) {
    const blind = heroIsBlind(state);
    const hallucinating = heroIsHallucinating(state);
    const visibleName = locallyVisibleMonsterName(monster, state);
    if (!blind && hallucinating) {
        const disposition = monster.mtame ? 'tame' : 'wild';
        const noun = visibleName || 'creature';
        const verb = visibleName ? 'appears' : 'is present';
        await plineWithContinuation(`A ${disposition} ${noun} ${verb}!`);
        return;
    }

    const terrain = state.level?.at?.(monster.mx, monster.my)?.typ;
    const submergedCover = terrain !== undefined && IS_POOL(terrain)
        && !(state.underwater || state.u.uinwater);
    if (blind || submergedCover) {
        await plineWithContinuation("Wait!  There's a hidden monster there!");
        return;
    }

    const cover = floorObjectName(monster.mx, monster.my, state);
    if (cover) {
        await plineWithContinuation(
            `Wait!  There's ${visibleName
                ? indefiniteName(visibleName) : 'something'} hiding under ${cover}!`,
        );
    }
}

async function revealDisguisedMonster(monster: Monster, state: GameState) {
    if ([M_AP_OBJECT, M_AP_FURNITURE].includes(M_AP_TYPE(monster))) {
        await revealMimic(monster, state);
        return;
    }

    const apparent = (monster.mappearance === undefined ? undefined
        : MONSTER_NAME[monster.mappearance]) || 'monster';
    const actual = monster.minvis
        && !(state.u?.seeInvisible
            || (state.u?.seeInvisibleTurns ?? 0) > 0)
        ? 'a monster'
        : indefiniteName(MONSTER_NAME[monster.mnum] || 'monster');
    await plineWithContinuation(
        `Wait!  That ${apparent} is really ${actual}!`,
    );
    revealMonsterAppearance(monster);
}

function stormbringerOverridesConfirmation(weapon: GameObject | null, state: GameState) {
    return artifactById(weapon?.oartifact, state)?.name === 'Stormbringer';
}

export async function prepareAppliedWeaponAttack(
    monster: Monster, weapon: GameObject | null,
    { state = game, struckAt }: AppliedWeaponAttackOptions = {},
): Promise<AppliedWeaponAttackPermission> {
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;

    if (state.u?.uswallow && state.u?.ustuck === monster)
        return { proceed: true, spentTime: false };
    if (state.context?.forcefight)
        return { proceed: true, spentTime: false };

    // Read and mark the struck square, including when it is a worm tail.
    const struck = struckAt ?? { x: monster.mx, y: monster.my };
    const glyph = targetGlyphState(struck, state);
    const sensed = canSenseMonster(monster);
    const unrevealedAppearance = hasUnrevealedAppearance(monster, state);
    const spotted = canSpotMonster(monster);
    const hiddenUnderVisibleCover = !heroIsBlind(state)
        && monster.mundetected && hidesUnder(monster);

    if (!spotted && !glyph.warning && !glyph.invisible
        && !hiddenUnderVisibleCover) {
        await plineWithContinuation(
            "Wait!  There's something there you can't see!",
        );
        map_invisible(struck.x, struck.y);
        // An unseen mimic sticks to the hero before being woken, exactly
        // as if it had been stumbled upon while visible.
        if (hasUnrevealedAppearance(monster, state) && !state.u.ustuck
            && !monster.mflee && hasStickyAttack(monster)
            && isAdjacentToHero(monster, state)) {
            state.u.ustuck = monster;
        }
        await wakeAttackedMonster(monster);
        return { proceed: false, spentTime: true };
    }

    if (unrevealedAppearance && !sensed && !glyph.warning) {
        if (glyph.invisible) {
            revealMonsterAppearance(monster);
            return { proceed: true, spentTime: false };
        }
        await revealDisguisedMonster(monster, state);
        return { proceed: false, spentTime: true };
    }

    if (monster.mundetected
        && !canSeeMonster(monster)
        && !glyph.warning && (hidesUnder(monster) || isEel(monster))) {
        monster.mundetected = 0;
        monster.msleeping = 0;
        newsym(monster.mx, monster.my);
        if (glyph.invisible) {
            revealMonsterAppearance(monster);
            return { proceed: true, spentTime: false };
        }
        if (!canSenseMonster(monster)) {
            await publishHiddenMonster(monster, state);
            return { proceed: false, spentTime: true };
        }
    }

    if ((monster.mundetected || monster.m_ap_type) && canSenseMonster(monster)) {
        monster.mundetected = 0;
        await wakeAttackedMonster(monster);
    }

    const confirm = state.flags?.confirm !== false;
    if (confirm && monster.mpeaceful && !heroIsImpaired(state)) {
        if (stormbringerOverridesConfirmation(weapon, state))
            return { proceed: true, spentTime: false };
        if (canSpotMonster(monster)) {
            const paranoid = !!((state.flags?.paranoia_bits ?? 0)
                & PARANOID_HIT);
            const accepted = await paranoidQuery(
                paranoid, `Really attack ${targetName(monster)}?`,
                state.flags?.paranoia_bits ?? 0,
            );
            if (!accepted) return { proceed: false, spentTime: false };
        }
    }

    return { proceed: true, spentTime: false };
}
