#include "hack.h"

/* Expand the real trait macros; the spec supplies a valid mons[] pointer. */
int verification_digests(struct permonst *ptr)
{
    return digests(ptr);
}

int verification_enfolds(struct permonst *ptr)
{
    return enfolds(ptr);
}

/* Observe presence, matching the Boolean callback result in the port. */
int verification_attacktype_digests(struct permonst *ptr)
{
    return attacktype_fordmg(ptr, AT_ENGL, AD_DGST) != 0;
}
