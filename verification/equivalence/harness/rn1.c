/* rn1() is a macro in hack.h. This wrapper lets clang expand it, including
   hack.h's caller-logging rn2() macro, exactly as a game source file would. */
#include "hack.h"

int
rn1_macro(int x, int y)
{
    return rn1(x, y);
}
