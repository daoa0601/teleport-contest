// C objclass.h
// enum objclass_classes: RANDOM_CLASS, defsym.h's OBJCLASS_CLASS_ENUM order,
// then MAXOCLASSES. Values follow include/defsym.h's OBJCLASS entries.
export const RANDOM_CLASS = 0;
export const ILLOBJ_CLASS = 1;
export const WEAPON_CLASS = 2;
export const ARMOR_CLASS = 3;
export const RING_CLASS = 4;
export const AMULET_CLASS = 5;
export const TOOL_CLASS = 6;
export const FOOD_CLASS = 7;
export const POTION_CLASS = 8;
export const SCROLL_CLASS = 9;
export const SPBOOK_CLASS = 10;
export const WAND_CLASS = 11;
export const COIN_CLASS = 12;
export const GEM_CLASS = 13;
export const ROCK_CLASS = 14;
export const BALL_CLASS = 15;
export const CHAIN_CLASS = 16;
export const VENOM_CLASS = 17;
export const MAXOCLASSES = 18;
// C objclass.h: mkobj() alone accepts this class to exclude novels.
export const SPBOOK_no_NOVEL = -SPBOOK_CLASS;
//# sourceMappingURL=objclass.js.map