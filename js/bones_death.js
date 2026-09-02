// C refs: bones.c:savebones(), drop_upon_death(), and give_to_nearby_mon().

import {
    GRAVE, isok, LEAVESTATUE, MM_NONAME, NON_PM, NO_MINVENT,
} from './const.js';
import {
    completeBonesMonster, giveHeroResistancesToMonster,
} from './bones_monster.js';
import { game } from './gstate.js';
import { endObjectBurn } from './light.js';
import {
    bonesLevelExists, makemonAt, mkcorpstat, mksobj, place_object,
    saveBonesLevel,
} from './mklev.js';
import {
    monsterCanCarryObject, monsterLikesObjects,
} from './monster_carry.js';
import { linkObjectToMonsterInventory } from './monster_inventory.js';
import { initializeMonsterArmor } from './monworn.js';
import { addObjectToContainer } from './object_container.js';
import { CORPSE, MUMMY_WRAPPING, STATUE } from './object_data.js';
import { curseObjectState } from './object_state.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { rn2 } from './rng.js';
import { objectWeight } from './weight.js';

const PM_HUMAN = 260;
const PM_GHOST = 287;
const S_MUMMY = 39;

function clearHeroCarriedState(object) {
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}

function monsterAt(x, y) {
    return (game.level?.monsters || []).find(monster =>
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function nearbyMonsterForDeathDrop(x, y) {
    let selected = null;
    let candidateCount = 0;
    for (let nearbyX = x - 1; nearbyX <= x + 1; nearbyX++) {
        for (let nearbyY = y - 1; nearbyY <= y + 1; nearbyY++) {
            if (!isok(nearbyX, nearbyY)
                || nearbyX === game.u.ux && nearbyY === game.u.uy) continue;
            const monster = monsterAt(nearbyX, nearbyY);
            if (!monster || !monsterLikesObjects(monster)) continue;
            candidateCount++;
            if (rn2(candidateCount) === 0) selected = monster;
        }
    }
    return selected;
}

function giveDeathDropToNearbyMonster(object, x, y) {
    const monster = nearbyMonsterForDeathDrop(x, y);
    if (!monster || !monsterCanCarryObject(monster, object)) return false;
    linkObjectToMonsterInventory(monster, object);
    return true;
}

export function dropHeroInventoryForBones(
    x, y, { carrier = null, container = null } = {},
) {
    game.u.twoweap = false;
    while ((game.inventory || []).length) {
        const object = game.inventory.shift();
        if (container && object.lamplit)
            endObjectBurn(object, game, game.moves ?? 0);
        clearHeroCarriedState(object);
        if (rn2(5)) curseObjectState(object);
        if (carrier) {
            linkObjectToMonsterInventory(carrier, object);
            continue;
        }
        if (container) {
            addObjectToContainer(container, object, game);
            continue;
        }
        if (rn2(8) === 0 && giveDeathDropToNearbyMonster(object, x, y))
            continue;
        place_object(object, x, y);
    }
    if (container) container.owt = objectWeight(container);
}

async function makeBonesMonster(mnum, x, y, flags) {
    game.in_mklev = true;
    try {
        return await makemonAt(mnum, x, y, flags);
    } finally {
        game.in_mklev = false;
    }
}

function addMummyWrapping(monster) {
    if (MONSTER_SYMBOL[monster.mnum] !== S_MUMMY
        || monster.minvent.some(object => object.otyp === MUMMY_WRAPPING)) {
        return;
    }
    linkObjectToMonsterInventory(
        monster, mksobj(MUMMY_WRAPPING, true, false),
    );
}

export async function createBonesFromDeath(promptDeathQuestion) {
    if (!game._canMakeBones) return false;
    const x = game.u?.ux ?? 0;
    const y = game.u?.uy ?? 0;
    const arise = game.u?.ugrave_arise ?? NON_PM;
    let corpse = null;

    if (arise === NON_PM) {
        corpse = mksobj(CORPSE, true, false);
        corpse.corpsenm = game.urace?.mnum ?? PM_HUMAN;
        corpse.name = `${game.plname || 'player'} corpse`;
        corpse.oname = game.plname || 'player';
        place_object(corpse, x, y);

        const deathSquare = game.level?.at?.(x, y);
        if (deathSquare) {
            deathSquare.typ = GRAVE;
            deathSquare.emptygrave = 1;
            deathSquare.graveText = `${game.plname || 'player'}, killed by ${
                game._deathKiller || 'an unknown cause'
            }`;
        }
    }

    if (game.flags?.debug) {
        const save = await promptDeathQuestion('Save bones? [yn] (n) ');
        if (save !== 'y') return false;
    }
    if (bonesLevelExists()) {
        if (!game.flags?.debug) return false;
        const replace = await promptDeathQuestion(
            'Bones file already exists.  Replace it? [yn] (n) ',
        );
        if (replace !== 'y') return false;
    }

    if (arise === LEAVESTATUE) {
        const form = game.u?.umonnum ?? game.urace?.mnum ?? PM_HUMAN;
        const statue = mkcorpstat(STATUE, null, form, x, y, 0);
        statue.oname = game.plname || 'player';
        dropHeroInventoryForBones(x, y, { container: statue });
        game._bonesSaved = saveBonesLevel();
        return game._bonesSaved;
    }

    if (arise >= 0) {
        const monster = await makeBonesMonster(arise, x, y, NO_MINVENT);
        if (!monster) {
            dropHeroInventoryForBones(x, y);
            game.u.ugrave_arise = NON_PM;
            game._bonesSaved = false;
            return false;
        }
        giveHeroResistancesToMonster(monster, game);
        dropHeroInventoryForBones(x, y, { carrier: monster });
        addMummyWrapping(monster);
        initializeMonsterArmor(monster);
        completeBonesMonster(monster, game);
        game._bonesSaved = saveBonesLevel();
        return game._bonesSaved;
    }

    dropHeroInventoryForBones(x, y);

    const ghost = await makeBonesMonster(PM_GHOST, x, y, MM_NONAME);
    if (ghost) {
        completeBonesMonster(ghost, game);
        if (corpse) {
            corpse.oextra = { ...(corpse.oextra || {}), omid: ghost.m_id };
        }
    }
    game._bonesSaved = saveBonesLevel();
    return game._bonesSaved;
}
