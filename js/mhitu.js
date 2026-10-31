// Monster attacks against the hero: mattacku() presentation and hitmsg().
// C ref: mhitu.c.
import { publishHeardMessage } from './hero_speech.js';
import { heroLegName } from './body_parts.js';
import { requireInitializedGame, requireLiveGame } from './gstate.js';
import { KILLED_BY_AN, M_SEEN_FIRE, M_SEEN_MAGR, Upolyd, WATER } from './const.js';
import { plineWithContinuation } from './pline.js';
import { displayMessageWindow } from './tty_topline.js';
import { canSpotMonster, canSeeMonster, map_invisible, newsym } from './display.js';
import { cansee } from './vision.js';
import { monsterName, monsterSubjectPronoun, possessiveName, visibleMonsterSubject } from './monster_name.js';
import { monsterMissMessage } from './monster_miss.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, monsterIsAnimal } from './monster_data.js';
import { AD_DGST, AD_STCK } from './monster_attack_types.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { heroIsDisplaced } from './armor.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { applyArtifactHit } from './artifact_hit.js';
import { resolveMonsterWeaponContact } from './monster_weapon_contact.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { stopHeroOccupation } from './occupation.js';
import { stopRun } from './runmode.js';
import { makeBlinded } from './sight_change.js';
import { makeStunned } from './hero_mental_status.js';
import { finishHeroDeathAfterMonsterMessage, finishMonsterAttackDeath } from './monster_attack_death.js';
import { erodeArmor, erodeAttackingWeapon } from './object_erosion.js';
import { destroyColdInventory, destroyElectricInventory, destroyFireInventory, } from './zap.js';
import { igniteItems } from './light.js';
import { loseHeroExperience } from './exper.js';
import { loseHeroStrength } from './attrib.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { returnHeroToHumanForm } from './polyself.js';
import { resolveMonsterContactEffect } from './monster_contact_effects.js';
import { tryKnockback } from './knockback.js';
import { d, rn2, rnd } from './rng.js';
import { beginMonsterHeroAttack, completeHeroAttackSlot, completeMonsterOffensiveAction, resolveDeferredMonsterBreath, resumeDeferredHeroBlindness, resumeDeferredHeroColdSpecial, resumeDeferredHeroContact, resumeDeferredHeroElectricSpecial, resumeDeferredHeroEngulf, resumeDeferredHeroEnchantment, resumeDeferredHeroFireSpecial, resumeDeferredHeroLegs, resumeDeferredHeroLifeDrain, resumeDeferredHeroReveal, resumeDeferredHeroSticking, resumeDeferredHeroStun, resumeDeferredSpecialAttack, presentMonsterPickups, presentMonsterPostMove, } from './monmove.js';
import { beginDeferredHeroCloneWizard, finishDeferredHeroCloneWizard, resolveDeferredHeroAggravation, resolveDeferredHeroCurseItems, resolveDeferredHeroDeathTouch, resolveDeferredHeroDestroyArmor, resolveDeferredHeroDirectSpell, resolveDeferredHeroFirePillar, resolveDeferredHeroGeyser, resolveDeferredHeroHasteSelf, resolveDeferredHeroInsectSpell, resolveDeferredHeroLightningSpell, resolveDeferredHeroSummonMonsters, resumeDeferredHeroSpell, rollDeferredHeroSpellDamage, prepareMonsterSpellResistance, } from './mcastu.js';
import { resolveMonsterGaze } from './monster_gaze.js';
import { resolveMonsterMagicRay } from './monster_magic_ray.js';
import { resolveMonsterSelfExplosion } from './monster_self_explosion.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { resolveDeferredHeroItemTheft } from './steal.js';
import { finishDeferredHeroSlime, resumeDeferredHeroSlime, } from './slime.js';
import { finishHeroDeath } from './end.js';
import { dist2 } from './hacklib.js';
async function monsterAttackMessage(monster, attack, previousAttack = null, random = rn2) {
    const game = requireInitializedGame();
    if (attack.specialMessage)
        return null;
    if (attack.effect === 'petrifying-corpse' || attack.effect === 'wrapping-natural')
        return null;
    if (attack.effect === 'physical-hug' || attack.effect === 'silent-physical-touch')
        return null;
    if (attack.effect === 'nurse-heal' || attack.effect === 'nurse-cooperate')
        return null;
    if (attack.effect === 'seduction-contact')
        return null;
    if (attack.effect === 'engulf' || attack.effect === 'engulf-tick'
        || attack.effect === 'engulf-refused')
        return null;
    if (attack.effect === 'item-theft' && !monsterIsAnimal(monster))
        return null;
    if (attack.effect === 'blind-natural' && !attack.blindMessage)
        return null;
    if (attack.effect === 'failed-grab') {
        const subject = monsterName(monster, { capitalized: true });
        const verb = attack.damageType === AD_DGST ? 'gulp'
            : attack.damageType === AD_STCK ? 'adhere' : 'grab';
        return `${possessiveName(subject).slice(0, 99)} ${verb} attempt passes right through you!`;
    }
    if (!attack.hit)
        return monsterMissMessage(monster, attack, game, random);
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
    if (attack.effect === 'blind-natural')
        return attack.blindMessage ? `${subject} blinds you!` : null;
    if (attack.effect === 'leg-natural') {
        const side = attack.legSide || 'left';
        const leg = heroLegName(game);
        const contact = attack.legContact === 'reach'
            ? `tries to reach your ${side} ${leg}`
            : attack.legContact === 'nuzzle'
                ? `nuzzles against your ${side} ${leg}`
                : attack.legContact === 'exposed-prick'
                    ? `pricks the exposed part of your ${side} ${leg}`
                    : attack.legContact === 'boot-prick'
                        ? `pricks through your ${side} boot`
                        : attack.legContact === 'boot-scratch'
                            ? `scratches your ${side} boot`
                            : `pricks your ${side} ${leg}`;
        return `${subject} ${contact}!`;
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
async function resolveErosionFormRehumanization(heroAttack, effectMessage) {
    const game = requireInitializedGame();
    let pagerOwned = false;
    const effectDismissal = await plineWithContinuation(effectMessage);
    if (effectDismissal !== null && effectDismissal !== undefined)
        pagerOwned = true;
    const restored = await returnHeroToHumanForm(game, {
        publish: async (message) => {
            const dismissal = await plineWithContinuation(message);
            if (dismissal !== null && dismissal !== undefined)
                pagerOwned = true;
        },
    });
    heroAttack.heroDied = restored.died;
    heroAttack.deferredPostHit = !restored.died;
    return pagerOwned;
}
export async function presentMonsterAttackEffects(action, game, { random = rn2, rollDice = d, rollOne = rnd } = {}) {
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
            let heroAttack = movement.heroAttackSequence.current;
            let previousHeroAttack = null;
            const paging = movement.heroAttackSequence.paging;
            while (heroAttack) {
                const publishSlotMessage = async (message, options) => {
                    const dismissal = await plineWithContinuation(message, options);
                    if (dismissal != null)
                        paging.pagerOwned = true;
                    return dismissal;
                };
                if (heroAttack.kind === 'hero-magic-ray') {
                    const result = await resolveMonsterMagicRay(monster, heroAttack.effectiveAttack, {
                        state: game, publish: publishSlotMessage, calls: action.calls,
                        die: (options) => options.damage
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
                    if (result.heroDied)
                        return { heroDied: true };
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-explosion') {
                    const result = await resolveMonsterSelfExplosion(monster, heroAttack.effectiveAttack, {
                        foundHero: heroAttack.foundHero, state: game, publish: publishSlotMessage,
                        die: (options) => options.damage ? finishMonsterAttackDeath(monster, {
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
                    if (result.heroDied)
                        return { heroDied: true };
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-gaze') {
                    const result = await resolveMonsterGaze(monster, heroAttack.effectiveAttack, {
                        state: game, publish: publishSlotMessage, calls: action.calls,
                        die: (actor, options = {}) => finishMonsterAttackDeath(actor, {
                            ...options, pagerOwned: paging.pagerOwned,
                        }),
                    });
                    heroAttack.nativeResult = result.mask;
                    if (result.heroDied)
                        return { heroDied: true };
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-projectile' || heroAttack.kind === 'hero-spit') {
                    const heroDied = heroAttack.kind === 'hero-projectile'
                        ? heroAttack.projectile.heroDied : heroAttack.spit.heroDied;
                    if (heroDied)
                        return { heroDied: true };
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-breath') {
                    const breath = heroAttack.breath;
                    if (breath.cough && !heroIsDeaf(game)) {
                        if (canSeeMonster(monster))
                            await publishSlotMessage(`${monsterName(monster, { capitalized: true })} coughs.`);
                        else
                            await publishHeardMessage('a cough.', publishSlotMessage);
                    }
                    if (breath.launched) {
                        // C mthrowu.c:breamm() ends with dobuzz() and
                        // nomul(0), both inside the resolver; the breath
                        // neither stops the hero's occupation nor spends
                        // the hero's next movement ration.
                        await resolveDeferredMonsterBreath(action, breath, game, publishSlotMessage);
                        if (game.program_state?.gameover)
                            return { heroDied: true };
                    }
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-spell') {
                    const publishSpellMessage = async (message, options) => {
                        const dismissal = await plineWithContinuation(message, options);
                        if (dismissal != null)
                            paging.pagerOwned = true;
                        return dismissal;
                    };
                    if (!heroAttack.cast) {
                        let curseMessage = null;
                        if (heroAttack.misdirected) {
                            const water = game.level.at(monster.mux ?? 0, monster.muy ?? 0)?.typ === WATER;
                            const caster = canSeeMonster(monster) ? visibleMonsterSubject(monster) : 'Something';
                            curseMessage = `${caster} casts a spell at ${water ? 'empty water' : 'thin air'}!`;
                        }
                        else if (heroAttack.fumbled && !heroIsDeaf(game)
                            && canSeeMonster(monster)) {
                            curseMessage = `The air crackles around ${monsterName(monster)}.`;
                        }
                        else if (heroAttack.curseKind === 'audible') {
                            curseMessage = 'You hear a mumbled curse.';
                        }
                        else if (heroAttack.curseKind) {
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
                        heroAttack = await completeHeroAttackSlot(action, game);
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
                        await publishSpellMessage(`${caster} casts a spell${target}!`);
                    }
                    if (heroAttack.deferredSpellDamage)
                        rollDeferredHeroSpellDamage(action, game, rollDice);
                    await prepareMonsterSpellResistance(heroAttack, game);
                    let effectMessage = heroAttack.spellEffectMessage;
                    if (heroAttack.spell === 'cure-self'
                        && canSeeMonster(monster)) {
                        effectMessage = `${visibleMonsterSubject(monster)} looks better.`;
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
                        effectMessage = `${visibleMonsterSubject(monster)} suddenly ${seesInvisible
                            ? 'becomes transparent' : 'disappears'}!`;
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
                            await makeBlinded(heroHasHalfSpellDamage(game) ? 100 : 200, { state: game, talk: false, publish: publishSpellMessage });
                            if (!heroIsBlind(game))
                                await publishSpellMessage('Your vision clears.');
                        }
                        else if (heroAttack.spell)
                            resumeDeferredHeroSpell(action, game);
                        else
                            await resolveDeferredHeroDirectSpell(action, heroAttack, game, publishSpellMessage, random, rollDice);
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
                            die: (options) => options.killer !== killer
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
                        await resolveDeferredHeroFirePillar(action, heroAttack, publishSpellMessage);
                    if (game.program_state.gameover)
                        return { heroDied: true };
                    if (heroAttack.deferredLightningSpell)
                        await resolveDeferredHeroLightningSpell(action, heroAttack, publishSpellMessage);
                    if (game.program_state.gameover)
                        return { heroDied: true };
                    if (heroAttack.deferredInsectSpell)
                        await resolveDeferredHeroInsectSpell(action, heroAttack);
                    if (heroAttack.deferredCurseItems)
                        await resolveDeferredHeroCurseItems(heroAttack);
                    if (heroAttack.deferredSummonMonsters) {
                        const summoned = await resolveDeferredHeroSummonMonsters(action, game);
                        if (summoned?.message)
                            await publishSpellMessage(summoned.message);
                    }
                    if (heroAttack.deferredCloneWizard) {
                        await publishSpellMessage('Double Trouble...');
                        await beginDeferredHeroCloneWizard(action, game);
                        await finishDeferredHeroCloneWizard(action, game);
                    }
                    if (heroAttack.deferredHasteSelf) {
                        const haste = resolveDeferredHeroHasteSelf(action, game);
                        if (haste?.message)
                            await publishSpellMessage(haste.message);
                    }
                    if (heroAttack.deferredAggravation)
                        resolveDeferredHeroAggravation(action, game);
                    if (heroAttack.deferredDeathTouch) {
                        await resolveDeferredHeroDeathTouch(action, heroAttack, publishSpellMessage);
                        if (heroAttack.heroDied)
                            return { heroDied: true };
                    }
                    if (heroAttack.deferredDestroyArmor)
                        await resolveDeferredHeroDestroyArmor(heroAttack);
                    if (heroAttack.deferredGeyserSpell)
                        resolveDeferredHeroGeyser(action, heroAttack);
                    if (heroAttack.paralyzed)
                        stopRun(game);
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
                        if (restored.died)
                            return { heroDied: true };
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
                    const revealDismissal = await plineWithContinuation(heroAttack.revealUnderMessage ?? '');
                    await newsym(monster.mx, monster.my);
                    if (revealDismissal !== null
                        && revealDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                    heroAttack = await resumeDeferredHeroReveal(action, game);
                    if (!heroAttack)
                        break;
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
                const publishEquipmentMessage = async (line, options) => {
                    const dismissal = await plineWithContinuation(line, options);
                    if (dismissal != null)
                        paging.pagerOwned = true;
                    return dismissal;
                };
                if (heroAttack.hit && heroAttack.effect === 'physical-weapon'
                    && heroAttack.deferredPostHit) {
                    const artifact = await applyArtifactHit(monsterWieldedWeapon(monster), 'hero', heroAttack.damage ?? 0, {
                        state: game, attacker: monster, dieRoll: heroAttack.roll ?? 0,
                        publish: publishEquipmentMessage, random, rollOne,
                    });
                    if (artifact.heroDied)
                        return { heroDied: true };
                    heroAttack.damage = artifact.damage;
                    heroAttack.specialMessage = artifact.specialMessage;
                    if (!artifact.damage)
                        heroAttack.poison = null;
                }
                const message = await monsterAttackMessage(monster, heroAttack, previousHeroAttack, random);
                const contactDismissal = message
                    ? await plineWithContinuation(message) : undefined;
                if (contactDismissal !== null
                    && contactDismissal !== undefined) {
                    paging.pagerOwned = true;
                }
                if (heroAttack.hit && heroAttack.effect === 'physical-weapon' && heroAttack.damage) {
                    const weapon = monsterWieldedWeapon(monster);
                    if (weapon)
                        heroAttack.damage = await resolveMonsterWeaponContact(monster, weapon, heroAttack.damage ?? 0, game, publishEquipmentMessage, rollOne);
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
                    const stickingDismissal = await plineWithContinuation(heroAttack.stickingMessage);
                    heroAttack.stickingMessage = null;
                    if (stickingDismissal !== null
                        && stickingDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredItemTheft) {
                    const theftPager = await resolveDeferredHeroItemTheft(action, monster, heroAttack, random);
                    if (game.program_state.gameover)
                        return { heroDied: true };
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
                        die: (attacker, options = {}) => finishMonsterAttackDeath(attacker, {
                            ...options,
                            pagerOwned: paging.pagerOwned,
                        }),
                        flushMessages: async () => {
                            const dismissal = await displayMessageWindow();
                            if (dismissal != null)
                                paging.pagerOwned = true;
                        },
                    });
                    if (engulf?.died || game.program_state.gameover)
                        return { heroDied: true };
                }
                if (heroAttack.deferredSlimeEffect)
                    resumeDeferredHeroSlime(action, game);
                if (heroAttack.slimeEffectMessage) {
                    const slimeDismissal = await plineWithContinuation(heroAttack.slimeEffectMessage);
                    heroAttack.slimeEffectMessage = null;
                    if (slimeDismissal !== null
                        && slimeDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.slimeStartPending)
                    finishDeferredHeroSlime(action, game);
                if (heroAttack.deferredColdNegation)
                    resumeDeferredHeroColdSpecial(action, game);
                if (heroAttack.coldEffectMessage) {
                    const coldDismissal = await plineWithContinuation(heroAttack.coldEffectMessage);
                    heroAttack.coldEffectMessage = null;
                    if (coldDismissal !== null
                        && coldDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.coldResistanceMessage) {
                    const coldResistanceDismissal = await plineWithContinuation(heroAttack.coldResistanceMessage);
                    heroAttack.coldResistanceMessage = null;
                    if (coldResistanceDismissal !== null
                        && coldResistanceDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredFireNegation)
                    resumeDeferredHeroFireSpecial(action, game);
                if (heroAttack.fireEffectMessage) {
                    const fireDismissal = await plineWithContinuation(heroAttack.fireEffectMessage);
                    heroAttack.fireEffectMessage = null;
                    if (fireDismissal !== null
                        && fireDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredFireRehumanize) {
                    await publishSlotMessage('You go up in flames!');
                    monstersForgetHeroResistance(M_SEEN_FIRE, game);
                    const restored = await returnHeroToHumanForm(game, {
                        publish: publishSlotMessage,
                        die: finishHeroDeathAfterMonsterMessage,
                    });
                    if (restored.died)
                        return { heroDied: true };
                    heroAttack.deferredFireRehumanize = false;
                }
                if (heroAttack.fireResistanceMessage) {
                    const resistanceDismissal = await plineWithContinuation(heroAttack.fireResistanceMessage);
                    heroAttack.fireResistanceMessage = null;
                    if (resistanceDismissal !== null
                        && resistanceDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                // mhitm_ad_fire() updates witnesses after the fire messages,
                // before inventory damage. Cancelled contact teaches nothing.
                if (heroAttack.deferredFireInventory) {
                    if (game.u.fireResistance)
                        monstersObserveHeroResistance(M_SEEN_FIRE, game);
                    else
                        monstersForgetHeroResistance(M_SEEN_FIRE, game);
                }
                if (heroAttack.deferredElectricNegation)
                    resumeDeferredHeroElectricSpecial(action, game);
                if (heroAttack.electricEffectMessage) {
                    const electricDismissal = await plineWithContinuation(heroAttack.electricEffectMessage);
                    heroAttack.electricEffectMessage = null;
                    if (electricDismissal !== null
                        && electricDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.electricResistanceMessage) {
                    const electricResistanceDismissal = await plineWithContinuation(heroAttack.electricResistanceMessage);
                    heroAttack.electricResistanceMessage = null;
                    if (electricResistanceDismissal !== null
                        && electricResistanceDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredLifeDrainGate)
                    await resumeDeferredHeroLifeDrain(action, game, random, publishSlotMessage);
                if (heroAttack.deferredLifeDrain) {
                    heroAttack.deferredLifeDrain = false;
                    const died = await loseHeroExperience('life drainage', {
                        die: finishHeroDeathAfterMonsterMessage,
                        publish: async (message) => {
                            const dismissal = await plineWithContinuation(message);
                            if (dismissal !== null && dismissal !== undefined)
                                paging.pagerOwned = true;
                        },
                    });
                    if (died)
                        return { heroDied: true };
                }
                if (heroAttack.deferredStunGate)
                    resumeDeferredHeroStun(action, random);
                if (heroAttack.stunIncrement != null) {
                    const increment = heroAttack.stunIncrement;
                    heroAttack.stunIncrement = null;
                    await makeStunned((game.u.stunnedTurns ?? 0) + increment, {
                        state: game,
                        publish: async (message) => {
                            const dismissal = await plineWithContinuation(message);
                            if (dismissal !== null && dismissal !== undefined)
                                paging.pagerOwned = true;
                        },
                    });
                }
                if (heroAttack.deferredRustRehumanize) {
                    const rustFormPagerOwned = await resolveErosionFormRehumanization(heroAttack, 'You rust!');
                    paging.pagerOwned ||= rustFormPagerOwned;
                    heroAttack.deferredRustRehumanize = false;
                }
                if (heroAttack.deferredDecayRehumanize) {
                    const decayPagerOwned = await resolveErosionFormRehumanization(heroAttack, 'You rot!');
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
                if (heroAttack.deferredEnchantment)
                    await resumeDeferredHeroEnchantment(action, game, random);
                if (heroAttack.drainMessage) {
                    const drainDismissal = await plineWithContinuation(heroAttack.drainMessage);
                    heroAttack.drainMessage = null;
                    if (drainDismissal !== null
                        && drainDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredLegEffect)
                    await resumeDeferredHeroLegs(action, game, { publish: publishEquipmentMessage });
                if (heroAttack.deferredPostHit) {
                    const publishContactMessage = async (message, options) => {
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
                    await resumeDeferredHeroContact(action, game, contactOptions);
                    if (game.program_state?.gameover)
                        return { heroDied: true };
                    if (heroAttack.deferredElementalInventory) {
                        const inventoryDamage = heroAttack.deferredElementalInventory;
                        const destroyInventory = {
                            cold: destroyColdInventory,
                            fire: destroyFireInventory,
                            electric: destroyElectricInventory,
                        }[inventoryDamage.damageType];
                        const items = await destroyInventory(inventoryDamage.sourceDamage, { state: game, ...contactOptions });
                        if (items.heroDied)
                            return { heroDied: true };
                        if (inventoryDamage.damageType === 'fire') {
                            await igniteItems(game.inventory, {
                                state: game,
                                publish: publishContactMessage,
                            });
                        }
                        heroAttack.deferredElementalInventory = null;
                        delete heroAttack.coldOriginalDamage;
                        delete heroAttack.fireOriginalDamage;
                        delete heroAttack.electricOriginalDamage;
                        const hitPoints = Upolyd(game.u) ? 'mh' : 'uhp';
                        if ((game.u?.[hitPoints] ?? 1) > 0) {
                            await resumeDeferredHeroContact(action, game, contactOptions);
                        }
                        else {
                            heroAttack.heroDied = true;
                            heroAttack.deferredPostHit = false;
                        }
                    }
                    if (game.program_state?.gameover)
                        return { heroDied: true };
                }
                if (heroAttack.deferredBlindEffect) {
                    await resumeDeferredHeroBlindness(action, game);
                }
                if (heroAttack.effectMessage) {
                    const effectDismissal = await plineWithContinuation(heroAttack.effectMessage);
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
                    if (stopsOccupation)
                        await stopHeroOccupation(game);
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
                if (stopsOccupation)
                    await stopHeroOccupation(game);
                heroAttack.heroDied = false;
                previousHeroAttack = heroAttack;
                heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
            }
            if (heroDied)
                return { heroDied: true };
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
    if (game.program_state?.gameover)
        return { heroDied: true };
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
export async function performMonsterHeroAttack(monster, state, { random = rn2, rollDice = d, rollOne = rnd, calls = [], } = {}) {
    requireLiveGame(state);
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    let action;
    try {
        action = {
            monster, calls, movement: {
                oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my, moved: false,
                ...await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls),
            },
        };
    }
    finally {
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
async function performWormTailAttacks(worm, state, options) {
    const segments = worm.wormSegments;
    if (!segments)
        throw new Error(`Worm ${worm.m_id} has no tail list.`);
    for (let index = segments.length - 1; index >= 0; index--) {
        const segment = segments[index];
        if (!segment)
            throw new Error(`Worm ${worm.m_id} has no tail segment ${index}.`);
        if (dist2(segment.x, segment.y, state.u.ux, state.u.uy) >= 3)
            continue;
        // Keep the real head position: mattacku() still uses its range and
        // apparent hero position, including after knockback or a passive.
        const result = await performMonsterHeroAttack(worm, state, options);
        if (result.nativeResult === 1 || result.heroDied)
            return result;
    }
    return { nativeResult: 0, heroDied: false };
}
//# sourceMappingURL=mhitu.js.map