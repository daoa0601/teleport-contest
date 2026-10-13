// Magicbane's probe, stun, scare, and cancellation attacks.
// C ref: artifact.c Mb_hit().
import { heroIsHallucinating } from './senses.js';
import { canSpotMonster, map_invisible, shieldeff } from './display.js';
import { probeMonster } from './magic_probe.js';
import { cancelMonster } from './monster_cancellation.js';
import { makeMonsterFlee } from './monster_flee.js';
import { MONSTER_ATTACKS, MONSTER_NAME } from './monster_data.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { AT_MAGC } from './monster_attack_types.js';
const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');
export async function applyMagicbaneHit(object, monster, damage, bonusApplied, { state, attacker, visible, dieRoll, hitOnHead, targetName, describeTarget, publish, random, rollOne, }) {
    const enchantment = magicbaneEnchantment(object);
    let scareDieRoll = 4;
    if (enchantment >= 3) {
        scareDieRoll = Math.trunc(scareDieRoll / 2 ** Math.trunc(enchantment / 3));
    }
    if (!bonusApplied)
        dieRoll++;
    let stun = Math.max(enchantment, 0) < random(bonusApplied ? 11 : 7);
    let effect = 'probe';
    damage += rollOne(4);
    if (stun) {
        effect = 'stun';
        damage += rollOne(4);
    }
    if (dieRoll <= scareDieRoll) {
        effect = 'scare';
        damage += rollOne(4);
    }
    if (dieRoll <= Math.trunc(scareDieRoll / 2)) {
        effect = 'cancel';
        damage += rollOne(4);
    }
    const hallucinating = heroIsHallucinating(state);
    const verb = {
        probe: hallucinating ? 'prod' : 'probe',
        stun: hallucinating ? 'amaze' : 'stun',
        scare: hallucinating ? 'tickle' : 'scare',
        cancel: hallucinating ? 'purge' : 'cancel',
    }[effect];
    const showEffects = !attacker || visible;
    if (showEffects) {
        await publish(`The magic-absorbing blade ${verb}s ${targetName}!`);
        if (effect === 'probe' && !canSpotMonster(monster)) {
            map_invisible(monster.mx, monster.my);
        }
    }
    let resisted = false;
    if (effect === 'cancel') {
        const oldSpecies = monster.mnum;
        const cancellation = await cancelMonster(monster, {
            state,
            attackLevel: 10,
            random,
            allowKill: false,
            publish,
        });
        if (cancellation.heroDied)
            return { heroDied: true };
        if (cancellation.resisted) {
            resisted = true;
        }
        else {
            stun = false;
            if (monster.mnum !== oldSpecies)
                targetName = describeTarget();
            if (monster.mnum === PM_CLAY_GOLEM)
                monster.mhp = 1;
            if (!attacker && monsterCastsSpells(monster)) {
                state.u.uenmax = (state.u.uenmax ?? 0) + 1;
                state.u.uenpeak = Math.max(state.u.uenpeak ?? 0, state.u.uenmax);
                state.u.uen = (state.u.uen ?? 0) + 1;
                state.context.botl = true;
                await publish('You absorb magical energy!');
            }
        }
    }
    else if (effect === 'scare') {
        if (random(2) && monsterResistsEffect(monster, 10, random)) {
            resisted = true;
        }
        else {
            const flight = await makeMonsterFlee(monster, {
                state,
                turns: 3,
                announce: (monster.mhp ?? 1) > damage,
                publish,
                random,
                rollOne,
            });
            if (flight.heroDied)
                return { heroDied: true };
            stun = false;
        }
    }
    else if (effect === 'stun') {
        stun = true;
    }
    else if (!attacker && (enchantment === 0 || random(3 * Math.abs(enchantment)) === 0)) {
        await publish(`The ${verb} is insightful.`);
        await probeMonster(monster, { state, onHead: hitOnHead, publish });
    }
    if (stun) {
        monster.mstun = 1;
        if (effect === 'stun')
            stun = false;
    }
    const confused = random(12) === 0;
    if (confused)
        monster.mconf = 1;
    if (showEffects) {
        const target = capitalized(targetName);
        if (resisted) {
            await publish(`${target} resists!`);
            await shieldeff(monster.mx, monster.my, state);
        }
        if ((stun || confused) && state.flags?.verbose !== false) {
            const conditions = [...(stun ? ['stunned'] : []), ...(confused ? ['confused'] : [])];
            await publish(`${target} is ${conditions.join(' and ')}${conditions.length > 1 ? '!' : '.'}`);
        }
    }
    return { damage, specialMessage: showEffects };
}
function magicbaneEnchantment(object) {
    return object.spe ?? object.enchantment ?? 0;
}
function capitalized(value) {
    if (!value)
        return value;
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
function monsterCastsSpells(monster) {
    return (MONSTER_ATTACKS[monster.mnum] || []).some(([attackType]) => attackType === AT_MAGC);
}
//# sourceMappingURL=magicbane.js.map