// Artifact weapon damage and elemental side effects.
// C ref: artifact.c artifact_hit().

import { artifactById, artifactDamageBonus } from './artifacts.js';
import { Upolyd } from './const.js';
import { game } from './gstate.js';
import { igniteItems } from './light.js';
import { wakeMonstersNear } from './mon.js';
import { monsterHitPointsPerLevel } from './monster_hit_points.js';
import { monsterIsNonliving, monsterTypeName } from './monster_data.js';
import { rn2, rnd } from './rng.js';
import {
    destroyMonsterInventoryByElement, INVENTORY_DAMAGE,
} from './zap.js';

const PM_WATER_ELEMENTAL = 157;

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
