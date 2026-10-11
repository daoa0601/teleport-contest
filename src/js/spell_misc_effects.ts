import type { GameState, PlayingGameState } from './game_state.js';
import { requirePlayingGame } from './gstate.js';
// Native spell.c:cast_protection() and the direct healing spell effects.
import { findArmorClass } from './armor.js';
import { CLOUD, IS_STWALL, IS_TREE, P_EXPERT } from './const.js';
import { displayColorName, displayLiquidName, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { healHero } from './hero_healing.js';
import { heroIsSick } from './hero_illness.js';
import { MONSTER_NAME, monsterEnfolds, monsterIsAnimal, monsterIsWhirly } from './monster_data.js';
import { SPE_PROTECTION } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { heroIsBlind } from './senses.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { liveSpellSkill } from './spell_casting_rules.js';

export async function castProtection({ state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    let level = hero.ulevel, logarithm = 0;
    while (level) {
        logarithm++;
        level = Math.trunc(level / 2);
    }
    const protection = hero.uspellprot || 0;
    const naturalArmor = Math.trunc((10 - (hero.uac + protection)) / 10);
    const gain = logarithm - Math.trunc(protection / (4 - Math.min(3, naturalArmor)));
    if (gain <= 0) {
        await plineWithContinuation('Your skin feels warm for a moment.');
        return;
    }
    if (!heroIsBlind(state)) {
        const color = displayColorName('golden', state);
        await plineWithContinuation(protection
            ? `The ${color} haze around you becomes more dense.`
            : `The ${protectionAtmosphere(state)} around you begins to shimmer with ${withIndefiniteArticle(color)} haze.`);
    }
    hero.uspellprot = protection + gain;
    hero.uspmtime = liveSpellSkill(SPE_PROTECTION, state) === P_EXPERT ? 20 : 10;
    if (!hero.usptime) hero.usptime = hero.uspmtime;
    findArmorClass(state);
}

function protectionAtmosphere(state: PlayingGameState) {
    const hero = state.u;
    if (hero.uswallow && hero.ustuck) {
        const monster = hero.ustuck;
        if (MONSTER_NAME[monster.mnum] === 'fog cloud') return 'mist';
        if (monsterIsWhirly(monster)) return 'maelstrom';
        if (monsterEnfolds(monster)) return 'folds';
        return monsterIsAnimal(monster) ? 'maw' : 'ooze';
    }
    if (hero.uinwater) return displayLiquidName('water', state);
    const location = state.level.at(hero.ux, hero.uy);
    if (!location) throw new Error('Protection requires the hero to stand on the map.');
    const terrain = location.typ;
    if (terrain === CLOUD) return 'cloud';
    if (IS_TREE(terrain)) return 'vegetation';
    return IS_STWALL(terrain) ? 'stone' : 'air';
}

// Native nh_timeout() commits the updated AC before its fading message.
export async function advanceSpellProtection(state: GameState = game) {
    const hero = state.u;
    if (!hero.usptime || --hero.usptime || !hero.uspellprot) return;
    if (hero.uspmtime === undefined) throw new Error('Spell protection has no decay interval.');
    hero.usptime = hero.uspmtime;
    hero.uspellprot--;
    findArmorClass(state);
    if (!heroIsBlind(state)) {
        await plineWithContinuation(`The ${displayColorName('golden', state)} haze around you ${hero.uspellprot
            ? 'becomes less dense' : 'disappears'}.`, { noRepeat: true });
    }
}

export async function castCureBlindness({ state = game }: { state?: GameState } = {}) {
    await healHero(0, 0, { state, cureBlindness: true });
}

export async function castCureSickness({ state = game }: { state?: GameState } = {}) {
    const wasSick = heroIsSick(state), wasSlimed = heroIsSliming(state);
    await healHero(0, 0, { state, cureSickness: true });
    if (wasSick || !wasSlimed)
        await plineWithContinuation(`You are ${wasSick ? 'no longer' : 'not'} ill.`);
    if (wasSlimed) {
        // make_slimed() updates status before prose, then clears its killer
        // and any late slime disguise after the message returns.
        state.u.slimedTurns = 0;
        state.u.slimed = false;
        await plineWithContinuation('The slime disappears!');
        clearHeroSliming(state);
    }
}
