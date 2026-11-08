#include "hack.h"

/* Expand the real property macro for the experience API's boolean input. */
int verification_amphibious(void)
{
    return Amphibious;
}

/* Expand the real H<Prop> || E<Prop> resistance macros of youprop.h; the
   spec supplies the u.uprops[] slot's mask terms. */
int verification_fire_resistance(void)
{
    return Fire_resistance;
}

int verification_cold_resistance(void)
{
    return Cold_resistance;
}

int verification_sleep_resistance(void)
{
    return Sleep_resistance;
}

int verification_disint_resistance(void)
{
    return Disint_resistance;
}

int verification_shock_resistance(void)
{
    return Shock_resistance;
}

int verification_poison_resistance(void)
{
    return Poison_resistance;
}

int verification_drain_resistance(void)
{
    return Drain_resistance;
}

int verification_antimagic(void)
{
    return Antimagic;
}

int verification_acid_resistance(void)
{
    return Acid_resistance;
}

int verification_stone_resistance(void)
{
    return Stone_resistance;
}
