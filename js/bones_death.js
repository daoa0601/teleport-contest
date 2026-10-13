// C refs: bones.c:savebones(), drop_upon_death(), and give_to_nearby_mon().
import { monsterHasMapPosition } from './monster_location.js';
import { CORPSTAT_INIT, G_NOCORPSE, GRAVE, HEADSTONE, isok, LEAVESTATUE, MM_NONAME, NON_PM, NO_MINVENT, ROOM, Upolyd, } from './const.js';
import { completeBonesMonster, giveHeroResistancesToMonster, } from './bones_monster.js';
import { artifactEmitsLight } from './artifacts.js';
import { game, requireGameLevel } from './gstate.js';
import { setTwoWeaponCombat } from './weapon_slots.js';
import { makeEngravingAt } from './engrave.js';
import { endObjectBurn } from './light.js';
import { placeObjectSynchronously, placeCreatedObject } from './floor_object.js';
import { bonesLevelExists, createCorpstatAt, makemonAt, mkcorpstat, mksobj, saveBonesLevel, } from './mklev.js';
import { monsterCanCarryObject, monsterLikesObjects, } from './monster_carry.js';
import { linkObjectToMonsterInventory } from './monster_inventory.js';
import { initializeMonsterArmor } from './monworn.js';
import { addObjectToContainer } from './object_container.js';
import { CORPSE, MUMMY_WRAPPING, STATUE } from './object_data.js';
import { curseObjectState } from './object_state.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_SYMBOL } from './monster_data.js';
import { objectNoLongerHeldSynchronously } from './object_release.js';
import { rn2 } from './rng.js';
import { objectWeight } from './weight.js';
const PM_HUMAN = 260;
const PM_GHOST = 287;
const S_MUMMY = 39;
const M2_UNDEAD = 0x00000002;
function clearHeroCarriedState(object) {
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}
function monsterAt(x, y) {
    return (game.level?.monsters || []).find(monster => monsterHasMapPosition(monster, game) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
function nearbyMonsterForDeathDrop(x, y) {
    let selected = null;
    let candidateCount = 0;
    for (let nearbyX = x - 1; nearbyX <= x + 1; nearbyX++) {
        for (let nearbyY = y - 1; nearbyY <= y + 1; nearbyY++) {
            if (!isok(nearbyX, nearbyY)
                || nearbyX === game.u.ux && nearbyY === game.u.uy)
                continue;
            const monster = monsterAt(nearbyX, nearbyY);
            if (!monster || !monsterLikesObjects(monster))
                continue;
            candidateCount++;
            if (rn2(candidateCount) === 0)
                selected = monster;
        }
    }
    return selected;
}
async function giveDeathDropToNearbyMonster(object, x, y) {
    const monster = nearbyMonsterForDeathDrop(x, y);
    if (!monster || !monsterCanCarryObject(monster, object, game))
        return false;
    await linkObjectToMonsterInventory(monster, object);
    return true;
}
export async function dropHeroInventoryForBones(x, y, { carrier = null, container = null } = {}) {
    setTwoWeaponCombat(false);
    while ((game.inventory || []).length) {
        const object = game.inventory.shift();
        if (!object)
            break;
        object.where = 'free';
        if (!carrier || ((MONSTER_FLAGS2[carrier.mnum] ?? 0) & M2_UNDEAD))
            objectNoLongerHeldSynchronously(object, game);
        if ((container || artifactEmitsLight(object)) && object.lamplit)
            endObjectBurn(object, game, game.moves ?? 0);
        clearHeroCarriedState(object);
        if (rn2(5))
            curseObjectState(object);
        if (carrier) {
            await linkObjectToMonsterInventory(carrier, object);
            continue;
        }
        if (container) {
            await addObjectToContainer(container, object, game);
            continue;
        }
        if (rn2(8) === 0 && await giveDeathDropToNearbyMonster(object, x, y))
            continue;
        placeObjectSynchronously(object, x, y);
    }
    if (container)
        container.owt = objectWeight(container);
}
async function makeBonesMonster(mnum, x, y, flags) {
    game.in_mklev = true;
    try {
        return await makemonAt(mnum, x, y, flags);
    }
    finally {
        game.in_mklev = false;
    }
}
async function addMummyWrapping(monster) {
    if (MONSTER_SYMBOL[monster.mnum] !== S_MUMMY
        || (monster.minvent ?? []).some(object => object.otyp === MUMMY_WRAPPING)) {
        return;
    }
    await linkObjectToMonsterInventory(monster, await mksobj(MUMMY_WRAPPING, true, false));
}
export async function createBonesFromDeath(deathCause, promptDeathQuestion) {
    if (!game._canMakeBones)
        return false;
    const level = requireGameLevel();
    const x = game.u?.ux ?? 0;
    const y = game.u?.uy ?? 0;
    const arise = game.u?.ugrave_arise ?? NON_PM;
    let corpse = null;
    const heroForm = game.u.umonnum;
    if (heroForm === undefined)
        throw new Error('Death remains require an initialized hero species');
    const formFlags = game.mvitals?.[heroForm]?.mvflags ?? MONSTER_GENO[heroForm] ?? 0;
    if (arise === NON_PM && !(formFlags & G_NOCORPSE)) {
        const species = Upolyd(game.u) ? heroForm : game.urace?.mnum ?? PM_HUMAN;
        corpse = await createCorpstatAt(CORPSE, null, species, x, y, CORPSTAT_INIT);
        corpse.name = `${game.plname || 'player'} corpse`;
        corpse.oname = game.plname || 'player';
        const deathSquare = level.at(x, y);
        const trapped = level.traps.some(trap => trap.tx === x && trap.ty === y);
        if (deathSquare && (deathSquare.typ === ROOM || deathSquare.typ === GRAVE) && !trapped) {
            const wasGrave = deathSquare.typ === GRAVE;
            deathSquare.typ = GRAVE;
            if (!wasGrave)
                deathSquare.emptygrave = 1;
            makeEngravingAt(x, y, `${game.plname || 'player'}, ${deathCause}`, null, 0, HEADSTONE);
        }
    }
    if (game.flags?.debug) {
        const save = await promptDeathQuestion('Save bones?');
        if (save !== 'y')
            return false;
    }
    if (bonesLevelExists()) {
        if (!game.flags?.debug)
            return false;
        const replace = await promptDeathQuestion('Bones file already exists.  Replace it?');
        if (replace !== 'y')
            return false;
    }
    if (arise === LEAVESTATUE) {
        const form = game.u?.umonnum ?? game.urace?.mnum ?? PM_HUMAN;
        const statue = await mkcorpstat(STATUE, null, form, x, y, 0);
        statue.oname = game.plname || 'player';
        await dropHeroInventoryForBones(x, y, { container: statue });
        game._bonesSaved = saveBonesLevel();
        return game._bonesSaved;
    }
    if (arise >= 0) {
        const monster = await makeBonesMonster(arise, x, y, NO_MINVENT);
        if (!monster) {
            await dropHeroInventoryForBones(x, y);
            game.u.ugrave_arise = NON_PM;
            game._bonesSaved = false;
            return false;
        }
        giveHeroResistancesToMonster(monster, game);
        await dropHeroInventoryForBones(x, y, { carrier: monster });
        await addMummyWrapping(monster);
        await initializeMonsterArmor(monster);
        completeBonesMonster(monster, game);
        game._bonesSaved = saveBonesLevel();
        return game._bonesSaved;
    }
    await dropHeroInventoryForBones(x, y);
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
//# sourceMappingURL=bones_death.js.map