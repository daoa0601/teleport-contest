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
