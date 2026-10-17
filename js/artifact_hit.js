// Artifact weapon damage and special-hit effects.
// C ref: artifact.c artifact_hit().
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { artifactById, artifactDamageBonus } from './artifacts.js';
import { canSeeMonster, displayColorName } from './display.js';
import { monsterNeckName } from './body_parts.js';
import { loseHeroExperience } from './exper.js';
import { burnAwayHeroSlime } from './hack.js';
import { heroSpecies } from './hero_species.js';
import { formatFeltMessage } from './hero_speech.js';
import { Upolyd } from './const.js';
import { game, requirePlayingGame } from './gstate.js';
import { igniteItems } from './light.js';
import { healMonster } from './mon.js';
import { wakeMonstersNear } from './monster_wake.js';
import { applyMagicbaneHit } from './magicbane.js';
import { monsterHitPointsPerLevel } from './monster_hit_points.js';
import { MONSTER_NAME, MONSTER_SIZE, monsterHasHead, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsNonliving, } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { recordObjectEncounter } from './object_knowledge.js';
import { objectName, observeDistantObjectForNaming } from './objnam.js';
import { rn2, rnd } from './rng.js';
import { destroyInventoryByElement, destroyMonsterInventoryByElement, INVENTORY_DAMAGE } from './zap.js';
import { cansee } from './vision.js';
const PM_WATER_ELEMENTAL = 157;
const PM_JABBERWOCK = MONSTER_NAME.indexOf('jabberwock');
// Native fatal blows leave enough damage for the caller's AC reduction.
const FATAL_DAMAGE_MODIFIER = 200;
export async function applyArtifactHit(object, defender, baseDamage, { state = game, attacker, visible = defender !== 'hero' && cansee(defender.mx, defender.my)
    || !!attacker && cansee(attacker.mx, attacker.my)
    || !attacker && defender !== 'hero' && !!state.u.uswallow
        && state.u.ustuck === defender && !heroIsBlind(state), realizesDamage = defender === 'hero' || visible || !attacker && state.u.ustuck === defender, describeTarget = () => defender === 'hero' ? 'you' : monsterName(defender, { state }), publish = async () => { }, random = rn2, rollOne = rnd, dieRoll = 0, hitOnHead = true, } = {}) {
    const artifact = artifactById(object?.oartifact, state);
    if (!object || !artifact?.attack) {
        return { damage: baseDamage, specialMessage: false };
    }
    // Native hittee is captured before spec_dbon. Elemental and Magicbane
    // prose retain this noun; beheading and drain explicitly name again.
    const hittee = describeTarget();
    const target = defender === 'hero' ? { mnum: heroSpecies(state) } : defender;
    const bonus = artifactDamageBonus(object, target, baseDamage, rollOne, {
        random, state, hero: defender === 'hero',
    });
    let damage = baseDamage + bonus;
    const damageType = artifact.attack.damageType;
    const inventoryDamage = elementalDamageType(damageType);
    if (artifact.name === 'Magicbane' && dieRoll <= 8) {
        return applyMagicbaneHit(object, defender, damage, bonus > 0, {
            state,
            attacker,
            visible,
            dieRoll,
            hitOnHead,
            targetName: hittee,
            describeTarget,
            publish,
            random,
            rollOne,
        });
    }
    if (!inventoryDamage) {
        if (damageType === 'magic') {
            if (realizesDamage)
                await publish(bonus > 0
                    ? `The imaginary widget hits!  A hail of magic missiles strikes ${hittee}!`
                    : `The imaginary widget hits ${hittee}.`);
            return { damage, specialMessage: realizesDamage };
        }
        if (bonus > 0) {
            const beheading = await applyBeheading(artifact, object, defender, damage, {
                state, attacker, visible, hittee, dieRoll, hitOnHead,
                describeTarget, publish, random,
            });
            if (beheading)
                return beheading;
            if (artifact.flags.includes('SPFX_DRLI')) {
                return applyLifeDrain(artifact, object, defender, damage, {
                    state, attacker, visible, describeTarget, publish, random, rollOne,
                });
            }
        }
        return { damage, specialMessage: false };
    }
    const applied = bonus > 0;
    if (realizesDamage) {
        const message = elementalHitMessage(damageType, applied, target, hittee);
        if (message)
            await publish(message);
    }
    if (damageType === 'shock' && applied) {
        // Native youmonst's coordinates stay (0, 0), separate from u.ux/u.uy.
        const x = defender === 'hero' ? 0 : defender.mx;
        const y = defender === 'hero' ? 0 : defender.my;
        wakeMonstersNear(x, y, 16, state);
    }
    if (random(inventoryDamageChance(damageType)) === 0) {
        if (defender === 'hero') {
            const destroyed = await destroyInventoryByElement(inventoryDamage, damage, {
                state, publish, random, rollOne,
            });
            if (destroyed.heroDied)
                return { heroDied: true };
            // ignite_items(youmonst.minvent) has no items; invent is separate.
        }
        else {
            damage += await destroyMonsterInventoryByElement(defender, inventoryDamage, damage, {
                state, publish, random, rollOne, visible: canSeeMonster(defender),
            });
            if (damageType === 'fire') {
                await igniteItems(defender.minvent || defender.inventory, {
                    state, carrier: defender, publish, random,
                    visible: cansee(defender.mx, defender.my),
                });
            }
        }
    }
    if (defender === 'hero' && damageType === 'fire')
        await burnAwayHeroSlime(state, publish);
    return { damage, specialMessage: realizesDamage };
}
function elementalDamageType(damageType) {
    if (damageType === 'cold')
        return INVENTORY_DAMAGE.COLD;
    if (damageType === 'fire')
        return INVENTORY_DAMAGE.FIRE;
    if (damageType === 'shock')
        return INVENTORY_DAMAGE.ELECTRIC;
    return null;
}
function elementalHitMessage(damageType, applied, monster, targetName) {
    if (damageType === 'fire') {
        const verb = !applied
            ? 'hits'
            : monster.mnum === PM_WATER_ELEMENTAL
                ? 'vaporizes part of'
                : 'burns';
        return `The fiery blade ${verb} ${targetName}${applied ? '!' : '.'}`;
    }
    if (damageType === 'cold') {
        return `The ice-cold blade ${applied ? 'freezes' : 'hits'} ${targetName}${applied ? '!' : '.'}`;
    }
    if (damageType === 'shock') {
        return applied
            ? `The massive hammer hits!  Lightning strikes ${targetName}!`
            : `The massive hammer hits ${targetName}.`;
    }
    return null;
}
function inventoryDamageChance(damageType) {
    return damageType === 'shock' ? 5 : 4;
}
function observeArtifactObject(object, state) {
    const hallucinating = heroIsHallucinating(state);
    if (hallucinating)
        return;
    object.dknown = true;
    recordObjectEncounter(object.otyp, state);
}
function possessiveTarget(target) {
    if (target === 'it')
        return 'its';
    return target.endsWith('s') ? `${target}'` : `${target}'s`;
}
async function applyBeheading(artifact, object, defender, damage, { state, attacker, visible, hittee, dieRoll, hitOnHead, describeTarget, publish, random }) {
    if (!artifact.flags.includes('SPFX_BEHEAD'))
        return null;
    if (defender === 'hero') {
        requirePlayingGame(state);
        const species = { mnum: heroSpecies(state) };
        const fatalDamage = 2 * (Upolyd(state.u) ? state.u.mh : state.u.uhp)
            + FATAL_DAMAGE_MODIFIER;
        if (artifact.name === 'The Tsurugi of Muramasa' && dieRoll === 1) {
            if ((MONSTER_SIZE[species.mnum] ?? 2) >= 3) {
                const subject = attacker ? monsterName(attacker, { state, capitalized: true })
                    : 'The razor-sharp blade';
                await publish(`${subject} cuts deeply into you!`);
                return { damage: damage * 2, specialMessage: true };
            }
            await publish('The razor-sharp blade cuts you in half!');
            observeArtifactObject(object, state);
            return { damage: fatalDamage, specialMessage: true };
        }
        if (artifact.name !== 'Vorpal Blade'
            || (dieRoll !== 1 && species.mnum !== PM_JABBERWOCK))
            return null;
        if (!monsterHasHead(species)) {
            const subject = attacker ? monsterName(attacker, { state }) : 'Vorpal Blade';
            await publish(`Somehow, ${subject} misses you wildly.`);
            return { damage: 0, specialMessage: true };
        }
        if (monsterIsNoncorporeal(species) || monsterIsAmorphous(species)) {
            await publish(`Vorpal Blade slices through your ${monsterNeckName(species.mnum)}.`);
            return { damage, specialMessage: true };
        }
        await publish(`Vorpal Blade ${random(2) === 0 ? 'beheads' : 'decapitates'} you!`);
        observeArtifactObject(object, state);
        return { damage: fatalDamage, specialMessage: true };
    }
    const monster = defender;
    const swallowed = !attacker && !!state.u.uswallow && state.u.ustuck === monster;
    if (artifact.name === 'The Tsurugi of Muramasa') {
        if (dieRoll !== 1)
            return null;
        if (swallowed) {
            await publish(`You slice ${describeTarget()} wide open!`);
            return {
                damage: 2 * monster.mhp + FATAL_DAMAGE_MODIFIER,
                specialMessage: true,
            };
        }
        if (!hitOnHead)
            return null;
        if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 3) {
            if (!attacker)
                await publish(`You slice deeply into ${describeTarget()}!`);
            else if (visible) {
                const attackerName = monsterName(attacker, { state, capitalized: true });
                await publish(`${attackerName} cuts deeply into ${hittee}!`);
            }
            return { damage: damage * 2, specialMessage: true };
        }
        await publish(`The razor-sharp blade cuts ${describeTarget()} in half!`);
        observeArtifactObject(object, state);
        return {
            damage: 2 * monster.mhp + FATAL_DAMAGE_MODIFIER,
            specialMessage: true,
        };
    }
    if (artifact.name !== 'Vorpal Blade' ||
        (dieRoll !== 1 && monster.mnum !== PM_JABBERWOCK) ||
        swallowed)
        return null;
    if (!monsterHasHead(monster) || !hitOnHead || state.u.uswallow) {
        if (!attacker)
            await publish(`Somehow, you miss ${describeTarget()} wildly.`);
        else if (visible) {
            await publish(`Somehow, ${monsterName(attacker, { state })} misses wildly.`);
        }
        return { damage: 0, specialMessage: !attacker || visible, attackStopped: true };
    }
    if (monsterIsNoncorporeal(monster) || monsterIsAmorphous(monster)) {
        await publish(`Vorpal Blade slices through ${possessiveTarget(describeTarget())} ${monsterNeckName(monster.mnum)}.`);
        return { damage, specialMessage: true };
    }
    const verb = random(2) === 0 ? 'beheads' : 'decapitates';
    await publish(`Vorpal Blade ${verb} ${describeTarget()}!`);
    if (heroIsHallucinating(state) && !state.flags.female) {
        await publish("Good job Henry, but that wasn't Anne.");
    }
    observeArtifactObject(object, state);
    return {
        damage: 2 * monster.mhp + FATAL_DAMAGE_MODIFIER,
        specialMessage: true,
    };
}
async function applyLifeDrain(artifact, object, defender, damage, { state, attacker, visible, describeTarget, publish, random, rollOne }) {
    if (defender === 'hero') {
        requirePlayingGame(state);
        const life = monsterIsNonliving(heroSpecies(state)) ? 'animating force' : 'life';
        if (heroIsBlind(state)) {
            await publish(formatFeltMessage(`an ${artifact.name === 'Stormbringer'
                ? 'unholy blade' : 'object'} drain your ${life}!`, state));
        }
        else {
            observeDistantObjectForNaming(object, state);
            const weapon = artifact.name === 'Stormbringer'
                ? `${displayColorName('black', state)} blade` : objectName(object, state);
            await publish(`The ${weapon} drains your ${life}!`);
        }
        const oldMaximum = state.u.uhpmax;
        if (await loseHeroExperience('life drainage', { state, publish }))
            return { heroDied: true };
        if (attacker && attacker.mhp < attacker.mhpmax) {
            healMonster(attacker, Math.trunc((Math.abs(oldMaximum - state.u.uhpmax) + 1) / 2));
        }
        return { damage, specialMessage: true };
    }
    const monster = defender;
    let drain = monsterHitPointsPerLevel(monster, {
        rollOne,
        randomBelow: random,
    });
    const level = monster.m_lev ?? 0;
    const maximumHitPoints = monster.mhpmax ?? monster.mhp ?? 1;
    if (maximumHitPoints - drain <= level) {
        drain = maximumHitPoints > level ? maximumHitPoints - (level + 1) : 0;
    }
    if (visible) {
        // Native distant_name observes the weapon even when Stormbringer's
        // special description replaces that name in the message.
        observeDistantObjectForNaming(object, state);
        const weaponName = objectName(object, state);
        const life = monsterIsNonliving(monster.mnum) ? 'animating force' : 'life';
        const weapon = artifact.name === 'Stormbringer'
            ? `The ${displayColorName('black', state)} blade`
            : `The ${weaponName}`;
        await publish(`${weapon} draws the ${life} from ${describeTarget()}!`);
    }
    if (level === 0) {
        damage = 2 * monster.mhp + FATAL_DAMAGE_MODIFIER;
    }
    else {
        damage += drain;
        monster.mhpmax = maximumHitPoints - drain;
        monster.m_lev = level - 1;
    }
    const healing = Math.trunc((drain + 1) / 2);
    if (healing > 0) {
        if (attacker)
            healMonster(attacker, healing);
        else
            healHeroFromDrain(state, healing);
    }
    return { damage, specialMessage: visible };
}
function healHeroFromDrain(state, amount) {
    if (amount <= 0)
        return;
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    const maximum = Upolyd(state.u) ? 'mhmax' : 'uhpmax';
    const currentHitPoints = state.u[hitPoints];
    const maximumHitPoints = state.u[maximum] ?? currentHitPoints;
    if (currentHitPoints === undefined || maximumHitPoints === undefined)
        throw new Error('Life drain requires initialized hero hit points.');
    state.u[hitPoints] = Math.min(maximumHitPoints, currentHitPoints + amount);
    state.context.botl = true;
}
//# sourceMappingURL=artifact_hit.js.map