// Poison damage and lasting effects on the hero.
// C ref: attrib.c poisoned().

import {
    adjustAttribute, currentAttribute,
} from './attrib.js';
import {
    A_CHA, A_CON, A_STR, Upolyd,
} from './const.js';
import { game } from './gstate.js';
import { d, rn2 } from './rng.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';

const POISON_EFFECT = [
    'You feel weaker!',
    'Your brain is on fire!',
    'Your judgement is impaired!',
    "Your muscles won't obey you!",
    'You feel very sick!',
    'You break out in hives!',
];

function attributeChanged(result) {
    return !!(result?.changed || result?.baseChanged
        || result?.maximumChanged);
}

function poisonEffectMessage(attribute, state) {
    if (attribute === A_STR && currentAttribute(A_STR, state) === 125)
        return 'You feel innately weaker!';
    if (attribute === A_CON && currentAttribute(A_CON, state) === 25)
        return 'You feel sick inside!';
    return POISON_EFFECT[attribute];
}

function adjustedDamageAfterMaxHpLoss(loss, oldHp, state) {
    const hero = state.u;
    if (!Upolyd(hero) && hero.uhp < oldHp)
        loss -= oldHp - hero.uhp;
    else if (Upolyd(hero) && (hero.mh ?? 0) < oldHp)
        loss -= oldHp - (hero.mh ?? 0);
    return Math.max(loss, 1);
}

async function updateEncumbrance(previous, state, publish) {
    const current = nearCapacity(state);
    state._encumbranceLevel = current;
    state.u._encumbrance = encumbranceLabel(current);
    const message = encumbranceMessage(previous, current);
    return message ? await publish(message) : null;
}

export async function resolvePoisonedHero({
    reason,
    attribute,
    fatal = 30,
    state = game,
    random = rn2,
    rollDice = d,
    publish = async () => undefined,
}) {
    let pagerOwned = false;
    const line = async message => {
        const dismissal = await publish(message);
        if (dismissal !== null && dismissal !== undefined)
            pagerOwned = true;
    };

    await line(`${reason} was poisoned!`);
    const hero = state.u;
    if (hero.poisonResistance || hero.poison_resistance) {
        await line("The poison doesn't seem to affect you.");
        return { resisted: true, pagerOwned };
    }

    const previousCapacity = state._encumbranceLevel ?? nearCapacity(state);
    const outcome = fatal ? random(fatal) : 1;
    let damage = 0;
    if (outcome === 0 && attribute !== A_CHA) {
        damage = 6 + rollDice(4, 6);
        if ((hero.uhp ?? 1) <= damage) {
            hero.uhp = -1;
            await line('The poison was deadly...');
            return { damage, deadly: true, outcome, pagerOwned };
        }

        const oldHp = hero.uhp;
        const minimumMaxHp = Math.max(hero.ulevel ?? 1, 3);
        hero.uhpmax = Math.max(
            (hero.uhpmax ?? oldHp) - Math.trunc(damage / 2),
            minimumMaxHp,
        );
        hero.uhp = Math.min(hero.uhp, hero.uhpmax);
        damage = adjustedDamageAfterMaxHpLoss(
            damage, oldHp, state,
        );
        hero.uhp = Math.max(0, hero.uhp - damage);

        const constitutionLoss = attribute === A_CON ? -3 : -1;
        const constitution = adjustAttribute(A_CON, constitutionLoss, state);
        if (attributeChanged(constitution))
            await line(poisonEffectMessage(A_CON, state));
        if (attribute !== A_CON) {
            const poisonedAttribute = adjustAttribute(attribute, -3, state);
            if (attributeChanged(poisonedAttribute))
                await line(poisonEffectMessage(attribute, state));
        }
    } else if (outcome > 5) {
        damage = 6 + random(10);
        if (/^(?:the )?gas cloud$/iu.test(reason)
            && (hero.halfGasDamage || hero.half_gas_damage)) {
            damage = Math.trunc((damage + 1) / 2);
        }
        hero.uhp = Math.max(0, (hero.uhp ?? 1) - damage);
    } else {
        const loss = rollDice(2, 2);
        const result = adjustAttribute(attribute, -loss, state);
        if (attributeChanged(result))
            await line(poisonEffectMessage(attribute, state));
    }

    const encumbranceDismissal = await updateEncumbrance(
        previousCapacity, state, publish,
    );
    if (encumbranceDismissal !== null && encumbranceDismissal !== undefined)
        pagerOwned = true;
    return {
        damage,
        deadly: (hero.uhp ?? 1) < 1,
        outcome,
        pagerOwned,
    };
}
