import { formatFeltMessage } from './hero_speech.js';
import type { GameObject } from './object_types.js';
import type { PlayingGameState } from './game_state.js';
import type { PotionEffectOptions, PotionEffectResult } from './potion_types.js';
// Native potion.c:peffects(). Selection, naming, and useup belong to quaff.js.
import { exerciseAttribute, restoreHeroBaseAttributes } from './attrib.js';
import { A_CON, A_DEX, A_STR, A_WIS, COLNO, ROWNO, TIMEOUT, WEAK } from './const.js';
import { plineWithContinuation as pline, see_monsters, unmap_invisible } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { gainExperienceLevel } from './exper.js';
import { fruitName } from './fruit.js';
import { healHero } from './hero_healing.js';
import { heroIsSick, heroIsVomiting } from './hero_illness.js';
import { applyPotionLikeInvisibility, hasInternalInvisibility, heroIsInvisible } from './hero_invisibility.js';
import { healHeroLegs } from './hero_legs.js';
import { makeHallucinated } from './hero_mental_status.js';
import { grantHeroSeeInvisible } from './hero_seeing.js';
import { speedUpHero } from './hero_speed.js';
import { heroIsStrangled } from './hero_strangulation.js';
import { updateHeroHunger } from './hunger.js';
import { applyLevitationPotion } from './levitation_potion.js';
import { detectMonsters, detectObjects } from './magic_detection.js';
import { aggravateMonsters } from './monster_anger.js';
import { monsterAtPosition } from './monster_location.js';
import {
    POT_RESTORE_ABILITY, POT_FRUIT_JUICE, POT_SEE_INVISIBLE, POT_SPEED,
    POT_MONSTER_DETECTION, POT_OBJECT_DETECTION, POT_INVISIBILITY,
    POT_LEVITATION, POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING,
    POT_GAIN_ENERGY, SPE_DETECT_MONSTERS, SPE_DETECT_TREASURE,
    SPE_HASTE_SELF, SPE_INVISIBILITY, SPE_LEVITATION, SPE_RESTORE_ABILITY,
} from './object_data.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, hasPermanentIntrinsicProperty, propertyIsActive } from './properties.js';
import { d, rn1, rn2 } from './rng.js';
import { heroDetectsMonsters, heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { heroIsSliming } from './slime.js';
import { heroIsPetrifying } from './stoning.js';
import { applyPotionBodyEffect } from './potion_body_effects.js';
import { applyPotionMentalEffect } from './potion_mental_effects.js';

export async function applyPotionEffect(source: GameObject, { state = game }: PotionEffectOptions = {}): Promise<PotionEffectResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    let result: -1 | 0 | 1 = -1;
    let unknown = 0, nothing = false;
    const blessing = source.blessed ? 1 : source.cursed ? -1 : 0;
    switch (source.otyp) {
    case POT_RESTORE_ABILITY:
    case SPE_RESTORE_ABILITY:
        unknown++;
        await restoreAbility(source, state);
        break;
    case POT_FRUIT_JUICE:
    case POT_SEE_INVISIBLE:
        unknown = await seeInvisible(source, state);
        break;
    case POT_SPEED:
    case SPE_HASTE_SELF:
        if (source.otyp === POT_SPEED && (state.u._woundedLegTurns ?? 0) > 0
            && !source.cursed && !state.u.usteed) {
            await healHeroLegs(state);
            unknown++;
        } else {
            await speedUpHero(rn1(10, 100 + 60 * blessing), state);
            if (source.otyp === POT_SPEED && !source.cursed
                && !hasPermanentIntrinsicProperty('fast', state)) {
                await pline('Your quickness feels very natural.');
                grantIntrinsicProperty('fast', 'outside', state);
            }
        }
        break;
    case POT_MONSTER_DETECTION:
    case SPE_DETECT_MONSTERS: {
        const effect = await monsterDetection(source, state);
        ({ unknown, nothing } = effect);
        if (effect.result) result = 1;
        break;
    }
    case POT_OBJECT_DETECTION:
    case SPE_DETECT_TREASURE: {
        const detected = await detectObjects(source, { state });
        if (detected.result) result = 1;
        else await exerciseAttribute(A_WIS, true, state);
        break;
    }
    case POT_INVISIBILITY:
    case SPE_INVISIBILITY: {
        const effect = await applyPotionLikeInvisibility({ state,
            spell: source.otyp === SPE_INVISIBILITY,
            blessed: !!source.blessed, cursed: !!source.cursed });
        nothing = !effect.showedInvisibility && !effect.blocked;
        if (effect.aggravates) aggravateMonsters(state);
        break;
    }
    case POT_LEVITATION:
    case SPE_LEVITATION: {
        const effect = await applyLevitationPotion(source, { state });
        nothing = effect.nothingHappened;
        break;
    }
    case POT_HEALING:
        await pline(formatFeltMessage('better.', state));
        await healHero(8 + d(4 + 2 * blessing, 4), source.cursed ? 0 : 1,
            { state, cureSickness: !!source.blessed, cureBlindness: !source.cursed });
        await exerciseAttribute(A_CON, true, state);
        break;
    case POT_EXTRA_HEALING:
        await pline(formatFeltMessage('much better.', state));
        await healHero(16 + d(4 + 2 * blessing, 8), source.blessed ? 5 : source.cursed ? 0 : 2,
            { state, cureSickness: !source.cursed, cureBlindness: true });
        await makeHallucinated(0, { state });
        await exerciseAttribute(A_CON, true, state);
        await exerciseAttribute(A_STR, true, state);
        if (source.blessed && !state.u.usteed) await healHeroLegs(state);
        break;
    case POT_FULL_HEALING:
        await pline(formatFeltMessage('completely healed.', state));
        await healHero(400, 4 + 4 * blessing,
            { state, cureSickness: !source.cursed, cureBlindness: true });
        if (source.blessed && state.u.ulevel < state.u.ulevelmax) {
            state.u.ulevelmax--;
            await gainExperienceLevel({ state });
        }
        await makeHallucinated(0, { state });
        await exerciseAttribute(A_STR, true, state);
        await exerciseAttribute(A_CON, true, state);
        if (source.blessed || (!source.cursed && !state.u.usteed)) await healHeroLegs(state);
        break;
    case POT_GAIN_ENERGY: {
        await pline(source.cursed ? formatFeltMessage('lackluster.', state) : 'Magical energies course through your body.');
        const amount = d(source.blessed ? 3 : source.cursed ? 1 : 2, 6) * (source.cursed ? -1 : 1);
        state.u.uenmax = Math.max(0, (state.u.uenmax || 0) + amount);
        state.u.uenpeak = Math.max(state.u.uenpeak || 0, state.u.uenmax);
        state.u.uen = Math.max(0, Math.min(state.u.uenmax, (state.u.uen || 0) + 3 * amount));
        state.context.botl = true;
        await exerciseAttribute(A_WIS, true, state);
        break;
    }
    default: {
        let effect = await applyPotionBodyEffect(source, { state });
        if (!effect.handled) effect = await applyPotionMentalEffect(source, { state });
        if (!effect.handled) throw new Error(`Unsupported potion effect ${source.otyp}`);
        unknown = effect.unknown || 0;
        nothing = !!effect.nothing;
    }
    }
    return { result, unknown, nothing, heroDied: !!state.program_state.gameover };
}

async function restoreAbility(source: GameObject, state: PlayingGameState) {
    if (source.cursed) {
        await pline('Ulch!  This makes you feel mediocre!');
        return;
    }
    const feeling = !source.blessed ? 'good' : restorationLeavesTrouble(state) ? 'better' : 'great';
    await pline(`Wow!  This makes you feel ${feeling}!`);
    restoreHeroBaseAttributes({ all: !!source.blessed, state });
    if (source.otyp === POT_RESTORE_ABILITY) {
        while (state.u.ulevel < state.u.ulevelmax) {
            await gainExperienceLevel({ state });
            if (!source.blessed) break;
        }
    }
}

async function seeInvisible(source: GameObject, state: PlayingGameState) {
    const wasInvisible = heroIsInvisible(state) && !heroIsBlind(state);
    const permanenceChance = 10 - (hasInternalInvisibility(state) ? 3 : 0)
        - (hasIntrinsicProperty('seeInvisible', null, state) || (state.u.seeInvisibleTurns ?? 0) > 0 ? 6 : 0);
    const fruit = fruitName(true, state);
    const diluted = source.odiluted;
    await pline(source.cursed ? `Yecch!  This tastes ${heroIsHallucinating(state) ? 'overripe' : 'rotten'}.`
        : heroIsHallucinating(state) ? `This tastes like 10% real ${diluted ? 'reconstituted ' : ''}${fruit} all-natural beverage.`
        : `This tastes like ${diluted ? 'reconstituted ' : ''}${fruit}.`);
    if (source.otyp === POT_FRUIT_JUICE) {
        state.u.uhunger += (diluted ? 5 : 10) * (2 + (source.blessed ? 1 : source.cursed ? -1 : 0));
        await updateHeroHunger(false, { state });
        return 1;
    }
    if (!source.cursed) await makeBlinded(0, { state });
    const permanent = !!source.blessed && !rn2(permanenceChance);
    await grantHeroSeeInvisible({ permanent, duration: permanent ? 0 : rn1(100, 750), state });
    if (wasInvisible && !heroIsBlind(state)) {
        await pline('You can see through yourself, but you are visible!');
        return 0;
    }
    return 1;
}

async function monsterDetection(source: GameObject, state: PlayingGameState) {
    let unknown = 0, nothing = false;
    if (source.blessed) {
        const hero = state.u;
        nothing = heroDetectsMonsters(state);
        unknown++;
        const timeout = hero.monsterDetectionTurns || 0;
        hero.monsterDetectionTurns = Math.min(TIMEOUT,
            timeout + (timeout >= 300 ? 1 : source.oclass === 10 ? rn1(40, 21) : rn2(100) + 100));
        let found = false;
        for (let x = 1; x < COLNO; x++) for (let y = 0; y < ROWNO; y++) {
            unmap_invisible(x, y);
            if (monsterAtPosition(state.level, x, y)) found = true;
        }
        if (found) unknown = 0;
        if (!hero.uswallow && !hero.uinwater && !state.underwater) {
            await see_monsters();
            if (!found) await pline(formatFeltMessage('lonely.', state));
            return { result: 0, unknown, nothing };
        }
    }
    const detection = await detectMonsters(source, { state });
    if (!detection.result) await exerciseAttribute(A_WIS, true, state);
    return { result: detection.result, unknown, nothing };
}

// C apply.c:unfixable_trouble_count(FALSE). Restoration does not treat these
// ailments or temporary attribute penalties; they only change its feedback.
function restorationLeavesTrouble(state: PlayingGameState) {
    const hero = state.u;
    return heroIsPetrifying(state) || heroIsSliming(state) || heroIsStrangled(state)
        || hero.atemp.a[A_DEX] < 0 && (hero._woundedLegTurns ?? 0) > 0
        || hero.atemp.a[A_STR] < 0 && hero.uhs >= WEAK
        || heroIsSick(state) || propertyIsActive('stunned', state)
        || (hero.confusionTurns ?? 0) > 0 || heroIsHallucinating(state)
        || heroIsVomiting(state) || heroIsDeaf(state);
}
