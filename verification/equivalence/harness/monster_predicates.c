#include "hack.h"

/* Expand the real trait macros over one monster; the spec supplies a
 * struct monst whose data points at mons[species]. */
int verification_mon_resistancebits(struct monst *mon)
{
    return mon_resistancebits(mon);
}
