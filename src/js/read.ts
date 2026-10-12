// Native read.c:doread(). Effects own their exceptions to scroll disposal.
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroCanChant } from './hero_speech.js';
import { consumeInventoryItem } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { gotoLevel as changeLevel } from './level_change.js';
import { recordLiteracy } from './literacy.js';
import { tryCallObjectType } from './object_call.js';
import {
    OBJECT_INITIAL_KNOWN, OBJECT_NAMES, SCR_BLANK_PAPER, SCR_FIRE,
    SCR_REMOVE_CURSE, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL,
} from './object_data.js';
import { promptYesNo } from './query.js';
import { readOrdinaryObject } from './readable_objects.js';
import { applyScrollEffects } from './scroll_effects.js';
import type { ScrollEffectOptions } from './scroll_effects.js';
import type { GameObject } from './object_types.js';
import { learnScrollType } from './scroll_discovery.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { studyBook } from './spellbook_study.js';
import { exceedsActionCapacity } from './weight.js';

const SCROLL_CLASS = 9, SPBOOK_CLASS = 10;
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');

export async function doread(options: Omit<ScrollEffectOptions, 'state'> = {}) {
    const { gotoLevel = changeLevel, ...hooks } = options;
    requirePlayingGame(game);
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        return finishRead(false);
    }
    const source = await chooseInventoryObject('read', classifyReadableObject, { forcePrompt: true });
    if (!source) return finishRead(false);
    source.pickup_prev = false;
    const type = source.otyp;

    const ordinary = await readOrdinaryObject(source);
    if (ordinary.handled) return finishRead(ordinary.spentTime);
    if (heroIsBlind() && type !== SPE_BOOK_OF_THE_DEAD) {
        const unreadable = type === SPE_NOVEL ? 'words'
            : source.oclass === SPBOOK_CLASS ? 'mystic runes'
            : !source.dknown ? 'formula on the scroll' : null;
        if (unreadable) {
            await pline(`Being blind, you cannot read the ${unreadable}.`);
            return finishRead(false);
        }
    }
    const confused = type !== SCR_MAIL && (game.u.confusionTurns ?? 0) > 0;
    if (type === SCR_MAIL && !game.u.uconduct?.literate && !source.spe) {
        const answer = await promptYesNo(
            'Reading mail will violate "illiterate" conduct.  Read anyway?', 'n');
        if (answer !== 'y') return finishRead(false);
    }
    if (![SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, SPE_BLANK_PAPER, SCR_BLANK_PAPER].includes(type))
        recordLiteracy(`became literate by reading ${source.oclass === SPBOOK_CLASS ? 'a book' : 'a scroll'}`);
    if (source.oclass === SPBOOK_CLASS) {
        const result = await studyBook(source);
        return finishRead(result.spentTime);
    }

    source.in_use = true;
    if (type !== SCR_BLANK_PAPER) await announceScroll(source, confused);
    // C schedule_goto() leaves the source level only after doread finishes
    // discovery and useup, so consumed unpaid scrolls still reach that bill.
    const deferred: { destination: Parameters<typeof changeLevel> | null } = { destination: null };
    const effect = await applyScrollEffects(source, {
        ...hooks,
        gotoLevel: async (...args: Parameters<typeof changeLevel>) => { deferred.destination = args; },
    });
    if (effect.heroDied || game.program_state.gameover) return finishRead(false);
    if (!effect.consumed) {
        if (!OBJECT_INITIAL_KNOWN[type] && !game._knownObjectTypes?.has(type)) {
            if (effect.known) learnScrollType(type);
            else await tryCallObjectType(source);
        }
        source.in_use = false;
        if (type !== SCR_BLANK_PAPER) await consumeInventoryItem(source);
    }
    if (deferred.destination) await gotoLevel(...deferred.destination);
    return finishRead(true);
}

function classifyReadableObject(object: GameObject | null | undefined) {
    if (!object) return GETOBJ_EXCLUDE;
    return [SCROLL_CLASS, SPBOOK_CLASS].includes(object.oclass) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
}

async function announceScroll(source: GameObject, confused: boolean) {
    const silently = !heroCanChant();
    const staysVisible = source.otyp === SCR_FIRE || (source.otyp === SCR_REMOVE_CURSE && source.cursed);
    if (heroIsBlind()) {
        const verb = silently ? 'cogitate' : 'pronounce';
        await pline(staysVisible ? `You ${verb} the formula on the scroll.`
            : `As you ${verb} the formula on it, the scroll disappears.`);
    } else {
        await pline(staysVisible ? 'You read the scroll.' : 'As you read the scroll, it disappears.');
    }
    if (confused) await pline(heroIsHallucinating() ? 'Being so trippy, you screw up...'
        : `Being confused, you ${silently ? 'misunderstand' : 'mispronounce'} the magic words...`);
}

function finishRead(spentTime: boolean) {
    const heroDied = !!game.program_state.gameover;
    game.context.move = Number(spentTime && !heroDied);
    return { spentTime, heroDied };
}
