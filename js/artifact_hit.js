// Artifact weapon damage and special-hit effects.
// C ref: artifact.c artifact_hit().

import { artifactById, artifactDamageBonus } from './artifacts.js';
import { Upolyd } from './const.js';
import { game } from './gstate.js';
import { igniteItems } from './light.js';
import { wakeMonstersNear } from './mon.js';
import { monsterHitPointsPerLevel } from './monster_hit_points.js';
import {
    MONSTER_NAME, MONSTER_SIZE, monsterHasHead, monsterIsAmorphous,
    monsterIsNoncorporeal, monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import { recordObjectEncounter } from './object_knowledge.js';
import { rn2, rnd } from './rng.js';
import {
    destroyMonsterInventoryByElement, INVENTORY_DAMAGE,
} from './zap.js';

const PM_WATER_ELEMENTAL = 157;
const PM_JABBERWOCK = MONSTER_NAME.indexOf('jabberwock');

function elementalDamageType(damageType) {
    return {
        cold: INVENTORY_DAMAGE.COLD,
        fire: INVENTORY_DAMAGE.FIRE,
        shock: INVENTORY_DAMAGE.ELECTRIC,
    }[damageType] || null;
}

function elementalHitMessage(damageType, applied, monster, targetName) {
    if (damageType === 'fire') {
        const verb = !applied ? 'hits'
            : monster.mnum === PM_WATER_ELEMENTAL
                ? 'vaporizes part of' : 'burns';
        return `The fiery blade ${verb} ${targetName}${applied ? '!' : '.'}`;
    }
    if (damageType === 'cold') {
        return `The ice-cold blade ${applied ? 'freezes' : 'hits'} ${
            targetName}${applied ? '!' : '.'}`;
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
    const hallucinating = !!(state.u?.hallucinating
        || (state.u?.hallucinationTurns ?? 0) > 0);
    if (hallucinating) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp, state);
}

function possessiveTarget(target) {
    if (target === 'it') return 'its';
    return target.endsWith('s') ? `${target}'` : `${target}'s`;
}

async function applyBeheading(
    artifact, object, monster, damage, {
        state, dieRoll, hitOnHead, describeTarget, publish, random,
    },
) {
    if (!artifact.flags.includes('SPFX_BEHEAD')) return null;
    const swallowed = !!state.u?.uswallow && state.u?.ustuck === monster;

    if (artifact.name === 'The Tsurugi of Muramasa') {
        if (dieRoll !== 1) return null;
        const target = describeTarget();
        if (swallowed) {
            await publish(`You slice ${target} wide open!`);
            return {
                damage: 2 * (monster.mhp ?? 1) + 1,
                specialMessage: true,
            };
        }
        if (!hitOnHead) return null;
        if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 3) {
            await publish(`You slice deeply into ${target}!`);
            return { damage: damage * 2, specialMessage: true };
        }
        await publish(`The razor-sharp blade cuts ${target} in half!`);
        observeArtifactObject(object, state);
        return {
            damage: 2 * (monster.mhp ?? 1) + 1,
            specialMessage: true,
        };
    }

    if (artifact.name !== 'Vorpal Blade'
        || (dieRoll !== 1 && monster.mnum !== PM_JABBERWOCK)
        || swallowed) return null;
    const target = describeTarget();
    if (!monsterHasHead(monster) || !hitOnHead) {
        await publish(`Somehow, you miss ${target} wildly.`);
        return { damage: 0, specialMessage: true, attackStopped: true };
    }
    if (monsterIsNoncorporeal(monster) || monsterIsAmorphous(monster)) {
        await publish(
            `Vorpal Blade slices through ${possessiveTarget(target)} neck.`,
        );
        return { damage, specialMessage: true };
    }

    const verb = random(2) === 0 ? 'beheads' : 'decapitates';
    await publish(`Vorpal Blade ${verb} ${target}!`);
    observeArtifactObject(object, state);
    return {
        damage: 2 * (monster.mhp ?? 1) + 1,
        specialMessage: true,
    };
}

function healHeroFromDrain(state, amount) {
    if (amount <= 0) return;
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    const maximum = Upolyd(state.u) ? 'mhmax' : 'uhpmax';
    state.u[hitPoints] = Math.min(
        state.u[maximum] ?? state.u[hitPoints],
        (state.u[hitPoints] ?? 0) + amount,
    );
}

async function applyLifeDrain(
    artifact, monster, damage, {
        state, visible, describeTarget, publish, random, rollOne,
    },
) {
    let drain = monsterHitPointsPerLevel(monster, {
        rollOne,
        randomBelow: random,
    });
    const level = monster.m_lev ?? 0;
    const maximumHitPoints = monster.mhpmax ?? monster.mhp ?? 1;
    if (maximumHitPoints - drain <= level) {
        drain = maximumHitPoints > level
            ? maximumHitPoints - (level + 1) : 0;
    }

    if (visible) {
        const life = monsterIsNonliving(monster.mnum)
            ? 'animating force' : 'life';
        const weapon = artifact.name === 'Stormbringer'
            ? 'The black blade' : artifact.name;
        await publish(
            `${weapon} draws the ${life} from ${describeTarget()}!`,
        );
    }

    if (level === 0) {
        damage = 2 * (monster.mhp ?? 1) + 1;
    } else {
        damage += drain;
        monster.mhpmax = maximumHitPoints - drain;
        monster.m_lev = level - 1;
    }
    healHeroFromDrain(state, Math.trunc((drain + 1) / 2));
    return { damage, specialMessage: visible };
}

export async function applyArtifactHitToMonster(
    object,
    monster,
    baseDamage,
    {
        state = game,
        visible = true,
        describeTarget = () => `the ${monsterTypeName(monster.mnum)}`,
        describeCarrier = () => monster.name
            || monsterTypeName(monster.mnum),
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
        dieRoll = 0,
        hitOnHead = true,
    } = {},
) {
    const artifact = artifactById(object?.oartifact, state);
    if (!artifact?.attack) {
        return { damage: baseDamage, specialMessage: false };
    }

    const bonus = artifactDamageBonus(
        object, monster, baseDamage, rollOne, { random, state },
    );
    let damage = baseDamage + bonus;
    const damageType = artifact.attack.damageType;
    const inventoryDamage = elementalDamageType(damageType);
    if (bonus > 0) {
        const beheading = await applyBeheading(
            artifact, object, monster, damage, {
                state,
                dieRoll,
                hitOnHead,
                describeTarget,
                publish,
                random,
            },
        );
        if (beheading) return beheading;
    }
    if (damageType === 'life-drain' && bonus > 0) {
        return applyLifeDrain(artifact, monster, damage, {
            state,
            visible,
            describeTarget,
            publish,
            random,
            rollOne,
        });
    }
    if (!inventoryDamage) {
        return { damage, specialMessage: false };
    }

    const applied = bonus > 0;
    if (visible) {
        await publish(elementalHitMessage(
            damageType, applied, monster, describeTarget(),
        ));
    }
    if (damageType === 'shock' && applied)
        wakeMonstersNear(monster.mx, monster.my, 16, state);

    if (random(inventoryDamageChance(damageType)) === 0) {
        const carrierName = visible ? describeCarrier() : 'monster';
        damage += await destroyMonsterInventoryByElement(
            monster, inventoryDamage, damage, {
                carrierName,
                publish,
                random,
                rollOne,
                visible,
            },
        );
        if (damageType === 'fire') {
            await igniteItems(monster.minvent || monster.inventory, {
                carrierName,
                state,
                publish,
                random,
                visible,
            });
        }
    }

    return { damage, specialMessage: visible };
}
