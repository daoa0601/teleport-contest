// C hack.c:domove_fight_web(): force-fighting a seen web with the wielded
// weapon (or bare hands) spends the move and may cut the web away.
import { currentStrength } from './attrib.js';
import { artifactById } from './artifacts.js';
import { newsym, plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { rn2 } from './rng.js';
import { P_ISRESTRICTED, P_TWO_WEAPON_COMBAT, P_UNSKILLED, WEB, } from './const.js';
import { deleteTrap } from './trap_lifecycle.js';
import { ensureHeroSkills, useHeroSkill, weaponSkillType } from './skills.js';
import { isBlade } from './weapon_type.js';
import { weaponDescription } from './weapon_description.js';
export async function fightSeenWebWithForce(x, y, state = game) {
    if (!state.context.forcefight)
        return false;
    const trap = state.level?.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap || trap.ttyp !== WEB || !trap.tseen)
        return false;
    requirePlayingGame(state);
    const weapon = state.uwep ?? state.u.uwep ?? null;
    const swap = state.uswapwep ?? state.u.uswapwep ?? null;
    const dualWielding = !!state.u.twoweap;
    const weaponType = dualWielding ? P_TWO_WEAPON_COMBAT : weaponSkillType(weapon);
    // minus_2: restricted or unskilled: -1, basic: 0, skilled: 1, expert: 2
    const skillMinus2 = Math.max(ensureHeroSkills(state)?.[weaponType]?.skill ?? P_ISRESTRICTED, P_UNSKILLED) - 2;
    // For the weaponless case the chance to succeed is adjusted instead of
    // possibly granting two tries.
    const roll = rn2(weapon ? 20 : 45 - 5 * skillMinus2);
    const artifact = weapon ? artifactById(weapon.oartifact, state) : null;
    const wieldsSting = artifact?.name === 'Sting';
    const burnsWebs = artifact?.attack?.damageType === 'fire';
    if (weapon && (wieldsSting || burnsWebs)) {
        // Guaranteed success; Sting and flaming artifacts skip the practice.
        await pline(`${artifact?.name ?? ''} ${wieldsSting ? 'cuts' : 'burns'} through the web!`);
    }
    else if (weapon && !isBlade(weapon)
        && (!dualWielding || !isBlade(swap))) {
        const primaryDescription = weaponDescription(weapon);
        const secondaryDescription = dualWielding && swap
            ? weaponDescription(swap) : '';
        // A dual-wielded secondary is only mentioned for a different type
        // description from the primary.
        const onewep = !secondaryDescription
            || primaryDescription === secondaryDescription;
        let primaryPhrase;
        if (['armor', 'food', 'venom'].includes(primaryDescription.toLowerCase())) {
            primaryPhrase = primaryDescription;
        }
        else if (weapon.quan === 1 && !(dualWielding && onewep)) {
            primaryPhrase = withIndefiniteArticle(primaryDescription);
        }
        else {
            primaryPhrase = makePlural(primaryDescription);
        }
        let secondaryPhrase = '';
        if (!onewep && swap) {
            secondaryPhrase = swap.quan === 1
                ? withIndefiniteArticle(secondaryDescription)
                : makePlural(secondaryDescription);
        }
        await pline(`You can't cut a web with ${primaryPhrase}`
            + `${!onewep ? ' or ' : ''}${secondaryPhrase}!`);
        return true;
    }
    else if (roll > currentStrength(state) - 2
        + (weapon ? (weapon.spe ?? 0) + skillMinus2 : 0)) {
        await pline(`You ${weapon ? 'hack' : 'thrash'} ineffectually at some of the strands.`);
        return true;
    }
    else {
        await pline(`You ${weapon ? 'cut' : 'punch'} through the web.`);
        // Cutting a web this way does not break the "never hit with a
        // wielded weapon" conduct but does practice the weapon skill.
        await useHeroSkill(weaponType, 1, { state });
    }
    deleteTrap(trap, state);
    newsym(x, y);
    return true;
}
//# sourceMappingURL=hero_web_fight.js.map