import { AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE, AD_DISN, AD_ELEC, AD_DRST, AD_ACID, AD_SPC1, AD_SPC2, } from './monster_attack_types.js';
// Native ray types encode the source in the tens digit and the effect in units.
export function rayDamageType(type) {
    const effects = [AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE,
        AD_DISN, AD_ELEC, AD_DRST, AD_ACID, AD_SPC1, AD_SPC2];
    const damage = effects[Math.abs(type) % 10];
    if (damage === undefined)
        throw new RangeError(`Invalid native ray type ${type}`);
    return damage;
}
//# sourceMappingURL=magic_types.js.map