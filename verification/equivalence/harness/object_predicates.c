#include "hack.h"

/* Expand the real object-table macros; the spec supplies a held object
 * with its otyp/oclass fields and the initial objects[] table. */
int verification_damageable(struct obj *otmp)
{
    return is_damageable(otmp);
}

/* objnam.c:readobjnam()'s primary-erosion test, macro-expanded. */
int verification_primary_erosion(struct obj *otmp)
{
    return is_flammable(otmp) || is_rustprone(otmp) || is_crackable(otmp);
}

/* objnam.c:readobjnam()'s secondary-erosion test, macro-expanded. */
int verification_secondary_erosion(struct obj *otmp)
{
    return is_corrodeable(otmp) || is_rottable(otmp);
}

/* Expand the real obj.h weapon/tool macros; the spec supplies a held
 * object with otyp/oclass (and spe/oartifact where read) over the
 * initial objects[] table. */
int verification_is_weptool(struct obj *o)
{
    return is_weptool(o);
}

int verification_bimanual(struct obj *otmp)
{
    return bimanual(otmp);
}

int verification_is_missile(struct obj *otmp)
{
    return is_missile(otmp);
}

int verification_is_ammo(struct obj *otmp)
{
    return is_ammo(otmp);
}

int verification_ammo_and_launcher(struct obj *a, struct obj *l)
{
    return ammo_and_launcher(a, l);
}

int verification_is_poisonable(struct obj *otmp)
{
    return is_poisonable(otmp);
}

int verification_is_blunt_weapon(struct obj *o)
{
    return is_blunt_weapon(o);
}

int verification_is_flimsy(struct obj *otmp)
{
    return is_flimsy(otmp);
}

int verification_is_pick(struct obj *otmp)
{
    return is_pick(otmp);
}

int verification_is_axe(struct obj *otmp)
{
    return is_axe(otmp);
}

int verification_is_blade(struct obj *otmp)
{
    return is_blade(otmp);
}

int verification_is_wet_towel(struct obj *o)
{
    return is_wet_towel(o);
}

int verification_is_pole(struct obj *otmp)
{
    return is_pole(otmp);
}

int verification_is_sword(struct obj *otmp)
{
    return is_sword(otmp);
}

int verification_is_graystone(struct obj *obj)
{
    return is_graystone(obj);
}

int verification_is_multigen(struct obj *otmp)
{
    return is_multigen(otmp);
}
