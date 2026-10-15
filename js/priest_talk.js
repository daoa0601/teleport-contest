// C priest.c:priest_talk(). Payments and property changes follow the dialogue.
import { adjustHeroAlignment } from './alignment.js';
import { exerciseAttribute } from './attrib.js';
import { A_WIS } from './const.js';
import { currency } from './currency.js';
import { plineWithContinuation as pline } from './display.js';
import { recordGameLogEvent } from './gamelog.js';
import { heroGoldAmount } from './hero_gold.js';
import { offerGoldToMonster } from './monster_bribe.js';
import { monsterAlignmentType } from './monster_alignment.js';
import { monsterName, monsterPossessive } from './monster_name.js';
import { priestHasShrine, priestIsInOwnTemple } from './priest.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty, propertyTimeout, setPropertyTimeout } from './properties.js';
import { rn1, rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { moneyToHero, monsterGoldAmount } from './shop_money.js';
export async function talkToPriest(priest, state) {
    const coaligned = state.u.ualign.type === monsterAlignmentType(priest);
    const strayed = state.u.ualign.record < 0;
    const shrine = priest.epri ?? priest.mextra?.epri;
    const conduct = state.u.uconduct ||= {};
    const previousConsultations = conduct.gnostic ?? 0;
    conduct.gnostic = previousConsultations + 1;
    if (!previousConsultations)
        recordGameLogEvent(`rejected atheism by consulting with ${monsterName(priest, { state })}`, { state });
    if (priest.mflee || !priest.ispriest && coaligned && strayed) {
        await pline(`${monsterName(priest, { capitalized: true, state })} doesn't want anything to do with you!`);
        priest.mpeaceful = 0;
        return;
    }
    if (!priestIsInOwnTemple(priest, state) || !priest.mpeaceful || priest.msleeping || !priest.mcanmove) {
        if (priest.msleeping || !priest.mcanmove) {
            const name = monsterName(priest, { capitalized: true, state });
            await pline(`${name} breaks out of ${monsterPossessive(priest, { state })} reverie!`);
            priest.mfrozen = priest.msleeping = 0;
            priest.mcanmove = 1;
        }
        priest.mpeaceful = 0;
        const messages = [
            "Thou wouldst have words, eh?  I'll give thee a word or two!",
            'Talk?  Here is what I have to say!', 'Pilgrim, I would speak no longer with thee.',
        ];
        const message = messages[rn2(3)];
        if (!message)
            throw new RangeError('Priest reply is outside its message table');
        await speak(message);
        return;
    }
    if (!priestHasShrine(priest, state)) {
        await speak('Begone!  Thou desecratest this holy place with thy presence.');
        priest.mpeaceful = 0;
        return;
    }
    if (!heroGoldAmount(state)) {
        if (coaligned && !strayed) {
            const money = monsterGoldAmount(priest);
            const name = () => monsterName(priest, { capitalized: true, state });
            if (money > 0) {
                const bits = heroIsHallucinating(state) ? currency(money, { state }) : money === 1 ? 'bit' : 'bits';
                await pline(`${name()} gives you ${money === 1 ? 'one' : 'two'} ${bits} for an ale.`);
                await moneyToHero(priest, Math.min(money, 2), state);
            }
            else
                await pline(`${name()} preaches the virtues of poverty.`);
            await exerciseAttribute(A_WIS, true, state);
        }
        else
            await pline(`${monsterName(priest, { capitalized: true, state })} is not interested.`);
        return;
    }
    const suggested = (state.u.ulevelpeak || 1) * rn1(101, 150 + (shrine?.cheapskate_count ?? 0) * 40);
    const quantity = Math.max(1, Math.trunc(heroGoldAmount(state) / (suggested * 3)));
    const prompt = `How much will you offer (suggested: ${suggested * quantity} or ${suggested * quantity * 2})?`;
    const name = monsterName(priest, { capitalized: true, state });
    await pline(`${name} asks you for a contribution for the temple${state.flags.debug ? ` (base ${suggested})` : ''}.`);
    const offer = await offerGoldToMonster(priest, prompt, state);
    if (!offer) {
        await speak('Thou shalt regret thine action!');
        if (coaligned)
            adjustHeroAlignment(-1, state);
        if (shrine)
            shrine.cheapskate_count = (shrine.cheapskate_count ?? 0) + 1;
    }
    else if (offer < suggested * quantity) {
        if (heroGoldAmount(state) > offer * 2) {
            await speak('Cheapskate.');
            if (shrine)
                shrine.cheapskate_count = (shrine.cheapskate_count ?? 0) + 1;
        }
        else {
            await speak('I thank thee for thy contribution.');
            await exerciseAttribute(A_WIS, true, state);
        }
    }
    else if (offer < suggested * quantity * 2) {
        await speak('Thou art indeed a pious individual.');
        if (heroGoldAmount(state) < offer * 2 && coaligned && state.u.ualign.record <= -4)
            adjustHeroAlignment(1, state);
        await speak('I bestow upon thee a blessing.');
        const duration = Math.trunc(500 * offer / suggested);
        setPropertyTimeout('clairvoyant', propertyTimeout('clairvoyant', state) + rn1(duration, duration), state);
    }
    else if (offer < suggested * quantity * 3) {
        let previousProtection = state.u.ublessed ?? 0;
        if (!hasPermanentIntrinsicProperty('protection', state)) {
            grantIntrinsicProperty('protection', 'outside', state);
            previousProtection = -1;
        }
        for (let remaining = offer; remaining >= 2 * suggested; remaining -= 2 * suggested) {
            const protection = state.u.ublessed ?? 0;
            if (!protection)
                state.u.ublessed = rn1(3, 2);
            else if (protection < 20 && (protection < 9 || !rn2(protection)))
                state.u.ublessed = protection + 1;
        }
        await speak((state.u.ublessed ?? 0) > previousProtection
            ? 'Thou hast been rewarded for thy devotion.' : 'Thy selfless generosity is deeply appreciated.');
    }
    else {
        await speak('Thy selfless generosity is deeply appreciated.');
        if (heroGoldAmount(state) < offer * 2 && coaligned) {
            if (strayed && state.moves - (state.u.ucleansed ?? 0) > 5000) {
                state.u.ualign.record = 0;
                state.u.ucleansed = state.moves;
            }
            else
                adjustHeroAlignment(2, state);
        }
    }
}
async function speak(text) {
    await pline(`"${text}"`);
}
//# sourceMappingURL=priest_talk.js.map