// C engrave.c:disturb_grave(), shared by engraving and kicking.
import { GRAVE, NO_MM_FLAGS, A_WIS } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { impossible } from './diagnostics.js';
import { pline } from './display.js';
import { game, requireGameLevel } from './gstate.js';
import { makemonAt } from './mklev.js';
const PM_GHOUL = 246;
export async function disturbGrave(x, y, state = game) {
    const location = requireGameLevel(state).requireAt(x, y);
    if (location.typ !== GRAVE) {
        await impossible(`Disturbing grave that isn't a grave? (${location.typ})`);
    }
    else if (location.disturbed) {
        await impossible('Disturbing already disturbed grave?');
    }
    else {
        await pline('You disturb the undead!');
        location.disturbed = 1;
        await makemonAt(PM_GHOUL, x, y, NO_MM_FLAGS);
        await exerciseAttribute(A_WIS, false, state);
    }
}
//# sourceMappingURL=grave.js.map