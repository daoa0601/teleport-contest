// Native zap.c:zapyourself(). Effects return damage for their caller to apply;
// item destruction, form changes and instant death complete here.

import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { DamageType } from './monster_attack_types.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { findArmorClass, heroHasDrainResistance } from './armor.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { heroIsPunished } from './ball.js';
import { changeBoxLockByMagic } from './box_magic.js';
import { askTeleportDestination } from './cmd.js';
import {
    A_CHA, A_CON, A_STR, DIED, EXPL_FIERY, M_SEEN_COLD, M_SEEN_ELEC,
    M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_SLEEP, Upolyd,
} from './const.js';
import { impossible } from './diagnostics.js';
import { plineWithContinuation as pline, shieldeff } from './display.js';
import { finishHeroDeath } from './end.js';
import { explode } from './explosion.js';
import { loseHeroExperience } from './exper.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { burnAwayHeroSlime } from './hack.js';
import { releaseHold } from './hero_expulsion.js';
import { healHero } from './hero_healing.js';
import { zapHeroInvisible } from './hero_invisibility.js';
import { putHeroToSleep } from './hero_sleep.js';
import { heroHasRemovableSpeed, slowHero, speedUpHero } from './hero_speed.js';
import { heroSpecies } from './hero_species.js';
import { heroStatusLine } from './hero_status.js';
import { hitObjectWithWand } from './immediate_zap.js';
import { lightDamage, igniteItems } from './light.js';
import { probeObjectChain } from './magic_probe.js';
import { AD_COLD, AD_ELEC, AD_FIRE } from './monster_attack_types.js';
import { MONSTER_FLAGS2, MONSTER_NAME, monsterIsNonliving } from './monster_data.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { cancelObjectMagic } from './object_cancellation.js';
import {
    CHEST, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, LARGE_BOX,
    SPE_CANCELLATION, SPE_CONE_OF_COLD, SPE_DETECT_UNSEEN, SPE_DIG,
    SPE_DRAIN_LIFE, SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FIREBALL,
    SPE_FORCE_BOLT, SPE_HEALING, SPE_KNOCK, SPE_MAGIC_MISSILE, SPE_POLYMORPH,
    SPE_SLEEP, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY,
    SPE_TURN_UNDEAD, SPE_WIZARD_LOCK,
    WAN_CANCELLATION, WAN_COLD, WAN_DEATH, WAN_DIGGING, WAN_FIRE, WAN_LIGHT,
    WAN_LIGHTNING, WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE,
    WAN_NOTHING, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING, WAN_SLEEP,
    WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STRIKING, WAN_TELEPORTATION,
    WAN_UNDEAD_TURNING,
} from './object_data.js';
import { mergeObjectStacks } from './object_merge.js';
import { applyHeroGolemEffects, heroIsUnchanging, polymonHero, polymorphHero, returnHeroToHumanForm } from './polyself.js';
import { unpunishHero } from './punishment.js';
import { d, rn1, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { flashBurn } from './sight_change.js';
import { clearHeroPetrification, heroIsPetrifying } from './stoning.js';
import { heroControlsTeleport, teleportHero } from './teleport.js';
import { burnHeroArmorByFire } from './trap.js';
import { closeHoldingTrap, openFallingTrap, openHoldingTrap } from './trap_magic.js';
import { turnHeroWithUndeadMagic } from './undead_turning.js';
import { couldsee } from './vision.js';
import { learnWand } from './wand_charge.js';
import { destroyInventoryByElement } from './zap.js';

const CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');
const STONE_GOLEM = MONSTER_NAME.indexOf('stone golem');
const FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
const WAND_CLASS = 11;

export async function zapHeroWithObject(object: GameObject, { ordinary = true, state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    let learn = false, damage = 0;
    switch (object.otyp) {
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
        learn = true;
        if (hero.antimagic || heroHasArtifactDefense('magic', state)) {
            await shieldeff(hero.ux, hero.uy);
            await pline('Boing!');
            monstersObserveHeroResistance(M_SEEN_MAGR, state);
        } else {
            if (ordinary) await pline('You bash yourself!');
            damage = ordinary ? d(2, 12) : d(1 + object.spe, 6);
            await exerciseAttribute(A_STR, false, state);
            monstersForgetHeroResistance(M_SEEN_MAGR, state);
        }
        break;
    case WAN_LIGHTNING:
        learn = true;
        damage = await elementalSelfZap('electric', AD_ELEC, M_SEEN_ELEC, 'shockResistance', state);
        if (!state.program_state.gameover) await flashBurn(rnd(100), true, { state });
        break;
    case WAN_FIRE:
    case FIRE_HORN:
        learn = true;
        damage = await elementalSelfZap('fire', AD_FIRE, M_SEEN_FIRE, 'fireResistance', state);
        break;
    case WAN_COLD:
    case SPE_CONE_OF_COLD:
    case FROST_HORN:
        learn = true;
        damage = await elementalSelfZap('cold', AD_COLD, M_SEEN_COLD, 'coldResistance', state);
        break;
    case SPE_FIREBALL:
        await pline('You explode a fireball on top of yourself!');
        await explode(hero.ux, hero.uy, 11, d(6, 6), WAND_CLASS, EXPL_FIERY, { state });
        break;
    case WAN_MAGIC_MISSILE:
    case SPE_MAGIC_MISSILE:
        learn = true;
        if (hero.antimagic || heroHasArtifactDefense('magic', state)) {
            await shieldeff(hero.ux, hero.uy);
            await pline('The missiles bounce!');
            monstersObserveHeroResistance(M_SEEN_MAGR, state);
        } else {
            damage = d(4, 6);
            await pline("Idiot!  You've shot yourself!");
            monstersForgetHeroResistance(M_SEEN_MAGR, state);
        }
        break;
    case WAN_POLYMORPH:
    case SPE_POLYMORPH:
        if (!heroIsUnchanging(state)) {
            learn = true;
            await polymorphHero();
        }
        break;
    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
        await cancelHeroMagic(state);
        break;
    case SPE_DRAIN_LIFE:
        if (!heroHasDrainResistance(state)) await loseHeroExperience('life drainage', { state });
        break;
    case WAN_MAKE_INVISIBLE:
        learn = await zapHeroInvisible(state);
        break;
    case WAN_SPEED_MONSTER:
        await speedUpHero(rn1(25, 50), state);
        learn = true;
        break;
    case WAN_SLEEP:
    case SPE_SLEEP:
        learn = true;
        if (hero.sleepResistance) {
            await shieldeff(hero.ux, hero.uy);
            await pline("You don't feel sleepy!");
            monstersObserveHeroResistance(M_SEEN_SLEEP, state);
        } else {
            await pline(ordinary ? 'The sleep ray hits you!' : 'You fall asleep!');
            monstersForgetHeroResistance(M_SEEN_SLEEP, state);
            putHeroToSleep(rnd(50), { state });
        }
        break;
    case WAN_SLOW_MONSTER:
    case SPE_SLOW_MONSTER:
        if (heroHasRemovableSpeed(state)) {
            await slowHero(state);
            learn = true;
        }
        break;
    case WAN_TELEPORTATION:
    case SPE_TELEPORT_AWAY: {
        const x = hero.ux, y = hero.uy;
        await teleportHero({ chooseDestination: askTeleportDestination });
        learn = (heroControlsTeleport(state) && !(hero.stunned || (hero.stunnedTurns ?? 0) > 0))
            || !couldsee(x, y) || (hero.ux - x) ** 2 + (hero.uy - y) ** 2 >= 16;
        break;
    }
    case WAN_DEATH:
    case SPE_FINGER_OF_DEATH:
        if (monsterIsNonliving(heroSpecies(state)) || ((MONSTER_FLAGS2[heroSpecies(state)] ?? 0) & 0x100)) {
            await pline(object.otyp === WAN_DEATH
                ? 'The wand shoots an apparently harmless beam at you.' : 'You seem no deader than before.');
            break;
        }
        learn = true;
        await pline('You irradiate yourself with pure energy!', { urgent: true });
        await pline('You die.', { urgent: true });
        await finishHeroDeath({ killer: 'death ray', deathType: DIED,
            deathCause: `shot ${state.flags.female ? 'herself' : 'himself'} with a death ray`,
            deathLineShown: true });
        break;
    case WAN_UNDEAD_TURNING:
    case SPE_TURN_UNDEAD:
        learn = true;
        await turnHeroWithUndeadMagic(state);
        break;
    case SPE_HEALING:
    case SPE_EXTRA_HEALING: {
        const extra = object.otyp === SPE_EXTRA_HEALING;
        await healHero(d(6, extra ? 8 : 4), 0, { state, cureBlindness: object.blessed || extra });
        await pline(`You feel ${extra ? 'much ' : ''}better.`);
        break;
    }
    case WAN_LIGHT:
    case EXPENSIVE_CAMERA: {
        const amount = object.otyp === WAN_LIGHT ? d(object.spe, 25) : 5;
        const light = await lightDamage(object, ordinary, amount || 5, { state });
        if (!state.program_state.gameover)
            learn = await flashBurn(light + rnd(25), false, { state });
        break;
    }
    case WAN_OPENING:
    case SPE_KNOCK: {
        if (hero.ustuck) {
            await releaseHold(state);
            learn = true;
        }
        if (state.program_state.gameover) break;
        if (heroIsPunished(state)) {
            await unpunishHero(state);
            learn = true;
        }
        const opening = hero.utrap ? await openHoldingTrap(hero, { state }) : null;
        learn ||= !!opening?.noticed;
        if (!opening?.changed && !state.program_state.gameover) {
            await affectCarriedBoxes(object, state);
            const falling = await openFallingTrap(hero, { state, trapdoorOnly: true });
            learn ||= falling.noticed;
        }
        break;
    }
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK: {
        const closing = !hero.utrap ? await closeHoldingTrap(hero, { state }) : null;
        learn = !!closing?.noticed;
        if (!closing?.changed && !state.program_state.gameover) await affectCarriedBoxes(object, state);
        break;
    }
    case WAN_PROBING:
        probeObjectChain(state.inventory, { state });
        learn = true;
        await pline(heroStatusLine(state));
        break;
    case SPE_STONE_TO_FLESH:
        await restoreFlesh(object, state);
        break;
    case WAN_DIGGING:
    case SPE_DIG:
    case SPE_DETECT_UNSEEN:
    case WAN_NOTHING:
        break;
    default:
        await impossible(`zapyourself: object ${object.otyp} used?`, { state });
    }
    const heroDied = !!state.program_state.gameover;
    if (learn && !heroDied) learnWand(object, { state });
    return { damage: heroDied ? 0 : damage, heroDied };
}

async function elementalSelfZap(
    kind: 'electric' | 'fire' | 'cold', damageType: DamageType, memory: number,
    resistance: 'shockResistance' | 'fireResistance' | 'coldResistance',
    state: PlayingGameState,
) {
    const hero = state.u;
    const damage = d(12, 6);
    const defense = kind === 'electric' ? 'shock' : kind;
    const resisted = !!hero[resistance] || heroHasArtifactDefense(defense, state);
    if (resisted) {
        await shieldeff(hero.ux, hero.uy);
        await pline(kind === 'electric' ? 'You zap yourself, but seem unharmed.'
            : kind === 'fire' ? 'You feel rather warm.' : 'You feel a little chill.');
        monstersObserveHeroResistance(memory, state);
        await applyHeroGolemEffects(damageType, damage, { state });
    } else {
        await pline(kind === 'electric' ? 'You shock yourself!'
            : kind === 'fire' ? "You've set yourself afire!" : 'You imitate a popsicle!');
        if (kind === 'electric') await exerciseAttribute(A_CON, false, state);
        monstersForgetHeroResistance(memory, state);
    }
    if (kind === 'fire') {
        await burnAwayHeroSlime(state, pline);
        await burnHeroArmorByFire(state, pline);
        if (state.program_state.gameover) return 0;
    }
    const items = await destroyInventoryByElement(kind, damage, { state, publish: pline });
    if (items.heroDied) return 0;
    if (kind === 'fire') await igniteItems(state.inventory, { state, publish: pline });
    return resisted ? 0 : damage;
}

export async function cancelHeroMagic(state = game) {
    requirePlayingGame(state);
    for (const object of [...state.inventory]) {
        await cancelObjectMagic(object, { state });
        if (state.program_state.gameover) return;
    }
    findArmorClass(state);
    if (!Upolyd(state.u)) return;
    if (state.u.umonnum === CLAY_GOLEM) {
        await pline(heroIsBlind(state)
            ? `You feel ${heroIsHallucinating(state) ? 'dark' : 'light'} headed.`
            : 'Some writing vanishes from your head!');
        state.u.mh = 0;
    }
    if (heroIsUnchanging(state) && state.u.mh > 0)
        await pline('Your amulet grows hot for a moment, then cools.');
    else await returnHeroToHumanForm(state);
}

async function affectCarriedBoxes(source: GameObject, state: GameState) {
    for (const object of [...state.inventory]) {
        if (object.otyp === CHEST || object.otyp === LARGE_BOX)
            await changeBoxLockByMagic(object, source, { state });
        if (state.program_state.gameover) return;
    }
}

async function restoreFlesh(source: GameObject, state: GameState) {
    if (state.u.umonnum === STONE_GOLEM) await polymonHero(FLESH_GOLEM);
    if (state.program_state.gameover) return;
    if (heroIsPetrifying(state)) {
        clearHeroPetrification(state);
        await pline(heroIsHallucinating(state)
            ? `What a pity--you just ruined a future piece of ${currentAttribute(A_CHA, state) > 15 ? 'fine ' : ''}art!`
            : 'You feel limber!');
    }
    for (const object of [...state.inventory]) {
        await hitObjectWithWand(object, source, { state });
        if (state.program_state.gameover) return;
    }
    // A transformed stack can merge with one checked earlier in the chain.
    // Restart after each merge, keeping every worn identity separate.
    let merged;
    do {
        merged = false;
        for (let i = 0; i < state.inventory.length && !merged; i++) {
            const first = state.inventory[i];
            if (!first) throw new Error(`Inventory object ${i} disappeared during flesh restoration`);
            if (first.owornmask) continue;
            for (const next of state.inventory.slice(i + 1)) {
                if (await mergeObjectStacks(first, next, state)) {
                    merged = true;
                    break;
                }
            }
        }
    } while (merged);
}
