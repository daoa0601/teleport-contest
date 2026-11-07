// Musical instruments and their effects: the instrument cases and the
// earthquake they can shake loose.
// C ref: music.c, notably do_pit() and do_earthquake().

import { heroIsBlind, heroIsDeaf, heroIsHallucinating, syncDeafness } from './senses.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import {

    A_DEX,

    A_WIS,

    ALTAR, AM_MASK, AM_SANCTUM, Amask2align,

    COLNO, CORR,

    DOOR, D_NODOOR,

    FOUNTAIN,

    GRAVE,

    In_endgame,

    In_sokoban,

    Is_astralevel,

    KILLED_BY, NO_KILLER_PREFIX,

    LAVAPOOL,

    M_AP_FURNITURE,

    M_AP_OBJECT,

    M_AP_TYPE, MGIVENNAME,

    PIT, ROOM,

    ROWNO,

    SCORR, SDOOR, SHOPBASE, SINK,

    STRAT_WAITMASK,

    THRONE, TT_BURIEDBALL, TT_PIT,

    is_pit,

} from './const.js';
import { In_V_tower } from './dungeon.js';
import { canSeeMonster, newsym, shieldeff } from './display.js';
import { formatFeltMessage, pline, plineWithContinuation, publishHeardMessage } from './pline.js';
import { finishHeroDeath } from './end.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { zapHeroWithObject, monsterResistsEffect, zapRayWithObject } from './zap.js';
import { MONSTER_GENO, MONSTER_SYMBOL } from './monster_data.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import {
    revealMonsterAppearance, finishMonsterLiquidDeath, resolveMonsterLiquid, wakeMonster,
    finishHeroLiquidMonsterDeath, finishHeroMonsterKill,
} from './mon.js';
import type { MonsterLiquidDeathContext, MonsterLiquidDeathResult, HeroLiquidMonsterDeathOutcome, HeroMonsterKillOptions } from './mon.js';
import { displayRayName } from './zap.js';
import { AD_COLD, AD_FIRE } from './monster_attack_types.js';
import { monsterResistsSleep, is_mercenary, monsterIsMindless, heroCanBlow, monsterIsClinger, monsterIsFlyer, monsterIsHumanoid, monsterIsSlithy, monsterSpeciesHidesOnCeiling } from './mondata.js';
import { putMonsterToSleep, sleptMonst } from './mhitm.js';
import { makeMonsterFlee, monsterIsScaredAt } from './monmove.js';
import {
    BUGLE, DRUM_OF_EARTHQUAKE, FIRE_HORN, FROST_HORN, LEATHER_DRUM,
    MAGIC_FLUTE, MAGIC_HARP, TOOLED_HORN, WOODEN_FLUTE,
    WOODEN_HARP, BOULDER,
} from './object_data.js';
import { learnObjectType } from './o_init.js';
import { consumeObjectCharge } from './invent.js';
import {
    definiteObjectAction,
    definiteName, ownedObjectName, simpleObjectName,
} from './objnam.js';
import { askForTune, playTune } from './passtune.js';
import { heroFormSticks, heroHasNoLimbs, heroIsPolymorphed } from './polyself.js';
import { d, rnl, rnd, rn2 } from './rng.js';
import { promptYesNoQuit } from './query.js';
import { promptDirection } from './cmd.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Trap } from './map_types.js';
import { tameMonster } from './dog.js';
import { heroLiquidEffects, loseHeroHp, roomsAt, finishDestinationSpotEffects } from './hack.js';
import { monsterAtPosition } from './steed.js';
import { altarmaskAt, desecrateAltar } from './pray.js';
import { liquidForHole, unearthFloorObjectsAt } from './dig.js';
import {remove_object, updateIceObjectTimersAt} from './mkobj.js';
import { applyFloorEffects } from './do.js';
import {
    monsterSelfTouch, trapAt, waterDamageChain, fireDamageChain, setHeroTrap, resetUtrap, maketrap,
    deleteFloorTrap, selfTouchPetrifyingWeapons,
} from './trap.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { convertSecretDoor } from './detect.js';
import { addShopDamage } from './shk.js';

export type InstrumentOptions = NonNullable<Parameters<typeof playTune>[2]>;
type InstrumentEffectResult = { heroDied: boolean } | void;

const G_UNIQ = 0x1000;

const S_MIMIC = 13;
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

// Part of C music.c:awaken_monsters(), put_monsters_to_sleep(),
// charm_snakes(), calm_nymphs(), charm_monsters(), awaken_soldiers(): the
// mdistu squared-distance test.
function monsterDistance(monster: Monster) {
    const dx = (monster.mx ?? 0) - (game.u?.ux ?? 0);
    const dy = (monster.my ?? 0) - (game.u?.uy ?? 0);
    return dx * dx + dy * dy;
}

// Part of C music.c:awaken_monsters(), put_monsters_to_sleep(),
// charm_snakes(), calm_nymphs(), charm_monsters(), awaken_soldiers(): the
// fmon traversal order.
function liveMonsters() {
    // C prepends actors to fmon. This port appends them to the level array.
    return Array.from(game.level?.monsters || []).reverse().filter(
        monster => monster && (monster.mhp ?? 1) > 0,
    );
}

// Part of C music.c:awaken_scare(), put_monsters_to_sleep(),
// charm_monsters(): the resist TOOL_CLASS test.
function monsterResistsInstrument(monster: Monster) {
    return monsterResistsEffect(monster, TOOL_ATTACK_LEVEL);
}

// Part of C music.c:awaken_scare(): the onscary immunity test.
function instrumentCanScare(monster: Monster) {
    return monsterIsScaredAt(monster, game, 0, 0);
}

// C music.c:awaken_scare().
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
        || monsterIsMindless(monster.mnum)
        || monsterResistsInstrument(monster)
        || !instrumentCanScare(monster)) return;
    return makeMonsterFlee(monster, { publish: plineWithContinuation });
}

// C music.c:awaken_monsters(): wake and maybe scare every monster in
// range.
async function awakenMonsters(distance: number): Promise<InstrumentEffectResult> {
    for (const monster of liveMonsters()) {
        const distanceFromHero = monsterDistance(monster);
        if (distanceFromHero >= distance) continue;
        const flight = await awakenMonster(monster, distanceFromHero < Math.trunc(distance / 3));
        if (flight?.heroDied) return flight;
    }
}

// C music.c:improvised_notes(): the improvised jingle, remembered while
// unchanging.
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

// Part of C music.c:do_improvisation(), do_play_instrument(): the
// Stunned-or-Confusion impairment test.
function heroIsImpaired() {
    const hero = game.u;
    return !!(hero.stunned || (hero.stunnedTurns ?? 0) > 0
        || hero.confused || (hero.confusionTurns ?? 0) > 0);
}

// Part of C music.c:do_improvisation(): the impairment-mode performance
// message.
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
            `You start playing ${ownedObjectName(instrument, game, { capitalized: false })}.`,
        );
    } else if (mode === 1) {
        await plineWithContinuation(heroIsDeaf()
            ? formatFeltMessage('a monotonous vibration.')
            : 'You radiate an obnoxious droning sound.');
    } else if (mode === 2) {
        await plineWithContinuation(heroIsDeaf()
            ? formatFeltMessage('a jarring vibration.')
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

// C music.c:put_monsters_to_sleep(): sleep monsters in range that do not
// resist.
async function putMonstersToSleep(distance: number) {
    for (const monster of liveMonsters()) {
        if (monsterDistance(monster) >= distance) continue;
        const duration = d(10, 10);
        if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            && !monster.msleeping && !monster.mfrozen
            && [M_AP_FURNITURE, M_AP_OBJECT].includes(M_AP_TYPE(monster)))
            await revealMonsterAppearance(monster);
        if (monsterResistsSleep(monster) || monsterResistsInstrument(monster)) {
            await shieldeff(monster.mx, monster.my);
            continue;
        }
        if (!await putMonsterToSleep(monster, duration)) continue;
        monster.msleeping = 1;
        // C mhitm.c:slept_monst(): a sleeping grabber releases the hero.
        await sleptMonst(monster);
    }
}

// C music.c:charm_snakes(): snakes in range sway with the music.
async function charmSnakes(distance: number) {
    for (const monster of liveMonsters()) {
        if (MONSTER_SYMBOL[monster.mnum] !== S_SNAKE
            || !monster.mcanmove
            || monsterDistance(monster) >= distance) continue;
        const wasPeaceful = !!monster.mpeaceful;
        const wasVisible = canSeeMonster(monster);
        monster.mpeaceful = 1;
        monster.mavenge = 0;
        monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
        if (!canSeeMonster(monster)) continue;
        if (!wasVisible) {
            await plineWithContinuation(
                `You notice ${monsterName(monster, { article: 'a' })}, swaying with the music.`,
            );
        } else {
            await plineWithContinuation(
                `${monsterName(monster, { capitalized: true })} freezes, then sways with the music${
                    wasPeaceful ? '' : ', and now seems quieter'
                }.`,
            );
        }
    }
}

// C music.c:calm_nymphs(): nymphs in range turn peaceful.
async function calmNymphs(distance: number) {
    for (const monster of liveMonsters()) {
        if (MONSTER_SYMBOL[monster.mnum] !== S_NYMPH
            || !monster.mcanmove
            || monsterDistance(monster) >= distance) continue;
        monster.msleeping = 0;
        monster.mpeaceful = 1;
        monster.mavenge = 0;
        monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
        if (canSeeMonster(monster)) {
            await plineWithContinuation(
                `${monsterName(monster, { capitalized: true })} listens cheerfully to the music, then seems quieter.`,
            );
        }
    }
}

// C music.c:awaken_soldiers(): mercenaries ready for battle, others
// flee the bugle.
export async function awakenSoldiers(distance: number, bugler: Monster | null = null): Promise<InstrumentEffectResult> {
    for (const monster of liveMonsters()) {
        const dist = bugler ? (bugler.mx - monster.mx) ** 2 + (bugler.my - monster.my) ** 2 : monsterDistance(monster);
        const mercenary = is_mercenary(monster.mnum);
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
                monster, dist < Math.trunc(distance / 3),
            );
            if (flight?.heroDied) return flight;
        }
    }
}

// C music.c:charm_monsters(): tame monsters in range that do not
// resist.
async function charmMonsters(distance: number) {
    const effectiveDistance = game.u?.uswallow ? 0 : distance;
    for (const monster of liveMonsters()) {
        if (monsterDistance(monster) > effectiveDistance) continue;
        if (!monsterResistsInstrument(monster) || monster.isshk)
            await tameMonster(monster, null, { announce: true });
    }
}

// Part of C music.c:do_pit(), music.c:do_earthquake(): m_at() lookup.
function monsterAt(x: number, y: number) {
    return game.level ? monsterAtPosition(game.level, x, y) : null;
}

// Part of C music.c:do_pit(): sobj_at(BOULDER, x, y) lookup.
function boulderAt(x: number, y: number) {
    return game.level?.objects?.[x]?.[y]?.find(
        object => object.otyp === BOULDER,
    ) || null;
}

// Part of C music.c:do_pit(): KADOOM branch, boulder fills the new chasm.
async function fillChasmWithBoulder(x: number, y: number, boulder: GameObject, monster: Monster | null): Promise<void> {
    if (cansee(x, y)) {
        await plineWithContinuation(
            `KADOOM!  The boulder falls into a chasm${
                game.u?.ux === x && game.u?.uy === y ? ' below you' : ''
            }!`,
        );
    }
    if (monster) monster.mtrapped = 0;
    remove_object(boulder);
    await applyFloorEffects(boulder, x, y);
}

// Part of C dig.c:liquid_flow(): the water_damage_chain() branch.
async function damageFloorObjectsWithWater(x: number, y: number) {
    const pile = game.level?.objects?.[x]?.[y] || [];
    const messages: string[] = [];
    await waterDamageChain(pile, messages, game);
    if (cansee(x, y)) {
        for (const message of messages)
            await plineWithContinuation(message);
    }
}

// Part of C dig.c:liquid_flow(): earthquake caller; terrain type set here.
async function flowLiquidIntoChasm(x: number, y: number, trap: Trap, liquid: number, monster: Monster | null): Promise<void> {
    const location = requireGameLevel(game).at(x, y);
    if (!location) throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    location.typ = liquid;
    location.flags = 0;
    if (liquid === LAVAPOOL) location.lit = true;
    await deleteFloorTrap(trap);
    updateIceObjectTimersAt(x, y, game);
    await unearthFloorObjectsAt(x, y, game);
    if (liquid === LAVAPOOL) {
        await fireDamageChain(
            game.level?.objects?.[x]?.[y] || [],
            {
                state: game, x, y, force: true,
                publish: plineWithContinuation,
            },
        );
    } else {
        await damageFloorObjectsWithWater(x, y);
    }

    if (game.u?.ux === x && game.u?.uy === y) {
        const liquidEffect = await heroLiquidEffects({
            applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
                oldx: from.x, oldy: from.y, newx: to.x, newy: to.y, pick,
            }),
        });
        if (liquidEffect?.died) return;
    } else if (monster) {
        await resolveMonsterLiquid<HeroLiquidMonsterDeathOutcome | MonsterLiquidDeathResult>(monster, game, {
            announce: plineWithContinuation,
            finishDeath: finishEarthquakeLiquidDeath,
            monsterMoving: false,
        });
    }
    await newsym(x, y);
}

// Port only: death-finisher hook for the minliquid() call in liquid_flow().
function finishEarthquakeLiquidDeath(
    monster: Monster, options: MonsterLiquidDeathContext,
) {
    if (options.cause === 'drowning' || options.cause === 'lava-burning') {
        return finishHeroLiquidMonsterDeath(monster, options);
    }
    return finishMonsterLiquidDeath(monster, options);
}

// Part of C music.c:do_pit(): is_clinger(youmonst.data) test.
function heroClingsToCeiling() {
    if (!heroIsPolymorphed(game)) return false;
    return monsterIsClinger(game.u.umonnum ?? -1);
}

// Part of C music.c:do_pit(): Levitation || Flying || clinger test.
function heroIsAirborne() {
    const hero = game.u;
    return !!(hero.levitating || hero.levitation || game.levitating
        || hero.flying || game.flying
        || heroClingsToCeiling());
}

// Part of C music.c:do_pit(): set_utrap(rn1(6, 2), TT_PIT).
function trapHeroInChasm() {
    setHeroTrap(rn2(6) + 2, TT_PIT);
}

// Part of C music.c:do_pit(): Maybe_Half_Phys() halving of the fall damage.
function physicalDamage(amount: number): number {
    const halfDamage = game.u.halfPhysicalDamage;
    return halfDamage ? Math.trunc((amount + 1) / 2) : amount;
}

// Part of C music.c:do_pit(): hero branch — chain break, airborne, fall, jostled.
async function dropHeroIntoChasm(hadPitBeforeEarthquake: boolean): Promise<void> {
    if (game.u?.utrap && game.u.utraptype === TT_BURIEDBALL) {
        await plineWithContinuation('Your chain breaks!');
        await resetUtrap(true);
    }
    if (heroIsAirborne()) {
        if (!hadPitBeforeEarthquake) {
            await plineWithContinuation('A chasm opens up under you!');
            await plineWithContinuation("You don't fall in!");
        }
        return;
    }

    if (!hadPitBeforeEarthquake
        || !game.u?.utrap || game.u.utraptype !== TT_PIT) {
        await plineWithContinuation('You fall into a chasm!');
        trapHeroInChasm();
        if (await loseHeroHp(physicalDamage(rnd(6)), 'fell into a chasm', {
            deathCause: 'fell into a chasm',
            killerFormat: NO_KILLER_PREFIX,
        })) return;
        await selfTouchPetrifyingWeapons({ messageStart: 'Falling, you' });
        return;
    }

    const fumbling = !!(game.u?.fumbling
        || (game.u?.fumblingTurns ?? 0) > 0);
    const roleRange = game.urole?.key === 'archeologist' ? 3 : 9;
    const keepsFooting = !(fumbling && rn2(5))
        && (rnl(roleRange) === 0
            || (currentAttribute(A_DEX) > 7 && rn2(5) !== 0));
    await plineWithContinuation('You are jostled around violently!');
    trapHeroInChasm();
    if (await loseHeroHp(physicalDamage(rnd(keepsFooting ? 2 : 4)), 'hurt in a chasm', {
        deathCause: 'hurt in a chasm',
        killerFormat: NO_KILLER_PREFIX,
    })) return;
    if (keepsFooting) await exerciseAttribute(A_DEX, true);
    else {
        const slithering = heroIsPolymorphed(game)
            && monsterIsSlithy(game.u.umonnum ?? -1);
        await selfTouchPetrifyingWeapons({
            messageStart: slithering || heroHasNoLimbs(game)
                ? 'Shaken, you' : 'Falling down, you',
        });
    }
}

// Part of C music.c:do_pit(): xkilled(XKILL_NOMSG) finisher for a mselftouch death.
function finishEarthquakeStoning(monster: Monster, options: HeroMonsterKillOptions = {}) {
    return finishHeroMonsterKill(monster, monster.mx, monster.my, {
        ...options,
        showKillMessage: false,
        recordConduct: false,
    });
}

// Part of C music.c:do_pit(): the "poor <pet>" x_monnam() form in the destroy message.
function earthquakeMonsterName(monster: Monster): string {
    return monster.mtame
        ? monsterName(monster, { adjective: 'poor', suppressSaddle: !!MGIVENNAME(monster) })
        : monsterName(monster);
}

// Part of C music.c:do_pit(): monster branch — trap, fall, and destroy messages.
async function dropMonsterIntoChasm(monster: Monster, x: number, y: number): Promise<void> {
    if ((monsterIsFlyer(monster.mnum) || monsterIsClinger(monster.mnum))) return;
    const wasTrapped = !!monster.mtrapped;
    monster.mtrapped = 1;
    if (!wasTrapped) {
        if (cansee(x, y)) {
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} falls into a chasm!`);
        } else if (monsterIsHumanoid(monster.mnum)) {
            await publishHeardMessage('a scream!', plineWithContinuation);
        }
    }

    const selfTouch = await monsterSelfTouch(monster, {
        prefix: 'Falling, ',
        creditHero: true,
        finishDeath: finishEarthquakeStoning,
    });
    if (!selfTouch.survived) return;

    monster.mhp = (monster.mhp ?? 1) - rnd(wasTrapped ? 4 : 6);
    if (monster.mhp > 0) return;
    await plineWithContinuation(cansee(x, y)
        ? `You destroy ${earthquakeMonsterName(monster)}!`
        : 'It is destroyed!');
    await finishHeroMonsterKill(monster, x, y, {
        showKillMessage: false,
    });
}

// C music.c:do_pit().
async function openChasm(
    x: number,
    y: number,
    hadPitBeforeEarthquake: boolean,
): Promise<boolean> {
    const location = requireGameLevel(game).at(x, y);
    if (!location) throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    const chasm = await maketrap(x, y, PIT);
    if (!chasm) return false;
    chasm.tseen = 1;

    const monster = monsterAt(x, y);
    const boulder = boulderAt(x, y);
    if (boulder) {
        await fillChasmWithBoulder(x, y, boulder, monster);
        return true;
    }

    const liquid = liquidForHole(x, y);
    if (liquid !== ROOM) {
        await flowLiquidIntoChasm(x, y, chasm, liquid, monster);
        return true;
    }

    if (monster)
        await dropMonsterIntoChasm(monster, x, y);
    else if (game.u?.ux === x && game.u?.uy === y)
        await dropHeroIntoChasm(hadPitBeforeEarthquake);
    else
        await newsym(x, y);
    return true;
}

// Part of C music.c:do_earthquake(): wakeup plus the shaken-loose-from-ceiling branch.
async function wakeMonsterForEarthquake(monster: Monster | null): Promise<boolean> {
    if (!monster) return false;
    if ((await wakeMonster(monster, { attacked: true })).heroDied) return true;
    if (monster.mundetected) {
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
        if (monsterSpeciesHidesOnCeiling(monster.mnum)) {
            if (cansee(monster.mx, monster.my)) {
                await plineWithContinuation(
                    `${monsterName(monster, { article: 'a', capitalized: true })} is shaken loose from the ceiling!`,
                );
            } else if (!monsterIsFlyer(monster.mnum)) {
                await publishHeardMessage('a thump.', plineWithContinuation);
            }
        }
    }
    return false;
}

// Part of C music.c:do_earthquake(): align_str(Amask2align()) for the altar case.
function altarName(mask: number): string {
    const alignment = Amask2align(mask & AM_MASK);
    return alignment > 0 ? 'lawful'
        : alignment < 0 ? 'chaotic' : alignment === 0 ? 'neutral' : 'unaligned';
}

// Part of C music.c:do_earthquake(): the terrain switch (fountain, sink,
// altar, grave, throne, doors) around the do_pit() calls.
async function shakeTerrain(x: number, y: number, hadPitBeforeEarthquake: boolean): Promise<boolean> {
    const location = requireGameLevel(game).at(x, y);
    if (!location) throw new RangeError(`Earthquake square ${x},${y} is outside the level.`);
    if (location.typ === FOUNTAIN) {
        if (cansee(x, y))
            await plineWithContinuation('The fountain falls into a chasm.');
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SINK) {
        if (cansee(x, y))
            await plineWithContinuation('The kitchen sink falls into a chasm.');
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === ALTAR) {
        // music.c:do_earthquake() reads the mask through altarmask_at(),
        // so an altar-mimicking monster's disguise outranks the tile.
        const mask = altarmaskAt(x, y);
        if (mask & AM_SANCTUM) return false;
        if (cansee(x, y)) {
            await plineWithContinuation(
                `The ${altarName(mask)} altar falls into a chasm.`,
            );
        }
        await desecrateAltar(false, Amask2align(mask & AM_MASK));
        if (game.program_state.gameover) return false;
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === GRAVE || location.typ === THRONE) {
        const feature = location.typ === GRAVE ? 'headstone' : 'throne';
        const action = location.typ === GRAVE ? 'topples' : 'falls';
        if (cansee(x, y))
            await plineWithContinuation(`The ${feature} ${action} into a chasm.`);
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SCORR) {
        location.typ = CORR;
        vision_note_blocker_change(x, y);
        if (cansee(x, y))
            await plineWithContinuation('A secret corridor is revealed.');
    }
    if (location.typ === CORR || location.typ === ROOM) {
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    if (location.typ === SDOOR) {
        convertSecretDoor(location);
        if (cansee(x, y))
            await plineWithContinuation('A secret door is revealed.');
    }
    if (location.typ !== DOOR) return false;
    if ((location.doormask || 0) === D_NODOOR) {
        return await openChasm(x, y, hadPitBeforeEarthquake);
    }
    location.doormask = D_NODOOR;
    vision_note_blocker_change(x, y);
    await newsym(x, y);
    if (cansee(x, y))
        await plineWithContinuation('The door collapses.');
    if (roomsAt(game.level, x, y, SHOPBASE).length)
        addShopDamage(x, y, 0);
    return true;
}

// C music.c:do_earthquake().
export async function createEarthquake(requestedForce: number) {
    requirePlayingGame(game);
    const force = Math.max(1, Math.min(13, requestedForce));
    const hadPitBeforeEarthquake = is_pit(
        trapAt(game, game.u.ux, game.u.uy)?.ttyp ?? 0,
    );
    let changed = 0;
    const startX = Math.max(1, (game.u?.ux || 1) - force * 2);
    const endX = Math.min(COLNO - 1, (game.u?.ux || 1) + force * 2);
    const startY = Math.max(0, (game.u?.uy || 0) - force * 2);
    const endY = Math.min(ROWNO - 1, (game.u?.uy || 0) + force * 2);

    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            if (await wakeMonsterForEarthquake(monsterAt(x, y)))
                return { changed, force, heroDied: true };
            if (rn2(14 - force) !== 0) continue;
            if (await shakeTerrain(x, y, hadPitBeforeEarthquake)) changed++;
            if (game.program_state?.gameover) return { changed, force, heroDied: true };
        }
    }
    return { changed, force, heroDied: false };
}

// Part of C music.c:do_improvisation(): the magic flute case.
async function playMagicFlute(instrument: GameObject, familiar: boolean) {
    await consumeObjectCharge(instrument);
    await plineWithContinuation(
        `You ${heroIsDeaf() ? 'seem to ' : ''}produce ${
            heroIsHallucinating() ? 'piped' : 'soft'
        }${familiar ? ', familiar' : ''} music.`,
    );
    await putMonstersToSleep((game.u?.ulevel || 1) * 5);
    await exerciseAttribute(A_DEX, true);
}

// Part of C music.c:do_improvisation(): the wooden flute case, charming
// snakes.
async function playWoodenFlute(instrument: GameObject, familiar: boolean, canUseSpecial: boolean) {
    const skilledRoll = rn2(Math.max(1, currentAttribute(A_DEX)))
        + (game.u?.ulevel || 1) > 25;
    const succeeds = canUseSpecial && skilledRoll;
    if (!heroIsDeaf()) {
        await plineWithContinuation(
            `${definiteObjectAction(instrument, succeeds ? 'trill' : 'toot')}${
                familiar ? ' a familiar tune' : ''
            }.`,
        );
    } else {
        await plineWithContinuation(
            formatFeltMessage(`${ownedObjectName(instrument, game, { capitalized: false })} ${succeeds ? 'trill' : 'toot'}.`),
        );
    }
    if (succeeds) await charmSnakes((game.u?.ulevel || 1) * 3);
    await exerciseAttribute(A_DEX, true);
}

// Part of C music.c:do_improvisation(): the tooled horn case.
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

// Part of C music.c:do_improvisation(): the elemental horns' getdir
// prompt.
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

// Part of C music.c:do_improvisation(): the frost and fire horn zap
// case.
async function playElementalHorn(
    instrument: GameObject,
    element: 'fire' | 'cold',
): Promise<InstrumentEffectResult> {
    await consumeObjectCharge(instrument);
    const direction = await readHornDirection();
    if (direction === null) {
        await plineWithContinuation(`${definiteObjectAction(instrument, 'vibrate')}.`);
        return;
    }

    let result;
    if (direction === '.') {
        result = await zapHeroWithObject(instrument);
        if (result.heroDied) return result;
        if (result.damage) {
            const cause = `using a magical horn on ${game.flags.female ? 'herself' : 'himself'}`;
            if (await loseHeroHp(result.damage, cause, { killerFormat: KILLED_BY }))
                return { heroDied: true };
        }
    } else {
        if (!heroIsBlind()) {
            // C music.c passes flash_str(type, FALSE), so a hallucinating
            // hero sees a random hallucinatory blast and rolls for it.
            const flash = displayRayName(
                element === 'fire' ? AD_FIRE : AD_COLD, 'wand');
            await plineWithContinuation(
                `A ${flash} blasts out of the horn!`,
            );
        }
        result = await zapRayWithObject(instrument);
    }

    if (game.program_state.gameover) return { heroDied: true };
    if (result?.heroDied && await finishHeroDeath({ killer: `bolt of ${element}` }))
        return { heroDied: true };
    learnObjectType(instrument.otyp);
    return { heroDied: false };
}

// Part of C music.c:do_improvisation(): the bugle case.
async function playBugle(instrument: GameObject, familiar: boolean): Promise<InstrumentEffectResult> {
    await plineWithContinuation(heroIsDeaf()
        ? 'You blow into the bugle.'
        : `You extract a loud${familiar ? ', familiar' : ''} noise from ${ownedObjectName(instrument, game, { capitalized: false })}.`);
    const flight = await awakenSoldiers((game.u?.ulevel || 1) * 30);
    if (flight?.heroDied) return flight;
    await exerciseAttribute(A_WIS, false);
}

// Part of C music.c:do_improvisation(): the magic harp case.
async function playMagicHarp(instrument: GameObject, familiar: boolean) {
    await consumeObjectCharge(instrument);
    await plineWithContinuation(heroIsDeaf()
        ? formatFeltMessage('very soothing vibrations.')
        : `${definiteObjectAction(instrument, 'produce')} very attractive${
            familiar ? ' and familiar' : ''
        } music.`);
    await charmMonsters(Math.trunc(((game.u?.ulevel || 1) - 1) / 3) + 1);
    await exerciseAttribute(A_DEX, true);
}

// Part of C music.c:do_improvisation(): the wooden harp case, calming
// nymphs.
async function playWoodenHarp(instrument: GameObject, familiar: boolean, canUseSpecial: boolean) {
    const skilledRoll = rn2(Math.max(1, currentAttribute(A_DEX)))
        + (game.u?.ulevel || 1) > 25;
    const succeeds = canUseSpecial && skilledRoll;
    if (heroIsDeaf()) {
        await plineWithContinuation(formatFeltMessage('soothing vibrations.'));
    } else {
        const action = succeeds
            ? `produces a ${familiar ? 'familiar, ' : ''}lilting melody`
            : `twangs${familiar ? ' a familiar tune' : ''}`;
        await plineWithContinuation(
            `${ownedObjectName(instrument)} ${action}.`,
        );
    }
    if (succeeds) await calmNymphs((game.u?.ulevel || 1) * 3);
    await exerciseAttribute(A_DEX, true);
}

const DRUM_BEATS = [
    'stepper', 'one drop', 'slow two', 'triple stroke roll',
    'double shuffle', 'half-time shuffle', 'second line', 'train',
];

// Part of C music.c:do_improvisation(): the leather drum case.
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
        // C music.c LEATHER_DRUM: incr_itimeout() follows the row, before
        // awaken_monsters(); the status line only refreshes when a later
        // flush_screen() finds botl set (mhitu.c expels() sets it first).
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

// C music.c:generic_lvl_desc().
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

// Part of C music.c:do_improvisation(): the earthquake drum case.
async function playEarthquakeDrum(instrument: GameObject): Promise<InstrumentEffectResult> {
    await consumeObjectCharge(instrument);
    await plineWithContinuation('You produce a heavy, thunderous rolling!');
    await plineWithContinuation(
        `The entire ${levelDescription()} is shaking around you!`,
    );
    const force = Math.trunc(((game.u?.ulevel || 1) - 1) / 3) + 1;
    const earthquake = await createEarthquake(force);
    if (earthquake.heroDied) return earthquake;
    const flight = await awakenMonsters(ROWNO * COLNO);
    if (flight?.heroDied) return flight;
    learnObjectType(instrument.otyp);
}

// C music.c:do_improvisation().
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

// C music.c:do_play_instrument(): underwater and wind-instrument gates,
// then the improvise-or-tune prompt.
export async function playInstrument(instrument: GameObject, options: InstrumentOptions = {}) {
    if (game.underwater || game.u?.uinwater) {
        await pline("You can't play music underwater!");
        game.context.move = 0;
        return;
    }
    if (WIND_INSTRUMENTS.has(instrument.otyp) && !heroCanBlow()) {
        await pline(
            `You are incapable of playing ${definiteName(simpleObjectName(instrument))}.`,
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
