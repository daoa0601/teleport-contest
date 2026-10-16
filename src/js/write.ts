// Applying a magic marker. C refs: write.c:cost(), write_ok(), dowrite(),
// new_book_description(). Inventory, billing, and holding keep their owners.
import { exerciseWisdom } from './attrib.js';
import { heroFingerName } from './body_parts.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, MAXULEV } from './const.js';
import { impossible } from './diagnostics.js';
import { plineWithContinuation as pline } from './display.js';
import { wipeoutText } from './engrave.js';
import { game, requirePlayingGame } from './gstate.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { consumeInventoryItem } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { recordLiteracy } from './literacy.js';
import { mksobj } from './mklev.js';
import {
    getObjectClassBounds, OBJECT_DESCRIPTIONS, OBJECT_NAMES, OBJECT_SPELL_LEVEL,
    SCR_BLANK_PAPER, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL,
} from './object_data.js';
import { deleteObject } from './object_delete.js';
import { makePlural } from './object_grammar.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import type { GameObject } from './object_types.js';
import { objectCombatName, objectNameIsPlural, simpleObjectName } from './objnam.js';
import { heroHasNoHands } from './polyself.js';
import { getLine } from './query.js';
import { rn1, rn2, rnl } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { carriedObjectOwner, chargeUnpaidUsage, objectTypeKnown } from './shk.js';
import { knownSpell } from './spell.js';

const SCROLL_CLASS = 9, SPBOOK_CLASS = 10;
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');

export async function useMagicMarker(pen: GameObject): Promise<boolean> {
    requirePlayingGame(game);
    if (heroHasNoHands(game)) {
        await pline('You need hands to be able to write!');
        return false;
    }
    if (game.u.glib || (game.u.glibTurns ?? 0) > 0) {
        await pline(`The ${objectCombatName(pen)} ${objectNameIsPlural(pen) ? 'slip' : 'slips'} from your ${makePlural(heroFingerName(game))}.`);
        await dropInventoryObjectAtHero(pen);
        return true;
    }
    const paper = await chooseInventoryObject('write on', object => {
        if (![SCROLL_CLASS, SPBOOK_CLASS].includes(object.oclass)) return GETOBJ_EXCLUDE;
        return [SCR_BLANK_PAPER, SPE_BLANK_PAPER].includes(object.otyp)
            ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
    });
    if (!paper) return false;
    const typeword = paper.otyp === SPE_NOVEL ? 'book'
        : paper.oclass === SPBOOK_CLASS ? 'spellbook' : 'scroll';
    if (heroIsBlind(game)) {
        if (!paper.dknown) {
            await pline(`You don't know whether that ${typeword} is blank or not.`);
            return false;
        }
        if (paper.oclass === SPBOOK_CLASS) {
            await pline(`${carriedObjectOwner(pen)} ${simpleObjectName(pen)} can't create braille text.`);
            return false;
        }
    }
    observeObject(paper);
    if (![SCR_BLANK_PAPER, SPE_BLANK_PAPER].includes(paper.otyp)) {
        await pline(`That ${typeword} is not blank!`);
        exerciseWisdom(false);
        return true;
    }
    // Native makes the scroll type known even when writing on a blank book.
    learnObjectType(SCR_BLANK_PAPER);
    const answer = await getLine(`What type of ${typeword} do you want to write?`, () => true);
    if (answer === null || !answer.trim()) return true;
    const name = answer.trim().replace(/\s+/g, ' ')
        .replace(/^(scroll |spellbook )/i, '').replace(/^of /i, '')
        .replace(/ armour/i, ' armor ').replace(/\s+/g, ' ').trim();
    const target = findWritingType(name, paper.oclass);
    if (!target) {
        await pline(`There is no such ${typeword}!`);
        return true;
    }
    if ([SCR_BLANK_PAPER, SPE_BLANK_PAPER].includes(target.otyp)) {
        await pline("You can't write that!");
        await pline("It's obscene!");
        return true;
    }
    if (target.otyp === SPE_NOVEL) {
        await tryWritingNovel(paper);
        return true;
    }
    if (target.otyp === SPE_BOOK_OF_THE_DEAD) {
        await pline('No mere dungeon adventurer could write that.');
        return true;
    }
    if (target.byDescription && paper.oclass === SPBOOK_CLASS && !objectTypeKnown(target)) {
        await pline("Unfortunately you don't have enough information to go on.");
        return true;
    }
    recordLiteracy(`became literate by writing a ${typeword}`);
    const written = await mksobj(target.otyp, false, false);
    written.bknown = !!(paper.bknown && pen.bknown);
    await chargeUnpaidUsage(pen);
    const basecost = await writingCost(written);
    if (pen.spe < basecost / 2) {
        await pline('Your marker is too dry to write that!');
        await deleteObject(written);
        return true;
    }
    const actualcost = rn1(basecost / 2, basecost / 2);
    const curseval = blessingSign(pen) + blessingSign(paper);
    exerciseWisdom(true);
    if (pen.spe < actualcost) {
        pen.spe = 0;
        await pline('Your marker dries out!');
        if (paper.oclass === SPBOOK_CLASS)
            await pline('The spellbook is left unfinished and your writing fades.');
        else {
            await pline('The scroll is now useless and disappears!');
            await consumeInventoryItem(paper);
        }
        await deleteObject(written);
        return true;
    }
    pen.spe -= actualcost;
    const spellKnowledge = paper.oclass === SPBOOK_CLASS ? knownSpell(written.otyp) : 'unknown';
    if (!objectTypeKnown(written)
        && !(target.byDescription && game._encounteredObjectTypes?.has(written.otyp))
        && spellKnowledge !== 'fresh'
        && rnl((game.urole.key === 'wizard' && paper.oclass !== SPBOOK_CLASS)
            || spellKnowledge === 'stale' ? 5 : 15)) {
        await pline(`You ${target.byDescription ? 'fail' : "don't know how"} to write that.`);
        if (paper.oclass === SPBOOK_CLASS)
            await pline('You write in your best handwriting:  "My Diary", but it quickly fades.');
        else {
            const text = target.byDescription
                ? wipeoutText(writingDescription(written.otyp), Math.trunc((6 + MAXULEV - game.u.ulevel) / 6))
                : `${game.plname} was here!`;
            await pline(`You write "${text}" and the scroll disappears.`);
            await consumeInventoryItem(paper);
        }
        await deleteObject(written);
        return true;
    }
    if (heroIsBlind(game) && rnl(3)) {
        await pline('You fail to write the scroll correctly and it disappears.');
        await consumeInventoryItem(paper);
        await deleteObject(written);
        return true;
    }
    await consumeInventoryItem(paper);
    if (written.oclass === SPBOOK_CLASS) {
        const description = writingDescription(written.otyp);
        const into = ['parchment', 'vellum', 'cloth'].includes(description.toLowerCase()) ? 'into ' : '';
        await pline(`The spellbook warps strangely, then turns ${into}${description}.`);
    }
    written.blessed = curseval > 0;
    written.cursed = curseval < 0;
    if (written.otyp === SCR_MAIL) written.spe = 2;
    written.dknown = false;
    if (objectTypeKnown(written) || target.byDescription) observeObject(written);
    const noun = objectCombatName(written);
    await holdAnotherObject(written, {
        dropMessage: `Oops!  The ${noun} slips out of your grasp!`,
    });
    return true;
}

interface WritingType { otyp: number; byDescription: boolean }

// Unknown real scroll names are deferred so a conflicting called name can
// win. Repeated called names use the native reservoir selection, including
// the first rn2(1) draw.
function findWritingType(name: string, oclass: number): WritingType | null {
    const { first, last } = getObjectClassBounds(oclass);
    const requested = name.toLowerCase();
    let deferred: WritingType | null = null;
    let real = false;
    for (let otyp = first; otyp <= last; otyp++) {
        const actual = OBJECT_NAMES[otyp];
        if (!actual) continue;
        if (actual.toLowerCase() === requested) {
            if (objectTypeKnown({ otyp }) || oclass === SPBOOK_CLASS)
                return { otyp, byDescription: false };
            deferred = { otyp, byDescription: false };
            real = true;
            break;
        }
        if (writingDescription(otyp).toLowerCase() === requested)
            return { otyp, byDescription: true };
    }
    let matches = 0;
    for (let otyp = first; otyp <= last; otyp++) {
        if (game._objectCallNames?.[otyp]?.toLowerCase() === requested
            && !(real && objectTypeKnown({ otyp })) && !rn2(++matches))
            deferred = { otyp, byDescription: true };
    }
    return deferred;
}

function writingDescription(otyp: number): string {
    return game.objectDescriptions?.[otyp] ?? OBJECT_DESCRIPTIONS[otyp] ?? '';
}

async function writingCost(object: GameObject): Promise<number> {
    if (object.oclass === SPBOOK_CLASS) {
        const level = OBJECT_SPELL_LEVEL[object.otyp];
        if (level === undefined) throw new RangeError(`Missing spell level for book ${object.otyp}`);
        return 10 * level;
    }
    const name = OBJECT_NAMES[object.otyp];
    if (typeof name !== 'string') throw new RangeError(`Missing scroll name for type ${object.otyp}`);
    switch (name) {
        case 'mail': return 2;
        case 'light': case 'gold detection': case 'food detection':
        case 'magic mapping': case 'amnesia': case 'fire': case 'earth': return 8;
        case 'destroy armor': case 'create monster': case 'punishment': return 10;
        case 'confuse monster': return 12;
        case 'identify': return 14;
        case 'enchant armor': case 'remove curse': case 'enchant weapon': case 'charging': return 16;
        case 'scare monster': case 'stinking cloud': case 'taming': case 'teleportation': return 20;
        case 'genocide': return 30;
        default:
            await impossible("You can't write such a weird scroll!");
            return 1000;
    }
}

function blessingSign(object: GameObject): number {
    return object.blessed ? 1 : object.cursed ? -1 : 0;
}

async function tryWritingNovel(paper: GameObject): Promise<void> {
    const fanfic = !rn2(3), tearup = !rn2(3);
    if (fanfic)
        await pline(`You ${tearup ? '' : 'start to '}produce really ${heroIsHallucinating(game) ? 'awesome' : 'lame'} fan-fiction.`);
    else
        await pline(`You ${tearup ? 'try' : 'prepare'} to write the Great Yendorian Novel, but ${heroIsHallucinating(game) ? 'have too much' : 'lack'} inspiration.`);
    await pline(tearup ? 'You tear it up.' : 'You give up on the idea.');
    if (tearup) await consumeInventoryItem(paper);
}
