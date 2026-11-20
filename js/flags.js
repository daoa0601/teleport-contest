// C flag.h: struct flag (flag.h:18) is the only option block in the save
// file: save.c:savegamestate() writes it with Sfo_flag() and restore.c
// restgamestate() reads it back with Sfi_flag(). These GameFlags fields
// model options C stores outside it — struct instance_flags (flag.h:251;
// cmdassist/fireassist at flag.h:410-411, pricequotes at flag.h:348), the
// a11y accessibility struct (flag.h:220), botl.c's condtests[] statics, and
// decl.c globals like gd.dogname — so a restoring process keeps the values
// its own run-time configuration parsed instead of the saved ones.
export const INSTANCE_FLAG_OPTION_KEYS = [
    // struct instance_flags
    'cmdassist', 'fireassist', 'price_quotes', 'color', 'customcolors',
    'customsymbols', 'debug_fuzzer', 'extmenu', 'force_invmenu',
    'herecmd_menu', 'hilite_pet', 'hilite_pile', 'hitpointbar',
    'menu_overlay', 'menucolors', 'query_menu', 'showdamage', 'use_inverse',
    // the a11y struct
    'accessiblemsg', 'mention_map', 'mon_movement', 'spot_monsters',
    // botl.c condtests[] choice bits
    'statusConditionMask',
    // decl.c pet-name globals (gp.preferred_pet, gd/gc/gh names)
    'pettype', 'dogname', 'catname', 'horsename',
];
//# sourceMappingURL=flags.js.map