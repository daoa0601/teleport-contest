// Native spell.c:study_book(), learn(), cursed_book(), and confused_book().
// Reading owns admission and literacy; the scheduler owns each study turn.
import { formatFeltMessage } from './hero_speech.js';
import { currentAttribute, exerciseWisdom } from './attrib.js';
import { heroEyeCount, heroEyeName, heroFaceName } from './body_parts.js';
import { nomul } from './command_state.js';
import { A_INT, A_WIS } from './const.js';
import { askTeleportDestination } from './cmd.js';
import { impossible } from './diagnostics.js';
import { clearMessageWindow, flushPendingTopline, plineWithContinuation as pline, shieldeff } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { takeHeroGold } from './hero_gold.js';
import { makeConfused } from './hero_mental_status.js';
import { putHeroToSleep } from './hero_sleep.js';
import { consumeInventoryItem } from './invent.js';
import { aggravateMonsters } from './monster_anger.js';
import { tryCallObjectType } from './object_call.js';
import { erodeObject } from './object_erosion.js';
import { learnObjectType } from './object_knowledge.js';
import { OBJECT_DELAY, OBJECT_DESCRIPTIONS, OBJECT_INITIAL_KNOWN, OBJECT_NAMES, OBJECT_SPELL_LEVEL, LENSES, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, requireObjectData } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { stopHeroOccupation } from './occupation.js';
import { definiteObjectAction, objectName } from './objnam.js';
import { objectQuantity } from './object_stack.js';
import { poisonHeroStrengthAndHp } from './poison.js';
import { propertyIsActive } from './properties.js';
import { promptYesNo } from './query.js';
import { rn1, rn2, rnd } from './rng.js';
import { chargeUnpaidUsage } from './shk.js';
import { makeBlinded } from './sight_change.js';
import { readBookOfDead, readNovel } from './special_spellbooks.js';
import { createMemorizedSpell } from './spell.js';
import { currentSpellKnowledge } from './spell_casting_rules.js';
import { teleportHero } from './teleport.js';
import { rndcurse } from './throne.js';
const MAX_SPELLS = 52;
const MAX_STUDIES = 3;
export async function studyBook(book, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const study = studyState(state);
    const type = book.otyp;
    const level = requireObjectData(OBJECT_SPELL_LEVEL, type);
    const confused = (state.u.confusionTurns ?? 0) > 0;
    const appearance = state.objectDescriptions?.[type] ?? OBJECT_DESCRIPTIONS[type];
    if (!confused && !propertyIsActive('sleepResistance', state)
        && !state.u.sleepResistance && appearance === 'dull') {
        let drowsiness = rnd(25) - currentAttribute(A_WIS, state);
        if (study.delay && study.book === book)
            drowsiness -= rnd(level);
        if (drowsiness > 0) {
            const eyes = heroEyeCount(state) > 1 ? makePlural(heroEyeName(state)) : heroEyeName(state);
            await pline(`This book is so dull that you can't keep your ${eyes} open.`);
            putHeroToSleep(drowsiness + rnd(2 * level), { state });
            return outcome(true, state);
        }
    }
    if (study.delay && !confused && study.book === book && type !== SPE_BLANK_PAPER) {
        await pline(`You continue your efforts to ${type === SPE_NOVEL ? 'read the novel' : 'memorize the spell'}.`);
    }
    else {
        if (type === SPE_BLANK_PAPER) {
            await pline('This spellbook is all blank.');
            learnObjectType(type, state);
            return outcome(true, state);
        }
        if (type === SPE_NOVEL) {
            return readNovel(book, { state });
        }
        const delay = readingDelay(type);
        if (delay === null) {
            await impossible(`Unknown spellbook level ${level}, book ${type};`, { state });
            study.delay = 0;
            return outcome(false, state);
        }
        study.delay = delay;
        const remembered = state.spells.find(spell => spell.otyp === type);
        if (remembered && currentSpellKnowledge(remembered, state) > 2000) {
            await pline(`You know "${OBJECT_NAMES[type]}" quite well already.`);
            learnObjectType(type, state);
            if (await promptYesNo('Refresh your memory anyway?', 'n') !== 'y')
                return outcome(false, state);
        }
        book.in_use = true;
        let tooHard = false;
        if (!book.blessed && type !== SPE_BOOK_OF_THE_DEAD) {
            if (book.cursed)
                tooHard = true;
            else {
                const lenses = (state.ublindf || state.u.ublindf)?.otyp === LENSES;
                const ability = currentAttribute(A_INT, state) + 4
                    + Math.trunc(state.u.ulevel / 2) - 2 * level + (lenses ? 2 : 0);
                if (state.urole.key === 'wizard' && ability < 20 && !confused) {
                    const question = `This spellbook is ${ability < 12 ? 'very ' : ''}difficult to comprehend.  Continue?`;
                    if (await promptYesNo(question, 'n') !== 'y') {
                        book.in_use = false;
                        return outcome(true, state);
                    }
                }
                tooHard = rnd(20) > ability;
            }
        }
        if (tooHard) {
            const curse = await cursedBook(book, { state });
            if (curse.heroDied)
                return outcome(true, state);
            delayReading(study.delay, state);
            study.delay = 0;
            if (curse.destroyed || !rn2(3)) {
                if (!curse.destroyed)
                    await pline('The spellbook crumbles to dust!');
                await tryCallObjectType(book, state);
                await consumeInventoryItem(book, state);
            }
            else
                book.in_use = false;
            return outcome(true, state);
        }
        if (confused) {
            const destroyed = await confusedBook(book, { state });
            if (!destroyed)
                book.in_use = false;
            delayReading(study.delay, state);
            study.delay = 0;
            return outcome(true, state);
        }
        book.in_use = false;
        await pline(`You begin to ${type === SPE_BOOK_OF_THE_DEAD ? 'recite' : 'memorize'} the runes.`);
    }
    study.book = book;
    study.o_id = book.o_id;
    state._occupation = { key: 'study-book', text: 'studying' };
    return outcome(true, state);
}
export async function continueSpellbookStudy({ state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const study = studyState(state);
    const book = study.book;
    state.context.move = 1;
    if (!book)
        return false;
    if (study.delay && (state.ublindf || state.u.ublindf)?.otyp === LENSES && rn2(2))
        study.delay++;
    if ((state.u.confusionTurns ?? 0) > 0) {
        await confusedBook(book, { state });
        study.book = null;
        study.o_id = 0;
        delayReading(study.delay, state);
        study.delay = 0;
        return false;
    }
    if (study.delay) {
        study.delay++;
        return true;
    }
    exerciseWisdom(true, state);
    if (book.otyp === SPE_BOOK_OF_THE_DEAD) {
        await readBookOfDead(book, { state });
        return false;
    }
    const spells = state.spells;
    let index = spells.findIndex(spell => spell.otyp === book.otyp);
    const alreadyKnown = index >= 0;
    if (!alreadyKnown)
        index = spells.length;
    let type = book.otyp;
    if (index >= MAX_SPELLS)
        await impossible('Too many spells memorized!', { state });
    else {
        const quoted = typeKnown(type, state) ? `"${OBJECT_NAMES[type]}"` : `the "${OBJECT_NAMES[type]}" spell`;
        const studied = book.spestudied || 0;
        const remembered = spells[index];
        if (studied >= (alreadyKnown ? MAX_STUDIES + 1 : MAX_STUDIES)) {
            await pline(alreadyKnown ? 'This spellbook is too faint to be read any more.'
                : 'This spellbook is too faint to read even once.');
            book.otyp = type = SPE_BLANK_PAPER;
            book.spestudied = rn2(studied);
        }
        else if (remembered) {
            await pline(`Your knowledge of ${quoted} is ${currentSpellKnowledge(remembered, state) ? 'keener' : 'restored'}.`);
            remembered.know = 20001 + Math.max(0, (state.moves || 1) - 1);
            book.spestudied = (book.spestudied || 0) + 1;
            exerciseWisdom(true, state);
        }
        else {
            spells.push(createMemorizedSpell(type, 20001, state));
            book.spestudied = (book.spestudied || 0) + 1;
            if (!index)
                await pline(`You learn ${quoted}.`);
            else
                await pline(`You add ${quoted} to your repertoire, as '${index < 26 ? String.fromCharCode(97 + index) : String.fromCharCode(65 + index - 26)}'.`);
        }
        learnObjectType(type, state);
    }
    if (book.cursed) {
        const curse = await cursedBook(book, { state });
        if (curse.heroDied)
            return false;
        if (curse.destroyed) {
            await consumeInventoryItem(book, state);
            bookDisappears(book, { state });
            return false;
        }
    }
    await chargeUnpaidUsage(book, { state });
    study.book = null;
    study.o_id = 0;
    return false;
}
export async function cursedBook(book, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let destroyed = false;
    switch (rn2(requireObjectData(OBJECT_SPELL_LEVEL, book.otyp))) {
        case 0:
            await pline(formatFeltMessage('a wrenching sensation.', state));
            await teleportHero({ chooseDestination: askTeleportDestination });
            break;
        case 1:
            await pline(formatFeltMessage('threatened.', state));
            aggravateMonsters(state);
            break;
        case 2:
            await makeBlinded((state.u.blindTurns || 0) + rn1(100, 250), { state });
            break;
        case 3:
            await takeHeroGold(state);
            break;
        case 4:
            await pline('These runes were just too much to comprehend.');
            await makeConfused((state.u.confusionTurns || 0) + rn1(7, 16), { state, talk: false });
            break;
        case 5: {
            await pline('The book was coated with contact poison!');
            const gloves = state.uarmg || state.u.uarmg;
            if (gloves) {
                await erodeObject(gloves, 'corrosion', { state, verbose: true, grease: true, displayName: 'gloves' });
                break;
            }
            const inUse = book.in_use;
            book.in_use = false;
            const resisted = !!state.u.poisonResistance || propertyIsActive('poisonResistance', state);
            const died = await poisonHeroStrengthAndHp(resisted ? rn1(2, 1) : rn1(4, 3), rnd(resisted ? 6 : 10), 'contact-poisoned spellbook', { state, deathCause: 'killed by a contact-poisoned spellbook' });
            if (!died) {
                if (inUse === undefined)
                    delete book.in_use;
                else
                    book.in_use = inUse;
            }
            break;
        }
        case 6:
            if (state.u.antimagic || propertyIsActive('antimagic', state)) {
                await shieldeff(state.u.ux, state.u.uy);
                await pline('The book radiates explosive energy, but you are unharmed!');
            }
            else {
                await pline(`As you read the book, it radiates explosive energy in your ${heroFaceName(state)}!`);
                const damage = 2 * rnd(10) + 5;
                await loseHeroHp(state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, 'exploding rune', { state });
            }
            destroyed = true;
            break;
        default:
            await rndcurse();
    }
    return { destroyed, heroDied: !!state.program_state.gameover };
}
export async function confusedBook(book, { state = game } = {}) {
    if (!rn2(3) && book.otyp !== SPE_BOOK_OF_THE_DEAD) {
        book.in_use = true;
        await pline('Being confused you have difficulties in controlling your actions.');
        await flushPendingTopline();
        clearMessageWindow();
        await pline('You accidentally tear the spellbook to pieces.');
        await tryCallObjectType(book, state);
        await consumeInventoryItem(book, state);
        return true;
    }
    await pline(`You find yourself reading the ${book === studyState(state).book ? 'next' : 'first'} line over and over again.`);
    return false;
}
export function bookDisappears(book, { state = game } = {}) {
    const study = state.context?.spbook;
    if (study?.book === book) {
        study.book = null;
        study.o_id = 0;
    }
}
export async function bookCursed(book, { state = game } = {}) {
    if (!book.cursed || (state._helplessTurns ?? 0) > 0 || (state.multi || 0) < 0
        || state._occupation?.key !== 'study-book' || state.context.spbook?.book !== book)
        return;
    await pline(`${definiteObjectAction(book, 'slam', state)} shut!`);
    book.bknown = true;
    await stopHeroOccupation(state);
}
function studyState(state) {
    return state.context.spbook ||= { book: null, o_id: 0, delay: 0 };
}
function readingDelay(type) {
    const level = requireObjectData(OBJECT_SPELL_LEVEL, type);
    const delay = requireObjectData(OBJECT_DELAY, type);
    if (level >= 1 && level <= 2)
        return -delay;
    if (level <= 4 && level >= 3)
        return -(level - 1) * delay;
    if (level <= 6 && level >= 5)
        return -level * delay;
    return level === 7 ? -8 * delay : null;
}
function typeKnown(type, state) {
    return OBJECT_INITIAL_KNOWN[type] || state._knownObjectTypes?.has(type);
}
function delayReading(delay, state) {
    nomul(delay, state);
    state._helplessReason = 'reading a book';
    state._helplessDoneMessage = null;
}
function outcome(spentTime, state) {
    return { spentTime, heroDied: !!state.program_state.gameover };
}
//# sourceMappingURL=spellbook_study.js.map