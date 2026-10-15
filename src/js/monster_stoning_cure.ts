// Items a monster can use to stop immediate petrification.
// C refs: muse.c munstone(), mon_consume_unstone(), and cures_stoning().

import { heroIsHallucinating } from './senses.js';
import {
    NORMAL_SPEED, P_DAGGER, P_KNIFE, STRAT_WAITFORU, W_WEP,
} from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { formatHeardMessage } from './hero_speech.js';
import { inventoryItemDescription } from './invent.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME,
    MONSTER_SYMBOL, monsterIsAnimal, monsterIsBat,
} from './monster_data.js';
import { monsterName } from './monster_name.js';
import { monsterIsHelpless } from './monster_sleep.js';
import {
    monsterHasAcidResistance, monsterHasStoneResistance,
} from './monster_resistance.js';
import {
    destroyObjectFromMonsterInventory,
} from './monster_inventory.js';
import {
    adjustMonsterSpeed, monsterSpeedMessage,
} from './monster_speed.js';
import {
    CORPSE, GLOB_OF_GREEN_SLIME,
    OBJECT_SUBTYPE, POT_ACID, TIN, TIN_OPENER,
} from './object_data.js';
import { rnd } from './rng.js';
import { extendPetHungerDeadline, petFoodNutrition } from './pet_eating.js';
import { heroIsDeaf } from './senses.js';
import { objectWeight } from './weight.js';
import { distantObjectName } from './objnam.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { willWeld } from './weapon_type.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { PetrificationDeathHandler } from './monster_stoning.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

export interface MonsterStoningCureOptions {
    finishDeath?: PetrificationDeathHandler | undefined;
    publish?: MessagePublisher;
    rollOne?: (sides: number) => number;
    state?: GameState;
}

export type MonsterStoningCureResult =
    | { consumed: false; died: false }
    | { consumed: true; cure: GameObject; died: boolean };

const M1_ACID = 0x08000000;
const S_GHOST = 54;
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_LIZARD = MONSTER_NAME.indexOf('lizard');
const PM_STALKER = MONSTER_NAME.indexOf('stalker');
const SLIMEPROOF_FIRE_MONSTERS = new Set([
    'fire vortex', 'flaming sphere', 'fire elemental', 'salamander',
].map(name => MONSTER_NAME.indexOf(name)));

export function monsterCanOpenTin(monster: Monster): boolean {
    if (monsterIsAnimal(monster)) return false;
    const inventory = monster.minvent || monster.inventory || [];
    const wielded = monsterWieldedWeapon(monster);
    const opensTin = (object: GameObject) => object.otyp === TIN_OPENER
        || (object.oclass === 2 && [P_DAGGER, P_KNIFE].includes(OBJECT_SUBTYPE[object.otyp] ?? 0));
    if (wielded && ((wielded.owornmask ?? 0) & W_WEP) && willWeld(wielded))
        return inventory.includes(wielded) && opensTin(wielded);
    return inventory.some(opensTin);
}

function monsterIsSlimeproof(monster: Monster): boolean {
    return monster?.mnum === PM_GREEN_SLIME
        || SLIMEPROOF_FIRE_MONSTERS.has(monster?.mnum)
        || MONSTER_SYMBOL[monster?.mnum] === S_GHOST;
}

function corpseCuresStoning(object: GameObject): boolean {
    if (object.corpsenm === undefined
        || !Number.isInteger(object.corpsenm) || object.corpsenm < 0)
        return false;
    return object.corpsenm === PM_LIZARD
        || !!((MONSTER_FLAGS1[object.corpsenm] ?? 0) & M1_ACID);
}

export function curesStoning(monster: Monster, object: GameObject, tinCanBeOpened: boolean): boolean {
    if (object?.otyp === POT_ACID) return true;
    if (object?.otyp === GLOB_OF_GREEN_SLIME)
        return monsterIsSlimeproof(monster);
    if (object?.otyp === CORPSE) return corpseCuresStoning(object);
    return object?.otyp === TIN && tinCanBeOpened
        && corpseCuresStoning(object);
}

async function consumeOneCure(monster: Monster, object: GameObject, state: GameState): Promise<void> {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) {
        await destroyObjectFromMonsterInventory(monster, object, state);
        return;
    }
    object.quan = object.quantity = quantity - 1;
    object.owt = objectWeight(object);
    monster.hasInventory = true;
}

async function describeCure(
    monster: Monster, cure: GameObject, visible: boolean,
    state: GameState, publish: MessagePublisher,
): Promise<void> {
    if (visible) {
        const tinned = cure.otyp === TIN;
        const verb = cure.otyp === POT_ACID
            ? 'quaffs' : tinned ? 'opens and eats the contents of' : 'eats';
        const subject = monsterName(monster, { state, capitalized: true });
        const name = distantObjectName(cure, object => inventoryItemDescription({
            ...object, quan: 1, quantity: 1,
        }), state);
        await publish(`${subject} ${verb} ${name}.`);
    } else if (!heroIsDeaf(state)) {
        const heard = formatHeardMessage(cure.otyp === POT_ACID ? 'drinking.' : 'chewing.', state);
        if (heard) await publish(heard);
    }
}

export async function useMonsterStoningCure(monster: Monster, {
    finishDeath,
    publish = plineWithContinuation,
    rollOne = rnd,
    state = game,
}: MonsterStoningCureOptions = {}): Promise<MonsterStoningCureResult> {
    if (monsterHasStoneResistance(monster) || monster.meating || monsterIsHelpless(monster)) {
        return { consumed: false, died: false };
    }

    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const tinCanBeOpened = monsterCanOpenTin(monster);
    const inventory = monster.minvent || monster.inventory || [];
    const cure = inventory.find(object =>
        curesStoning(monster, object, tinCanBeOpened));
    if (!cure) return { consumed: false, died: false };

    return consumeMonsterStoningCure(monster, cure, { finishDeath, publish, rollOne, state, stoning: true });
}

export async function consumeMonsterStoningCure(monster: Monster, cure: GameObject, {
    finishDeath, publish = plineWithContinuation, rollOne = rnd, state = game, stoning,
}: MonsterStoningCureOptions & { stoning: boolean }): Promise<MonsterStoningCureResult> {

    const visible = canSeeMonster(monster);
    const tinned = cure.otyp === TIN;
    const food = cure.otyp === CORPSE || tinned;
    const acidic = cure.otyp === POT_ACID
        || (food && cure.corpsenm !== undefined
            && !!((MONSTER_FLAGS1[cure.corpsenm] ?? 0) & M1_ACID));
    const lizard = food && cure.corpsenm === PM_LIZARD;
    const nutrition = food ? petFoodNutrition(monster, cure) : 0;

    if (stoning) {
        const speed = adjustMonsterSpeed(monster, -3);
        if (visible && state.flags.verbose && !state.in_mklev && speed.canDescribe) {
            const speedMessage = monsterSpeedMessage(speed, monsterName(monster, { state, capitalized: true }));
            if (speedMessage) await publish(speedMessage);
        }
    }
    await describeCure(monster, cure, visible, state, publish);
    await consumeOneCure(monster, cure, state);

    if (acidic && !tinned && !monsterHasAcidResistance(monster)) {
        monster.mhp -= rollOne(15);
        if (visible) {
            await publish(
                `${monsterName(monster, { state, capitalized: true })} has a very bad case of stomach acid.`,
            );
        }
        if (monster.mhp <= 0) {
            await publish(`${monsterName(monster, { state, capitalized: true })} dies!`);
            if (typeof finishDeath !== 'function') {
                throw new TypeError(
                    'a fatal stoning cure requires a monster death function',
                );
            }
            await finishDeath(monster, { noCorpse: false });
            return { consumed: true, cure, died: monster.mhp <= 0 || !!monster.dead };
        }
    }

    if (stoning && visible) {
        const hallucinating = heroIsHallucinating(state);
        await publish(hallucinating
            ? `What a pity - ${monsterName(monster, { state })} just ruined `
                + 'a future piece of art!'
            : `${monsterName(monster, { state, capitalized: true })} seems limber!`);
    }
    if (lizard && (monster.mconf || monster.mstun)) {
        monster.mconf = 0;
        monster.mstun = 0;
        if (visible && !monsterIsBat(monster.mnum) && monster.mnum !== PM_STALKER)
            await publish(`${monsterName(monster, { state, capitalized: true })} seems steadier now.`);
    }
    if (monster.mtame && !monster.isminion && nutrition > 0) {
        extendPetHungerDeadline(monster, nutrition, state);
    }
    monster.movement = (monster.movement ?? 0) - NORMAL_SPEED;
    monster.mlstmv = state.moves ?? 0;
    return { consumed: true, cure, died: false };
}
