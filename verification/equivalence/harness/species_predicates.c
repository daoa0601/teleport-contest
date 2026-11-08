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

int verification_slithy(struct permonst *ptr)
{
    return slithy(ptr);
}

int verification_nolimbs(struct permonst *ptr)
{
    return nolimbs(ptr);
}

int verification_is_orc(struct permonst *ptr)
{
    return is_orc(ptr);
}

int verification_is_elf(struct permonst *ptr)
{
    return is_elf(ptr);
}

int verification_unsolid(struct permonst *ptr)
{
    return unsolid(ptr);
}

int verification_is_neuter(struct permonst *ptr)
{
    return is_neuter(ptr);
}

int verification_amorphous(struct permonst *ptr)
{
    return amorphous(ptr);
}

int verification_strongmonst(struct permonst *ptr)
{
    return strongmonst(ptr);
}

int verification_tunnels(struct permonst *ptr)
{
    return tunnels(ptr);
}

int verification_needspick(struct permonst *ptr)
{
    return needspick(ptr);
}

int verification_notake(struct permonst *ptr)
{
    return notake(ptr);
}

int verification_has_head(struct permonst *ptr)
{
    return has_head(ptr);
}

int verification_is_undead(struct permonst *ptr)
{
    return is_undead(ptr);
}

int verification_is_human(struct permonst *ptr)
{
    return is_human(ptr);
}

int verification_is_were(struct permonst *ptr)
{
    return is_were(ptr);
}

int verification_is_dwarf(struct permonst *ptr)
{
    return is_dwarf(ptr);
}

int verification_is_gnome(struct permonst *ptr)
{
    return is_gnome(ptr);
}

int verification_is_domestic(struct permonst *ptr)
{
    return is_domestic(ptr);
}

int verification_is_mercenary(struct permonst *ptr)
{
    return is_mercenary(ptr);
}

int verification_is_male(struct permonst *ptr)
{
    return is_male(ptr);
}

int verification_is_wanderer(struct permonst *ptr)
{
    return is_wanderer(ptr);
}

int verification_is_lord(struct permonst *ptr)
{
    return is_lord(ptr);
}

int verification_is_prince(struct permonst *ptr)
{
    return is_prince(ptr);
}

int verification_is_minion(struct permonst *ptr)
{
    return is_minion(ptr);
}

int verification_lays_eggs(struct permonst *ptr)
{
    return lays_eggs(ptr);
}

int verification_regenerates(struct permonst *ptr)
{
    return regenerates(ptr);
}

int verification_acidic(struct permonst *ptr)
{
    return acidic(ptr);
}

int verification_poisonous(struct permonst *ptr)
{
    return poisonous(ptr);
}

int verification_carnivorous(struct permonst *ptr)
{
    return carnivorous(ptr);
}

int verification_herbivorous(struct permonst *ptr)
{
    return herbivorous(ptr);
}

int verification_metallivorous(struct permonst *ptr)
{
    return metallivorous(ptr);
}

int verification_polyok(struct permonst *ptr)
{
    return polyok(ptr);
}

int verification_is_shapeshifter(struct permonst *ptr)
{
    return is_shapeshifter(ptr);
}

int verification_likes_gold(struct permonst *ptr)
{
    return likes_gold(ptr);
}

int verification_likes_gems(struct permonst *ptr)
{
    return likes_gems(ptr);
}

int verification_likes_magic(struct permonst *ptr)
{
    return likes_magic(ptr);
}

int verification_thick_skinned(struct permonst *ptr)
{
    return thick_skinned(ptr);
}

int verification_is_displacer(struct permonst *ptr)
{
    return is_displacer(ptr);
}

int verification_is_armed(struct permonst *ptr)
{
    return is_armed(ptr);
}

int verification_infravision(struct permonst *ptr)
{
    return infravision(ptr);
}

int verification_infravisible(struct permonst *ptr)
{
    return infravisible(ptr);
}

int verification_cant_drown(struct permonst *ptr)
{
    return cant_drown(ptr);
}

int verification_cantwield(struct permonst *ptr)
{
    return cantwield(ptr);
}

int verification_cantweararm(struct permonst *ptr)
{
    return cantweararm(ptr);
}

int verification_could_twoweap(struct permonst *ptr)
{
    return could_twoweap(ptr);
}

int verification_eggs_in_water(struct permonst *ptr)
{
    return eggs_in_water(ptr);
}

int verification_likes_objs(struct permonst *ptr)
{
    return likes_objs(ptr);
}

int verification_is_ndemon(struct permonst *ptr)
{
    return is_ndemon(ptr);
}

int verification_is_dlord(struct permonst *ptr)
{
    return is_dlord(ptr);
}

int verification_is_dprince(struct permonst *ptr)
{
    return is_dprince(ptr);
}

/* fv-equivalence-batch-14: further mondata.h macros and the two mondata.c
 * helpers over one species row. */
int verification_is_whirly(struct permonst *ptr)
{
    return is_whirly(ptr);
}

int verification_is_rider(struct permonst *ptr)
{
    return is_rider(ptr);
}

int verification_nonliving(struct permonst *ptr)
{
    return nonliving(ptr);
}

int verification_is_vampire(struct permonst *ptr)
{
    return is_vampire(ptr);
}

int verification_flesh_petrifies(struct permonst *ptr)
{
    return flesh_petrifies(ptr);
}

int verification_passes_rocks(struct permonst *ptr)
{
    return passes_rocks(ptr);
}

int verification_is_mplayer(struct permonst *ptr)
{
    return is_mplayer(ptr);
}

int verification_is_unicorn(struct permonst *ptr)
{
    return is_unicorn(ptr);
}

int verification_eyecount(struct permonst *ptr)
{
    return eyecount(ptr);
}

int verification_touch_petrifies(struct permonst *ptr)
{
    return touch_petrifies(ptr);
}

int verification_emits_light(struct permonst *ptr)
{
    return emits_light(ptr);
}

int verification_vegan(struct permonst *ptr)
{
    return vegan(ptr);
}

int verification_vegetarian(struct permonst *ptr)
{
    return vegetarian(ptr);
}

boolean
verification_poly_when_stoned(struct permonst *ptr)
{
    return poly_when_stoned(ptr);
}

unsigned long
verification_cvt_adtyp_to_mseenres(uchar adtyp)
{
    return cvt_adtyp_to_mseenres(adtyp);
}
