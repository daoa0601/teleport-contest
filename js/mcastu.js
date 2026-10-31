// C mcastu.c: monster spellcasting against the hero.
// Spell selection (choose_monster_spell), usefulness checks
// (spell_would_be_useless), the undirected castmu(FALSE,FALSE) entry used by
// dochug(), curse feedback (cursetxt), and the deferred completions of
// mcast_spell()/mcast_summon_mons() effects after their visible lines have
// crossed the tty boundary.
import { A_DEX, M_AP_OBJECT, M_AP_TYPE, M_SEEN_MAGR, MFAST, MM_NOWAIT, MMOVE_DONE, Upolyd, } from './const.js';
import { AD_CLRC, AD_COLD, AD_FIRE, AD_MAGM, AD_SPEL, AT_MAGC, } from './monster_attack_types.js';
import { currentAttribute } from './attrib.js';
import { heroHasFreeAction, heroIsDisplaced } from './armor.js';
import { canSeeMonster, map_invisible, newsym, canSpotMonster, } from './display.js';
import { plineWithContinuation } from './pline.js';
import { endVoluntaryMultiTurn, heroHasInvoluntaryDelay, nomul } from './command_state.js';
import { d, rn2, rnd } from './rng.js';
import { formatFeltMessage } from './hero_speech.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_LEVEL, } from './monster_data.js';
import { monstersForgetHeroResistance } from './monster_perception.js';
import { monsterName as canonicalMonsterName, monsterSpellDeathReason } from './monster_name.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './monster_speed.js';
import { setMonsterPermanentInvisibility } from './monster_invisibility.js';
import { makemonNear, summonNastyMonsters } from './mklev.js';
import { summonMonsterInsects } from './monster_spell_insects.js';
import { aggravateMonsters } from './monster_anger.js';
import { heroIsBlinded, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { cansee, couldsee, } from './vision.js';
import { finishDochugAfterMovement, requireDochugContext, } from './monmove.js';
import { recordRandom } from './monster_action_types.js';
import { finishWizardClone, monsterSpellHasAggravatables } from './wizard.js';
import { msummon } from './minion.js';
import { heroEyeCount, heroEyeName, heroHeadName, } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { dist2 } from './hacklib.js';
const M1_SEE_INVIS = 0x01000000;
export const MCF_INDIRECT = 0x01;
const MCF_SIGHT = 0x02;
const MCF_HOSTILE = 0x04;
const MONSTER_CLERIC_SPELLS = [
    { key: 'open-wounds', level: 0, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'cure-self', level: 1, flags: MCF_INDIRECT },
    { key: 'confuse-you', level: 2, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'paralyze', level: 4, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'blind-you', level: 6, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'insects', level: 8, flags: MCF_HOSTILE | MCF_SIGHT | MCF_INDIRECT },
    { key: 'curse-items', level: 10, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'lightning', level: 11, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'fire-pillar', level: 12, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'geyser', level: 13, flags: MCF_HOSTILE | MCF_SIGHT },
];
export const MONSTER_WIZARD_SPELLS = [
    { key: 'psi-bolt', level: 0, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'cure-self', level: 1, flags: MCF_INDIRECT },
    { key: 'haste-self', level: 2, flags: MCF_INDIRECT },
    { key: 'stun-you', level: 3, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'disappear', level: 4, flags: MCF_INDIRECT },
    { key: 'weaken-you', level: 6, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'destroy-armor', level: 8, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'curse-items', level: 10, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'aggravation', level: 13, flags: MCF_HOSTILE | MCF_SIGHT | MCF_INDIRECT },
    { key: 'summon-monsters', level: 15, flags: MCF_HOSTILE | MCF_SIGHT | MCF_INDIRECT },
    { key: 'clone-wizard', level: 18, flags: MCF_HOSTILE | MCF_SIGHT | MCF_INDIRECT },
    { key: 'death-touch', level: 20, flags: MCF_HOSTILE | MCF_SIGHT },
];
function monsterSpellEffectPreview(spell, damage, state) {
    const antimagic = !!state?.u?.antimagic;
    let effectDamage = damage;
    if (antimagic && ['psi-bolt', 'open-wounds'].includes(spell.key))
        effectDamage = Math.trunc((effectDamage + 1) / 2);
    let effectMessage = null;
    if (spell.key === 'psi-bolt') {
        const head = heroHeadName(state);
        effectMessage =
            effectDamage <= 5
                ? `You get a slight ${head}ache.`
                : effectDamage <= 10
                    ? 'Your brain is on fire!'
                    : effectDamage <= 20
                        ? `Your ${head} suddenly aches painfully!`
                        : `Your ${head} suddenly aches very painfully!`;
    }
    else if (spell.key === 'open-wounds') {
        effectMessage =
            effectDamage <= 5
                ? 'Your skin itches badly for a moment.'
                : effectDamage <= 10
                    ? 'Wounds appear on your body!'
                    : effectDamage <= 20
                        ? 'Severe wounds appear on your body!'
                        : 'Your body is covered with painful wounds!';
    }
    else if (spell.key === 'blind-you') {
        const eye = heroEyeName(state);
        effectMessage = `Scales cover your ${heroEyeCount(state) === 1 ? eye : makePlural(eye)}!`;
    }
    else if (spell.key === 'paralyze') {
        const resisted = !!(state?.u?.antimagic || heroHasFreeAction(state));
        if (!heroHasInvoluntaryDelay(state))
            effectMessage = resisted ? 'You stiffen briefly.' : 'You are frozen in place!';
    }
    else if (spell.key === 'confuse-you') {
        if (antimagic) {
            effectMessage = formatFeltMessage('momentarily dizzy.', state);
        }
        else if (heroIsHallucinating(state)) {
            effectMessage =
                formatFeltMessage((state?.u?.confusionTurns ?? 0) > 0 ? 'trippier!' : 'trippy!', state);
        }
        else {
            effectMessage =
                formatFeltMessage((state?.u?.confusionTurns ?? 0) > 0 ? 'more confused!' : 'confused!', state);
        }
    }
    else if (spell.key === 'weaken-you') {
        effectMessage = antimagic ? formatFeltMessage('momentarily weakened.', state) : 'You suddenly feel weaker!';
    }
    else if (spell.key === 'aggravation') {
        effectMessage = formatFeltMessage('that monsters are aware of your presence.', state);
    }
    else if (spell.key === 'stun-you') {
        const resisted = antimagic || heroHasFreeAction(state);
        const alreadyStunned = !!state?.u?.stunned || (state?.u?.stunnedTurns ?? 0) > 0;
        effectMessage = resisted
            ? alreadyStunned
                ? null
                : formatFeltMessage('momentarily disoriented.', state)
            : alreadyStunned
                ? 'You struggle to keep your balance.'
                : 'You reel...';
    }
    else if (spell.key === 'curse-items') {
        effectMessage = formatFeltMessage('as if you need some help.', state);
    }
    else if (spell.key === 'geyser') {
        effectMessage = 'A sudden geyser slams into you from nowhere!';
    }
    else if (spell.key === 'fire-pillar') {
        effectMessage = 'A pillar of fire strikes all around you!';
    }
    else if (spell.key === 'lightning') {
        effectMessage = 'A bolt of lightning strikes down at you from above!';
    }
    return { effectDamage, effectMessage };
}
// Resume castmu() after the casting line.  Damage is pre-rolled before the
// concrete effect line, but not before a casting line which itself pages.
export function rollDeferredHeroSpellDamage(action, state, rollDice = d) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredSpellDamage)
        return attack;
    if (attack.spellDice === undefined || attack.spellSides === undefined)
        throw new Error('A deferred spell damage roll needs its selected dice');
    // Undirected spells still produce their effects when aimed at a false
    // position. Native castmu() passes zero damage without rolling dice.
    let damage = 0;
    if (attack.spellDice > 0) {
        damage = rollDice(attack.spellDice, attack.spellSides);
        action.calls.push(`d(${attack.spellDice},${attack.spellSides})`);
    }
    if (heroHasHalfSpellDamage(state))
        damage = Math.trunc((damage + 1) / 2);
    attack.damage = damage;
    attack.deferredSpellDamage = false;
    if (attack.damageType === AD_FIRE || attack.damageType === AD_COLD || attack.damageType === AD_MAGM) {
        attack.spellEffectMessage = attack.damageType === AD_FIRE ? "You're enveloped in flames."
            : attack.damageType === AD_COLD ? "You're covered in frost."
                : 'You are hit by a shower of missiles!';
        return attack;
    }
    const spell = (attack.damageType === AD_CLRC ? MONSTER_CLERIC_SPELLS : MONSTER_WIZARD_SPELLS).find((candidate) => candidate.key === attack.spell);
    if (!spell)
        throw new Error('A deferred spell must retain its selected native spell');
    const preview = monsterSpellEffectPreview(spell, damage, state);
    attack.effectDamage = preview.effectDamage;
    attack.spellEffectMessage = preview.effectMessage;
    return attack;
}
// mdamageu() subtracts from the active body. Keep raw HP for tty's -1
// sentinel; the presenter owns rehumanization and fatal input afterward.
export function applyHeroSpellDamage(attack, damage, state) {
    const hpKey = Upolyd(state.u) ? 'mh' : 'uhp';
    const hpBefore = state.u[hpKey];
    state.context.botl = true;
    const hpMax = hpKey === 'mh' ? state.u.mhmax : state.u.uhpmax;
    state.u[hpKey] = Math.min(hpMax, hpBefore - damage);
    attack.appliedDamage = damage;
    attack.rehumanize = hpKey === 'mh' && state.u.mh < 1;
    attack.heroDied = hpKey === 'uhp' && state.u.uhp < 1;
}
// Resume the selected mcast_spell() effect after its visible message.
export function resumeDeferredHeroSpell(action, state, random = rn2, rollOne = rnd) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredSpellEffect)
        return null;
    attack.deferredSpellEffect = false;
    if (attack.spell === 'paralyze') {
        const resisted = !!(state.u?.antimagic || heroHasFreeAction(state));
        const monsterLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        let duration = resisted ? 1 : 4 + monsterLevel;
        if (heroHasHalfSpellDamage(state))
            duration = Math.trunc((duration + 1) / 2);
        nomul(-duration, state);
        state._helplessReason = 'paralyzed by a monster';
        state._helplessDoneMessage = null;
        applyHeroSpellDamage(attack, duration, state);
        attack.paralyzed = true;
        if (!resisted)
            monstersForgetHeroResistance(M_SEEN_MAGR, state);
        return attack;
    }
    if (attack.spell === 'confuse-you') {
        const antimagic = !!state.u?.antimagic;
        if (!antimagic) {
            const monsterLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
            let duration = monsterLevel;
            if (heroHasHalfSpellDamage(state))
                duration = Math.trunc((duration + 1) / 2);
            if (!state.u.confusionTurns && duration)
                state.context.botl = true;
            state.u.confusionTurns = (state.u.confusionTurns ?? 0) + duration;
        }
        attack.appliedDamage = 0;
        attack.confusedHero = !antimagic;
        return attack;
    }
    if (attack.spell === 'cure-self') {
        const healing = d(3, 6);
        action.calls.push('d(3,6)');
        const monster = action.monster;
        monster.mhp = Math.min(monster.mhpmax ?? monster.mhp ?? healing, (monster.mhp ?? 0) + healing);
        attack.appliedDamage = 0;
        attack.healedMonster = healing;
        return attack;
    }
    if (attack.spell === 'disappear') {
        const monster = action.monster;
        setMonsterPermanentInvisibility(monster);
        attack.monsterDisappeared = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'weaken-you') {
        attack.appliedDamage = 0;
        if (state.u?.antimagic)
            return attack;
        const monsterLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        let lossSides = Math.max(1, monsterLevel - 6);
        if (heroHasHalfSpellDamage(state))
            lossSides = Math.trunc((lossSides + 1) / 2);
        const amount = rollOne(lossSides);
        action.calls.push(`rnd(${lossSides})`);
        attack.deferredStrengthLoss = {
            amount,
            killer: monsterSpellDeathReason(action.monster, 'strength loss'),
        };
        return attack;
    }
    if (attack.spell === 'summon-monsters') {
        attack.deferredSummonMonsters = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'death-touch') {
        attack.deferredDeathTouch = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'clone-wizard') {
        attack.deferredCloneWizard = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'haste-self') {
        attack.deferredHasteSelf = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'aggravation') {
        attack.deferredAggravation = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'stun-you') {
        const resisted = !!(state.u?.antimagic || heroHasFreeAction(state));
        let duration = 1;
        if (!resisted) {
            const dexterity = currentAttribute(A_DEX, state);
            const dice = dexterity < 12 ? 6 : 4;
            duration = d(dice, 4);
            action.calls.push('d(' + dice + ',4)');
            if (heroHasHalfSpellDamage(state))
                duration = Math.trunc((duration + 1) / 2);
            duration += state.u?.stunnedTurns ?? 0;
        }
        if (!!state.u.stunnedTurns !== !!duration)
            state.context.botl = true;
        state.u.stunnedTurns = duration;
        state.u.stunned = duration > 0;
        attack.stunnedHero = true;
        attack.stunDuration = duration;
        attack.appliedDamage = 0;
        if (!resisted)
            monstersForgetHeroResistance(M_SEEN_MAGR, state);
        return attack;
    }
    if (attack.spell === 'destroy-armor') {
        attack.deferredDestroyArmor = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'fire-pillar') {
        attack.deferredFirePillar = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'lightning') {
        attack.deferredLightningSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'insects') {
        attack.deferredInsectSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'curse-items') {
        attack.deferredCurseItems = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'geyser') {
        attack.deferredGeyserSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (!attack.spell || !['psi-bolt', 'open-wounds'].includes(attack.spell)) {
        attack.unimplementedSpellEffect = true;
        return attack;
    }
    applyHeroSpellDamage(attack, attack.effectDamage ?? attack.damage ?? 0, state);
    return attack;
}
export function heroCanSeeInvisible(state) {
    return !!(state?.u?.seeInvisible || (state?.u?.seeInvisibleTurns ?? 0) > 0);
}
export function monsterSpellUseless(monster, spell, state, random = rn2, calls = []) {
    if (spell.flags & MCF_HOSTILE && monster.mpeaceful)
        return true;
    if (spell.flags & MCF_SIGHT && !couldsee(monster.mx, monster.my))
        return true;
    if (spell.key === 'cure-self')
        return (monster.mhp ?? 0) >= (monster.mhpmax ?? 0);
    if (spell.key === 'blind-you')
        return heroIsBlinded(state);
    if (spell.key === 'haste-self')
        return monster.permspeed === MFAST;
    if (spell.key === 'disappear') {
        return (!!monster.minvis ||
            !!monster.invis_blkd ||
            // mcastu.c keeps peaceful monsters visible to a hero who lacks
            // See_invisible.  choose_monster_spell() then continues down the
            // same spell table without consuming another selection draw.
            (!!monster.mpeaceful && !heroCanSeeInvisible(state)));
    }
    if (spell.key === 'death-touch') {
        const resisted = !!(state?.u?.antimagic || heroIsHallucinating(state));
        return resisted && recordRandom(random, calls, 2) === 0;
    }
    if (spell.key === 'geyser')
        return recordRandom(random, calls, 5) === 0;
    if (spell.key === 'clone-wizard')
        return !monster.iswiz || (state.context.no_of_wizards ?? 0) > 1;
    if (spell.key === 'aggravation' && !monsterSpellHasAggravatables(monster, state)) {
        return recordRandom(random, calls, 100) !== 0;
    }
    return false;
}
// C mcastu.c:choose_monster_spell().  Selection is observable even when a
// peaceful caster rejects the directed/hostile result and proceeds to move.
export function chooseMonsterSpell(monster, damageType, state, random, calls) {
    const list = damageType === AD_CLRC ? MONSTER_CLERIC_SPELLS : MONSTER_WIZARD_SPELLS;
    const lastSpell = list.at(-1);
    if (!lastSpell)
        throw new Error('Native monster spell tables must contain a fallback spell');
    const maxLevel = lastSpell.level;
    let spellValue = recordRandom(random, calls, Math.max(1, monster.m_lev || 1));
    if (spellValue > maxLevel && recordRandom(random, calls, Math.max(1, maxLevel)) !== 0) {
        spellValue = recordRandom(random, calls, Math.max(1, maxLevel));
    }
    for (let index = list.length - 1; index >= 0; index--) {
        const spell = list[index];
        if (spell &&
            spell.level <= spellValue &&
            !monsterSpellUseless(monster, spell, state, random, calls))
            return spell;
    }
    return list[0];
}
export function monsterCurseKind(monster, undirected, state, random, calls) {
    if (canSeeMonster(monster) && couldsee(monster.mx, monster.my)) {
        if (undirected)
            return 'visible-undirected';
        const wrongTarget = monster.mux !== state.u.ux || monster.muy !== state.u.uy;
        if (heroIsInvisible(state) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS) && wrongTarget
            || M_AP_TYPE(state.u) === M_AP_OBJECT && state.u.mappearance === 0 || state.u.uundetected)
            return 'visible-general';
        if (heroIsDisplaced(state) && wrongTarget)
            return 'visible-displaced';
        return 'visible-directed';
    }
    if ((!(state.moves % 4) || !recordRandom(random, calls, 4)) && !heroIsDeaf(state))
        return 'audible';
    return null;
}
async function publishMonsterSpellFailure(monster, spell, state, random, calls) {
    const kind = monsterCurseKind(monster, !!(spell.flags & MCF_INDIRECT), state, random, calls);
    if (kind === 'audible')
        await plineWithContinuation('You hear a mumbled curse.', { noRepeat: true });
    else if (kind) {
        const points = kind === 'visible-undirected' ? 'all around, then curses'
            : kind === 'visible-general' ? 'and curses in your general direction'
                : kind === 'visible-displaced' ? 'and curses at your displaced image' : 'at you, then curses';
        await plineWithContinuation(`${canonicalMonsterName(monster, { state, capitalized: true })} points ${points}.`);
    }
}
export async function movementSpellSelections(monster, state, random, calls) {
    if (monster.mspec_used ||
        dist2(monster.mx, monster.my, state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my) > 49)
        return null;
    for (const [attackType, damageType] of MONSTER_ATTACKS[monster.mnum] || []) {
        if (attackType !== AT_MAGC || (damageType !== AD_CLRC && damageType !== AD_SPEL))
            continue;
        const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
        if (!monsterLevel) {
            await publishMonsterSpellFailure(monster, MONSTER_WIZARD_SPELLS[0], state, random, calls);
            continue;
        }
        const spell = chooseMonsterSpell(monster, damageType, state, random, calls);
        if (!spell)
            continue;
        // castmu(FALSE,FALSE) selects once.  Directed or currently-useless
        // spells miss without spending the action; a successful indirect
        // spell bypasses m_move() and owns the whole actor transaction.
        if (!(spell.flags & MCF_INDIRECT) ||
            monsterSpellUseless(monster, spell, state, random, calls))
            continue;
        if (monster.mcan || monster.mspec_used) {
            await publishMonsterSpellFailure(monster, spell, state, random, calls);
            continue;
        }
        monster.mspec_used = monsterLevel < 8 ? 10 - monsterLevel : 2;
        endVoluntaryMultiTurn(state);
        const fumble = recordRandom(random, calls, Math.max(1, monsterLevel * 10)) <
            (monster.mconf ? 100 : 20);
        if (fumble) {
            if (canSeeMonster(monster) && !heroIsDeaf(state))
                await plineWithContinuation(`The air crackles around ${canonicalMonsterName(monster, { state })}.`);
            continue;
        }
        return {
            spell: spell.key,
            cast: true,
            damageType,
            directed: false,
            deferredSpellEffect: true,
        };
    }
    return null;
}
async function monsterSummonSpellEffect(monster, state) {
    let effect = { count: 0, created: [], message: null };
    const summoned = await summonNastyMonsters(monster);
    effect = {
        ...effect,
        // nasty() delegates to msummon(NULL), using the Wizard's demon choices.
        ...(summoned.deferredDemonSummon ? await msummon() : summoned),
    };
    if (effect.count > 0) {
        if (monster?.iswiz) {
            effect.message = `"Destroy the thief, my pet${effect.count === 1 ? '' : 's'}!"`;
        }
        else {
            const one = effect.count === 1;
            const appearance = one ? 'A monster appears' : 'Monsters appear';
            const heroX = state?.u?.ux ?? monster?.mux;
            const heroY = state?.u?.uy ?? monster?.muy;
            const wrongTarget = monster?.mux !== heroX || monster?.muy !== heroY;
            const cannotSeeInvisible = !((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_SEE_INVIS);
            if (heroIsInvisible(state) && cannotSeeInvisible && wrongTarget) {
                effect.message = `${appearance} ${one ? 'at' : 'around'} a spot near you!`;
            }
            else if (heroIsDisplaced(state) && wrongTarget) {
                effect.message = `${appearance} ${one ? 'by' : 'around'} your displaced image!`;
            }
            else {
                effect.message = `${appearance} from nowhere!`;
            }
        }
    }
    return effect;
}
export async function resolveDeferredHeroSummonMonsters(action, state) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredSummonMonsters)
        return null;
    const effect = await monsterSummonSpellEffect(action.monster, state);
    attack.summonedMonsters = effect.created || [];
    attack.deferredSummonMonsters = false;
    return effect;
}
export async function beginDeferredHeroCloneWizard(action, state) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredCloneWizard || attack.cloneWizard)
        return null;
    const clone = await makemonNear(285, state.u.ux, state.u.uy, MM_NOWAIT);
    if (clone)
        attack.cloneWizard = clone;
    else
        attack.deferredCloneWizard = false;
    return clone;
}
export async function finishDeferredHeroCloneWizard(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredCloneWizard)
        return null;
    const clone = attack.cloneWizard;
    if (!clone)
        return null;
    await finishWizardClone(clone, state, random, action.calls);
    attack.deferredCloneWizard = false;
    return clone;
}
function monsterHasteSelfEffect(monster, state) {
    const speed = adjustMonsterSpeed(monster, 1);
    const message = speed.changed && speed.canDescribe && !state.in_mklev
        && canSeeMonster(monster)
        ? monsterSpeedMessage(speed, canonicalMonsterName(monster, { state, capitalized: true }))
        : null;
    return { message, oldSpeed: speed.oldSpeed, speed: speed.speed };
}
export function resolveDeferredHeroHasteSelf(action, state) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredHasteSelf)
        return null;
    const effect = monsterHasteSelfEffect(action.monster, state);
    attack.hasteSelf = effect;
    attack.deferredHasteSelf = false;
    return effect;
}
export function resolveDeferredHeroAggravation(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredAggravation)
        return null;
    const affected = aggravateMonsters(state, random);
    attack.aggravatedMonsters = affected;
    attack.deferredAggravation = false;
    return affected;
}
// Resume a successful castmu(FALSE,FALSE) after its casting line has crossed
// the tty boundary.  The source effect can create actors, so it remains async
// and only then returns to dochug() for the second distfleeck/phase-four tail.
export async function resumeDeferredMovementSpell(action, state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation) {
    const movement = action?.movement;
    const spellCast = movement?.spellCast;
    if (!movement?.deferredAfterMovementSpell || !spellCast?.deferredSpellEffect)
        return null;
    let effect = { count: 0, created: [], message: null };
    if (spellCast.spell === 'clone-wizard') {
        await publish('Double Trouble...');
        const clone = await makemonNear(285, state.u.ux, state.u.uy, MM_NOWAIT);
        if (clone) {
            await finishWizardClone(clone, state, random, action.calls);
            effect = { count: 1, created: [clone], message: null };
        }
    }
    else if (spellCast.spell === 'cure-self') {
        if (action.monster.mhp < action.monster.mhpmax) {
            if (canSeeMonster(action.monster))
                await publish(`${canonicalMonsterName(action.monster, { state, capitalized: true })} looks better.`);
            action.monster.mhp = Math.min(action.monster.mhpmax, action.monster.mhp + rollDice(3, 6));
        }
    }
    else if (spellCast.spell === 'aggravation') {
        await publish(formatFeltMessage('that monsters are aware of your presence.', state));
        aggravateMonsters(state, random);
    }
    else if (spellCast.spell === 'insects') {
        effect = await summonMonsterInsects(action.monster, state);
    }
    else if (spellCast.spell === 'summon-monsters') {
        effect = await monsterSummonSpellEffect(action.monster, state);
    }
    else if (spellCast.spell === 'haste-self') {
        effect = {
            ...effect,
            ...monsterHasteSelfEffect(action.monster, state),
        };
    }
    else if (spellCast.spell === 'disappear') {
        const monster = action.monster;
        if (canSeeMonster(monster)) {
            const canSeeInvisible = state.u.seeInvisible || (state.u.seeInvisibleTurns ?? 0) > 0;
            await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} suddenly ${canSeeInvisible ? 'becomes transparent' : 'disappears'}!`);
        }
        setMonsterPermanentInvisibility(monster);
        await newsym(monster.mx, monster.my);
        if (cansee(monster.mx, monster.my) && !canSpotMonster(monster))
            await map_invisible(monster.mx, monster.my);
    }
    else {
        throw new Error(`Directed spell ${spellCast.spell} reached the undirected spell effect`);
    }
    if (effect.message)
        await publish(effect.message);
    spellCast.deferredSpellEffect = false;
    movement.deferredAfterMovementSpell = false;
    movement.spellEffect = effect;
    movement.postMoveStatus = MMOVE_DONE;
    movement.movementStage = 'dochug';
    await finishDochugAfterMovement(action.monster, movement, state, random, rollOne, rollDice, action.calls, requireDochugContext(action));
    return effect;
}
//# sourceMappingURL=mcastu.js.map