// Native eat.c:cprefx()/cpostfx(). The meal/tin owner retains the food identity.
import {
    adjustAttribute, attributeChangeMessage, currentAttribute, exerciseWisdom,
} from './attrib.js';
import { applyCannibalPenalty, heroMayEatOwnKind } from './cannibalism.js';
import { A_CHA, A_INT, DIED, STONING, Upolyd } from './const.js';
import { corpseEnergyBuzz, grantCorpseIntrinsic } from './corpse_intrinsics.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { newsym, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { gainExperienceLevel } from './exper.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { gainCorpseDisplacement } from './hero_displacement.js';
import {
    heroIsInvisible, invisibilityIsBlocked, showInvisibilityMessage,
    syncHeroInvisibility,
} from './hero_invisibility.js';
import { makeConfused, makeHallucinated, makeStunned } from './hero_mental_status.js';
import { retouchEquipment } from './hero_retouch.js';
import { heroSpecies } from './hero_species.js';
import { gainHeroNutrition } from './hunger.js';
import { beginMealMimicry, finishMealMimicry } from './meal_mimic.js';
import { AD_HALU, AD_STUN, AT_MAGC } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_NAME, monsterIsRider, requireMonsterData } from './monster_data.js';
import { CORPSE } from './object_data.js';
import { heroIsUnchanging, polymonHero, polymorphHero } from './polyself.js';
import {
    grantIntrinsicProperty, hasPermanentIntrinsicProperty, removePermanentIntrinsicProperty,
} from './properties.js';
import { rn1, rn2 } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { heroCanBeSlimed, startHeroSliming } from './slime.js';
import {
    clearHeroPetrification, fleshPetrifies, formCanBecomeStoneGolem,
    heroIsPetrifying, heroResistsStoning,
} from './stoning.js';
import { attrcurse } from './throne.js';
import { useUpTin } from './tin.js';
import { catchLycanthropyFromCorpse } from './were.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';

interface CorpseOptions { state?: GameState; food?: GameObject | null; tin?: GameObject | null; }

const M1_ACID = 0x08000000;
const M1_METALLIVORE = 0x80000000;
const PM_STONE_GOLEM = MONSTER_NAME.indexOf('stone golem');
// The human were-forms and their animal forms share neutral display names.
const HUMAN_WERE_FORMS = new Set([261, 262, 263]);
const domesticAnimals = new Set(['little dog', 'dog', 'large dog', 'kitten', 'housecat', 'large cat']);

export async function applyCorpsePreEffects(mnum: number, { state = game, food = null, tin = null }: CorpseOptions = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    await applyCannibalPenalty(mnum, { state });
    if (fleshPetrifies(mnum) && !heroResistsStoning(state)) {
        let transformed = false;
        if (formCanBecomeStoneGolem(heroSpecies(state), state)) {
            transformed = !!(await polymonHero(PM_STONE_GOLEM)).transformed;
            if (state.program_state.gameover) return { stopped: true, heroDied: true };
        }
        if (!transformed) {
            if (tin) await useUpTin(tin, { state });
            await plineWithContinuation('You turn to stone.');
            const heroDied = await finishHeroDeath({
                killer: `tasting ${requireMonsterData(MONSTER_NAME, mnum)} meat`, deathType: STONING,
                deathVerb: 'turned to stone', deathLineShown: true,
            });
            if (!heroDied && state.context.victual?.piece) state.context.victual.eating = false;
            return { stopped: true, heroDied: !!heroDied };
        }
    }
    const name = requireMonsterData(MONSTER_NAME, mnum);
    if (domesticAnimals.has(name) && !heroMayEatOwnKind(state)) {
        await plineWithContinuation(`You feel that eating the ${name} was a bad idea.`);
        grantIntrinsicProperty('aggravateMonster', 'outside', state);
    } else if (name === 'lizard') {
        if (heroIsPetrifying(state)) await curePetrificationByFood(state);
    } else if (monsterIsRider({ mnum })) {
        await plineWithContinuation('Eating that is instantly fatal.');
        const cause = `unwisely ate the body of ${name}`;
        const heroDied = await finishHeroDeath({ killer: cause, deathCause: cause, deathType: DIED });
        if (heroDied) return { stopped: true, heroDied: true };
        exerciseWisdom(false, state);
        if (food?.otyp === CORPSE) {
            const revival = await reviveCorpseImmediately(food, state);
            for (const message of revival?.messages || []) await plineWithContinuation(message);
            if (revival?.kind === 'revived') {
                state.context.victual = null;
                return { stopped: true, heroDied: false };
            }
        }
    } else {
        if (name === 'green slime' && heroCanBeSlimed(state)) {
            await plineWithContinuation("You don't feel very well.");
            startHeroSliming({ state, killer: '' });
        }
        if (requireMonsterData(MONSTER_FLAGS1, mnum) & M1_ACID && heroIsPetrifying(state))
            await curePetrificationByFood(state);
    }
    return { stopped: false, heroDied: !!state.program_state.gameover };
}

export async function curePetrificationByFood(state: GameState = game) {
    const message = heroIsHallucinating(state)
        ? `What a pity--you just ruined a future piece of ${currentAttribute(A_CHA, state) > 15 ? 'fine ' : ''}art!`
        : 'You feel limber!';
    state.u.stonedTurns = 0;
    state.u.stoned = false;
    await plineWithContinuation(message);
    clearHeroPetrification(state);
}

export async function applyCorpsePostEffects(mnum: number, { state = game, tin = null }: CorpseOptions = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state._mimicMealMessage) finishMealMimicry(state);
    const hero = state.u;
    const name = requireMonsterData(MONSTER_NAME, mnum);
    if (HUMAN_WERE_FORMS.has(mnum)) {
        catchLycanthropyFromCorpse(mnum, state);
        await retouchEquipment(2);
        return { heroDied: !!state.program_state.gameover };
    }
    let checkIntrinsics = false;
    switch (name) {
    case 'wraith':
        await gainExperienceLevel({ state });
        break;
    case 'nurse':
        if (Upolyd(hero)) hero.mh = hero.mhmax;
        else hero.uhp = hero.uhpmax;
        await makeBlinded(0, { state, talk: !hero.ucreamed });
        state.context.botl = true;
        checkIntrinsics = true;
        break;
    case 'stalker':
    case 'yellow light':
    case 'giant bat':
    case 'bat':
        if (name === 'stalker') await eatStalker(state);
        if (name !== 'bat')
            await makeStunned((hero.stunnedTurns || 0) + 30, { state, talk: false });
        await makeStunned((hero.stunnedTurns || 0) + 30, { state, talk: false });
        break;
    case 'giant mimic':
    case 'large mimic':
    case 'small mimic':
        await beginMealMimicry(name === 'giant mimic' ? 50 : name === 'large mimic' ? 40 : 20, { state });
        break;
    case 'quantum mechanic':
        await plineWithContinuation('Your velocity suddenly seems very uncertain!');
        if (hasPermanentIntrinsicProperty('fast', state)) {
            removePermanentIntrinsicProperty('fast', state);
            await plineWithContinuation('You seem slower.');
        } else {
            grantIntrinsicProperty('fast', 'outside', state);
            await plineWithContinuation('You seem faster.');
        }
        break;
    case 'lizard':
        if ((hero.stunnedTurns ?? 0) > 2) await makeStunned(2, { state, talk: false });
        if ((hero.confusionTurns ?? 0) > 2) await makeConfused(2, { state, talk: false });
        checkIntrinsics = true;
        break;
    case 'chameleon':
    case 'doppelganger':
    case 'sandestin':
    case 'genetic engineer':
        if (heroIsUnchanging(state)) await plineWithContinuation('You feel momentarily different.');
        else {
            if (tin) {
                await useUpTin(tin, { state });
                await gainHeroNutrition(200 + ((requireMonsterData(MONSTER_FLAGS1, heroSpecies(state)) & M1_METALLIVORE) ? 5 : 0), { state });
                if (state.program_state.gameover) break;
            }
            await plineWithContinuation(name === 'genetic engineer'
                ? 'You undergo a freakish metamorphosis.' : 'You feel a change coming over you.');
            await polymorphHero();
        }
        break;
    case 'displacer beast':
        await gainCorpseDisplacement({ state });
        break;
    case 'disenchanter':
        await attrcurse();
        break;
    case 'Death':
    case 'Pestilence':
    case 'Famine':
        break;
    case 'mind flayer':
    case 'master mind flayer':
        if (hero.acurr.a[A_INT] < state.urace.attrmax[A_INT]) {
            if (!rn2(2)) {
                await plineWithContinuation('Yum!  That was real brain food!');
                const change = adjustAttribute(A_INT, 1, state);
                const message = attributeChangeMessage(A_INT, change);
                if (message) await plineWithContinuation(message);
                break;
            }
        } else await plineWithContinuation('For some reason, that tasted bland.');
        checkIntrinsics = true;
        break;
    default:
        checkIntrinsics = true;
    }
    if (checkIntrinsics && !state.program_state.gameover) {
        const attacks = requireMonsterData(MONSTER_ATTACKS, mnum);
        if (attacks.some(([, damage]) => damage === AD_STUN || damage === AD_HALU) || name === 'violet fungus') {
            await plineWithContinuation('Oh wow!  Great stuff!');
            await makeHallucinated((hero.hallucinationTurns || 0) + 200, { state, talk: false });
        }
        if (attacks.some(([type]) => type === AT_MAGC) || name === 'newt')
            await corpseEnergyBuzz({ state });
        await grantCorpseIntrinsic(mnum, { state });
    }
    return { heroDied: !!state.program_state.gameover };
}

async function eatStalker(state: PlayingGameState) {
    const hero = state.u;
    if (!heroIsInvisible(state)) {
        hero.invisibleTurns = rn1(100, 50);
        syncHeroInvisibility(state);
        if (!heroIsBlind(state) && !invisibilityIsBlocked(state)) await showInvisibilityMessage(state);
    } else {
        if (!hasPermanentIntrinsicProperty('invisible', state)) await plineWithContinuation('You feel hidden!');
        grantIntrinsicProperty('invisible', 'outside', state);
        grantIntrinsicProperty('seeInvisible', 'outside', state);
        syncHeroInvisibility(state);
    }
    newsym(hero.ux, hero.uy);
}
