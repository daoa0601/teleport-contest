// Poison damage and lasting effects on the hero.
// C ref: attrib.c poisoned().

import {
    adjustAttribute, currentAttribute, loseHeroStrength,
} from './attrib.js';
import {
    A_CHA, A_CON, A_STR, DIED, POISONING, Upolyd,
} from './const.js';
import { plineWithContinuation, shieldeff } from './display.js';
import { finishHeroDeath } from './end.js';
import { game, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import type { DeathHandler } from './end.js';
import { loseHeroHp } from './hero_damage.js';
import { d, rn2, rnd } from './rng.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';

export interface PoisonDamageOptions {
    state?: GameState;
    random?: typeof rn2;
    publish?: MessagePublisher;
    die?: DeathHandler;
    deathCause?: string | null;
}

export interface HeroPoisonOptions extends PoisonDamageOptions {
    reason: string;
    killer: string;
    attribute: number;
    fatal?: number;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
    thrownWeapon?: boolean;
}

export type HeroPoisonResult = {
    resisted: true;
    damage?: never;
    died: false;
    pagerOwned: boolean;
} | {
    resisted?: false;
    damage: number;
    died: boolean;
    pagerOwned: boolean;
};

const POISON_EFFECT = [
    'You feel weaker!',
    'Your brain is on fire!',
    'Your judgement is impaired!',
    "Your muscles won't obey you!",
    'You feel very sick!',
    'You break out in hives!',
];

export function poisonAttributeMessage(
    attribute: number, state: GameState = game, exclaim = true,
): string {
    const punctuation = exclaim ? '!' : '.';
    if (attribute === A_STR && currentAttribute(A_STR, state) === 125)
        return `You feel innately weaker${punctuation}`;
    if (attribute === A_CON && currentAttribute(A_CON, state) === 25)
        return `You feel sick inside${punctuation}`;
    const message = POISON_EFFECT[attribute];
    if (!message) throw new RangeError(`Unknown poisoned attribute ${attribute}.`);
    return message.replace(/!$/u, punctuation);
}

function adjustedDamageAfterMaxHpLoss(
    loss: number, oldHp: number, state: PlayingGameState,
): number {
    const hero = state.u;
    if (!Upolyd(hero) && hero.uhp < oldHp)
        loss -= oldHp - hero.uhp;
    else if (Upolyd(hero) && hero.mh < oldHp)
        loss -= oldHp - hero.mh;
    return Math.max(loss, 1);
}

async function updateEncumbrance(
    previous: number, state: GameState, publish: MessagePublisher,
): Promise<boolean> {
    const current = nearCapacity(state);
    state._encumbranceLevel = current;
    state.u._encumbrance = encumbranceLabel(current);
    const message = encumbranceMessage(previous, current);
    if (!message) return false;
    const dismissal = await publish(message);
    return dismissal !== null && dismissal !== undefined;
}

// C attrib.c:poison_strdmg(). Both argument rolls precede this call;
// recovery from frailty completes before the independent poison damage.
export async function poisonHeroStrengthAndHp(
    strengthLoss: number, damage: number, killer: string, options: PoisonDamageOptions = {},
): Promise<boolean> {
    if (await loseHeroStrength(strengthLoss, killer, options)) return true;
    return loseHeroHp(damage, killer, options);
}

export async function poisonHero({
    reason,
    killer,
    attribute,
    fatal = 30,
    state = game,
    random = rn2,
    rollDice = d,
    rollOne = rnd,
    publish = plineWithContinuation,
    die = finishHeroDeath,
    thrownWeapon = false,
}: HeroPoisonOptions): Promise<HeroPoisonResult> {
    requirePlayingGame(state);
    let pagerOwned = false;
    const line = async (message: string): Promise<void> => {
        const dismissal = await publish(message);
        if (dismissal !== null && dismissal !== undefined)
            pagerOwned = true;
    };

    const blast = reason === 'blast';
    if (!blast && !/poison/iu.test(reason)) {
        const article = /^[A-Z]/u.test(reason) ? '' : 'The ';
        const verb = reason.endsWith('s') ? 'were' : 'was';
        await line(`${article}${reason} ${verb} poisoned!`);
    }
    const hero = state.u;
    const resisted = !!hero.poisonResistance;
    if (resisted) {
        if (blast) await shieldeff(hero.ux, hero.uy);
        await line("The poison doesn't seem to affect you.");
        return { resisted: true, died: false, pagerOwned };
    }

    let previousCapacity = state._encumbranceLevel ?? nearCapacity(state);
    const reportEncumbrance = async (): Promise<void> => {
        if (await updateEncumbrance(previousCapacity, state, publish)) pagerOwned = true;
        previousCapacity = state._encumbranceLevel ?? nearCapacity(state);
    };
    const loseAttribute = async (target: number, amount: number): Promise<void> => {
        const change = adjustAttribute(target, amount, state);
        if (!change.changed) return;
        state.context.botl = true;
        // adjattrib() calls encumber_msg() before poisontell() during play.
        if (state.program_state.in_moveloop && (target === A_STR || target === A_CON))
            await reportEncumbrance();
        await line(poisonAttributeMessage(target, state));
    };
    const outcome = fatal
        ? random(fatal + (thrownWeapon ? 20 : 0)) : 1;
    let damage = 0;
    if (outcome === 0 && attribute !== A_CHA) {
        damage = 6 + rollDice(4, 6);
        // The pinned C code checks human health here, even while polymorphed.
        if (hero.uhp <= damage) {
            hero.uhp = -1;
            await line('The poison was deadly...');
        } else {
            const oldHp = hero.uhp;
            const maximum = Math.max(
                hero.uhpmax - Math.trunc(damage / 2), hero.ulevel, 3,
            );
            hero.uhppeak = Math.max(hero.uhppeak ?? hero.uhpmax, maximum);
            hero.uhpmax = maximum;
            hero.uhp = Math.min(hero.uhp, maximum);
            damage = adjustedDamageAfterMaxHpLoss(damage, oldHp, state);
            if (await loseHeroHp(damage, killer, { state, publish: line, die }))
                return { damage, died: true, pagerOwned };

            const constitutionLoss = attribute === A_CON ? -3 : -1;
            await loseAttribute(A_CON, constitutionLoss);
            if (attribute !== A_CON) await loseAttribute(attribute, -3);
        }
    } else if (outcome > 5) {
        damage = thrownWeapon ? rollOne(6) : 6 + random(10);
        if ((blast || reason === 'gas cloud')
            && hero.halfGasDamage) {
            damage = Math.trunc((damage + 1) / 2);
        }
        if (await loseHeroHp(damage, killer, { state, publish: line, die }))
            return { damage, died: true, pagerOwned };
    } else {
        const loss = thrownWeapon || !fatal ? 1 : rollDice(2, 2);
        await loseAttribute(attribute, -loss);
    }

    if (hero.uhp < 1 && await die({
        killer,
        deathType: /poison/iu.test(killer) ? DIED : POISONING,
    })) return { damage, died: true, pagerOwned };

    await reportEncumbrance();
    return {
        damage,
        died: false,
        pagerOwned,
    };
}
