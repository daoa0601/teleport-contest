// Egg contact inside hmon_hitmon_misc_obj(). The caller owns nominal damage
// unless petrification or a pyrolisk explosion completes the attack here.
import { exerciseAttribute } from './attrib.js';
import { A_WIS } from './const.js';
import { applyHeroEggLuckPenalty, eggHasMonsterSpecies, eggIsStale, explodePyroliskEggAt, isPyroliskEgg, turnEggIntoRock, } from './egg_impact.js';
import { placeObject } from './floor_object.js';
import { game } from './gstate.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { monsterName } from './monster_name.js';
import { monsterTypeName } from './monster_data.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import { deleteObject } from './object_delete.js';
import { EGG } from './object_data.js';
import { rnd, rn2 } from './rng.js';
import { touchPetrifies } from './stoning.js';
export async function resolveHeroEggHit(monster, egg, { state = game, mode, publish, random = rn2, rollOne = rnd, finishMonsterKill = (victim, death) => finishHeroMonsterKillOutcome(victim, victim.mx, victim.my, death), }) {
    if (egg.otyp !== EGG)
        throw new RangeError('Egg contact requires an egg');
    const result = {
        done: false, damage: 1, getDamageBonus: false, specialMessage: true,
        dryTowel: false, silverContact: false, objectConsumed: false, heroDied: false,
    };
    const count = egg.quan;
    const plural = count === 1 ? '' : 's';
    if (state.uwep === egg || state.u.uwep === egg)
        state._unweapon = true;
    applyHeroEggLuckPenalty(egg, state);
    if (eggHasMonsterSpecies(egg) && touchPetrifies(egg.corpsenm)) {
        const article = egg.known ? 'the' : count === 1 ? 'a' : 'some';
        const species = egg.known ? monsterTypeName(egg.corpsenm) : 'petrifying';
        await publish(`Splat!  You hit ${monsterName(monster, { state })} with ${article} ${species} egg${plural}!`);
        egg.known = true;
        await consumeEggs(egg, mode, state);
        result.objectConsumed = true;
        if (state.program_state.gameover)
            return { ...result, done: true, survived: monster.mhp > 0, heroDied: true };
        const petrification = await petrifyMonsterFromContact(monster, {
            creditHero: true, state, publish, rollOne,
            finishDeath: (victim, death) => finishMonsterKill(victim, {
                ...death, showKillMessage: false, recordConduct: !death?.noCorpse,
            }),
        });
        if (petrification.heroDied)
            return { ...result, done: true, survived: monster.mhp > 0, heroDied: true };
        if (!monsterHasStoneResistance(monster))
            return { ...result, done: true, survived: petrification.survived };
        return result;
    }
    const description = eggHasMonsterSpecies(egg) && egg.known
        ? `the ${monsterTypeName(egg.corpsenm)}` : count === 1 ? 'an' : 'some';
    await publish(`You hit ${monsterName(monster, { state })} with ${description} egg${plural}.`);
    if (touchPetrifies(monster.mnum) && !eggIsStale(egg, state)) {
        await publish(`The egg${plural} ${count === 1 ? "isn't" : "aren't"} alive any more...`);
        turnEggIntoRock(egg);
        if (mode !== 'melee')
            await placeObject(egg, monster.mx, monster.my, state);
        return result;
    }
    const pyrolisk = isPyroliskEgg(egg);
    if (!pyrolisk)
        await publish('Splat!');
    await consumeEggs(egg, mode, state);
    result.objectConsumed = true;
    if (state.program_state.gameover)
        return { ...result, done: true, survived: monster.mhp > 0, heroDied: true };
    if (pyrolisk) {
        const explosion = await explodePyroliskEggAt(monster.mx, monster.my, { state, heroCaused: true, publish, random });
        return { ...result, done: true, survived: !monster.dead && monster.mhp > 0, heroDied: !!explosion.heroDied };
    }
    await exerciseAttribute(A_WIS, false, state);
    return result;
}
async function consumeEggs(egg, mode, state) {
    if (mode === 'melee' && egg.where === 'inventory')
        await useUpInventoryStack(egg, state);
    else
        await deleteObject(egg, state);
}
//# sourceMappingURL=hero_egg_hit.js.map