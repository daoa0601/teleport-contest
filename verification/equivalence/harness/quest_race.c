#include "hack.h"

/* fv-equivalence-batch-15: the quest-retargeted mondata.h macros, the
 * gu.urace mask macros, the branch-dependent grounded() macro, and
 * trap.c:into_vs_onto. The specs supply a valid mons[] pointer, the
 * related urole/urace state, the modeled u.uz/dungeon_topology branch
 * state, and the trap type. */
int verification_always_hostile(struct permonst *ptr)
{
    return always_hostile(ptr);
}

int verification_always_peaceful(struct permonst *ptr)
{
    return always_peaceful(ptr);
}

int verification_extra_nasty(struct permonst *ptr)
{
    return extra_nasty(ptr);
}

/* mondata.h:is_covetous returns the raw masked word; callers test it for
 * truth, and the port returns a boolean. */
int verification_is_covetous(struct permonst *ptr)
{
    return is_covetous(ptr) != 0;
}

int verification_your_race(struct permonst *ptr)
{
    return your_race(ptr);
}

int verification_race_hostile(struct permonst *ptr)
{
    return race_hostile(ptr);
}

int verification_race_peaceful(struct permonst *ptr)
{
    return race_peaceful(ptr);
}

int verification_grounded(struct permonst *ptr)
{
    return grounded(ptr);
}

int verification_into_vs_onto(int traptype)
{
    return into_vs_onto(traptype);
}
