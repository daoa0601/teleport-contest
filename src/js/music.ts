// Musical instruments and their effects.
// C ref: music.c.

import { heroIsHallucinating } from './senses.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import {
    A_DEX, A_WIS, COLNO, In_endgame, In_sokoban, In_V_tower,
    Is_astralevel, ROWNO, STRAT_WAITMASK,
} from './const.js';
import { tameMonster } from './monster_taming.js';
import {
    canSeeMonster, newsym, pline, plineWithContinuation,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { createEarthquake } from './earthquake.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO,
    MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_RESISTS,
    MONSTER_SYMBOL,
} from './monster_data.js';
import { monsterName } from './monster_name.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { makeMonsterFlee } from './monster_flee.js';
import { monsterIsScaredAt } from './monster_fear.js';
import {
    BUGLE, DRUM_OF_EARTHQUAKE, FIRE_HORN, FROST_HORN, LEATHER_DRUM,
    MAGIC_FLUTE, MAGIC_HARP, OBJECT_NAMES, TOOLED_HORN, WOODEN_FLUTE,
    WOODEN_HARP,
} from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { askForTune, playTune } from './passtune.js';
import { heroCanBlow } from './hero_species.js';
import { d, rnd, rn2 } from './rng.js';
import { promptYesNoQuit } from './query.js';
import { syncDeafness } from './senses.js';
import { promptDirection } from './tty_prompts.js';
import { cansee } from './vision.js';
import { zapRayWithObject } from './zap.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';

export type InstrumentOptions = NonNullable<Parameters<typeof playTune>[2]>;
type InstrumentEffectResult = { heroDied: boolean } | void;

const G_UNIQ = 0x1000;
const M1_MINDLESS = 0x00010000;
const M2_MERC = 0x00000200;
const MR_SLEEP = 0x04;
const S_NYMPH = 14;
const S_SNAKE = 45;
const PM_GUARD = 272;
const TOOL_ATTACK_LEVEL = 10;

export const PLAYABLE_INSTRUMENTS = new Set([
    WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN, FROST_HORN, FIRE_HORN,
    WOODEN_HARP, MAGIC_HARP, BUGLE, LEATHER_DRUM, DRUM_OF_EARTHQUAKE,
]);

const DRUMS = new Set([LEATHER_DRUM, DRUM_OF_EARTHQUAKE]);
const WIND_INSTRUMENTS = new Set([
    WOODEN_FLUTE, MAGIC_FLUTE, TOOLED_HORN, FROST_HORN, FIRE_HORN, BUGLE,
]);

function instrumentName(instrument: GameObject) {
    return instrument.name || OBJECT_NAMES[instrument.otyp] || 'instrument';
}

function monsterDistance(monster: Monster) {
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

function monsterResistsInstrument(monster: Monster) {
    const defenseLevel = Math.max(1, Math.min(50, monster.m_lev || 1));
    const magicResistance = MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0;
    return rn2(100 + TOOL_ATTACK_LEVEL - defenseLevel) < magicResistance;
}

function instrumentCanScare(monster: Monster) {
    return monsterIsScaredAt(monster, game, 0, 0);
}

async function awakenMonster(monster: Monster, scary: boolean): Promise<InstrumentEffectResult> {
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
    return makeMonsterFlee(monster, { publish: plineWithContinuation });
}

async function awakenMonsters(distance: number): Promise<InstrumentEffectResult> {
    for (const monster of liveMonsters()) {
        const distanceFromHero = monsterDistance(monster);
        if (distanceFromHero >= distance) continue;
        const flight = await awakenMonster(monster, distanceFromHero < distance / 3);
        if (flight?.heroDied) return flight;
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
    const hero = game.u;
    return !!(hero.stunned || (hero.stunnedTurns ?? 0) > 0
        || hero.confused || (hero.confusionTurns ?? 0) > 0);
}



async function announceImprovisation(instrument: GameObject) {
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

async function putMonstersToSleep(distance: number) {
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

async function charmSnakes(distance: number) {
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

async function calmNymphs(distance: number) {
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

export async function awakenSoldiers(distance: number, bugler: Monster | null = null): Promise<InstrumentEffectResult> {
    for (const monster of liveMonsters()) {
        const dist = bugler ? (bugler.mx - monster.mx) ** 2 + (bugler.my - monster.my) ** 2 : monsterDistance(monster);
        const mercenary = (MONSTER_FLAGS2[monster.mnum] || 0) & M2_MERC;
        if (mercenary && monster.mnum !== PM_GUARD) {
            if (!monster.mtame) monster.mpeaceful = 0;
            monster.msleeping = 0;
            monster.mfrozen = 0;
            monster.mcanmove = 1;
            monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
            if (canSeeMonster(monster)) {
                const name = monsterName(monster, { capitalized: true });
                await plineWithContinuation(
                    `${name} is now ready for battle!`,
                );
            } else if (!heroIsDeaf()) {
                await plineWithContinuation('You hear the rattle of battle gear being readied.', { noRepeat: true });
            }
        } else if (dist < distance) {
            const flight = await awakenMonster(
                monster, dist < distance / 3,
            );
            if (flight?.heroDied) return flight;
        }
    }
}

async function charmMonsters(distance: number) {
    const effectiveDistance = game.u?.uswallow ? 0 : distance;
    for (const monster of liveMonsters()) {
        if (monsterDistance(monster) > effectiveDistance) continue;
        if (!monsterResistsInstrument(monster) || monster.isshk)
            await tameMonster(monster, null, { announce: true });
    }
}

async function playMagicFlute(instrument: GameObject, familiar: boolean) {
    instrument.spe--;
    await plineWithContinuation(
        `You ${heroIsDeaf() ? 'seem to ' : ''}produce ${
            heroIsHallucinating() ? 'piped' : 'soft'
        }${familiar ? ', familiar' : ''} music.`,
    );
    await putMonstersToSleep((game.u?.ulevel || 1) * 5);
    await exerciseAttribute(A_DEX, true);
}

async function playWoodenFlute(instrument: GameObject, familiar: boolean, canUseSpecial: boolean) {
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
    await exerciseAttribute(A_DEX, true);
}

async function playTooledHorn(familiar: boolean): Promise<InstrumentEffectResult> {
    await plineWithContinuation(heroIsDeaf()
        ? 'You blow into the horn.'
        : `You produce a frightful, grave${
            familiar ? ', yet familiar,' : ''
        } sound.`);
    const flight = await awakenMonsters((game.u?.ulevel || 1) * 30);
    if (flight?.heroDied) return flight;
    await exerciseAttribute(A_WIS, false);
}

async function readHornDirection() {
    const direction = await promptDirection();
    if (!direction) return null;
    if (direction.dz) return direction.dz < 0 ? '<' : '>';
    const directions: Array<readonly [string, number, number]> = [
        ['y', -1, -1], ['k', 0, -1], ['u', 1, -1],
        ['h', -1, 0], ['.', 0, 0], ['l', 1, 0],
        ['b', -1, 1], ['j', 0, 1], ['n', 1, 1]];
    const selected = directions.find(([, dx, dy]) => dx === direction.dx && dy === direction.dy);
    if (!selected) throw new RangeError('The horn direction is outside the adjacent squares.');
    return selected[0];
}

function learnInstrumentType(instrument: GameObject) {
    learnObjectType(instrument.otyp);
    instrument.typeKnown = true;
}

async function playElementalHorn(
    instrument: GameObject,
    element: 'fire' | 'cold',
): Promise<InstrumentEffectResult> {
    instrument.spe--;
    const direction = await readHornDirection();
    if (direction === null) {
        await plineWithContinuation(`The ${instrumentName(instrument)} vibrates.`);
        return;
    }

    let result;
    if (direction === '.') {
        result = await zapHeroWithObject(instrument);
        if (result.heroDied) return result;
        if (result.damage) {
            const cause = `using a magical horn on ${game.flags.female ? 'herself' : 'himself'}`;
            if (await loseHeroHp(result.damage, cause)) return { heroDied: true };
        }
    } else {
        if (!(game.blind || (game.u?.blindTurns ?? 0) > 0)) {
            await plineWithContinuation(`A bolt of ${element} blasts out of the horn!`);
        }
        result = await zapRayWithObject(instrument);
    }

    if (game.program_state.gameover) return { heroDied: true };
    if (result?.heroDied && await finishHeroDeath({ killer: `bolt of ${element}` }))
        return { heroDied: true };
    learnInstrumentType(instrument);
    return { heroDied: false };
}

async function playBugle(instrument: GameObject, familiar: boolean): Promise<InstrumentEffectResult> {
    await plineWithContinuation(heroIsDeaf()
        ? 'You blow into the bugle.'
        : `You extract a loud${familiar ? ', familiar' : ''} noise from your ${
            instrumentName(instrument)
        }.`);
    const flight = await awakenSoldiers((game.u?.ulevel || 1) * 30);
    if (flight?.heroDied) return flight;
    await exerciseAttribute(A_WIS, false);
}

async function playMagicHarp(instrument: GameObject, familiar: boolean) {
    instrument.spe--;
    await plineWithContinuation(heroIsDeaf()
        ? 'You feel very soothing vibrations.'
        : `Your ${instrumentName(instrument)} produces very attractive${
            familiar ? ' and familiar' : ''
        } music.`);
    await charmMonsters(Math.trunc(((game.u?.ulevel || 1) - 1) / 3) + 1);
    await exerciseAttribute(A_DEX, true);
}

async function playWoodenHarp(instrument: GameObject, familiar: boolean, canUseSpecial: boolean) {
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
    await exerciseAttribute(A_DEX, true);
}

const DRUM_BEATS = [
    'stepper', 'one drop', 'slow two', 'triple stroke roll',
    'double shuffle', 'half-time shuffle', 'second line', 'train',
];

async function playLeatherDrum(familiar: boolean, mundane = false): Promise<InstrumentEffectResult> {
    if (mundane) {
        const verb = rn2(2) ? 'butcher' : rn2(2) ? 'manage' : 'pull off';
        const beat = DRUM_BEATS[rn2(DRUM_BEATS.length)];
        await plineWithContinuation(`You ${verb} a ${beat}.`);
        const result = await awakenMonsters((game.u?.ulevel || 1) * 5);
        game.context.botl = true;
        return result;
    }
    if (!heroIsDeaf()) {
        await plineWithContinuation(
            `You beat a ${familiar ? 'familiar ' : ''}deafening row!`,
        );
        game.u.deafTurns = (game.u.deafTurns ?? 0) + rn2(20) + 30;
        syncDeafness(game);
    } else {
        await plineWithContinuation('You pound on the drum.');
    }
    await exerciseAttribute(A_WIS, false);
    const result = await awakenMonsters((game.u?.ulevel || 1) * 40);
    game.context.botl = true;
    return result;
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

async function playEarthquakeDrum(instrument: GameObject): Promise<InstrumentEffectResult> {
    instrument.spe--;
    await plineWithContinuation('You produce a heavy, thunderous rolling!');
    await plineWithContinuation(
        `The entire ${levelDescription()} is shaking around you!`,
    );
    const force = Math.trunc(((game.u?.ulevel || 1) - 1) / 3) + 1;
    const earthquake = await createEarthquake(force);
    if (earthquake.heroDied) return earthquake;
    const flight = await awakenMonsters(ROWNO * COLNO);
    if (flight?.heroDied) return flight;
    learnInstrumentType(instrument);
}

async function improvise(instrument: GameObject) {
    const canUseSpecial = !heroIsImpaired();
    let effectiveType = instrument.otyp;
    let mundaneDrum = false;
    const charges = instrument.spe;
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
    let performance: InstrumentEffectResult;
    if (effectiveType === MAGIC_FLUTE)
        performance = await playMagicFlute(instrument, familiar);
    else if (effectiveType === WOODEN_FLUTE)
        performance = await playWoodenFlute(instrument, familiar, canUseSpecial);
    else if (effectiveType === TOOLED_HORN)
        performance = await playTooledHorn(familiar);
    else if (effectiveType === FIRE_HORN)
        performance = await playElementalHorn(instrument, 'fire');
    else if (effectiveType === FROST_HORN)
        performance = await playElementalHorn(instrument, 'cold');
    else if (effectiveType === DRUM_OF_EARTHQUAKE)
        performance = await playEarthquakeDrum(instrument);
    else if (effectiveType === BUGLE)
        performance = await playBugle(instrument, familiar);
    else if (effectiveType === MAGIC_HARP)
        performance = await playMagicHarp(instrument, familiar);
    else if (effectiveType === WOODEN_HARP)
        performance = await playWoodenHarp(instrument, familiar, canUseSpecial);
    else if (effectiveType === LEATHER_DRUM)
        performance = await playLeatherDrum(familiar, mundaneDrum);
    else
        throw new RangeError(`unsupported instrument ${instrument.otyp}`);
    if (performance?.heroDied) return;
    game.context.move = 1;
}

export async function playInstrument(instrument: GameObject, options: InstrumentOptions = {}) {
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
            'Improvise?', 'q',
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
    await improvise(instrument);
}
