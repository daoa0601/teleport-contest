// C uhitm.c:mhitm_ad_heal(), against the hero.
import { exerciseAttribute } from './attrib.js';
import { A_CON, A_STR, M_ATTK_DEF_DIED, M_ATTK_HIT, RLOC_MSG, Upolyd } from './const.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { heroSpecies } from './hero_species.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { makeMonsterFlee } from './monster_flee.js';
import { monsterName } from './monster_name.js';
import { isWeaponTool } from './object_properties.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { heroIsDeaf } from './senses.js';
import { touchPetrifies } from './stoning.js';
import { randomMonsterRelocation } from './teleport.js';
export function nurseContactMode(monster, state) {
    if (monster.mcan || (Upolyd(state.u) && touchPetrifies(heroSpecies(state))))
        return 'hit';
    const weapon = state.uwep || state.u.uwep;
    const armed = weapon && (weapon.oclass === 2 || isWeaponTool(weapon));
    const armored = state.uarmu || state.uarm || state.uarmc || state.uarms
        || state.uarmg || state.uarmf || state.uarmh;
    if (!armed && !armored)
        return 'heal';
    return state.urole.key === 'healer' ? 'cooperate' : 'hit';
}
export async function resolveNurseContact(monster, attack, state, publish, random, rollOne, rollDice) {
    const mode = nurseContactMode(monster, state);
    if (mode === 'hit')
        return;
    if (mode === 'cooperate') {
        if (!heroIsDeaf(state) && state.moves % 5 === 0)
            await publish('"Doc, I can\'t help you unless you cooperate."');
        attack.damage = 0;
        return;
    }
    await publish(`${monsterName(monster, { state, capitalized: true })} hits!  (I hope you don't mind.)`);
    const hero = state.u;
    let goAway = false;
    if (Upolyd(hero)) {
        hero.mh += rollOne(7);
        if (random(7) === 0) {
            hero.mhmax++;
            goAway = random(13) === 0;
        }
        hero.mh = Math.min(hero.mh, hero.mhmax);
    }
    else {
        hero.uhp += rollOne(7);
        if (random(7) === 0) {
            if (hero.uhpmax < 5 * hero.ulevel + rollDice(2 * hero.ulevel, 10)) {
                hero.uhpmax++;
                hero.uhppeak = Math.max(hero.uhppeak, hero.uhpmax);
            }
            goAway = random(13) === 0;
        }
        hero.uhp = Math.min(hero.uhp, hero.uhpmax);
    }
    if (random(3) === 0)
        await exerciseAttribute(A_STR, true, state);
    if (random(3) === 0)
        await exerciseAttribute(A_CON, true, state);
    if (heroIsSick(state))
        cureHeroSickness(state);
    state.context.botl = true;
    if (goAway) {
        await removeMonsterFromGame(monster);
        attack.contactDone = true;
        attack.nativeResult = M_ATTK_DEF_DIED;
        return;
    }
    if (random(33) === 0) {
        if (!await reportMonsterTeleportRestriction(monster, { state, publish }))
            await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
        await makeMonsterFlee(monster, { state, turns: rollDice(3, 6), first: true,
            announce: false, publish, random, rollOne });
        attack.contactDone = true;
        attack.nativeResult = M_ATTK_HIT | M_ATTK_DEF_DIED;
        return;
    }
    attack.damage = 0;
}
//# sourceMappingURL=monster_nurse_contact.js.map