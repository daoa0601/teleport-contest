import { game } from './gstate.js';
// Guard for values parsed out of the option's grammar.
export function isMenuObjsymMode(value) {
    return Number.isInteger(value) && value >= 0 && value <= 5;
}
// C options.c:set_menuobjsyms_flags(): iflags.menu_head_objsym, the bit
// that appends the class symbol to let_to_name() menu headings.
export function menuHeadObjsym() {
    return ((game.iflags.menuobjsyms ?? 4) & 1) !== 0;
}
// C options.c:set_menuobjsyms_flags(): iflags.use_menu_glyphs, the bit that
// shows an entry's object glyph in the tty menu separator column.
export function useMenuGlyphs() {
    return ((game.iflags.menuobjsyms ?? 4) & (2 | 4)) !== 0;
}
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