// polyself.js — Hero polymorph state and equipment transaction.
// C refs: polyself.c polyself(), polymon(), break_armor(), drop_weapon().

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { d, rnd, rn2 } from './rng.js';
import { newExperienceThreshold } from './exper.js';
import {
    MONSTER_EXPERIENCE_META, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL,
    MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, SPECIAL_PM,
} from './monster_data.js';
import { flush_screen, newsym, pline } from './display.js';
import { place_object } from './mklev.js';
import { findArmorClass } from './armor.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';

const M1_NOEYES = 0x00001000;
const M1_NOTAKE = 0x00000800;
const M1_NOHANDS = 0x00002000;
const M1_NOLIMBS = 0x00006000;
const M1_FLY = 0x00000001;
const M1_HUMANOID = 0x00020000;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const M2_STRONG = 0x04000000;
const MZ_SMALL = 1;
const MZ_HUMAN = 2;
const MZ_LARGE = 3;
const S_DRAGON = 30;
const MAXULEV = 30;
const GOLEM_HIT_POINTS = new Map([
    [249, 20], [250, 20], [251, 30], [252, 60], [253, 40],
    [254, 50], [255, 40], [256, 70], [257, 100], [258, 80],
    [259, 120],
]);
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

export function heroIsPolymorphed(state = game) {
    return (state.u?.mtimedone ?? 0) > 0;
}

export function heroHasNoHands(state = game) {
    if (!heroIsPolymorphed(state)) return false;
    return !!((MONSTER_FLAGS1[state.u?.umonnum] ?? 0) & M1_NOHANDS);
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
    return (MONSTER_SIZE[state.u?.umonnum] ?? MZ_SMALL) < MZ_SMALL;
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
    u.uundetected = 0;
    delete u.formArmorClass;
    delete u.flying;

    let regainedSight = false;
    if (wasBlindFromForm) {
        delete state._blindFromMonsterForm;
        if ((u.blindTurns ?? 0) <= 0 && !state.ublindf && !u.ublindf) {
            state.blind = false;
            regainedSight = true;
        }
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

function exerciseAttribute(index, improving) {
    // attrib.c:exercise() ignores physical exercise while polymorphed; only
    // Wisdom can affect the saved human body from a temporary form.
    if (heroIsPolymorphed(game) && index !== 4) return;
    const current = game.u?.acurr?.a?.[index] ?? 10;
    const amount = improving ? (rn2(19) > current ? 1 : 0) : -rn2(2);
    if (!Array.isArray(game.u._exercise)) game.u._exercise = Array(6).fill(0);
    game.u._exercise[index] += amount;
}

async function moreUntilDismissed(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
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

function beginMonsterForm(mnum, { sexChangeAllowed = false } = {}) {
    const u = game.u;
    const previousMnum = u.umonnum;
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
    exerciseAttribute(2, false);
    exerciseAttribute(4, true);

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
        if (u.amax?.a) u.amax.a[0] = 118;
        if (u.acurr?.a) u.acurr.a[0] = 118;
    } else {
        // Non-strong forms retain current Strength but cap exceptional
        // Strength at 18 for the duration of the polymorph.
        if (u.amax?.a) u.amax.a[0] = Math.min(u.amax.a[0] ?? 18, 18);
        if (u.acurr?.a) u.acurr.a[0] = Math.min(u.acurr.a[0] ?? 18, 18);
    }

    const monsterLevel = MONSTER_LEVEL[mnum] ?? 0;
    const golemHitPoints = GOLEM_HIT_POINTS.get(mnum);
    if (golemHitPoints) u.mhmax = golemHitPoints;
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
    if (!heroHasEyes(game)) {
        game._blindFromMonsterForm = true;
        game.blind = true;
    }
    newsym(u.ux, u.uy);
    return { previousMnum, wasPolymorphed };
}

// C polyself.c:polyself(POLY_CONTROLLED) -> polymon().  Selection and
// legality remain command-owned; this function owns the accepted form,
// equipment, encumbrance, and verbose ability transaction.
export async function polyselfControlledMonster(mnum) {
    const previousCapacity = nearCapacity(game);
    const wasPolymorphed = heroIsPolymorphed(game);
    const previousMnum = game.u?.umonnum;
    beginMonsterForm(mnum, { sexChangeAllowed: true });

    const monsterName = MONSTER_NAME[mnum] || 'monster';
    const formMessage = wasPolymorphed && previousMnum === mnum
        ? `You feel like a new ${monsterName}!`
        : `You turn into a ${monsterName}!`;
    const cloak = game.uarmc || game.u?.uarmc;
    const weapon = game.uwep || game.u?.uwep;
    const formSize = MONSTER_SIZE[mnum] ?? MZ_HUMAN;
    const formFlags = MONSTER_FLAGS1[mnum] ?? 0;
    const slipsArmor = formSize <= MZ_SMALL;
    const breaksArmor = formSize >= MZ_LARGE
        || (formSize > MZ_SMALL && !(formFlags & M1_HUMANOID));
    const noHands = heroHasNoHands(game);

    const currentCapacity = nearCapacity(game);
    game._encumbranceLevel = currentCapacity;
    game.u._encumbrance = encumbranceLabel(currentCapacity);

    if (breaksArmor && cloak) {
        await pline(
            `${formMessage}  The clasp on your cloak breaks open!`,
        );
        dropCarriedObject(cloak, ['uarmc']);
    } else if (slipsArmor && cloak) {
        await moreUntilDismissed(
            `${formMessage}  You shrink out of your cloak!--More--`,
        );
        dropCarriedObject(cloak, ['uarmc']);
    } else if (noHands && weapon) {
        await moreUntilDismissed(
            `${formMessage}  You find you must drop your tool!--More--`,
        );
        dropCarriedObject(weapon, ['uwep']);
    } else {
        await pline(formMessage);
    }

    findArmorClass(game);
    game.vision_full_recalc = 1;
    newsym(game.u.ux, game.u.uy);

    const capacityMessage = encumbranceMessage(
        previousCapacity, currentCapacity,
    );
    const canBreathe = MONSTER_SYMBOL[mnum] === S_DRAGON
        && (MONSTER_LEVEL[mnum] ?? 0) > 0;
    if (capacityMessage && canBreathe) {
        await moreUntilDismissed(`${capacityMessage}--More--`);
    } else if (capacityMessage) {
        await pline(capacityMessage);
    }
    if (canBreathe && game.flags?.verbose !== false) {
        await pline('Use the command #monster to use your breath weapon.');
    }
    return { transformed: true, mnum };
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
    // JS status arrays use Str, Dex, Con, Int, Wis, Cha.  C skips the mental
    // Int/Wis fields, leaving these four physical/body indices.
    for (const index of [0, 1, 2, 5]) {
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
        hp += constitutionHpBonus(game.u?.acurr?.a?.[2] || 0);
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
        const range = Math.trunc((game.u?.acurr?.a?.[4] || 0) / 2)
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
        // The witnessed controlled branch cannot die here.  Keep this
        // unsupported death edge explicit rather than fabricating a healthy
        // level-one result.
        await pline("Your new form doesn't seem healthy enough to survive.");
        return { transformed: false, died: true };
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
    const restored = rehumanizeHero(game);
    await pline(`You feel like a new ${newHumanFormName()}!`);
    if (restored.encumbranceMessage)
        await pline(restored.encumbranceMessage);
    return {
        transformed: true,
        newman: true,
        oldLevel,
        newLevel,
    };
}

// The first live witness is ordinary, uncontrolled random polymorph.  This
// ports that source branch through a legal ordinary monster result; newman()
// and controlled selection remain separate architecture blocks.
export async function polyselfRandomOrdinary() {
    const constitution = game.u?.acurr?.a?.[2] ?? 10;
    if (rn2(20) > constitution) {
        await pline('You shudder for a moment.');
        game.u.uhp = Math.max(0, (game.u.uhp || 0) - rnd(30));
        exerciseAttribute(2, false);
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
        await moreUntilDismissed(
            `You turn into a ${monsterName}!  Your armor falls around you!--More--`,
        );
        dropCarriedObject(suit, ['uarm']);
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
