// Hero form changes and equipment.
// C refs: polyself.c polyself(), polymon(), break_armor(), drop_weapon().

import { game } from './gstate.js';
import { d, rnd, rn1, rn2 } from './rng.js';
import {
    adjustLevelAbilities, newExperienceThreshold,
} from './exper.js';
import {
    MONSTER_ATTACKS, MONSTER_EXPERIENCE_META, MONSTER_FLAGS1,
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME,
    MONSTER_SIZE, MONSTER_SYMBOL, SPECIAL_PM, monsterBreaksArmor,
    monsterHasNoHands, monsterHornCount, monsterIsCentaur,
    monsterIsSlithy, monsterIsVampire, monsterIsVerySmall,
    monsterIsWhirly, monsterSlipsArmor, monsterTypeName, monsterWrappingAllowed,
    validVampireShiftForm,
} from './monster_data.js';
import {
    AD_STCK, AD_WRAP, AT_ENGL, AT_HUGS, AT_WEAP,
} from './monster_attack_types.js';
import {
    AMULET_OF_UNCHANGING, ELVEN_MITHRIL_COAT, LEASH, LENSES, LOADSTONE,
    GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, OBJECT_MATERIAL, OBJECT_NAMES,
    RIN_POLYMORPH_CONTROL, RIN_PROTECTION_FROM_SHAPE_CHANGERS,
} from './object_data.js';
import {
    newsym, pline, plineWithContinuation, see_monsters,
} from './display.js';
import { landFloorObject } from './floor_effects.js';
import { deleteObject } from './object_delete.js';
import { dragonFormForArmor, findArmorClass } from './armor.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';
import {
    A_CHA, A_CON, A_DEX, A_STR, A_WIS, G_GENOD, I_SPECIAL, STAIRS, Upolyd,
    POLY_CONTROLLED, POLY_LOW_CTRL, POLY_MONSTER, POLY_NOFLAGS, POLY_REVERT,
    W_ACCESSORY, W_ARMOR, W_SADDLE,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import { heroIsBlind, syncBlindness } from './senses.js';
import { nameToMonster, nameToMonsterClass } from './mondata.js';
import { counterWereSpecies } from './monster_species.js';
import { wereBeastForSpecies } from './were.js';
import { getLine, promptYesNo } from './query.js';
import { golemHitPoints } from './monster_hit_points.js';
import { finishHeroDeath } from './end.js';
import { cureHeroSickness } from './hero_illness.js';
import {
    clearHeroPetrification, selfTouchPetrifyingWeapons,
} from './stoning.js';
import { heroHasNoHead } from './hero_species.js';
import { retouchEquipment } from './hero_retouch.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { loseHeroHp } from './hero_damage.js';
import { isWeldedPrimary, releaseWeaponSlots } from './weapon_slots.js';
import { grantIntrinsicProperty, revokeIntrinsicProperty } from './properties.js';
import { vision_recalc } from './vision.js';
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
const M2_NOPOLY = 0x00000001;
const M2_PNAME = 0x00080000;
const G_FREQ = 0x0007;
const G_NOGEN = 0x0200;
const G_HELL = 0x0400;
const G_NOHELL = 0x0800;
const G_UNIQ = 0x1000;
const S_MIMIC = 13;
const S_DRAGON = 30;
const MAXULEV = 30;
const MUMMY_WRAPPING = 138;
const ALCHEMY_SMOCK = 144;
const LEATHER = 7;
const PM_HUMAN = MONSTER_NAME.indexOf('human');
const PM_WOLF = MONSTER_NAME.indexOf('wolf');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_VAMPIRE_BAT = MONSTER_NAME.indexOf('vampire bat');
const PM_VAMPIRE_LEADER = MONSTER_NAME.indexOf('vampire leader');
const S_BAT = MONSTER_SYMBOL[MONSTER_NAME.indexOf('bat')];
const S_LICH = MONSTER_SYMBOL[MONSTER_NAME.indexOf('lich')];
const PLACEHOLDER_MONSTERS = new Set(['orc', 'giant', 'elf', 'human']
    .map(name => MONSTER_NAME.indexOf(name)));
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
    return Upolyd(state.u);
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

// polyman() also runs when newman() renews an already-human body.
async function restoreHumanBody(state, publish = plineWithContinuation) {
    const u = state.u;
    const changed = heroIsPolymorphed(state);
    const wasBlindFromForm = !!state._blindFromMonsterForm;
    const previousEncumbrance = Number.isInteger(state._encumbranceLevel)
        ? state._encumbranceLevel : nearCapacity(state);
    if (changed) {
        if (u.macurr) u.acurr = u.macurr;
        if (u.mamax) u.amax = u.mamax;
        u.umonnum = u.umonster;
        if (state.flags && typeof u.mfemale === 'boolean')
            state.flags.female = u.mfemale;
    }

    u.mh = 0;
    u.mhmax = 0;
    u.mtimedone = 0;
    await restoreDragonArmor(state, publish);
    u.mcham = -1;
    u.uundetected = 0;
    delete u.formArmorClass;
    revokeIntrinsicProperty('flying', 'form', state);

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
        changed,
        regainedSight,
        race: state.urace?.adj || state.urace?.noun || 'human',
        encumbranceMessage: encumbranceMessage(
            previousEncumbrance, state._encumbranceLevel,
        ),
    };
}

export async function returnHeroToHumanForm(state = game, {
    publish = plineWithContinuation,
    die = finishHeroDeath,
} = {}) {
    if (!heroIsPolymorphed(state))
        return { changed: false, regainedSight: false, died: false };
    if (heroIsUnchanging(state) && state.u.mh < 1) {
        const died = await die({ killer: 'killed while stuck in creature form' });
        return { changed: false, regainedSight: false, died };
    }

    const restored = await restoreHumanBody(state, publish);
    if (restored.regainedSight) vision_recalc(0);
    await publish(`You return to ${restored.race} form!`);
    if (restored.regainedSight) await publish('You can see again.');
    if (state.u.uhp < 1) {
        await publish('Your old form was not healthy enough to survive.');
        const died = await die({
            killer: `reverting to unhealthy ${restored.race} form`,
        });
        if (died) return { ...restored, died };
    }
    state.multi = 0;
    if (restored.encumbranceMessage)
        await publish(restored.encumbranceMessage);
    const retouch = await retouchEquipment(2, { state, publish, die });
    if (retouch.died) return { ...restored, died: true };
    const selfTouch = await selfTouchPetrifyingWeapons({ state, publish, die });
    return { ...restored, died: selfTouch.died };
}

async function dropCarriedObject(object) {
    if (!object) return;
    removeHeroEquipment(object, game);
    const index = game.inventory?.indexOf(object) ?? -1;
    if (index >= 0) game.inventory.splice(index, 1);
    object.where = 'free';
    await landFloorObject(object, game.u.ux, game.u.uy, {
        publish: plineWithContinuation,
    });
    newsym(game.u.ux, game.u.uy);
}

function heroSurfaceName() {
    const location = game.level?.locations?.[game.u.ux]?.[game.u.uy];
    return location?.typ === STAIRS ? 'stairs' : 'floor';
}

async function beginMonsterForm(mnum, {
    sexChangeAllowed = false, announceForm = true,
} = {}) {
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
    const female = !!game.flags.female;
    if (genderFlags & M2_MALE) game.flags.female = false;
    else if (genderFlags & M2_FEMALE) game.flags.female = true;
    else if (!(genderFlags & M2_NEUTER) && mnum !== u.ulycn
        && sexChangeAllowed && rn2(10) === 0)
        game.flags.female = !female;

    if (announceForm) {
        const sexChanged = female !== game.flags.female;
        const gendered = genderFlags & (M2_MALE | M2_FEMALE);
        const sex = sexChanged && !gendered
            ? game.flags.female ? 'female ' : 'male ' : '';
        const renewed = previousMnum === mnum ? 'new ' : '';
        const name = renewed + sex + monsterTypeName(mnum, game.flags.female);
        const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
        const verb = previousMnum === mnum ? 'feel like' : 'turn into';
        await plineWithContinuation(`You ${verb} ${article} ${name}!`);
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
    if ((MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY)
        grantIntrinsicProperty('flying', 'form', game);
    else
        revokeIntrinsicProperty('flying', 'form', game);

    // Blind is a derived property of an eyeless current form.  Preserve its
    // provenance so rehumanize can later distinguish it from timed blindness.
    if (!heroHasEyes(game)) game._blindFromMonsterForm = true;
    else delete game._blindFromMonsterForm;
    syncBlindness(game);
    // polymon() does not repaint the accepted form until break_armor() has
    // completed.  A garment pager can therefore still expose the old hero
    // glyph even though monster HP and status metadata are already live.
}

// C polyself.c:polymon(). Selection is separate from changing the body.
export async function polymonHero(mnum, options = {}) {
    if ((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD) {
        await plineWithContinuation(`You feel rather ${MONSTER_NAME[mnum]}-ish.`);
        exerciseAttribute(A_WIS, true);
        return { transformed: false };
    }

    const previousCapacity = nearCapacity(game);
    await beginMonsterForm(mnum, options);
    if (game.uskin && dragonFormForArmor(game.uskin) !== mnum)
        await restoreDragonArmor(game);
    await changeArmorForHeroForm(mnum);
    await dropPolymorphWeapons(true);
    findArmorClass(game);
    game.vision_full_recalc = 1;
    newsym(game.u.ux, game.u.uy);

    const currentCapacity = nearCapacity(game);
    game._encumbranceLevel = currentCapacity;
    game.u._encumbrance = encumbranceLabel(currentCapacity);
    const capacityMessage = encumbranceMessage(previousCapacity, currentCapacity);
    if (capacityMessage) await plineWithContinuation(capacityMessage);

    const retouch = await retouchEquipment(2);
    if (retouch.died) return { transformed: true, mnum, died: true };
    const selfTouch = await selfTouchPetrifyingWeapons();
    if (selfTouch.died) return { transformed: true, mnum, died: true };

    const currentForm = game.u.umonnum;
    const canBreathe = (MONSTER_ATTACKS[currentForm] || [])
        .some(([attackType]) => attackType === 12);
    if (game.flags.verbose !== false && canBreathe) {
        await plineWithContinuation(
            'Use the command #monster to use your breath weapon.',
        );
    }
    const laysEggs = !!(MONSTER_FLAGS1[currentForm] & M1_OVIPAROUS);
    const aquaticEel = ['giant eel', 'electric eel']
        .includes(MONSTER_NAME[currentForm]);
    if (game.flags.verbose !== false && laysEggs
        && game.flags.female && !aquaticEel) {
        await plineWithContinuation('Use the command #sit to lay an egg.');
    }
    return { transformed: true, mnum };
}

// C break_armor(): garments react in body-slot order. Read each slot when
// reached because removing one item can change the remaining equipment.
async function changeArmorForHeroForm(mnum) {
    const worn = slot => game[slot] || game.u[slot];
    const breaksArmor = monsterBreaksArmor(mnum);
    const slipsArmor = monsterSlipsArmor(mnum);
    const whirly = monsterIsWhirly({ mnum });
    const noHands = monsterHasNoHands(mnum);
    const verySmall = monsterIsVerySmall(mnum);
    let object;

    if (breaksArmor) {
        if ((object = worn('uarm'))) {
            await plineWithContinuation('You break out of your armor!');
            exerciseAttribute(A_STR, false);
            deleteObject(object);
        }
        if ((object = worn('uarmc'))
            && !(object.otyp === MUMMY_WRAPPING && monsterWrappingAllowed(mnum))) {
            if (object.otyp === MUMMY_WRAPPING) {
                await plineWithContinuation('Your wrapping tears apart!');
                deleteObject(object);
            } else {
                await plineWithContinuation(object.otyp === ALCHEMY_SMOCK
                    ? 'The knot on your apron is pulled apart!'
                    : 'The clasp on your cloak breaks open!');
                await dropCarriedObject(object);
            }
        }
        if ((object = worn('uarmu'))) {
            await plineWithContinuation('Your shirt rips to shreds!');
            deleteObject(object);
        }
    } else if (slipsArmor) {
        if ((object = worn('uarm'))
            && !(MONSTER_NAME[mnum] === 'hobbit'
                && object.otyp === ELVEN_MITHRIL_COAT)) {
            await plineWithContinuation('Your armor falls around you!');
            await dropCarriedObject(object);
        }
        if ((object = worn('uarmc'))
            && !(object.otyp === MUMMY_WRAPPING && monsterWrappingAllowed(mnum))) {
            await plineWithContinuation(whirly
                ? 'Your cloak falls, unsupported!'
                : 'You shrink out of your cloak!');
            await dropCarriedObject(object);
        }
        if ((object = worn('uarmu'))) {
            await plineWithContinuation(whirly
                ? 'You seep right through your shirt!'
                : 'You become much too small for your shirt!');
            await dropCarriedObject(object);
        }
    }

    const hornCount = monsterHornCount(mnum);
    if (hornCount && (object = worn('uarmh'))) {
        if (OBJECT_MATERIAL[object.otyp] <= LEATHER) {
            await plineWithContinuation(
                `Your ${hornCount === 1 ? 'horn pierces' : 'horns pierce'} through your ${object.name}.`,
            );
        } else {
            await plineWithContinuation(
                `Your helm falls to the ${heroSurfaceName()}!`,
            );
            await dropCarriedObject(object);
        }
    }
    if (noHands || verySmall) {
        if ((object = worn('uarmg'))) {
            await plineWithContinuation(
                `You drop your gloves${worn('uwep') ? ' and weapon' : ''}!`,
            );
            await dropPolymorphWeapons(false);
            await dropCarriedObject(object);
        }
        if ((object = worn('uarms'))) {
            await plineWithContinuation('You can no longer hold your shield!');
            await dropCarriedObject(object);
        }
        if ((object = worn('uarmh'))) {
            await plineWithContinuation(
                `Your helm falls to the ${heroSurfaceName()}!`,
            );
            await dropCarriedObject(object);
        }
    }
    if ((noHands || verySmall || monsterIsSlithy(mnum) || monsterIsCentaur(mnum))
        && (object = worn('uarmf'))) {
        await plineWithContinuation(whirly
            ? 'Your boots fall away!'
            : verySmall
                ? 'Your boots slide off your feet!'
                : 'Your boots are pushed off your feet!');
        await dropCarriedObject(object);
    }
    if (heroHasNoHead(game) && (object = worn('ublindf'))) {
        const name = (object.name || 'blindfold').replace(/^pair of /, '');
        await plineWithContinuation(
            `Your ${name} ${name.endsWith('s') ? 'fall' : 'falls'} off!`,
        );
        removeHeroEquipment(object);
        if (syncBlindness(game) && object.otyp !== LENSES)
            await plineWithContinuation('You still cannot see.');
        await dropCarriedObject(object);
    }
}

async function dropPolymorphWeapons(alone) {
    const primary = game.uwep || game.u.uwep;
    if (!primary) return;
    const form = game.u.umonnum;
    if (alone && !monsterHasNoHands(form) && !monsterIsVerySmall(form)) {
        const weaponAttacks = (MONSTER_ATTACKS[form] || []).slice(0, 3)
            .filter(([type]) => type === AT_WEAP).length;
        if (weaponAttacks < 2) game.u.twoweap = false;
        return;
    }

    const secondary = game.u.twoweap ? game.uswapwep || game.u.uswapwep : null;
    const canDropPrimary = canDropPolymorphWeapon(primary);
    const canDropSecondary = !secondary || canDropPolymorphWeapon(secondary);
    if (alone) {
        const verb = canDropPrimary && canDropSecondary ? 'drop' : 'release';
        await plineWithContinuation(
            `You find you must ${verb} your ${secondary ? 'weapons' : 'weapon'}!`,
        );
    }
    for (const [object, canDrop] of [
        [secondary, canDropSecondary], [primary, canDropPrimary],
    ]) {
        if (!object) continue;
        releaseWeaponSlots(object);
        if (!object.in_use && canDrop) await dropCarriedObject(object);
    }
}

function canDropPolymorphWeapon(object) {
    if (object.owornmask & (W_ARMOR | W_ACCESSORY | W_SADDLE)) return false;
    if (isWeldedPrimary(object)) {
        object.bknown = true;
        return false;
    }
    if (object.otyp === LOADSTONE && object.cursed) {
        object.corpsenm = 0;
        object.bknown = true;
        return false;
    }
    return !(object.otyp === LEASH && object.leashmon);
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

// C newman(): rebuild the human level, health, power, and attributes.
// Both random polymorph and a selected human form can reach this operation.
async function renewHumanForm() {
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

    const restored = await restoreHumanBody(game);
    await pline(`You feel like a new ${newHumanFormName()}!`);
    if (heroIsSliming(game)) {
        await pline('Your body transforms, but there is still slime on you.');
        resetHeroSlimingCountdown(game);
    }
    see_monsters();
    if (restored.encumbranceMessage)
        await pline(restored.encumbranceMessage);
    const retouch = await retouchEquipment(2);
    const selfTouch = retouch.died ? retouch
        : await selfTouchPetrifyingWeapons();
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

// C polyself(): select a form, then use the same body-change operations
// whether the request came from a wand, a throne, or a monster ability.
export async function polymorphHero(flags = POLY_NOFLAGS) {
    const hero = game.u;
    if (heroIsUnchanging(game)) {
        await plineWithContinuation('You fail to transform!');
        return { transformed: false };
    }

    const armor = game.uarm || hero.uarm;
    const dragon = dragonFormForArmor(armor);
    const lycanthrope = Number.isInteger(hero.ulycn) && hero.ulycn >= 0;
    const vampire = heroCanChangeVampireShape(game);
    let forced = !!(flags & POLY_CONTROLLED);
    let controlled = heroCanControlPolymorph(game);
    let monsterChange = !!(flags & POLY_MONSTER);
    let mnum = -1;

    if (!heroHasPolymorphControl(game) && !forced
        && dragon === null && !lycanthrope && !vampire
        && rn2(20) > hero.acurr.a[A_CON]) {
        await plineWithContinuation('You shudder for a moment.');
        const died = await loseHeroHp(rnd(30), 'system shock');
        if (!died) exerciseAttribute(A_CON, false);
        return { transformed: false, died };
    }

    if (flags & POLY_REVERT) {
        mnum = hero.mcham;
        monsterChange = true;
        controlled = false;
    }
    if (forced && (flags & POLY_LOW_CTRL)
        && (dragon !== null || monsterChange || vampire || lycanthrope))
        forced = false;

    if (monsterChange && vampire)
        return changeVampireForm(mnum, controlled);

    if (controlled || forced) {
        const choice = await chooseHeroForm({ forced, dragon, lycanthrope });
        if (choice.cancelled) return { transformed: false };
        if (choice.revert) {
            const result = await returnHeroToHumanForm(game);
            return { ...result, transformed: result.changed };
        }
        mnum = choice.mnum;
        if (choice.were) return changeWereForm(mnum);
        if (dragon !== null && (choice.random || mnum === dragon))
            return mergeDragonArmor(armor, dragon);
        if (vampire && (choice.random || mnum === PM_WOLF
            || mnum === PM_FOG_CLOUD || MONSTER_SYMBOL[mnum] === S_BAT))
            return changeVampireForm(mnum, controlled);
    } else {
        if (dragon !== null) return mergeDragonArmor(armor, dragon);
        if (lycanthrope) return changeWereForm(mnum);
        if (vampire) return changeVampireForm(mnum, controlled);
    }

    if (mnum < 0) {
        for (let attempts = 0; attempts < 200; attempts++) {
            mnum = rn1(SPECIAL_PM, 0);
            if (legalPolymorph(mnum) && !PLACEHOLDER_MONSTERS.has(mnum)) break;
        }
    }
    if (!legalPolymorph(mnum) || (!forced && rn2(5) === 0) || ownRace(mnum))
        return renewHumanForm();
    return polymonHero(mnum, { sexChangeAllowed: true });
}

function legalPolymorph(mnum) {
    return !(MONSTER_FLAGS2[mnum] & M2_NOPOLY);
}

function ownRace(mnum) {
    return !!(MONSTER_FLAGS2[mnum] & game.urace?.selfmask);
}

function mayChooseForm(mnum) {
    return legalPolymorph(mnum) || mnum === PM_HUMAN
        || mnum === game.u.umonster
        || (ownRace(mnum) && !(MONSTER_GENO[mnum] & G_UNIQ));
}

async function chooseHeroForm({ forced, dragon, lycanthrope }) {
    let tries = 5;
    let mnum = -1;
    do {
        const answer = await getLine(
            'Become what kind of monster? [type the name]',
            (_character, key) => key >= 32 && key < 127,
        );
        if (answer === null && forced) {
            await plineWithContinuation('Never mind.');
            return { cancelled: true };
        }
        const name = answer === null ? '*' : answer.trim().replace(/\s+/g, ' ');
        if (name === '*' || name === 'random')
            return { mnum: -1, random: true };

        mnum = nameToMonster(name);
        const monsterClass = mnum < 0 ? nameToMonsterClass(name) : 0;
        if (monsterClass) {
            for (;;) {
                mnum = dragon !== null && monsterClass === S_DRAGON
                    ? dragon : pickFormFromClass(monsterClass);
                if (mnum < 0 || mayChooseForm(mnum)) break;
                if (rn2(3) || --tries > 0) continue;
                tries++;
                break;
            }
        } else if (PLACEHOLDER_MONSTERS.has(mnum)
            && mnum !== PM_HUMAN && !ownRace(mnum)) {
            const substitutes = {
                orc: ['hill orc', 'Mordor orc'],
                elf: ['Green-elf', 'Grey-elf'],
                giant: ['stone giant', 'hill giant'],
            }[MONSTER_NAME[mnum]];
            mnum = nameToMonster(substitutes[rn2(3) ? 0 : 1]);
        }

        if (mnum < 0) {
            await plineWithContinuation(monsterClass
                ? "You can't polymorph into any of those."
                : "I've never heard of such monsters.");
            continue;
        }
        if (game.flags.debug && Upolyd(game.u)
            && (mnum === game.u.umonster
                || (game.urole.key === 'priest'
                    && mnum === nameToMonster('aligned cleric')
                    && !name.toLowerCase().includes('aligned'))))
            return { revert: true };

        if (lycanthrope && (wereBeastForSpecies(mnum) === game.u.ulycn
            || mnum === counterWereSpecies(game.u.ulycn)
            || (Upolyd(game.u) && mnum === PM_HUMAN)))
            return { mnum, were: true };

        if (mayChooseForm(mnum)) return { mnum, random: false };
        await plineWithContinuation(
            `You can't polymorph into ${formNameWithArticle(mnum)}.`,
        );
    } while (--tries > 0);

    await plineWithContinuation("That's enough tries!");
    return { mnum, random: true };
}

// C mkclass_poly(): choose by generation frequency, allowing extinction
// but excluding genocide, placeholders, and specially generated monsters.
function pickFormFromClass(monsterClass) {
    const first = MONSTER_SYMBOL.indexOf(monsterClass);
    if (first < 0 || first >= SPECIAL_PM) return -1;
    const members = [];
    let mask = G_NOGEN | G_UNIQ;
    const inHell = !!game.dungeons?.[game.u.uz.dnum]?.flags?.hellish;
    if (rn2(9) || monsterClass === S_LICH)
        mask |= inHell ? G_NOHELL : G_HELL;
    let total = 0;
    for (let mnum = 0; mnum < SPECIAL_PM; mnum++) {
        if (MONSTER_SYMBOL[mnum] !== monsterClass
            || (MONSTER_GENO[mnum] & mask)
            || (game.mvitals?.[mnum]?.mvflags & G_GENOD)
            || PLACEHOLDER_MONSTERS.has(mnum)
            || MONSTER_NAME[mnum] === 'mail daemon') continue;
        const frequency = MONSTER_GENO[mnum] & G_FREQ;
        members.push({ mnum, frequency });
        total += frequency;
    }
    if (!total) return -1;
    let choice = rnd(total);
    for (const { mnum, frequency } of members) {
        choice -= frequency;
        if (choice <= 0) return mnum;
    }
}

function formNameWithArticle(mnum) {
    const name = monsterTypeName(mnum, game.flags.female);
    if (MONSTER_FLAGS2[mnum] & M2_PNAME) return name;
    if ((MONSTER_GENO[mnum] & G_UNIQ) && mnum !== SPECIAL_PM
        && mnum !== nameToMonster('high cleric')) return `the ${name}`;
    return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

function changeWereForm(requested) {
    return Upolyd(game.u) && wereBeastForSpecies(requested) !== game.u.ulycn
        ? renewHumanForm()
        : polymonHero(game.u.ulycn);
}

export function heroCanChangeVampireShape(state = game) {
    return monsterIsVampire(state.u.umonnum)
        || validVampireShiftForm(state.u.mcham, state.u.umonnum);
}

async function changeVampireForm(mnum, controlled) {
    const hero = game.u;
    if (mnum < 0 || (MONSTER_GENO[mnum] & G_UNIQ)) {
        if (hero.umonnum === PM_VAMPIRE_LEADER && rn2(10) === 0)
            mnum = PM_WOLF;
        else
            mnum = rn2(4) === 0 ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
        if (Number.isInteger(hero.mcham) && hero.mcham >= 0
            && !monsterIsVampire(hero.umonnum) && rn2(2) === 0)
            mnum = hero.mcham;
    }
    if (controlled) {
        const answer = await promptYesNo(
            `Become ${formNameWithArticle(mnum)}? [yn] (n) `,
        );
        if (answer !== 'y') return { transformed: false };
    }
    return polymonHero(mnum);
}

async function mergeDragonArmor(armor, mnum) {
    if (!(game.mvitals?.[mnum]?.mvflags & G_GENOD)) {
        if (armor.otyp >= GRAY_DRAGON_SCALES) {
            await plineWithContinuation('You merge with your scaly armor.');
        } else {
            const name = OBJECT_NAMES[armor.otyp].replace(' dragon ', ' ');
            await plineWithContinuation(
                `Your ${name} reverts to scales as you merge with them.`,
            );
            armor.otyp += GRAY_DRAGON_SCALES - GRAY_DRAGON_SCALE_MAIL;
            armor.name = OBJECT_NAMES[armor.otyp];
            if (!heroIsBlind(game)) armor.dknown = true;
        }
        game.uskin = armor;
        game.uarm = game.u.uarm = null;
        armor.owornmask |= I_SPECIAL;
        armor.wornSlot = 'uskin';
    }
    return polymonHero(mnum);
}

async function restoreDragonArmor(state = game, publish = plineWithContinuation) {
    const armor = state.uskin;
    if (!armor) return;
    await publish('Your skin returns to its original form.');
    state.uarm = state.u.uarm = armor;
    state.uskin = null;
    armor.owornmask &= ~I_SPECIAL;
    armor.wornSlot = 'uarm';
}
