// Musical instruments and their effects.
// C ref: music.c.

import { currentAttribute, exerciseAttribute } from './attrib.js';
import {
    A_DEX, A_WIS, COLNO, In_endgame, In_sokoban, In_V_tower,
    Is_astralevel, ROWNO, STRAT_WAITMASK,
} from './const.js';
import { tameMonster } from './dog.js';
import {
    newsym, pline, plineWithContinuation,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { createEarthquake } from './earthquake.js';
import { game } from './gstate.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO,
    MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_RESISTS,
    MONSTER_SIZE, MONSTER_SOUND, MONSTER_SYMBOL,
} from './monster_data.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { makeMonsterFlee } from './monster_flee.js';
import {
    BUGLE, DRUM_OF_EARTHQUAKE, FIRE_HORN, FROST_HORN, LEATHER_DRUM,
    MAGIC_FLUTE, MAGIC_HARP, OBJECT_NAMES, TOOLED_HORN, WOODEN_FLUTE,
    WOODEN_HARP,
} from './object_data.js';
import {
    recordObjectEncounter, recordObjectKnowledge,
} from './object_knowledge.js';
import { askForTune, playTune } from './passtune.js';
import { heroIsPolymorphed } from './polyself.js';
import { d, rnd, rn2 } from './rng.js';
import { promptYesNoQuit } from './query.js';
import { syncDeafness } from './senses.js';
import { promptKey } from './tty_prompts.js';
import { cansee } from './vision.js';
import {
    zapColdRay, zapFireRay, zapHeroWithCold, zapHeroWithFire,
} from './zap.js';

const G_UNIQ = 0x1000;
const M1_MINDLESS = 0x00010000;
const M1_BREATHLESS = 0x00000400;
const M1_NOHEAD = 0x00008000;
const M2_MERC = 0x00000200;
const MR_SLEEP = 0x04;
const S_NYMPH = 14;
const S_SNAKE = 45;
const PM_GUARD = 272;
const MS_SILENT = 0;
const MS_BUZZ = 1;
const MZ_TINY = 0;
const TOOL_ATTACK_LEVEL = 10;

export const PLAYABLE_INSTRUMENTS = new Set([
    WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN, FROST_HORN, FIRE_HORN,
    WOODEN_HARP, MAGIC_HARP, BUGLE, LEATHER_DRUM, DRUM_OF_EARTHQUAKE,
]);

const DRUMS = new Set([LEATHER_DRUM, DRUM_OF_EARTHQUAKE]);
const WIND_INSTRUMENTS = new Set([
    WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN, FROST_HORN, FIRE_HORN, BUGLE,
]);

function instrumentName(instrument) {
    return instrument.name || OBJECT_NAMES[instrument.otyp] || 'instrument';
}

function monsterDistance(monster) {
    const dx = (monster.mx ?? 0) - (game.u?.ux ?? 0);
    const dy = (monster.my ?? 0) - (game.u?.uy ?? 0);
    return dx * dx + dy * dy;
}

function liveMonsters() {
    // C prepends actors to fmon. This port appends them to the level array.
    return Array.from(game.level?.monsters || []).reverse().filter(
        monster => monster && (monster.mhp ?? 1) > 0,
    );
}

function monsterResistsInstrument(monster) {
    const defenseLevel = Math.max(1, Math.min(50, monster.m_lev || 1));
    const magicResistance = MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0;
    return rn2(100 + TOOL_ATTACK_LEVEL - defenseLevel) < magicResistance;
}

function instrumentCanScare(monster) {
    if (monster.iswiz || monster.is_lminion || monster.lawfulMinion
        || monster.isAngel || monster.isRider) return false;
    if (monster.isshk && monster.inShop) return false;
    if (monster.ispriest && monster.inTemple) return false;
    return true;
}

async function awakenMonster(monster, scary) {
    monster.msleeping = 0;
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    const waiting = (monster.mstrategy || 0) & STRAT_WAITMASK;
    const unique = (MONSTER_GENO[monster.mnum] || 0) & G_UNIQ;
    if (waiting && !unique) {
        monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        return;
    }
    if (!scary
        || ((MONSTER_FLAGS1[monster.mnum] || 0) & M1_MINDLESS)
        || monsterResistsInstrument(monster)
        || !instrumentCanScare(monster)) return;
    await makeMonsterFlee(monster, { publish: plineWithContinuation });
}

async function awakenMonsters(distance) {
    for (const monster of liveMonsters()) {
        const distanceFromHero = monsterDistance(monster);
        if (distanceFromHero >= distance) continue;
        await awakenMonster(monster, distanceFromHero < distance / 3);
    }
}

function improvisedNotes() {
    if ((game.u?.unchanging || game.unchanging) && game.context.jingle)
        return { notes: game.context.jingle, familiar: true };

    const noteNames = 'ABCDEFG';
    let notes = '';
    for (let count = rnd(5); count > 0; count--)
        notes += noteNames[rn2(noteNames.length)];
    game.context.jingle = notes;
    return { notes, familiar: false };
}

function heroIsDeaf() {
    return !!(game.deaf || (game.u?.deafTurns ?? 0) > 0);
}

function heroIsImpaired() {
    const hero = game.u || {};
    return !!(hero.stunned || (hero.stunnedTurns ?? 0) > 0
        || hero.confused || (hero.confusionTurns ?? 0) > 0);
}

function heroIsHallucinating() {
    return !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
}

function heroCanBlow() {
    const hero = game.u || {};
    if (hero.strangled || (hero.strangledTurns ?? 0) > 0) return false;
    if (!heroIsPolymorphed(game)) return true;

    const mnum = hero.umonnum;
    const flags = MONSTER_FLAGS1[mnum] || 0;
    const silentOrBuzzing = [MS_SILENT, MS_BUZZ].includes(
        MONSTER_SOUND[mnum],
    );
    const cannotMakeWind = (flags & (M1_BREATHLESS | M1_NOHEAD))
        || MONSTER_SIZE[mnum] === MZ_TINY
        || MONSTER_SYMBOL[mnum] === 57;
    return !silentOrBuzzing || !cannotMakeWind;
}

async function announceImprovisation(instrument) {
    const stunned = !!(game.u?.stunned
        || (game.u?.stunnedTurns ?? 0) > 0);
    const confused = !!(game.u?.confused
        || (game.u?.confusionTurns ?? 0) > 0);
    const hallucinating = heroIsHallucinating();
    let mode = Number(stunned) | (Number(confused) << 1)
        | (Number(hallucinating) << 2);

    if (rn2(2) === 0) {
        if (mode === 3) mode = rn2(2) === 0 ? 1 : 2;
        if (mode & 4) mode = 4;
    }

    if (mode === 0) {
        await plineWithContinuation(
            `You start playing your ${instrumentName(instrument)}.`,
        );
    } else if (mode === 1) {
        await plineWithContinuation(heroIsDeaf()
            ? 'You feel a monotonous vibration.'
            : 'You radiate an obnoxious droning sound.');
    } else if (mode === 2) {
        await plineWithContinuation(heroIsDeaf()
            ? 'You feel a jarring vibration.'
            : 'You generate a raucous noise.');
    } else if (mode === 4) {
        await plineWithContinuation(
            'You disseminate a kaleidoscopic display of floating butterflies.',
        );
    } else {
        await plineWithContinuation(
            'What you perform is quite far from music...',
        );
    }
}

function consumeCharge(instrument) {
    const current = Number.isInteger(instrument.spe)
        ? instrument.spe : instrument.charges?.current ?? 0;
    const remaining = Math.max(0, current - 1);
    instrument.spe = remaining;
    if (instrument.charges) instrument.charges.current = remaining;
}

async function putMonstersToSleep(distance) {
    for (const monster of liveMonsters()) {
        if (monsterDistance(monster) >= distance) continue;
        const duration = d(10, 10);
        const sleepResistant = !!((MONSTER_RESISTS[monster.mnum] || 0)
            & MR_SLEEP) || monster.defendedSleep;
        if (sleepResistant || monsterResistsInstrument(monster)
            || monster.mcanmove === 0) continue;
        monster.mcanmove = 0;
        monster.mfrozen = Math.min(
            duration + (monster.mfrozen || 0), 127,
        );
        monster.meating = 0;
    }
}

async function charmSnakes(distance) {
    for (const monster of liveMonsters()) {
        if (MONSTER_SYMBOL[monster.mnum] !== S_SNAKE
            || monster.mcanmove === 0
            || monsterDistance(monster) >= distance) continue;
        const wasPeaceful = !!monster.mpeaceful;
        const wasVisible = cansee(monster.mx, monster.my)
            && !monster.mundetected;
        monster.mpeaceful = 1;
        monster.mavenge = 0;
        monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        monster.mundetected = 0;
        newsym(monster.mx, monster.my);
        if (!cansee(monster.mx, monster.my)) continue;
        const name = MONSTER_NAME[monster.mnum] || 'snake';
        if (!wasVisible) {
            await plineWithContinuation(
                `You notice a ${name}, swaying with the music.`,
            );
        } else {
            await plineWithContinuation(
                `The ${name} freezes, then sways with the music${
                    wasPeaceful ? '' : ', and now seems quieter'
                }.`,
            );
        }
    }
}

async function calmNymphs(distance) {
    for (const monster of liveMonsters()) {
        if (MONSTER_SYMBOL[monster.mnum] !== S_NYMPH
            || monster.mcanmove === 0
            || monsterDistance(monster) >= distance) continue;
        monster.msleeping = 0;
        monster.mpeaceful = 1;
        monster.mavenge = 0;
        monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        if (cansee(monster.mx, monster.my)) {
            const name = MONSTER_NAME[monster.mnum] || 'nymph';
            await plineWithContinuation(
                `The ${name} listens cheerfully to the music, then seems quieter.`,
            );
        }
    }
}

async function awakenSoldiers(distance) {
    for (const monster of liveMonsters()) {
        const mercenary = (MONSTER_FLAGS2[monster.mnum] || 0) & M2_MERC;
        if (mercenary && monster.mnum !== PM_GUARD) {
            if (!monster.mtame) monster.mpeaceful = 0;
            monster.msleeping = 0;
            monster.mfrozen = 0;
            monster.mcanmove = 1;
            monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
            if (cansee(monster.mx, monster.my)) {
                const name = MONSTER_NAME[monster.mnum] || 'soldier';
                await plineWithContinuation(
                    `The ${name} is now ready for battle!`,
                );
            }
        } else if (monsterDistance(monster) < distance) {
            await awakenMonster(
                monster, monsterDistance(monster) < distance / 3,
            );
        }
    }
}

function charmMonsters(distance) {
    const effectiveDistance = game.u?.uswallow ? 0 : distance;
    for (const monster of liveMonsters()) {
        if (monsterDistance(monster) > effectiveDistance) continue;
        if (!monsterResistsInstrument(monster) || monster.isshk)
            tameMonster(monster);
    }
}

async function playMagicFlute(instrument, familiar) {
    consumeCharge(instrument);
    await plineWithContinuation(
        `You ${heroIsDeaf() ? 'seem to ' : ''}produce ${
            heroIsHallucinating() ? 'piped' : 'soft'
        }${familiar ? ', familiar' : ''} music.`,
    );
    await putMonstersToSleep((game.u?.ulevel || 1) * 5);
    exerciseAttribute(A_DEX, true);
}

async function playWoodenFlute(instrument, familiar, canUseSpecial) {
    const skilledRoll = rn2(Math.max(1, currentAttribute(A_DEX)))
        + (game.u?.ulevel || 1) > 25;
    const succeeds = canUseSpecial && skilledRoll;
    if (!heroIsDeaf()) {
        await plineWithContinuation(
            `Your ${instrumentName(instrument)} ${succeeds ? 'trills' : 'toots'}${
                familiar ? ' a familiar tune' : ''
            }.`,
        );
    } else {
        await plineWithContinuation(
            `You feel your ${instrumentName(instrument)} ${
                succeeds ? 'trill' : 'toot'
            }.`,
        );
    }
    if (succeeds) await charmSnakes((game.u?.ulevel || 1) * 3);
    exerciseAttribute(A_DEX, true);
}

async function playTooledHorn(familiar) {
    await plineWithContinuation(heroIsDeaf()
        ? 'You blow into the horn.'
        : `You produce a frightful, grave${
            familiar ? ', yet familiar,' : ''
        } sound.`);
    await awakenMonsters((game.u?.ulevel || 1) * 30);
    exerciseAttribute(A_WIS, false);
}

async function readHornDirection() {
    for (;;) {
        const key = await promptKey('In what direction? ');
        if (key === 27) return null;
        const direction = String.fromCharCode(key).toLowerCase();
        if ('hjklyubn.<>'.includes(direction)) return direction;
    }
}

function learnInstrumentType(instrument) {
    instrument.typeKnown = true;
    recordObjectKnowledge(instrument.otyp);
    recordObjectEncounter(instrument.otyp);
}

async function finishHornDeath(element, aimedAtSelf) {
    const reflexive = game.flags?.female ? 'herself' : 'himself';
    const killer = aimedAtSelf
        ? `using a magical horn on ${reflexive}`
        : `bolt of ${element}`;
    return await finishHeroDeath({ killer });
}

async function playElementalHorn(
    instrument,
    element,
    { finishMonsterKill } = {},
) {
    consumeCharge(instrument);
    const direction = await readHornDirection();
    game._pending_message = '';
    if (direction === null) {
        await pline(`The ${instrumentName(instrument)} vibrates.`);
        learnInstrumentType(instrument);
        return;
    }

    let result;
    if (direction === '.') {
        result = element === 'fire'
            ? await zapHeroWithFire() : await zapHeroWithCold();
    } else if ('hjklyubn'.includes(direction)) {
        if (!(game.blind || (game.u?.blindTurns ?? 0) > 0)) {
            await plineWithContinuation(
                `A bolt of ${element} blasts out of the horn!`,
            );
        }
        const options = {
            finishMonsterKill,
            exerciseWisdom: false,
        };
        if (element === 'fire') {
            result = await zapFireRay(direction, {
                ...options,
                wakeMonsters: wakeMonstersNearWithMessages,
            });
        } else {
            result = await zapColdRay(direction, options);
        }
    } else {
        await pline(`The ${instrumentName(instrument)} vibrates.`);
        result = { heroDied: false };
    }

    learnInstrumentType(instrument);
    if (result?.heroDied)
        await finishHornDeath(element, direction === '.');
}

async function playBugle(instrument, familiar) {
    await plineWithContinuation(heroIsDeaf()
        ? 'You blow into the bugle.'
        : `You extract a loud${familiar ? ', familiar' : ''} noise from your ${
            instrumentName(instrument)
        }.`);
    await awakenSoldiers((game.u?.ulevel || 1) * 30);
    exerciseAttribute(A_WIS, false);
}

async function playMagicHarp(instrument, familiar) {
    consumeCharge(instrument);
    await plineWithContinuation(heroIsDeaf()
        ? 'You feel very soothing vibrations.'
        : `Your ${instrumentName(instrument)} produces very attractive${
            familiar ? ' and familiar' : ''
        } music.`);
    charmMonsters(Math.trunc(((game.u?.ulevel || 1) - 1) / 3) + 1);
    exerciseAttribute(A_DEX, true);
}

async function playWoodenHarp(instrument, familiar, canUseSpecial) {
    const skilledRoll = rn2(Math.max(1, currentAttribute(A_DEX)))
        + (game.u?.ulevel || 1) > 25;
    const succeeds = canUseSpecial && skilledRoll;
    if (heroIsDeaf()) {
        await plineWithContinuation('You feel soothing vibrations.');
    } else {
        const action = succeeds
            ? `produces a ${familiar ? 'familiar, ' : ''}lilting melody`
            : `twangs${familiar ? ' a familiar tune' : ''}`;
        await plineWithContinuation(
            `Your ${instrumentName(instrument)} ${action}.`,
        );
    }
    if (succeeds) await calmNymphs((game.u?.ulevel || 1) * 3);
    exerciseAttribute(A_DEX, true);
}

const DRUM_BEATS = [
    'stepper', 'one drop', 'slow two', 'triple stroke roll',
    'double shuffle', 'half-time shuffle', 'second line', 'train',
];

async function playLeatherDrum(familiar, mundane = false) {
    if (mundane) {
        const verb = rn2(2) ? 'butcher' : rn2(2) ? 'manage' : 'pull off';
        const beat = DRUM_BEATS[rn2(DRUM_BEATS.length)];
        await plineWithContinuation(`You ${verb} a ${beat}.`);
        await awakenMonsters((game.u?.ulevel || 1) * 5);
        return;
    }
    if (!heroIsDeaf()) {
        await plineWithContinuation(
            `You beat a ${familiar ? 'familiar ' : ''}deafening row!`,
        );
        game.u.deafTurns = (game.u.deafTurns ?? 0) + rn2(20) + 30;
        syncDeafness(game);
        game._statusDeafOverride = false;
    } else {
        await plineWithContinuation('You pound on the drum.');
    }
    exerciseAttribute(A_WIS, false);
    try {
        await awakenMonsters((game.u?.ulevel || 1) * 40);
    } finally {
        delete game._statusDeafOverride;
    }
}

function levelDescription() {
    const here = game.u?.uz;
    if (Is_astralevel(here)) return 'astral plane';
    if (In_endgame(here)) return 'plane';
    if (game.sanctum_level
        && here?.dnum === game.sanctum_level.dnum
        && here?.dlevel === game.sanctum_level.dlevel) return 'sanctum';
    if (In_sokoban(here)) return 'puzzle';
    if (In_V_tower(here)) return 'tower';
    return 'dungeon';
}

async function playEarthquakeDrum(instrument, options) {
    consumeCharge(instrument);
    await plineWithContinuation('You produce a heavy, thunderous rolling!');
    await plineWithContinuation(
        `The entire ${levelDescription()} is shaking around you!`,
    );
    const force = Math.trunc(((game.u?.ulevel || 1) - 1) / 3) + 1;
    await createEarthquake(force, options);
    await awakenMonsters(ROWNO * COLNO);
    learnInstrumentType(instrument);
}

async function improvise(instrument, options) {
    const canUseSpecial = !heroIsImpaired();
    let effectiveType = instrument.otyp;
    let mundaneDrum = false;
    const charges = instrument.spe ?? instrument.charges?.current ?? 0;
    if (!canUseSpecial || charges <= 0) {
        if (effectiveType === MAGIC_FLUTE) effectiveType = WOODEN_FLUTE;
        if (effectiveType === MAGIC_HARP) effectiveType = WOODEN_HARP;
        if (effectiveType === FIRE_HORN || effectiveType === FROST_HORN)
            effectiveType = TOOLED_HORN;
        if (effectiveType === DRUM_OF_EARTHQUAKE) {
            effectiveType = LEATHER_DRUM;
            mundaneDrum = true;
        }
    }

    await announceImprovisation(instrument);
    const { familiar } = improvisedNotes();
    if (effectiveType === MAGIC_FLUTE)
        await playMagicFlute(instrument, familiar);
    else if (effectiveType === WOODEN_FLUTE)
        await playWoodenFlute(instrument, familiar, canUseSpecial);
    else if (effectiveType === TOOLED_HORN)
        await playTooledHorn(familiar);
    else if (effectiveType === FIRE_HORN)
        await playElementalHorn(instrument, 'fire', options);
    else if (effectiveType === FROST_HORN)
        await playElementalHorn(instrument, 'cold', options);
    else if (effectiveType === DRUM_OF_EARTHQUAKE)
        await playEarthquakeDrum(instrument, options);
    else if (effectiveType === BUGLE)
        await playBugle(instrument, familiar);
    else if (effectiveType === MAGIC_HARP)
        await playMagicHarp(instrument, familiar);
    else if (effectiveType === WOODEN_HARP)
        await playWoodenHarp(instrument, familiar, canUseSpecial);
    else if (effectiveType === LEATHER_DRUM)
        await playLeatherDrum(familiar, mundaneDrum);
    else
        throw new RangeError(`unsupported instrument ${instrument.otyp}`);
    game.context.move = 1;
}

export async function playInstrument(instrument, options = {}) {
    if (game.underwater || game.u?.uinwater) {
        await pline("You can't play music underwater!");
        game.context.move = 0;
        return;
    }
    if (WIND_INSTRUMENTS.has(instrument.otyp) && !heroCanBlow()) {
        await pline(
            `You are incapable of playing the ${instrumentName(instrument)}.`,
        );
        game.context.move = 0;
        return;
    }

    const unimpaired = !heroIsImpaired() && !heroIsHallucinating();
    if (!DRUMS.has(instrument.otyp) && unimpaired) {
        const answer = await promptYesNoQuit(
            'Improvise? [ynq] (q) ', 'q',
        );
        if (answer === 'q') {
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        if (answer === 'n') {
            const tune = await askForTune();
            if (tune === null) {
                await pline('Never mind.');
                game.context.move = 0;
                return;
            }
            await playTune(instrument, tune, options);
            return;
        }
    }
    await improvise(instrument, options);
}
