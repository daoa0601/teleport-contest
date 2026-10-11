// Ordinary-object reading. C refs: read.c doread(), erode_obj_text(),
// tshirt_text(), apron_text(), hawaiian_design(), and candy_wrapper_text().
import { armorSimpleName } from './armor.js';
import { artifactById } from './artifacts.js';
import { plineWithContinuation as pline } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { consumeInventoryItem } from './invent.js';
import { recordLiteracy } from './literacy.js';
import { tryCallObjectType } from './object_call.js';
import { ALCHEMY_SMOCK, CANDY_BAR, CAN_OF_GREASE, CORNUTHAUM, CREDIT_CARD, DUNCE_CAP, FORTUNE_COOKIE, HAWAIIAN_SHIRT, MAGIC_MARKER, OBJECT_NAMES, } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { candyWrapperText, garmentInscription, hawaiianDesign } from './object_inscription.js';
import { minimalObjectName, objectName } from './objnam.js';
import { readCookieFortune } from './rumor.js';
import { heroIsBlind } from './senses.js';
import { carriedObjectOwner } from './shk.js';
import { CARD_MESSAGES } from './readable_object_text.js';
const SCROLL_CLASS = 9, SPBOOK_CLASS = 10, COIN_CLASS = 12;
const T_SHIRT = OBJECT_NAMES.indexOf('T-shirt');
const RED_MONSTERS = [
    'fire ant', 'pyrolisk', 'hell hound', 'imp', 'large mimic', 'leocrotta',
    'scorpion', 'xan', 'giant bat', 'water moccasin', 'flesh golem',
    'barbed devil', 'marilith', 'piranha',
];
export async function readOrdinaryObject(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (object.oclass === SCROLL_CLASS || object.oclass === SPBOOK_CLASS)
        return { handled: false, spentTime: false, heroDied: false };
    const type = object.otyp;
    const blind = heroIsBlind(state);
    if (type === FORTUNE_COOKIE) {
        if (state.flags.verbose)
            await pline('You break up the cookie and throw away the pieces.');
        await readCookieFortune(object, { state });
        if (!heroIsBlind(state))
            recordLiteracy('became literate by reading a fortune cookie', { state });
        await consumeInventoryItem(object, state);
        return readingResult(state, true);
    }
    if ([T_SHIRT, ALCHEMY_SMOCK, HAWAIIAN_SHIRT].includes(type))
        return readGarment(object, state);
    if ([DUNCE_CAP, CORNUTHAUM].includes(type) && state.urole.key === 'tourist')
        return readConicalHat(object, state);
    if (type === CREDIT_CARD)
        return readCreditCard(object, state);
    if (type === CAN_OF_GREASE) {
        await pline(`This ${objectName(object, state)} has no label.`);
        return readingResult(state, false);
    }
    if (type === MAGIC_MARKER) {
        if (blind)
            return noBraille(state);
        if (state.flags.verbose)
            await pline('It reads:');
        const monster = inscriptionAt(RED_MONSTERS, object.o_id % RED_MONSTERS.length)
            .replace(/(^| )[a-z]/g, word => word.toUpperCase());
        await pline(`"Magic Marker(TM) ${monster} Red Ink Marker Pen.  Water Soluble."`);
        recordLiteracy('became literate by reading a magic marker', { state });
        return readingResult(state, true);
    }
    if (object.oclass === COIN_CLASS) {
        if (blind)
            await pline('You feel the embossed words:');
        else if (state.flags.verbose)
            await pline('You read:');
        await pline('"1 Zorkmid.  857 GUE.  In Frobs We Trust."');
        recordLiteracy("became literate by reading a coin's engravings", { state });
        return readingResult(state, true);
    }
    if (artifactById(object.oartifact, state)?.name === 'The Orb of Fate') {
        await pline(blind ? 'You feel the engraved signature:' : 'It is signed:');
        await pline('"Odin."');
        recordLiteracy('became literate by reading the divine signature of Odin', { state });
        return readingResult(state, true);
    }
    if (type === CANDY_BAR) {
        if (blind)
            return noBraille(state);
        const wrapper = candyWrapperText(object);
        if (!wrapper) {
            await pline("The candy bar's wrapper is blank.");
            return readingResult(state, false);
        }
        await pline(`The wrapper reads: "${wrapper}".`);
        recordLiteracy('became literate by reading a candy bar wrapper', { state });
        return readingResult(state, true);
    }
    await pline('That is a silly thing to read.');
    return readingResult(state, false);
}
async function readGarment(object, state) {
    if (heroIsBlind(state))
        return noBraille(state);
    const suit = state.uarm || state.u.uarm;
    const shirt = state.uarmu || state.u.uarmu;
    if ([T_SHIRT, HAWAIIAN_SHIRT].includes(object.otyp) && suit && shirt === object) {
        const owner = carriedObjectOwner(suit, state);
        const possessive = ['Your', 'The'].includes(owner) ? owner.toLowerCase() : owner;
        await pline(`${object.unpaid ? 'That' : 'Your'} shirt is obscured by ${possessive} ${armorSimpleName(suit, state)}.`);
        return readingResult(state, false);
    }
    if (object.otyp === HAWAIIAN_SHIRT) {
        await pline(`${state.flags.verbose ? 'The design' : 'It'} features ${hawaiianDesign(object, state)}.`);
        return readingResult(state, true);
    }
    const isShirt = object.otyp === T_SHIRT;
    recordLiteracy(`became literate by reading ${isShirt ? 'a T-shirt' : 'an apron'}`, { state });
    const text = garmentInscription(object, state);
    let punctuation = '';
    if (state.flags.verbose) {
        if (text.length && !/[.!?]$/.test(text))
            punctuation = '.';
        await pline('It reads:');
    }
    await pline(`"${text}"${punctuation}`);
    return readingResult(state, true);
}
async function readConicalHat(object, state) {
    const name = object.quan === 1
        ? minimalObjectName(object, state) : makePlural(minimalObjectName(object, state));
    if (object.o_id % 3) {
        await pline(`You can't find anything to read on this ${name}.`);
        return readingResult(state, false);
    }
    const dunce = object.otyp === DUNCE_CAP;
    await pline(`${heroIsBlind(state) ? 'You feel lettering' : 'There is writing'} on the ${name}.  It reads:  ${dunce ? 'DUNCE' : 'WIZZARD'}.`);
    recordLiteracy(`became literate by reading ${dunce ? 'a dunce cap' : 'a cornuthaum'}`, { state });
    await tryCallObjectType(object, state);
    return readingResult(state, true);
}
async function readCreditCard(object, state) {
    const blind = heroIsBlind(state);
    if (blind)
        await pline('You feel the embossed numbers:');
    else {
        if (state.flags.verbose)
            await pline('It reads:');
        const index = object.oartifact ? CARD_MESSAGES.length - 1
            : object.o_id % (CARD_MESSAGES.length - 1);
        const label = inscriptionAt(CARD_MESSAGES, index);
        await pline(`"${label}"`);
    }
    // The printed number uses native signed-int arithmetic except for its
    // six-digit middle field, which is calculated as a long.
    const id = object.o_id | 0;
    const middle = object.o_id * 499 % 899999 + 100000;
    const number = `${id % 89 + 10}0${id % 4} ${middle}${id % 10}1 0${Number(!(id % 3))}${Math.imul(id, 7) % 10}0`;
    await pline(`"${number}"${state.flags.verbose || blind ? '.' : ''}`);
    recordLiteracy('became literate by reading a credit card', { state });
    return readingResult(state, true);
}
async function noBraille(state) {
    await pline("You can't feel any Braille writing.");
    return readingResult(state, false);
}
function readingResult(state, spentTime) {
    return { handled: true, spentTime, heroDied: !!state.program_state.gameover };
}
function inscriptionAt(messages, index) {
    const message = messages[index];
    if (message === undefined)
        throw new RangeError(`No readable inscription at index ${index}.`);
    return message;
}
//# sourceMappingURL=readable_objects.js.map