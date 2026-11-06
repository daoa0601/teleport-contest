// fountain.c owner: fountain and sink drinking, dipping, drying, warnings,
// water effects, and the sink terrain.  Folded from fountain_effects/
// fountain_sword/sink_dipping/sink_drinking/sink_terrain/dip_water
// (pure move, no behavior change).

import { RING_CLASS, POTION_CLASS, COIN_CLASS } from './objclass.js';
import { distmin } from './hacklib.js';
import { fingersOrGloves } from './do_wear.js';
import { artifactByName, discoverArtifact, nameArtifact, setWieldedArtifactProperties } from './artifact.js';
import { ATTRIBUTE_DISPLAY_ORDER, adjustAttribute, attributeChangeMessage, currentAttribute, exerciseAttribute, exerciseWisdom, poisonHeroStrengthAndHp } from './attrib.js';
import {
    A_CON, A_DEX, A_MAX, A_STR, A_WIS, DOOR, ENL_GAMEINPROGRESS, F_LOOTED, FOUNTAIN, F_WARNED, G_GONE,
    MAGICENLIGHTENMENT, MM_NOMSG, M_SEEN_FIRE, MON_FLOOR, POOL, POLY_NOFLAGS, ROOM, SDOOR, SINK, S_LRING,
    ARM, HAND, FACE, HEAD, LL_ARTIFACT,
} from './const.js';
import { monsterHasMapPosition } from './steed.js';
import { canSpotMonster, glyphAt, newsym } from './display.js';
import {
    formatFeltMessage, formatHeardMessage, formatSeenMessage, pline, plineWithContinuation,
    publishHeardMessage, recordGameLogEvent,
} from './pline.js';
import type { MessagePublisher } from './pline.js';
import { displayMessageWindow, flushPendingTopline } from './topl.js';
import { deleteEngravingAt } from './engrave.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { MapLocation } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import { countLevelFeatures, makemonNear } from './mklev.js';
import { splitHeroMonsterForm, grantMonsterWish, applySupportedPotionVapor, heroPotionVaporProfile, drinkPotion } from './potion.js';
import { mkobj, mkgold, mksobj, blessObjectState, curseObject, uncurseObjectState, objectQuantity, placeCreatedObject, adjustObjectLightAfterBlessing} from './mkobj.js';
import { definiteName, objectCombatName, rndClass, makePlural, fruitName } from './objnam.js';
import { resolveMonsterLiquid, angerWatchGuards, finishLiquidDeathForCurrentMover } from './mon.js';
import { makeMonsterFlee } from './monmove.js';
import { MONSTER_NAME } from './monster_data.js';
import { displayColorName, displayLiquidName, monsterName, randomDisplayMonsterName } from './do_name.js';
import { monsterPossessive, monsterSubjectPronoun, monstersForgetHeroResistance, monstersObserveHeroResistance, monsterHasNoLimbs } from './mondata.js';
import { level_difficulty } from './dungeon.js';
import { BOULDER, DILITHIUM_CRYSTAL, LONG_SWORD, LUCKSTONE, POT_ACID, POT_FRUIT_JUICE, POT_GAIN_ENERGY, POT_GAIN_LEVEL, POT_LEVITATION, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION, POT_OIL, POT_POLYMORPH, POT_WATER, } from './object_data.js';
import { promptYesNo } from './query.js';
import { rnd, rn1, rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { mintrap, waterDamageChain, waterDamageObject, deleteFloorTrap } from './trap.js';
import type { WaterDamageOutcome } from './trap.js';
import { cansee, clearAreaCells, couldsee } from './vision.js';
import { objectLightRadius } from './light.js';
import { floatingAbove } from './levitation_commands.js';
import { morehungry, newuhs, vomit } from './eat.js';
import { enlightenment } from './insight.js';
import { detectMonsters } from './detect.js';
import { grantIntrinsicProperty, propertyIsActive, setPropertyTimeout } from './properties.js';
import { encumber_msg } from './pickup.js';
import { setHeroGoldAmount } from './sit.js';
import { someGold } from './steal.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { consumeInventoryItem } from './invent.js';
import { tryCallObjectType, polymorphSink } from './do.js';
import { OBJ_DESCR, observeObject } from './o_init.js';
import { heroIsUnchanging, polymorphHero, body_part, mbodypart } from './polyself.js';
import { createPoisonGasCloud } from './region.js';
import { updateUnpaidObjectPrice, deleteObject } from './shk.js';
import { setTwoWeaponCombat, dropCursedSecondaryWeapon } from './wield.js';
import { inTown, loseHeroHp, heroGoldAmount } from './hack.js';

// ---------------------------------------------------------------------------
// Fountain drinking, dipping, drying, warnings, and water effects (fountain)
// ---------------------------------------------------------------------------

const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;

export async function dryFountainAt(x: number, y: number, {
    causedByHero = true, random = rn2, state = game,
    publish = plineWithContinuation,
}: { causedByHero?: boolean; random?: (limit: number) => number; state?: GameState; publish?: MessagePublisher } = {}): Promise<boolean> {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    if (location?.typ !== FOUNTAIN) return false;
    const dries = random(3) === 0;
    const alreadyWarned = !!((location.looted ?? 0) & F_WARNED);
    if (!dries && !alreadyWarned) return false;

    if (causedByHero && inTown(level, x, y) && !alreadyWarned) {
        location.looted = (location.looted ?? 0) | F_WARNED;
        await warnAboutFountain(state, publish);
        return false;
    }
    if (causedByHero && state.flags.debug
        && await promptYesNo('Dry up fountain?') === 'n') return false;

    if (cansee(x, y)) {
        const glyph = glyphAt(x, y, state);
        if (glyph?.kind !== 'terrain' || glyph.terrainName !== 'cloud')
            await publish('The fountain dries up!');
    }
    location.typ = ROOM;
    countLevelFeatures(state);
    location.flags = 0;
    location.looted = 0;
    location.blessedftn = 0;
    await newsym(x, y);
    if (causedByHero && inTown(level, x, y))
        await angerWatchGuards(false, { publish });
    return true;
}

// C fountain.c:watchman_warn_fountain().
async function warnAboutFountain(state: GameState, publish: MessagePublisher): Promise<void> {
    const watch = [...requireGameLevel(state).monsters].reverse().find(monster =>
        !monster.dead && monster.mhp > 0 && monster.mpeaceful
        && (monster.mstate ?? MON_FLOOR) === MON_FLOOR
        && (monster.mnum === PM_WATCHMAN || monster.mnum === PM_WATCH_CAPTAIN)
        && couldsee(monster.mx, monster.my));
    if (!watch) {
        await publish('The flow reduces to a trickle.');
        return;
    }
    const name = monsterName(watch, { article: 'a', capitalized: true, state });
    if (heroIsDeaf(state)) {
        const limbless = monsterHasNoLimbs(watch.mnum);
        const part = limbless ? mbodypart(watch.mnum, HEAD)
            : makePlural(mbodypart(watch.mnum, ARM));
        await publish(`${name} earnestly ${limbless ? 'shakes' : 'waves'} ${
            monsterPossessive(watch, { state })} ${part}!`);
    } else {
        await publish(`${name} yells:`);
        await publish('"Hey, stop using that fountain!"');
    }
}

export async function splitSittingGremlin() {
    const clone = await splitHeroMonsterForm(game);
    if (!clone) return null;
    await plineWithContinuation('You multiply!');
    await dryFountainAt(game.u.ux, game.u.uy);
    return clone;
}

// C fountain.c:dogushforth()
// Gushing water along line of sight from an overflowing fountain.
// Also C fountain.c:gush(): inlined here as the per-step callback.
export async function gushForthFromFountain({ drinking = false, state = game }: { drinking?: boolean; state?: GameState } = {}): Promise<void> {
    const level = requireGameLevel(state);
    const ux = state.u.ux;
    const uy = state.u.uy;
    let madePool = 0;
    for (const { x, y } of await clearAreaCells(ux, uy, 7)) {
        if (((x + y) % 2) || (x === ux && y === uy)
            || rn2(1 + distmin(ux, uy, x, y))) continue;
        const location = state.level?.at?.(x, y);
        const objects = state.level?.objects?.[x]?.[y] || [];
        if (location?.typ !== ROOM || objects.some(object => object.otyp === BOULDER)
            || nextToDoor(x, y, state)) {
            continue;
        }
        const trap = state.level?.traps?.find(candidate =>
            candidate.tx === x && candidate.ty === y);
        if (trap && !await deleteFloorTrap(trap, state)) continue;

        if (madePool++ === 0) {
            await plineWithContinuation('Water gushes forth from the overflowing fountain!');
        }
        location.typ = POOL;
        location.flags = 0;
        deleteEngravingAt(x, y, level);
        await waterDamageChain(objects, [], state, { publish: plineWithContinuation });

        const monster = (state.level?.monsters || []).find(candidate => monsterHasMapPosition(candidate, state) &&
            (candidate.mhp ?? 1) > 0 && candidate.mx === x && candidate.my === y);
        if (monster) {
            await resolveMonsterLiquid(monster, state, {
                announce: plineWithContinuation,
                finishDeath: finishLiquidDeathForCurrentMover,
                monsterMoving: !!state.context.mon_moving,
            });
        } else {
            await newsym(x, y);
        }
    }
    if (!madePool) {
        await plineWithContinuation(drinking
            ? 'Your thirst is quenched.'
            : 'Water sprays all over you.');
    }
}

function nextToDoor(x: number, y: number, state: GameState): boolean {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const typ = state.level?.at?.(x + dx, y + dy)?.typ;
            if (typ === DOOR || typ === SDOOR) return true;
        }
    }
    return false;
}

const PM_WATER_NYMPH = 68;
const PM_WATER_DEMON = 289;
const PM_WATER_MOCCASIN = 216;

// C fountain.c:dofindgem().
async function discoverFountainGem(loc: MapLocation) {
    return applyFountainGemDiscovery({
        loc,
        blind: heroIsBlind(),
        announce: (message: string) => pline(message),
        chooseGem: () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1),
        createGem: (gemType: number) => mksobj(gemType, false, false),
        placeGem: (gem: GameObject) => placeCreatedObject(gem, game.u.ux, game.u.uy),
        repaint: async () => await newsym(game.u.ux, game.u.uy),
        exerciseWisdom,
    });
}

function fountainActorGone(mnum: number) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE);
}

function fountainActorIndefiniteName(monster: Monster) {
    return monsterName(monster, { article: 'a' });
}

function fountainActorVisibleSubject(monster: Monster) {
    return monsterName(monster, { capitalized: true });
}

function fountainTrapAt(monster: Monster) {
    return game.level?.traps?.some(trap =>
        trap.tx === monster.mx && trap.ty === monster.my) ?? false;
}

async function triggerFountainTrap(monster: Monster) {
    const state = requireInitializedGame();
    // The fountain square hosts no trap whose effect can end the game in its
    // first half, so the completion runs unconditionally as in C's single
    // mintrap() call (fountain.c:55).
    await mintrap(monster, state, {
        describeMonster: fountainActorVisibleSubject,
        publish: plineWithContinuation,
    });
    return { heroDied: !!state.program_state.gameover };
}

// C fountain.c:dowaternymph(). The naming lines run only for a sighted
// hero, so a blind hero never draws the nymph's (hallucinated) name.
export async function summonFountainNymph() {
    if (fountainActorGone(PM_WATER_NYMPH)) {
        await announceFountainPop();
        return;
    }
    const nymph = await makemonNear(PM_WATER_NYMPH, game.u.ux, game.u.uy, MM_NOMSG);
    if (!nymph) {
        await announceFountainPop();
        return;
    }
    await newsym(nymph.mx, nymph.my);
    if (!heroIsBlind())
        await plineWithContinuation(`You attract ${fountainActorIndefiniteName(nymph)}!`);
    else
        await announceFountainHeard('a seductive voice.');
    nymph.msleeping = 0;
    if (fountainTrapAt(nymph)) await triggerFountainTrap(nymph);
}

// C fountain.c:dowaterdemon().
export async function summonFountainDemon() {
    if (fountainActorGone(PM_WATER_DEMON)) {
        await plineWithContinuation(FURIOUS_BUBBLING_MESSAGE);
        return;
    }
    const demon = await makemonNear(PM_WATER_DEMON, game.u.ux, game.u.uy, MM_NOMSG);
    if (!demon) return;
    await newsym(demon.mx, demon.my);
    if (!heroIsBlind())
        await plineWithContinuation(`You unleash ${fountainActorIndefiniteName(demon)}!`);
    else
        await plineWithContinuation(formatFeltMessage('the presence of evil.'));
    // Give those on low levels a (slightly) better chance of survival.
    if (rnd(100) > 80 + level_difficulty()) {
        await plineWithContinuation(`Grateful for ${monsterPossessive(demon)} release, ${monsterSubjectPronoun(demon)} grants you a wish!`);
        // give a wish and discard the monster (mongrantswish)
        await grantMonsterWish(demon);
    } else if (fountainTrapAt(demon)) {
        await triggerFountainTrap(demon);
    }
}

// C fountain.c:dowatersnakes().
export async function summonFountainSnakes() {
    // rn1(5, 2) is paid before the G_GONE check, as in C.  dowatersnakes()
    // owns the first ordinary pline; only a later dryup line enters the
    // branch-scoped continuation path.
    const requested = 2 + rn2(5);
    if (fountainActorGone(PM_WATER_MOCCASIN)) {
        await pline(FURIOUS_BUBBLING_MESSAGE);
        return;
    }
    if (!heroIsBlind())
        await pline(`An endless stream of ${
            heroIsHallucinating() ? makePlural(randomDisplayMonsterName()) : 'snakes'
        } pours forth!`);
    else
        await announceFountainHeard('something hissing!', pline);
    for (let index = 0; index < requested; index++) {
        const snake = await makemonNear(PM_WATER_MOCCASIN, game.u.ux, game.u.uy, MM_NOMSG);
        if (!snake) continue;
        await newsym(snake.mx, snake.my);
        const trap = fountainTrapAt(snake) ? await triggerFountainTrap(snake) : null;
        if (trap?.heroDied) break;
    }
}

// C fountain.c:drinkfountain().
export async function drinkFountain(loc: MapLocation) {
    let fountainMessage = '';
    const blessed = !!loc.blessedftn;
    const fate = rnd(30);
    if (propertyIsActive('levitation')) {
        await floatingAbove('fountain');
        return false;
    }
    if (blessed && (game.u.uluck ?? 0) >= 0 && fate >= 10) {
        // The magic fountain: blessed restore ability, then one gained
        // attribute, blessed when "natural" luck is high.
        requirePlayingGame(game);
        const hero = game.u;
        await plineWithContinuation('Wow!  This makes you feel great!');
        for (const attribute of ATTRIBUTE_DISPLAY_ORDER) {
            if (hero.acurr.a[attribute] < hero.amax.a[attribute]) {
                hero.acurr.a[attribute] = hero.amax.a[attribute];
                game.context.botl = true;
            }
        }
        const littleLuck = (hero.uluck ?? 0) < 4;
        const start = rn2(A_MAX);
        for (let offset = 0; offset < A_MAX; offset++) {
            const attribute = (start + offset) % A_MAX;
            const change = adjustAttribute(attribute, 1, game);
            if (change.changed || !littleLuck
                && (change.blockedByDunceCap || game.flags.verbose !== false)) {
                const message = attributeChangeMessage(attribute, change, game);
                if (message) await plineWithContinuation(message);
            }
            if (change.changed && game._moveloopStarted
                && (attribute === A_STR || attribute === A_CON))
                await encumber_msg(game);
            if (change.changed && littleLuck) break;
        }
        await displayMessageWindow();
        await plineWithContinuation('A wisp of vapor escapes the fountain...');
        await exerciseAttribute(A_WIS, true);
        loc.blessedftn = 0;
        return false;
    }
    if (fate < 10) {
        // fountain.c:drinkfountain() handles the ordinary low-fate draught
        // before its numbered switch.  Nutrition is credited before dryup()
        // and the elapsed-turn scheduler applies its normal hunger cost.
        await plineWithContinuation('The cool draught refreshes you.');
        game.u.uhunger = (game.u.uhunger ?? 900) + rnd(10);
        await newuhs(false);
        if (game.program_state.gameover) return true;
        if (blessed) return false;
    } else if (fate === 19) {
        await plineWithContinuation(formatFeltMessage('self-knowledgeable...'));
        await flushPendingTopline();
        await enlightenment(MAGICENLIGHTENMENT, ENL_GAMEINPROGRESS);
        await exerciseAttribute(A_WIS, true);
        await plineWithContinuation('The feeling subsides.');
    } else if (fate === 20) {
        await plineWithContinuation('The water is foul!  You gag and vomit.');
        // C refs: fountain.c:drinkfountain(), eat.c:vomit(), and
        // allmain.c:moveloop_core().  Foul water first removes 11..30 points
        // of nutrition, then nomul(-2) makes the next two global turns happen
        // without accepting a hero command.
        await morehungry(11 + rn2(20));
        if (game.program_state.gameover) return true;
        await vomit({ state: game });
        if (game.program_state.gameover) return true;
    } else if (fate === 21) {
        await plineWithContinuation('The water is contaminated!');
        if (game.u.poisonResistance) {
            await plineWithContinuation(
                `Perhaps it is runoff from the nearby ${fruitName(false)} farm.`,
            );
            if (await loseHeroHp(rnd(4), 'unrefrigerated sip of juice')) return true;
        } else {
            if (await poisonHeroStrengthAndHp(
                3 + rn2(4), rnd(10), 'contaminated water',
                { deathCause: 'killed by contaminated water' },
            )) return true;
            await exerciseAttribute(A_CON, false);
        }
    } else if (fate === 22) {
        await summonFountainSnakes();
    } else if (fate === 23) {
        await summonFountainDemon();
    } else if (fate === 24) {
        await plineWithContinuation("This water's no good!");
        await morehungry(11 + rn2(20));
        if (game.program_state.gameover) return true;
        await exerciseAttribute(A_CON, false);
        // A curse can drop the offhand weapon and change the inventory.
        for (const object of [...game.inventory]) {
            if (object.oclass !== COIN_CLASS && !object.cursed && !rn2(5)) {
                await curseObject(object);
                if (game.program_state.gameover) return true;
            }
        }
    } else if (fate === 25) {
        if (heroIsBlind()) {
            if (propertyIsActive('invisible') && !propertyIsActive('seeInvisible')) {
                await plineWithContinuation('You feel transparent.');
            } else {
                await plineWithContinuation('You feel very self-conscious.');
                await plineWithContinuation('Then it passes.');
            }
        } else {
            await plineWithContinuation(formatSeenMessage('an image of someone stalking you.'));
            await plineWithContinuation('But it disappears.');
        }
        grantIntrinsicProperty('seeInvisible', 'outside');
        await newsym(game.u.ux, game.u.uy);
        await exerciseAttribute(A_WIS, true);
    } else if (fate === 26) {
        if ((await detectMonsters(null)).result)
            await plineWithContinuation(`The ${displayLiquidName('water')} tastes like nothing.`);
        await exerciseAttribute(A_WIS, true);
    } else if (fate === 27 && !((loc.looted ?? 0) & 1)) {
        await discoverFountainGem(loc);
    } else if (fate === 27 || fate === 28) {
        await summonFountainNymph();
    } else if (fate === 29) {
        await plineWithContinuation(`This ${displayLiquidName('water')} gives you bad breath!`);
        for (const monster of [...requireGameLevel().monsters].reverse()) {
            if (monster.dead || monster.mhp <= 0) continue;
            if ((await makeMonsterFlee(monster, { announce: false })).heroDied)
                return true;
        }
    } else if (fate === 30) {
        await gushForthFromFountain({ drinking: true });
    } else if (fate >= 10) {
        fountainMessage =
            `This tepid ${displayLiquidName('water')} is tasteless.`;
    }
    if (game.program_state.gameover) return true;
    if (fountainMessage) await plineWithContinuation(fountainMessage);

    await dryFountainAt(game.u.ux, game.u.uy);
    return false;
}

// C fountain.c:dipfountain().
export async function dipFountain(object: DipTarget, loc: MapLocation) {
    if (propertyIsActive('levitation')) {
        await floatingAbove('fountain');
        return;
    }
    if (object !== 'hands' && await dipFountainSword(object, loc)) return;
    const result = object === 'hands' || object === game.uarmg ? await washHands()
        : await waterDamageObject(object, [], game, { force: true, publish: plineWithContinuation });
    if (result === 'destroyed' || result !== 'nothing' && rn2(2) === 0) {
        return;
    }

    const fate = rnd(30);
    let eventMessage = '';
    if (fate >= 16 && fate <= 20) {
        if (fate === 16) {
            if (object !== 'hands' && object.oclass !== COIN_CLASS && !object.cursed)
                await curseObject(object);
        } else if (object !== 'hands' && object.cursed) {
            if (!heroIsBlind())
                await plineWithContinuation(`The ${displayLiquidName('water')} glows for a moment.`);
            const oldRadius = objectLightRadius(object);
            uncurseObjectState(object);
            await adjustObjectLightAfterBlessing(object, oldRadius);
        } else {
            await plineWithContinuation('A feeling of loss comes over you.');
        }
        if (!game.program_state.gameover)
            await dryFountainAt(game.u.ux, game.u.uy);
        return;
    }
    const sensationEffect = resolveDippedSensationFate({
        fate,
        armName: () => body_part(ARM, game),
    });
    const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
    const coinEffect = await applyDippedCoinFate({
        fate,
        loc,
        dungeonLevels: currentDungeon?.num_dunlevs
            ?? game.u?.uz?.dlevel ?? 1,
        dungeonLevel: game.u?.uz?.dlevel ?? 1,
        blind: heroIsBlind(),
        random: rnd,
        createGold: async (quantity: number) => {
            await mkgold(quantity, game.u.ux, game.u.uy);
        },
        liquidName: () => displayLiquidName('water'),
        exerciseWisdom,
        repaint: async () => await newsym(game.u.ux, game.u.uy),
    });
    if (sensationEffect.handled) {
        eventMessage = sensationEffect.message;
    } else if (coinEffect.handled) {
        eventMessage = coinEffect.message;
    } else if (fate === 21) {
        await summonFountainDemon();
    } else if (fate === 22) {
        await summonFountainNymph();
    } else if (fate === 23) {
        await summonFountainSnakes();
    } else if (fate === 24) {
        if ((loc.looted ?? 0) & F_LOOTED)
            await gushForthFromFountain();
        else
            await discoverFountainGem(loc);
    } else if (fate === 25) {
        await gushForthFromFountain();
    } else if (fate === 28) {
        await plineWithContinuation('An urge to take a bath overwhelms you.');

        const wallet = heroGoldAmount(game);
        if (wallet > 10) {
            const loss = Math.trunc(someGold(wallet, rn2) / 10);
            game._statusGoldOverride = wallet;
            setHeroGoldAmount(game, wallet - loss);
            await plineWithContinuation('You lost some of your gold in the fountain!');
            loc.looted = (loc.looted ?? 0) & ~F_LOOTED;
            await exerciseAttribute(A_WIS, false);
        }

        await dryFountainAt(game.u.ux, game.u.uy);
        return;
    } else if ((fate < 16 || fate === 30) && result === 'nothing') {
        eventMessage = 'Nothing seems to happen.';
    }
    if (game.program_state.gameover) return;
    if (eventMessage) await plineWithContinuation(eventMessage);
    await dryFountainAt(game.u.ux, game.u.uy);
}

// ---------------------------------------------------------------------------
// Shared dip target and wash_hands() (dip_water)
// ---------------------------------------------------------------------------

export type DipTarget = GameObject | 'hands';

export async function washHands(): Promise<WaterDamageOutcome> {
    const glib = (game.u.glibTurns ?? 0) > 0;
    await pline(`You wash your ${game.uarmg ? 'gloved ' : ''}${makePlural(body_part(HAND))} in the ${displayLiquidName('water')}.`);
    if (glib) {
        setPropertyTimeout('glib', 0);
        game.context.botl = true;
        await pline(`Your ${fingersOrGloves()} are no longer slippery.`);
    }
    const result = game.uarmg ? await waterDamageObject(game.uarmg, [], game,
        { force: true, publish: pline }) : 'nothing';
    return glib && result === 'nothing' ? 'greased' : result;
}

// ---------------------------------------------------------------------------
// Fountain sensations, treasure, and spawned creatures (fountain_effects)
// ---------------------------------------------------------------------------

type DescribedPart = string | (() => string);

interface FountainTrapResult {
    heroDied: boolean;
}

function resolvedLiquidName(liquidName: DescribedPart): string {
    return typeof liquidName === 'function' ? liquidName() : liquidName;
}

function resolvedArmName(armName: DescribedPart): string {
    return typeof armName === 'function' ? armName() : armName;
}

export function resolveDippedSensationFate({ fate, armName = 'arm' }: { fate: number; armName?: DescribedPart }) {
    if (fate === 26) {
        return {
            handled: true,
            message: `A strange tingling runs up your ${
                resolvedArmName(armName)
            }.`,
        };
    }
    if (fate === 27) {
        return {
            handled: true,
            message: formatFeltMessage('a sudden chill.'),
        };
    }
    return { handled: false, message: '' };
}

export function resolveDippedCoinFate({
    fate,
    looted = false,
    dungeonLevels = 1,
    dungeonLevel = 1,
    blind = false,
    random = rnd,
}: { fate: number; looted?: boolean; dungeonLevels?: number; dungeonLevel?: number; blind?: boolean; random?: (sides: number) => number }) {
    const empty = {
        createsCoins: false,
        quantity: 0,
        showMessage: false,
    };
    if (fate !== 29) return { handled: false, ...empty };
    if (looted) return { handled: true, ...empty };

    const amountRange = (dungeonLevels - dungeonLevel + 1) * 2;
    return {
        handled: true,
        createsCoins: true,
        quantity: random(amountRange) + 5,
        showMessage: !blind,
    };
}

export function dippedCoinMessage(liquidName = 'water') {
    return `Far below you, you see coins glistening in the ${liquidName}.`;
}

export async function applyDippedCoinFate({
    fate,
    loc,
    dungeonLevels = 1,
    dungeonLevel = 1,
    blind = false,
    random = rnd,
    createGold = () => {},
    liquidName = 'water',
    exerciseWisdom = () => {},
    repaint = () => {},
}: {
    fate: number; loc: MapLocation; dungeonLevels?: number; dungeonLevel?: number;
    blind?: boolean; random?: (sides: number) => number; createGold?: (quantity: number) => unknown;
    liquidName?: DescribedPart; exerciseWisdom?: () => void; repaint?: () => void | Promise<void>;
}) {
    const effect = resolveDippedCoinFate({
        fate,
        looted: !!((loc?.looted ?? 0) & 1),
        dungeonLevels,
        dungeonLevel,
        blind,
        random,
    });
    if (!effect.createsCoins) return { ...effect, message: '' };

    loc.looted = (loc.looted ?? 0) | 1;
    await createGold(effect.quantity);
    const message = effect.showMessage
        ? dippedCoinMessage(resolvedLiquidName(liquidName))
        : '';
    exerciseWisdom();
    await repaint();
    return { ...effect, message };
}

export async function applyFountainGemDiscovery({
    loc,
    blind = false,
    announce = async () => {},
    chooseGem,
    createGem,
    placeGem,
    repaint = () => {},
    exerciseWisdom = () => {},
}: {
    loc: MapLocation;
    blind?: boolean;
    announce?: MessagePublisher;
    chooseGem: () => number;
    createGem: (gemType: number) => GameObject | Promise<GameObject>;
    placeGem: (gem: GameObject) => void;
    repaint?: () => void | Promise<void>;
    exerciseWisdom?: () => void;
}) {
    if ((loc?.looted ?? 0) & 1) {
        return {
            discovered: false,
            message: '',
            gemType: null,
            gem: null,
        };
    }

    const message = blind
        ? formatFeltMessage('a gem here!')
        : 'You spot a gem in the sparkling waters!';
    await announce(message);
    const gemType = chooseGem();
    const gem = await createGem(gemType);
    placeGem(gem);
    loc.looted = (loc.looted ?? 0) | 1;
    await repaint();
    exerciseWisdom();
    return { discovered: true, message, gemType, gem };
}

const FURIOUS_BUBBLING_MESSAGE
    = 'The fountain bubbles furiously for a moment, then calms.';

// A blind hero hears the actor only when You_hear() itself would speak.
// dowatersnakes() passes the ordinary pline; the other actors continue.
async function announceFountainHeard(heard: string, publish: MessagePublisher = plineWithContinuation): Promise<void> {
    const message = formatHeardMessage(heard);
    if (message) await publish(message);
}

// The failed-summon fallback pop: C fountain.c:108-115.
async function announceFountainPop(): Promise<void> {
    if (!heroIsBlind())
        await plineWithContinuation('A large bubble rises to the surface and pops.');
    else
        await announceFountainHeard('a loud pop.');
}

// ---------------------------------------------------------------------------
// The Lady of the Lake judges a long sword (fountain_sword)
// ---------------------------------------------------------------------------

export async function dipFountainSword(object: GameObject, location: MapLocation): Promise<boolean> {
    requirePlayingGame(game);
    if (object.otyp !== LONG_SWORD || game.u.ulevel < 5
        || rn2(game.urole.key === 'knight' ? 6 : 30)
        || object.quan !== 1 || object.oartifact) return false;
    const artifact = artifactByName('Excalibur');
    if (!artifact) throw new Error('The Lady of the Lake requires Excalibur metadata.');
    if (game._artifactExists?.has(artifact.id)) return false;
    if (game.u.ualign.type !== 1) {
        await pline(`A freezing mist rises from the ${displayLiquidName('water')} and envelopes the sword.`);
        await pline('The fountain disappears!');
        await curseObject(object);
        await dropCursedSecondaryWeapon(object);
        if (object.spe > -6 && !rn2(3)) { object.spe--; object.enchantment = object.spe; }
        object.oerodeproof = false;
        await exerciseAttribute(A_WIS, false);
        recordGameLogEvent(`was denied Excalibur!  The Lady of the Lake has deemed ${game.flags.female ? 'her' : 'him'} unworthy`, { flags: LL_ARTIFACT });
    } else {
        await pline('From the murky depths, a hand reaches up to bless the sword.');
        await pline('As the hand retreats, the fountain disappears!');
        nameArtifact(object, artifact, { origin: 'viadip', knownOrigin: true });
        if (object === game.uswapwep) setTwoWeaponCombat(false);
        // C oname() activates an artifact created in the wielded hand.
        if (object === game.uwep) await setWieldedArtifactProperties(object, true, game);
        if (object.unpaid) updateUnpaidObjectPrice(object);
        discoverArtifact(artifact.id);
        blessObjectState(object);
        object.oeroded = 0;
        object.oeroded2 = 0;
        object.oerodeproof = true;
        await exerciseAttribute(A_WIS, true);
        recordGameLogEvent('was given Excalibur by the Lady of the Lake', { flags: LL_ARTIFACT });
    }
    location.typ = ROOM;
    location.flags = 0;
    location.looted = 0;
    location.blessedftn = 0;
    countLevelFeatures(game);
    await newsym(game.u.ux, game.u.uy);
    if (inTown(game.level, game.u.ux, game.u.uy)) await angerWatchGuards(false);
    return true;
}

// ---------------------------------------------------------------------------
// Converting a sink to a fountain by breaking it (sink_terrain)
// ---------------------------------------------------------------------------

export async function breakSinkAt(x: number, y: number, state: GameState = game) {
    const level = state.level;
    const location = level?.at(x, y);
    if (!level || !location || location.typ !== SINK) return false;
    if (cansee(x, y) || (state.u?.ux === x && state.u?.uy === y)) {
        await plineWithContinuation('The pipes break!  Water spurts out!');
    }
    location.typ = FOUNTAIN;
    // set_levltyp() recounts the level's fountains and sinks from the map.
    countLevelFeatures(state);
    location.looted = F_LOOTED;
    location.blessedftn = 0;
    await newsym(x, y);
    return true;
}

// ---------------------------------------------------------------------------
// Drinking from a sink (sink_drinking)
// ---------------------------------------------------------------------------

const PM_SEWER_RAT = MONSTER_NAME.indexOf('sewer rat');
const PM_WATER_ELEMENTAL = MONSTER_NAME.indexOf('water elemental');

export async function drinkSink({ state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const location = state.level.requireAt(hero.ux, hero.uy);
    if (propertyIsActive('levitation', state)) {
        await floatingAbove('sink', state);
        return outcome(state);
    }
    switch (rn2(20)) {
    case 0:
        await pline(`You take a sip of very cold ${displayLiquidName('water', state)}.`);
        break;
    case 1:
        await pline(`You take a sip of very warm ${displayLiquidName('water', state)}.`);
        break;
    case 2:
        await pline(`You take a sip of scalding hot ${displayLiquidName('water', state)}.`);
        if (propertyIsActive('fireResistance', state)) {
            await pline('It seems quite tasty.');
            monstersObserveHeroResistance(M_SEEN_FIRE, state);
        } else {
            await loseHeroHp(rnd(6), 'sipping boiling water', { state });
            monstersForgetHeroResistance(M_SEEN_FIRE, state);
        }
        break;
    case 3:
        await releaseSewerRat(state);
        break;
    case 4:
        await drinkFaucetPotion(state);
        break;
    case 5:
        if (!((location.looted ?? 0) & S_LRING)) {
            await pline('You find a ring in the sink!');
            placeCreatedObject(await mkobj(RING_CLASS, true), hero.ux, hero.uy, state);
            location.looted = (location.looted ?? 0) | S_LRING;
            exerciseWisdom(true, state);
            await newsym(hero.ux, hero.uy);
        } else await pline(`Some dirty ${displayLiquidName('water', state)} backs up in the drain.`);
        break;
    case 6:
        await breakSinkAt(hero.ux, hero.uy, state);
        break;
    case 7:
        await pline(`The ${displayLiquidName('water', state)} moves as though of its own will!`);
        if (((state.mvitals?.[PM_WATER_ELEMENTAL]?.mvflags ?? 0) & G_GONE)
            || !await makemonNear(PM_WATER_ELEMENTAL, hero.ux, hero.uy, MM_NOMSG))
            await pline('But it quiets down.');
        break;
    case 8:
        await pline(`Yuk, this ${displayLiquidName('water', state)} tastes awful.`);
        addExperience(1, 0, state);
        await checkExperienceLevel();
        break;
    case 9:
        await pline('Gaggg... this tastes like sewage!  You vomit.');
        await morehungry(rn1(30 - currentAttribute(A_CON, state), 11), { state });
        if (!state.program_state.gameover) await vomit({ state });
        break;
    case 10:
        await pline(`This ${displayLiquidName('water', state)} contains toxic wastes!`);
        if (!heroIsUnchanging(state)) {
            await pline('You undergo a freakish metamorphosis!');
            await polymorphHero(POLY_NOFLAGS);
        }
        break;
    case 11:
        await hearSink('clanking from the pipes...', state);
        break;
    case 12:
        await hearSink('snatches of song from among the sewers...', state);
        break;
    case 13:
        await pline('Ew, what a stench!');
        await releaseSinkGas(state);
        break;
    case 19:
        if (heroIsHallucinating(state)) {
            await pline('From the murky drain, a hand reaches up... --oops--');
            break;
        }
        // A sober hero gets the ordinary sip, including its temperature rolls.
        await ordinarySip(state);
        break;
    default:
        await ordinarySip(state);
        break;
    }
    return outcome(state);
}

async function releaseSewerRat(state: PlayingGameState) {
    if ((state.mvitals?.[PM_SEWER_RAT]?.mvflags ?? 0) & G_GONE) {
        await pline('The sink seems quite dirty.');
        return;
    }
    const monster = await makemonNear(PM_SEWER_RAT, state.u.ux, state.u.uy, MM_NOMSG);
    if (!monster) return;
    const description = heroIsBlind(state) || !canSpotMonster(monster)
        ? 'something squirmy' : monsterName(monster, { article: 'a', state });
    await pline(`Eek!  There's ${description} in the sink!`);
}

async function drinkFaucetPotion(state: PlayingGameState) {
    let source: GameObject;
    for (;;) {
        source = await mkobj(POTION_CLASS, false);
        if (source.otyp !== POT_WATER) break;
        await deleteObject(source, state);
    }
    source.blessed = source.cursed = false;
    try {
        const appearance = OBJ_DESCR(source.otyp, state);
        if (appearance === null) throw new Error(`Potion type ${source.otyp} has no appearance`);
        await pline(`Some ${heroIsBlind(state) ? 'odd' : displayColorName(appearance, state)} liquid flows from the faucet.`);
        if (!heroIsBlind(state) && !heroIsHallucinating(state)) observeObject(source, state);
        source.fromsink = true;
        await drinkPotion(source, { state, consume: false });
    } finally {
        await deleteObject(source, state);
    }
}

async function hearSink(message: string, state: PlayingGameState) {
    await publishHeardMessage(message, pline, state);
}

async function releaseSinkGas(state: PlayingGameState) {
    const { ux, uy } = state.u;
    await createPoisonGasCloud(state, ux, uy, 1, 4);
}

function outcome(state: GameState) {
    return { spentTime: true, heroDied: !!state.program_state.gameover };
}

async function ordinarySip(state: GameState) {
    const temperature = rn2(3) ? rn2(2) ? 'cold' : 'warm' : 'hot';
    await pline(`You take a sip of ${temperature} ${displayLiquidName('water', state)}.`);
}

// ---------------------------------------------------------------------------
// Dipping into a sink (sink_dipping)
// ---------------------------------------------------------------------------

export async function dipSink(object: DipTarget): Promise<void> {
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const location = game.level.requireAt(ux, uy);
    const looted = !!((location.looted ?? 0) & S_LRING);
    const hands = object === 'hands' || object === game.uarmg;
    if (!rn2(looted ? 15 : 25)) {
        await breakSinkAt(ux, uy);
        if (hands && game.u.glibTurns) await pline(`Your ${fingersOrGloves()} are still slippery.`);
        return;
    }
    if (hands) { await washHands(); return; }
    if (object.oclass !== POTION_CLASS) {
        await pline(`You hold ${definiteName(objectCombatName(object, { includeCorpseSpecies: false }))} under the tap.`);
        if (await waterDamageObject(object, [], game, { force: true, publish: pline }) === 'nothing')
            await pline('Nothing seems to happen.');
        return;
    }
    await pline(`You pour ${objectQuantity(object) > 1 ? 'one of ' : ''}${definiteName(objectCombatName(object))} down the drain.`);
    let tryCall = false;
    switch (object.otyp) {
    case POT_POLYMORPH:
        await polymorphSink(game, pline);
        tryCall = true;
        break;
    case POT_OIL:
        await pline(heroIsBlind() ? 'Nothing seems to happen.' : 'It leaves an oily film on the basin.');
        tryCall = !heroIsBlind();
        break;
    case POT_ACID:
        if (!heroIsBlind()) { await pline('The drain seems less clogged.'); tryCall = true; }
        else if (!heroIsDeaf()) { await publishHeardMessage('a sucking sound.', pline); tryCall = true; }
        else await pline('Nothing seems to happen.');
        break;
    case POT_LEVITATION:
        await sinkBacksUp();
        tryCall = true;
        break;
    case POT_OBJECT_DETECTION:
        if (!looted) { await pline('You sense a ring lost down the drain.'); tryCall = true; }
        else await pline('Nothing seems to happen.');
        break;
    case POT_GAIN_LEVEL: case POT_GAIN_ENERGY: case POT_MONSTER_DETECTION:
    case POT_FRUIT_JUICE: case POT_WATER:
        await pline('Nothing seems to happen.');
        break;
    default:
        await pline('A wisp of vapor rises up...');
        if (heroPotionVaporProfile(game).canReceive) await applySupportedPotionVapor({ potion: object });
    }
    if (tryCall && object.dknown) await tryCallObjectType(object);
    await consumeInventoryItem(object);
}

export async function sinkBacksUp(x = game.u.ux, y = game.u.uy): Promise<void> {
    requirePlayingGame(game);
    const sight = heroIsBlind(), deaf = heroIsDeaf();
    const message = !sight ? 'Muddy waste pops up from the drain'
        : !deaf ? 'You hear a sloshing sound' : `Something splashes you in the ${body_part(FACE)}`;
    await pline(`${deaf ? '' : 'Flupp!  '}${message}.`);
    const location = game.level.requireAt(x, y);
    if ((location.looted ?? 0) & S_LRING) return;
    if (!sight) await pline(formatSeenMessage('a ring shining in its midst.'));
    placeCreatedObject(await mkobj(RING_CLASS, true), x, y);
    await newsym(x, y);
    await exerciseAttribute(A_DEX, true);
    await exerciseAttribute(A_WIS, true);
    location.looted = (location.looted ?? 0) | S_LRING;
}
