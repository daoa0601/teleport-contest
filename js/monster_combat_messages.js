// C mhitm.c:mattackm(), pre_mm_attack(), hitmm(), missmm(), and noises().
import { M_AP_TYPE, PLNMSG_HIDE_UNDER } from './const.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, map_invisible, newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { objectCanTouchShade } from './hero_object_contact.js';
import { heroIsUnaware } from './hero_sleep.js';
import { formatHeardMessage } from './hero_speech.js';
import { heroIsDeaf } from './senses.js';
import { AD_DGST, AD_STCK, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH, AT_WEAP, } from './monster_attack_types.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { MONSTER_GENO, monsterHatesSilver, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsShade } from './monster_data.js';
import { monsterName, monsterObjectPronoun, namelessMonsterName, possessiveName } from './monster_name.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import { objectMaterial } from './object_material.js';
import { minimalObjectName, objectCombatName, pluralizeObjectNoun } from './objnam.js';
import { d, rnd } from './rng.js';
import { seductionCompatibility } from './seduction_compatibility.js';
import { cansee } from './vision.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';
import { capitalizedDefiniteName } from './ray_hit_message.js';
const G_UNIQ = 0x1000;
export function canSeeMonsterCombat(attacker, defender) {
    return (cansee(attacker.mx, attacker.my)
        && canSpotMonster(attacker))
        || (cansee(defender.mx, defender.my)
            && canSpotMonster(defender));
}
// Admission exposes a concealed defender before visibility and hit chances
// are finalized. A disguise is instead revealed by the individual hit/miss.
export async function revealMonsterCombatDefender(defender, state = game) {
    if (!defender.mundetected)
        return;
    defender.mundetected = 0;
    newsym(defender.mx, defender.my);
    if (!canSeeMonster(defender) || canSenseMonster(defender))
        return;
    if (heroIsUnaware(state)) {
        const unique = !!((MONSTER_GENO[defender.mnum] ?? 0) & G_UNIQ);
        const species = namelessMonsterName(defender, { state, article: unique ? 'the' : 'none' });
        await plineWithContinuation(`You dream of ${unique ? species : makePlural(species)}.`);
    }
    else if (state.last_hider === defender.m_id) {
        if (state._lastPlineKind === PLNMSG_HIDE_UNDER) {
            const subject = monsterName(defender, { state, capitalized: true });
            await plineWithContinuation(`${subject} emerges from hiding.`);
        }
        else {
            await plineWithContinuation(`You notice ${monsterName(defender, { state })}.`);
        }
    }
    else {
        await plineWithContinuation(`Suddenly, you notice ${monsterName(defender, { state, article: 'a' })}.`);
    }
}
export async function prepareMonsterCombatContact(aggressor, defender, attack, weapon, { state = game, visible, publish = plineWithContinuation, rollOne = rnd, rollDice = d }) {
    revealAttackingMonsters(aggressor, defender, visible);
    const compatibility = aggressor.mcan ? 0 : seductionCompatibility(aggressor, defender, attack, state);
    if (!compatibility && await rejectMonsterShadeContact(aggressor, defender, weapon, {
        state, visible, publish, rollOne, rollDice,
    }))
        return 'shade-miss';
    if (!visible) {
        await reportMonsterCombatNoise(aggressor, state, { publish });
        return 'contact';
    }
    const subject = monsterName(aggressor, { state, capitalized: true });
    if (compatibility) {
        const verb = defender.mcansee ? 'smiles at' : 'talks to';
        const target = monsterName(defender, { state });
        await publish(`${subject} ${verb} ${target} ${compatibility === 2 ? 'engagingly' : 'seductively'}.`);
        return 'contact';
    }
    const weaponHit = attack[0] === AT_WEAP || attack[0] === AT_CLAW && !!weapon;
    const action = contactAction(aggressor, attack, weaponHit && !!weapon?.oartifact, subject, state);
    if (action)
        await publish(`${action} ${combatTargetName(defender, aggressor, state)}.`);
    if (weaponHit && weapon && objectMaterial(weapon, state) === 14 && monsterHatesSilver(defender))
        await showSilverContact(aggressor, defender, weapon, subject, state, publish);
    return 'contact';
}
export async function showMonsterCombatMiss(aggressor, defender, attack, { state = game, visible, publish = plineWithContinuation }) {
    revealAttackingMonsters(aggressor, defender, visible);
    if (!visible) {
        await reportMonsterCombatNoise(aggressor, state, { publish });
        return;
    }
    const subject = monsterName(aggressor, { state, capitalized: true });
    const friendly = !aggressor.mcan && seductionCompatibility(aggressor, defender, attack, state);
    await publish(`${subject} ${friendly ? 'pretends to be friendly to' : 'misses'} ${combatTargetName(defender, aggressor, state)}.`);
}
// Native mdamagem() makes a second, independent dmgval probe for AD_PHYS.
// The caller supplies that probe's stricter visibility (both actors seen).
export async function rejectMonsterShadeContact(aggressor, defender, weapon, { state = game, visible, publish = plineWithContinuation, rollOne = rnd, rollDice = d, thrown = false }) {
    if (!monsterIsShade(defender)
        || weapon && rollPhysicalWeaponDamage(weapon, defender, { state, rollOne, rollDice }) !== 0)
        return false;
    if (visible && (cansee(defender.mx, defender.my) || canSenseMonster(defender))) {
        const what = !weapon || objectCanTouchShade(weapon, state) ? 'attack' : objectCombatName(weapon, { state });
        const target = monsterName(defender, { state });
        const subject = thrown ? capitalizedDefiniteName(what, state)
            : `${possessiveName(monsterName(aggressor, { state, capitalized: true }))} ${what}`;
        await publish(`${subject} ${verbForSubject(what, 'pass')} harmlessly through ${target}.`);
        if (!canSpotMonster(defender))
            map_invisible(defender.mx, defender.my);
    }
    defender.msleeping = 0;
    return true;
}
export async function showMonsterArtifactFallbackHit(aggressor, defender, { state = game, visible, publish = plineWithContinuation }) {
    if (!visible)
        return;
    const subject = monsterName(aggressor, { state, capitalized: true });
    await publish(`${subject} hits ${combatTargetName(defender, aggressor, state)}.`);
}
function contactAction(aggressor, attack, artifact, subject, state) {
    switch (attack[0]) {
        case AT_BITE: return `${subject} bites`;
        case AT_STNG: return `${subject} stings`;
        case AT_BUTT: return `${subject} butts`;
        case AT_TUCH: return `${subject} touches`;
        case AT_TENT: return `${possessiveName(subject)} tentacles suck`;
        case AT_HUGS:
            if (aggressor !== state.u.ustuck)
                return `${subject} squeezes`;
            return artifact ? '' : `${subject} hits`;
        case AT_NONE:
        case AT_CLAW:
        case AT_KICK:
        case AT_SPIT:
        case AT_ENGL:
        case AT_BREA:
        case AT_EXPL:
        case AT_BOOM:
        case AT_GAZE:
        case AT_WEAP:
        case AT_MAGC:
            return artifact ? '' : `${subject} hits`;
    }
}
function combatTargetName(defender, aggressor, state) {
    if (defender !== aggressor)
        return monsterName(defender, { state });
    switch (monsterObjectPronoun(defender, { state })) {
        case 'him': return 'himself';
        case 'her': return 'herself';
        case 'them': return 'themselves';
        default: return 'itself';
    }
}
async function showSilverContact(aggressor, defender, weapon, subject, state, publish) {
    let target = combatTargetName(defender, aggressor, state);
    if (!monsterIsNoncorporeal(defender) && !monsterIsAmorphous(defender)) {
        target = defender === aggressor
            ? target.replace('himself', 'his own').replace('herself', 'her own').replace('itself', 'its own')
            : possessiveName(target);
        target += ' flesh';
    }
    const noun = minimalObjectName(weapon, state);
    const simpleName = (weapon.quan ?? weapon.quantity ?? 1) === 1 ? noun : pluralizeObjectNoun(weapon, noun);
    await publish(`${possessiveName(subject)} ${simpleName} sears ${target}!`);
}
function revealAttackingMonsters(aggressor, defender, visible) {
    let changed = false;
    for (const monster of [defender, aggressor]) {
        if (M_AP_TYPE(monster)) {
            revealMonsterAppearance(monster);
            changed = true;
        }
        else if (monster.mundetected) {
            monster.mundetected = 0;
            changed = true;
        }
    }
    if (!visible)
        return;
    for (const monster of [aggressor, defender]) {
        if (!canSpotMonster(monster))
            map_invisible(monster.mx, monster.my);
        else if (changed)
            newsym(monster.mx, monster.my);
    }
}
// C mhitm.c:failed_grab(). Unlike hitmm/missmm, a failed hold is silent
// when the defender cannot be spotted, even if the attacker can be seen.
export async function showMonsterGrabFailure(aggressor, defender, attack, target, visible, state = game) {
    if (!visible || !canSpotMonster(defender))
        return;
    const subject = possessiveName(monsterName(aggressor, { capitalized: true, state }));
    const name = monsterName(defender, { state });
    const object = target.notOnHead ? `${possessiveName(name)} tail` : name;
    const verb = attack.damageType === AD_DGST ? 'gulp'
        : attack.damageType === AD_STCK ? 'adhere' : 'grab';
    const failure = target.notOnHead ? 'fails to hold' : 'passes right through';
    await plineWithContinuation(`${subject} ${verb} attempt ${failure} ${object}!`);
}
export async function reportMonsterCombatNoise(aggressor, state, { explosion = false, publish = plineWithContinuation } = {}) {
    if (heroIsDeaf(state))
        return;
    const far = (aggressor.mx - state.u.ux) ** 2
        + (aggressor.my - state.u.uy) ** 2 > 15;
    const lastFar = state._farMonsterNoise ?? false;
    const lastMove = state._monsterNoiseTime ?? 0;
    if (far === lastFar && state.moves - lastMove <= 10)
        return;
    state._farMonsterNoise = far;
    state._monsterNoiseTime = state.moves;
    const message = formatHeardMessage(`${explosion ? 'an explosion' : 'some noises'}${far ? ' in the distance' : ''}.`, state);
    if (message)
        await publish(message);
}
//# sourceMappingURL=monster_combat_messages.js.map