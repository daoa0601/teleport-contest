// Native insight.c:ustatusline(), shared by self-probing and stethoscopes.
import { armorSimpleName } from './armor.js';
import { heroFingerName, heroHasEyes, heroLegName } from './body_parts.js';
import { M_AP_TYPE, SICK_NONVOMITABLE, SICK_VOMITABLE, Upolyd } from './const.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroIsSick, heroIsVomiting } from './hero_illness.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { heroFormSticks } from './hero_species.js';
import { heroIsStrangled } from './hero_strangulation.js';
import { piousness } from './insight.js';
import { MONSTER_LEVEL, monsterDigests } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { makePlural } from './object_grammar.js';
import { visibleRegionAt } from './regions.js';
import { blindfolded, heroIsBlind } from './senses.js';
import { heroIsPetrifying } from './stoning.js';

export function heroStatusLine(state = game) {
    requirePlayingGame(state);
    const hero = state.u;
    const conditions = [];
    if (heroIsSick(state)) {
        const causes = [];
        if ((hero.sickType ?? 0) & SICK_VOMITABLE) causes.push('food poisoning');
        if ((hero.sickType ?? 0) & SICK_NONVOMITABLE) causes.push('illness');
        conditions.push(`dying from ${causes.join(' and ')}`);
    }
    if (heroIsPetrifying(state)) conditions.push('solidifying');
    if (hero.slimed || (hero.slimedTurns ?? 0) > 0) conditions.push('becoming slimy');
    if (heroIsStrangled(state)) conditions.push('being strangled');
    if (heroIsVomiting(state)) conditions.push('nauseated');
    if (hero.confused || (hero.confusionTurns ?? 0) > 0) conditions.push('confused');
    if (heroIsBlind(state)) {
        let blindness = 'blind';
        if (hero.ucreamed) {
            const otherCause = hero.ucreamed < (hero.blindTurns ?? 0)
                || blindfolded(state) || !heroHasEyes(state);
            blindness += `${otherCause ? ', covered' : 'ed'} by sticky goop`;
        }
        conditions.push(blindness);
    }
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0) conditions.push('stunned');
    if (((hero._woundedLegTurns ?? 0) > 0 || hero._woundedLegSide) && !hero.usteed) {
        const leg = heroLegName(state);
        conditions.push(`injured ${hero._woundedLegSide === 'both' ? makePlural(leg) : leg}`);
    }
    if ((hero.glibTurns ?? 0) > 0) {
        const gloves = state.uarmg || hero.uarmg;
        conditions.push(`slippery ${gloves ? armorSimpleName(gloves, state) : makePlural(heroFingerName(state))}`);
    }
    if (hero.utrap) conditions.push('trapped');
    if (hero.veryFast) conditions.push('very fast');
    else if (hero.fast) conditions.push('fast');
    if (hero.uundetected) conditions.push('concealed');
    else if (M_AP_TYPE(hero)) conditions.push('disguised');
    if (heroIsInvisible(state)) conditions.push('invisible');
    if (hero.ustuck) {
        const relation = hero.uswallow
            ? monsterDigests(hero.ustuck) ? 'being digested by' : 'engulfed by'
            : heroFormSticks(state) ? 'holding' : 'held by';
        conditions.push(`${relation} ${monsterName(hero.ustuck, { state, article: 'a' })}`);
    }
    const region = !hero.uswallow && visibleRegionAt(state, hero.ux, hero.uy);
    if (region) conditions.push(`in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`);
    const alignment = hero.ualign.type;
    const suffix = alignment === 1 ? 'lawful' : alignment === 0 ? 'neutral'
        : alignment === -1 ? 'chaotic' : 'unaligned';
    const devotion = piousness(hero.ualign.record, { showNegative: false, suffix });
    const polymorphed = Upolyd(hero);
    const level = polymorphed ? MONSTER_LEVEL[hero.umonnum] : hero.ulevel;
    const hp = polymorphed ? hero.mh : hero.uhp;
    const maximum = polymorphed ? hero.mhmax : hero.uhpmax;
    return `Status of ${state.plname} (${devotion}):  Level ${level}  HP ${hp}(${maximum})  AC ${hero.uac}${conditions.length ? `, ${conditions.join(', ')}` : ''}.`;
}
