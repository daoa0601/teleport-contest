// Special spellbooks. C spell.c:deadbook(), deadbook_pacify_undead(),
// and the novel branch of study_book(). Ordinary study owns its occupation.

import { publishHeardMessage } from './hero_speech.js';
import { ACH_INVK, ACH_NOVL, recordAchievement } from './achievements.js';
import { heroSpineName } from './body_parts.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { plineWithContinuation as pline } from './display.js';
import { level_difficulty } from './dungeon.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { makeInvocationArea } from './invocation_area.js';
import { heroIsOnStairs, isInvocationPosition } from './invocation_position.js';
import { findMonsterNearPosition, makemonAt, morgueMonsterType } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import {
    MONSTER_ALIGNMENT, MONSTER_NAME, monsterIsUndead, monsterIsVampireShifter, requireMonsterData,
} from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import { monstersInFmonOrder } from './monmove.js';
import { tameMonster } from './monster_taming.js';
import { novelTitle } from './novel_titles.js';
import { readNovelTribute } from './novel_tribute.js';
import { BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, CORPSE } from './object_data.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { NO_MINVENT } from './const.js';
import { d, rnd, rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { chargeUnpaidUsage } from './shk.js';
import { turnCarriedObjects } from './undead_turning.js';
import { cansee } from './vision.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';

interface SpecialBookOptions { state?: GameState; }
interface UndeadCreationOptions extends SpecialBookOptions { reviveCorpses?: boolean; flags?: number; }


export async function readBookOfDead(book: GameObject, { state = game }: SpecialBookOptions = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    await pline('You turn the pages of the Book of the Dead...');
    learnObjectType(book.otyp, state);
    observeObject(book, state);
    book.known = true;
    if (isInvocationPosition(state.u.ux, state.u.uy, state) && !heroIsOnStairs(state)) {
        await invokeBook(book, state);
    } else if (book.cursed) {
        await raiseDead(state);
    } else if (book.blessed) {
        for (const monster of monstersInFmonOrder(state.level.monsters)) {
            if (!monster.dead && monster.mhp > 0) await pacifyUndead(monster, state);
        }
    } else {
        const messages = [
            'Your ancestors are annoyed with you!',
            'The headstones in the cemetery begin to move!',
            'Oh my!  Your name appears in the book!',
        ];
        const index = rn2(messages.length);
        const message = messages[index];
        if (message === undefined) throw new RangeError(`Unknown Book of the Dead message index ${index}`);
        await pline(message);
    }
    return { heroDied: !!state.program_state.gameover };
}

async function invokeBook(book: GameObject, state: PlayingGameState) {
    if (book.cursed) {
        await pline(heroIsBlind(state) ? 'The Book seems to be ignoring you!'
            : "The runes appear scrambled.  You can't read them!");
        return;
    }
    if (!state.u.uhave.bell || !state.u.uhave.menorah) {
        await pline(`A chill runs down your ${heroSpineName(state)}.`);
        if (!state.u.uhave.bell) await publishHeardMessage('a faint chime...', pline, state);
        if (!state.u.uhave.menorah) await pline("Vlad's doppelganger is amused.");
        return;
    }
    let candles = false, bell = false, cursed = false;
    for (const object of state.inventory) {
        const preparedCandles = object.otyp === CANDELABRUM_OF_INVOCATION
            && object.spe === 7 && !!object.lamplit;
        const preparedBell = object.otyp === BELL_OF_OPENING && state.moves - object.age < 5;
        if (preparedCandles || preparedBell) {
            if (object.cursed) cursed = true;
            else {
                candles ||= preparedCandles;
                bell ||= preparedBell;
            }
        }
    }
    if (cursed) {
        await pline('The invocation fails!');
        await pline('At least one of your relics is cursed...');
    } else if (candles && bell) {
        const soon = d(2, 6);
        await makeInvocationArea({ state });
        state.u.uevent ||= {};
        state.u.uevent.invoked = 1;
        recordAchievement(state, ACH_INVK);
        state.u.uevent.udemigod = 1;
        if (!state.u.udg_cnt || state.u.udg_cnt > soon) state.u.udg_cnt = soon;
    } else {
        await pline('You have a feeling that something is amiss...');
        await raiseDead(state);
    }
}

async function raiseDead(state: PlayingGameState) {
    await pline('You raised the dead!');
    if (!rn2(3)) {
        const enemy = await makemonAt(MONSTER_NAME.indexOf('master lich'), state.u.ux, state.u.uy, NO_MINVENT)
            || await makemonAt(MONSTER_NAME.indexOf('nalfeshnee'), state.u.ux, state.u.uy, NO_MINVENT);
        if (enemy) {
            enemy.mpeaceful = 0;
            setMonsterMalign(enemy, state);
        }
    }
    await turnCarriedObjects(state.inventory, state);
    await makeUndeadNear(state.u.ux, state.u.uy, { state, reviveCorpses: true, flags: NO_MINVENT });
}

export async function makeUndeadNear(x: number, y: number, { state = game, reviveCorpses = false, flags = 0 }: UndeadCreationOptions = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let count = Math.trunc((level_difficulty() + 1) / 10) + rnd(5);
    while (count--) {
        const species = morgueMonsterType();
        if (species == null || species < 0) continue;
        const position = findMonsterNearPosition(species, x, y, { state });
        if (!position) continue;
        const corpse = reviveCorpses
            ? state.level.objects[position.x]?.[position.y]?.find(object => object.otyp === CORPSE) : undefined;
        const revived = corpse ? await reviveCorpseImmediately(corpse, state, { announce: false }) : null;
        for (const message of revived?.messages || []) await pline(message);
        if (revived?.kind !== 'revived') await makemonAt(species, position.x, position.y, flags);
    }
    state.level.flags.graveyard = true;
}

async function pacifyUndead(monster: Monster, state: PlayingGameState) {
    if (!(monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster))
        || !cansee(monster.mx, monster.my)) return;
    monster.mpeaceful = 1;
    const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
    if (Math.sign(requireMonsterData(MONSTER_ALIGNMENT, monster.mnum)) === Math.sign(state.u.ualign.type) && distance < 4) {
        if (monster.mtame) {
            if (monster.mtame < 20) monster.mtame++;
        } else await tameMonster(monster, null, { state, announce: true });
    } else await makeMonsterFlee(monster, { state, first: false });
}

export async function readNovel(book: GameObject, { state = game }: SpecialBookOptions = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const title = novelTitle(book);
    if (await readNovelTribute(book, title, state)) {
        if (!state.u.uconduct.literate) recordGameLogEvent(`became literate by reading ${title}`, { state });
        state.u.uconduct.literate = (state.u.uconduct.literate ?? 0) + 1;
        await chargeUnpaidUsage(book, { state });
        learnObjectType(book.otyp, state);
        state.u.uevent ||= {};
        if (!state.u.uevent.read_tribute) {
            recordAchievement(state, ACH_NOVL);
            addExperience(20, 0, state);
            await checkExperienceLevel();
            state.u.uevent.read_tribute = 1;
        }
    }
    return { spentTime: true, heroDied: !!state.program_state.gameover };
}
