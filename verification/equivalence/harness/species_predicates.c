#include "hack.h"

/* Expand the real trait macros; the spec supplies a valid mons[] pointer. */
int verification_mindless(struct permonst *ptr)
{
    return mindless(ptr);
}

int verification_nohands(struct permonst *ptr)
{
    return nohands(ptr);
}

int verification_humanoid(struct permonst *ptr)
{
    return humanoid(ptr);
}

int verification_ceiling_hider(struct permonst *ptr)
{
    return ceiling_hider(ptr);
}

int verification_is_animal(struct permonst *ptr)
{
    return is_animal(ptr);
}

int verification_noncorporeal(struct permonst *ptr)
{
    return noncorporeal(ptr);
}

int verification_breathless(struct permonst *ptr)
{
    return breathless(ptr);
}
