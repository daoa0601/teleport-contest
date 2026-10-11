// C uhitm.c:mhitm_ad_drin() and eat.c:eat_brains(), hero attacker branch.
import { objectIsHardHelmet } from './armor.js';
import { exerciseWisdom } from './attrib.js';
import { applyCannibalPenalty } from './cannibalism.js';
import { A_INT, DIED, KILLED_BY_AN, M_ATTK_MISS, W_AMUL, W_ARMH } from './const.js';
import { finishHeroDeath } from './end.js';
import { eatingConducts } from './food_conduct.js';
import { monsterSlipsFromHeroGrip } from './hero_natural_grip.js';
import { spendHeroNutrition } from './hunger.js';
import { monsterHasHead, monsterIsMindless, monsterIsNoncorporeal, monsterIsRider, monsterTypeName, } from './monster_data.js';
import { monsterName, monsterPossessive, possessiveName } from './monster_name.js';
import { AMULET_OF_LIFE_SAVING } from './object_data.js';
import { heroIsUnchanging } from './polyself.js';
import { heroIsSliming, PM_GREEN_SLIME, setHeroSlimingTimeout } from './slime.js';
import { fleshPetrifies, heroIsPetrifying, heroResistsStoning, setHeroPetrificationTimeout, } from './stoning.js';
export async function applyHeroNaturalBrain(monster, context) {
    const { state, publish, random, target } = context;
    const result = {
        damage: context.damage, nativeResult: M_ATTK_MISS, done: false, heroDied: false,
    };
    if (target.x !== monster.mx || target.y !== monster.my || !monsterHasHead(monster)) {
        await publish(`${monsterName(monster, { state, capitalized: true })} doesn't seem harmed.`);
        result.damage = 0;
        result.skipBrainDrain = true;
        if (!heroIsUnchanging(state) && monster.mnum === PM_GREEN_SLIME && !heroIsSliming(state)) {
            await publish("You suck in some slime and don't feel very well.");
            await setHeroSlimingTimeout(10, { state });
        }
        return result;
    }
    if (await monsterSlipsFromHeroGrip(monster, { head: true, state, publish, random }))
        return result;
    const helmet = monster.minvent?.find(object => (object.owornmask ?? 0) & W_ARMH);
    if (helmet && random(8)) {
        const owner = possessiveName(monsterName(monster, { state, capitalized: true }));
        const kind = objectIsHardHelmet(helmet) ? 'helm' : 'hat';
        await publish(`${owner} ${kind} blocks your attack to ${monsterPossessive(monster, { state, random })} head.`);
        return result;
    }
    const amulet = monster.minvent?.find(object => (object.owornmask ?? 0) & W_AMUL);
    await eatMonsterBrain(monster, context, result);
    if (amulet?.otyp === AMULET_OF_LIFE_SAVING
        && !monster.minvent?.some(object => (object.owornmask ?? 0) & W_AMUL))
        result.skipBrainDrain = true;
    return result;
}
async function eatMonsterBrain(monster, context, result) {
    const { state, publish, rollOne } = context;
    const extraDamage = rollOne(10);
    if (monsterIsNoncorporeal(monster)) {
        const owner = possessiveName(monsterName(monster, { state, capitalized: true }));
        await publish(`${owner} brain is unharmed.`);
        return;
    }
    await publish(`You eat ${possessiveName(monsterName(monster, { state }))} brain!`);
    if (fleshPetrifies(monster.mnum) && !heroResistsStoning(state) && !heroIsPetrifying(state)) {
        await setHeroPetrificationTimeout(5, {
            state, killer: monsterTypeName(monster.mnum, monster.female),
            killerFormat: KILLED_BY_AN, publish,
        });
    }
    await eatingConducts(monster.mnum, { state });
    if (monsterIsMindless(monster.mnum)) {
        await publish(`${monsterName(monster, { state, capitalized: true })} doesn't notice.`);
        return;
    }
    if (monsterIsRider(monster)) {
        await publish('Ingesting that is fatal.');
        const cause = `unwisely ate the brain of ${monsterTypeName(monster.mnum, monster.female)}`;
        result.heroDied = await finishHeroDeath({
            killer: cause, deathCause: cause, deathType: DIED, deathLineShown: true,
        });
        if (result.heroDied) {
            result.done = true;
            return;
        }
        exerciseWisdom(false, state);
    }
    else {
        // Native morehungry() accepts negative nutrition and cannot choke.
        await spendHeroNutrition(-rollOne(30), { state });
        const hero = state.u;
        if (hero.acurr.a[A_INT] < hero.amax.a[A_INT]) {
            // This repairs the base directly, including beneath a dunce cap.
            hero.acurr.a[A_INT] = Math.min(hero.amax.a[A_INT], hero.acurr.a[A_INT] + rollOne(4));
            state.context.botl = true;
        }
        exerciseWisdom(true, state);
    }
    result.damage += extraDamage;
    await applyCannibalPenalty(monster.mnum, { state });
}
//# sourceMappingURL=hero_natural_brain.js.map