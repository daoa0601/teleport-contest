// Monster attacks against the hero: the mattacku() attack sequence, its
// hitmu()/mdamageu() damage and resume machinery, and slot presentation.
// C ref: mhitu.c.

import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { game, requireInitializedGame, requireLiveGame } from './gstate.js';
import type { PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type {
    HeroAttack, HeroAttackSequence, HeroAttackSlot, HeroContactAttack,
    MonsterMovementAction, MonsterCallLog,
    RandomBelow, RollDice, RollOne,
    AttackTuple, MonsterAttackInitiation, MonsterAttackPaging,
    MonsterDamageOptions, MonsterEngulfOptions, PublishMonsterMessage,
} from './monster_action_types.js';
import type { AttackMethod } from './monster_attack_types.js';
import { recordRandom } from './monster_action_types.js';
import {
    A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, KILLED_BY, KILLED_BY_AN,
    LARGEST_INT, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE,
    M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, M_SEEN_MAGR,
    NEED_HTH_WEAPON, NEED_WEAPON, PIT, QBUFSZ, RLOC_MSG, SPIKED_PIT, Upolyd, WATER,
} from './const.js';
import type { MessagePublisher } from './pline.js';
import { plineWithContinuation } from './pline.js';
import { displayMessageWindow } from './tty_topline.js';
import {
    canSpotMonster, canSeeMonster, flush_screen, map_invisible, newsym,
    senseWithTelepathy,
} from './display.js';
import { cansee } from './vision.js';
import {
    monsterName, monsterName as canonicalMonsterName, monsterObjectPronoun,
    monsterSubjectPronoun, possessiveName, visibleMonsterSubject,
} from './monster_name.js';
import { monsterMissMessage } from './monster_miss.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL,
    MONSTER_NAME, MONSTER_SYMBOL, monsterHatesBlessings, monsterIsAnimal,
    monsterIsThickSkinned, monsterIsUndead, monsterIsUnsolid,
    monsterIsVampireShifter,
} from './monster_data.js';
import {
    AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CONF, AD_CORR, AD_CURS,
    AD_DCAY, AD_DETH, AD_DISE, AD_DGST, AD_DRIN, AD_DRLI, AD_ELEC,
    AD_ENCH, AD_FAMN, AD_FIRE, AD_HEAL, AD_LEGS, AD_MAGM, AD_PEST,
    AD_PHYS, AD_PLYS, AD_POLY, AD_RUST, AD_SAMU, AD_SEDU, AD_SGLD,
    AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPEL, AD_SPC2, AD_SSEX,
    AD_STCK, AD_STON, AD_STUN, AD_TLPT, AD_WERE, AD_WRAP,
    AT_BITE, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE,
    AT_HUGS, AT_KICK, AT_MAGC, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH,
    AT_WEAP,
} from './monster_attack_types.js';
import { heroDetectsMonsters, heroIsBlind, heroIsDeaf } from './senses.js';
import { heroIsInvisible } from './hero_invisibility.js';
import {
    armorSimpleName, armorSlotFor, heroHasDrainResistance, heroIsDisplaced,
    stopDonning,
} from './armor.js';
import { monsterWieldedWeapon, swingMonsterWeapon, wieldMonsterWeapon } from './monster_weapon.js';
import { applyArtifactHit } from './artifact_hit.js';
import { artifactById } from './artifacts.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { stopHeroOccupation } from './occupation.js';
import { stopRun } from './runmode.js';
import { makeBlinded } from './sight_change.js';
import { finishHeroDeathAfterMonsterMessage, finishMonsterAttackDeath } from './monster_attack_death.js';
import type { MonsterAttackDeathOptions } from './monster_attack_death.js';
import { erodeArmor, erodeAttackingWeapon } from './object_erosion.js';
import {
    adjustAttribute, currentAttribute, exerciseAttribute, loseHeroStrength,
} from './attrib.js';
import { adjustHeroAlignment } from './alignment.js';
import { removeHeroAccessory, wearHeroAccessory } from './accessory.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { returnHeroToHumanForm } from './polyself.js';
import { d, rn2, rnd } from './rng.js';
import {
    completeMonsterOffensiveAction,
    resumeDeferredSpecialAttack,
    presentMonsterPickups,
    presentMonsterPostMove,
} from './monmove.js';
import {
    attackHeroWithRangedWeapon, maybeBreatheAtHero, resolveDeferredMonsterBreath,
    resolveMonsterSpitAtHero,
} from './mthrowu.js';
import {
    beginDeferredHeroCloneWizard,
    finishDeferredHeroCloneWizard,
    chooseMonsterSpell,
    resolveDeferredHeroAggravation,
    resolveDeferredHeroCurseItems,
    resolveDeferredHeroDeathTouch,
    resolveDeferredHeroDestroyArmor,
    resolveDeferredHeroDirectSpell,
    resolveDeferredHeroFirePillar,
    resolveDeferredHeroGeyser,
    resolveDeferredHeroHasteSelf,
    resolveDeferredHeroInsectSpell,
    resolveDeferredHeroLightningSpell,
    resolveDeferredHeroSummonMonsters,
    resumeDeferredHeroSpell,
    rollDeferredHeroSpellDamage,
    prepareMonsterSpellResistance,
    MCF_INDIRECT,
    MONSTER_WIZARD_SPELLS,
    monsterCurseKind,
    monsterSpellUseless,
} from './mcastu.js';
import { resolveMonsterGaze } from './monster_gaze.js';
import { resolveMonsterMagicRay } from './monster_magic_ray.js';
import { resolveMonsterSelfExplosion } from './monster_self_explosion.js';
import {
    monstersForgetHeroResistance, monstersObserveHeroResistance,
    requirePerceivedHero, seenResistanceForDamage,
} from './monster_perception.js';
import { resolveDeferredHeroItemTheft } from './steal.js';
import { finishDeferredHeroSlime, resumeDeferredHeroSlime } from './slime.js';
import { finishHeroDeath } from './end.js';
import type { FinishHeroDeathOptions } from './end.js';
import { dist2 } from './hacklib.js';
import { bot } from './botl.js';
import { trapAt } from './trap.js';
import { selectAttack } from './attack_selection.js';
import { endVoluntaryMultiTurn, heroHasInvoluntaryDelay, setMulti } from './command_state.js';
import { attackMonsterWithMonster, monsterAttackStopsAggressor } from './mhitm.js';
import { revealConcealedHeroToAttacker } from './hero_hider_reveal.js';
import { disturbMealMimicry } from './meal_mimic.js';
import { summonMonsterAttackHelp } from './minion.js';
import { selectMonsterOffensiveItem } from './muse.js';
import { isPoolAt } from './terrain_properties.js';
import {
    observeObjectForNaming, objectCombatName, objectName, ownedObjectName,
    simpleObjectName,
} from './objnam.js';
import { objectDescription } from './object_description.js';
import { recorderIsLeapDay, recorderLocalHour } from './calendar.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { weaponHitBonus } from './weapon_accuracy.js';
import {
    monsterWeaponStrengthBonus, rollPhysicalWeaponDamageAgainstHero,
} from './weapon_damage.js';
import { isPermanentlyPoisonedObject } from './object_properties.js';
import { CORPSE, OBJECT_NAMES } from './object_data.js';
import { monsterSentenceSubject } from './monster_sound.js';
import {
    applyMonsterStoningAttack, startHeroPetrificationFromMonster, touchPetrifies,
} from './stoning.js';
import { magicNegation, specialAttackNegated } from './magic_negation.js';
import { setHeroGrip } from './hero_grip.js';
import {
    beginHeroEngulf, monsterCanEngulfHero, resolveHeroEngulf,
} from './hero_engulf.js';
import type { MonsterDeathOptions } from './monster_death.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import type { MonsterLiquidDeathContext } from './mon.js';
import { heroHasConflict } from './hero_conflict.js';
import { woundHeroLegs } from './hero_legs.js';
import { drainObjectEnchantment } from './object_state.js';
import { selectHeroDisenchantmentTarget } from './do_wear.js';
import {
    mhitmAdBlnd, mhitmAdCold, mhitmAdDrli, mhitmAdEnch, mhitmAdElec,
    mhitmAdFire, mhitmAdLegs, mhitmAdStun, nurseContactMode,
    poisonAttackAttribute, poisonHeroFromMonster,
    resolveMonsterContactEffect, resolveMonsterWeaponContact,
    resolvePhysicalHeroHug, tryKnockback,
} from './uhitm.js';
import { applyHeroFormPassive } from './hero_form_passive.js';
import { unplaceBallAndChain } from './ball.js';
import { heroHairName, heroHandName } from './body_parts.js';
import { currency } from './currency.js';
import { gainExperienceLevel, loseHeroExperience } from './exper.js';
import { loseHeroHp } from './hero_damage.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { detachHeroGold, heroGoldAmount, heroGoldObject } from './hero_gold.js';
import { heroIsUnaware } from './hero_sleep.js';
import { inventoryItemDescription } from './invent.js';
import {
    addObjectToMonsterInventory, linkObjectToMonsterInventory,
} from './monster_inventory.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { unlinkObject } from './object_location.js';
import { promptYesNo } from './query.js';
import { seductionCompatibility } from './seduction_compatibility.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { objectTypeKnown } from './shk.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { reportHeroEncumbrance } from './encumbrance.js';

// Local copies of the C mondata.h flags and permonst indices the attack
// sequence reads (mhitu.c:calc_mattacku_vars/hitmu/gulpmu use them too).
const M1_SWIM = 0x00000002;
const M1_CONCEAL = 0x00000080;
const M1_SEE_INVIS = 0x01000000;
const M2_ORC = 0x00000080;
const S_EEL = 57;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const PM_LEATHER_GOLEM = 253;
async function monsterAttackMessage(
    monster: Monster, attack: HeroContactAttack & HeroAttackSlot,
    previousAttack: (HeroAttack & HeroAttackSlot) | null = null,
    random: RandomBelow = rn2,
): Promise<string | null> {
    const game = requireInitializedGame();
    if (attack.specialMessage) return null;
    if (attack.effect === 'petrifying-corpse' || attack.effect === 'wrapping-natural') return null;
    if (attack.effect === 'physical-hug' || attack.effect === 'silent-physical-touch') return null;
    if (attack.effect === 'nurse-heal' || attack.effect === 'nurse-cooperate') return null;
    if (attack.effect === 'seduction-contact') return null;
    if (attack.effect === 'engulf' || attack.effect === 'engulf-tick'
        || attack.effect === 'engulf-refused') return null;
    if (attack.effect === 'item-theft' && !monsterIsAnimal(monster)) return null;
    if (attack.effect === 'failed-grab') {
        const subject = monsterName(monster, { capitalized: true });
        const verb = attack.damageType === AD_DGST ? 'gulp'
            : attack.damageType === AD_STCK ? 'adhere' : 'grab';
        return `${possessiveName(subject).slice(0, 99)} ${verb} attempt passes right through you!`;
    }
    if (!attack.hit) return monsterMissMessage(monster, attack, game, random);
    const subject = monsterName(monster, { capitalized: true });
    if (attack.effect === 'pestilence-contact')
        return `${subject} reaches out, and you feel fever and chills.`;
    if (attack.effect === 'famine-contact')
        return `${subject} reaches out, and your body shrivels.`;
    if (attack.effect === 'death-contact')
        return `${subject} reaches out with its deadly touch.`;
    if (monster?.mnum === 116) {
        if (attack.effect === 'electric-natural')
            return `${subject} bites!`;
        return attack.effect === 'electric-avoided'
            ? `${subject} bites!  You avoid harm.`
            : `${subject} bites!  You get zapped!`;
    }
    const verb = attack.attackType === 16 ? 'tentacles suck your brain'
        : attack.attackType === 2 ? 'bites'
        : attack.attackType === 3 ? 'kicks'
            : attack.attackType === 4 ? 'butts'
                : attack.attackType === 5 ? 'touches you'
                    : attack.attackType === 6 ? 'stings' : 'hits';
    // C hitmsg() requires adjacent slots in the species' attack array.
    // getmattk() replacements use a separate buffer and cannot be adjacent.
    // Artifact prose skips hitmsg(), so it does not update that prior slot,
    // and neither does a corpse hit that starts the hero's petrification.
    const again = previousAttack?.hit
        && previousAttack.kind === 'hero-attack'
        && !previousAttack.specialMessage
        && previousAttack.effect !== 'physical-hug'
        && previousAttack.effect !== 'petrifying-corpse'
        && previousAttack.attackType === attack.attackType
        && previousAttack.attackIndex + 1 === attack.attackIndex
        && previousAttack.effectiveAttack === MONSTER_ATTACKS[monster.mnum]?.[previousAttack.attackIndex]
        && attack.effectiveAttack === MONSTER_ATTACKS[monster.mnum]?.[attack.attackIndex]
        ? ' again' : '';
    return `${attack.attackType === 16 ? possessiveName(subject) : subject} ${verb}${again}!`;
}
async function resolveErosionFormRehumanization(
    heroAttack: HeroContactAttack, effectMessage: string,
) {
    const game = requireInitializedGame();
    let pagerOwned = false;
    const effectDismissal = await plineWithContinuation(effectMessage);
    if (effectDismissal !== null && effectDismissal !== undefined)
        pagerOwned = true;

    const restored = await returnHeroToHumanForm(game, {
        publish: async (message: string) => {
            const dismissal = await plineWithContinuation(message);
            if (dismissal !== null && dismissal !== undefined) pagerOwned = true;
        },
    });
    heroAttack.heroDied = restored.died;

    heroAttack.deferredPostHit = !restored.died;
    return pagerOwned;
}
export async function presentMonsterAttackEffects(
    action: MonsterMovementAction,
    game: PlayingGameState,
    { random = rn2, rollDice = d, rollOne = rnd }: { random?: RandomBelow; rollDice?: RollDice; rollOne?: RollOne } = {},
): Promise<{ heroDied: boolean }> {
    const monster = action.monster;
    let movement = action.movement;
    // A special mover can attack before postmov(), then dochug() can
    // admit a fresh attack. Movement and its feedback must not replay.
    do {
        await completeMonsterOffensiveAction(action, game, random, rollDice, rollOne);
        if (movement.heroDied || game.program_state.gameover)
            return { heroDied: true };
        if (movement?.heroAttackSequence?.current) {
            let heroDied = false;
            let heroAttack: HeroAttackSequence['current'] = movement.heroAttackSequence.current;
                let previousHeroAttack: (HeroAttack & HeroAttackSlot) | null = null;
                const paging = movement.heroAttackSequence.paging;
                while (heroAttack) {
                    const publishSlotMessage: typeof plineWithContinuation = async (message, options) => {
                        const dismissal = await plineWithContinuation(message, options);
                        if (dismissal != null) paging.pagerOwned = true;
                        return dismissal;
                    };
                    if (heroAttack.kind === 'hero-magic-ray') {
                        const result = await resolveMonsterMagicRay(monster, heroAttack.effectiveAttack, {
                            state: game, publish: publishSlotMessage, calls: action.calls,
                            die: (options: FinishHeroDeathOptions) => options.damage
                                ? finishMonsterAttackDeath(monster, {
                                    attribution: {
                                        kind: 'death-inflicted-by', killer: options.killer,
                                        deathCause: options.deathCause
                                            || `killed by ${withIndefiniteArticle(options.killer)}`,
                                        announcesDeath: true,
                                    },
                                    pagerOwned: paging.pagerOwned,
                                }) : finishHeroDeath(options),
                        });
                        heroAttack.nativeResult = result.mask;
                        if (result.heroDied) return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-explosion') {
                        const result = await resolveMonsterSelfExplosion(monster, heroAttack.effectiveAttack, {
                            foundHero: heroAttack.foundHero, state: game, publish: publishSlotMessage,
                            die: (options: FinishHeroDeathOptions) => options.damage ? finishMonsterAttackDeath(monster, {
                                deathType: options.deathType ?? null,
                                attribution: {
                                    kind: 'death-inflicted-by', killer: options.killer,
                                    ...(options.deathCause ? { deathCause: options.deathCause } : {}),
                                    killerFormat: options.killerFormat ?? KILLED_BY_AN,
                                    announcesDeath: !options.deathLineShown,
                                },
                                pagerOwned: paging.pagerOwned,
                            }) : finishHeroDeath(options),
                        });
                        heroAttack.nativeResult = result.mask;
                        if (result.heroDied) return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-gaze') {
                        const result = await resolveMonsterGaze(monster, heroAttack.effectiveAttack, {
                            state: game, publish: publishSlotMessage, calls: action.calls,
                            die: (actor: Monster, options: MonsterAttackDeathOptions = {}) => finishMonsterAttackDeath(actor, {
                                ...options, pagerOwned: paging.pagerOwned,
                            }),
                        });
                        heroAttack.nativeResult = result.mask;
                        if (result.heroDied) return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-projectile' || heroAttack.kind === 'hero-spit') {
                        const heroDied = heroAttack.kind === 'hero-projectile'
                            ? heroAttack.projectile.heroDied : heroAttack.spit.heroDied;
                        if (heroDied) return { heroDied: true };
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-breath') {
                        const breath = heroAttack.breath;
                        if (breath.cough && !heroIsDeaf(game)) {
                            if (canSeeMonster(monster))
                                await publishSlotMessage(`${monsterName(monster, { capitalized: true })} coughs.`);
                            else await publishHeardMessage('a cough.', publishSlotMessage);
                        }
                        if (breath.launched) {
                            // C mthrowu.c:breamm() ends with dobuzz() and
                            // nomul(0), both inside the resolver; the breath
                            // neither stops the hero's occupation nor spends
                            // the hero's next movement ration.
                            await resolveDeferredMonsterBreath(action, breath, game, publishSlotMessage);
                            if (game.program_state?.gameover) return { heroDied: true };
                        }
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                    if (heroAttack.kind === 'hero-spell') {
                        const publishSpellMessage: typeof plineWithContinuation = async (message, options) => {
                            const dismissal = await plineWithContinuation(message, options);
                            if (dismissal != null) paging.pagerOwned = true;
                            return dismissal;
                        };
                        if (!heroAttack.cast) {
                            let curseMessage = null;
                            if (heroAttack.misdirected) {
                                const water = game.level.at(monster.mux ?? 0, monster.muy ?? 0)?.typ === WATER;
                                const caster = canSeeMonster(monster) ? visibleMonsterSubject(monster) : 'Something';
                                curseMessage = `${caster} casts a spell at ${water ? 'empty water' : 'thin air'}!`;
                            } else if (heroAttack.fumbled && !heroIsDeaf(game)
                                && canSeeMonster(monster)) {
                                curseMessage = `The air crackles around ${monsterName(monster)}.`;
                            } else if (heroAttack.curseKind === 'audible') {
                                curseMessage = 'You hear a mumbled curse.';
                            } else if (heroAttack.curseKind) {
                                const caster = visibleMonsterSubject(monster);
                                curseMessage = heroAttack.curseKind
                                    === 'visible-undirected'
                                    ? `${caster} points all around, then curses.`
                                    : heroAttack.curseKind === 'visible-general'
                                        ? `${caster} points and curses in your general direction.`
                                        : heroAttack.curseKind === 'visible-displaced'
                                            ? `${caster} points and curses at your displaced image.`
                                            : `${caster} points at you, then curses.`;
                            }
                            if (curseMessage)
                                await publishSpellMessage(curseMessage, { noRepeat: heroAttack.curseKind === 'audible' });
                            previousHeroAttack = heroAttack;
                            heroAttack = await completeHeroAttackSlot(
                                action, game,
                            );
                            continue;
                        }
                        const caster = canSpotMonster(monster) ? visibleMonsterSubject(monster) : 'Something';
                        const casterVisible = canSpotMonster(monster);
                        if (casterVisible || heroAttack.directed) {
                            const misplaced = monster.mux !== game.u.ux || monster.muy !== game.u.uy;
                            const target = !heroAttack.directed ? ''
                                : heroIsInvisible(game) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x01000000) && misplaced
                                    ? ' at a spot near you'
                                    : heroIsDisplaced(game) && misplaced ? ' at your displaced image' : ' at you';
                            await publishSpellMessage(
                                `${caster} casts a spell${target}!`,
                            );
                        }
                        if (heroAttack.deferredSpellDamage)
                            rollDeferredHeroSpellDamage(action, game, rollDice);
                        await prepareMonsterSpellResistance(heroAttack, game);
                        let effectMessage = heroAttack.spellEffectMessage;
                        if (heroAttack.spell === 'cure-self'
                            && canSeeMonster(monster)) {
                            effectMessage = `${
                                visibleMonsterSubject(monster)
                            } looks better.`;
                        }
                        if (heroAttack.spell === 'death-touch') {
                            const pronoun = monsterSubjectPronoun(monster, { state: game });
                            effectMessage = 'Oh no, ' + pronoun
                                + "'s using the touch of death!";
                        }
                        if (heroAttack.spell === 'disappear'
                            && canSeeMonster(monster)) {
                            const seesInvisible = !!(game.u?.seeInvisible
                                || (game.u.seeInvisibleTurns !== undefined && game.u.seeInvisibleTurns > 0));
                            effectMessage = `${
                                visibleMonsterSubject(monster)
                            } suddenly ${
                                seesInvisible
                                    ? 'becomes transparent' : 'disappears'
                            }!`;
                        }
                        // mcast_confuse_you() commits make_confused() before
                        // its explicit feedback pline.  If that line forces
                        // the older cast line through tty, the pager already
                        // paints Conf; other selected spell effects retain
                        // their post-message state ordering.
                        if (heroAttack.spell === 'confuse-you')
                            resumeDeferredHeroSpell(action, game);
                        const effectDismissal = effectMessage
                            ? await publishSpellMessage(effectMessage)
                            : null;
                        if (heroAttack.spell === 'confuse-you' && !game.u.antimagic)
                            monstersForgetHeroResistance(M_SEEN_MAGR, game);
                        if (heroAttack.deferredSpellEffect) {
                            if (heroAttack.spell === 'blind-you') {
                                heroAttack.deferredSpellEffect = false;
                                heroAttack.appliedDamage = 0;
                                await makeBlinded(heroHasHalfSpellDamage(game) ? 100 : 200,
                                    { state: game, talk: false, publish: publishSpellMessage });
                                if (!heroIsBlind(game)) await publishSpellMessage('Your vision clears.');
                            } else if (heroAttack.spell)
                                resumeDeferredHeroSpell(action, game);
                            else await resolveDeferredHeroDirectSpell(
                                action, heroAttack, game, publishSpellMessage, random, rollDice,
                            );
                        }
                        if (heroAttack.deferredStrengthLoss) {
                            const { amount, killer } = heroAttack.deferredStrengthLoss;
                            delete heroAttack.deferredStrengthLoss;
                            const died = await loseHeroStrength(amount, killer, {
                                state: game,
                                publish: publishSpellMessage,
                                deathCause: `killed by ${killer}`,
                                random: range => {
                                    action.calls.push(`rn2(${range})`);
                                    return rn2(range);
                                },
                                die: (options: FinishHeroDeathOptions) => options.killer !== killer
                                    ? finishHeroDeathAfterMonsterMessage(options)
                                    : finishMonsterAttackDeath(monster, {
                                        attribution: {
                                            kind: 'death-inflicted-by', killer,
                                            announcesDeath: true,
                                        },
                                        pagerOwned: paging.pagerOwned,
                                    }),
                            });
                            if (died) {
                                heroDied = true;
                                break;
                            }
                            monstersForgetHeroResistance(M_SEEN_MAGR, game);
                        }
                        if (heroAttack.deferredFirePillar)
                            await resolveDeferredHeroFirePillar(
                                action, heroAttack, publishSpellMessage,
                            );
                        if (game.program_state.gameover) return { heroDied: true };
                        if (heroAttack.deferredLightningSpell)
                            await resolveDeferredHeroLightningSpell(
                                action, heroAttack, publishSpellMessage,
                            );
                        if (game.program_state.gameover) return { heroDied: true };
                        if (heroAttack.deferredInsectSpell)
                            await resolveDeferredHeroInsectSpell(
                                action, heroAttack,
                            );
                        if (heroAttack.deferredCurseItems)
                            await resolveDeferredHeroCurseItems(heroAttack);
                        if (heroAttack.deferredSummonMonsters) {
                            const summoned
                                = await resolveDeferredHeroSummonMonsters(
                                    action, game,
                                );
                            if (summoned?.message)
                                await publishSpellMessage(summoned.message);
                        }
                        if (heroAttack.deferredCloneWizard) {
                            await publishSpellMessage('Double Trouble...');
                            await beginDeferredHeroCloneWizard(action, game);
                            await finishDeferredHeroCloneWizard(action, game);
                        }
                        if (heroAttack.deferredHasteSelf) {
                            const haste = resolveDeferredHeroHasteSelf(
                                action, game,
                            );
                            if (haste?.message)
                                await publishSpellMessage(haste.message);
                        }
                        if (heroAttack.deferredAggravation)
                            resolveDeferredHeroAggravation(action, game);
                        if (heroAttack.deferredDeathTouch) {
                            await resolveDeferredHeroDeathTouch(
                                action, heroAttack, publishSpellMessage,
                            );
                            if (heroAttack.heroDied) return { heroDied: true };
                        }
                        if (heroAttack.deferredDestroyArmor)
                            await resolveDeferredHeroDestroyArmor(
                                heroAttack,
                            );
                        if (heroAttack.deferredGeyserSpell)
                            resolveDeferredHeroGeyser(action, heroAttack);
                        if (heroAttack.paralyzed) stopRun(game);
                        if (heroAttack.monsterDisappeared) {
                            await newsym(monster.mx, monster.my);
                            if (cansee(monster.mx, monster.my)
                                && !canSpotMonster(monster)) {
                                await map_invisible(monster.mx, monster.my);
                            }
                        }
                        if (heroAttack.rehumanize) {
                            // tty urgent_pline() replaces the effect line
                            // which forced a pager when that pager was
                            // escaped, but the spell's state effect proceeds.
                            if (effectDismissal === 27) {
                                game._pending_message = '';
                                game._retained_message = '';
                            }
                            const restored = await returnHeroToHumanForm(game);
                            if (restored.died) return { heroDied: true };
                            heroAttack.rehumanize = false;
                        }
                        if (heroAttack.heroDied) {
                            if (await finishMonsterAttackDeath(monster, {
                                ...(heroAttack.fatalAttribution ? { attribution: heroAttack.fatalAttribution } : {}),
                                pagerOwned: paging.pagerOwned,
                            })) {
                                heroDied = true;
                                break;
                            }
                            heroAttack.heroDied = false;
                        }
                        delete heroAttack.fatalAttribution;
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                        continue;
                    }
                if (heroAttack.deferredRevealUnder) {
                    const revealDismissal = await plineWithContinuation(
                        heroAttack.revealUnderMessage ?? '',
                    );
                    await newsym(monster.mx, monster.my);
                    if (revealDismissal !== null
                        && revealDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                    heroAttack = await resumeDeferredHeroReveal(action, game);
                    if (!heroAttack) break;
                }
                // Hero-command and actor-prose history do not themselves
                // decide whether tty has repainted status.  The fatal path
                // below follows C bot()'s raw-HP sentinel and concrete pager
                // boundaries instead.
                // C hitmu()/missmu() records an unseen attacker's square
                // before projecting its contact line.  Persist that marker
                // in hero memory so a pager or later blind docrt() cannot
                // erase the source of the attack.  A hidden attacker was
                // already mapped before its reveal redrew the square.
                if (!heroAttack.deferredEngulf
                    && !heroAttack.attackerMapped
                    && heroAttack.effect !== 'wild-miss'
                    && heroAttack.effect !== 'engulf-unfound'
                    && heroAttack.effect !== 'engulf-refused'
                    && heroAttack.effect !== 'failed-grab'
                    && !canSpotMonster(monster))
                    await map_invisible(monster.mx, monster.my);
                const publishEquipmentMessage: typeof plineWithContinuation = async (line, options) => {
                    const dismissal = await plineWithContinuation(line, options);
                    if (dismissal != null) paging.pagerOwned = true;
                    return dismissal;
                };
                if (heroAttack.hit && heroAttack.effect === 'physical-weapon'
                    && heroAttack.deferredPostHit) {
                    const artifact = await applyArtifactHit(monsterWieldedWeapon(monster), 'hero',
                        heroAttack.damage ?? 0, {
                            state: game, attacker: monster, dieRoll: heroAttack.roll ?? 0,
                            publish: publishEquipmentMessage, random, rollOne,
                        });
                    if (artifact.heroDied) return { heroDied: true };
                    heroAttack.damage = artifact.damage;
                    heroAttack.specialMessage = artifact.specialMessage;
                    if (!artifact.damage) heroAttack.poison = null;
                }
                // mhitm_ad_fire/cold/elec/drli/blnd/ench/stun/legs project
                // hitmsg() themselves from uhitm.ts, so one of those slots
                // composes its hit line there instead of here.
                const message = heroAttack.effect === 'fire-natural'
                    || heroAttack.effect === 'cold-natural'
                    || heroAttack.effect === 'electric-natural'
                    || heroAttack.effect === 'life-drain-natural'
                    || heroAttack.effect === 'blind-natural'
                    || heroAttack.effect === 'enchantment-natural'
                    || heroAttack.effect === 'stun-natural'
                    || heroAttack.effect === 'leg-natural'
                    ? null
                    : await monsterAttackMessage(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                const contactDismissal = message
                    ? await plineWithContinuation(message) : undefined;
                if (contactDismissal !== null
                    && contactDismissal !== undefined) {
                    paging.pagerOwned = true;
                }
                if (heroAttack.hit && heroAttack.effect === 'physical-weapon' && heroAttack.damage) {
                    const weapon = monsterWieldedWeapon(monster);
                    if (weapon) heroAttack.damage = await resolveMonsterWeaponContact(monster, weapon,
                        heroAttack.damage ?? 0, game, publishEquipmentMessage, rollOne);
                    await erodeAttackingWeapon(game.u, weapon, {
                        publish: publishEquipmentMessage,
                    });
                }
                if (heroAttack.deferredSpecialContact)
                    await resolveMonsterContactEffect(monster, heroAttack, {
                        state: game, publish: publishEquipmentMessage, random, rollOne, rollDice,
                    });
                if (game.program_state.gameover)
                    return { heroDied: true };
                if (heroAttack.deferredStickingAfterHit)
                    resumeDeferredHeroSticking(action, game);
                if (heroAttack.stickingMessage) {
                    const stickingDismissal = await plineWithContinuation(
                        heroAttack.stickingMessage,
                    );
                    heroAttack.stickingMessage = null;
                    if (stickingDismissal !== null
                        && stickingDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredItemTheft) {
                    const theftPager = await resolveDeferredHeroItemTheft(
                        action, monster, heroAttack, random,
                    );
                    if (game.program_state.gameover) return { heroDied: true };
                    paging.pagerOwned ||= theftPager;
                    // hitmu() reaches knockback after every steal() result,
                    // including refusal and armor removal still in progress.
                    await tryKnockback(monster, game.u, heroAttack, {
                        state: game, random, hit: heroAttack.hit,
                        weaponUsed: !!monsterWieldedWeapon(monster),
                        publish: publishEquipmentMessage,
                    });
                }
                if (heroAttack.deferredEngulf) {
                    const engulf = await resumeDeferredHeroEngulf(action, game, {
                        publish: publishEquipmentMessage,
                        die: (attacker: Monster, options: MonsterAttackDeathOptions = {}) => finishMonsterAttackDeath(attacker, {
                            ...options,
                            pagerOwned: paging.pagerOwned,
                        }),
                        flushMessages: async () => {
                            const dismissal = await displayMessageWindow();
                            if (dismissal != null) paging.pagerOwned = true;
                        },
                    });
                    if (engulf?.died || game.program_state.gameover) return { heroDied: true };
                }
                if (heroAttack.deferredSlimeEffect)
                    resumeDeferredHeroSlime(action, game);
                if (heroAttack.slimeEffectMessage) {
                    const slimeDismissal = await plineWithContinuation(
                        heroAttack.slimeEffectMessage,
                    );
                    heroAttack.slimeEffectMessage = null;
                    if (slimeDismissal !== null
                        && slimeDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.slimeStartPending)
                    finishDeferredHeroSlime(action, game);
                if (heroAttack.effect === 'cold-natural') {
                    // C uhitm.c:mhitm_ad_cold() mhitu branch: hitmsg(),
                    // magic cancellation, the frost lines and the gated
                    // inventory destruction run here with direct awaits.
                    const hitMessage = await monsterAttackMessage(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const cold = await mhitmAdCold({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            random, rollOne, calls: action.calls,
                        },
                    });
                    heroAttack.damage = cold.damage;
                    if (cold.heroDied) return { heroDied: true };
                    if (cold.heroAtZeroHitPoints) {
                        heroAttack.heroDied = true;
                        heroAttack.deferredPostHit = false;
                    }
                }
                if (heroAttack.effect === 'fire-natural') {
                    // C uhitm.c:mhitm_ad_fire() mhitu branch: hitmsg(),
                    // magic cancellation, the fire lines, witness updates,
                    // inventory destruction, ignition and the slime cure all
                    // run here with direct awaits.
                    const hitMessage = await monsterAttackMessage(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const fire = await mhitmAdFire({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            attackType: heroAttack.attackType,
                            publish: publishSlotMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            random, rollOne, calls: action.calls,
                        },
                    });
                    heroAttack.damage = fire.damage;
                    if (fire.heroDied) return { heroDied: true };
                    if (fire.heroAtZeroHitPoints) {
                        heroAttack.heroDied = true;
                        heroAttack.deferredPostHit = false;
                    }
                }
                if (heroAttack.effect === 'electric-natural') {
                    // C uhitm.c:mhitm_ad_elec() mhitu branch: hitmsg(),
                    // magic cancellation, the zap lines and the gated
                    // inventory destruction run here with direct awaits.
                    const hitMessage = await monsterAttackMessage(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const electric = await mhitmAdElec({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            random, rollOne, calls: action.calls,
                        },
                    });
                    heroAttack.damage = electric.damage;
                    if (electric.heroDied) return { heroDied: true };
                    if (electric.heroAtZeroHitPoints) {
                        heroAttack.heroDied = true;
                        heroAttack.deferredPostHit = false;
                    }
                }
                if (heroAttack.effect === 'life-drain-natural') {
                    // C uhitm.c:mhitm_ad_drli() mhitu branch: hitmsg(), the
                    // selection gate, magic cancellation and losexp() run
                    // here with direct awaits.
                    const hitMessage = await monsterAttackMessage(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const drain = await mhitmAdDrli({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            die: finishHeroDeathAfterMonsterMessage,
                            random, calls: action.calls,
                        },
                    });
                    heroAttack.damage = drain.damage;
                    if (drain.heroDied) return { heroDied: true };
                }
                if (heroAttack.effect === 'blind-natural') {
                    // C uhitm.c:mhitm_ad_blnd() mhitu branch: the blinding
                    // line, make_blinded() and hitmu()'s knockback draws run
                    // here with direct awaits.
                    const blnd = await mhitmAdBlnd({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            attackType: heroAttack.attackType,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            random, calls: action.calls,
                        },
                    });
                    heroAttack.damage = blnd.damage;
                }
                if (heroAttack.effect === 'enchantment-natural') {
                    // C uhitm.c:mhitm_ad_ench() mhitu branch: the negation
                    // probe precedes hitmsg(); the armor selection, drain and
                    // "less effective" line follow it with direct awaits.
                    const hitMessage = await monsterAttackMessage(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const ench = await mhitmAdEnch({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            random, calls: action.calls,
                        },
                    });
                    heroAttack.damage = ench.damage;
                }
                if (heroAttack.effect === 'stun-natural') {
                    // C uhitm.c:mhitm_ad_stun() mhitu branch: hitmsg(), the
                    // one-in-four gate and make_stunned() run here with
                    // direct awaits.
                    const hitMessage = await monsterAttackMessage(
                        monster, heroAttack, previousHeroAttack, random,
                    );
                    const stun = await mhitmAdStun({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            hitMessage,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            random, calls: action.calls,
                        },
                    });
                    heroAttack.damage = stun.damage;
                }
                if (heroAttack.effect === 'leg-natural') {
                    // C uhitm.c:mhitm_ad_legs() mhitu branch: the side and
                    // boot rolls, the contact line, set_wounded_legs() and
                    // both exercise() calls run here with direct awaits.
                    const legs = await mhitmAdLegs({
                        mdef: 'youmonst',
                        context: {
                            state: game,
                            attacker: monster,
                            damage: heroAttack.damage ?? 0,
                            publish: publishSlotMessage,
                            random, rollOne, calls: action.calls,
                        },
                    });
                    heroAttack.damage = legs.damage;
                }
                if (heroAttack.deferredRustRehumanize) {
                    const rustFormPagerOwned
                        = await resolveErosionFormRehumanization(
                            heroAttack, 'You rust!',
                        );
                    paging.pagerOwned ||= rustFormPagerOwned;
                    heroAttack.deferredRustRehumanize = false;
                }
                if (heroAttack.deferredDecayRehumanize) {
                    const decayPagerOwned = await resolveErosionFormRehumanization(
                        heroAttack, 'You rot!',
                    );
                    paging.pagerOwned ||= decayPagerOwned;
                    heroAttack.deferredDecayRehumanize = false;
                }
                const armorErosion = heroAttack.deferredRustArmor ? 'rust'
                    : heroAttack.deferredCorrosionArmor ? 'corrosion'
                        : heroAttack.deferredDecayArmor ? 'rot' : null;
                if (armorErosion) {
                    await erodeArmor(game.u, armorErosion, { publish: publishEquipmentMessage });
                    heroAttack.deferredRustArmor = false;
                    heroAttack.deferredCorrosionArmor = false;
                    heroAttack.deferredDecayArmor = false;
                    heroAttack.deferredPostHit = true;
                }
                if (heroAttack.deferredPostHit) {
                    const publishContactMessage: typeof plineWithContinuation = async (message, options) => {
                        const dismissal = await plineWithContinuation(message, options);
                        if (dismissal !== null && dismissal !== undefined)
                            paging.pagerOwned = true;
                        return dismissal;
                    };
                    const contactOptions = {
                        random, rollDice, rollOne,
                        publish: publishContactMessage,
                        die: finishHeroDeathAfterMonsterMessage,
                    };
                    await resumeDeferredHeroContact(
                        action, game, contactOptions,
                    );
                    if (game.program_state?.gameover) return { heroDied: true };
                }
                if (heroAttack.effectMessage) {
                    const effectDismissal = await plineWithContinuation(
                        heroAttack.effectMessage,
                    );
                    if (effectDismissal !== null
                        && effectDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                // C hitmu()/missmu() calls stop_occupation() after the whole
                // contact transaction, including passiveum().  In
                // particular, an overflowing cold-passive line must suspend
                // before its rn2(2), assess_dmg(), death line, and the
                // occupation-stop prose.  Keep this before later attack
                // slots, but after every deferred tail owned by this slot.
                // mdamageu() reaches done_in_by() first, so a hero killed by
                // the hit never stops the occupation unless life-saved.
                const engulfAttack = heroAttack.effect === 'engulf'
                    || heroAttack.effect === 'engulf-tick'
                    || heroAttack.effect === 'engulf-refused';
                const missedContact = heroAttack.effect === 'failed-grab'
                    || heroAttack.effect === 'engulf-unfound'
                    || heroAttack.effect === 'wild-miss';
                const stopsOccupation = !engulfAttack && !missedContact && !heroAttack.contactDone;
                if ((game.u?.[Upolyd(game.u) ? 'mh' : 'uhp'] ?? 1) > 0) {
                    if (stopsOccupation) await stopHeroOccupation(game);
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (await finishMonsterAttackDeath(monster, {
                    pagerOwned: paging.pagerOwned,
                })) {
                    heroDied = true;
                    break;
                }
                if (stopsOccupation) await stopHeroOccupation(game);
                heroAttack.heroDied = false;
                previousHeroAttack = heroAttack;
                heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
            }
            if (heroDied) return { heroDied: true };
        }
        if (!movement?.deferredAfterSpecialAttack || game.program_state?.gameover)
            break;
        await resumeDeferredSpecialAttack(action, game, random, rollDice, rollOne);
        movement = action.movement;
        if (await presentMonsterPostMove(action, game))
            return { heroDied: true };
        await presentMonsterPickups(action, game);
        movement = action.movement;
    } while (!game.program_state?.gameover);
    if (game.program_state?.gameover) return { heroDied: true };
    if (movement.deferredWormTailAttacks) {
        delete movement.deferredWormTailAttacks;
        const offensive = movement.heroAttackSequence?.offensive;
        if (movement.heroAttackResult !== 1
            && !(offensive?.status === 'completed' && offensive.result.nativeResult === 1)
            && !monster.dead && monster.mhp > 0 && monster.wormno) {
            const result = await performWormTailAttacks(monster, game, {
                random, rollDice, rollOne, calls: action.calls,
            });
            movement.heroAttackResult = result.nativeResult;
            return { heroDied: result.heroDied };
        }
    }
    return { heroDied: false };
}
// A direct mattacku call has no movement ration, dochug prelude, or postmov
// tail. Pets targeting the hero and forced abilities share this complete path.
export async function performMonsterHeroAttack(
    monster: Monster, state: PlayingGameState, {
        random = rn2, rollDice = d, rollOne = rnd, calls = [],
    }: { random?: RandomBelow; rollDice?: RollDice; rollOne?: RollOne; calls?: MonsterCallLog } = {},
): Promise<{ nativeResult: 0 | 1; heroDied: boolean }> {
    requireLiveGame(state);
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    let action: MonsterMovementAction;
    try {
        action = {
            monster, calls, movement: {
                oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my, moved: false,
                ...await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls),
            },
        };
    } finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
    const effects = await presentMonsterAttackEffects(action, state, { random, rollDice, rollOne });
    const offensive = action.movement.heroAttackSequence?.offensive;
    const returnedDeath = action.movement.heroAttackResult === 1
        || (offensive?.status === 'completed' && offensive.result.nativeResult === 1);
    return {
        nativeResult: returnedDeath || monster.dead || monster.mhp <= 0 ? 1 : 0,
        heroDied: effects.heroDied || !!state.program_state.gameover,
    };
}
// C worm.c:wormhitu(). Visible segments are stored head-outward; native
// wtails walks toward the head and excludes its hidden dummy segment.
async function performWormTailAttacks(
    worm: Monster, state: PlayingGameState,
    options: { random: RandomBelow; rollDice: RollDice; rollOne: RollOne; calls: MonsterCallLog },
): Promise<{ nativeResult: 0 | 1; heroDied: boolean }> {
    const segments = worm.wormSegments;
    if (!segments) throw new Error(`Worm ${worm.m_id} has no tail list.`);
    for (let index = segments.length - 1; index >= 0; index--) {
        const segment = segments[index];
        if (!segment) throw new Error(`Worm ${worm.m_id} has no tail segment ${index}.`);
        if (dist2(segment.x, segment.y, state.u.ux, state.u.uy) >= 3) continue;
        // Keep the real head position: mattacku() still uses its range and
        // apparent hero position, including after knockback or a passive.
        const result = await performMonsterHeroAttack(worm, state, options);
        if (result.nativeResult === 1 || result.heroDied) return result;
    }
    return { nativeResult: 0, heroDied: false };
}


// C hack.h:AC_VALUE().  Hero AC below zero is deliberately randomized each
// time an attack transaction evaluates it; callers must retain the returned
// threshold across later slots of that same mattacku() invocation.
function sourceHeroArmorClass(state: PlayingGameState, rollOne: RollOne, calls: MonsterCallLog) {
    const armorClass = state?.u?.uac ?? 10;
    if (armorClass >= 0) return armorClass;
    const effective = -rollOne(-armorClass);
    calls.push(`rnd(${-armorClass})`);
    return effective;
}

function monsterAttackThreshold(
    monster: Monster,
    state: PlayingGameState,
    rollOne: RollOne,
    calls: MonsterCallLog,
) {
    let threshold =
        sourceHeroArmorClass(state, rollOne, calls) +
        10 +
        (monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0);
    if (heroHasInvoluntaryDelay(state)) threshold += 4;
    const perceivesInvisible = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
    if ((heroIsInvisible(state) && !perceivesInvisible) || !monster.mcansee) threshold -= 2;
    if (monster.mtrapped) threshold -= 2;
    return Math.max(1, threshold);
}

// C mhitu.c:hitmu().  Negative AC has a second, independent role after a
// hit: once attack effects and knockback finish, it reduces positive damage
// by rnd(-uac), with a floor of one.  This is not the AC_VALUE to-hit draw.
function reduceHeroContactDamage(
    monster: Monster,
    damage: number,
    state: PlayingGameState,
    rollOne: RollOne,
    calls: MonsterCallLog,
) {
    const armorClass = state?.u?.uac ?? 10;
    let appliedDamage = damage;
    if (appliedDamage > 0 && armorClass < 0) {
        const reduction = rollOne(-armorClass);
        calls.push(`rnd(${-armorClass})`);
        appliedDamage = Math.max(1, appliedDamage - reduction);
    }
    // mhitu.c:hitmu() applies Half_physical_damage only after negative-AC
    // reduction and rounds odd positive damage upward.
    const mitreProtects = state.urole.key === 'priest'
        && artifactById(state.uarmh?.oartifact, state)?.questArtifact
        && monsterHatesBlessings(monster);
    if (appliedDamage > 0 && (state.u.halfPhysicalDamage || mitreProtects)) {
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);
    }
    return appliedDamage;
}

// mhitu.c mdamageu(): subtract from the active body and clamp only down to
// its maximum. Lethal HP stays negative until done() commits zero, after
// done_in_by() has announced the death.
async function applyHeroContactDamage(
    state: PlayingGameState, damage: number, publish: MessagePublisher = plineWithContinuation,
) {
    state.context.botl = true;
    // C mdamageu(): showdamage() prints the post-subtraction, pre-clamp HP.
    if (Upolyd(state.u)) {
        state.u.mh = (state.u.mh ?? 1) - damage;
        if (state.flags.showdamage && damage)
            await publish(`[HP ${-damage}, ${state.u.mh} left]`);
        state.u.mh = Math.min(state.u.mh, state.u.mhmax ?? 1);
    } else {
        state.u.uhp -= damage;
        if (state.flags.showdamage && damage)
            await publish(`[HP ${-damage}, ${state.u.uhp} left]`);
        state.u.uhp = Math.min(state.u.uhp, state.u.uhpmax);
    }
}

// Complete body loss before applying the old form's passive response.
async function finishHeroContactDamage(
    monster: Monster,
    damage: number,
    attackType: number,
    oldForm: number,
    state: PlayingGameState,
    { random = rn2, rollDice = d, publish = plineWithContinuation, die }: MonsterDamageOptions = {},
) {
    await applyHeroContactDamage(state, damage, publish);
    if (Upolyd(state.u) && state.u.mh < 1) {
        const restored = await returnHeroToHumanForm(state, { publish, ...(die ? { die } : {}) });
        if (restored.died) return { heroDied: true, attackerStopped: true };
    }
    if (damage <= 0) return { attackerStopped: false };
    return applyHeroFormPassive(monster, oldForm, attackType, { state, random, rollDice, publish });
}
export async function beginMonsterHeroAttack(
    monster: Monster,
    state: PlayingGameState,
    random: RandomBelow,
    rollOne: RollOne,
    rollDice: RollDice,
    calls: MonsterCallLog,
): Promise<MonsterAttackInitiation> {
    // calc_mattacku_vars() also resets targeting left by an earlier ray/throw.
    state.bhitpos = { x: state.u.ux, y: state.u.uy };
    state.notonhead = false;
    if (dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= 3)
        endVoluntaryMultiTurn(state);
    if (monster.dead || monster.mhp <= 0) return { heroAttackResult: 1 };
    if ((state.underwater || state.u.uinwater)
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SWIM)) return {};
    if (state.u.uswallow) {
        if (state.u.ustuck !== monster) return {};
        monster.mux = state.u.ux;
        monster.muy = state.u.uy;
        if (state.u.invulnerable) return {};
    }
    if (monster === state.u.usteed) return {};
    if (!state.u.uswallow && state.u.usteed) {
        const steed = state.u.usteed;
        const orc = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ORC);
        // mattacku() chooses the steed before testing adjacency. Orcs
        // choose it half the time; other monsters choose it one in four.
        if (recordRandom(random, calls, orc ? 2 : 4) === 0
            && dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= 2) {
            const attack = await attackMonsterWithMonster(monster, steed, {
                state, random, rollDice, rollOne, calls,
            });
            if (monsterAttackStopsAggressor(attack)) return { heroAttackResult: 1 };
            if (attack.heroDied || monster.dead || monster.mhp <= 0
                || steed.dead || steed.mhp <= 0 || !state.u.usteed
                || dist2(monster.mx, monster.my, state.u.ux, state.u.uy) > 2)
                return {};
            // A surviving steed retaliates immediately, including after a
            // miss, without spending a movement ration or a chance roll.
            const retaliation = await attackMonsterWithMonster(state.u.usteed, monster, {
                state, random, rollDice, rollOne, calls,
            });
            const attackerDied = retaliation.kind === 'monster-attack'
                && !!((retaliation.nativeResult ?? 0) & M_ATTK_DEF_DIED);
            return { heroAttackResult: attackerDied ? 1 : 0 };
        }
    }
    // C mattacku(): a concealed hero (hiding or mimicking) is revealed
    // instead of attacked, before the armor-class differential.
    if (await revealConcealedHeroToAttacker(monster, {
        state, random, rollOne, rollDice, calls,
    })) return {};
    if (await disturbMealMimicry(monster, { state })) return {};
    const threshold = monsterAttackThreshold(monster, state, rollOne, calls);
    // C mhitu.c:721-724 — make eels visible the moment they hit or miss us.
    if (MONSTER_SYMBOL[monster.mnum] === S_EEL && monster.minvis
        && cansee(monster.mx, monster.my)) {
        monster.minvis = 0;
        await newsym(monster.mx, monster.my);
    }
    const alreadyFleeing = !!monster.mflee;
    await summonMonsterAttackHelp(monster, state, random);
    if (monster.mflee && !alreadyFleeing) return {};
    if (state.u.invulnerable) {
        const apparentDistance = dist2(monster.mx, monster.my, monster.mux ?? 0, monster.muy ?? 0);
        const appearsAdjacent = apparentDistance < 3
            && !(apparentDistance === 2 && monster.mnum === PM_GRID_BUG);
        if (state.u.ustuck === monster) {
            await plineWithContinuation(`${canonicalMonsterName(monster, { state, capitalized: true })} loosens its grip slightly.`);
        } else if (appearsAdjacent) {
            await plineWithContinuation(canSpotMonster(monster)
                ? `${canonicalMonsterName(monster, { state, capitalized: true })} starts to attack you, but pulls back.`
                : formatFeltMessage('something move nearby.', state));
        }
        return {};
    }
    const offensive = selectMonsterOffensiveItem(monster, state, {
        random: limit => recordRandom(random, calls, limit),
    });
    const sequence: HeroAttackSequence = {
        monster,
        cachedMnum: monster.mnum,
        threshold,
        nextSlot: 0,
        current: null,
        results: [],
        lastAttackRoll: 0,
        firstFoundYou: monster.mux === state.u.ux && monster.muy === state.u.uy,
        paging: { pagerOwned: false },
        offensive: offensive ? { status: 'selected', choice: offensive } : null,
        skipNonMagic: false,
        skipBrainDrain: false,
        done: false,
    };
    if (!offensive)
        await advanceHeroAttackSequence(sequence, state, random, rollOne, rollDice, calls);
    return { heroAttackSequence: sequence };
}

export async function advanceHeroAttackSequence(
    sequence: HeroAttackSequence,
    state: PlayingGameState,
    random: RandomBelow,
    rollOne: RollOne,
    rollDice: RollDice,
    calls: MonsterCallLog,
) {
    const monster = sequence.monster;
    while (!sequence.done && sequence.nextSlot < 6) {
        if (state.program_state.gameover || monster.dead || monster.mhp <= 0 || monster.mx === 0)
            break;
        const attackIndex = sequence.nextSlot++;
        sequence.results[attackIndex] = M_ATTK_MISS;
        const foundHero = monster.mux === state.u.ux && monster.muy === state.u.uy;
        if (attackIndex > 0) {
            state.bhitpos = { x: state.u.ux, y: state.u.uy };
            state.notonhead = false;
            if (sequence.firstFoundYou && !foundHero) continue;
        }
        const effectiveAttack = selectAttack(monster, state.u, attackIndex, sequence.results, state);
        if (sequence.skipBrainDrain && effectiveAttack[0] === AT_TENT && effectiveAttack[1] === AD_DRIN)
            continue;
        const slot: HeroAttackSlot = {
            attackIndex,
            effectiveAttack,
            oldFormMnum: state.u.umonnum,
        };
        const attack = await beginHeroAttackSlot(
            sequence,
            slot,
            state,
            random,
            rollOne,
            rollDice,
            calls,
        );
        if (attack) {
            sequence.current = { ...slot, ...attack };
            return sequence.current;
        }
        sequence.current = null;
        // A slot that reaches the end of mattacku()'s switch without an
        // attack still commits pending status; its continue paths do not.
        if (!attackSlotContinues(sequence, effectiveAttack[0], state)
            && state === game && state.context.botl)
            await bot();
    }
    sequence.current = null;
    sequence.done = true;
    return null;
}

// C mattacku() loop entries that `continue` before reaching bot().
function attackSlotContinues(sequence: HeroAttackSequence, attackType: number, state: PlayingGameState) {
    const monster = sequence.monster;
    if (state.u.uswallow && attackType !== AT_ENGL) return true;
    if (sequence.skipNonMagic && attackType !== AT_MAGC) return true;
    if (attackType !== AT_KICK || !monster.mtrapped) return false;
    const trap = trapAt(state, monster.mx, monster.my);
    return trap?.ttyp === PIT || trap?.ttyp === SPIKED_PIT;
}

// Ranged effects finish before returning their slot. Their real message
// continuations update the same sequence context used by contact effects.
export function monsterAttackMessagePublisher(paging: MonsterAttackPaging): PublishMonsterMessage {
    return async (message, options) => {
        const dismissal = await plineWithContinuation(message, options);
        if (dismissal != null) paging.pagerOwned = true;
        return dismissal;
    };
}

async function beginHeroAttackSlot(
    sequence: HeroAttackSequence,
    slot: HeroAttackSlot,
    state: PlayingGameState,
    random: RandomBelow,
    rollOne: RollOne,
    rollDice: RollDice,
    calls: MonsterCallLog,
    retainedAttackRoll: { roll: number | null; hit: boolean } | null = null,
    deferVisibleContact = !!state?._deferVisibleMonsterContact,
): Promise<HeroAttack | null> {
    const monster = sequence.monster;
    requirePerceivedHero(monster);
    const { attackIndex, effectiveAttack, oldFormMnum } = slot;
    const [attackType, damageType, dice, sides] = effectiveAttack;
    const naturalContact = [AT_CLAW, AT_KICK, AT_BITE, AT_STNG, AT_TUCH, AT_BUTT, AT_TENT]
        .includes(attackType);
    const threshold = sequence.threshold;
    const alreadyEngulfing =
        attackType === AT_ENGL && state.u.uswallow && state.u.ustuck === monster;
    if (
        (state.u.uswallow && attackType !== AT_ENGL) ||
        (sequence.skipNonMagic && attackType !== AT_MAGC)
    )
        return null;
    const foundHero = monster.mux === state.u.ux && monster.muy === state.u.uy;
    const dx = monster.mx - monster.mux;
    const dy = monster.my - monster.muy;
    const distant =
        dx * dx + dy * dy >= 3 ||
        (MONSTER_NAME[monster.mnum] === 'grid bug' && dx !== 0 && dy !== 0);
    if (attackType === AT_BREA) {
        if (!distant) return null;
        const breath = maybeBreatheAtHero(monster, effectiveAttack, state, random, calls);
        return { kind: 'hero-breath', breath, nativeResult: breath.nativeResult };
    }
    if (attackType === AT_SPIT) {
        if (!distant) return null;
        const publish = monsterAttackMessagePublisher(sequence.paging);
        const spit = await resolveMonsterSpitAtHero(monster, effectiveAttack, {
            state, random: range => recordRandom(random, calls, range), rollOne, publish,
        });
        return { kind: 'hero-spit', spit, nativeResult: spit.nativeResult };
    }
    if (attackType === AT_WEAP && distant) {
        if (state.level.flags?.rogue_level) return null;
        const publish = monsterAttackMessagePublisher(sequence.paging);
        const projectile = await attackHeroWithRangedWeapon(monster, state, random, rollOne, calls, publish);
        return projectile
            ? { kind: 'hero-projectile', projectile, nativeResult: M_ATTK_MISS }
            : null;
    }
    if (attackType === AT_GAZE) {
        if (MONSTER_NAME[sequence.cachedMnum] === 'Medusa') return null;
        return {
            kind: 'hero-gaze',
            attackType,
            damageType,
            dice,
            sides,
            nativeResult: M_ATTK_MISS,
        };
    }
    if (attackType === AT_EXPL) {
        return distant
            ? null
            : {
                  kind: 'hero-explosion',
                  attackType,
                  damageType,
                  dice,
                  sides,
                  foundHero,
                  nativeResult: M_ATTK_MISS,
              };
    }
    if (attackType === AT_MAGC && distant) {
        if (damageType < AD_MAGM || damageType > AD_SPC2) return null;
        return {
            kind: 'hero-magic-ray',
            attackType,
            damageType,
            dice,
            sides,
            nativeResult: M_ATTK_MISS,
        };
    }
    // C mattacku() lets a monster that is holding the hero (u.ustuck) use
    // its hug attack even when it is not beside the hero's apparent spot.
    if (attackType !== AT_MAGC && distant
        && !(attackType === AT_HUGS && state.u.ustuck === monster)) return null;
    if (naturalContact) {
        if (attackType === AT_KICK && monster.mtrapped) {
            const trap = trapAt(state, monster.mx, monster.my);
            if (trap?.ttyp === PIT || trap?.ttyp === SPIKED_PIT) return null;
        }
        if (monsterWieldedWeapon(monster) && !monster.mconf && !heroHasConflict(state)
            && touchPetrifies(heroSpecies(state))) return null;
    }
    // Native AT_WEAP prepares a melee weapon even at the wrong location.
    // Wielding spends this slot; the next attack slot may still proceed.
    if (attackType === AT_WEAP) {
        const currentWeapon = monsterWieldedWeapon(monster);
        if (monster.weaponCheck === NEED_WEAPON || !currentWeapon) {
            monster.weaponCheck = NEED_HTH_WEAPON;
            if (await wieldMonsterWeapon(monster, state)) return null;
        }
    }
    if (attackType === AT_ENGL && !foundHero) {
        return {
            kind: 'hero-attack',
            attackType,
            damageType,
            hit: false,
            effect: 'engulf-unfound',
            nativeResult: M_ATTK_MISS,
        };
    }
    if (
        (naturalContact || attackType === AT_WEAP) &&
        !foundHero
    ) {
        sequence.skipNonMagic = true;
        return {
            kind: 'hero-attack',
            threshold,
            hit: false,
            roll: null,
            attackType,
            damageType,
            attackIndex,
            effect: 'wild-miss',
        };
    }
    if (
        attackType === AT_HUGS &&
        state.u.ustuck !== monster &&
        !(
            attackIndex >= 2 &&
            sequence.results[attackIndex - 1] &&
            sequence.results[attackIndex - 2]
        )
    )
        return null;
    if (
        ![
            AT_CLAW,
            AT_KICK,
            AT_BITE,
            AT_STNG,
            AT_TUCH,
            AT_BUTT,
            AT_TENT,
            AT_HUGS,
            AT_WEAP,
            AT_MAGC,
            AT_ENGL,
        ].includes(attackType)
    )
        return null;
    if (attackType === AT_MAGC) {
        // mhitu.c:mattacku() enters castmu() without a to-hit die.  Spell
        // choice and fumble precede the casting line.  Base spell damage is
        // rolled only after that line returns from tty; a long actor name can
        // therefore move d() to the acknowledgement input.
        const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
        const choosesSpell = damageType === AD_SPEL || damageType === AD_CLRC;
        let spell = choosesSpell
            ? monsterLevel ? chooseMonsterSpell(monster, damageType, state, random, calls)
                : MONSTER_WIZARD_SPELLS[0]
            : undefined;
        if (choosesSpell && !spell)
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                cast: false,
            };
        if (!monsterLevel) return {
            kind: 'hero-spell', threshold, attackType, damageType, attackIndex,
            cast: false, blocked: true,
            curseKind: monsterCurseKind(monster, !!(spell && (spell.flags & MCF_INDIRECT)), state, random, calls),
        };
        // C castmu() starts cnt at 40.  choose_monster_spell() already tests
        // usefulness while walking the spell table; the do/while condition
        // tests the returned spell once more, but there is no third probe
        // after the loop.  Stateful usefulness checks such as geyser's
        // rn2(5) make that exact call count observable.
        let attempts = 39;
        while (spell && (damageType === AD_SPEL || damageType === AD_CLRC)
            && attempts-- > 0 && monsterSpellUseless(monster, spell, state, random, calls)) {
            spell = chooseMonsterSpell(monster, damageType, state, random, calls);
        }
        if (attempts < 0) {
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
            };
        }
        if (
            monster.mcan ||
            monster.mspec_used ||
            ((monster.seen_resistance ?? 0) & seenResistanceForDamage(damageType))
        ) {
            const curseKind = monsterCurseKind(monster, !!(spell && (spell.flags & MCF_INDIRECT)), state, random, calls);
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
                blocked: true,
                curseKind,
            };
        }
        if (choosesSpell) monster.mspec_used = monsterLevel < 8 ? 10 - monsterLevel : 2;
        const directed = !(spell && (spell.flags & MCF_INDIRECT));
        if (!foundHero && directed) return {
            kind: 'hero-spell', threshold, attackType, damageType, attackIndex,
            ...(spell ? { spell: spell.key } : {}), cast: false, misdirected: true,
        };
        endVoluntaryMultiTurn(state);
        const fumble =
            recordRandom(random, calls, Math.max(1, monsterLevel * 10)) <
            (monster.mconf ? 100 : 20);
        if (fumble) {
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
                fumbled: true,
            };
        }
        const spellDice = sides
            ? Math.trunc(monsterLevel / 2) + dice
            : Math.trunc(monsterLevel / 2) + 1;
        const spellSides = sides || 6;
        return {
            kind: 'hero-spell',
            threshold,
            attackType,
            damageType,
            attackIndex,
            ...(spell ? { spell: spell.key } : {}),
            cast: true,
            spellDice: foundHero ? spellDice : 0,
            spellSides,
            deferredSpellDamage: true,
            directed,
            deferredSpellEffect: true,
        };
    }
    if (attackType === AT_ENGL && monster.mspec_used && !alreadyEngulfing) {
        return {
            kind: 'hero-attack',
            threshold,
            hit: false,
            roll: sequence.lastAttackRoll,
            nearMiss: threshold === sequence.lastAttackRoll,
            attackType,
            damageType,
            attackIndex,
            effect: 'engulf-cooldown-miss',
        };
    }
    let weaponAccuracy = 0;
    if (attackType === AT_WEAP) {
        const wieldedWeapon = monsterWieldedWeapon(monster);
        if (wieldedWeapon && !retainedAttackRoll) {
            weaponAccuracy = weaponHitBonus(wieldedWeapon, state.u, {
                state,
                random,
                rollOne,
            });
            await swingMonsterWeapon(monster, wieldedWeapon, state, { random });
        }
    }
    const toHitSides = 20 + attackIndex;
    let roll = null;
    let hit = true;
    if (retainedAttackRoll) {
        roll = retainedAttackRoll.roll;
        hit = retainedAttackRoll.hit;
    } else if (!alreadyEngulfing && attackType !== AT_HUGS) {
        roll = sequence.lastAttackRoll = rollOne(toHitSides);
        calls.push(`rnd(${toHitSides})`);
        hit = threshold + weaponAccuracy > roll;
    }
    if (hit && (naturalContact || attackType === AT_HUGS)) {
        if (monsterGrabPassesThroughHero(effectiveAttack, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'failed-grab',
                nativeResult: M_ATTK_MISS,
            };
        }
        // A failed kick still reports a miss; a successful kick cannot
        // penetrate thick skin and never enters hitmu().
        if (attackType === AT_KICK && monsterIsThickSkinned({ mnum: heroSpecies(state) }))
            return null;
    }
    // C hitmu() reveals a concealed attacker before rolling base damage.
    // That pline can suspend behind an older tty topline, so preserve the
    // already-consumed attack die and resume this same slot afterward.
    const hiddenUnder =
        hit &&
        !retainedAttackRoll &&
        monster.mundetected &&
        ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL ||
            MONSTER_SYMBOL[monster.mnum] === S_EEL);
    if (hiddenUnder) {
        if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
        slot.attackerMapped = true;
        monster.mundetected = 0;
        if (!senseWithTelepathy(monster) && !heroDetectsMonsters(state)) {
            const object = state.level?.objects[monster.mx]?.[monster.my]?.[0];
            if (object) {
                let what: string;
                if (heroIsBlind(state) && !object.dknown) {
                    what = 'something';
                } else if (isPoolAt(monster.mx, monster.my, state)
                    && !state.u.underwater) {
                    what = 'the water';
                } else {
                    observeObjectForNaming(object, { state });
                    what = await objectDescription(object, { state });
                }
                const name = canonicalMonsterName(monster, { state, article: 'a', capitalized: true });
                return {
                    kind: 'hero-attack', roll, threshold, hit,
                    attackType, damageType, attackIndex,
                    deferredRevealUnder: true,
                    revealUnderMessage: `${name === 'It' ? 'Something' : name} was hidden under ${what}!`,
                };
            }
            await newsym(monster.mx, monster.my);
        }
    }
    // gulpmu() has its own roll; every successful contact enters hitmu()
    // once, including harmless touches and unsupported special effects.
    let damage = 0;
    if (hit) {
        // C mattacku() displays pending movement before gulpmu(), even
        // when admission later fails silently (for example, at iron bars).
        if (attackType === AT_ENGL && state === game) await flush_screen(1);
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        if (attackType !== AT_ENGL
            && (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster))
            && recorderLocalHour(state.datetime) === 0) {
            damage += rollDice(dice, sides);
            calls.push(`d(${dice},${sides})`);
        }
    }
    const poisonAttribute = poisonAttackAttribute(damageType);
    // mhitu.c:hitmu() rolls the AT_WEAP slot's declared base damage, then
    // weapon.c:dmgval() rolls the wielded weapon's small-target die.  The
    // visible hit line precedes knockback and HP subtraction.
    const contactWeapon = attackType === AT_WEAP ? monsterWieldedWeapon(monster) : null;
    if (hit && attackType === AT_ENGL) {
        // gulpmu() rolls before silent admission and failed-grab checks.
        if (alreadyEngulfing) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: true,
                damage: 0,
                attackType,
                damageType,
                effect: 'engulf-tick',
                engulfDamage: damage,
                deferredEngulf: 'effect',
            };
        }
        if (!monsterCanEngulfHero(monster, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'engulf-refused',
            };
        }
        if (monsterGrabPassesThroughHero(effectiveAttack, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'failed-grab',
            };
        }
        const engulfOldX = monster.mx;
        const engulfOldY = monster.my;
        await unplaceBallAndChain(state);
        monster.mtrapped = 0;
        monster.mx = state.u.ux;
        monster.my = state.u.uy;
        setHeroGrip(monster, state);
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage: 0,
            attackType,
            damageType,
            attackIndex,
            effect: 'engulf',
            engulfDamage: damage,
            deferredEngulf: 'capture',
            engulfOldX,
            engulfOldY,
        };
    } else if (hit && contactWeapon && damageType === AD_PHYS) {
        const poison =
            (roll ?? 0) <= 5 &&
            (contactWeapon.opoisoned || isPermanentlyPoisonedObject(contactWeapon))
                ? { attribute: A_STR, fatal: 10 }
                : null;
        if (contactWeapon.otyp === CORPSE && touchPetrifies(contactWeapon.corpsenm)) {
            // C uhitm.c:4050-4052: Monnam(magr) and the corpse species'
            // neutral pmname; an unseen attacker already names itself "It".
            await plineWithContinuation(
                `${monsterSentenceSubject(monster)} hits you with the ${MONSTER_NAME[contactWeapon.corpsenm ?? -1]} corpse.`,
            );
            if (await startHeroPetrificationFromMonster(monster, state)) {
                await knockHeroFromMonster(monster, { attackType, damageType, hit }, state, random);
                return {
                    kind: 'hero-attack',
                    roll,
                    threshold,
                    hit,
                    damage: 0,
                    attackType,
                    damageType,
                    effect: 'petrifying-corpse',
                };
            }
            damage = 1;
        }
        const weaponDamage = rollPhysicalWeaponDamageAgainstHero(contactWeapon, state, {
            rollOne: (range: number) => {
                calls.push(`rnd(${range})`);
                return rollOne(range);
            },
            rollDice: (count: number, sides: number) => {
                calls.push(`d(${count},${sides})`);
                return rollDice(count, sides);
            },
        });
        damage = Math.max(1, damage + weaponDamage + monsterWeaponStrengthBonus(monster, random));
        if (deferVisibleContact) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit,
                damage,
                attackType,
                damageType,
                effect: 'physical-weapon',
                oldFormMnum,
                poison,
                deferredPostHit: true,
            };
        }
        const artifact = await applyArtifactHit(contactWeapon, 'hero', damage, {
            state, attacker: monster, dieRoll: roll ?? 0,
            publish: plineWithContinuation, random, rollOne,
        });
        if (artifact.heroDied) return {
            kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType,
        };
        damage = artifact.damage;
        if (damage) {
            damage = await resolveMonsterWeaponContact(monster, contactWeapon, damage, state,
                plineWithContinuation, rollOne);
            await erodeAttackingWeapon(state.u, contactWeapon, { state, random });
        }
        if (artifact.damage && poison) {
            const effect = await poisonHeroFromMonster(monster, attackType, {
                ...poison,
                state,
                random,
                rollOne,
                rollDice,
            });
            if (effect.died)
                return {
                    kind: 'hero-attack',
                    roll,
                    threshold,
                    hit,
                    damage: 0,
                    heroDied: true,
                    attackType,
                    damageType,
                };
        }
        const knockback = await knockHeroFromMonster(
            monster,
            { attackType, damageType, hit },
            state,
            random,
        );
        if (knockback.defenderDied)
            return { kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType };
        damage = reduceHeroContactDamage(monster, damage, state, rollOne, calls);
        const passive = await finishHeroContactDamage(
            monster,
            damage,
            attackType,
            oldFormMnum,
            state,
            {
                random,
                rollDice,
            },
        );
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'physical-weapon',
            specialMessage: artifact.specialMessage,
            passive,
            heroDied: !!passive.heroDied,
        };
    } else if (hit && monster.mnum === 116 && !deferVisibleContact) {
        // PM_GRID_BUG: AT_BITE AD_ELEC 1d1.  The electric special checks
        // magic cancellation, optionally checks inventory destruction, then
        // the shared post-hit knockback path consumes its distance/chance
        // draws even though an electric bite cannot knock the hero back.
        const armorProtection = magicNegation(state.u, state);
        const negated = recordRandom(random, calls, 10) < 3 * armorProtection;
        if (!negated) {
            recordRandom(random, calls, 20);
        } else {
            damage = 0;
        }
        const knockback = await knockHeroFromMonster(
            monster,
            { attackType, damageType, hit },
            state,
            random,
        );
        if (knockback.defenderDied)
            return { kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType };
        damage = reduceHeroContactDamage(monster, damage, state, rollOne, calls);
        const passive = await finishHeroContactDamage(
            monster,
            damage,
            attackType,
            oldFormMnum,
            state,
            {
                random,
                rollDice,
            },
        );
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            passive,
            heroDied: !!passive.heroDied,
            effect: negated ? 'electric-avoided' : 'electric-zap',
        };
    } else if (hit && poisonAttribute !== null) {
        // uhitm.c:mhitm_ad_drst() family.  Poisonous natural attacks roll
        // their physical damage first, then magic cancellation; only a
        // non-negated attack reaches the one-in-eight attribute-poison gate.
        const negated = specialAttackNegated(monster, state.u, { state, random });
        const poison = negated ? null : { attribute: poisonAttribute, chance: 8 };
        if (deferVisibleContact) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit,
                damage,
                attackType,
                damageType,
                effect: 'poisonous-natural',
                poison,
                deferredPostHit: true,
            };
        }
        if (poison) {
            const effect = await poisonHeroFromMonster(monster, attackType, {
                ...poison,
                state,
                random,
                rollOne,
                rollDice,
            });
            if (effect.died)
                return {
                    kind: 'hero-attack',
                    roll,
                    threshold,
                    hit,
                    damage: 0,
                    heroDied: true,
                    attackType,
                    damageType,
                };
        }
        const knockback = await knockHeroFromMonster(
            monster,
            { attackType, damageType, hit },
            state,
            random,
        );
        if (knockback.defenderDied)
            return { kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType };
        damage = reduceHeroContactDamage(monster, damage, state, rollOne, calls);
        const passive = await finishHeroContactDamage(
            monster,
            damage,
            attackType,
            oldFormMnum,
            state,
            {
                random,
                rollDice,
            },
        );
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'poisonous-natural',
            passive,
            heroDied: !!passive.heroDied,
        };
    } else if (hit && (damageType === AD_WERE || damageType === AD_SLEE
        || damageType === AD_POLY || damageType === AD_TLPT || damageType === AD_PLYS
        || damageType === AD_WRAP || damageType === AD_DRIN || damageType === AD_CURS
        || damageType === AD_HEAL || damageType === AD_ACID || damageType === AD_SLOW
        || damageType === AD_SGLD || damageType === AD_SSEX || damageType === AD_DISE
        || damageType === AD_CONF || damageType === AD_PEST || damageType === AD_FAMN
        || damageType === AD_DETH || damageType === AD_SAMU)) {
        const negated = damageType === AD_SLOW
            ? specialAttackNegated(monster, state.u, { state, random })
            : damageType === AD_POLY
                && (specialAttackNegated(monster, state.u, { state, random }) || !!monster.mspec_used);
        return {
            kind: 'hero-attack', roll, threshold, hit, damage, attackType, damageType,
            oldFormMnum, negated, deferredSpecialContact: true,
            ...(damageType === AD_WRAP ? { effect: 'wrapping-natural' } : {}),
            ...(damageType === AD_HEAL ? { effect: `nurse-${nurseContactMode(monster, state)}` } : {}),
            ...(damageType === AD_SSEX ? { effect: 'seduction-contact' } : {}),
            ...(damageType === AD_PEST ? { effect: 'pestilence-contact' } : {}),
            ...(damageType === AD_FAMN ? { effect: 'famine-contact' } : {}),
            ...(damageType === AD_DETH ? { effect: 'death-contact' } : {}),
        };
    } else if (hit && damageType === AD_STCK) {
        const armorProtection = magicNegation(state.u, state);
        const negated = !!monster.mcan || recordRandom(random, calls, 10) < 3 * armorProtection;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'sticking-natural',
            negated,
            deferredStickingAfterHit: true,
            oldFormMnum,
        };
    } else if (
        hit &&
        !alreadyEngulfing &&
        attackType !== AT_ENGL &&
        damageType === AD_FIRE &&
        dice > 0 &&
        sides > 0
    ) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'fire-natural',
            // uhitm.ts:mhitmAdFire() runs the whole mhitm_ad_fire() body
            // with direct awaits; only hitmu()'s shared knockback and damage
            // tail remains deferred with the other contact effects.
            deferredPostHit: true,
            oldFormMnum,
        };
    } else if (hit && attackType !== AT_ENGL && damageType === AD_COLD) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'cold-natural',
            // uhitm.ts:mhitmAdCold() runs the whole mhitm_ad_cold() body
            // with direct awaits; only hitmu()'s shared knockback and damage
            // tail remains deferred with the other contact effects.
            deferredPostHit: true,
        };
    } else if (
        hit &&
        !alreadyEngulfing &&
        attackType !== AT_ENGL &&
        damageType === AD_ELEC &&
        dice > 0 &&
        sides > 0
    ) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'electric-natural',
            // uhitm.ts:mhitmAdElec() runs the whole mhitm_ad_elec() body
            // with direct awaits; only hitmu()'s shared knockback and damage
            // tail remains deferred with the other contact effects.
            deferredPostHit: true,
        };
    } else if (hit && (damageType === AD_SITM || damageType === AD_SEDU)) {
        // hitmu() records the attack's declared zero dice before dispatching
        // both theft claws through mhitm_ad_sedu(). A successful theft ends the
        // aggressor's attack sequence, so do not retain its second claw slot.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'item-theft',
            deferredItemTheft: true,
        };
    } else if (hit && damageType === AD_LEGS) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'leg-natural',
            // uhitm.ts:mhitmAdLegs() runs the whole mhitm_ad_legs() mhitu
            // body with direct awaits; only hitmu()'s shared knockback and
            // damage tail remains deferred with the other contact effects.
            deferredPostHit: true,
            oldFormMnum,
        };
    } else if (hit && damageType === AD_BLND && dice > 0 && sides > 0) {
        // hitmu() rolls the declared damage before mhitm_ad_blnd(); the
        // raven claw converts it into blindness duration inside
        // uhitm.ts:mhitmAdBlnd() and reports zero HP damage.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'blind-natural',
        };
    } else if (hit && damageType === AD_STUN) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'stun-natural',
            // uhitm.ts:mhitmAdStun() runs the whole mhitm_ad_stun() mhitu
            // body with direct awaits; only hitmu()'s shared knockback and
            // damage tail remains deferred with the other contact effects.
            deferredPostHit: true,
            oldFormMnum,
        };
    } else if (hit && damageType === AD_SLIM) {
        const armorProtection = magicNegation(state.u, state);
        const cancelled = !!monster.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * armorProtection;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'slime-natural',
            slimeNegated: negated,
            slimeCancelled: cancelled,
            deferredSlimeEffect: true,
            oldFormMnum,
        };
    } else if (hit && damageType === AD_WERE) {
        return {
            kind: 'hero-attack', roll, threshold, hit, damage, attackType, damageType,
            deferredPostHit: true, oldFormMnum,
        };
    } else if (hit && damageType === AD_STON) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'stoning-natural',
            deferredPostHit: true,
        };
    } else if (hit && damageType === AD_RUST) {
        // uhitm.c:mhitm_ad_rust() still receives hitmu()'s declared 0d0
        // damage and publishes hitmsg() before cancellation or erode_armor().
        // Armor erosion is a separately resumable message owner; shared
        // knockback gates follow it before mattacku() advances attack slots.
        const completelyRustableForm = Upolyd(state?.u) && state.u.umonnum === 259;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-rust-natural' : 'rust-natural',
            oldFormMnum,
            deferredRustRehumanize: !monster.mcan && completelyRustableForm,
            deferredRustArmor: !monster.mcan && !completelyRustableForm,
            deferredPostHit: !!monster.mcan,
        };
    } else if (hit && damageType === AD_CORR) {
        // uhitm.c:mhitm_ad_corr() keeps the bite's declared 3d8 damage, but
        // hitmsg() and erode_armor(ERODE_CORRODE) both precede the common
        // knockback and HP-damage tail.  Keep armor erosion resumable across
        // tty exactly as for rust without conflating primary/secondary state.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-corrosion-natural' : 'corrosion-natural',
            oldFormMnum,
            deferredCorrosionArmor: !monster.mcan,
            deferredPostHit: !!monster.mcan,
        };
    } else if (hit && damageType === AD_DCAY) {
        // uhitm.c:mhitm_ad_dcay() follows the same hitmsg/cancellation/armor
        // continuation shape as rust, but erodes secondary rot state and
        // deliberately disables grease protection.
        const completelyRottableForm =
            Upolyd(state?.u) && [PM_LEATHER_GOLEM, 254].includes(state.u.umonnum);
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-decay-natural' : 'decay-natural',
            oldFormMnum,
            deferredDecayRehumanize: !monster.mcan && completelyRottableForm,
            deferredDecayArmor: !monster.mcan && !completelyRottableForm,
            deferredPostHit: !!monster.mcan,
        };
    } else if (hit && damageType === AD_ENCH) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'enchantment-natural',
            // uhitm.ts:mhitmAdEnch() runs the negation probe, hitmsg(), the
            // armor drain and its line with direct awaits; only hitmu()'s
            // shared knockback and damage tail remains deferred.
            deferredPostHit: true,
            oldFormMnum,
        };
    } else if (hit && damageType === AD_DRLI) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'life-drain-natural',
            // uhitm.ts:mhitmAdDrli() runs hitmsg(), the selection gate and
            // losexp() with direct awaits; only hitmu()'s shared knockback
            // and damage tail remains deferred with the other contact
            // effects.
            deferredPostHit: true,
            oldFormMnum,
        };
    } else if (
        hit &&
        (attackType !== AT_WEAP || !monsterWieldedWeapon(monster)) &&
        damageType === AD_PHYS
    ) {
        const physicalHug = attackType === AT_HUGS && !heroFormSticks(state);
        if (physicalHug) {
            damage = await resolvePhysicalHeroHug(monster, damage, state,
                range => recordRandom(random, calls, range),
                monsterAttackMessagePublisher(sequence.paging));
        }
        const physicalEffect = physicalHug ? 'physical-hug'
            : attackType === AT_TUCH && damage === 0 && state.u.ustuck === monster
                ? 'silent-physical-touch'
            : attackType === AT_WEAP ? 'physical-unarmed-weapon' : 'physical-natural';
        // hitmu() rolls ordinary physical damage before pline() announces the
        // hit, but knockback and HP subtraction happen after that message.
        // The tty can suspend inside pline() for --More--, so the live actor
        // driver must be able to resume this same contact after input.
        if (deferVisibleContact) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit,
                damage,
                attackType,
                damageType,
                effect: physicalEffect,
                oldFormMnum,
                deferredPostHit: true,
            };
        }
        // hitmu() enters mhitm_knockback() after ordinary physical damage.
        // Attack eligibility is tested only after both chance gates.
        const knockback = await knockHeroFromMonster(
            monster,
            { attackType, damageType, hit },
            state,
            random,
        );
        if (knockback.defenderDied)
            return { kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType };
        damage = reduceHeroContactDamage(monster, damage, state, rollOne, calls);
        const passive = await finishHeroContactDamage(
            monster,
            damage,
            attackType,
            oldFormMnum,
            state,
            {
                random,
                rollDice,
            },
        );
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: physicalEffect,
            passive,
            heroDied: !!passive.heroDied,
        };
    }
    return {
        kind: 'hero-attack',
        roll,
        threshold,
        hit,
        damage,
        attackType,
        damageType,
        nearMiss: !hit && roll === threshold + weaponAccuracy,
    };
}

// Native failed_grab(): the hero has no hittable worm tail, so only an
// unsolid body can defeat these holds without entering the hit transaction.
function monsterGrabPassesThroughHero(attack: AttackTuple, state: PlayingGameState): boolean {
    return monsterIsUnsolid({ mnum: heroSpecies(state) })
        && (attack[0] === AT_HUGS || [AD_DGST, AD_STCK, AD_WRAP].includes(attack[1]));
}

// Initial capture and every subsequent slot resume into the same gulpmu body.
export async function resumeDeferredHeroEngulf(
    action: MonsterMovementAction,
    state: PlayingGameState,
    {
        random = rn2,
        rollOne = rnd,
        publish = plineWithContinuation,
        flushMessages,
        die,
    }: MonsterEngulfOptions = {},
) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredEngulf) return null;
    if (attack.engulfDamage === undefined)
        throw new Error('A deferred engulf must retain its rolled damage');
    const monster = action.monster;
    const calls = action.calls;
    const options = {
        state,
        publish,
        ...(flushMessages ? { flushMessages } : {}),
        ...(die ? { die } : {}),
        random: (sides: number) => recordRandom(random, calls, sides),
        rollOne: (sides: number) => {
            const value = rollOne(sides);
            calls.push(`rnd(${sides})`);
            return value;
        },
    };
    if (attack.deferredEngulf === 'capture') {
        const capture = await beginHeroEngulf(monster, attack, options);
        if (!capture.captured) {
            attack.hit = false;
            attack.damage = attack.appliedDamage = 0;
            attack.deferredEngulf = false;
            attack.engulfResolved = true;
            delete attack.engulfDamage;
            return { died: capture.died };
        }
    }
    const result = await resolveHeroEngulf(
        monster,
        attack.damageType,
        attack.engulfDamage,
        options,
    );
    attack.hit = result.hit;
    attack.damage = attack.appliedDamage = result.damage;
    attack.deferredEngulf = false;
    attack.engulfResolved = true;
    delete attack.engulfDamage;
    return result;
}


async function knockHeroFromMonster(
    monster: Monster,
    attack: Pick<HeroContactAttack, 'attackType' | 'damageType' | 'hit'>,
    state: PlayingGameState,
    random: RandomBelow,
    publish: PublishMonsterMessage = plineWithContinuation,
) {
    const finishDeath = (target: Monster, options: MonsterDeathOptions = {}) =>
        finishEnvironmentalMonsterDeath(target, state, { ...options, publish });
    return tryKnockback(monster, state.u, attack, {
        state,
        random,
        publish,
        hit: attack.hit,
        weaponUsed: !!monsterWieldedWeapon(monster),
        finishMonsterDeath: finishDeath,
        finishLiquidDeath: (target: Monster, liquid: MonsterLiquidDeathContext) =>
            finishDeath(target, {
                noCorpse: !liquid.leaveCorpse, random: liquid.random,
                sadFeeling: liquid.sadFeeling,
            }),
    });
}

// Continue an ordinary natural hit after its visible hit message has been
// accepted.  C ref: mhitu.c:hitmu() -> mhitm_knockback(), then losehp().
export async function resumeDeferredHeroContact(
    action: MonsterMovementAction,
    state: PlayingGameState,
    {
        random = rn2,
        rollOne = rnd,
        rollDice = d,
        publish = plineWithContinuation,
        die,
    }: MonsterDamageOptions = {},
) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredPostHit) return action;
    const calls = action.calls;
    if (
        attack.damageType === AD_STON &&
        await applyMonsterStoningAttack(action.monster, { state, random, publish })
    ) {
        await knockHeroFromMonster(action.monster, attack, state, random, publish);
        attack.deferredPostHit = false;
        return action;
    }
    if (attack.poison) {
        const poison = await poisonHeroFromMonster(action.monster, attack.attackType, {
            ...attack.poison,
            state,
            random,
            rollOne,
            rollDice,
            publish,
            ...(die ? { die } : {}),
        });
        attack.poison = null;
        if (poison.died) {
            attack.heroDied = true;
            attack.deferredPostHit = false;
            return action;
        }
    }
    const knockback = await knockHeroFromMonster(action.monster, attack, state, random, publish);
    if (knockback.defenderLeftLevel) attack.attackerDone = true;
    if (knockback.defenderDied) {
        attack.heroDied = true;
        attack.deferredPostHit = false;
        return action;
    }
    if (attack.contactDone) {
        attack.nativeResult ??= M_ATTK_HIT;
        attack.deferredPostHit = false;
        return action;
    }
    attack.appliedDamage = reduceHeroContactDamage(action.monster, attack.damage ?? 0, state, rollOne, calls);
    if (attack.permanentDamage && attack.appliedDamage > 0) {
        const damage = attack.appliedDamage;
        let drain = recordRandom(random, calls, Math.trunc(damage / 2) + 1);
        const hero = state.u;
        const polymorphed = Upolyd(hero);
        if (polymorphed || hero.uhpmax > 25 * hero.ulevel) drain = damage;
        else if (hero.uhpmax > 10 * hero.ulevel) drain += Math.trunc(damage / 2);
        else if (hero.uhpmax > 5 * hero.ulevel) drain += Math.trunc(damage / 4);
        const maximum = polymorphed ? 'mhmax' : 'uhpmax';
        const lowerLimit = polymorphed
            ? Math.min(MONSTER_LEVEL[hero.umonnum] ?? 0, hero.ulevel) : Math.max(hero.ulevel, 1);
        if (hero[maximum] > lowerLimit)
            hero[maximum] = Math.max(lowerLimit, hero[maximum] - drain);
        state.context.botl = true;
    }
    attack.passive = await finishHeroContactDamage(
        action.monster,
        attack.appliedDamage,
        attack.attackType,
        attack.oldFormMnum ?? state.u.umonnum,
        state,
        { random, rollDice, publish, ...(die ? { die } : {}) },
    );
    if (attack.passive.heroDied) attack.heroDied = true;
    attack.deferredPostHit = false;
    return action;
}

export function resumeDeferredHeroSticking(action: MonsterMovementAction, state: PlayingGameState) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredStickingAfterHit) return action;
    if (!attack.negated && !state.u?.ustuck && !heroFormSticks(state)) {
        setHeroGrip(action.monster, state);
        attack.stuckHero = true;
        if (action.monster?.mnum === 293) attack.stickingMessage = 'The barbs stick to you!';
    }
    attack.deferredStickingAfterHit = false;
    attack.deferredPostHit = true;
    return action;
}

// Resume hitmu() after its concealed-attacker line has crossed tty.  The
// mattacku() to-hit die belongs before that line; base damage and every later
// contact effect belong after it.
export async function resumeDeferredHeroReveal(
    action: MonsterMovementAction,
    state: PlayingGameState,
    random: RandomBelow = rn2,
    rollDice: RollDice = d,
    rollOne: RollOne = rnd,
) {
    const sequence = action.movement?.heroAttackSequence;
    if (!sequence) return null;
    const attack = sequence.current;
    if (attack?.kind !== 'hero-attack') return null;
    if (!attack.deferredRevealUnder) return attack;
    const resumed = await beginHeroAttackSlot(
        sequence,
        attack,
        state,
        random,
        rollOne,
        rollDice,
        action.calls,
        { roll: attack.roll ?? null, hit: attack.hit },
        true,
    );
    delete attack.deferredRevealUnder;
    if (resumed?.kind !== 'hero-attack')
        throw new Error('A revealed contact attack must resume the same attack slot');
    const resumedContact: HeroContactAttack & HeroAttackSlot = { ...attack, ...resumed };
    sequence.current = resumedContact;
    return resumedContact;
}


export async function completeHeroAttackSlot(
    action: MonsterMovementAction,
    state: PlayingGameState,
    random: RandomBelow = rn2,
    rollDice: RollDice = d,
    rollOne: RollOne = rnd,
) {
    const sequence = action.movement?.heroAttackSequence;
    if (!sequence) return null;
    const attack = sequence.current;
    if (!attack) return null;
    let result = attack.nativeResult;
    if (result === undefined) {
        result =
            attack.hit || (attack.kind === 'hero-spell' && attack.cast) ? M_ATTK_HIT : M_ATTK_MISS;
        if (action.monster.dead || action.monster.mhp <= 0) result |= M_ATTK_AGR_DIED;
        if (
            (attack.kind === 'hero-attack' && attack.passive?.attackerStopped) ||
            attack.attackerDone
        )
            result |= M_ATTK_AGR_DONE;
    }
    sequence.results[attack.attackIndex] = result;
    // C mattacku() commits pending status before the next attack slot.
    if (state === game && state.context.botl) await bot();
    if (attack.kind === 'hero-attack' && attack.skipBrainDrain) sequence.skipBrainDrain = true;
    if (
        result === M_ATTK_HIT &&
        state.u.usleep &&
        state.u.usleep < state.moves &&
        recordRandom(random, action.calls, 10) === 0
    ) {
        setMulti(-1, state);
        state._helplessDoneMessage = 'The combat suddenly awakens you.';
    }
    sequence.current = null;
    if (
        state.program_state.gameover ||
        action.monster.dead ||
        action.monster.mhp <= 0 ||
        result & (M_ATTK_AGR_DIED | M_ATTK_AGR_DONE)
    ) {
        sequence.done = true;
        return null;
    }
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    try {
        return await advanceHeroAttackSequence(
            sequence,
            state,
            random,
            rollOne,
            rollDice,
            action.calls,
        );
    } finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
}


// C mhitu.c:mpoisons_subj(). The noun for a poisoning monster's attack
// method; uhitm.c's effect branches compose it into their reasons.
export function poisonAttackNoun(monster: Monster, attackType: AttackMethod): string {
    if (attackType === AT_WEAP)
        return monsterWieldedWeapon(monster)?.opoisoned ? 'weapon' : 'attack';
    if (attackType === AT_TUCH) return 'contact';
    if (attackType === AT_GAZE) return 'gaze';
    return attackType === AT_BITE ? 'bite' : 'sting';
}

const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');

// C mhitu.c:u_slip_free(), greased-or-oilskin armor against a grab
// (mhitm_ad_phys()'s hug branch).
export async function heroSlipsFree(
    monster: Monster, state: PlayingGameState,
    random: (range: number) => number, publish: MessagePublisher,
): Promise<boolean> {
    const armor = state.uarmc || state.uarm || state.uarmu;
    if (!armor || (!armor.greased && armor.otyp !== OILSKIN_CLOAK)) return false;
    if (armor.cursed && random(3) === 0) return false;

    const name = armor.greased || objectTypeKnown(armor, state)
        ? objectCombatName(armor, { state }) : armorSimpleName(armor, state);
    await publish(`${monsterName(monster, { state, capitalized: true })} grabs you, but cannot hold onto your ${armor.greased ? 'greased' : 'slippery'} ${name}!`);
    // The grease roll and inventory change follow the slip message, which
    // may suspend for a pager while the armor is still greased.
    if (armor.greased && random(2) === 0) {
        await publish('The grease wears off.');
        armor.greased = false;
    }
    return true;
}

// C mhitu.c:u_slip_free(), the wrapping variant (mhitm_ad_wrap()'s hero
// branch): engulfing wraps ignore grease entirely.
export async function heroSlipsFromWrapping(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2,
): Promise<boolean> {
    if (attack.attackType === AT_ENGL) return false;
    const armor = state.uarmc || state.uarm || state.uarmu;
    if (!armor || (!armor.greased && armor.otyp !== OILSKIN_CLOAK)) return false;
    if (armor.cursed && random(3) === 0) return false;
    const name = armor.greased || objectTypeKnown(armor, state)
        ? objectCombatName(armor, { state }) : armorSimpleName(armor, state);
    await publish(`${monsterName(monster, { state, capitalized: true })} slips off of your ${armor.greased ? 'greased' : 'slippery'} ${name}!`);
    if (armor.greased && random(2) === 0) {
        await publish('The grease wears off.');
        armor.greased = false;
    }
    return true;
}

// C mhitu.c:doseduce() and mayberem(); entered from uhitm.c:mhitm_ad_ssex()'s
// hero branch and sounds.c chat with a cancelled seducer.

const RIN_ADORNMENT = OBJECT_NAMES.indexOf('adornment');

interface SeductionContext {
    monster: Monster;
    state: PlayingGameState;
    level: PlayingGameState['level'];
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    female: boolean;
    who: string;
}

export async function resolveHeroSeduction(
    monster: Monster, attack: HeroContactAttack, state: PlayingGameState,
    publish: MessagePublisher, random: typeof rn2, rollOne: typeof rnd,
    { allowCancelledSeducer = false }: { allowCancelledSeducer?: boolean } = {},
): Promise<void> {
    if (monster.mcan) {
        // C sounds.c:MS_SEDUCE calls doseduce() without a cancellation gate,
        // so a cancelled seducer still complains about a severe headache when
        // chatting.  The attack path (uhitm.c:mhitm_ad_ssex) gates on !mcan
        // and stays silent.
        if (allowCancelledSeducer) {
            await publish(`${monsterName(monster, { state, capitalized: true })} acts as though ${monsterSubjectPronoun(monster, { state })} has got a severe headache.`);
        }
        return;
    }
    if (seductionCompatibility(monster, 'hero',
        [attack.attackType, attack.damageType, 0, 0], state) !== 1) return;
    const female = !!monster.female;
    if (monster.mspec_used) {
        await publish(`${monsterName(monster, { state, capitalized: true })} acts as though ${monsterSubjectPronoun(monster, { state })} has got a headache.`);
        return;
    }
    const reason = state._helplessReason;
    const reasonText = typeof reason === 'string' ? reason : reason?.text ?? '';
    if (heroIsUnaware(state) || (heroHasInvoluntaryDelay(state) && /^(?:frozen|paralyzed)/.test(reasonText))) {
        await publish(`${monsterName(monster, { state, capitalized: true })} seems dismayed at your lack of response.`);
        return;
    }
    const visible = canSeeMonster(monster);
    await publish(visible ? formatFeltMessage(`very attracted to ${monsterName(monster, { state })}.`, state)
        : 'Someone caresses you...');
    const context: SeductionContext = { monster, state, level: state.level, publish, random, rollOne,
        female, who: visible ? monsterName(monster, { state, capitalized: true }) : female ? 'She' : 'He' };
    await stopDonning(null, state);
    const triedGloves = await exchangeAdornmentRings(context);
    if (!stillTogether(context)) return finishSeductionAttack(attack);
    await undressHero(context, triedGloves);
    if (!stillTogether(context)) return finishSeductionAttack(attack);
    if (state.uarm || state.uarmc) {
        if (!heroIsDeaf(state)) {
            if (recorderIsLeapDay(state.datetime) && female) {
                const gloves = state.uarmg
                    ?? state.inventory.find(object => armorSlotFor(object.otyp) === 'uarmg');
                // The succubus reveals the gloves even when the hero is blind.
                if (gloves) {
                    observeObject(gloves, state);
                    observeObjectForNaming(gloves, { state });
                }
                await publish(`"Well, then you owe me ${gloves
                    ? `${ownedObjectName(gloves, state, { capitalized: false })} and eleven more pairs of gloves`
                    : 'twelve pairs of gloves'}!"`);
            } else {
                await publish(`"You're such a ${state.flags.female ? 'sweet lady' : 'nice guy'}; I wish..."`);
            }
        } else if (visible) {
            await publish(`${monsterName(monster, { state, capitalized: true })} appears to sigh.`);
        }
        await leaveSeduction(context);
        return finishSeductionAttack(attack);
    }
    if (state.u.ualign.type === -1) adjustHeroAlignment(1, state);
    await publish(`Time stands still while you and ${monsterName(monster, { state, article: 'your', suppressIt: true })} lie in each other's arms...`, { urgent: true });
    await seductionOutcome(context);
    if (state.program_state.gameover) return finishSeductionAttack(attack);
    await paySeducer(context);
    if (random(25) === 0) monster.mcan = 1;
    await leaveSeduction(context);
    finishSeductionAttack(attack);
}

function stillTogether({ state, monster, level }: SeductionContext): boolean {
    return !state.u.utotype && state.level === level && !state.program_state.gameover
        && Math.abs(state.u.ux - monster.mx) <= 1 && Math.abs(state.u.uy - monster.my) <= 1;
}

function finishSeductionAttack(attack: HeroContactAttack): void {
    attack.contactDone = true;
    attack.attackerDone = true;
    attack.nativeResult = M_ATTK_AGR_DONE;
}

async function exchangeAdornmentRings(context: SeductionContext): Promise<boolean> {
    const { state, monster, female, who, publish, random } = context;
    let triedGloves = isWeldedPrimary(state.uwep, state);
    for (const ring of [...state.inventory]) {
        if (ring.otyp !== RIN_ADORNMENT) continue;
        if (!female && state.uleft?.otyp === RIN_ADORNMENT && state.uright?.otyp === RIN_ADORNMENT) break;
        if (!female && (ring === state.uleft || ring === state.uright)) continue;
        if (state.uarmg && (!female || ring.owornmask)) {
            if (!triedGloves) {
                triedGloves = true;
                await maybeRemoveArmor(context, state.uarmg, 'gloves');
            }
            if (state.uarmg) {
                if (!female) break;
                continue;
            }
        }
        if (!heroIsDeaf(state) && random(20) < currentAttribute(A_CHA, state)) {
            const suffix = female ? ' looks pretty.  May I have it?"'
                : ' looks pretty.  Would you wear it for me?"';
            observeObjectForNaming(ring, { state });
            const prefix = '"That ';
            const name = seductionRingName(ring, state, QBUFSZ - 1 - prefix.length - suffix.length);
            learnObjectType(RIN_ADORNMENT, state);
            if (await promptYesNo(`${prefix}${name}${suffix}`) === 'n') continue;
        } else {
            observeObjectForNaming(ring, { state });
            if (female) {
                await publish(`${who} decides she'd like ${ownedObjectName(ring, state, { capitalized: false })}, and takes it.`);
            } else {
                await publish(`${who} decides you'd look prettier wearing ${ownedObjectName(ring, state, { capitalized: false })},`);
                await publish('and puts it on your finger.');
            }
        }
        learnObjectType(RIN_ADORNMENT, state);
        if (female) {
            if (ring.owornmask) await removeWornHeroItem(ring, state);
            unlinkObject(ring, state);
            await addObjectToMonsterInventory(monster, ring, state);
            continue;
        }
        const slot = !state.uright ? 'uright' : !state.uleft ? 'uleft'
            : state.uright.otyp !== RIN_ADORNMENT ? 'uright' : 'uleft';
        const previous = state[slot];
        if (previous) {
            observeObjectForNaming(previous, { state });
            await publish(`${who} replaces ${ownedObjectName(previous, state, { capitalized: false })} with ${ownedObjectName(ring, state, { capitalized: false })}.`);
            await removeHeroAccessory(previous, state);
            if (!stillTogether(context)) return triedGloves;
        } else {
            await publish(`${who} puts the ${objectName(ring, state)} on your ${slot === 'uright' ? 'right' : 'left'} ${heroHandName(state)}.`);
        }
        await wearHeroAccessory(ring, slot, state);
        await publish(`${ring.invlet || '?'} - ${await inventoryItemDescription(ring)}.`);
    }
    return triedGloves;
}

// C safe_qbuf()/short_oname(xname, simpleonames). Ring xname() has no
// beatitude or erosion prefixes; shorten user names before the simple fallback.
function seductionRingName(ring: GameObject, state: PlayingGameState, limit: number): string {
    const fullName = objectName(ring, state);
    if (fullName.length <= limit) return fullName;

    const callName = state._objectCallNames?.[ring.otyp];
    const personalName = ring.oextra?.oname || ring.oname;
    const shortCallState = callName && callName.length >= 12
        ? { ...state, _objectCallNames: {
            ...state._objectCallNames, [ring.otyp]: `${callName.slice(0, 8)}...`,
        } } : state;
    const shortNamedRing = personalName && personalName.length >= 12
        ? { ...ring, oextra: { ...ring.oextra, oname: `${personalName.slice(0, 8)}...` } }
        : ring;

    if (shortCallState !== state) {
        const name = objectName(ring, shortCallState);
        if (name.length <= limit) return name;
    }
    if (shortNamedRing !== ring) {
        const name = objectName(shortNamedRing, state);
        if (name.length <= limit) return name;
    }
    if (shortCallState !== state && shortNamedRing !== ring) {
        const name = objectName(shortNamedRing, shortCallState);
        if (name.length <= limit) return name;
    }
    const simpleName = simpleObjectName(ring, state);
    return simpleName.length <= limit ? simpleName : 'ring';
}

async function undressHero(context: SeductionContext, triedGloves: boolean): Promise<void> {
    const { state, who, publish } = context;
    const naked = !state.uarmc && !state.uarmf && !state.uarmg && !state.uarms && !state.uarmh && !state.uarmu;
    await publish(`${who} ${heroIsDeaf(state) ? 'seems to murmur into your ear'
        : naked ? 'murmurs sweet nothings into your ear' : 'murmurs in your ear'}${naked ? '' : ', while helping you undress'}.`, { urgent: true });
    if (state.uarmc) await maybeRemoveArmor(context, state.uarmc, armorSimpleName(state.uarmc, state));
    if (!state.uarmc && state.uarm) await maybeRemoveArmor(context, state.uarm, armorSimpleName(state.uarm, state));
    await maybeRemoveArmor(context, state.uarmf, 'boots');
    if (!triedGloves) await maybeRemoveArmor(context, state.uarmg, 'gloves');
    await maybeRemoveArmor(context, state.uarms, 'shield');
    if (state.uarmh) await maybeRemoveArmor(context, state.uarmh, armorSimpleName(state.uarmh, state));
    if (!state.uarmc && !state.uarm) await maybeRemoveArmor(context, state.uarmu, 'shirt');
}

// C mhitu.c:mayberem().
async function maybeRemoveArmor(context: SeductionContext, armor: GameObject | null | undefined, name: string): Promise<void> {
    if (!armor?.owornmask || !stillTogether(context)) return;
    const { state, who, publish, random } = context;
    if (heroIsDeaf(state)) {
        await publish(`${who} takes off your ${name}.`);
    } else if (random(20) < currentAttribute(A_CHA, state)) {
        const endearment = random(2) === 0 ? 'lover' : random(2) === 0 ? 'dear' : 'sweetheart';
        if (await promptYesNo(`"Shall I remove your ${name}, ${endearment}?"`) === 'n') return;
    } else {
        const explanation = armor === state.uarm ? "let's get a little closer"
            : armor === state.uarmc || armor === state.uarms ? "it's in the way"
            : armor === state.uarmf ? 'let me rub your feet'
            : armor === state.uarmg ? "they're too clumsy"
            : armor === state.uarmu ? 'let me massage you'
            : `let me run my fingers through your ${heroHairName(state)}`;
        await publish(`"Take off your ${name}; ${explanation}."`);
    }
    await removeWornHeroItem(armor, state);
}

async function seductionOutcome(context: SeductionContext): Promise<void> {
    const { state, monster, publish, random, rollOne } = context;
    const hero = state.u;
    const attributes = currentAttribute(A_CHA, state) + currentAttribute(A_INT, state);
    if (random(35) > Math.min(attributes, 32)) {
        await publish(`${monsterName(monster, { state, article: 'your', suppressIt: true, capitalized: true })} seems to have enjoyed it more than you...`);
        const outcome = random(5);
        if (outcome === 0) {
            await publish(formatFeltMessage('drained of energy.', state));
            hero.uen = 0;
            hero.uenmax -= rollOne(hero.halfPhysicalDamage ? 5 : 10);
            await exerciseAttribute(A_CON, false, state);
            hero.uenmax = Math.max(0, hero.uenmax);
        } else if (outcome === 1 || outcome === 2) {
            await publish(outcome === 1 ? 'You are down in the dumps.' : 'Your senses are dulled.');
            const attribute = outcome === 1 ? A_CON : A_WIS;
            const change = adjustAttribute(attribute, -1, state);
            if (change.changed && attribute === A_CON && state._moveloopStarted)
                await reportHeroEncumbrance(state);
            await exerciseAttribute(attribute, false, state);
            state.context.botl = true;
        } else if (outcome === 3) {
            if (!heroHasDrainResistance(state)) {
                await publish(formatFeltMessage('out of shape.', state));
                await loseHeroExperience('overexertion', { state, publish });
            } else await publish('You have a curious feeling...');
            await exerciseAttribute(A_CON, false, state);
            await exerciseAttribute(A_DEX, false, state);
            await exerciseAttribute(A_WIS, false, state);
        } else {
            await publish(formatFeltMessage('exhausted.', state));
            await exerciseAttribute(A_STR, false, state);
            const damage = 6 + random(10);
            await loseHeroHp(hero.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, 'exhaustion',
                { state, publish, killerFormat: KILLED_BY });
        }
        return;
    }
    monster.mspec_used = rollOne(100);
    await publish(`You seem to have enjoyed it more than ${monsterName(monster, { state, article: 'your', suppressIt: true })}...`);
    const outcome = random(5);
    if (outcome === 0) {
        await publish(formatFeltMessage('raised to your full potential.', state));
        await exerciseAttribute(A_CON, true, state);
        hero.uenmax += rollOne(5);
        hero.uen = hero.uenmax;
        hero.uenpeak = Math.max(hero.uenpeak, hero.uenmax);
    } else if (outcome === 1 || outcome === 2) {
        await publish(outcome === 1 ? formatFeltMessage('good enough to do it again.', state)
            : `You will always remember ${monsterName(monster, { state, article: 'your', suppressIt: true })}...`);
        const attribute = outcome === 1 ? A_CON : A_WIS;
        const change = adjustAttribute(attribute, 1, state);
        if (change.changed && attribute === A_CON && state._moveloopStarted)
            await reportHeroEncumbrance(state);
        await exerciseAttribute(attribute, true, state);
        state.context.botl = true;
    } else if (outcome === 3) {
        await publish('That was a very educational experience.');
        await gainExperienceLevel({ state, publish });
        await exerciseAttribute(A_WIS, true, state);
    } else {
        await publish(formatFeltMessage('restored to health!', state));
        hero.uhp = hero.uhpmax;
        if (Upolyd(hero)) hero.mh = hero.mhmax;
        await exerciseAttribute(A_STR, true, state);
        state.context.botl = true;
    }
}

async function paySeducer(context: SeductionContext): Promise<void> {
    const { state, monster, publish, random, rollOne } = context;
    if (monster.mtame) return;
    if (random(20) < currentAttribute(A_CHA, state)) {
        const name = monsterName(monster, { state, article: 'your', suppressIt: true, capitalized: true });
        await publish(`${name} demands that you pay ${monsterObjectPronoun(monster, { state, noIt: true, random })}, but you refuse...`);
        return;
    }
    if (heroSpecies(state) === MONSTER_NAME.indexOf('leprechaun')) {
        const name = monsterName(monster, { state, article: 'your', suppressIt: true, capitalized: true });
        await publish(`${name} tries to take your gold, but fails...`);
        return;
    }
    const money = heroGoldAmount(state);
    let cost = rollOne(money > LARGEST_INT - 10 ? LARGEST_INT : money + 10) + 500;
    if (monster.mpeaceful) cost = Math.max(1, Math.trunc(cost / 5));
    cost = Math.min(cost, money);
    if (!cost) await publish(heroIsDeaf(state) ? 'No charge.' : '"It\'s on the house!"');
    else {
        const name = monsterName(monster, { state, article: 'your', suppressIt: true, capitalized: true });
        await publish(`${name} takes ${cost} ${currency(cost, { state, random })} for services rendered!`);
        if (cost === money) {
            const purse = heroGoldObject(state);
            if (purse?.owornmask) await removeWornHeroItem(purse, state);
        }
        const payment = detachHeroGold(state, cost);
        if (!payment) throw new Error('Seduction payment selected an absent purse.');
        await linkObjectToMonsterInventory(monster, payment, { state });
        state.context.botl = true;
    }
}

async function leaveSeduction({ monster, state, publish, random, rollOne }: SeductionContext): Promise<void> {
    if (!await reportMonsterTeleportRestriction(monster, { state, publish }))
        await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
}
