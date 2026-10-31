// Fountain drinking, dipping, drying, warnings, and water effects.
// C refs: fountain.c drinkfountain()/dipfountain()/dowatersnakes()/
// dowaterdemon()/dowaternymph()/dofindgem()/dogushforth()/dryup() and
// sit.c dosit().
import { monsterHasMapPosition } from './monster_location.js';
import { A_CON, A_MAX, A_STR, A_WIS, DOOR, F_LOOTED, FOUNTAIN, F_WARNED, G_GONE, MM_NOMSG, MON_FLOOR, POOL, ROOM, SDOOR, } from './const.js';
import { heroArmName, monsterArmName, monsterHeadName } from './body_parts.js';
import { displayLiquidName, glyphAt, newsym, randomDisplayMonsterName, } from './display.js';
import { pline, plineWithContinuation } from './pline.js';
import { displayMessageWindow, flushPendingTopline } from './tty_topline.js';
import { deleteEngravingAt } from './engrave.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame, requirePlayingGame, } from './gstate.js';
import { washHands } from './dip_water.js';
import { dipFountainSword } from './fountain_sword.js';
import { applyDippedCoinFate, applyFountainDemonActor, applyFountainGemDiscovery, applyFountainNymphActor, applyFountainSnakeActors, resolveDippedSensationFate, } from './fountain_effects.js';
import { countLevelFeatures, deleteFloorTrap, makemonNear, splitHeroMonsterForm } from './mklev.js';
import { mkgold, mksobj } from './mkobj.js';
import { placeCreatedObject } from './floor_object.js';
import { rndClass } from './objnam.js';
import { resolveMonsterLiquid } from './mon.js';
import { angerWatchGuards } from './monster_anger.js';
import { makeMonsterFlee } from './monster_flee.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { finishLiquidDeathForCurrentMover } from './hero_monster_death.js';
import { monsterName, monsterPossessive, monsterSubjectPronoun } from './monster_name.js';
import { level_difficulty } from './dungeon.js';
import { grantMonsterWish } from './potion_occupants.js';
import { BOULDER, DILITHIUM_CRYSTAL, LUCKSTONE } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { promptYesNo } from './query.js';
import { inTown } from './room.js';
import { rnd, rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap, waterDamageChain, waterDamageObject } from './trap.js';
import { cansee, clearAreaCells, couldsee } from './vision.js';
import { curseObject, uncurseObjectState } from './object_state.js';
import { adjustObjectLightAfterBlessing, objectLightRadius } from './light.js';
import { floatingAbove } from './levitation_commands.js';
import { formatFeltMessage, formatSeenMessage } from './hero_speech.js';
import { spendHeroNutrition, updateHeroHunger } from './hunger.js';
import { vomitHero } from './hero_illness.js';
import { showEnlightenment } from './insight.js';
import { fruitName } from './fruit.js';
import { loseHeroHp } from './hero_damage.js';
import { poisonHeroStrengthAndHp } from './poison.js';
import { detectMonsters } from './magic_detection.js';
import { grantIntrinsicProperty, propertyIsActive } from './properties.js';
import { adjustAttribute, ATTRIBUTE_DISPLAY_ORDER, attributeChangeMessage, exerciseAttribute, exerciseWisdom, } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { heroGoldAmount, setHeroGoldAmount } from './hero_gold.js';
import { someGold } from './monster_gold_theft.js';
const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;
const M1_NOLIMBS = 0x00006000;
export async function dryFountainAt(x, y, { causedByHero = true, random = rn2, state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    if (location?.typ !== FOUNTAIN)
        return false;
    const dries = random(3) === 0;
    const alreadyWarned = !!((location.looted ?? 0) & F_WARNED);
    if (!dries && !alreadyWarned)
        return false;
    if (causedByHero && inTown(level, x, y) && !alreadyWarned) {
        location.looted = (location.looted ?? 0) | F_WARNED;
        await warnAboutFountain(state, publish);
        return false;
    }
    if (causedByHero && state.flags.debug
        && await promptYesNo('Dry up fountain?') === 'n')
        return false;
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
async function warnAboutFountain(state, publish) {
    const watch = [...requireGameLevel(state).monsters].reverse().find(monster => !monster.dead && monster.mhp > 0 && monster.mpeaceful
        && (monster.mstate ?? MON_FLOOR) === MON_FLOOR
        && (monster.mnum === PM_WATCHMAN || monster.mnum === PM_WATCH_CAPTAIN)
        && couldsee(monster.mx, monster.my));
    if (!watch) {
        await publish('The flow reduces to a trickle.');
        return;
    }
    const name = monsterName(watch, { article: 'a', capitalized: true, state });
    if (heroIsDeaf(state)) {
        const limbless = ((MONSTER_FLAGS1[watch.mnum] ?? 0) & M1_NOLIMBS) === M1_NOLIMBS;
        const part = limbless ? monsterHeadName(watch.mnum)
            : makePlural(monsterArmName(watch.mnum));
        await publish(`${name} earnestly ${limbless ? 'shakes' : 'waves'} ${monsterPossessive(watch, { state })} ${part}!`);
    }
    else {
        await publish(`${name} yells:`);
        await publish('"Hey, stop using that fountain!"');
    }
}
export async function splitSittingGremlin() {
    const clone = await splitHeroMonsterForm(game);
    if (!clone)
        return null;
    await plineWithContinuation('You multiply!');
    await dryFountainAt(game.u.ux, game.u.uy);
    return clone;
}
// Gushing water along line of sight from an overflowing fountain.
// C refs: fountain.c dogushforth() and gush().
export async function gushForthFromFountain({ drinking = false, state = game } = {}) {
    const level = requireGameLevel(state);
    const ux = state.u.ux;
    const uy = state.u.uy;
    let madePool = 0;
    for (const { x, y } of await clearAreaCells(ux, uy, 7)) {
        if (((x + y) % 2) || (x === ux && y === uy)
            || rn2(1 + distmin(ux, uy, x, y)))
            continue;
        const location = state.level?.at?.(x, y);
        const objects = state.level?.objects?.[x]?.[y] || [];
        if (location?.typ !== ROOM || objects.some(object => object.otyp === BOULDER)
            || nextToDoor(x, y, state)) {
            continue;
        }
        const trap = state.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
        if (trap && !await deleteFloorTrap(trap, state))
            continue;
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
        }
        else {
            await newsym(x, y);
        }
    }
    if (!madePool) {
        await plineWithContinuation(drinking
            ? 'Your thirst is quenched.'
            : 'Water sprays all over you.');
    }
}
function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
function nextToDoor(x, y, state) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const typ = state.level?.at?.(x + dx, y + dy)?.typ;
            if (typ === DOOR || typ === SDOOR)
                return true;
        }
    }
    return false;
}
const PM_WATER_NYMPH = 68;
const PM_WATER_DEMON = 289;
const PM_WATER_MOCCASIN = 216;
// C fountain.c:dofindgem().
async function discoverFountainGem(loc) {
    return applyFountainGemDiscovery({
        loc,
        blind: heroIsBlind(),
        announce: (message) => pline(message),
        chooseGem: () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1),
        createGem: (gemType) => mksobj(gemType, false, false),
        placeGem: (gem) => placeCreatedObject(gem, game.u.ux, game.u.uy),
        repaint: async () => await newsym(game.u.ux, game.u.uy),
        exerciseWisdom,
    });
}
function fountainActorGone(mnum) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE);
}
function fountainActorIndefiniteName(monster) {
    return monsterName(monster, { article: 'a' });
}
function fountainActorVisibleSubject(monster) {
    return monsterName(monster, { capitalized: true });
}
function fountainTrapAt(monster) {
    return game.level?.traps?.some(trap => trap.tx === monster.mx && trap.ty === monster.my) ?? false;
}
async function triggerFountainTrap(monster) {
    const state = requireInitializedGame();
    const action = await triggerImmediateMonsterTrap(monster, state);
    if (!state.program_state.gameover) {
        await finishImmediateMonsterTrap(action, state, {
            describeMonster: fountainActorVisibleSubject,
            publish: plineWithContinuation,
        });
    }
    return { heroDied: !!state.program_state.gameover };
}
// C fountain.c:dowaternymph().
async function summonFountainNymph() {
    return applyFountainNymphActor({
        gone: fountainActorGone(PM_WATER_NYMPH),
        blind: heroIsBlind(),
        createMonster: async () => {
            const nymph = await makemonNear(PM_WATER_NYMPH, game.u.ux, game.u.uy, MM_NOMSG);
            if (nymph)
                await newsym(nymph.mx, nymph.my);
            return nymph;
        },
        announce: plineWithContinuation,
        nymphDescription: fountainActorIndefiniteName,
        trapAt: fountainTrapAt,
        triggerTrap: triggerFountainTrap,
    });
}
// C fountain.c:dowaterdemon().
async function summonFountainDemon() {
    return applyFountainDemonActor({
        gone: fountainActorGone(PM_WATER_DEMON),
        blind: heroIsBlind(),
        difficulty: level_difficulty(),
        createMonster: async () => {
            const demon = await makemonNear(PM_WATER_DEMON, game.u.ux, game.u.uy, MM_NOMSG);
            if (demon)
                await newsym(demon.mx, demon.my);
            return demon;
        },
        announce: plineWithContinuation,
        demonIndefiniteName: fountainActorIndefiniteName,
        demonPronouns: monster => ({
            possessive: monsterPossessive(monster),
            pronoun: monsterSubjectPronoun(monster),
        }),
        grantWish: (demon) => grantMonsterWish(demon),
        trapAt: fountainTrapAt,
        triggerTrap: triggerFountainTrap,
    });
}
// C fountain.c:dowatersnakes().
async function summonFountainSnakes() {
    return applyFountainSnakeActors({
        gone: fountainActorGone(PM_WATER_MOCCASIN),
        blind: heroIsBlind(),
        hallucinating: heroIsHallucinating(),
        random: rn2,
        hallucinatedPlural: () => makePlural(randomDisplayMonsterName()),
        // dowatersnakes() owns the first ordinary pline; only a later dryup
        // line enters the branch-scoped continuation path below.
        announce: pline,
        createMonster: async () => {
            const snake = await makemonNear(PM_WATER_MOCCASIN, game.u.ux, game.u.uy, MM_NOMSG);
            if (snake)
                await newsym(snake.mx, snake.my);
            return snake;
        },
        trapAt: fountainTrapAt,
        triggerTrap: triggerFountainTrap,
    });
}
// C fountain.c:drinkfountain().
export async function drinkFountain(loc) {
    let fountainMessage = '';
    const blessed = !!loc.blessedftn;
    const fate = rnd(30);
    if (propertyIsActive('levitation')) {
        await floatingAbove('fountain');
        return false;
    }
    if (blessed && (game.u.uluck ?? 0) >= 0 && fate >= 10) {
        await blessedFountainDraught(loc);
        return false;
    }
    if (fate < 10) {
        // fountain.c:drinkfountain() handles the ordinary low-fate draught
        // before its numbered switch.  Nutrition is credited before dryup()
        // and the elapsed-turn scheduler applies its normal hunger cost.
        await plineWithContinuation('The cool draught refreshes you.');
        game.u.uhunger = (game.u.uhunger ?? 900) + rnd(10);
        await updateHeroHunger(false);
        if (game.program_state.gameover)
            return true;
        if (blessed)
            return false;
    }
    else if (fate === 19) {
        await plineWithContinuation(formatFeltMessage('self-knowledgeable...'));
        await flushPendingTopline();
        await showEnlightenment({ basic: false, magic: true });
        await exerciseAttribute(A_WIS, true);
        await plineWithContinuation('The feeling subsides.');
    }
    else if (fate === 20) {
        await plineWithContinuation('The water is foul!  You gag and vomit.');
        // C refs: fountain.c:drinkfountain(), eat.c:vomit(), and
        // allmain.c:moveloop_core().  Foul water first removes 11..30 points
        // of nutrition, then nomul(-2) makes the next two global turns happen
        // without accepting a hero command.
        await spendHeroNutrition(11 + rn2(20));
        if (game.program_state.gameover)
            return true;
        await vomitHero({ state: game });
        if (game.program_state.gameover)
            return true;
    }
    else if (fate === 21) {
        await plineWithContinuation('The water is contaminated!');
        if (game.u.poisonResistance) {
            await plineWithContinuation(`Perhaps it is runoff from the nearby ${fruitName(false)} farm.`);
            if (await loseHeroHp(rnd(4), 'unrefrigerated sip of juice'))
                return true;
        }
        else {
            if (await poisonHeroStrengthAndHp(3 + rn2(4), rnd(10), 'contaminated water', { deathCause: 'killed by contaminated water' }))
                return true;
            await exerciseAttribute(A_CON, false);
        }
    }
    else if (fate === 22) {
        await summonFountainSnakes();
    }
    else if (fate === 23) {
        await summonFountainDemon();
    }
    else if (fate === 24) {
        await plineWithContinuation("This water's no good!");
        await spendHeroNutrition(11 + rn2(20));
        if (game.program_state.gameover)
            return true;
        await exerciseAttribute(A_CON, false);
        // A curse can drop the offhand weapon and change the inventory.
        for (const object of [...game.inventory]) {
            if (object.oclass !== 12 && !object.cursed && !rn2(5)) {
                await curseObject(object);
                if (game.program_state.gameover)
                    return true;
            }
        }
    }
    else if (fate === 25) {
        if (heroIsBlind()) {
            if (propertyIsActive('invisible') && !propertyIsActive('seeInvisible')) {
                await plineWithContinuation('You feel transparent.');
            }
            else {
                await plineWithContinuation('You feel very self-conscious.');
                await plineWithContinuation('Then it passes.');
            }
        }
        else {
            await plineWithContinuation(formatSeenMessage('an image of someone stalking you.'));
            await plineWithContinuation('But it disappears.');
        }
        grantIntrinsicProperty('seeInvisible', 'outside');
        await newsym(game.u.ux, game.u.uy);
        await exerciseAttribute(A_WIS, true);
    }
    else if (fate === 26) {
        if ((await detectMonsters(null)).result)
            await plineWithContinuation(`The ${displayLiquidName('water')} tastes like nothing.`);
        await exerciseAttribute(A_WIS, true);
    }
    else if (fate === 27 && !((loc.looted ?? 0) & 1)) {
        await discoverFountainGem(loc);
    }
    else if (fate === 27 || fate === 28) {
        await summonFountainNymph();
    }
    else if (fate === 29) {
        await plineWithContinuation(`This ${displayLiquidName('water')} gives you bad breath!`);
        for (const monster of [...requireGameLevel().monsters].reverse()) {
            if (monster.dead || monster.mhp <= 0)
                continue;
            if ((await makeMonsterFlee(monster, { announce: false })).heroDied)
                return true;
        }
    }
    else if (fate === 30) {
        await gushForthFromFountain({ drinking: true });
    }
    else if (fate >= 10) {
        fountainMessage =
            `This tepid ${displayLiquidName('water')} is tasteless.`;
    }
    if (game.program_state.gameover)
        return true;
    if (fountainMessage)
        await plineWithContinuation(fountainMessage);
    await dryFountainAt(game.u.ux, game.u.uy);
    return false;
}
// C fountain.c:drinkfountain(): the blessed fountain draught.
async function blessedFountainDraught(loc) {
    requirePlayingGame(game);
    const state = game;
    const hero = state.u;
    await plineWithContinuation('Wow!  This makes you feel great!');
    for (const attribute of ATTRIBUTE_DISPLAY_ORDER) {
        if (hero.acurr.a[attribute] < hero.amax.a[attribute]) {
            hero.acurr.a[attribute] = hero.amax.a[attribute];
            state.context.botl = true;
        }
    }
    const littleLuck = (hero.uluck ?? 0) < 4;
    const start = rn2(A_MAX);
    for (let offset = 0; offset < A_MAX; offset++) {
        const attribute = (start + offset) % A_MAX;
        const change = adjustAttribute(attribute, 1, state);
        if (change.changed || !littleLuck
            && (change.blockedByDunceCap || state.flags.verbose !== false)) {
            const message = attributeChangeMessage(attribute, change, state);
            if (message)
                await plineWithContinuation(message);
        }
        if (change.changed && state._moveloopStarted
            && (attribute === A_STR || attribute === A_CON))
            await reportHeroEncumbrance(state);
        if (change.changed && littleLuck)
            break;
    }
    await displayMessageWindow();
    await plineWithContinuation('A wisp of vapor escapes the fountain...');
    await exerciseAttribute(A_WIS, true);
    loc.blessedftn = 0;
}
// C fountain.c:dipfountain().
export async function dipFountain(object, loc) {
    if (propertyIsActive('levitation')) {
        await floatingAbove('fountain');
        return;
    }
    if (object !== 'hands' && await dipFountainSword(object, loc))
        return;
    const result = object === 'hands' || object === game.uarmg ? await washHands()
        : await waterDamageObject(object, [], game, { force: true, publish: plineWithContinuation });
    if (result === 'destroyed' || result !== 'nothing' && rn2(2) === 0) {
        return;
    }
    const fate = rnd(30);
    let eventMessage = '';
    if (fate >= 16 && fate <= 20) {
        if (fate === 16) {
            if (object !== 'hands' && object.oclass !== 12 && !object.cursed)
                await curseObject(object);
        }
        else if (object !== 'hands' && object.cursed) {
            if (!heroIsBlind())
                await plineWithContinuation(`The ${displayLiquidName('water')} glows for a moment.`);
            const oldRadius = objectLightRadius(object);
            uncurseObjectState(object);
            await adjustObjectLightAfterBlessing(object, oldRadius);
        }
        else {
            await plineWithContinuation('A feeling of loss comes over you.');
        }
        if (!game.program_state.gameover)
            await dryFountainAt(game.u.ux, game.u.uy);
        return;
    }
    const sensationEffect = resolveDippedSensationFate({
        fate,
        armName: () => heroArmName(game),
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
        createGold: async (quantity) => {
            await mkgold(quantity, game.u.ux, game.u.uy);
        },
        liquidName: () => displayLiquidName('water'),
        exerciseWisdom,
        repaint: async () => await newsym(game.u.ux, game.u.uy),
    });
    if (sensationEffect.handled) {
        eventMessage = sensationEffect.message;
    }
    else if (coinEffect.handled) {
        eventMessage = coinEffect.message;
    }
    else if (fate === 21) {
        await summonFountainDemon();
    }
    else if (fate === 22) {
        await summonFountainNymph();
    }
    else if (fate === 23) {
        await summonFountainSnakes();
    }
    else if (fate === 24) {
        if ((loc.looted ?? 0) & F_LOOTED)
            await gushForthFromFountain();
        else
            await discoverFountainGem(loc);
    }
    else if (fate === 25) {
        await gushForthFromFountain();
    }
    else if (fate === 28) {
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
    }
    else if ((fate < 16 || fate === 30) && result === 'nothing') {
        eventMessage = 'Nothing seems to happen.';
    }
    if (game.program_state.gameover)
        return;
    if (eventMessage)
        await plineWithContinuation(eventMessage);
    await dryFountainAt(game.u.ux, game.u.uy);
}
//# sourceMappingURL=fountain.js.map