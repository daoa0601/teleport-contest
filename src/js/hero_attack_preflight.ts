// Attack permission and hidden-monster discovery before a hero weapon strike.
// C ref: uhitm.c attack_checks().

import { setHeroGrip } from './hero_grip.js';
import { heroIsHallucinating } from './senses.js';
import { isPoolAt } from './terrain_properties.js';
import { observeObjectForNaming } from './objnam.js';
import { artifactById } from './artifacts.js';
import { AD_STCK } from './monster_attack_types.js';
import {
    M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, PARANOID_HIT,
    STRAT_WAITMASK,
} from './const.js';
import {
    canSeeMonster, canSenseMonster, canSpotMonster, glyphAt, map_invisible,
    newsym,
    plineWithContinuation,
    senseWithTelepathy,
} from './display.js';
import { heroDetectsMonsters } from './senses.js';
import { floorObjectDescription } from './floor_object_display.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import { stumbleOntoMimic } from './mimic.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_SYMBOL,
    requireMonsterData,
} from './monster_data.js';
import { paranoidQuery } from './query.js';
import { monsterName, monsterLeashName } from './monster_name.js';
import { withIndefiniteArticle } from './object_grammar.js';

export interface AppliedWeaponAttackOptions {
    state?: GameState;
    // C gb.bhitpos: a struck worm tail can be away from the head.
    struckAt?: Position;
}

export interface AppliedWeaponAttackPermission {
    proceed: boolean;
    spentTime: boolean;
    confirmationOverridden?: boolean;
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

async function floorObjectName(x: number, y: number, state: GameState) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object) return null;
    observeObjectForNaming(object, { state });
    return await floorObjectDescription(object);
}

async function publishHiddenMonster(monster: Monster, state: GameState) {
    const blind = heroIsBlind(state);
    const hallucinating = heroIsHallucinating(state);
    const perceivedName = monsterLeashName(monster, state);
    const visibleName = perceivedName === 'it' ? null : perceivedName;
    if (!blind && hallucinating) {
        const disposition = monster.mtame ? 'tame' : 'wild';
        const noun = visibleName || 'creature';
        const verb = visibleName ? 'appears' : 'is present';
        await plineWithContinuation(`A ${disposition} ${noun} ${verb}!`);
        return;
    }

    const submergedCover = isPoolAt(monster.mx, monster.my, state)
        && !(state.underwater || state.u.uinwater);
    if (blind || submergedCover) {
        await plineWithContinuation("Wait!  There's a hidden monster there!");
        return;
    }

    const cover = await floorObjectName(monster.mx, monster.my, state);
    if (cover) {
        await plineWithContinuation(
            `Wait!  There's ${visibleName
                ? withIndefiniteArticle(visibleName) : 'something'} hiding under ${cover}!`,
        );
    }
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
            setHeroGrip(monster, state);
        }
        await wakeAttackedMonster(monster);
        return { proceed: false, spentTime: true };
    }

    if (unrevealedAppearance && !sensed && !glyph.warning) {
        if (glyph.invisible) {
            revealMonsterAppearance(monster);
            return { proceed: true, spentTime: false };
        }
        await stumbleOntoMimic(monster, state);
        return { proceed: false, spentTime: true };
    }

    if (monster.mundetected
        && !canSeeMonster(monster)
        && !glyph.warning && (hidesUnder(monster) || isEel(monster))) {
        monster.mundetected = 0;
        monster.msleeping = 0;
        newsym(monster.mx, monster.my);
        if (glyph.invisible) {
            // C seemimic() redraws the square even without a disguise to drop.
            if (!revealMonsterAppearance(monster).revealed) newsym(monster.mx, monster.my);
            return { proceed: true, spentTime: false };
        }
        if (!senseWithTelepathy(monster) && !heroDetectsMonsters()) {
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
            return { proceed: true, spentTime: false, confirmationOverridden: true };
        if (canSpotMonster(monster)) {
            const paranoid = !!((state.flags?.paranoia_bits ?? 0)
                & PARANOID_HIT);
            const accepted = await paranoidQuery(
                paranoid, `Really attack ${monsterName(monster, { state })}?`,
                state.flags?.paranoia_bits ?? 0,
            );
            if (!accepted) return { proceed: false, spentTime: false };
        }
    }

    return { proceed: true, spentTime: false };
}
