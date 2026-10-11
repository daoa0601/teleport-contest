// C uhitm.c:mhitm_ad_drin() and eat.c:eat_brains(), monster against monster.
import { M_ATTK_AGR_DIED, M_ATTK_HIT, M_ATTK_MISS, W_AMUL, W_ARMH } from './const.js';
import { canSeeMonster, canSpotMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { monsterHasHead, monsterIsMindless, monsterIsNoncorporeal, monsterIsRider, } from './monster_data.js';
import { monsterName, monsterPossessive, possessiveName } from './monster_name.js';
import { prepareMonsterPetrification } from './monster_stoning.js';
import { AMULET_OF_LIFE_SAVING } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { fleshPetrifies } from './stoning.js';
// This phase never finishes the hit. Even a fatal meal leaves the pending
// tentacle damage for mdamagem(), which can kill the defender as well.
export async function resolveMonsterBrainAttack(attacker, defender, damage, { state = game, visible, notOnHead = false, random = rn2, rollOne = rnd, publish = plineWithContinuation, finishDeath, }) {
    if (notOnHead || !monsterHasHead(defender)) {
        if (visible && canSpotMonster(defender)) {
            await publish(`${monsterName(defender, { state, capitalized: true })} doesn't seem harmed.`);
        }
        return { damage: 0, hitFlags: M_ATTK_MISS, skipBrainDrain: true, heroDied: false };
    }
    if (((defender.misc_worn_check ?? 0) & W_ARMH) && random(8)) {
        if (visible && canSpotMonster(attacker) && canSeeMonster(defender)) {
            const defenderName = possessiveName(monsterName(defender, { state, capitalized: true }));
            const attackerName = possessiveName(monsterName(attacker, { state }));
            const whoseHead = monsterPossessive(defender, { state, random });
            await publish(`${defenderName} helmet blocks ${attackerName} attack to ${whoseHead} head.`);
        }
        return { damage, hitFlags: M_ATTK_MISS, skipBrainDrain: false, heroDied: false };
    }
    const amulet = wornAmulet(defender);
    const lifeSaving = amulet?.otyp === AMULET_OF_LIFE_SAVING;
    const result = await eatMonsterBrain(attacker, defender, damage, {
        state, visible, random, rollOne, publish, finishDeath,
    });
    return { ...result, skipBrainDrain: lifeSaving && !wornAmulet(defender) };
}
async function eatMonsterBrain(attacker, defender, damage, { state, visible, random, rollOne, publish, finishDeath }) {
    const extraDamage = rollOne(10);
    if (attacker.mhp <= 0)
        return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: false };
    if (monsterIsNoncorporeal(defender)) {
        if (visible) {
            const name = possessiveName(monsterName(defender, { state, capitalized: true }));
            await publish(`${name} brain is unharmed.`);
        }
        return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
    }
    if (visible && canSpotMonster(defender)) {
        const name = possessiveName(monsterName(defender, { state, capitalized: true }));
        await publish(`${name} brain is eaten!`);
    }
    if (fleshPetrifies(defender.mnum)) {
        if (visible && canSeeMonster(attacker)) {
            await publish(`${monsterName(attacker, { state, capitalized: true })} turns to stone!`);
        }
        // eat_brains calls monstone directly: no food cure, resistance check,
        // or golem conversion precedes its life-saving and statue handling.
        const stone = await prepareMonsterPetrification(attacker, { publish });
        if (stone.heroDied)
            return { damage, hitFlags: M_ATTK_MISS, heroDied: true };
        if (stone.survived)
            return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
        const death = await finishDeath(attacker, { noCorpse: true, random, publish });
        if (death.heroDied)
            return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: true };
        if (attacker.mtame && !visible) {
            await publish('You have a sad thought for a moment, then it passes.');
        }
        return { damage, hitFlags: M_ATTK_AGR_DIED, heroDied: false };
    }
    if (monsterIsMindless(defender.mnum)) {
        if (visible && canSpotMonster(defender)) {
            await publish(`${monsterName(defender, { state, capitalized: true })} doesn't notice.`);
        }
        return { damage, hitFlags: M_ATTK_MISS, heroDied: false };
    }
    if (monsterIsRider(defender)) {
        const death = await finishDeath(attacker, { random, publish });
        return {
            damage: damage + extraDamage,
            hitFlags: attacker.mhp <= 0 ? M_ATTK_AGR_DIED : M_ATTK_HIT,
            heroDied: !!death.heroDied,
        };
    }
    damage += extraDamage;
    if (damage >= defender.mhp && visible && canSpotMonster(defender)) {
        const name = possessiveName(monsterName(defender, { state, capitalized: true }));
        await publish(`${name} last thought fades away...`);
    }
    if (attacker.mtame && !attacker.isminion) {
        const pet = attacker.edog || attacker.mextra?.edog;
        if (!pet)
            throw new Error(`Brain-eating pet ${attacker.m_id} has no feeding state`);
        // Unlike a regular meal, brains do not reset an overdue deadline or
        // reverse the HP penalty from starvation.
        pet.hungrytime += rollOne(60);
        attacker.mconf = 0;
    }
    return { damage, hitFlags: M_ATTK_HIT, heroDied: false };
}
function wornAmulet(monster) {
    return (monster.minvent ?? monster.inventory ?? []).find(object => (object.owornmask ?? 0) & W_AMUL);
}
//# sourceMappingURL=monster_brain_attack.js.map