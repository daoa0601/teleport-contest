// C do_name.c:name_from_player(). Empty input cancels; spaces erase a name.
import { PL_PSIZ } from './const.js';
import { getLine } from './query.js';
export async function playerName(prompt) {
    const input = await getLine(prompt, (_ch, key) => key <= 255);
    if (input === null || input === '')
        return null;
    // mungspaces() changes ASCII spaces and tabs, leaving high bytes intact.
    return input.replace(/^[ \t]+|[ \t]+$/g, '').replace(/[ \t]+/g, ' ')
        .slice(0, PL_PSIZ - 1);
}
//# sourceMappingURL=player_name.js.map