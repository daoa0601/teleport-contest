// C read.c:seffect_fire(), seffect_earth(), seffect_stinking_cloud(), seffect_amnesia().
import { exerciseWisdom } from './attrib.js';
import { heroIsPunished } from './ball.js';
import { heroHandName } from './body_parts.js';
import { farlookLocationDescription } from './cmd.js';
import { ACCESSIBLE, D_CLOSED, D_LOCKED, DOOR, EXPL_FIERY, In_endgame, In_quest, IS_AIR, IS_OBSTRUCTED, Is_earthlevel, Is_rogue_level, M_SEEN_FIRE, PLNMSG_TOWER_OF_FLAME, isok, } from './const.js';
import { clearMessageWindow, displayLiquidName, plineWithContinuation as pline, shieldeff, } from './display.js';
import { explode } from './explosion.js';
import { dropBoulderOnHero, dropBoulderOnMonster } from './falling_boulder.js';
import { prepareMapPositionHighlights, selectMapPosition, shouldShowGetposTip, showGetposTip } from './getpos.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { finishHeroDeath as defaultHeroDeath } from './end.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { loseHeroHp } from './hero_damage.js';
import { formatHeardMessage } from './hero_speech.js';
import { consumeInventoryItem } from './invent.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { OBJECT_INITIAL_KNOWN, SCR_AMNESIA, SCR_EARTH, SCR_FIRE, SCR_STINKING_CLOUD } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { propertyIsActive } from './properties.js';
import { createPoisonGasCloud } from './regions.js';
import { rn1, rn2, rnd } from './rng.js';
import { sokobanGuilt } from './rock_breakage.js';
import { learnScrollType } from './scroll_discovery.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { drainHeroWeaponSkills } from './skills.js';
import { burnAwayHeroSlime } from './slime.js';
import { loseHeroSpellMemory } from './spell_memory.js';
import { ceilingName } from './terrain_name.js';
import { isLavaAt, isPoolAt, levelHasCeiling } from './terrain_properties.js';
import { cansee } from './vision.js';
export async function applyAreaScrollEffect(source, { state = game, finishHeroDeath = defaultHeroDeath, finishMonsterKill = finishHeroMonsterKillOutcome, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const options = { state, finishHeroDeath, finishMonsterKill };
    switch (source.otyp) {
        case SCR_FIRE: return fireEffect(source, options);
        case SCR_EARTH: return earthEffect(source, options);
        case SCR_STINKING_CLOUD: return cloudEffect(source, state);
        case SCR_AMNESIA: return amnesiaEffect(source, state);
        default: throw new Error(`Unsupported area scroll ${source.otyp}`);
    }
}
async function fireEffect(source, { state, finishHeroDeath }) {
    const blessed = !!source.blessed;
    const confused = (state.u.confusionTurns ?? 0) > 0;
    const alreadyKnown = sourceTypeKnown(source, state);
    let damage = Math.trunc((2 * (rn1(3, 3) + 2 * blessing(source)) + 1) / 3);
    await consumeInventoryItem(source, state);
    if (!alreadyKnown)
        learnScrollType(SCR_FIRE, { state });
    const result = { known: false, consumed: true, heroDied: false };
    const underwater = state.underwater || state.u.uinwater;
    if (confused) {
        if (underwater) {
            await pline(`A little ${displayLiquidName('water', state)} around you vaporizes.`);
        }
        else if (propertyIsActive('fireResistance', state)) {
            await shieldeff(state.u.ux, state.u.uy, state);
            monstersObserveHeroResistance(M_SEEN_FIRE, state);
            await pline(heroIsBlind(state)
                ? `You feel a pleasant warmth in your ${makePlural(heroHandName(state))}.`
                : `Oh, look, what a pretty fire in your ${makePlural(heroHandName(state))}.`);
        }
        else {
            monstersForgetHeroResistance(M_SEEN_FIRE, state);
            await pline(`The scroll catches fire and you burn your ${makePlural(heroHandName(state))}.`);
            result.heroDied = !!await loseHeroHp(1, 'scroll of fire', { state, die: finishHeroDeath });
        }
        return result;
    }
    let center = { x: state.u.ux, y: state.u.uy };
    if (underwater) {
        await pline(`The ${displayLiquidName('water', state)} around you vaporizes violently!`);
    }
    else {
        if (blessed) {
            if (!alreadyKnown)
                await pline('This is a scroll of fire!');
            damage *= 5;
            const selected = await chooseCenter('Where do you want to center the explosion?', state);
            if (selected && canCenterCloud(selected.x, selected.y, state))
                center = selected;
        }
        if (center.x === state.u.ux && center.y === state.u.uy) {
            await pline('The scroll erupts in a tower of flame!');
            state._lastPlineKind = PLNMSG_TOWER_OF_FLAME;
            await burnAwayHeroSlime({ state });
        }
    }
    const explosion = await explode(center.x, center.y, 11, damage, 9, EXPL_FIERY, {
        state, die: finishHeroDeath,
    });
    result.heroDied = explosion.heroDied;
    return result;
}
async function earthEffect(source, options) {
    const { state } = options;
    const result = { known: false, consumed: false, heroDied: false };
    if (Is_rogue_level(state.u.uz) || !levelHasCeiling(state)
        || In_endgame(state.u.uz) && !Is_earthlevel(state.u.uz))
        return result;
    if (state.u.uswallow) {
        const heard = formatHeardMessage('rumbling.', state);
        if (heard)
            await pline(heard);
    }
    else if (In_quest(state.u.uz)) {
        await pline(source.blessed ? 'Avalanches of boulders materialize around you!'
            : 'An avalanche of boulders materializes above you!');
    }
    else {
        await pline(`The ${ceilingName(state.u.ux, state.u.uy, state)} rumbles ${source.blessed ? 'around' : 'above'} you!`);
    }
    result.known = true;
    sokobanGuilt(state);
    const dropOptions = { ...options, confused: (state.u.confusionTurns ?? 0) > 0 };
    let count = 0;
    if (!source.cursed) {
        for (let x = state.u.ux - 1; x <= state.u.ux + 1; x++) {
            for (let y = state.u.uy - 1; y <= state.u.uy + 1; y++) {
                if (!isok(x, y) || x === state.u.ux && y === state.u.uy)
                    continue;
                const location = state.level.at(x, y);
                if (!location)
                    continue;
                if (IS_OBSTRUCTED(location.typ) || IS_AIR(location.typ)
                    || location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)))
                    continue;
                const dropped = await dropBoulderOnMonster(x, y, dropOptions);
                count += Number(dropped.dropped);
                if (dropped.heroDied)
                    return { ...result, heroDied: true };
            }
        }
    }
    if (!source.blessed) {
        const dropped = await dropBoulderOnHero({ ...dropOptions, helmetProtects: !source.cursed });
        result.heroDied = dropped.heroDied;
    }
    else if (!count)
        await pline('But nothing else happens.');
    return result;
}
async function cloudEffect(source, state) {
    const alreadyKnown = sourceTypeKnown(source, state);
    if (!alreadyKnown)
        await pline('You have found a scroll of stinking cloud!');
    const center = await chooseCenter(`Where do you want to center the ${alreadyKnown ? 'stinking ' : ''}cloud?`, state);
    if (!center)
        await pline('Never mind.');
    else if (!canCenterCloud(center.x, center.y, state)) {
        await pline(heroIsHallucinating(state) ? 'Ugh... someone cut the cheese.'
            : `${source.oclass === 9 ? 'The scroll crumbles with' : 'You smell'} a whiff of rotten eggs.`);
    }
    else {
        await createPoisonGasCloud(state, center.x, center.y, 15 + 10 * blessing(source), 8 + 4 * blessing(source));
    }
    return { known: true, consumed: false, heroDied: false };
}
async function amnesiaEffect(source, state) {
    if (heroIsPunished(state))
        state.u.bc_felt = 0;
    if (!source.blessed)
        loseHeroSpellMemory({ state });
    await drainHeroWeaponSkills(rnd(source.blessed ? 3 : 5), state);
    for (const monster of state.level.monsters) {
        if (monster !== state.u.usteed && monster !== state.u.ustuck)
            monster.meverseen = 0;
    }
    for (const monster of state._migratingMonsters || [])
        monster.meverseen = 0;
    if (heroIsHallucinating(state))
        await pline('Your mind releases itself from mundane concerns.');
    else if (/^maud/i.test(state.plname || ''))
        await pline('As your mind turns inward on itself, you forget everything else.');
    else
        await pline(rn2(2) ? 'Who was that Maud person anyway?'
            : 'Thinking of Maud you forget everything else.');
    exerciseWisdom(false, state);
    return { known: true, consumed: false, heroDied: false };
}
function blessing(source) {
    return source.blessed ? 1 : source.cursed ? -1 : 0;
}
function sourceTypeKnown(source, state) {
    return source.oclass === 10 || !!OBJECT_INITIAL_KNOWN[source.otyp]
        || !!state._knownObjectTypes?.has(source.otyp);
}
function canCenterCloud(x, y, state) {
    if (!isok(x, y))
        return false;
    const location = state.level.at(x, y);
    if (!location)
        return false;
    return (ACCESSIBLE(location.typ)
        || isPoolAt(x, y, state) || isLavaAt(x, y, state))
        && cansee(x, y) && (x - state.u.ux) ** 2 + (y - state.u.uy) ** 2 < 32;
}
async function chooseCenter(question, state) {
    await pline(question);
    const valid = (x, y) => canCenterCloud(x, y, state);
    prepareMapPositionHighlights(valid);
    const firstUse = shouldShowGetposTip(state);
    if (firstUse)
        await showGetposTip(state);
    if (firstUse)
        await pline('Move cursor to the desired position:');
    const selected = await selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy },
        prompt: firstUse ? 'Move cursor to the desired position:'
            : state.flags.verbose ? `${question}  (For instructions type a '?')` : question,
        goal: 'the desired position', describe: farlookLocationDescription,
        isValidLocation: valid,
        highlightHero: false,
    });
    clearMessageWindow();
    return selected;
}
//# sourceMappingURL=scroll_area_effects.js.map