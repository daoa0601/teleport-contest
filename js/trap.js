// Water, lava, fire, and monster rust-trap effects.
// C ref: trap.c lava_effects(), burnarmor(), trapeffect_rust_trap(),
// water_damage(), and erode_obj().

import {
    W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SWAPWEP,
    W_WEP,
} from './const.js';
import { findArmorClass } from './armor.js';
import { cansee } from './vision.js';
import { endObjectBurn } from './light.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { splitMonster } from './monster_clone.js';
import {
    BAG_OF_TRICKS, BRASS_LANTERN, CAN_OF_GREASE, CHEST, ICE_BOX,
    LARGE_BOX, OBJECT_BIMANUAL, OBJECT_MATERIAL, OBJECT_NAMES, OILSKIN_SACK,
    POT_ACID, POT_WATER, RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES,
    RIN_FIRE_RESISTANCE, SCR_BLANK_PAPER, SCR_FIRE, SPE_BLANK_PAPER,
    SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, TOWEL,
} from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import { stopAllObjectTimers } from './object_timers.js';
import { rnl, rn2, rnd } from './rng.js';

const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const M1_HUMANOID = 0x00020000;
const POTION_CLASS = 8;
const FIRE_RESISTANT_OBJECTS = new Set([
    RED_DRAGON_SCALE_MAIL,
    RED_DRAGON_SCALES,
    RIN_FIRE_RESISTANCE,
]);

function objectClass(object) {
    if (Number.isInteger(object?.oclass)) return object.oclass;
    return object?.class === 'Potions' ? POTION_CLASS : 0;
}

function lavaCanBurnObject(object, random) {
    if (!object || object.in_use || object.oerodeproof) return false;
    const organic = (OBJECT_MATERIAL[object.otyp] ?? 0) <= 8;
    if (!organic && objectClass(object) !== POTION_CLASS) return false;
    if (FIRE_RESISTANT_OBJECTS.has(object.otyp)
        || object.otyp === SCR_FIRE || object.otyp === SPE_FIREBALL)
        return false;
    return !objectResistsDestruction(object, 0, 0, random);
}

function removeLavaBurnedObject(state, object) {
    let armorChanged = false;
    for (const slot of [
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
        'uleft', 'uright', 'uamul', 'ublindf',
    ]) {
        if (state[slot] === object) {
            state[slot] = null;
            armorChanged ||= slot.startsWith('uarm');
        }
        if (state.u?.[slot] === object) {
            state.u[slot] = null;
            armorChanged ||= slot.startsWith('uarm');
        }
    }
    for (const slot of ['uwep', 'uswapwep', 'uquiver']) {
        if (state[slot] === object) state[slot] = null;
        if (state.u?.[slot] === object) state.u[slot] = null;
    }
    state.inventory = (state.inventory || []).filter(item => item !== object);
    stopAllObjectTimers(object);
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = 0;
    object.lamplit = false;
    object.where = 'gone';
    if (armorChanged) findArmorClass(state);
}

export async function destroyLavaInventory({
    state = game,
    publish = async () => {},
    random = rn2,
    showMessages = false,
    previouslyAnnounced = 0,
} = {}) {
    let named = previouslyAnnounced;
    let unnamed = 0;
    for (const object of [...(state.inventory || [])]) {
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (showMessages && !state.blind
                && !(state.u?.blindTurns > 0)) {
                await publish(
                    'The Book of the Dead glows a strange dark red, '
                    + 'but remains intact.',
                );
            }
            continue;
        }
        if (!lavaCanBurnObject(object, random)) continue;
        const wasWorn = !!object.worn || !!object.owornmask;
        if (showMessages && wasWorn) {
            const name = object.name || OBJECT_NAMES[object.otyp] || 'item';
            const plural = (object.quan ?? object.quantity ?? 1) > 1
                || name.endsWith('s');
            await publish(
                `Your ${name} ${plural ? 'burst' : 'bursts'} into flame!`,
            );
            named++;
        } else {
            unnamed++;
        }
        removeLavaBurnedObject(state, object);
    }

    if (showMessages && unnamed) {
        const subject = named
            ? unnamed === 1 ? 'Another item' : 'Other items'
            : unnamed === 1 ? 'An item' : 'Some items';
        await publish(`${subject} in your inventory ${
            unnamed === 1 ? 'has' : 'have'
        } been destroyed.`);
    }
    return named + unnamed - previouslyAnnounced;
}

export async function destroyLavaFloorObjects(
    objects,
    {
        publish = async () => {},
        random = rn2,
        visible = false,
    } = {},
) {
    if (!Array.isArray(objects)) return 0;
    let destroyed = 0;
    for (const object of [...objects]) {
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (visible) {
                await publish(
                    'The Book of the Dead glows a strange dark red, but remains intact.',
                );
            }
            continue;
        }
        if (!lavaCanBurnObject(object, random)) continue;
        if (visible) {
            const name = object.name || OBJECT_NAMES[object.otyp] || 'item';
            await publish(`The ${name} burns up!`);
        }
        const index = objects.indexOf(object);
        if (index >= 0) objects.splice(index, 1);
        stopAllObjectTimers(object);
        object.lamplit = false;
        object.where = 'gone';
        object.ox = 0;
        object.oy = 0;
        destroyed++;
    }
    return destroyed;
}

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

function objectContents(object) {
    if (Array.isArray(object?.contents)) return object.contents;
    if (Array.isArray(object?.cobj)) return object.cobj;
    return [];
}

function explodingPotionMessage(object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const typeKnown = object.typeKnown
        || state._knownObjectTypes?.has(object.otyp);
    const noun = typeKnown ? `potion of ${OBJECT_NAMES[object.otyp] || 'acid'}`
        : 'potion';
    return quantity === 1
        ? `A ${noun} explodes!`
        : `Some ${noun}s explode!`;
}

export async function waterDamageObject(
    object,
    messages = [],
    state = game,
) {
    if (!object) return false;
    const spe = object.spe ?? 0;
    if (object.otyp === CAN_OF_GREASE && spe > 0) return false;
    if (object.otyp === TOWEL && spe < 7) {
        object.spe = spe + rnd(7 - spe);
        return false;
    }
    if (object.greased) {
        if (rn2(2) === 0) {
            object.greased = false;
            if (object.otyp === POT_ACID) {
                messages.push(explodingPotionMessage(object, state));
                return true;
            }
        }
        return false;
    }

    const isContainer = object.otyp >= LARGE_BOX
        && object.otyp <= BAG_OF_TRICKS;
    if (isContainer) {
        const waterproof = object.otyp === OILSKIN_SACK
            || object.otyp === ICE_BOX
            || object.otyp === LARGE_BOX
            || object.otyp === CHEST;
        const leaks = !waterproof || (object.cursed && rn2(3) === 0);
        if (leaks)
            await waterDamageChain(objectContents(object), messages, state);
        return false;
    }

    if (((state.u?.uluck ?? 0) + 5) > rn2(20)) return false;

    if (object.oclass === 9) {
        if (object.otyp !== SCR_BLANK_PAPER) {
            object.otyp = SCR_BLANK_PAPER;
            object.dknown = false;
            object.spe = 0;
        }
        return false;
    }
    if (object.oclass === 10) {
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (cansee(object.ox, object.oy))
                messages.push('Steam rises from the Book of the Dead.');
            return false;
        }
        if (object.otyp !== SPE_BLANK_PAPER) {
            if (object.spestudied)
                object.spestudied = rn2(object.spestudied);
            object.otyp = SPE_BLANK_PAPER;
            object.dknown = false;
        }
        return false;
    }
    if (object.oclass === 8) {
        if (object.otyp === POT_ACID) {
            messages.push(explodingPotionMessage(object, state));
            return true;
        }
        if (object.odiluted) {
            object.otyp = POT_WATER;
            object.dknown = false;
            object.blessed = false;
            object.cursed = false;
            object.odiluted = 0;
        } else if (object.otyp !== POT_WATER) {
            object.odiluted = 1;
        }
        return false;
    }

    if (OBJECT_MATERIAL[object.otyp] === 11) {
        const proof = !!(object.oerodeproof || object.rustproof);
        if (proof) {
            object.rknown = true;
            return false;
        }
        if (object.blessed && rnl(4) === 0) return false;
        object.oeroded = Math.min(3, (object.oeroded || 0) + 1);
    }
    return false;
}

export async function waterDamageChain(
    objects,
    messages = [],
    state = game,
) {
    if (!Array.isArray(objects)) return messages;
    for (const object of [...objects]) {
        if (!await waterDamageObject(object, messages, state)) continue;
        const index = objects.indexOf(object);
        if (index >= 0) objects.splice(index, 1);
    }
    return messages;
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
