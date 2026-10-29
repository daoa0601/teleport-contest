/* Let clang expand the real alignment macros, including their conversions. */
#include "hack.h"

unsigned
align_to_mask(int alignment)
{
    return Align2amask(alignment);
}

aligntyp
mask_to_align(int mask)
{
    return Amask2align(mask);
}
