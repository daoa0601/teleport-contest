// Attack permission and hidden-monster discovery before a hero weapon strike.
// C ref: uhitm.c attack_checks().
import { heroIsHallucinating } from './senses.js';
import { observeObjectForNaming } from './objnam.js';
import { artifactById } from './artifacts.js';
import { IS_POOL, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, PARANOID_HIT, STRAT_WAITMASK, } from './const.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, glyphAt, map_invisible, newsym, plineWithContinuation, randomDisplayMonsterName, } from './display.js';
import { floorObjectDescription } from './floor_object_display.js';
import { game } from './gstate.js';
import { revealMimic } from './mimic.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL, } from './monster_data.js';
import { paranoidQuery } from './query.js';
const M1_CONCEAL = 0x00000080;
const S_EEL = 57;
const DISGUISE_TYPES = new Set([
    M_AP_OBJECT, M_AP_FURNITURE, M_AP_MONSTER,
]);
function heroIsBlind(state) {
    return !!(state.blind || state.u?.blind || (state.u?.blindTurns ?? 0) > 0);
}
function heroIsImpaired(state) {
    const hero = state.u;
    return !!(hero?.confused || (hero?.confusionTurns ?? 0) > 0
        || heroIsHallucinating(state)
        || hero?.stunned || (hero?.stunnedTurns ?? 0) > 0);
}
function shapechangerProtection(state) {
    return !!(state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers);
}
function targetGlyphState(monster, state) {
    const glyph = glyphAt(monster.mx, monster.my, state);
    return {
        invisible: glyph?.kind === 'invisible',
        warning: glyph?.kind === 'warning',
    };
}
function hasUnrevealedAppearance(monster, state) {
    return DISGUISE_TYPES.has(M_AP_TYPE(monster))
        && !shapechangerProtection(state);
}
function hidesUnder(monster) {
    return !!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_CONCEAL);
}
function isEel(monster) {
    return MONSTER_SYMBOL[monster?.mnum] === S_EEL;
}
function targetName(monster) {
    if (monster.name)
        return monster.name;
    const species = MONSTER_NAME[monster.mnum] || 'monster';
    return monster.mtame || monster.pet ? `your ${species}` : `the ${species}`;
}
function indefiniteName(name) {
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}
function locallyVisibleMonsterName(monster, state) {
    if (!canSeeMonster(monster))
        return null;
    if (heroIsHallucinating(state))
        return randomDisplayMonsterName();
    return monster.name || MONSTER_NAME[monster.mnum] || 'monster';
}
function floorObjectName(x, y, state) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object)
        return null;
    observeObjectForNaming(object, { state });
    return floorObjectDescription(object);
}
async function publishHiddenMonster(monster, state) {
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
        await plineWithContinuation(`Wait!  There's ${visibleName
            ? indefiniteName(visibleName) : 'something'} hiding under ${cover}!`);
    }
}
async function revealDisguisedMonster(monster, state) {
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
    await plineWithContinuation(`Wait!  That ${apparent} is really ${actual}!`);
    revealMonsterAppearance(monster);
}
function stormbringerOverridesConfirmation(weapon, state) {
    return artifactById(weapon?.oartifact, state)?.name === 'Stormbringer';
}
export async function prepareAppliedWeaponAttack(monster, weapon, { state = game } = {}) {
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (state.u?.uswallow && state.u?.ustuck === monster)
        return { proceed: true, spentTime: false };
    if (state.context?.forcefight)
        return { proceed: true, spentTime: false };
    const glyph = targetGlyphState(monster, state);
    const sensed = canSenseMonster(monster);
    const unrevealedAppearance = hasUnrevealedAppearance(monster, state);
    const spotted = canSpotMonster(monster);
    const hiddenUnderVisibleCover = !heroIsBlind(state)
        && monster.mundetected && hidesUnder(monster);
    if (!spotted && !glyph.warning && !glyph.invisible
        && !hiddenUnderVisibleCover) {
        await plineWithContinuation("Wait!  There's something there you can't see!");
        map_invisible(monster.mx, monster.my);
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
            const accepted = await paranoidQuery(paranoid, `Really attack ${targetName(monster)}?`, state.flags?.paranoia_bits ?? 0);
            if (!accepted)
                return { proceed: false, spentTime: false };
        }
    }
    return { proceed: true, spentTime: false };
}
//# sourceMappingURL=hero_attack_preflight.js.map