// Magicbane's probe, stun, scare, and cancellation attacks.
// C ref: artifact.c Mb_hit().
import { setHeroGrip } from './hero_grip.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { nomul } from './command_state.js';
import { Upolyd } from './const.js';
import { makeConfused, makeStunned } from './hero_mental_status.js';
import { heroSpecies } from './hero_species.js';
import { formatFeltMessage } from './hero_speech.js';
import { heroIsUnchanging, returnHeroToHumanForm } from './polyself.js';
import { requirePlayingGame } from './gstate.js';
import { canSpotMonster, map_invisible, shieldeff } from './display.js';
import { probeMonster } from './magic_probe.js';
import { cancelMonster } from './monster_cancellation.js';
import { makeMonsterFlee } from './monster_flee.js';
import { MONSTER_ATTACKS, MONSTER_NAME, monsterSpeciesSticks } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { AT_MAGC } from './monster_attack_types.js';
const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');
export async function applyMagicbaneHit(object, defender, damage, bonusApplied, { state, attacker, visible, dieRoll, hitOnHead, targetName, describeTarget, publish, random, rollOne, }) {
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
    const showEffects = defender === 'hero' || !attacker || visible;
    if (showEffects) {
        await publish(`The magic-absorbing blade ${verb}s ${targetName}!`);
        if (effect === 'probe' && defender !== 'hero' && !canSpotMonster(defender)) {
            map_invisible(defender.mx, defender.my);
        }
    }
    let resisted = false;
    if (effect === 'cancel' && defender === 'hero') {
        requirePlayingGame(state);
        resisted = !!state.u.antimagic;
        if (!resisted) {
            const oldSpecies = heroSpecies(state);
            if (Upolyd(state.u)) {
                if (oldSpecies === PM_CLAY_GOLEM) {
                    await publish(heroIsBlind(state)
                        ? formatFeltMessage(`${heroIsHallucinating(state) ? 'dark' : 'light'} headed.`, state)
                        : 'Some writing vanishes from your head!');
                    state.u.mh = 0;
                }
                if (heroIsUnchanging(state) && state.u.mh > 0)
                    await publish('Your amulet grows hot for a moment, then cools.');
                else if ((await returnHeroToHumanForm(state, { publish })).died)
                    return { heroDied: true };
            }
            stun = false;
            if (heroSpecies(state) !== oldSpecies)
                damage = 0;
            if ((state.u.uenmax ?? 0) > 0) {
                state.u.uenmax = (state.u.uenmax ?? 0) - 1;
                if ((state.u.uen ?? 0) > 0)
                    state.u.uen = (state.u.uen ?? 0) - 1;
                state.context.botl = true;
                await publish('You lose magical energy!');
            }
        }
    }
    else if (effect === 'cancel' && defender !== 'hero') {
        const monster = defender;
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
    else if (effect === 'scare' && defender === 'hero') {
        resisted = !!state.u.antimagic;
        if (!resisted) {
            nomul(-3, state);
            state._helplessReason = 'being scared stiff';
            state._helplessDoneMessage = '';
            if (attacker && state.u.ustuck === attacker && monsterSpeciesSticks(heroSpecies(state))) {
                setHeroGrip(null, state);
                await publish(`You release ${monsterName(attacker, { state })}!`);
            }
            stun = false;
        }
    }
    else if (effect === 'scare' && defender !== 'hero') {
        const monster = defender;
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
    else if (defender !== 'hero' && !attacker
        && (enchantment === 0 || random(3 * Math.abs(enchantment)) === 0)) {
        await publish(`The ${verb} is insightful.`);
        await probeMonster(defender, { state, onHead: hitOnHead, publish });
    }
    if (stun) {
        if (defender === 'hero')
            await makeStunned((state.u.stunnedTurns ?? 0) + 3, { state, talk: false });
        else
            defender.mstun = 1;
        if (effect === 'stun')
            stun = false;
    }
    const confused = random(12) === 0;
    if (confused) {
        if (defender === 'hero')
            await makeConfused((state.u.confusionTurns ?? 0) + 4, { state, talk: false });
        else
            defender.mconf = 1;
    }
    if (showEffects) {
        const target = capitalized(targetName);
        if (resisted) {
            await publish(`${target} ${defender === 'hero' ? 'resist' : 'resists'}!`);
            await shieldeff(defender === 'hero' ? state.u.ux : defender.mx, defender === 'hero' ? state.u.uy : defender.my, state);
        }
        if ((stun || confused) && state.flags?.verbose !== false) {
            const conditions = [...(stun ? ['stunned'] : []), ...(confused ? ['confused'] : [])];
            await publish(`${target} ${defender === 'hero' ? 'are' : 'is'} ${conditions.join(' and ')}${conditions.length > 1 ? '!' : '.'}`);
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