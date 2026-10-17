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
import { nameToMonster } from './mondata.js';
import { MONSTER_FLAGS2, MONSTER_GENO } from './monster_data.js';
import { definiteName } from './objnam.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { formatFeltMessage } from './hero_speech.js';
import { d, rn2, rnd } from './rng.js';
import { reportHeroEncumbrance } from './encumbrance.js';

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
        return formatFeltMessage(`innately weaker${punctuation}`, state);
    if (attribute === A_CON && currentAttribute(A_CON, state) === 25)
        return formatFeltMessage(`sick inside${punctuation}`, state);
    const message = POISON_EFFECT[attribute];
    if (!message) throw new RangeError(`Unknown poisoned attribute ${attribute}.`);
    const text = message.replace(/!$/u, punctuation);
    return text.startsWith('You feel ') ? formatFeltMessage(text.slice(9), state) : text;
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

    // poisoned() uses the unique monster's name without an indefinite
    // article, even though its caller only supplied a species name.
    const species = nameToMonster(killer);
    const unique = species >= 0 && !!((MONSTER_GENO[species] ?? 0) & 0x1000);
    const personal = species >= 0 && !!((MONSTER_FLAGS2[species] ?? 0) & 0x00080000);
    if (unique && !personal) killer = definiteName(killer);
    const attributedKiller = unique || /^(?:the|an?) /iu.test(killer)
        ? killer : withIndefiniteArticle(killer);
    const hpDeathCause = `killed by ${attributedKiller}`;

    const loseAttribute = async (target: number, amount: number): Promise<void> => {
        const change = adjustAttribute(target, amount, state);
        if (!change.changed) return;
        state.context.botl = true;
        // adjattrib() calls encumber_msg() before poisontell() during play.
        if (state.program_state.in_moveloop && (target === A_STR || target === A_CON))
            await reportHeroEncumbrance(state, line);
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
            state.context.botl = true;
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
            if (await loseHeroHp(damage, killer, { state, publish: line, die, deathCause: hpDeathCause }))
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
        if (await loseHeroHp(damage, killer, { state, publish: line, die, deathCause: hpDeathCause }))
            return { damage, died: true, pagerOwned };
    } else {
        const loss = thrownWeapon || !fatal ? 1 : rollDice(2, 2);
        await loseAttribute(attribute, -loss);
    }

    if (hero.uhp < 1 && await die({
        killer,
        deathLineShown: true,
        deathType: /poison/iu.test(killer) ? DIED : POISONING,
        deathCause: /poison/iu.test(killer) ? hpDeathCause : `poisoned by ${attributedKiller}`,
    })) return { damage, died: true, pagerOwned };

    await reportHeroEncumbrance(state, line);
    return {
        damage,
        died: false,
        pagerOwned,
    };
}
