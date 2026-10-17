import { formatFeltMessage } from './hero_speech.js';
// C potion.c: bodily quaff effects. The drink transaction owns the bottle.
import { adjustAttribute, exerciseAttribute } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { heroFaceName } from './body_parts.js';
import { A_CON, A_MAX, A_STR, A_WIS, POLY_CONTROLLED, POLY_LOW_CTRL, POLY_NOFLAGS } from './const.js';
import { displayLiquidName, plineWithContinuation } from './display.js';
import { canHeroRiseUp, levelAtDepth } from './dungeon.js';
import { gainExperienceLevel, randomExperience } from './exper.js';
import { fruitName } from './fruit.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { depth, ledgerNo } from './hacklib.js';
import { loseHeroHp } from './hero_damage.js';
import { healHero } from './hero_healing.js';
import { cureHeroSicknessWithMessages } from './hero_illness.js';
import { makeHallucinated } from './hero_mental_status.js';
import { updateHeroHunger } from './hunger.js';
import { gotoLevel } from './level_change.js';
import { MONSTER_NAME, monsterHatesBlessings } from './monster_data.js';
import { POT_ACID, POT_GAIN_LEVEL, POT_OIL, POT_POLYMORPH, POT_SICKNESS, POT_WATER } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { poisonAttributeMessage } from './poison.js';
import { heroIsPolymorphed, heroIsUnchanging, polymorphHero } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { burnAwayHeroSlime, heroIsFlaming } from './slime.js';
import { fixHeroPetrification } from './stoning.js';
import { ceilingName } from './terrain_name.js';
import { applyHeroWereChange, purifyHeroLycanthropy, revertHeroWereForm, setHeroLycanthropy } from './were.js';
export async function applyPotionBodyEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let unknown = 0;
    let heroDied = false;
    switch (source.otyp) {
        case POT_WATER:
            unknown = Number(!!(source.blessed || source.cursed));
            heroDied = await drinkWater(source, state);
            break;
        case POT_SICKNESS:
            heroDied = await drinkSickness(source, state);
            break;
        case POT_OIL:
            heroDied = await drinkOil(source, state);
            break;
        case POT_ACID:
            unknown = 1;
            heroDied = await drinkAcid(source, state);
            break;
        case POT_POLYMORPH:
            heroDied = await drinkPolymorph(source, state);
            break;
        case POT_GAIN_LEVEL:
            unknown = Number(!!source.cursed);
            await drinkGainLevel(source, state);
            heroDied = !!state.program_state.gameover;
            break;
        default:
            return { handled: false, unknown: 0, nothing: false, heroDied: false };
    }
    return { handled: true, unknown, nothing: false, heroDied };
}
function halfPhysical(amount, state) {
    return state.u.halfPhysicalDamage
        ? Math.ceil(amount / 2) : amount;
}
async function drinkWater(source, state) {
    const hero = state.u;
    if (!source.blessed && !source.cursed) {
        await plineWithContinuation(`This tastes like ${displayLiquidName('water', state)}.`);
        hero.uhunger += rnd(10);
        await updateHeroHunger(false, { state });
        return !!state.program_state.gameover;
    }
    const hostileBody = monsterHatesBlessings({
        mnum: hero.umonnum,
        ...(hero.mcham === undefined ? {} : { cham: hero.mcham }),
    });
    if (hostileBody || hero.ualign.type === -1) {
        if (source.blessed) {
            await plineWithContinuation(`This burns like ${displayLiquidName('acid', state)}!`);
            await exerciseAttribute(A_CON, false, state);
            if (hero.ulycn >= 0) {
                const wereName = MONSTER_NAME[hero.ulycn];
                if (wereName === undefined)
                    throw new Error(`Unknown lycanthrope species ${hero.ulycn}`);
                await plineWithContinuation(`Your affinity to ${makePlural(wereName)} disappears!`);
                if (hero.umonnum === hero.ulycn)
                    await revertHeroWereForm({ state });
                if (state.program_state.gameover)
                    return true;
                setHeroLycanthropy(-1, state);
            }
            return loseHeroHp(halfPhysical(d(2, 6), state), 'potion of holy water', { state });
        }
        await plineWithContinuation(formatFeltMessage('quite proud of yourself.', state));
        await healHero(d(2, 6), 0, { state });
        if (hero.ulycn >= 0 && !heroIsPolymorphed(state))
            await applyHeroWereChange({ state });
        if (state.program_state.gameover)
            return true;
        await exerciseAttribute(A_CON, true, state);
        return !!state.program_state.gameover;
    }
    if (source.blessed) {
        await plineWithContinuation(formatFeltMessage('full of awe.', state));
        await cureHeroSicknessWithMessages(state);
        await exerciseAttribute(A_WIS, true, state);
        await exerciseAttribute(A_CON, true, state);
        if (hero.ulycn >= 0)
            await purifyHeroLycanthropy({ state });
    }
    else {
        if (hero.ualign.type === 1) {
            await plineWithContinuation(`This burns like ${displayLiquidName('acid', state)}!`);
            if (await loseHeroHp(halfPhysical(d(2, 6), state), 'potion of unholy water', { state }))
                return true;
        }
        else
            await plineWithContinuation(formatFeltMessage('full of dread.', state));
        if (hero.ulycn >= 0 && !heroIsPolymorphed(state))
            await applyHeroWereChange({ state });
        if (state.program_state.gameover)
            return true;
        await exerciseAttribute(A_CON, false, state);
    }
    return !!state.program_state.gameover;
}
async function drinkSickness(source, state) {
    const hero = state.u;
    await plineWithContinuation('Yecch!  This stuff tastes like poison.');
    const healer = state.urole.key === 'healer';
    if (source.blessed) {
        await plineWithContinuation(`(But in fact it was mildly stale ${fruitName(true, state)}.)`);
        if (!healer && await loseHeroHp(1, 'mildly contaminated potion', { state }))
            return true;
    }
    else {
        const resisted = propertyIsActive('poisonResistance', state);
        if (resisted)
            await plineWithContinuation(`(But in fact it was biologically contaminated ${fruitName(true, state)}.)`);
        if (healer)
            await plineWithContinuation('Fortunately, you have been immunized.');
        else {
            const attribute = rn2(A_MAX);
            const contaminant = `${resisted ? 'mildly ' : ''}contaminated ${source.fromsink ? 'tap water' : 'potion'}`;
            if (!hero.fixedAbilities && !propertyIsActive('sustainAbility', state)) {
                await plineWithContinuation(poisonAttributeMessage(attribute, state, false));
                const change = adjustAttribute(attribute, resisted ? -1 : -rn1(4, 3), state);
                if (change.changed && state._moveloopStarted
                    && (attribute === A_STR || attribute === A_CON))
                    await reportHeroEncumbrance(state);
            }
            const damage = resisted ? 1 + rn2(2) : rnd(10) + 5 * Number(!!source.cursed);
            if (await loseHeroHp(damage, contaminant, {
                state,
                deathCause: source.fromsink ? `killed by ${contaminant}` : null,
            }))
                return true;
            await exerciseAttribute(A_CON, false, state);
        }
    }
    if (heroIsHallucinating(state)) {
        await plineWithContinuation('You are shocked back to your senses!');
        await makeHallucinated(0, { state, talk: false });
    }
    return !!state.program_state.gameover;
}
async function drinkOil(source, state) {
    let good = false;
    if (source.lamplit) {
        if (heroIsFlaming(state)) {
            await plineWithContinuation('Ahh, a refreshing drink.');
            good = true;
        }
        else {
            await plineWithContinuation(`You burn your ${heroFaceName(state)}.`);
            const vulnerable = !propertyIsActive('fireResistance', state)
                || propertyIsActive('coldResistance', state);
            const killer = 'quaffing a burning potion of oil';
            if (await loseHeroHp(d(vulnerable ? 4 : 2, 4), killer, {
                state, deathCause: `killed by ${killer}`,
            }))
                return true;
        }
        await burnAwayHeroSlime({ state });
    }
    else
        await plineWithContinuation(source.cursed ? 'This tastes like castor oil.' : 'That was smooth!');
    await exerciseAttribute(A_WIS, good, state);
    return !!state.program_state.gameover;
}
async function drinkAcid(source, state) {
    if (propertyIsActive('acidResistance', state))
        await plineWithContinuation(`This tastes ${heroIsHallucinating(state) ? 'tangy' : 'sour'}.`);
    else {
        await plineWithContinuation(`This burns${source.blessed ? ' a little' : source.cursed ? ' a lot' : ' like acid'}!`);
        const damage = halfPhysical(d(source.cursed ? 2 : 1, source.blessed ? 4 : 8), state);
        if (await loseHeroHp(damage, 'potion of acid', { state }))
            return true;
        await exerciseAttribute(A_CON, false, state);
    }
    await fixHeroPetrification({ state });
    return !!state.program_state.gameover;
}
async function drinkPolymorph(source, state) {
    await plineWithContinuation(formatFeltMessage(`a little ${heroIsHallucinating(state) ? 'normal' : 'strange'}.`, state));
    if (heroIsUnchanging(state))
        return false;
    const controlled = source.blessed && !heroIsPolymorphed(state);
    const result = await polymorphHero(controlled ? POLY_CONTROLLED | POLY_LOW_CTRL : POLY_NOFLAGS);
    if (controlled && state.u.mtimedone && heroIsPolymorphed(state))
        state.u.mtimedone = Math.min(state.u.mtimedone, rn2(15) + 10);
    return !!result?.died || !!state.program_state.gameover;
}
async function drinkGainLevel(source, state) {
    if (!source.cursed) {
        await gainExperienceLevel({ state });
        if (source.blessed)
            state.u.uexp = randomExperience({ gaining: true, state });
        return;
    }
    const hero = state.u;
    const firstLevel = ledgerNo(hero.uz) === 1;
    if (!(firstLevel ? hero.uhave.amulet : canHeroRiseUp(hero.ux, hero.uy, { state }))) {
        await plineWithContinuation('You have an uneasy feeling.');
        return;
    }
    const destination = firstLevel ? state.earth_level : levelAtDepth(depth(hero.uz) - 1, { state });
    if (!destination)
        throw new Error('Gain-level potion requires its destination level.');
    if (destination.dnum === hero.uz.dnum && destination.dlevel === hero.uz.dlevel) {
        await plineWithContinuation('It tasted bad.');
        return;
    }
    await plineWithContinuation(`You rise up, through the ${ceilingName(hero.ux, hero.uy, state)}!`);
    await gotoLevel(destination);
}
//# sourceMappingURL=potion_body_effects.js.map