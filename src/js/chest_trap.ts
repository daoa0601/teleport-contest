// Traps triggered while opening or disarming containers.
// C ref: trap.c chest_trap().

import { makeHallucinated, makeStunned } from './hero_mental_status.js';
import { heroIsHallucinating } from './senses.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { exerciseAttribute } from './attrib.js';
import { heroHasFreeAction } from './armor.js';
import { A_CON, A_DEX, A_STR, W_BALL } from './const.js';
import { currency } from './currency.js';
import {
    bot, plineWithContinuation, shieldeff,
} from './display.js';
import { triggerHeroFireTrap } from './fire_trap.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Position } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { loseHeroHp } from './hero_damage.js';
import { wakeMonstersNear } from './monster_wake.js';
import {
    deleteObject, deleteObjectContents,
} from './object_delete.js';
import { OBJECT_NAMES } from './object_data.js';
import { objectName as formattedObjectName } from './objnam.js';
import { objectResistsDestruction } from './object_state.js';
import { poisonHero } from './poison.js';
import { createPoisonGasCloud } from './regions.js';
import { d, rn2 } from './rng.js';
import { costlySpot, insideShopRoomAt } from './shk.js';
import { makeAngryShopkeeper } from './shop_damage.js';
import { stolenValue } from './shop_loss.js';
import { heroIsBlind } from './senses.js';
import { destroyElectricInventory } from './zap.js';

type RandomBelow = (limit: number) => number;
type RollDice = (count: number, sides: number) => number;

export interface ChestTrapOptions {
    state?: GameState;
    disarm?: boolean;
    bodyPart?: string;
    random?: RandomBelow;
    rollDice?: RollDice;
    publish?: MessagePublisher;
}

export type ChestTrapResult = {
    destroyed?: boolean;
    died?: boolean;
} & (
    | { outcome: 'luck-save'; damage: 0 }
    | { outcome: 'explosion'; damage: number }
    | { outcome: 'noxious-gas' | 'stunning-gas' | 'fire' }
    | { outcome: 'poisoned-needle'; damage: number | undefined }
    | { outcome: 'electric-shock'; damage?: number }
    | { outcome: 'paralysis'; duration: number }
);

const BLIND_GAS = [
    'humid', 'odorless', 'pungent', 'chilling', 'acrid', 'biting',
];

const GAS_COLORS = [
    'black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'gray',
    'colorless', 'orange', 'bright green', 'yellow', 'bright blue',
    'bright magenta', 'bright cyan', 'white',
];

function objectName(object: GameObject | null | undefined): string {
    return object?.name || OBJECT_NAMES[object?.otyp ?? -1] || 'container';
}

function containerLocation(container: GameObject, state: GameState): Position {
    if (container.where === 'floor')
        return { x: container.ox, y: container.oy };
    const location = { x: state.u.ux, y: state.u.uy };
    container.ox = location.x;
    container.oy = location.y;
    return location;
}

function halfPhysicalDamage(amount: number, state: GameState): number {
    return state.u?.halfPhysicalDamage
        ? Math.trunc((amount + 1) / 2) : amount;
}

async function clearPunishment(state: GameState): Promise<void> {
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if (chain) await deleteObject(chain, state);
    if (ball) {
        ball.owornmask = (ball.owornmask ?? 0) & ~W_BALL;
        ball.worn = false;
    }
    state.uball = null;
    state.uchain = null;
    if (state.u) {
        state.u.uball = null;
        state.u.uchain = null;
        state.u.punished = false;
    }
}

async function explodeContainer(
    container: GameObject, location: Position, state: GameState, publish: MessagePublisher, rollDice: RollDice,
): Promise<ChestTrapResult> {
    const spot = costlySpot(location.x, location.y, state);
    const insider = !!spot && !!insideShopRoomAt(state, state.u.ux, state.u.uy)
        && state.u.ushops?.[0] === spot.roomno;
    const name = formattedObjectName(container, state);
    await publish(`The ${name} explodes!`);
    const killer = `exploding ${name}`;
    // Charge while the objects and their bills still exist, before damage
    // can end the game and settle the hero's debt through inheritance.
    let loss = spot ? await stolenValue(container, location.x, location.y,
        spot.resident.mpeaceful, { state, publish, silent: true }) : 0;
    await deleteObjectContents(container, state);
    const pile = [...(state.level?.objects?.[location.x]?.[location.y] || [])];
    const ball = state.uball || state.u?.uball;
    const chain = state.uchain || state.u?.uchain;
    if ((ball && pile.includes(ball)) || (chain && pile.includes(chain))) await clearPunishment(state);

    let containerDestroyed = false;
    for (const object of pile) {
        if (spot) loss += await stolenValue(object, object.ox, object.oy,
            spot.resident.mpeaceful, { state, publish, silent: true });
        if (objectResistsDestruction(object, 0, 0)) continue;
        if (object === container) containerDestroyed = true;
        await deleteObject(object, state);
    }

    wakeMonstersNear(
        state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state,
    );
    const damage = halfPhysicalDamage(rollDice(6, 6), state);
    if (await loseHeroHp(damage, killer, { state, publish }))
        return { outcome: 'explosion', damage, destroyed: containerDestroyed, died: true };
    await exerciseAttribute(A_STR, false, state);
    if (spot && loss) {
        const money = `${loss} ${currency(loss, { state })}`;
        if (insider) await publish(`You owe ${money} for objects destroyed.`);
        else {
            await publish(`You caused ${money} worth of damage!`);
            await makeAngryShopkeeper(spot.resident, state);
        }
    }
    return { outcome: 'explosion', damage, destroyed: containerDestroyed };
}

async function releaseNoxiousGas(
    container: GameObject, location: Position, state: GameState, publish: MessagePublisher, random: RandomBelow, rollDice: RollDice,
): Promise<ChestTrapResult> {
    await publish(
        `A cloud of noxious gas billows from the ${objectName(container)}.`,
    );
    if (random(3) !== 0) {
        const poison = await poisonHero({
            reason: 'gas cloud',
            killer: 'cloud of poison gas',
            attribute: A_STR,
            fatal: 15,
            state,
            random,
            rollDice,
            publish,
        });
        if (poison.died) return { outcome: 'noxious-gas', destroyed: false, died: true };
    } else {
        await createPoisonGasCloud(
            state, location.x, location.y, 1, 8, random, publish,
        );
    }
    await exerciseAttribute(A_CON, false, state);
    return { outcome: 'noxious-gas', destroyed: false };
}

async function prickHero(state: GameState, publish: MessagePublisher, random: RandomBelow, rollDice: RollDice, bodyPart: string): Promise<ChestTrapResult> {
    await publish(`You feel a needle prick your ${bodyPart}.`);
    const poison = await poisonHero({
        reason: 'needle',
        killer: 'poisoned needle',
        attribute: A_CON,
        fatal: 10,
        state,
        random,
        rollDice,
        publish,
    });
    if (!poison.died) await exerciseAttribute(A_CON, false, state);
    return {
        outcome: 'poisoned-needle',
        damage: poison.damage,
        destroyed: false,
        died: poison.died,
    };
}

async function shockHero(state: GameState, publish: MessagePublisher, random: RandomBelow, rollDice: RollDice): Promise<ChestTrapResult> {
    const originalDamage = rollDice(4, 4);
    let damage = originalDamage;
    await publish('You are jolted by a surge of electricity!');
    if (state.u?.shockResistance) {
        if (state === game) await shieldeff(state.u.ux, state.u.uy);
        await publish("You don't seem to be affected.");
        damage = 0;
    }
    const items = await destroyElectricInventory(originalDamage, {
        state, publish, random,
    });
    if (items.heroDied) return { outcome: 'electric-shock', died: true };
    const died = damage > 0 && await loseHeroHp(damage, 'electric shock', { state, publish });
    return { outcome: 'electric-shock', damage, destroyed: false, died };
}

async function paralyzeHero(state: GameState, publish: MessagePublisher, rollDice: RollDice): Promise<ChestTrapResult> {
    if (heroHasFreeAction(state)) {
        await publish('You momentarily stiffen.');
        return { outcome: 'paralysis', duration: 0, destroyed: false };
    }
    await publish('Suddenly you are frozen in place!');
    const duration = rollDice(5, 6);
    endVoluntaryMultiTurn(state);
    state._helplessTurns = duration;
    state._helplessReason = 'frozen by a trap';
    state._helplessDoneMessage = 'You can move again.';
    await exerciseAttribute(A_DEX, false, state);
    return { outcome: 'paralysis', duration, destroyed: false };
}

async function confuseHero(container: GameObject, state: GameState, publish: MessagePublisher, random: RandomBelow): Promise<ChestTrapResult> {
    const blind = heroIsBlind(state);
    const description = blind
        ? BLIND_GAS[random(BLIND_GAS.length)]
        : GAS_COLORS[random(GAS_COLORS.length)];
    await publish(
        `A cloud of ${description} gas billows from the ${objectName(container)}.`,
    );
    const alreadyStunned = state.u?.stunned
        || (state.u?.stunnedTurns ?? 0) > 0;
    const hallucinating = heroIsHallucinating(state);
    if (!alreadyStunned) {
        if (hallucinating) await publish('What a groovy feeling!');
        else await publish('You stagger...');
    }
    await makeStunned((state.u.stunnedTurns ?? 0) + 16 + random(7), { state, talk: false });
    await makeHallucinated((state.u.hallucinationTurns ?? 0) + 16 + random(5), {
        state, talk: false, publish,
    });
    return { outcome: 'stunning-gas', destroyed: false };
}

function luckSaveMessage(random: RandomBelow): string {
    const outcome = random(13);
    if (outcome >= 11) return 'explosive charge is a dud';
    if (outcome >= 9) return 'electric charge is grounded';
    if (outcome >= 7) return 'flame fizzles out';
    if (outcome >= 4) return 'poisoned needle misses';
    return 'gas cloud blows away';
}

function trapOutcome(luck: number, random: RandomBelow): number {
    if (random(20) === 0) return random(26);
    return luck >= 13 ? 0 : random(13 - luck);
}

export async function triggerChestTrap(container: GameObject | null | undefined, {
    state = game,
    disarm = false,
    bodyPart = 'hand',
    random = rn2,
    rollDice = d,
    publish = plineWithContinuation,
}: ChestTrapOptions = {}): Promise<ChestTrapResult | null> {
    if (!container?.otrapped) return null;
    const location = containerLocation(container, state);
    container.tknown = false;
    container.otrapped = false;
    await publish(`You ${disarm ? 'set it off' : 'trigger a trap'}!`);

    const luck = (state.u.uluck ?? 0) + (state.u.moreluck ?? 0);
    if (luck > -13 && random(13 + luck) > 7) {
        const message = luckSaveMessage(random);
        await publish(`But luckily the ${message}!`);
        container.tknown = true;
        return { outcome: 'luck-save', damage: 0, destroyed: false };
    }

    const outcome = trapOutcome(luck, random);
    let result: ChestTrapResult;
    if (outcome >= 21) {
        result = await explodeContainer(
            container, location, state, publish, rollDice,
        );
    } else if (outcome >= 17) {
        result = await releaseNoxiousGas(
            container, location, state, publish, random, rollDice,
        );
    } else if (outcome >= 13) {
        result = await prickHero(
            state, publish, random, rollDice, bodyPart,
        );
    } else if (outcome >= 9) {
        const fire = await triggerHeroFireTrap(container, { publish });
        result = { outcome: 'fire', destroyed: false, died: fire.died };
    } else if (outcome >= 6) {
        result = await shockHero(state, publish, random, rollDice);
    } else if (outcome >= 3) {
        result = await paralyzeHero(state, publish, rollDice);
    } else {
        result = await confuseHero(container, state, publish, random);
    }

    if (!result.destroyed && !result.died) {
        await bot();
        container.tknown = true;
    }
    return result;
}
