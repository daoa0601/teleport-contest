// C fountain.c:drinksink(). Admission and action time belong to quaffing.
import { currentAttribute, exerciseWisdom } from './attrib.js';
import {
    A_CON, G_GONE, MM_NOMSG, M_SEEN_FIRE,
    POLY_NOFLAGS, S_LRING,
} from './const.js';
import {
    canSpotMonster, displayColorName, displayLiquidName, newsym,
    plineWithContinuation as pline,
} from './display.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { placeCreatedObject } from './floor_object.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { vomitHero } from './hero_illness.js';
import { heroIsUnaware } from './hero_sleep.js';
import { spendHeroNutrition } from './hunger.js';
import { floatingAbove } from './levitation_commands.js';
import { makemonNear, mkobj } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { deleteObject } from './object_delete.js';
import { OBJECT_DESCRIPTIONS, POT_WATER, requireObjectData } from './object_data.js';
import { observeObject } from './object_knowledge.js';
import { heroIsUnchanging, polymorphHero } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { drinkPotion } from './quaff.js';
import { createPoisonGasCloud } from './regions.js';
import { rn1, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { breakSinkAt } from './sink_terrain.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';

const PM_SEWER_RAT = MONSTER_NAME.indexOf('sewer rat');
const PM_WATER_ELEMENTAL = MONSTER_NAME.indexOf('water elemental');
const POTION_CLASS = 8;
const RING_CLASS = 4;

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
            newsym(hero.ux, hero.uy);
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
        await spendHeroNutrition(rn1(30 - currentAttribute(A_CON, state), 11), { state });
        if (!state.program_state.gameover) await vomitHero({ state });
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
        const appearance = state.objectDescriptions?.[source.otyp] ?? requireObjectData(OBJECT_DESCRIPTIONS, source.otyp);
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
    const unaware = heroIsUnaware(state);
    if (heroIsDeaf(state) && !unaware || state.flags.acoustics === false) return;
    const prefix = state.u.uinwater || state.underwater ? 'You barely hear'
        : unaware ? 'You dream that you hear' : 'You hear';
    await pline(`${prefix} ${message}`);
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
