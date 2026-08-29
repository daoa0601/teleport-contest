// Source-shaped disappearance for a monster which grants a wish and leaves.
// C refs: mon.c:mongone(), steal.c:mdrop_special_objs(), and
// mkobj.c:discard_minvent().

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { newsym } from './display.js';
import { place_object, stack_object } from './mklev.js';
import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION,
    CORPSE, SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';

const RIDER_MONSTERS = new Set([311, 312, 313]);
const INVOCATION_OBJECTS = new Set([
    AMULET_OF_YENDOR,
    CANDELABRUM_OF_INVOCATION,
    BELL_OF_OPENING,
    SPE_BOOK_OF_THE_DEAD,
]);

function resistsWithoutRoll(object) {
    return INVOCATION_OBJECTS.has(object?.otyp)
        || (object?.otyp === CORPSE && RIDER_MONSTERS.has(object?.corpsenm));
}

function currentQuestArtifact(object) {
    return !!(object?.questArtifact || object?.isQuestArtifact);
}

function clearMonsterCarriedState(object) {
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}

function dropWishProtectedObject(object, x, y) {
    place_object(object, x, y);
    return stack_object(object, game);
}

export function removeWishGrantingMonster(monster, {
    preserveGlyph = false,
} = {}) {
    if (!monster) {
        return { removed: false, dropped: [], discarded: [] };
    }

    const x = monster.mx, y = monster.my;
    const dropped = [];
    const discarded = [];
    for (const object of monster.minvent || monster.inventory || []) {
        const noRollResistance = resistsWithoutRoll(object);
        if (!noRollResistance) rn2(100);
        if (noRollResistance || currentQuestArtifact(object)) {
            clearMonsterCarriedState(object);
            dropped.push(dropWishProtectedObject(object, x, y));
        } else {
            object.where = 'gone';
            discarded.push(object);
        }
    }

    monster.mhp = 0;
    monster.dead = true;
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;
    monster.mw = null;
    if (game?.u?.ustuck === monster) {
        game.u.ustuck = null;
        game.u.uswallow = false;
    }
    game.level.monsters = (game.level.monsters || [])
        .filter(candidate => candidate !== monster);
    if (!preserveGlyph) newsym(x, y);
    return { removed: true, dropped, discarded, x, y };
}
