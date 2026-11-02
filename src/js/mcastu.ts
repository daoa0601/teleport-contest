// C mcastu.c: monster spellcasting against the hero.  Spell selection
// (choose_monster_spell), usefulness checks (spell_would_be_useless), the
// undirected castmu(FALSE,FALSE) entry used by dochug(), curse feedback
// (cursetxt), and the awaited mcast_spell()/mcast_*() effects, which run
// each visible line and its state change as one native-order transaction.
import {
    A_DEX, M_AP_OBJECT, M_AP_TYPE, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, MFAST, MM_NOWAIT,
    Upolyd, ismnum, KILLED_BY, M_ATTK_HIT, M_ATTK_MISS, MM_ANGRY, MM_NOMSG, MONSEEN_TELEPAT,
} from './const.js';
import { AD_CLRC, AD_COLD, AD_FIRE, AD_MAGM, AD_SPEL, AT_MAGC, AD_SPC2 } from './monster_attack_types.js';
import type {
    HeroSpellAttack, MonsterCallLog, MonsterSpell, MonsterSpellEffect,
    MonsterSpellName, MovementSpellCast, RandomBelow, RollDice, RollOne,
} from './monster_action_types.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_NAME, SPECIAL_PM,
    monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import { erodeWornArmor, heroHasFreeAction, heroIsDisplaced } from './armor.js';
import { withIndefiniteArticle, makePlural, makeSingular, verbForSubject } from './objnam.js';

import {
    canSeeMonster, canSpotMonster, map_invisible, newsym, shieldeff, howMonsterSeen, randomBogusMonsterName,
} from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { castMonsterSpellRay } from './breath_ray.js';
import { displayRayName } from './ray_name.js';
import { monsterLinedUpWithPerceivedHero } from './mthrowu.js';
import { currentAttribute, loseHeroStrength } from './attrib.js';
import { clearHeroSliming } from './slime.js';
import { engravingAt, wipeEngravingAt } from './engrave.js';
import { applyRayFloorFeatures, destroyElectricInventory, destroyFireInventory } from './zap.js';
import { burnHeroArmorByFire } from './trap.js';
import { finishHeroDeathAfterMonsterMessage, finishHeroDeath, finishMonsterAttackDeath } from './end.js';
import { igniteItems } from './light.js';
import { discoverHeroReflectionSource, heroReflectionSource } from './ray.js';
import { flashBurn, makeBlinded } from './sight_change.js';
import { rndcurse } from './throne.js';
import { returnHeroToHumanForm } from './polyself.js';
import { loseHeroHp } from './hero_damage.js';
import type { MessagePublisher } from './pline.js';
import { plineWithContinuation } from './pline.js';
import { heroHasInvoluntaryDelay } from './cmd.js';
import { endVoluntaryMultiTurn, nomul } from './hack.js';
import { d, rn2, rnd } from './rng.js';
import type { PlayingGameState, GameState } from './game_state.js';
import type { DeathHandler } from './end.js';
import type { MonsterAttack } from './data_types.js';
import type { Monster } from './monster_types.js';
import { formatFeltMessage, formatHeardMessage } from './hero_speech.js';
import { heroHasHalfSpellDamage } from './zap.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './worn.js';
import { monsterName as canonicalMonsterName } from './do_name.js';
import { setMonsterPermanentInvisibility } from './worn.js';
import { makemonNear, summonNastyMonsters } from './mklev.js';
import { heroIsBlind, heroIsBlinded, heroIsDeaf, heroDetectsMonsters, heroIsHallucinating } from './senses.js';
import { heroIsUnaware } from './hero_sleep.js';
import { makemonAt, mkclassAligned } from './makemon.js';
import { setMonsterMalign } from './makemon.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { cansee, couldsee } from './vision.js';
import { recordRandom } from './monster_action_types.js';
import { finishWizardClone, monsterSpellHasAggravatables, aggravateMonsters } from './wizard.js';
import { msummon } from './minion.js';
import { heroEyeCount, heroEyeName, heroHeadName } from './body_parts.js';
import { dist2 } from './hacklib.js';
import {
    monsterSubjectPronoun, monstersForgetHeroResistance, monstersObserveHeroResistance, seenResistanceForDamage,
} from './mondata.js';

const M1_SEE_INVIS = 0x01000000;
export const MCF_INDIRECT = 0x01;
const MCF_SIGHT = 0x02;
const MCF_HOSTILE = 0x04;
const MONSTER_CLERIC_SPELLS: readonly [MonsterSpell, ...MonsterSpell[]] = [
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
export const MONSTER_WIZARD_SPELLS: readonly [MonsterSpell, ...MonsterSpell[]] = [
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

// Every mcastu.c effect below runs as one awaited transaction.  The slot
// presenter (mhitu.c's mattacku() caller) supplies the paging-aware
// publisher and its death finishers; dochug()'s movement cast supplies the
// plain tty ones.  `publish` returns the pager dismissal so an escaped
// --More-- can be recognized where tty replaces a retained line.
export interface McastuSpellContext {
    state: PlayingGameState;
    publish: typeof plineWithContinuation;
    random: RandomBelow;
    rollDice: RollDice;
    rollOne: RollOne;
    calls: MonsterCallLog;
    /** Finishes a fatal mdamageu(); true when the death ended the run. */
    fatalDamage: () => Promise<boolean>;
    /** die hook for losestr() in mcast_weaken_you(). */
    strengthLossDeath: (killer: string) => DeathHandler;
}

interface McastuSpellOutcome {
    dmg: number;
    died: boolean;
    /** Dismissal of the effect line which may have forced a pager. */
    effectLineDismissal: number | null | undefined;
}

// C mcastu.c:castmu() from the spell-damage roll through the end of the
// adtyp switch.  The caller published the casting line first; everything
// after it — the level-scaled damage roll, mcast_spell() or the elemental
// switch, and the closing mdamageu() — follows here in native order.
export async function castmuSpellEffect(
    attack: HeroSpellAttack,
    monster: Monster,
    ctx: McastuSpellContext,
): Promise<boolean> {
    const { state } = ctx;
    // Native castmu() passes zero damage without rolling when the caster
    // aimed at a false position.
    const dice = attack.spellDice ?? 0;
    const sides = attack.spellSides ?? 6;
    let dmg = 0;
    if (dice > 0) {
        dmg = ctx.rollDice(dice, sides);
        ctx.calls.push(`d(${dice},${sides})`);
        if (heroHasHalfSpellDamage(state)) dmg = Math.trunc((dmg + 1) / 2);
    }
    attack.damage = dmg;
    const type = attack.damageType;
    if (type === AD_FIRE || type === AD_COLD || type === AD_MAGM) {
        return await castmuElementalSpell(attack, monster, type, dmg, ctx);
    }
    if (!attack.spell)
        throw new Error('A monster spell cast must retain its chosen spell');
    const outcome = await mcastSpell(monster, attack.spell, dmg, ctx);
    if (outcome.dmg && !state.program_state.gameover)
        return await finishSpellDamage(attack, outcome.dmg, outcome.effectLineDismissal, ctx);
    return outcome.died || !!state.program_state.gameover;
}

// C mcastu.c:castmu() AD_FIRE/AD_COLD/AD_MAGM switch cases: the elemental
// effect line, resistance feedback, and mon_spell_hits_spot(), closed by
// the shared mdamageu() tail.  These never enter hitmu()'s armor
// cancellation or contact/passive tail.
async function castmuElementalSpell(
    attack: HeroSpellAttack,
    monster: Monster,
    type: typeof AD_FIRE | typeof AD_COLD | typeof AD_MAGM,
    dmg: number,
    ctx: McastuSpellContext,
): Promise<boolean> {
    const { state } = ctx;
    const effectLineDismissal = await ctx.publish(
        type === AD_FIRE ? "You're enveloped in flames."
            : type === AD_COLD ? "You're covered in frost."
                : 'You are hit by a shower of missiles!',
    );
    const resisted = type === AD_FIRE ? !!state.u.fireResistance
        : type === AD_COLD ? !!state.u.coldResistance : !!state.u.antimagic;
    if (resisted) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await ctx.publish(type === AD_MAGM ? 'The missiles bounce off!' : 'But you resist the effects.');
        monstersObserveHeroResistance(seenResistanceForDamage(type), state);
        dmg = 0;
    } else {
        monstersForgetHeroResistance(seenResistanceForDamage(type), state);
        if (type === AD_MAGM) {
            // Native replaces its already-halved pre-roll with fresh missile
            // damage. Half_spell_damage is not applied to this second roll.
            const count = Math.trunc(monster.m_lev / 2) + 1;
            dmg = ctx.rollDice(count, 6);
            ctx.calls.push(`d(${count},6)`);
        }
    }
    if (type === AD_FIRE && clearHeroSliming(state))
        await ctx.publish('The slime that covers you is burned away!');
    if (type === AD_MAGM) {
        // A shower of magic missiles scuffs an engraving.
        const engraving = engravingAt(state.u.ux, state.u.uy, state.level);
        if (engraving) {
            const wear = ctx.rollDice(6, 6);
            ctx.calls.push('d(6,6)');
            wipeEngravingAt(state.u.ux, state.u.uy, engraving.text.length + wear, true, state.level);
        }
    }
    await applyRayFloorFeatures(type === AD_FIRE ? 'fire' : type === AD_COLD ? 'cold' : 'magic',
        state.u.ux, state.u.uy, state, {
            rayNoun: 'spell', heroCaused: false, publish: ctx.publish,
            random: limit => {
                ctx.calls.push(`rn2(${limit})`);
                return ctx.random(limit);
            },
        });
    if (dmg && !state.program_state.gameover)
        return await finishSpellDamage(attack, dmg, effectLineDismissal, ctx);
    return !!state.program_state.gameover;
}

// C mhitu.c:mdamageu() as castmu() reaches it after mcast_spell(): raw HP
// is kept for tty's -1 sentinel, so rehumanization and the fatal input stay
// with the presenter hooks.  An escaped pager (dismissal 27) has the
// retained effect line replaced by the urgent rehumanize line.
async function finishSpellDamage(
    attack: HeroSpellAttack,
    dmg: number,
    effectLineDismissal: number | null | undefined,
    ctx: McastuSpellContext,
): Promise<boolean> {
    applyHeroSpellDamage(attack, dmg, ctx.state);
    if (attack.rehumanize) {
        if (effectLineDismissal === 27) {
            ctx.state._pending_message = '';
            ctx.state._retained_message = '';
        }
        const restored = await returnHeroToHumanForm(ctx.state);
        if (restored.died) return true;
        attack.rehumanize = false;
    }
    if (attack.heroDied) {
        if (await ctx.fatalDamage()) return true;
        attack.heroDied = false;
    }
    return false;
}

// C mcastu.c:mcast_spell().  Each helper below mirrors one C mcast_*()
// function and awaits its messages in native order; the switch returns the
// damage mcast_spell() passes to mdamageu() (applied by the caller), whether
// an inner death already finished the run, and the dismissal of the effect
// line which may have forced a pager.
export async function mcastSpell(
    monster: Monster,
    spell: MonsterSpellName,
    dmg: number,
    ctx: McastuSpellContext,
): Promise<McastuSpellOutcome> {
    switch (spell) {
    case 'death-touch':
        return { dmg: 0, died: await mcastDeathTouch(monster, ctx), effectLineDismissal: null };
    case 'clone-wizard':
        await mcastCloneWiz(monster, ctx);
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'summon-monsters':
        await mcastSummonMons(monster, ctx);
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'aggravation':
        await ctx.publish(formatFeltMessage('that monsters are aware of your presence.', ctx.state));
        aggravateMonsters(ctx.state, ctx.random);
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'curse-items':
        await ctx.publish(formatFeltMessage('as if you need some help.', ctx.state));
        // rndcurse() keeps the plain publisher, as in the slot presentation.
        await rndcurse({ publish: plineWithContinuation });
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'destroy-armor':
        await mcastDestroyArmor(ctx);
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'weaken-you':
        return { dmg: 0, died: await mcastWeakenYou(monster, ctx), effectLineDismissal: null };
    case 'disappear':
        await mcastDisappear(monster, ctx);
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'stun-you':
        await mcastStunYou(ctx);
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'haste-self':
        await mcastHasteSelf(monster, ctx);
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'cure-self':
        await mCureSelf(monster, ctx);
        return { dmg: 0, died: false, effectLineDismissal: null };
    case 'psi-bolt':
        return await mcastPsiBolt(dmg, ctx);
    case 'open-wounds':
        return await mcastOpenWounds(dmg, ctx);
    case 'geyser':
        return await mcastGeyser(ctx);
    case 'fire-pillar':
        return await mcastFirePillar(ctx);
    case 'lightning':
        return await mcastLightning(ctx);
    case 'insects': {
        // mcast_insects()'s own feedback goes through the plain publisher.
        const result = await summonMonsterInsects(monster, ctx.state);
        if (result.message) await plineWithContinuation(result.message);
        return { dmg: 0, died: false, effectLineDismissal: null };
    }
    case 'blind-you':
        return { dmg: 0, died: false, effectLineDismissal: await mcastBlindYou(ctx) };
    case 'paralyze':
        return await mcastParalyze(monster, ctx);
    case 'confuse-you':
        await mcastConfuseYou(monster, ctx);
        return { dmg: 0, died: false, effectLineDismissal: null };
    }
}

// The context for castmu(FALSE,FALSE) from dochug(): zero damage and
// undirected spells only, so the finishers below stay out of reach (the
// damaging spells are all directed); they carry the standard
// monster-message death handling.
export function movementSpellContext(
    monster: Monster,
    state: PlayingGameState,
    calls: MonsterCallLog = [],
    overrides: Partial<McastuSpellContext> = {},
): McastuSpellContext {
    return {
        state,
        publish: plineWithContinuation,
        random: rn2,
        rollDice: d,
        rollOne: rnd,
        calls,
        fatalDamage: () => finishMonsterAttackDeath(monster),
        strengthLossDeath: (): DeathHandler => options =>
            finishHeroDeathAfterMonsterMessage(options),
        ...overrides,
    };
}

// C mcastu.c:m_cure_self().
async function mCureSelf(monster: Monster, ctx: McastuSpellContext): Promise<void> {
    if ((monster.mhp ?? 0) >= (monster.mhpmax ?? monster.mhp ?? 0)) return;
    if (canSeeMonster(monster))
        await ctx.publish(`${canonicalMonsterName(monster, { state: ctx.state, capitalized: true })} looks better.`);
    const healing = ctx.rollDice(3, 6);
    ctx.calls.push('d(3,6)');
    monster.mhp = Math.min(monster.mhpmax ?? monster.mhp, (monster.mhp ?? 0) + healing);
}

// C mcastu.c:mcast_death_touch().
async function mcastDeathTouch(monster: Monster, ctx: McastuSpellContext): Promise<boolean> {
    const { state } = ctx;
    await ctx.publish(`Oh no, ${monsterSubjectPronoun(monster, { state })}'s using the touch of death!`);
    const u = state.u;
    const polymorphed = Upolyd(u);
    const form = polymorphed ? u.umonnum : null;
    const nonliving = form !== null && Number.isInteger(form)
        && monsterIsNonliving(form);
    const demon = form !== null && Number.isInteger(form)
        && !!((MONSTER_FLAGS2[form] ?? 0) & 0x00000100);
    if (nonliving || demon) {
        await ctx.publish('You seem no deader than before.');
        return false;
    }
    const antimagic = !!u.antimagic;
    let succeeds = false;
    if (!antimagic) {
        const sides = Math.max(1, monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0);
        const successRoll = ctx.random(sides);
        ctx.calls.push('rn2(' + sides + ')');
        succeeds = successRoll > 12;
    }
    if (!succeeds) {
        if (antimagic) {
            await shieldeff(u.ux, u.uy, state);
            monstersObserveHeroResistance(M_SEEN_MAGR, state);
        }
        await ctx.publish("Lucky for you, it didn't work!");
        return false;
    }
    if (heroIsHallucinating(state)) {
        await ctx.publish('You have an out of body experience.');
        monstersForgetHeroResistance(M_SEEN_MAGR, state);
        return false;
    }
    const died = await touchHeroWithDeath(monster, state, ctx.publish, (count, sides) => {
        ctx.calls.push(`d(${count},${sides})`);
        return ctx.rollDice(count, sides);
    });
    if (!died) monstersForgetHeroResistance(M_SEEN_MAGR, state);
    return died;
}

// C mcastu.c:mcast_clone_wiz().
async function mcastCloneWiz(monster: Monster, ctx: McastuSpellContext): Promise<void> {
    await ctx.publish('Double Trouble...');
    const clone = await makemonNear(DEATH_PM_WIZARD_OF_YENDOR, ctx.state.u.ux, ctx.state.u.uy, MM_NOWAIT);
    if (clone) await finishWizardClone(clone, ctx.state, ctx.random, ctx.calls);
}

// C mcastu.c:mcast_summon_mons().
async function mcastSummonMons(monster: Monster, ctx: McastuSpellContext): Promise<void> {
    const effect = await monsterSummonSpellEffect(monster, ctx.state);
    if (effect.message) await ctx.publish(effect.message);
}

// C mcastu.c:mcast_destroy_armor().
async function mcastDestroyArmor(ctx: McastuSpellContext): Promise<void> {
    const { state } = ctx;
    if (state.u?.antimagic) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        await plineWithContinuation('A field of force surrounds you!');
        return;
    }
    if (!await erodeWornArmor(state)) await plineWithContinuation('Your skin itches.');
    else monstersForgetHeroResistance(M_SEEN_MAGR, state);
}

// C mcastu.c:mcast_weaken_you().
async function mcastWeakenYou(monster: Monster, ctx: McastuSpellContext): Promise<boolean> {
    const { state } = ctx;
    if (state.u?.antimagic) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        await ctx.publish(formatFeltMessage('momentarily weakened.', state));
        return false;
    }
    await ctx.publish('You suddenly feel weaker!');
    const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
    let lossSides = Math.max(1, monsterLevel - 6);
    if (heroHasHalfSpellDamage(state)) lossSides = Math.trunc((lossSides + 1) / 2);
    const amount = ctx.rollOne(lossSides);
    ctx.calls.push(`rnd(${lossSides})`);
    const killer = monsterSpellDeathReason(monster, 'strength loss');
    const died = await loseHeroStrength(amount, killer, {
        state,
        publish: ctx.publish,
        deathCause: `killed by ${killer}`,
        random: range => {
            ctx.calls.push(`rn2(${range})`);
            return ctx.random(range);
        },
        die: ctx.strengthLossDeath(killer),
    });
    if (!died) monstersForgetHeroResistance(M_SEEN_MAGR, state);
    return died;
}

// C mcastu.c:mcast_disappear().  mon_set_minvis() repaints the caster's
// square, and a spot no longer spotted keeps its remembered-I glyph.
async function mcastDisappear(monster: Monster, ctx: McastuSpellContext): Promise<void> {
    const { state } = ctx;
    if (canSeeMonster(monster)) {
        await ctx.publish(`${canonicalMonsterName(monster, { state, capitalized: true })} suddenly ${
            heroCanSeeInvisible(state) ? 'becomes transparent' : 'disappears'}!`);
    }
    setMonsterPermanentInvisibility(monster);
    await newsym(monster.mx, monster.my);
    if (cansee(monster.mx, monster.my) && !canSpotMonster(monster))
        await map_invisible(monster.mx, monster.my);
}

// C mcastu.c:mcast_stun_you().
async function mcastStunYou(ctx: McastuSpellContext): Promise<void> {
    const { state } = ctx;
    const resisted = !!(state.u?.antimagic || heroHasFreeAction(state));
    const alreadyStunned = !!state.u.stunned || (state.u.stunnedTurns ?? 0) > 0;
    let duration = 1;
    if (resisted) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        if (!alreadyStunned)
            await ctx.publish(formatFeltMessage('momentarily disoriented.', state));
    } else {
        await ctx.publish(alreadyStunned ? 'You struggle to keep your balance.' : 'You reel...');
        const dexterity = currentAttribute(A_DEX, state);
        const dice = dexterity < 12 ? 6 : 4;
        duration = ctx.rollDice(dice, 4);
        ctx.calls.push('d(' + dice + ',4)');
        if (heroHasHalfSpellDamage(state)) duration = Math.trunc((duration + 1) / 2);
        duration += state.u?.stunnedTurns ?? 0;
    }
    if (!!state.u.stunnedTurns !== !!duration) state.context.botl = true;
    state.u.stunnedTurns = duration;
    state.u.stunned = duration > 0;
    if (!resisted) monstersForgetHeroResistance(M_SEEN_MAGR, state);
}

// C mcastu.c:mcast_spell() MCAST_HASTE_SELF: mon_adjust_speed(mtmp, 1, 0).
async function mcastHasteSelf(monster: Monster, ctx: McastuSpellContext): Promise<void> {
    const effect = monsterHasteSelfEffect(monster, ctx.state);
    if (effect.message) await ctx.publish(effect.message);
}

// C mcastu.c:mcast_psi_bolt().
async function mcastPsiBolt(dmg: number, ctx: McastuSpellContext): Promise<McastuSpellOutcome> {
    const { state } = ctx;
    if (state.u.antimagic) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        dmg = Math.trunc((dmg + 1) / 2);
    } else {
        monstersForgetHeroResistance(M_SEEN_MAGR, state);
    }
    const head = heroHeadName(state);
    const effectLineDismissal = await ctx.publish(
        dmg <= 5 ? `You get a slight ${head}ache.`
            : dmg <= 10 ? 'Your brain is on fire!'
                : dmg <= 20 ? `Your ${head} suddenly aches painfully!`
                    : `Your ${head} suddenly aches very painfully!`,
    );
    return { dmg, died: false, effectLineDismissal };
}

// C mcastu.c:mcast_open_wounds().
async function mcastOpenWounds(dmg: number, ctx: McastuSpellContext): Promise<McastuSpellOutcome> {
    const { state } = ctx;
    if (state.u.antimagic) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        dmg = Math.trunc((dmg + 1) / 2);
    } else {
        monstersForgetHeroResistance(M_SEEN_MAGR, state);
    }
    const effectLineDismissal = await ctx.publish(
        dmg <= 5 ? 'Your skin itches badly for a moment.'
            : dmg <= 10 ? 'Wounds appear on your body!'
                : dmg <= 20 ? 'Severe wounds appear on your body!'
                    : 'Your body is covered with painful wounds!',
    );
    return { dmg, died: false, effectLineDismissal };
}

// C mcastu.c:mcast_geyser().  This discards castmu()'s level-scaled spell
// pre-roll and rolls a fresh physical 8d6: half physical damage applies,
// half spell damage and elemental resistances do not.
async function mcastGeyser(ctx: McastuSpellContext): Promise<McastuSpellOutcome> {
    const { state } = ctx;
    const effectLineDismissal = await ctx.publish('A sudden geyser slams into you from nowhere!');
    const originalDamage = ctx.rollDice(8, 6);
    ctx.calls.push('d(8,6)');
    const dmg = state.u.halfPhysicalDamage
        ? Math.trunc((originalDamage + 1) / 2) : originalDamage;
    return { dmg, died: false, effectLineDismissal };
}

// C mcastu.c:mcast_fire_pillar().
async function mcastFirePillar(ctx: McastuSpellContext): Promise<McastuSpellOutcome> {
    const { state } = ctx;
    const effectLineDismissal = await ctx.publish('A pillar of fire strikes all around you!');
    const originalDamage = ctx.rollDice(8, 6);
    ctx.calls.push('d(8,6)');
    const fireResistant = !!state.u.fireResistance;
    if (fireResistant) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_FIRE, state);
    } else monstersForgetHeroResistance(M_SEEN_FIRE, state);
    let dmg = fireResistant ? 0 : originalDamage;
    if (heroHasHalfSpellDamage(state))
        dmg = Math.trunc((dmg + 1) / 2);

    if (clearHeroSliming(state)) {
        await ctx.publish('The slime that covers you is burned away!');
    }
    // burnarmor() retries until it hits a worn slot; it keeps the global
    // die, as the deferred resolver did.
    await burnHeroArmorByFire(state, ctx.publish, ctx.calls, rn2);
    const items = await destroyFireInventory(originalDamage, {
        state,
        publish: ctx.publish,
        die: finishHeroDeathAfterMonsterMessage,
    });
    if (items.heroDied) return { dmg: 0, died: true, effectLineDismissal };
    await igniteItems(state.inventory, {
        state,
        publish: ctx.publish,
    });
    await applyRayFloorFeatures('fire', state.u.ux, state.u.uy, state, {
        rayNoun: 'spell', heroCaused: false, publish: ctx.publish,
    });
    if (state.program_state.gameover) return { dmg: 0, died: true, effectLineDismissal };
    return { dmg, died: false, effectLineDismissal };
}

// C mcastu.c:mcast_lightning().
async function mcastLightning(ctx: McastuSpellContext): Promise<McastuSpellOutcome> {
    const { state } = ctx;
    const effectLineDismissal = await ctx.publish('A bolt of lightning strikes down at you from above!');
    const reflection = heroReflectionSource(state);
    if (reflection) {
        await ctx.publish(`It bounces off your ${reflection.noun}.`);
        discoverHeroReflectionSource(reflection, state);
    }
    const originalDamage = ctx.rollDice(8, 6);
    ctx.calls.push('d(8,6)');
    const shockResistant = !!state.u.shockResistance;
    if (reflection || shockResistant)
        await shieldeff(state.u.ux, state.u.uy, state);
    if (reflection) {
        monstersObserveHeroResistance(M_SEEN_REFL, state);
        return { dmg: 0, died: false, effectLineDismissal };
    }
    if (shockResistant) {
        monstersForgetHeroResistance(M_SEEN_REFL, state);
        monstersObserveHeroResistance(M_SEEN_ELEC, state);
    } else monstersForgetHeroResistance(M_SEEN_ELEC | M_SEEN_REFL, state);
    let dmg = shockResistant ? 0 : originalDamage;
    if (heroHasHalfSpellDamage(state))
        dmg = Math.trunc((dmg + 1) / 2);

    const items = await destroyElectricInventory(originalDamage, {
        state,
        publish: ctx.publish,
        die: finishHeroDeathAfterMonsterMessage,
    });
    if (items.heroDied) return { dmg: 0, died: true, effectLineDismissal };
    await applyRayFloorFeatures('lightning', state.u.ux, state.u.uy, state, {
        rayNoun: 'spell', heroCaused: false, publish: ctx.publish,
    });
    if (state.program_state.gameover) return { dmg: 0, died: true, effectLineDismissal };

    const flashDuration = ctx.rollOne(100);
    ctx.calls.push('rnd(100)');
    await flashBurn(flashDuration, true, { state, publish: ctx.publish });
    return { dmg, died: false, effectLineDismissal };
}

// C mcastu.c:mcast_blind_you().
async function mcastBlindYou(ctx: McastuSpellContext): Promise<number | null | undefined> {
    const { state } = ctx;
    const eye = heroEyeName(state);
    const dismissal = await ctx.publish(`Scales cover your ${
        heroEyeCount(state) === 1 ? eye : makePlural(eye)}!`);
    await makeBlinded(heroHasHalfSpellDamage(state) ? 100 : 200,
        { state, talk: false, publish: ctx.publish });
    if (!heroIsBlind(state)) await ctx.publish('Your vision clears.');
    return dismissal;
}

// C mcastu.c:mcast_paralyze().  The paralysis duration doubles as the
// mdamageu() damage; the nomul() inside already ends any run.
async function mcastParalyze(monster: Monster, ctx: McastuSpellContext): Promise<McastuSpellOutcome> {
    const { state } = ctx;
    const resisted = !!(state.u?.antimagic || heroHasFreeAction(state));
    const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
    let duration = resisted ? 1 : 4 + monsterLevel;
    if (heroHasHalfSpellDamage(state)) duration = Math.trunc((duration + 1) / 2);
    let effectLineDismissal: number | null | undefined = null;
    if (resisted) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        if (!heroHasInvoluntaryDelay(state))
            effectLineDismissal = await ctx.publish('You stiffen briefly.');
    } else {
        if (!heroHasInvoluntaryDelay(state))
            effectLineDismissal = await ctx.publish('You are frozen in place!');
        monstersForgetHeroResistance(M_SEEN_MAGR, state);
    }
    nomul(-duration, state);
    state._helplessReason = 'paralyzed by a monster';
    state._helplessDoneMessage = null;
    return { dmg: duration, died: false, effectLineDismissal };
}

// C mcastu.c:mcast_confuse_you().  make_confused() commits before its
// explicit feedback pline, so a pager forced by that line already shows
// Conf; monstunseesu() follows the line.
async function mcastConfuseYou(monster: Monster, ctx: McastuSpellContext): Promise<void> {
    const { state } = ctx;
    if (state.u?.antimagic) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
        await ctx.publish(formatFeltMessage('momentarily dizzy.', state));
        return;
    }
    const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
    let duration = monsterLevel;
    if (heroHasHalfSpellDamage(state)) duration = Math.trunc((duration + 1) / 2);
    const alreadyConfused = (state.u.confusionTurns ?? 0) > 0;
    if (!state.u.confusionTurns && duration) state.context.botl = true;
    state.u.confusionTurns = (state.u.confusionTurns ?? 0) + duration;
    await ctx.publish(formatFeltMessage(
        heroIsHallucinating(state)
            ? alreadyConfused ? 'trippier!' : 'trippy!'
            : alreadyConfused ? 'more confused!' : 'confused!',
        state,
    ));
    monstersForgetHeroResistance(M_SEEN_MAGR, state);
}

// mdamageu() subtracts from the active body. Keep raw HP for tty's -1
// sentinel; the presenter owns rehumanization and fatal input afterward.
export function applyHeroSpellDamage(
    attack: HeroSpellAttack,
    damage: number,
    state: PlayingGameState,
) {
    const hpKey = Upolyd(state.u) ? 'mh' : 'uhp';
    const hpBefore = state.u[hpKey];
    state.context.botl = true;
    const hpMax = hpKey === 'mh' ? state.u.mhmax : state.u.uhpmax;
    state.u[hpKey] = Math.min(hpMax, hpBefore - damage);
    attack.appliedDamage = damage;
    attack.rehumanize = hpKey === 'mh' && state.u.mh < 1;
    attack.heroDied = hpKey === 'uhp' && state.u.uhp < 1;
}

export function heroCanSeeInvisible(state: PlayingGameState) {
    return !!(state?.u?.seeInvisible || (state?.u?.seeInvisibleTurns ?? 0) > 0);
}

export function monsterSpellUseless(
    monster: Monster,
    spell: MonsterSpell,
    state: PlayingGameState,
    random: RandomBelow = rn2,
    calls: MonsterCallLog = [],
) {
    if (spell.flags & MCF_HOSTILE && monster.mpeaceful) return true;
    if (spell.flags & MCF_SIGHT && !couldsee(monster.mx, monster.my)) return true;
    if (spell.key === 'cure-self') return (monster.mhp ?? 0) >= (monster.mhpmax ?? 0);
    if (spell.key === 'blind-you') return heroIsBlinded(state);
    if (spell.key === 'haste-self') return monster.permspeed === MFAST;
    if (spell.key === 'disappear') {
        return (
            !!monster.minvis ||
            !!monster.invis_blkd ||
            // mcastu.c keeps peaceful monsters visible to a hero who lacks
            // See_invisible.  choose_monster_spell() then continues down the
            // same spell table without consuming another selection draw.
            (!!monster.mpeaceful && !heroCanSeeInvisible(state))
        );
    }
    if (spell.key === 'death-touch') {
        const resisted = !!(state?.u?.antimagic || heroIsHallucinating(state));
        return resisted && recordRandom(random, calls, 2) === 0;
    }
    if (spell.key === 'geyser') return recordRandom(random, calls, 5) === 0;
    if (spell.key === 'clone-wizard') return !monster.iswiz || (state.context.no_of_wizards ?? 0) > 1;
    if (spell.key === 'aggravation' && !monsterSpellHasAggravatables(monster, state)) {
        return recordRandom(random, calls, 100) !== 0;
    }
    return false;
}

// C mcastu.c:choose_monster_spell().  Selection is observable even when a
// peaceful caster rejects the directed/hostile result and proceeds to move.
export function chooseMonsterSpell(
    monster: Monster,
    damageType: typeof AD_CLRC | typeof AD_SPEL,
    state: PlayingGameState,
    random: RandomBelow,
    calls: MonsterCallLog,
): MonsterSpell {
    const list = damageType === AD_CLRC ? MONSTER_CLERIC_SPELLS : MONSTER_WIZARD_SPELLS;
    const lastSpell = list.at(-1);
    if (!lastSpell) throw new Error('Native monster spell tables must contain a fallback spell');
    const maxLevel = lastSpell.level;
    let spellValue = recordRandom(random, calls, Math.max(1, monster.m_lev || 1));
    if (spellValue > maxLevel && recordRandom(random, calls, Math.max(1, maxLevel)) !== 0) {
        spellValue = recordRandom(random, calls, Math.max(1, maxLevel));
    }
    for (let index = list.length - 1; index >= 0; index--) {
        const spell = list[index];
        if (
            spell &&
            spell.level <= spellValue &&
            !monsterSpellUseless(monster, spell, state, random, calls)
        )
            return spell;
    }
    return list[0];
}

export function monsterCurseKind(monster: Monster, undirected: boolean, state: PlayingGameState,
    random: RandomBelow, calls: MonsterCallLog): Exclude<HeroSpellAttack['curseKind'], undefined> {
    if (canSeeMonster(monster) && couldsee(monster.mx, monster.my)) {
        if (undirected) return 'visible-undirected';
        const wrongTarget = monster.mux !== state.u.ux || monster.muy !== state.u.uy;
        if (heroIsInvisible(state) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS) && wrongTarget
            || M_AP_TYPE(state.u) === M_AP_OBJECT && state.u.mappearance === 0 || state.u.uundetected)
            return 'visible-general';
        if (heroIsDisplaced(state) && wrongTarget) return 'visible-displaced';
        return 'visible-directed';
    }
    if ((!(state.moves % 4) || !recordRandom(random, calls, 4)) && !heroIsDeaf(state)) return 'audible';
    return null;
}

async function publishMonsterSpellFailure(monster: Monster, spell: MonsterSpell,
    state: PlayingGameState, random: RandomBelow, calls: MonsterCallLog): Promise<void> {
    const kind = monsterCurseKind(monster, !!(spell.flags & MCF_INDIRECT), state, random, calls);
    if (kind === 'audible') await plineWithContinuation('You hear a mumbled curse.', { noRepeat: true });
    else if (kind) {
        const points = kind === 'visible-undirected' ? 'all around, then curses'
            : kind === 'visible-general' ? 'and curses in your general direction'
                : kind === 'visible-displaced' ? 'and curses at your displaced image' : 'at you, then curses';
        await plineWithContinuation(`${canonicalMonsterName(monster, { state, capitalized: true })} points ${points}.`);
    }
}

export async function movementSpellSelections(
    monster: Monster,
    state: PlayingGameState,
    random: RandomBelow,
    calls: MonsterCallLog,
): Promise<MovementSpellCast | null> {
    if (
        monster.mspec_used ||
        dist2(monster.mx, monster.my, state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my) > 49
    )
        return null;
    for (const [attackType, damageType] of MONSTER_ATTACKS[monster.mnum] || []) {
        if (attackType !== AT_MAGC || (damageType !== AD_CLRC && damageType !== AD_SPEL)) continue;
        const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
        if (!monsterLevel) {
            await publishMonsterSpellFailure(monster, MONSTER_WIZARD_SPELLS[0], state, random, calls);
            continue;
        }
        const spell = chooseMonsterSpell(monster, damageType, state, random, calls);
        if (!spell) continue;
        // castmu(FALSE,FALSE) selects once.  Directed or currently-useless
        // spells miss without spending the action; a successful indirect
        // spell bypasses m_move() and owns the whole actor transaction.
        if (
            !(spell.flags & MCF_INDIRECT) ||
            monsterSpellUseless(monster, spell, state, random, calls)
        )
            continue;
        if (monster.mcan || monster.mspec_used) {
            await publishMonsterSpellFailure(monster, spell, state, random, calls);
            continue;
        }
        monster.mspec_used = monsterLevel < 8 ? 10 - monsterLevel : 2;
        endVoluntaryMultiTurn(state);
        const fumble =
            recordRandom(random, calls, Math.max(1, monsterLevel * 10)) <
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
        };
    }
    return null;
}

async function monsterSummonSpellEffect(
    monster: Monster,
    state: PlayingGameState,
): Promise<MonsterSpellEffect> {
    let effect: MonsterSpellEffect = { count: 0, created: [], message: null };
    const summoned = await summonNastyMonsters(monster);
    effect = {
        ...effect,
        // nasty() delegates to msummon(NULL), using the Wizard's demon choices.
        ...(summoned.deferredDemonSummon ? await msummon() : summoned),
    };
    if (effect.count > 0) {
        if (monster?.iswiz) {
            effect.message = `"Destroy the thief, my pet${effect.count === 1 ? '' : 's'}!"`;
        } else {
            const one = effect.count === 1;
            const appearance = one ? 'A monster appears' : 'Monsters appear';
            const heroX = state?.u?.ux ?? monster?.mux;
            const heroY = state?.u?.uy ?? monster?.muy;
            const wrongTarget = monster?.mux !== heroX || monster?.muy !== heroY;
            const cannotSeeInvisible = !((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_SEE_INVIS);
            if (heroIsInvisible(state) && cannotSeeInvisible && wrongTarget) {
                effect.message = `${appearance} ${one ? 'at' : 'around'} a spot near you!`;
            } else if (heroIsDisplaced(state) && wrongTarget) {
                effect.message = `${appearance} ${one ? 'by' : 'around'} your displaced image!`;
            } else {
                effect.message = `${appearance} from nowhere!`;
            }
        }
    }
    return effect;
}

function monsterHasteSelfEffect(monster: Monster, state: PlayingGameState) {
    const speed = adjustMonsterSpeed(monster, 1);
    const message = speed.changed && speed.canDescribe && !state.in_mklev
        && canSeeMonster(monster)
        ? monsterSpeedMessage(speed, canonicalMonsterName(monster, { state, capitalized: true }))
        : null;
    return { message, oldSpeed: speed.oldSpeed, speed: speed.speed };
}

// C mcastu.c:touch_of_death(). Entered from uhitm.c:mhitm_ad_deth()'s hero
// branch and mcast_death_touch(); spellcasting gates its own immunity and
// success before calling, Death's natural touch uses the same effect.
export async function touchHeroWithDeath(
    monster: Monster, state: PlayingGameState, publish: MessagePublisher, rollDice = d,
): Promise<boolean> {
    const damage = 50 + rollDice(8, 6);
    const drain = Math.trunc(damage / 2);
    await publish(formatFeltMessage('drained...', state));
    const killer = monsterSpellDeathReason(monster, 'the touch of death');
    const hero = state.u;
    if (Upolyd(hero)) {
        hero.mh = 0;
        return (await returnHeroToHumanForm(state, { publish })).died;
    }
    if (drain >= hero.uhpmax)
        return finishHeroDeath({ killer, killerFormat: KILLED_BY, deathLineShown: true });

    const oldHp = hero.uhp;
    hero.uhpmax = Math.max(hero.ulevel, 3, hero.uhpmax - drain);
    hero.uhp = Math.min(hero.uhp, hero.uhpmax);
    state.context.botl = true;
    const remainingDamage = Math.max(1, damage - (oldHp - hero.uhp));
    return loseHeroHp(remainingDamage, killer, { state, publish, killerFormat: KILLED_BY });
}

// C mcastu.c:death_inflicted_by(). This names the real species, not a
// perceived identity, priest title, shopkeeper name, or given name.
const DEATH_G_UNIQ = 0x1000;
const DEATH_M2_PNAME = 0x00080000;
const DEATH_PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const DEATH_PM_WIZARD_OF_YENDOR = MONSTER_NAME.indexOf('Wizard of Yendor');

export function monsterSpellDeathReason(monster: Monster, reason: string): string {
    const current = monster.mnum;
    const base = ismnum(monster.cham) ? monster.cham : current;
    const unique = current === DEATH_PM_WIZARD_OF_YENDOR
        || (!((MONSTER_FLAGS2[current] ?? 0) & DEATH_M2_PNAME)
            && !!((MONSTER_GENO[current] ?? 0) & DEATH_G_UNIQ)
            && current !== DEATH_PM_HIGH_CLERIC && current !== SPECIAL_PM);
    let name = monsterTypeName(base, monster.female);
    if (!((MONSTER_FLAGS2[base] ?? 0) & DEATH_M2_PNAME) && !unique)
        name = withIndefiniteArticle(name);
    let killer = `${reason} inflicted by ${unique ? 'the ' : ''}${name}`;
    if (base !== current) {
        const form = monsterTypeName(current, monster.female);
        killer += ` imitating ${withIndefiniteArticle(form)}`;
    }
    return killer;
}

// ---------------------------------------------------------------------------
// C mcastu.c:buzzmu(). Ranged spell rays are one original attack slot.
// ---------------------------------------------------------------------------

const STRANGE_OBJECT = 0;

async function curseDirectedSpell(monster: Monster, state: GameState, publish: MessagePublisher, random: typeof rn2) {
    if (canSeeMonster(monster)
        && couldsee(monster.mx, monster.my)) {
        const misplaced = monster.mux !== state.u.ux || monster.muy !== state.u.uy;
        const mimicking = state.u.m_ap_type === M_AP_OBJECT
            && state.u.mappearance === STRANGE_OBJECT;
        let pointing = 'at you, then curses';
        if ((heroIsInvisible(state) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS)
            && misplaced) || mimicking || state.u.uundetected) {
            pointing = 'and curses in your general direction';
        } else if (heroIsDisplaced(state) && misplaced) {
            pointing = 'and curses at your displaced image';
        }
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} points ${pointing}.`);
    } else if (!(state.moves % 4) || !random(4)) {
        const message = 'You hear a mumbled curse.';
        if (!heroIsDeaf(state)) await publish(message, { noRepeat: true });
    }
}

export interface MonsterMagicRayOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
    calls?: MonsterCallLog;
    die?: DeathHandler;
}

export async function resolveMonsterMagicRay(monster: Monster, attack: MonsterAttack, {
    state = game, publish = plineWithContinuation,
    random = rn2, rollDice = d, rollOne = rnd, calls = [], die = finishHeroDeath,
}: MonsterMagicRayOptions = {}) {
    requirePlayingGame(state);
    const damageType = attack[1];
    if (damageType < AD_MAGM || damageType > AD_SPC2)
        return { mask: M_ATTK_MISS, heroDied: false };
    if (monster.mcan || ((monster.seen_resistance || 0) & seenResistanceForDamage(damageType))) {
        await curseDirectedSpell(monster, state, publish, random);
        return { mask: M_ATTK_MISS, heroDied: false };
    }
    if (!monsterLinedUpWithPerceivedHero(monster, state, random, calls) || !random(3))
        return { mask: M_ATTK_MISS, heroDied: false };
    endVoluntaryMultiTurn(state);
    if (canSeeMonster(monster)) {
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} zaps you with a ${displayRayName(damageType, 'wand', { state, random })}!`);
    }
    const dx = Math.sign((monster.mux ?? state.u.ux) - monster.mx);
    const dy = Math.sign((monster.muy ?? state.u.uy) - monster.my);
    const direction = [['y', 'k', 'u'], ['h', null, 'l'], ['b', 'j', 'n']][dy + 1]?.[dx + 1];
    if (!direction) return { mask: M_ATTK_HIT, heroDied: false };
    const result = await castMonsterSpellRay(direction, monster.mx, monster.my, attack, {
        state, sourceMonster: monster, publish, random, rollDice, rollOne, die,
    });
    return { mask: M_ATTK_HIT, heroDied: result.heroDied };
}

// ---------------------------------------------------------------------------
// C mcastu.c:mcast_insects(). Feedback depends on sensing the caster and
// spotting the summons separately; blindness alone answers neither question.
// ---------------------------------------------------------------------------

const S_ANT = 1;
const S_SNAKE = 45;

export async function summonMonsterInsects(caster: Monster, state: PlayingGameState): Promise<MonsterSpellEffect> {
    const monsterClass = mkclassAligned(S_ANT, 0) === null ? S_SNAKE : S_ANT;
    const oldSeen = spottedMonsterCount(state);
    const level = caster.m_lev ?? 0;
    const quantity = Math.max(3, level < 2 ? 1 : rnd(Math.trunc(level / 2)));
    const created: Monster[] = [];
    for (let index = 0; index <= quantity; index++) {
        const point = findNearbyMonsterPosition(caster.mnum,
            caster.mux ?? state.u.ux, caster.muy ?? state.u.uy, { state });
        // Native returns immediately if enexto() fails, including after
        // earlier successful births; it gives no summoning feedback then.
        if (!point) return { count: created.length, created, message: null };
        const species = mkclassAligned(monsterClass, 0);
        if (species === null) continue;
        const monster = await makemonAt(species, point.x, point.y, MM_ANGRY | MM_NOMSG);
        if (!monster) continue;
        monster.msleeping = 0;
        monster.mpeaceful = 0;
        monster.mtame = 0;
        setMonsterMalign(monster, state);
        await newsym(monster.mx, monster.my);
        created.push(monster);
    }

    const newSeen = spottedMonsterCount(state);
    const seeCaster = canSeeMonster(caster) || !!(howMonsterSeen(caster) & MONSEEN_TELEPAT)
        || heroDetectsMonsters(state);
    const what = heroIsHallucinating(state) ? makePlural(randomBogusMonsterName())
        : monsterClass === S_SNAKE ? 'snakes' : 'insects';
    let message: string | null;
    if (!seeCaster) {
        if (newSeen <= oldSeen || heroIsUnaware(state)) {
            message = formatHeardMessage(`someone summoning ${what}.`, state);
        } else {
            const subject = newSeen === oldSeen + 1 ? withIndefiniteArticle(makeSingular(what)) : what;
            const appearance = `${subject} ${verbForSubject(subject, 'appear')}.`;
            message = heroIsDeaf(state) ? appearance.charAt(0).toUpperCase() + appearance.slice(1)
                : formatHeardMessage(`someone summoning something, and ${appearance}`, state);
        }
    } else {
        const subject = canonicalMonsterName(caster, { state, capitalized: true });
        const wrongTarget = caster.mux !== state.u.ux || caster.muy !== state.u.uy;
        if (!created.length) message = `${subject} casts at a clump of sticks, but nothing happens.`;
        else if (monsterClass === S_SNAKE) message = `${subject} transforms a clump of sticks into ${what}!`;
        else if (heroIsInvisible(state) && !((MONSTER_FLAGS1[caster.mnum] ?? 0) & M1_SEE_INVIS) && wrongTarget)
            message = `${subject} summons ${what} around a spot near you!`;
        else if (heroIsDisplaced(state) && wrongTarget)
            message = `${subject} summons ${what} around your displaced image!`;
        else message = `${subject} summons ${what}!`;
    }
    return { count: created.length, created, message };
}

function spottedMonsterCount(state: PlayingGameState): number {
    return state.level.monsters.filter(monster => !monster.dead && monster.mhp > 0
        && !(monster.isgd && monster.mx === 0) && canSpotMonster(monster)).length;
}
