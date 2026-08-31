// Armor damage from fire and monster rust-trap effects.
// C ref: trap.c burnarmor(), trapeffect_rust_trap(), water_damage(),
// and erode_obj().

import {
    W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SWAPWEP,
    W_WEP,
} from './const.js';
import { endObjectBurn } from './light.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { splitMonster } from './monster_clone.js';
import {
    BRASS_LANTERN, OBJECT_BIMANUAL, OBJECT_MATERIAL, OBJECT_NAMES,
} from './object_data.js';
import { rnl, rn2 } from './rng.js';

const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const M1_HUMANOID = 0x00020000;

function recordRoll(random, calls, range) {
    calls?.push(range);
    return random(range);
}

function inventoryOf(monster) {
    return monster?.minvent || monster?.inventory || [];
}

function wornObject(monster, mask) {
    return inventoryOf(monster).find(object =>
        ((object.owornmask ?? 0) & mask) !== 0) || null;
}

function wieldedObject(monster) {
    return monster?.mw || wornObject(monster, W_WEP);
}

function objectDescription(object, fallback) {
    return object?.name || OBJECT_NAMES[object?.otyp] || fallback;
}

function extinguishLitObject(object, monster, state) {
    if (!object?.lamplit) return null;
    const humanoid = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID);
    if (object.otyp === BRASS_LANTERN && humanoid) {
        return { kind: 'lantern-flickers', object };
    }
    if (!endObjectBurn(object, state, state.moves ?? 0))
        object.lamplit = false;
    return { kind: 'extinguished', object };
}

function rustObject(
    object,
    description,
    monster,
    state,
    roll,
    luckRoll,
) {
    if (!object) return { outcome: 'nothing' };

    const lightEffect = extinguishLitObject(object, monster, state);
    if (lightEffect) return { outcome: 'damaged', ...lightEffect };

    if (object.greased) {
        const greaseWashedOff = roll(2) === 0;
        if (greaseWashedOff) object.greased = false;
        return {
            outcome: 'greased', kind: 'grease-protected', object,
            description,
        };
    }

    if ((OBJECT_MATERIAL[object.otyp] ?? 0) !== 11)
        return { outcome: 'nothing' };

    const proof = !!(object.oerodeproof || object.rustproof);
    if (proof && object.rknown) return { outcome: 'nothing' };
    if (proof) {
        object.rknown = true;
        return {
            outcome: 'nothing', kind: 'rustproof', object, description,
        };
    }
    if (object.blessed) {
        if (luckRoll(4) === 0) return { outcome: 'nothing' };
    }

    const oldErosion = object.oeroded ?? 0;
    if (oldErosion >= 3) return { outcome: 'nothing' };
    object.oeroded = oldErosion + 1;
    return {
        outcome: 'damaged', kind: 'rusted', object, description,
        erosion: object.oeroded,
    };
}

function addWaterEffect(event, effect) {
    if (effect?.kind) event.effects.push(effect);
    return effect?.outcome || 'nothing';
}

function armorAt(monster, state, mask, hero) {
    if (!hero) return wornObject(monster, mask);
    return {
        [W_ARM]: state.uarm,
        [W_ARMC]: state.uarmc,
        [W_ARMH]: state.uarmh,
        [W_ARMS]: state.uarms,
        [W_ARMG]: state.uarmg,
        [W_ARMF]: state.uarmf,
        [W_ARMU]: state.uarmu,
    }[mask] || null;
}

function flammableArmor(object) {
    if (!object) return false;
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    return (material >= 2 && material <= 8) || material === 18;
}

async function burnArmorObject(
    object, description, visible, emitMessage, calls,
) {
    if (!object || !flammableArmor(object)) return false;
    if (object.oerodeproof && object.rknown) return false;
    if (object.oerodeproof || (object.blessed && rnl(4) === 0)) {
        calls?.push('rnl(4)');
        return false;
    }
    if (object.blessed) calls?.push('rnl(4)');
    const erosion = object.oeroded ?? 0;
    if (erosion >= 3) return false;
    object.oeroded = erosion + 1;
    if (visible && emitMessage) {
        const suffix = erosion + 1 === 3 ? ' completely'
            : erosion ? ' further' : '';
        await emitMessage(`Your ${description} smoulders${suffix}!`);
    }
    return true;
}

export async function burnArmorByFire(
    victim, state, emitMessage, calls = [], random = rn2,
) {
    const hero = victim === state.u;
    for (;;) {
        const slot = recordRoll(random, calls, 5);
        let object = null;
        let description = '';
        let torso = false;
        if (slot === 0) {
            object = armorAt(victim, state, W_ARMH, hero);
            description = 'helmet';
        } else if (slot === 1) {
            torso = true;
            object = armorAt(victim, state, W_ARMC, hero)
                || armorAt(victim, state, W_ARM, hero)
                || armorAt(victim, state, W_ARMU, hero);
            description = object === armorAt(
                victim, state, W_ARMC, hero,
            ) ? 'cloak' : object === armorAt(
                victim, state, W_ARMU, hero,
            ) ? 'shirt' : object?.name || 'armor';
        } else if (slot === 2) {
            object = armorAt(victim, state, W_ARMS, hero);
            description = 'wooden shield';
        } else if (slot === 3) {
            object = armorAt(victim, state, W_ARMG, hero);
            description = 'gloves';
        } else {
            object = armorAt(victim, state, W_ARMF, hero);
            description = 'boots';
        }

        const damaged = await burnArmorObject(
            object, description, hero, emitMessage, calls,
        );
        if (hero && damaged) state._armorClassDirty = true;
        if (torso) return true;
        if (damaged) return false;
    }
}

export function burnHeroArmorByFire(
    state, emitMessage, calls = [], random = rn2,
) {
    return burnArmorByFire(state.u, state, emitMessage, calls, random);
}

export function applyMonsterRustTrap(
    monster,
    state,
    {
        roll = rn2,
        luckRoll = rnl,
    } = {},
) {
    const targetRoll = roll(5);
    const event = {
        kind: 'rust-trap', effects: [],
        damage: 0, killed: false,
    };

    if (targetRoll === 0) {
        event.target = 'head';
        const helmet = wornObject(monster, W_ARMH);
        addWaterEffect(event, rustObject(
            helmet, objectDescription(helmet, 'helmet'),
            monster, state, roll, luckRoll,
        ));
    } else if (targetRoll === 1) {
        event.target = 'left-arm';
        const shield = wornObject(monster, W_ARMS);
        const shieldResult = addWaterEffect(event, rustObject(
            shield, 'shield', monster, state, roll, luckRoll,
        ));
        if (shieldResult === 'nothing') {
            const weapon = wieldedObject(monster);
            if (weapon && OBJECT_BIMANUAL[weapon.otyp]) {
                addWaterEffect(event, rustObject(
                    weapon, objectDescription(weapon, 'weapon'),
                    monster, state, roll, luckRoll,
                ));
            }
            const gloves = wornObject(monster, W_ARMG);
            addWaterEffect(event, rustObject(
                gloves, objectDescription(gloves, 'gloves'),
                monster, state, roll, luckRoll,
            ));
        }
    } else if (targetRoll === 2) {
        event.target = 'right-arm';
        const weapon = wieldedObject(monster);
        addWaterEffect(event, rustObject(
            weapon, objectDescription(weapon, 'weapon'),
            monster, state, roll, luckRoll,
        ));
        const gloves = wornObject(monster, W_ARMG);
        addWaterEffect(event, rustObject(
            gloves, objectDescription(gloves, 'gloves'),
            monster, state, roll, luckRoll,
        ));
    } else {
        event.target = 'body';
        for (const object of inventoryOf(monster)) {
            if (!object.lamplit
                || ((object.owornmask ?? 0) & (W_WEP | W_SWAPWEP))) {
                continue;
            }
            const effect = extinguishLitObject(object, monster, state);
            if (effect) event.effects.push(effect);
        }
        const torso = wornObject(monster, W_ARMC)
            || wornObject(monster, W_ARM)
            || wornObject(monster, W_ARMU);
        const fallback = ((torso?.owornmask ?? 0) & W_ARMC) ? 'cloak'
            : ((torso?.owornmask ?? 0) & W_ARMU) ? 'shirt' : 'armor';
        addWaterEffect(event, rustObject(
            torso, objectDescription(torso, fallback),
            monster, state, roll, luckRoll,
        ));
    }

    if (monster.mnum === PM_IRON_GOLEM) {
        event.completelyRusted = true;
    } else if (monster.mnum === PM_GREMLIN && roll(3) !== 0) {
        event.clone = splitMonster(monster, state, { monsterMoving: true });
    }
    return event;
}
