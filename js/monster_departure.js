// Remove a monster which leaves the game without dying.
// C refs: mon.c:mongone(), steal.c:mdrop_special_objs(), and
// mkobj.c:discard_minvent().

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { newsym } from './display.js';
import { place_object, stack_object } from './mklev.js';
import { artifactById } from './artifacts.js';
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
    return !!(object?.questArtifact || object?.isQuestArtifact
        || artifactById(object?.oartifact)?.questArtifact);
}

function clearMonsterCarriedState(object) {
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}

function dropProtectedObject(object, x, y) {
    place_object(object, x, y);
    return stack_object(object, game);
}

function discardObject(object) {
    object.where = 'gone';
    for (const content of object.contents || []) discardObject(content);
}

export function removeMonsterFromGame(monster, {
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
            dropped.push(dropProtectedObject(object, x, y));
        } else {
            discardObject(object);
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
    for (const room of game.level?.rooms || []) {
        if (room?.resident === monster) room.resident = null;
    }
    game.level.monsters = (game.level.monsters || [])
        .filter(candidate => candidate !== monster);
    if (!preserveGlyph) newsym(x, y);
    return { removed: true, dropped, discarded, x, y };
}

export function removeWishGrantingMonster(monster, options = {}) {
    return removeMonsterFromGame(monster, options);
}
