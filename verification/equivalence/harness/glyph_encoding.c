#include "hack.h"

/* Expand the real display.h glyph-number macros; the spec supplies every
 * input as an int parameter and the initial enum/define constants come from
 * clang's own evaluation of the pinned headers. */
int verification_warning_to_glyph(int mwarnlev)
{
    return warning_to_glyph(mwarnlev);
}

int verification_monnum_to_glyph(int mnum, int gnd)
{
    return monnum_to_glyph(mnum, gnd);
}

int verification_petnum_to_glyph(int mnum, int gnd)
{
    return petnum_to_glyph(mnum, gnd);
}

int verification_detected_monnum_to_glyph(int mnum, int gnd)
{
    return detected_monnum_to_glyph(mnum, gnd);
}

int verification_ridden_monnum_to_glyph(int mnum, int gnd)
{
    return ridden_monnum_to_glyph(mnum, gnd);
}

int verification_objnum_to_glyph(int onum)
{
    return objnum_to_glyph(onum);
}

int verification_explosion_to_glyph(int expltyp, int idx)
{
    return explosion_to_glyph(expltyp, idx);
}

int verification_altar_to_glyph(int amsk)
{
    return altar_to_glyph(amsk);
}

/* display.h:cmap_to_glyph(): the four branch predicates of
 * cmap_walls_to_glyph() (dungeon.c:In_mines/In_hell, dungeon.h:Is_knox and
 * In_sokoban) read dungeon-topology state that the spec supplies as modeled
 * state and an In_hell call contract; the selected base is related to the
 * port caller's wallOffset parameter. */
int verification_cmap_to_glyph(int cmap_idx)
{
    return cmap_to_glyph(cmap_idx);
}

int verification_glyph_is_monster(int glyph)
{
    return glyph_is_monster(glyph);
}

int verification_glyph_is_pet(int glyph)
{
    return glyph_is_pet(glyph);
}

int verification_glyph_is_invisible(int glyph)
{
    return glyph_is_invisible(glyph);
}

int verification_glyph_is_detected_monster(int glyph)
{
    return glyph_is_detected_monster(glyph);
}

int verification_glyph_is_ridden_monster(int glyph)
{
    return glyph_is_ridden_monster(glyph);
}

int verification_glyph_is_body(int glyph)
{
    return glyph_is_body(glyph);
}

int verification_glyph_is_statue(int glyph)
{
    return glyph_is_statue(glyph);
}

int verification_glyph_is_object(int glyph)
{
    return glyph_is_object(glyph);
}

int verification_glyph_is_trap(int glyph)
{
    return glyph_is_trap(glyph);
}

int verification_glyph_is_cmap(int glyph)
{
    return glyph_is_cmap(glyph);
}

int verification_glyph_is_swallow(int glyph)
{
    return glyph_is_swallow(glyph);
}

int verification_glyph_is_warning(int glyph)
{
    return glyph_is_warning(glyph);
}

int verification_glyph_is_explosion(int glyph)
{
    return glyph_is_explosion(glyph);
}

int verification_glyph_is_cmap_zap(int glyph)
{
    return glyph_is_cmap_zap(glyph);
}

int verification_glyph_to_mon(int glyph)
{
    return glyph_to_mon(glyph);
}

int verification_glyph_to_obj(int glyph)
{
    return glyph_to_obj(glyph);
}

int verification_glyph_to_swallow(int glyph)
{
    return glyph_to_swallow(glyph);
}

int verification_glyph_to_warning(int glyph)
{
    return glyph_to_warning(glyph);
}

int verification_glyph_to_explosion(int glyph)
{
    return glyph_to_explosion(glyph);
}

int verification_glyph_to_trap(int glyph)
{
    return glyph_to_trap(glyph);
}

/* sym.h:#define NUM_ZAP is a macro, not an enumerator; expose it through the
 * constant machinery so a spec can bound beam types without re-typing it. */
enum { verification_num_zap = NUM_ZAP };
