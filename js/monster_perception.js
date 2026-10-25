// Monster target perception and remembered hero resistances.
// C refs: monmove.c set_apparxy(), hack.c cant_squeeze_thru(),
// mondata.c monstseesu() and monstunseesu().
import { heroIsDisplaced } from './armor.js';
import { game } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS1, MONSTER_NAME, monsterIsAmorphous, monsterIsVampireShifter, monsterIsVerySmall } from './monster_data.js';
import { AD_MAGM, AD_ACID } from './monster_attack_types.js';
import { heroGoldAmount } from './hero_gold.js';
import { couldsee } from './vision.js';
import { isAccessibleAt } from './terrain_properties.js';
import { D_CLOSED, D_LOCKED, G_GENOD, IS_DOOR, M_SEEN_ACID, M_SEEN_COLD, M_SEEN_DISINT, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_NOTHING, M_SEEN_POISON, M_SEEN_REFL, M_SEEN_SLEEP, isok, } from './const.js';
import { isContainer } from './container.js';
import { ARROW, BAG_OF_HOLDING, BAG_OF_TRICKS, BLINDFOLD, BOOMERANG, CANDY_BAR, CORPSE, CREDIT_CARD, CRYSKNIFE, DAGGER, FEDORA, FORTUNE_COOKIE, LEASH, LEATHER_JACKET, LEMBAS_WAFER, LOCK_PICK, LUMP_OF_ROYAL_JELLY, MAGIC_MARKER, MAGIC_WHISTLE, OBJECT_SUBTYPE, OILSKIN_SACK, PANCAKE, SACK, SKELETON_KEY, SLING, STETHOSCOPE, TALLOW_CANDLE, TIN_OPENER, TIN_WHISTLE, TOWEL, WAX_CANDLE, } from './object_data.js';
const M1_WALLWALK = 0x00000008;
const M1_SEE_INVIS = 0x01000000;
const PM_FOG_CLOUD = 106;
const PM_XORN = MONSTER_NAME.indexOf('xorn');
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const AMULET_CLASS = 5;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const VENOM_CLASS = 17;
const ARM_GLOVES = 3;
const ARM_CLOAK = 5;
const ARM_SHIRT = 6;
const SMALL_PASSAGE_OBJECTS = new Set([
    SLING, FEDORA, LEATHER_JACKET, CREDIT_CARD, FORTUNE_COOKIE, CANDY_BAR,
    PANCAKE, LEMBAS_WAFER, LUMP_OF_ROYAL_JELLY, SACK, BAG_OF_HOLDING,
    BAG_OF_TRICKS, TALLOW_CANDLE, WAX_CANDLE, OILSKIN_SACK, LEASH,
    STETHOSCOPE, BLINDFOLD, TOWEL, TIN_WHISTLE, MAGIC_WHISTLE, MAGIC_MARKER,
    TIN_OPENER, SKELETON_KEY, LOCK_PICK,
]);
function recordPerceptionRandom(random, calls, range) {
    const value = random(range);
    if (calls)
        calls.push({ range, value });
    return value;
}
// C monmove.c:can_fog()/can_ooze(). Small carried objects fit under a door;
// bulky inventory disqualifies these predicates. Native mfndpos() separately
// admits an amorphous body without calling can_ooze(); set_apparxy() calls it.
export function monsterCanFog(monster, state) {
    return monsterIsVampireShifter(monster)
        && !((state?.mvitals?.[PM_FOG_CLOUD]?.mvflags ?? 0) & G_GENOD)
        && !state.u.protectionFromShapeChangers
        && !state.protectionFromShapeChangers
        && !inventoryBlocksDoorPassage(monster.minvent || []);
}
export function monsterCanOoze(monster) {
    return monsterIsAmorphous(monster)
        && !inventoryBlocksDoorPassage(monster.minvent || []);
}
// C can_ooze() uses the hero's inventory for youmonst, not minvent.
export function heroCanOoze(state) {
    return monsterIsAmorphous({ mnum: heroSpecies(state) })
        && !inventoryBlocksDoorPassage(state.inventory);
}
function inventoryBlocksDoorPassage(inventory) {
    for (const object of inventory) {
        const type = object.otyp;
        // The pinned source compares otyp, not oclass, for this first test.
        if (type === COIN_CLASS && object.quan > 100)
            return true;
        const flexibleArmor = object.oclass === ARMOR_CLASS
            && [ARM_CLOAK, ARM_GLOVES, ARM_SHIRT].includes(OBJECT_SUBTYPE[type] ?? -1);
        const tinyCorpse = type === CORPSE && object.corpsenm !== undefined
            && monsterIsVerySmall(object.corpsenm);
        if (![RING_CLASS, AMULET_CLASS, GEM_CLASS, VENOM_CLASS].includes(object.oclass)
            && !(type >= ARROW && type <= BOOMERANG)
            && !(type >= DAGGER && type <= CRYSKNIFE)
            && !flexibleArmor && !tinyCorpse && !SMALL_PASSAGE_OBJECTS.has(type))
            return true;
        if ((isContainer(object) || type === BAG_OF_TRICKS) && object.contents?.length)
            return true;
    }
    return false;
}
// The Native m_canseeu macro deliberately does not test the monster's blindness.
export function monsterHasLineOfSightToHero(monster, state = game) {
    return (!heroIsInvisible(state) || !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS))
        && !state.u.uinwater && couldsee(monster.mx, monster.my);
}
// C cvt_adtyp_to_mseenres(): these eight damage types and bits share an order.
export function seenResistanceForDamage(damageType) {
    return damageType >= AD_MAGM && damageType <= AD_ACID
        ? M_SEEN_MAGR << (damageType - AD_MAGM) : M_SEEN_NOTHING;
}
// C mondata.c:cvt_prop_to_mseenres().  Worn items confer these nine
const M_SEEN_BY_PROPERTY = {
    antimagic: M_SEEN_MAGR,
    fireResistance: M_SEEN_FIRE,
    coldResistance: M_SEEN_COLD,
    sleepResistance: M_SEEN_SLEEP,
    disintegrationResistance: M_SEEN_DISINT,
    shockResistance: M_SEEN_ELEC,
    poisonResistance: M_SEEN_POISON,
    acidResistance: M_SEEN_ACID,
    reflection: M_SEEN_REFL,
};
export function seenResistanceForProperty(property) {
    return M_SEEN_BY_PROPERTY[property] ?? M_SEEN_NOTHING;
}
function monstersThatCanSeeHero(state, canSeeHero) {
    if (state.u?.uswallow)
        return [];
    const seesHero = canSeeHero
        || ((monster) => monsterHasLineOfSightToHero(monster, state));
    return (state.level?.monsters || []).filter(monster => monster && !monster.dead && (monster.mhp ?? 1) > 0
        && seesHero(monster));
}
export function monstersObserveHeroResistance(resistance, state = game, canSeeHero = null) {
    if (!resistance || resistance === M_SEEN_NOTHING)
        return 0;
    const observers = monstersThatCanSeeHero(state, canSeeHero);
    for (const monster of observers) {
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            | resistance;
    }
    return observers.length;
}
export function monstersForgetHeroResistance(resistance, state = game, canSeeHero = null) {
    if (!resistance || resistance === M_SEEN_NOTHING)
        return 0;
    const observers = monstersThatCanSeeHero(state, canSeeHero);
    for (const monster of observers) {
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            & ~resistance;
    }
    return observers.length;
}
// makemon() initializes this state once when its requested coordinate was the
// hero's square.  dochug() refreshes it before each movement decision.  Keep
// both owners on this one implementation: displacement makes the RNG and the
// remembered false position observable at either boundary.
export function setMonsterApparentHeroPosition(monster, state, random, calls = null) {
    const heroX = state?.u?.ux;
    const heroY = state?.u?.uy;
    if (!Number.isFinite(heroX) || !Number.isFinite(heroY))
        return false;
    const rememberedX = monster.mux;
    const rememberedY = monster.muy;
    if (monster.mtame || monster === state?.u?.ustuck
        || (rememberedX === heroX && rememberedY === heroY)) {
        monster.mux = heroX;
        monster.muy = heroY;
        return true;
    }
    const flags1 = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const notSeen = !monster.mcansee
        || (heroIsInvisible(state) && !(flags1 & M1_SEE_INVIS));
    const notThere = heroIsDisplaced(state) && monster.mnum !== 39;
    let displacement = 0;
    if (state?.underwater || state?.u?.uinwater)
        displacement = 1;
    else if (notSeen)
        displacement = monster.mnum === PM_XORN && heroGoldAmount(state) ? 0 : 1;
    else if (notThere) {
        displacement = rememberedX !== undefined && Number.isFinite(rememberedX)
            && rememberedY !== undefined && Number.isFinite(rememberedY)
            && couldsee(rememberedX, rememberedY) ? 2 : 1;
    }
    if (!displacement) {
        monster.mux = heroX;
        monster.muy = heroY;
        return true;
    }
    const foundHero = notSeen
        ? recordPerceptionRandom(random, calls, 3) === 0
        : notThere ? recordPerceptionRandom(random, calls, 4) === 0 : false;
    if (foundHero) {
        monster.mux = heroX;
        monster.muy = heroY;
        return true;
    }
    const passesWalls = !!(flags1 & M1_WALLWALK);
    for (let attempt = 0; attempt < 200; attempt++) {
        const x = heroX - displacement
            + recordPerceptionRandom(random, calls, 2 * displacement + 1);
        const y = heroY - displacement
            + recordPerceptionRandom(random, calls, 2 * displacement + 1);
        if (!isok(x, y))
            continue;
        if (displacement !== 2 && x === monster.mx && y === monster.my)
            continue;
        const location = state?.level?.at?.(x, y);
        const closedDoor = !!location && IS_DOOR(location.typ)
            && !!(location.doormask & (D_CLOSED | D_LOCKED));
        const canUseClosedDoor = closedDoor
            && (monsterCanOoze(monster)
                || monsterCanFog(monster, state));
        if ((x !== heroX || y !== heroY)
            && !passesWalls && !isAccessibleAt(x, y, state) && !canUseClosedDoor)
            continue;
        if (!couldsee(x, y))
            continue;
        monster.mux = x;
        monster.muy = y;
        return true;
    }
    monster.mux = heroX;
    monster.muy = heroY;
    return true;
}
//# sourceMappingURL=monster_perception.js.map