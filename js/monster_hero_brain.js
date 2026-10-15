// C uhitm.c:mhitm_ad_drin() and eat.c:eat_brains(), hero defender.
import { formatFeltMessage } from './hero_speech.js';
import { armorSimpleName } from './armor.js';
import { adjustAttribute, attributeChangeMessage, exerciseWisdom } from './attrib.js';
import { A_INT } from './const.js';
import { canSeeMonster } from './display.js';
import { damageHeroFromMonster } from './hero_damage.js';
import { heroSpecies } from './hero_species.js';
import { finishMonsterAttackDeath } from './monster_attack_death.js';
import { monsterHasHead, monsterIsNoncorporeal } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterName } from './monster_name.js';
import { prepareMonsterPetrification } from './monster_stoning.js';
import { DUNCE_CAP } from './object_data.js';
import { objectCombatName } from './objnam.js';
import { propertyIsActive } from './properties.js';
import { rn2, rnd } from './rng.js';
import { drainHeroWeaponSkills } from './skills.js';
import { loseHeroSpellMemory } from './spell_memory.js';
import { fleshPetrifies } from './stoning.js';
export async function drainHeroBrain(monster, attack, state, publish, random = rn2, rollOne = rnd) {
    const hero = state.u;
    const baseDamage = attack.damage;
    if (baseDamage === undefined)
        throw new Error('Brain drain requires rolled contact damage');
    if (!monsterHasHead({ mnum: heroSpecies(state) })) {
        await publish("You don't seem harmed.");
        attack.skipBrainDrain = true;
        return;
    }
    const helmet = state.uarmh ?? hero.uarmh;
    if (helmet?.greased && (!helmet.cursed || random(3))) {
        await publish(`${monsterName(monster, { state, capitalized: true })} grabs you, but cannot hold onto your greased ${objectCombatName(helmet, { state })}!`);
        if (!random(2)) {
            await publish('The grease wears off.');
            helmet.greased = false;
        }
        return;
    }
    if (helmet && random(8)) {
        await publish(`Your ${armorSimpleName(helmet, state)} blocks the attack to your head.`);
        return;
    }
    // Brain damage precedes the meal and bypasses negative AC. Blocked
    // tentacles instead leave their ordinary damage for hitmu's common tail.
    const damage = propertyIsActive('halfPhysicalDamage', state) || hero.halfPhysicalDamage
        ? Math.trunc((baseDamage + 1) / 2) : baseDamage;
    attack.damage = 0;
    if (await damageHeroFromMonster(monster, damage, { state, publish })) {
        attack.heroDied = true;
        return;
    }
    if (helmet?.otyp !== DUNCE_CAP) {
        const mortality = hero.umortality ?? 0;
        const eaten = await eatHeroBrain(monster, attack, state, publish, rollOne);
        if ((hero.umortality ?? 0) > mortality)
            attack.skipBrainDrain = true;
        if (!eaten || state.program_state.gameover)
            return;
    }
    const change = adjustAttribute(A_INT, -rollOne(2), state);
    const message = attributeChangeMessage(A_INT, change, state);
    if (message && (change.changed || change.blockedByDunceCap || state.flags.verbose))
        await publish(message);
    if (!random(5)) {
        loseHeroSpellMemory({ state });
        attack.skipBrainDrain = true;
    }
    if (!random(5)) {
        await drainHeroWeaponSkills(rollOne(2), state);
        attack.skipBrainDrain = true;
    }
}
async function eatHeroBrain(monster, attack, state, publish, rollOne) {
    rollOne(10);
    const body = { mnum: heroSpecies(state) };
    if (monsterIsNoncorporeal(body)) {
        await publish('Your brain is unharmed.');
        return false;
    }
    await publish('Your brain is eaten!');
    if (fleshPetrifies(body.mnum)) {
        if (canSeeMonster(monster))
            await publish(`${monsterName(monster, { state, capitalized: true })} turns to stone!`);
        const stone = await prepareMonsterPetrification(monster, { publish });
        if (stone.survived)
            return false;
        await finishEnvironmentalMonsterDeath(monster, state, { noCorpse: true, publish });
        return true;
    }
    const attributes = state.u.acurr?.a;
    if (!attributes)
        throw new Error('Brain drain requires initialized hero attributes');
    const minimum = state.urace.attrmin[A_INT];
    if (attributes[A_INT] <= minimum) {
        const options = { attribution: {
                kind: 'death-inflicted-by', killer: 'brainlessness', deathCause: 'killed by brainlessness',
            } };
        if (propertyIsActive('lifeSaving', state) || state.u.lifeSaving) {
            if (await finishMonsterAttackDeath(monster, options)) {
                attack.heroDied = true;
                return false;
            }
            await publish('Unfortunately your brain is still gone.');
        }
        else
            await publish('Your last thought fades away.');
        if (await finishMonsterAttackDeath(monster, options)) {
            attack.heroDied = true;
            return false;
        }
        attributes[A_INT] = minimum + 2;
        await publish(formatFeltMessage('like a scarecrow.', state));
    }
    exerciseWisdom(false, state);
    if (monster.mtame && !monster.isminion) {
        const pet = monster.edog ?? monster.mextra?.edog;
        if (!pet)
            throw new Error('A brain-eating pet needs feeding state');
        pet.hungrytime += rollOne(60);
        monster.mconf = 0;
    }
    return true;
}
//# sourceMappingURL=monster_hero_brain.js.map