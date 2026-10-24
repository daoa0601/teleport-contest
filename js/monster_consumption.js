import { G_GENOD, isok } from './const.js';
import { thawObject } from './container.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject } from './floor_object.js';
import { game } from './gstate.js';
import { healMonster } from './mon.js';
import { AD_POLY } from './monster_attack_types.js';
import { grantMonsterCorpseIntrinsic } from './monster_corpse_intrinsic.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_NAME } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { finishMonsterGrowth, growMonster } from './monster_growth.js';
import { addObjectToMonsterInventory, removeObjectFromMonsterInventory } from './monster_inventory.js';
import { isLevelPrize } from './level_prize.js';
import { objectMaterial } from './object_material.js';
import { beginMonsterMealMimicry } from './monster_meal_mimicry.js';
import { monsterName, possessiveName } from './monster_name.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { prepareMonsterPetrification, turnGolemToStone } from './monster_stoning.js';
import { CARROT, CORPSE, EGG, GLOB_OF_GREEN_SLIME, ICE_BOX, OBJECT_WEIGHT, TIN } from './object_data.js';
import { delobj } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { splitObjectStack } from './object_stack.js';
import { objectName, observeDistantObjectForNaming, simpleObjectNameWithArticle } from './objnam.js';
import { unpunishHero } from './punishment.js';
import { capitalizedDefiniteName } from './ray_hit_message.js';
import { d, rn2, rnd } from './rng.js';
import { fleshPetrifies } from './stoning.js';
import { surfaceName } from './terrain_name.js';
import { cansee } from './vision.js';
const PM_GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
const PM_QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_NURSE = MONSTER_NAME.indexOf('nurse');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const M1_NOEYES = 0x00001000;
const M2_SHAPESHIFTER = 0x00004000;
const MIMIC_SPECIES = new Set(['small mimic', 'large mimic', 'giant mimic'].map(name => MONSTER_NAME.indexOf(name)));
// C monmove.c:gelcube_digests(). Engulfed organic inventory costs a later
// action to digest, even when the cube resisted eating it off the floor.
export async function digestGelatinousCubeInventory(monster, state, options = {}) {
    if (monster.meating)
        return false;
    const object = monster.minvent?.find(candidate => objectMaterial(candidate, state) <= 8
        && !candidate.oartifact && !isLevelPrize(candidate, state));
    if (!object)
        return false;
    // eaten_stat(0, object) always returns at least one turn.
    monster.meating = 1;
    if (!await removeObjectFromMonsterInventory(monster, object, state, { publish: options.publish ?? plineWithContinuation }))
        throw new Error(`Cube could not release its meal ${object.o_id}`);
    await consumeMonsterObject(monster, object, state, options);
    return true;
}
function polymorphFood(object) {
    if (![CORPSE, EGG, TIN].includes(object.otyp)
        || object.corpsenm === undefined || object.corpsenm < 0)
        return false;
    return !!((MONSTER_FLAGS2[object.corpsenm] ?? 0) & M2_SHAPESHIFTER)
        || !!MONSTER_ATTACKS[object.corpsenm]?.some(([, damage]) => damage === AD_POLY);
}
async function emptyEatenContainer(monster, object, state, publish, random) {
    const x = monster.mx, y = monster.my;
    if (!object.contents?.length || !isok(x, y))
        return;
    const cube = monster.mnum === PM_GELATINOUS_CUBE;
    if (!cube && cansee(x, y)) {
        observeDistantObjectForNaming(object, state);
        const container = possessiveName(capitalizedDefiniteName(objectName(object, state), state));
        await publish(`${container} contents spill out onto the ${surfaceName(x, y, state)}.`);
    }
    for (const content of [...object.contents]) {
        unlinkObject(content, state);
        if (object.otyp === ICE_BOX)
            thawObject(content, state);
        if (cube)
            await addObjectToMonsterInventory(monster, content, state);
        else {
            const landing = await applyFloorEffects(content, x, y, { state, publish, random });
            if (landing.heroDied)
                return;
            if (!landing.finished)
                await placeObject(content, x, y, state);
        }
        if (state.program_state.gameover)
            return;
    }
}
async function growAfterFood(monster, state, { publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    const growth = growMonster(monster, { state, random, rollOne });
    if (!growth.changedSpecies)
        return;
    if (canSpotMonster(monster))
        await publish(growth.message);
    finishMonsterGrowth(monster, growth);
    newsym(monster.mx, monster.my);
    if (growth.genocided)
        await finishEnvironmentalMonsterDeath(monster, state, { publish, random });
}
function foodSpecies(object) {
    return [CORPSE, EGG, TIN].includes(object.otyp)
        && object.corpsenm !== undefined && object.corpsenm >= 0
        ? object.corpsenm : null;
}
export async function consumeMonsterObject(monster, object, state = game, { publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d } = {}) {
    const level = state.level;
    const isPet = !!monster.mtame;
    if (!isPet && monster.mhp < monster.mhpmax)
        healMonster(monster, OBJECT_WEIGHT[object.otyp] ?? 0, 0);
    await emptyEatenContainer(monster, object, state, publish, random);
    if (state.program_state.gameover || monster.migrating || state.level !== level)
        return;
    if (object === (state.uball || state.u.uball)) {
        await unpunishHero(state);
        await delobj(object, state);
        return;
    }
    if (object === (state.uchain || state.u.uchain)) {
        await unpunishHero(state);
        return;
    }
    const species = foodSpecies(object);
    const corpse = object.otyp === CORPSE ? species : null;
    const slime = object.otyp === GLOB_OF_GREEN_SLIME;
    const poly = polymorphFood(object);
    const grows = species === PM_WRAITH;
    const heals = species === PM_NURSE;
    const curesEyes = object.otyp === CARROT;
    const petrifies = species !== null && fleshPetrifies(species);
    const mimic = corpse !== null && MIMIC_SPECIES.has(corpse);
    const visible = canSeeMonster(monster);
    await delobj(object, state);
    if (state.program_state.gameover)
        return;
    if (poly || slime) {
        const change = await changeMonsterForm(monster, slime ? PM_GREEN_SLIME : null, state, { showMessage: visible, publish });
        if (change?.heroDied || state.program_state.gameover || monster.migrating || state.level !== level)
            return;
    }
    if (grows && (!isPet || (monster.m_lev ?? 0) < (MONSTER_LEVEL[monster.mnum] ?? 0) + 15))
        await growAfterFood(monster, state, { publish, random, rollOne });
    if (state.program_state.gameover || monster.migrating || state.level !== level)
        return;
    if (petrifies) {
        const stoneForm = await turnGolemToStone(monster, publish);
        if (stoneForm?.heroDied)
            return;
        if (!stoneForm && !monsterHasStoneResistance(monster)) {
            if (visible)
                await publish(`${monsterName(monster, { state, capitalized: true })} turns to stone!`);
            const stoning = await prepareMonsterPetrification(monster, { publish });
            if (stoning.heroDied)
                return;
            if (!stoning.survived)
                await finishEnvironmentalMonsterDeath(monster, state, {
                    noCorpse: true, stoneRemains: stoning.remains ?? null, publish, random, rollDice,
                });
        }
    }
    if (state.program_state.gameover || monster.migrating || state.level !== level)
        return;
    if (heals)
        healMonster(monster, monster.mhpmax, 0);
    if ((curesEyes || heals) && !monster.mcansee) {
        monster.mcansee = 1;
        monster.mblinded = 0;
        if (canSeeMonster(monster) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES))
            await publish(`${monsterName(monster, { state, capitalized: true })} can see again.`);
    }
    if (isPet && mimic)
        await beginMonsterMealMimicry(monster, state);
    if (corpse !== null)
        await grantMonsterCorpseIntrinsic(monster, corpse, state);
}
// C monmove.c:bee_eat_jelly(). A living queen leaves the meal untouched.
export async function feedBeeRoyalJelly(monster, object, state) {
    const queensGenocided = !!((state.mvitals?.[PM_QUEEN_BEE]?.mvflags ?? 0) & G_GENOD);
    if (!queensGenocided && state.level?.monsters.some(candidate => candidate.mnum === PM_QUEEN_BEE && !candidate.dead && candidate.mhp > 0))
        return false;
    const delay = object.blessed ? 3 : object.cursed ? 7 : 5;
    if (object.quan > 1) {
        const portion = splitObjectStack(object, 1, state);
        if (!portion)
            throw new Error('A bee could not split one lump of royal jelly');
        object = portion;
    }
    if (canSeeMonster(monster))
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} eats ${simpleObjectNameWithArticle(object, state)}.`);
    await delobj(object, state);
    monster.m_lev = Math.max(monster.m_lev ?? 0, (MONSTER_LEVEL[PM_QUEEN_BEE] ?? 0) - 1);
    await growAfterFood(monster, state);
    if (!monster.dead && monster.mhp > 0) {
        monster.mfrozen = delay;
        monster.mcanmove = 0;
    }
    return true;
}
//# sourceMappingURL=monster_consumption.js.map