#include "hack.h"

/* Expand the real rm.h/trap.h terrain macros over one symbolic terrain or
 * trap type. The spec supplies any int; only reachable games pass the
 * non-negative rm.h enum codes. */
int verification_IS_WALL(schar typ)
{
    return IS_WALL(typ);
}

int verification_IS_OBSTRUCTED(schar typ)
{
    return IS_OBSTRUCTED(typ);
}

int verification_IS_DOOR(schar typ)
{
    return IS_DOOR(typ);
}

int verification_is_pit(int ttyp)
{
    return is_pit(ttyp);
}

int verification_is_hole(int ttyp)
{
    return is_hole(ttyp);
}
