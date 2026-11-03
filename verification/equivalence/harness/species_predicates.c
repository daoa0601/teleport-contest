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

int verification_verysmall(struct permonst *ptr)
{
    return verysmall(ptr);
}

int verification_haseyes(struct permonst *ptr)
{
    return haseyes(ptr);
}

int verification_bigmonst(struct permonst *ptr)
{
    return bigmonst(ptr);
}

int verification_is_flyer(struct permonst *ptr)
{
    return is_flyer(ptr);
}

int verification_is_floater(struct permonst *ptr)
{
    return is_floater(ptr);
}

int verification_is_clinger(struct permonst *ptr)
{
    return is_clinger(ptr);
}

int verification_is_swimmer(struct permonst *ptr)
{
    return is_swimmer(ptr);
}

/* verification_amphibious (no argument) already lives in hero_properties.c. */
int verification_amphibious_monster(struct permonst *ptr)
{
    return amphibious(ptr);
}

int verification_passes_walls(struct permonst *ptr)
{
    return passes_walls(ptr);
}

int verification_can_teleport(struct permonst *ptr)
{
    return can_teleport(ptr);
}

int verification_control_teleport(struct permonst *ptr)
{
    return control_teleport(ptr);
}

int verification_perceives(struct permonst *ptr)
{
    return perceives(ptr);
}

int verification_hides_under(struct permonst *ptr)
{
    return hides_under(ptr);
}

int verification_is_hider(struct permonst *ptr)
{
    return is_hider(ptr);
}

int verification_is_demon(struct permonst *ptr)
{
    return is_demon(ptr);
}

int verification_is_golem(struct permonst *ptr)
{
    return is_golem(ptr);
}

int verification_is_giant(struct permonst *ptr)
{
    return is_giant(ptr);
}

int verification_is_female(struct permonst *ptr)
{
    return is_female(ptr);
}

int verification_throws_rocks(struct permonst *ptr)
{
    return throws_rocks(ptr);
}

int verification_type_is_pname(struct permonst *ptr)
{
    return type_is_pname(ptr);
}

int verification_is_silent(struct permonst *ptr)
{
    return is_silent(ptr);
}
