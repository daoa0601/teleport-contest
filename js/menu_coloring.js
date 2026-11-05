// C windows.c:get_menu_coloring(): the first menucoloring rule whose
// compiled regex matches the entry text supplies its color and attribute.
// The rule list is newest-first (coloratt.c:struct menucoloring), so the
// most recently added matching rule wins.
import { MENU_ITEMFLAGS_SKIPINVERT } from './const.js';
import { game } from './gstate.js';
export function getMenuColoring(text) {
    if (!game.flags.menucolors)
        return null;
    for (const rule of game.iflags.menuColorings ?? [])
        if (rule.regex.test(text))
            return rule;
    return null;
}
// C windows.c:menuitem_invert_test(): whether a bulk menu command may
// change this entry. Entries without MENU_ITEMFLAGS_SKIPINVERT always pass;
// menuinvertmode 2 blocks every bulk change of a flagged entry, mode 1
// allows only turning a selected one off, mode 0 treats the flag as absent.
export function menuitem_invert_test(itemflags, is_selected) {
    if (!(itemflags & MENU_ITEMFLAGS_SKIPINVERT))
        return true;
    const mode = game.iflags.menuinvertmode ?? 1;
    if (mode === 2)
        return false;
    if (mode === 1)
        return is_selected;
    return true;
}
//# sourceMappingURL=menu_coloring.js.map