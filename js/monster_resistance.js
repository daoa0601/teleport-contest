// Monster resistance checks shared by attacks and item effects.
// C refs: zap.c resist() and mondata.c Resists_Elem().
import { W_ARM, W_WEP, } from './const.js';
import { ARTIFACT_DATA } from './artifact_data.js';
import { game } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS2, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_RESISTS, monsterIsPlayerMonster, monsterIsVampireShifter, } from './monster_data.js';
import { BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES, } from './object_data.js';
import { rn2 } from './rng.js';
const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_DISINTEGRATION = 0x08;
const MR_ELECTRIC = 0x10;
const MR_ACID = 0x40;
const MR_POISON = 0x20;
const MR_STONE = 0x80;
const M2_UNDEAD = 0x00000002;
const M2_WERE = 0x00000004;
const M2_DEMON = 0x00000100;
const PM_DEATH = 311;
const PM_BLACK_DRAGON = MONSTER_NAME.indexOf('black dragon');
const PM_GRAY_DRAGON = MONSTER_NAME.indexOf('gray dragon');
const PM_YELLOW_DRAGON = MONSTER_NAME.indexOf('yellow dragon');
const ARTIFACT_BY_ID = new Map(ARTIFACT_DATA.map(artifact => [artifact.id, artifact]));
function artifactForObject(object) {
    return object?.oartifact === undefined ? null : ARTIFACT_BY_ID.get(object.oartifact) || null;
}
function monsterInventory(monster) {
    return monster?.minvent || monster?.inventory || [];
}
function monsterWeapon(monster) {
    return monster?.mw || monsterInventory(monster).find(object => object?.wielded || ((object?.owornmask ?? 0) & W_WEP));
}
function monsterWearsOneOf(monster, objectTypes, mask) {
    return (monster?.minvent || monster?.inventory || []).some(object => objectTypes.includes(object?.otyp)
        && !!((object?.owornmask ?? 0) & mask));
}
export function monsterResistanceBits(monster) {
    if (!monster)
        return 0;
    return (MONSTER_RESISTS[monster.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
}
function monsterArtifactDefends(monster, element) {
    return artifactForObject(monsterWeapon(monster))?.defense === element
        || monsterInventory(monster).some(object => artifactForObject(object)?.carriedDefense === element);
}
export function monsterHasFireResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_FIRE)
        || monsterArtifactDefends(monster, 'fire');
}
export function monsterHasColdResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_COLD)
        || monsterArtifactDefends(monster, 'cold');
}
export function monsterHasShockResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_ELECTRIC)
        || monsterArtifactDefends(monster, 'shock');
}
export function monsterHasDisintegrationResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_DISINTEGRATION)
        || monsterWearsOneOf(monster, [BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES], W_ARM);
}
export function monsterHasDrainResistance(monster) {
    if (!monster)
        return false;
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    return !!(flags & (M2_UNDEAD | M2_WERE | M2_DEMON))
        || monster?.mnum === PM_DEATH
        || monsterIsVampireShifter(monster)
        || artifactForObject(monsterWeapon(monster))?.defense === 'life-drain'
        || (monster.mnum >= PM_GRAY_DRAGON && monster.mnum <= PM_YELLOW_DRAGON
            ? monster.mnum === PM_BLACK_DRAGON
            : monsterWearsOneOf(monster, [
                BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES,
            ], W_ARM));
}
// C resists_drli(&youmonst), not the broader Drain_resistance property.
// Direct divine level loss does not accept a shield or generic intrinsic.
export function heroResistsLifeDrain(state = game) {
    const hero = state.u;
    const form = { mnum: heroSpecies(state) };
    if (hero.mcham !== undefined)
        form.cham = hero.mcham;
    const armor = state.uarm || hero.uarm;
    const weapon = state.uwep || hero.uwep;
    const dragonBody = form.mnum >= PM_GRAY_DRAGON && form.mnum <= PM_YELLOW_DRAGON;
    return monsterHasDrainResistance(form)
        || (typeof hero.ulycn === 'number' && Number.isInteger(hero.ulycn) && hero.ulycn >= 0)
        || (!dragonBody
            && armor !== null && armor !== undefined
            && [BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES].includes(armor.otyp))
        || artifactForObject(weapon)?.defense === 'life-drain';
}
export function monsterHasAcidResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_ACID);
}
export function monsterHasPoisonResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_POISON);
}
export function monsterHasStoneResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_STONE);
}
export function monsterResistsEffect(monster, attackLevel, random = rn2) {
    let defenseLevel = monster?.m_lev ?? 1;
    if (defenseLevel > 50)
        defenseLevel = 50;
    else if (defenseLevel < 1)
        defenseLevel = monsterIsPlayerMonster(monster.mnum) ? game.u.ulevel ?? 1 : 1;
    const resistance = MONSTER_MAGIC_RESISTANCE[monster?.mnum] ?? 0;
    return random(100 + attackLevel - defenseLevel) < resistance;
}
//# sourceMappingURL=monster_resistance.js.map