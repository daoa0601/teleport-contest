#include "hack.h"

/* Read the real objects[] fields. objects_globals_init() copies obj_init;
 * the spec supplies that initializer, without retyping any row values. */
int verification_object_class(int otyp) { return objects[otyp].oc_class; }
int verification_object_material(int otyp) { return objects[otyp].oc_material; }
unsigned verification_object_weight(int otyp) { return objects[otyp].oc_weight; }
int verification_object_cost(int otyp) { return objects[otyp].oc_cost; }
int verification_object_delay(int otyp) { return objects[otyp].oc_delay; }
int verification_object_property(int otyp) { return objects[otyp].oc_oprop; }
int verification_object_direction(int otyp) { return objects[otyp].oc_dir; }
int verification_object_skill(int otyp) { return objects[otyp].oc_skill; }
int verification_object_bimanual(int otyp) { return objects[otyp].oc_bimanual; }
int verification_object_merge(int otyp) { return objects[otyp].oc_merge; }
int verification_object_uses_known(int otyp) { return objects[otyp].oc_uses_known; }
int verification_object_unique(int otyp) { return objects[otyp].oc_unique; }
int verification_object_magic(int otyp) { return objects[otyp].oc_magic; }
int verification_object_charged(int otyp) { return objects[otyp].oc_charged; }

/* Port-only extension: C has no class lookup outside its object table.
 * This guard defines the port's zero result; it is not a native safety claim. */
int verification_object_class_outside(int otyp)
{
    return otyp < 0 || otyp >= NUM_OBJECTS ? 0 : objects[otyp].oc_class;
}
