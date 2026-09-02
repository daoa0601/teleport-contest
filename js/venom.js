// Acid venom damage.
// C ref: weapon.c dmgval().

export function acidVenomDamage(rollOne) {
    return rollOne(6) + rollOne(6);
}
