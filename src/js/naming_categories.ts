// C do_name.c:docallcmd() category menu.
import { NHW_MENU, PICK_ONE } from './const.js';
import { game } from './gstate.js';
import {
    tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu,
    tty_select_menu, tty_start_menu,
} from './tty_menu.js';

export async function chooseNamingCategory(): Promise<string | null> {
    const window = tty_create_nhwindow<string>(NHW_MENU);
    try {
        await tty_start_menu(window);
        const add = (key: string, group: string, text: string): void => {
            tty_add_menu(window, { identifier: key, group, text,
                ...(!game.flags.lootabc ? { selector: key } : {}) });
        };
        add('m', 'C', 'a monster');
        if (game.inventory.length) {
            add('i', 'y', 'a particular object in inventory');
            add('o', 'n', 'the type of an object in inventory');
        }
        add('f', ',', 'the type of an object upon the floor');
        add('d', '\\', 'the type of an object on discoveries list');
        add('a', 'l', 'record an annotation for the current level');
        tty_end_menu(window, 'What do you want to name?');
        const result = await tty_select_menu(window, PICK_ONE);
        return result.selections[0]?.identifier ?? null;
    } finally {
        await tty_destroy_nhwindow(window);
    }
}
