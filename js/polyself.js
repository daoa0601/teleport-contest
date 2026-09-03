// polyself.js — Hero polymorph state and equipment transaction.
// C refs: polyself.c polyself(), polymon(), break_armor(), drop_weapon().

import { game } from './gstate.js';
import { d, rnd, rn2 } from './rng.js';
import {
    adjustLevelAbilities, newExperienceThreshold,
} from './exper.js';
import {
    MONSTER_ATTACKS, MONSTER_EXPERIENCE_META, MONSTER_FLAGS1,
    MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME,
    MONSTER_SIZE, MONSTER_SYMBOL, SPECIAL_PM, monsterBreaksArmor,
    monsterHasNoHands, monsterHornCount, monsterIsCentaur,
    monsterIsSlithy, monsterIsVampire, monsterIsVerySmall,
    monsterIsWhirly, monsterSlipsArmor, monsterWrappingAllowed,
    validVampireShiftForm,
} from './monster_data.js';
import {
    AD_STCK, AD_WRAP, AT_ENGL, AT_HUGS,
} from './monster_attack_types.js';
import {
    AMULET_OF_UNCHANGING, LENSES, OBJECT_MATERIAL,
    RIN_POLYMORPH_CONTROL, RIN_PROTECTION_FROM_SHAPE_CHANGERS,
} from './object_data.js';
import {
    newsym, pline, plineWithContinuation, see_monsters,
} from './display.js';
import { place_object } from './floor_object.js';
import { moreUntilDismissed } from './tty_prompts.js';
import { findArmorClass } from './armor.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';
import {
    A_CHA, A_CON, A_DEX, A_STR, A_WIS, STAIRS,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import { syncBlindness } from './senses.js';
import { golemHitPoints } from './monster_hit_points.js';
import { finishHeroDeath } from './end.js';
import { cureHeroSickness } from './hero_illness.js';
import {
    clearHeroPetrification, selfTouchPetrifyingWeapons,
} from './stoning.js';
import { heroHasNoHead } from './hero_species.js';
import { retouchEquipment } from './hero_retouch.js';
import {
    heroIsSliming, resetHeroSlimingCountdown,
} from './slime.js';

const M1_NOEYES = 0x00001000;
const M1_NOTAKE = 0x00000800;
const M1_NOLIMBS = 0x00006000;
const M1_FLY = 0x00000001;
const M1_CLING = 0x00000010;
const M1_CONCEAL = 0x00000080;
const M1_HIDE = 0x00000100;
const M1_OVIPAROUS = 0x00400000;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const M2_STRONG = 0x04000000;
const MZ_SMALL = 1;
const S_MIMIC = 13;
const S_DRAGON = 30;
const MAXULEV = 30;
const MUMMY_WRAPPING = 138;
const ALCHEMY_SMOCK = 144;
const LEATHER = 7;
const OLFACTIONLESS_SYMBOLS = new Set([
    2,  // S_BLOB
    5,  // S_EYE
    10, // S_JELLY
    22, // S_VORTEX
    25, // S_LIGHT
    31, // S_ELEMENTAL
    32, // S_FUNGUS
    42, // S_PUDDING
    55, // S_GOLEM
]);

function wornPropertyObject(state, otyp, slots) {
    return slots.some(slot => {
        const object = state[slot] || state.u?.[slot];
        return object?.otyp === otyp && object.worn !== false;
    });
}

export function heroHasPolymorphControl(state = game) {
    return !!(state.u?.polymorphControl || state.polymorphControl)
        || wornPropertyObject(
            state, RIN_POLYMORPH_CONTROL, ['uleft', 'uright'],
        );
}

export function heroIsUnchanging(state = game) {
    return !!(state.u?.unchanging || state.unchanging)
        || wornPropertyObject(state, AMULET_OF_UNCHANGING, ['uamul']);
}

export function heroCanControlPolymorph(state = game) {
    const unaware = !!(state.u?.unaware || state.unaware
        || state._helplessReason === 'unconscious from rotten food'
        || state._helplessReason === 'unconscious from drinking'
        || state._helplessReason === 'sleeping off a magical draught');
    const stunned = !!(state.u?.stunned
        || (state.u?.stunnedTurns ?? 0) > 0);
    return heroHasPolymorphControl(state) && !unaware && !stunned;
}

export function heroHasProtectionFromShapeChangers(state = game) {
    if (state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers) return true;
    return wornPropertyObject(
        state,
        RIN_PROTECTION_FROM_SHAPE_CHANGERS,
        ['uleft', 'uright'],
    );
}

export function heroIsPolymorphed(state = game) {
    const u = state.u;
    if ((u?.mtimedone ?? 0) > 0) return true;
    return Number.isInteger(u?.umonnum)
        && Number.isInteger(u?.umonster)
        && u.umonnum !== u.umonster;
}

export function heroMonsterForm(state = game) {
    return heroIsPolymorphed(state) ? state.u.umonnum : null;
}

export function heroFormFlags(state = game) {
    const form = heroMonsterForm(state);
    return form == null ? 0 : MONSTER_FLAGS1[form] ?? 0;
}

export function heroIsFlying(state = game) {
    return !!(state.u?.flying || state.u?.flight || state.flying)
        || !!(heroFormFlags(state) & M1_FLY);
}

export function heroFormClings(state = game) {
    return !!(heroFormFlags(state) & M1_CLING);
}

export function heroFormHidesUnderObjects(state = game) {
    return !!(heroFormFlags(state) & M1_CONCEAL);
}

export function heroFormHidesWithoutCover(state = game) {
    return !!(heroFormFlags(state) & M1_HIDE);
}

export function heroHidesOnCeiling(state = game) {
    const form = heroMonsterForm(state);
    if (form == null || !state.u?.uundetected
        || !heroFormHidesWithoutCover(state)) return false;
    return heroIsFlying(state)
        || (heroFormClings(state) && MONSTER_SYMBOL[form] !== S_MIMIC);
}

// C ref: mondata.c sticks().
export function heroFormSticks(state = game) {
    const form = heroMonsterForm(state);
    if (form === null) return false;
    const attacks = MONSTER_ATTACKS[form] || [];
    const engulfs = attacks.some(([attackType]) => attackType === AT_ENGL);
    return attacks.some(([, damageType]) => damageType === AD_STCK)
        || (!engulfs
            && attacks.some(([, damageType]) => damageType === AD_WRAP))
        || attacks.some(([attackType]) => attackType === AT_HUGS);
}

export function heroHasNoHands(state = game) {
    if (!heroIsPolymorphed(state)) return false;
    return monsterHasNoHands(state.u?.umonnum);
}

export function heroCannotTake(state = game) {
    if (!heroIsPolymorphed(state)) return false;
    return !!((MONSTER_FLAGS1[state.u?.umonnum] ?? 0) & M1_NOTAKE);
}

export function heroHasNoLimbs(state = game) {
    if (!heroIsPolymorphed(state)) return false;
    return ((MONSTER_FLAGS1[state.u?.umonnum] ?? 0) & M1_NOLIMBS)
        === M1_NOLIMBS;
}

export function heroIsVerySmall(state = game) {
    if (!heroIsPolymorphed(state)) return false;
    return monsterIsVerySmall(state.u?.umonnum);
}

export function heroHasEyes(state = game) {
    if (!heroIsPolymorphed(state)) return true;
    return !((MONSTER_FLAGS1[state.u?.umonnum] ?? 0) & M1_NOEYES);
}

// C mondata.c:olfaction().  This is a current-form sensory capability, not
// a blindness check: molds and several other body classes can sense smoke
// but cannot smell it, while an ordinary blind humanoid still has olfaction.
export function heroHasOlfaction(state = game) {
    if (!heroIsPolymorphed(state)) return true;
    return !OLFACTIONLESS_SYMBOLS.has(
        MONSTER_SYMBOL[state.u?.umonnum],
    );
}

// C polyself.c:rehumanize()/polyman().  Keep the form-state transaction
// separate from message projection: callers such as mdamageu() can cross a
// tty --More-- boundary between the urgent return line, restored sight, and
// the encumbrance follow-up while this state change itself stays atomic.
export function rehumanizeHero(state = game) {
    const u = state.u;
    if (!u || !heroIsPolymorphed(state)) {
        return { changed: false, regainedSight: false };
    }

    const wasBlindFromForm = !!state._blindFromMonsterForm;
    const previousEncumbrance = Number.isInteger(state._encumbranceLevel)
        ? state._encumbranceLevel : nearCapacity(state);
    if (u.macurr) u.acurr = u.macurr;
    if (u.mamax) u.amax = u.mamax;
    if (Number.isInteger(u.umonster)) u.umonnum = u.umonster;
    if (state.flags && typeof u.mfemale === 'boolean')
        state.flags.female = u.mfemale;

    u.mh = 0;
    u.mhmax = 0;
    u.mtimedone = 0;
    u.mcham = -1;
    u.uundetected = 0;
    delete u.formArmorClass;
    delete u.flying;

    let regainedSight = false;
    if (wasBlindFromForm) {
        delete state._blindFromMonsterForm;
        regainedSight = !syncBlindness(state);
    }

    findArmorClass(state);
    state.vision_full_recalc = 1;
    state._encumbranceLevel = nearCapacity(state);
    u._encumbrance = encumbranceLabel(state._encumbranceLevel);
    newsym(u.ux, u.uy);
    return {
        changed: true,
        regainedSight,
        race: state.urace?.adj || state.urace?.noun || 'human',
        encumbranceMessage: encumbranceMessage(
            previousEncumbrance, state._encumbranceLevel,
        ),
    };
}

function clearEquipmentSlot(slot, object) {
    if (game[slot] === object) game[slot] = null;
    if (game.u?.[slot] === object) game.u[slot] = null;
}

function dropCarriedObject(object, slots = []) {
    if (!object) return;
    const index = game.inventory?.indexOf(object) ?? -1;
    if (index >= 0) game.inventory.splice(index, 1);
    for (const slot of slots) clearEquipmentSlot(slot, object);
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = 0;
    place_object(object, game.u.ux, game.u.uy);
    newsym(game.u.ux, game.u.uy);
}

function destroyCarriedObject(object, slots = []) {
    if (!object) return;
    const index = game.inventory?.indexOf(object) ?? -1;
    if (index >= 0) game.inventory.splice(index, 1);
    for (const slot of slots) clearEquipmentSlot(slot, object);
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = 0;
    object.where = 'gone';
}

function heroSurfaceName() {
    const location = game.level?.locations?.[game.u.ux]?.[game.u.uy];
    return location?.typ === STAIRS ? 'stairs' : 'floor';
}

function beginMonsterForm(mnum, { sexChangeAllowed = false } = {}) {
    const u = game.u;
    const previousMnum = u.umonnum;
    const remainedVampireShifter = validVampireShiftForm(u.mcham, mnum);
    const wasPolymorphed = heroIsPolymorphed(game);
    if (!wasPolymorphed) {
        u.macurr = { a: [...(u.acurr?.a || [])] };
        u.mamax = { a: [...(u.amax?.a || [])] };
        u.mfemale = !!game.flags?.female;
    }

    if (!u.uconduct) u.uconduct = {};
    u.uconduct.polyselfs = (u.uconduct.polyselfs || 0) + 1;

    // polymon() exercises the human attributes before installing the
    // monster form, so these two calls belong ahead of duration and HP.
    exerciseAttribute(A_CON, false);
    exerciseAttribute(A_WIS, true);

    if (wasPolymorphed) {
        u.acurr = { a: [...(u.macurr?.a || u.acurr?.a || [])] };
        u.amax = { a: [...(u.mamax?.a || u.amax?.a || [])] };
        if (game.flags) game.flags.female = !!u.mfemale;
    }

    const genderFlags = MONSTER_FLAGS2[mnum] ?? 0;
    if (sexChangeAllowed
        && !(genderFlags & (M2_MALE | M2_FEMALE | M2_NEUTER))
        && mnum !== u.ulycn
        && rn2(10) === 0) {
        if (game.flags) game.flags.female = !game.flags.female;
    }

    // mondata.c:set_mon_data() prorates unused movement when the new form is
    // slower, preventing a slow polymorph from inheriting extra actions from
    // its old body.  A faster form retains the already banked ration.
    const oldMove = wasPolymorphed
        ? (MONSTER_MOVE[previousMnum] ?? 0) : 12;
    const newMove = MONSTER_MOVE[mnum] ?? 0;
    if (u.umovement && newMove < oldMove && oldMove > 0)
        u.umovement = Math.trunc(u.umovement * newMove / oldMove);

    u.mtimedone = 500 + rn2(500);
    u.umonnum = mnum;
    if (heroHasProtectionFromShapeChangers(game)) u.mcham = -1;
    else if (monsterIsVampire(mnum)) u.mcham = mnum;
    else if (!remainedVampireShifter) u.mcham = -1;
    u.m_ap_type = 0;
    u.mappearance = 0;
    // do_wear.c:find_ac() starts from mons[u.umonnum].ac.  Keep that
    // form-owned base explicit so every existing equipment/protection
    // contribution can continue through the shared armor calculator.
    u.formArmorClass = MONSTER_EXPERIENCE_META[mnum]?.[0] ?? 10;
    if (!Number.isInteger(u.umonster)) {
        // role.c initializes u.umonster to the role's generated monster
        // record, not to the compact role-table index.  Role monsters begin
        // immediately after PM_LONG_WORM_TAIL/SPECIAL_PM.
        u.umonster = Number.isInteger(game.urole?.mnum)
            ? SPECIAL_PM + 1 + game.urole.mnum
            : (game.urace?.mnum ?? mnum);
    }

    const strong = !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_STRONG);
    if (strong) {
        // polyself.c:uasmon_maxStr(): ordinary strong forms use STR18(100).
        if (u.amax?.a) u.amax.a[A_STR] = 118;
        if (u.acurr?.a) u.acurr.a[A_STR] = 118;
    } else {
        // Non-strong forms retain current Strength but cap exceptional
        // Strength at 18 for the duration of the polymorph.
        if (u.amax?.a)
            u.amax.a[A_STR] = Math.min(u.amax.a[A_STR] ?? 18, 18);
        if (u.acurr?.a)
            u.acurr.a[A_STR] = Math.min(u.acurr.a[A_STR] ?? 18, 18);
    }

    const monsterLevel = MONSTER_LEVEL[mnum] ?? 0;
    const fixedGolemHitPoints = golemHitPoints(mnum);
    if (fixedGolemHitPoints) u.mhmax = fixedGolemHitPoints;
    else if (MONSTER_SYMBOL[mnum] === S_DRAGON && monsterLevel > 0)
        u.mhmax = 4 * monsterLevel + d(monsterLevel, 4);
    else u.mhmax = monsterLevel > 0 ? d(monsterLevel, 8) : rnd(4);
    u.mh = u.mhmax;
    if ((u.ulevel ?? 1) < monsterLevel) {
        u.mtimedone = Math.trunc(
            u.mtimedone * (u.ulevel ?? 1) / monsterLevel,
        );
    }
    u.flying = !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY);

    // Blind is a derived property of an eyeless current form.  Preserve its
    // provenance so rehumanize can later distinguish it from timed blindness.
    if (!heroHasEyes(game)) game._blindFromMonsterForm = true;
    else delete game._blindFromMonsterForm;
    syncBlindness(game);
    // polymon() does not repaint the accepted form until break_armor() has
    // completed.  A garment pager can therefore still expose the old hero
    // glyph even though monster HP and status metadata are already live.
    return { previousMnum, wasPolymorphed };
}

// C polyself.c:polymon().  Selection and legality remain caller-owned; this
// function owns the accepted form, equipment, encumbrance, and verbose
// ability transaction for controlled and involuntary transformations alike.
export async function polymonHero(mnum, {
    sexChangeAllowed = false,
    announceForm = true,
} = {}) {
    const previousCapacity = nearCapacity(game);
    const wasPolymorphed = heroIsPolymorphed(game);
    const previousMnum = game.u?.umonnum;
    beginMonsterForm(mnum, { sexChangeAllowed });

    const monsterName = MONSTER_NAME[mnum] || 'monster';
    const article = /^[aeiou]/i.test(monsterName) ? 'an' : 'a';
    const formMessage = wasPolymorphed && previousMnum === mnum
        ? `You feel like a new ${monsterName}!`
        : `You turn into ${article} ${monsterName}!`;
    const withFormMessage = message => announceForm
        ? `${formMessage}  ${message}` : message;
    const suit = game.uarm || game.u?.uarm;
    const cloak = game.uarmc || game.u?.uarmc;
    const shirt = game.uarmu || game.u?.uarmu;
    const helmet = game.uarmh || game.u?.uarmh;
    const gloves = game.uarmg || game.u?.uarmg;
    const shield = game.uarms || game.u?.uarms;
    const boots = game.uarmf || game.u?.uarmf;
    const eyewear = game.ublindf || game.u?.ublindf;
    const weapon = game.uwep || game.u?.uwep;
    const formFlags = MONSTER_FLAGS1[mnum] ?? 0;
    const whirly = monsterIsWhirly({ mnum });
    const verySmall = monsterIsVerySmall(mnum);
    const slithy = monsterIsSlithy(mnum);
    const centaur = monsterIsCentaur(mnum);
    const slipsArmor = monsterSlipsArmor(mnum);
    const breaksArmor = monsterBreaksArmor(mnum);
    const noHands = heroHasNoHands(game);
    const canBreathe = (MONSTER_ATTACKS[mnum] || [])
        .some(([attackType]) => attackType === 12);

    const transientCapacity = nearCapacity(game);
    game._encumbranceLevel = transientCapacity;
    game.u._encumbrance = encumbranceLabel(transientCapacity);
    let sequentialEquipmentMessages = false;
    let sourceCapacity = previousCapacity;
    const publishDropCapacityChange = async () => {
        const nextCapacity = nearCapacity(game);
        const message = encumbranceMessage(sourceCapacity, nextCapacity);
        sourceCapacity = nextCapacity;
        game._encumbranceLevel = nextCapacity;
        game.u._encumbrance = encumbranceLabel(nextCapacity);
        if (message) await plineWithContinuation(message);
    };

    if (breaksArmor && !suit && !cloak && !shirt
        && noHands && weapon && !gloves) {
        // With no garment prose, the later encumbrance line is what forces
        // tty to expose the combined form/drop-weapon pager.  Preserve the
        // pre-find_ac status while projecting the new glyph through dropx.
        newsym(game.u.ux, game.u.uy);
        await moreUntilDismissed(
            `${withFormMessage('You find you must drop your tool!')}--More--`,
        );
        dropCarriedObject(weapon, ['uwep']);
    } else if (breaksArmor) {
        // C polymon() publishes the accepted form before break_armor().
        // Sequential continuation calls preserve the exact point at which a
        // later garment line forces tty to page the already-pending prose.
        if (announceForm) await plineWithContinuation(formMessage);
        sequentialEquipmentMessages = announceForm;
        if (suit) {
            await plineWithContinuation('You break out of your armor!');
            destroyCarriedObject(suit, ['uarm']);
        }
        if (cloak) {
            if (cloak.otyp === MUMMY_WRAPPING
                && monsterWrappingAllowed(mnum)) {
                // The source wrapping spans eligible humanoid forms and stays
                // worn even though their ordinary armor must break.
            } else if (cloak.otyp === MUMMY_WRAPPING) {
                await plineWithContinuation('Your wrapping tears apart!');
                destroyCarriedObject(cloak, ['uarmc']);
            } else {
                await plineWithContinuation(
                    cloak.otyp === ALCHEMY_SMOCK
                        ? 'The knot on your apron is pulled apart!'
                        : 'The clasp on your cloak breaks open!',
                );
                dropCarriedObject(cloak, ['uarmc']);
            }
        }
        if (shirt) {
            await plineWithContinuation('Your shirt rips to shreds!');
            destroyCarriedObject(shirt, ['uarmu']);
        }
    } else if (slipsArmor && cloak) {
        // Native reaches this pager only after dropx()/newsym has projected
        // the small form, while its pre-removal AC is still painted.
        newsym(game.u.ux, game.u.uy);
        await moreUntilDismissed(
            `${withFormMessage('You shrink out of your cloak!')}--More--`,
        );
        dropCarriedObject(cloak, ['uarmc']);
    } else if (noHands && weapon && !gloves) {
        await moreUntilDismissed(
            `${withFormMessage('You find you must drop your tool!')}--More--`,
        );
        dropCarriedObject(weapon, ['uwep']);
    } else if (announceForm) {
        await pline(formMessage);
    }

    const hornCount = monsterHornCount(mnum);
    if (hornCount && helmet) {
        const flimsy = (OBJECT_MATERIAL[helmet.otyp] ?? Infinity) <= LEATHER;
        if (flimsy) {
            const horns = hornCount === 1 ? 'horn' : 'horns';
            const verb = hornCount === 1 ? 'pierces' : 'pierce';
            await plineWithContinuation(
                `Your ${horns} ${verb} through your ${helmet.name}.`,
            );
        } else {
            const helmName = helmet.otyp === 97 ? 'helm' : helmet.name;
            await plineWithContinuation(
                `Your ${helmName} falls to the ${heroSurfaceName()}!`,
            );
            dropCarriedObject(helmet, ['uarmh']);
        }
    }
    if (noHands && gloves) {
        await plineWithContinuation(
            `You drop your gloves${weapon ? ' and weapon' : ''}!`,
        );
        if (weapon) {
            dropCarriedObject(weapon, ['uwep']);
            await publishDropCapacityChange();
        }
        dropCarriedObject(gloves, ['uarmg']);
        await publishDropCapacityChange();
    }
    if (noHands && shield) {
        await plineWithContinuation(
            'You can no longer hold your shield!',
        );
        dropCarriedObject(shield, ['uarms']);
        await publishDropCapacityChange();
    }
    if ((noHands || verySmall || slithy || centaur) && boots) {
        await plineWithContinuation(
            whirly
                ? 'Your boots fall away!'
                : verySmall
                    ? 'Your boots slide off your feet!'
                    : 'Your boots are pushed off your feet!',
        );
        dropCarriedObject(boots, ['uarmf']);
        await publishDropCapacityChange();
    }
    if (heroHasNoHead(game) && eyewear) {
        let eyewearName = eyewear.name || 'blindfold';
        if (eyewearName.startsWith('pair of '))
            eyewearName = eyewearName.slice('pair of '.length);
        const fallVerb = eyewearName.endsWith('s') ? 'fall' : 'falls';
        await plineWithContinuation(
            `Your ${eyewearName} ${fallVerb} off!`,
        );
        clearEquipmentSlot('ublindf', eyewear);
        eyewear.worn = false;
        eyewear.wornSlot = null;
        eyewear.owornmask = 0;
        const stillBlind = syncBlindness(game);
        if (stillBlind && eyewear.otyp !== LENSES) {
            await plineWithContinuation('You still cannot see.');
        }
        dropCarriedObject(eyewear, ['ublindf']);
        await publishDropCapacityChange();
    }

    findArmorClass(game);
    game.vision_full_recalc = 1;
    newsym(game.u.ux, game.u.uy);

    const currentCapacity = nearCapacity(game);
    game._encumbranceLevel = currentCapacity;
    game.u._encumbrance = encumbranceLabel(currentCapacity);

    const capacityMessage = encumbranceMessage(
        sourceCapacity, currentCapacity,
    );
    let capacityMessagePaged = false;
    if (capacityMessage && canBreathe) {
        await moreUntilDismissed(`${capacityMessage}--More--`);
        capacityMessagePaged = true;
    } else if (capacityMessage) {
        if (sequentialEquipmentMessages)
            await plineWithContinuation(capacityMessage);
        else await pline(capacityMessage);
    }
    const retouch = await retouchEquipment(2);
    if (retouch.died) return { transformed: true, mnum, died: true };
    const selfTouch = await selfTouchPetrifyingWeapons();
    if (selfTouch.died)
        return { transformed: true, mnum, died: true };
    if (canBreathe && game.flags?.verbose !== false) {
        const breathMessage
            = 'Use the command #monster to use your breath weapon.';
        if (capacityMessagePaged) await pline(breathMessage);
        else await plineWithContinuation(breathMessage);
    }
    const laysEggs = !!(formFlags & M1_OVIPAROUS);
    const aquaticEel = ['giant eel', 'electric eel'].includes(monsterName);
    if (laysEggs && game.flags?.female && !aquaticEel) {
        await plineWithContinuation(
            'Use the command #sit to lay an egg.',
        );
    }
    return { transformed: true, mnum };
}

export async function polyselfControlledMonster(mnum) {
    return polymonHero(mnum, { sexChangeAllowed: true });
}

function roundDivPositive(numerator, denominator) {
    return Math.trunc((numerator + Math.trunc(denominator / 2)) / denominator);
}

function humanAttributeArrays() {
    const u = game.u;
    // This follows the source ordering deliberately.  While Upolyd,
    // redist_attr() changes the active monster copy; polyman() subsequently
    // restores macurr/mamax and discards those temporary changes.
    return { base: u.acurr?.a, max: u.amax?.a };
}

function redistributeActiveAttributes() {
    const { base, max } = humanAttributeArrays();
    if (!Array.isArray(base) || !Array.isArray(max)) {
        // Preserve the four source draws even for an incomplete restored
        // state.  Normal new games always carry both arrays.
        for (let i = 0; i < 4; i++) rn2(5);
        return;
    }
    for (const index of [A_STR, A_DEX, A_CON, A_CHA]) {
        const oldMax = max[index] || 1;
        const raceMin = game.urace?.attrmin?.[index] ?? 3;
        const raceMax = game.urace?.attrmax?.[index] ?? 18;
        max[index] = Math.max(
            raceMin,
            Math.min(raceMax, oldMax + rn2(5) - 2),
        );
        base[index] = Math.max(
            raceMin,
            Math.trunc((base[index] || raceMin) * max[index] / oldMax),
        );
    }
}

function randomExperienceForLevel(level) {
    const minimum = level === 1 ? 0 : newExperienceThreshold(level - 1);
    const maximum = newExperienceThreshold(level);
    return minimum + rn2(maximum - minimum);
}

function constitutionHpBonus(constitution) {
    if (constitution <= 3) return -2;
    if (constitution <= 6) return -1;
    if (constitution <= 14) return 0;
    if (constitution <= 16) return 1;
    if (constitution === 17) return 2;
    if (constitution === 18) return 3;
    return 4;
}

function newmanHpIncrement(level) {
    const role = game.urole?.hpadv || {};
    const race = game.urace?.hpadv || {};
    let hp;
    if (level === 0) {
        hp = (role.infix || 0) + (race.infix || 0);
        if ((role.inrnd || 0) > 0) hp += rnd(role.inrnd);
        if ((race.inrnd || 0) > 0) hp += rnd(race.inrnd);
    } else {
        const lower = level < (game.urole?.xlev ?? 10);
        const fixedKey = lower ? 'lofix' : 'hifix';
        const randomKey = lower ? 'lornd' : 'hirnd';
        hp = (role[fixedKey] || 0) + (race[fixedKey] || 0);
        if ((role[randomKey] || 0) > 0) hp += rnd(role[randomKey]);
        if ((race[randomKey] || 0) > 0) hp += rnd(race[randomKey]);
        hp += constitutionHpBonus(game.u?.acurr?.a?.[A_CON] || 0);
    }
    hp = Math.max(1, hp);
    if (!Array.isArray(game.u.uhpinc))
        game.u.uhpinc = Array(MAXULEV).fill(0);
    if (level < MAXULEV) game.u.uhpinc[level] = hp;
    return hp;
}

// roles.js currently stores the pre-consumed initial energy die separately
// during startup.  These are the corresponding role.c enadv.inrnd values
// needed when newman() rolls an entirely new level-zero power increment.
const INITIAL_ENERGY_RANDOM = {
    priest: 3,
    wizard: 3,
    healer: 4,
    knight: 4,
    monk: 2,
};

function energyModifier(energy) {
    if (['priest', 'wizard'].includes(game.urole?.key)) return 2 * energy;
    if (['healer', 'knight'].includes(game.urole?.key))
        return Math.trunc(3 * energy / 2);
    if (['barbarian', 'valkyrie'].includes(game.urole?.key))
        return Math.trunc(3 * energy / 4);
    return energy;
}

function newmanPowerIncrement(level) {
    const role = game.urole?.enadv || {};
    const race = game.urace?.enadv || {};
    let power;
    if (level === 0) {
        power = (role.infix || 0) + (race.infix || 0);
        const roleRange = role.inrnd
            || INITIAL_ENERGY_RANDOM[game.urole?.key] || 0;
        if (roleRange > 0) power += rnd(roleRange);
        if ((race.inrnd || 0) > 0) power += rnd(race.inrnd);
    } else {
        const lower = level < (game.urole?.xlev ?? 10);
        const fixedKey = lower ? 'lofix' : 'hifix';
        const randomKey = lower ? 'lornd' : 'hirnd';
        const range = Math.trunc((game.u?.acurr?.a?.[A_WIS] || 0) / 2)
            + (role[randomKey] || 0) + (race[randomKey] || 0);
        const fixed = (role[fixedKey] || 0) + (race[fixedKey] || 0);
        power = energyModifier(rn2(range) + fixed);
    }
    power = Math.max(1, power);
    if (!Array.isArray(game.u.ueninc))
        game.u.ueninc = Array(MAXULEV).fill(0);
    if (level < MAXULEV) game.u.ueninc[level] = power;
    return power;
}

function newHumanFormName() {
    if (game.urace?.name === 'human' || game.urace?.noun === 'human')
        return game.flags?.female ? 'woman' : 'man';
    return game.urace?.noun || game.urace?.name || 'creature';
}

// C polyself.c:polyself(POLY_CONTROLLED) -> newman() -> polyman().
// A selected generic human is intentionally an illegal monster target; it
// rebuilds the saved human level/HP/power body rather than installing PM_HUMAN
// as a monster form.
export async function polyselfControlledNewman() {
    const u = game.u;
    const oldLevel = u.ulevel ?? 1;
    let newLevel = oldLevel + rn2(5) - 2;
    if (newLevel < 1) {
        await pline("Your new form doesn't seem healthy enough to survive.");
        const died = await finishHeroDeath({
            killer: 'unsuccessful polymorph',
        });
        return { transformed: false, died };
    }
    newLevel = Math.min(MAXULEV, newLevel);
    if (newLevel < oldLevel)
        u.ulevelmax = (u.ulevelmax ?? oldLevel) - (oldLevel - newLevel);
    u.ulevelmax = Math.max(u.ulevelmax ?? newLevel, newLevel);
    u.ulevel = newLevel;

    if (rn2(10) === 0) {
        if (heroIsPolymorphed(game)) u.mfemale = !u.mfemale;
        else if (game.flags) game.flags.female = !game.flags.female;
    }

    await adjustLevelAbilities(oldLevel, newLevel);

    u.uexp = randomExperienceForLevel(newLevel);
    redistributeActiveAttributes();

    let hpMaximum = u.uhpmax ?? 1;
    for (let i = 0; i < oldLevel; i++)
        hpMaximum -= Number(u.uhpinc?.[i] || 0);
    hpMaximum = roundDivPositive(hpMaximum * (rn2(4) + 8), 10);
    for (let i = 0; i < newLevel; i++) {
        u.ulevel = i;
        hpMaximum += newmanHpIncrement(i);
    }
    u.ulevel = newLevel;
    hpMaximum = Math.max(hpMaximum, newLevel);
    u.uhp = roundDivPositive(
        (u.uhp ?? 1) * hpMaximum,
        Math.max(1, u.uhpmax ?? 1),
    );
    u.uhpmax = hpMaximum;
    u.uhp = Math.min(u.uhp, u.uhpmax);
    u.uhppeak = Math.max(u.uhppeak ?? 0, u.uhpmax);

    let powerMaximum = u.uenmax ?? 0;
    for (let i = 0; i < oldLevel; i++)
        powerMaximum -= Number(u.ueninc?.[i] || 0);
    powerMaximum = roundDivPositive(powerMaximum * (rn2(4) + 8), 10);
    for (let i = 0; i < newLevel; i++) {
        u.ulevel = i;
        powerMaximum += newmanPowerIncrement(i);
    }
    u.ulevel = newLevel;
    powerMaximum = Math.max(powerMaximum, newLevel);
    u.uen = roundDivPositive(
        (u.uen ?? 0) * powerMaximum,
        Math.max(1, u.uenmax ?? 0),
    );
    u.uenmax = powerMaximum;
    u.uen = Math.min(u.uen, u.uenmax);

    u.uhunger = 500 + rn2(500);
    cureHeroSickness(game);
    clearHeroPetrification(game);
    if (u.uhp <= 0) {
        if (heroHasPolymorphControl(game)) u.uhp = 1;
        else {
            await pline(
                "Your new form doesn't seem healthy enough to survive.",
            );
            const died = await finishHeroDeath({
                killer: 'unsuccessful polymorph',
            });
            return { transformed: false, died };
        }
    }

    const restored = rehumanizeHero(game);
    await pline(`You feel like a new ${newHumanFormName()}!`);
    if (heroIsSliming(game)) {
        await pline('Your body transforms, but there is still slime on you.');
        resetHeroSlimingCountdown(game);
    }
    see_monsters();
    if (restored.encumbranceMessage)
        await pline(restored.encumbranceMessage);
    const retouch = await retouchEquipment(2);
    if (retouch.died) {
        return {
            transformed: true, newman: true, oldLevel, newLevel, died: true,
        };
    }
    const selfTouch = await selfTouchPetrifyingWeapons();
    if (selfTouch.died) {
        return {
            transformed: true, newman: true, oldLevel, newLevel, died: true,
        };
    }
    return {
        transformed: true,
        newman: true,
        oldLevel,
        newLevel,
    };
}

// Ordinary uncontrolled polymorph into a legal monster form.
export async function polyselfRandomOrdinary() {
    const constitution = game.u?.acurr?.a?.[A_CON] ?? 10;
    if (rn2(20) > constitution) {
        await pline('You shudder for a moment.');
        game.u.uhp = Math.max(0, (game.u.uhp || 0) - rnd(30));
        exerciseAttribute(A_CON, false);
        return { transformed: false, learnEffect: true };
    }

    const mnum = rn2(SPECIAL_PM);
    const forceNewHuman = rn2(5) === 0;
    if (forceNewHuman) {
        // newman() changes level, sex, HP, and attributes as one independent
        // transaction.  Do not counterfeit that branch with monster state.
        game._pendingNewmanPolymorph = mnum;
        return { transformed: false, learnEffect: true, needsNewman: true };
    }

    beginMonsterForm(mnum);
    const monsterName = MONSTER_NAME[mnum] || 'monster';
    const suit = game.uarm || game.u?.uarm;
    const gloves = game.uarmg || game.u?.uarmg;
    const helmet = game.uarmh || game.u?.uarmh;
    const weapon = game.uwep || game.u?.uwep;
    const slipsArmor = (MONSTER_SIZE[mnum] ?? 2) <= MZ_SMALL;

    game._encumbranceLevel = nearCapacity(game);
    game.u._encumbrance = encumbranceLabel(game._encumbranceLevel);

    if (slipsArmor && suit) {
        // C break_armor() drops the suit and newsym() projects the accepted
        // form before encumber_msg() forces the pending form/armor prose.
        // Keep the pre-removal AC/status until find_ac() below, but paint the
        // monster glyph on the first pager rather than the old hero glyph.
        dropCarriedObject(suit, ['uarm']);
        await moreUntilDismissed(
            `You turn into a ${monsterName}!  Your armor falls around you!--More--`,
        );
        await moreUntilDismissed(
            "You can't even move a handspan with this load!--More--",
        );
    } else {
        await pline(`You turn into a ${monsterName}!`);
    }

    if (heroHasNoHands(game)) {
        if (weapon) dropCarriedObject(weapon, ['uwep']);
        if (gloves) dropCarriedObject(gloves, ['uarmg']);
        if (helmet) dropCarriedObject(helmet, ['uarmh']);
        if (gloves || helmet) {
            const gloveMessage = gloves
                ? `You drop your gloves${weapon ? ' and weapon' : ''}!`
                : '';
            const helmetMessage = helmet ? 'Your helm falls to the ground!' : '';
            await pline([gloveMessage, helmetMessage].filter(Boolean).join('  '));
        }
    }

    findArmorClass(game);
    // polyself.c:polymon() invalidates the optical sight bitmap after the
    // form and equipment transaction.  The next moveloop boundary rebuilds
    // IN_SIGHT before presenting another command.
    game.vision_full_recalc = 1;
    newsym(game.u.ux, game.u.uy);
    return { transformed: true, learnEffect: true, mnum };
}
