// C windows.c:get_menu_coloring(): the first menucoloring rule whose
// compiled regex matches the entry text supplies its color and attribute.
// The rule list is newest-first (coloratt.c:struct menucoloring), so the
// most recently added matching rule wins.
import { game } from './gstate.js';
import type { MenuColoringRule } from './flags.js';

export function getMenuColoring(text: string): MenuColoringRule | null {
    if (!game.flags.menucolors) return null;
    for (const rule of game.iflags.menuColorings ?? [])
        if (rule.regex.test(text)) return rule;
    return null;
}
