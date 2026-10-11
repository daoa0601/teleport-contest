import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import { requirePlayingGame } from './gstate.js';
// Point-target effects of immediate wands and spells, including broken wands.
// C ref: zap.c bhitm(). Direction and range belong to the caller.
import { M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, W_SADDLE } from './const.js';
import { adjustHeroAlignment } from './alignment.js';
import {
    canSeeMonster, canSpotMonster, map_invisible, newsym,
    plineWithContinuation as pline, shieldeff,
} from './display.js';
import { abusePet } from './dog.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { flashHitsMonster } from './flash.js';
import { hitMonsterWithForce } from './force_bolt.js';
import { game } from './gstate.js';
import { impossible } from './diagnostics.js';
import { releaseHold, releaseHeroFromMonster } from './hero_expulsion.js';
import { finishHeroMonsterKill, finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroFormSticks } from './hero_species.js';
import { isSteadfast } from './knockback.js';
import { probeMonster } from './magic_probe.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { revealMimicIdentity } from './mimic.js';
import { healMonster } from './mon.js';
import { wakeMonster, wakeAttackedMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { cancelMonster } from './monster_cancellation.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsMindless,
    monsterIsUndead, monsterIsVampireShifter,
} from './monster_data.js';
import { finishMonsterEating } from './monster_eating.js';
import { monsterHitPointsPerLevel } from './monster_hit_points.js';
import { hurtleMonster } from './monster_hurtle.js';
import { makeMonsterInvisible } from './monster_invisibility_magic.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import { respondToImmediateMagic, teleportMonsterByHero } from './monster_magic_response.js';
import { monsterName, possessiveName } from './monster_name.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { setMimicAppearance } from './mklev.js';
import { polymorphMonsterFromMagic } from './monster_polymorph_attack.js';
import { monsterHasDrainResistance, monsterResistsEffect } from './monster_resistance.js';
import { monsterResistsSleep, putMonsterToSleep } from './monster_sleep.js';
import { affectMonsterSpeed } from './monster_speed_magic.js';
import {
    BOULDER, CHEST, FIGURINE, LARGE_BOX, OBJECT_COLOR, OBJECT_NAMES, POT_POLYMORPH,
    SPE_EXTRA_HEALING, SPE_FORCE_BOLT, SPE_HEALING, SPE_POLYMORPH, SPE_SLOW_MONSTER,
    SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY, SPE_TURN_UNDEAD, STATUE, WAN_CANCELLATION,
    WAN_LIGHT, WAN_MAKE_INVISIBLE, WAN_POLYMORPH, WAN_SLEEP, WAN_SLOW_MONSTER,
    WAN_SPEED_MONSTER, WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import { objectName } from './objnam.js';
import { landFloorObject } from './floor_effects.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { hotPursuitShopkeeper } from './shop_damage.js';
import { adjustSpellDamage } from './spell_damage.js';
import { surfaceName } from './terrain_name.js';
import { closeHoldingTrap, openFallingTrap, openHoldingTrap } from './trap_magic.js';
import { turnCarriedObjects, turnMonsterWithUndeadMagic } from './undead_turning.js';
import { cansee } from './vision.js';
import { learnWand } from './wand_charge.js';

const WAN_OPENING = OBJECT_NAMES.indexOf('opening');
const WAN_LOCKING = OBJECT_NAMES.indexOf('locking');
const WAN_PROBING = OBJECT_NAMES.indexOf('probing');
const WAN_NOTHING = OBJECT_NAMES.indexOf('nothing');
const SPE_KNOCK = OBJECT_NAMES.indexOf('knock');
const SPE_WIZARD_LOCK = OBJECT_NAMES.indexOf('wizard lock');
const SPE_CANCELLATION = OBJECT_NAMES.indexOf('cancellation');
const SPE_DRAIN_LIFE = OBJECT_NAMES.indexOf('drain life');
const OBJECT_COLOR_NAMES = [
    'black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'gray',
    'transparent', 'orange', 'bright green', 'yellow', 'bright blue',
    'bright magenta', 'bright cyan', 'white',
];

export async function hitMonsterWithWand(monster: Monster, wand: GameObject, {
    state = game, x = monster.mx, y = monster.my,
}: { state?: GameState; x?: number; y?: number } = {}): Promise<number> {
    requirePlayingGame(state);
    const source = wand.oclass === 10 ? 'spell' : 'wand';
    const attackLevel = source === 'wand' ? 12 : state.u.ulevel;
    const onHead = monster.mx === x && monster.my === y;
    state.notonhead = !onHead;
    let wake = true, alreadyWoke = false, reveal = false, learned = false, result = 0;
    const options = { random: rn2, roll: rnd, rollDice: d, finishMonsterKill: finishHeroMonsterKill };

    switch (wand.otyp) {
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
        learned = await hitMonsterWithForce(monster, source, state, { ...options, x, y });
        alreadyWoke = true;
        reveal = true;
        break;
    case WAN_SLOW_MONSTER:
    case SPE_SLOW_MONSTER:
    case WAN_SPEED_MONSTER:
        learned = await affectMonsterSpeed(monster,
            wand.otyp === WAN_SPEED_MONSTER ? 'speed' : 'slow', source, state, options);
        alreadyWoke = true;
        break;
    case WAN_UNDEAD_TURNING:
    case SPE_TURN_UNDEAD:
        if (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster)) {
            await turnMonsterWithUndeadMagic(monster, source, state, {
                ...options, wakeMonster: wakeAttackedMonster,
            });
            alreadyWoke = true;
            reveal = true;
        } else {
            wake = !!await turnCarriedObjects(monster.minvent || monster.inventory || [], state);
        }
        break;
    case WAN_POLYMORPH:
    case SPE_POLYMORPH:
    case POT_POLYMORPH: {
        const spotted = canSeeMonster(monster);
        const giveMessage = !heroIsHallucinating(state)
            && (spotted || state.u.uswallow && state.u.ustuck === monster);
        const change = await polymorphMonsterFromMagic(monster, {
            state, targetSpotted: spotted,
            attackLevel: wand.otyp === POT_POLYMORPH ? 6 : attackLevel,
            polyspot: wand.otyp !== POT_POLYMORPH,
            publish: pline,
            showShield: target => shieldMonster(target, state),
            finishDeath: (target, death) => finishHeroMonsterKillOutcome(target, target.mx, target.my, death),
        });
        learned = !!(change.systemShock && spotted
            || change.changed && giveMessage && (canSpotMonster(monster) || state.u.ustuck === monster));
        break;
    }
    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
        revealMonsterAppearance(monster);
        await cancelMonster(monster, { state, attackLevel });
        break;
    case WAN_TELEPORTATION:
    case SPE_TELEPORT_AWAY:
        revealMonsterAppearance(monster);
        reveal = !await teleportMonsterByHero(monster, { state });
        learned = canSpotMonster(monster);
        break;
    case WAN_MAKE_INVISIBLE:
        learned = await makeMonsterInvisible(monster);
        reveal = learned;
        alreadyWoke = true;
        break;
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK: {
        await revealLockMimic(monster, state);
        const trap = await closeHoldingTrap(monster, { state });
        wake = trap.changed;
        learned = trap.noticed;
        break;
    }
    case WAN_PROBING:
        wake = false;
        reveal = learned = true;
        await probeMonster(monster, { state, onHead, x, y });
        break;
    case WAN_OPENING:
    case SPE_KNOCK: {
        await revealLockMimic(monster, state);
        wake = false;
        if (monster === state.u.ustuck) {
            await releaseHold(state);
            learned = true;
            break;
        }
        const held = await openHoldingTrap(monster, { state });
        learned = held.noticed;
        if (held.changed) break;
        const falling = await openFallingTrap(monster, { state, trapdoorOnly: true });
        learned ||= falling.noticed;
        if (falling.changed) break;
        if (wand.otyp === SPE_KNOCK) {
            wake = true;
            result = 1;
            if ((MONSTER_SIZE[monster.mnum] ?? 0) < 2 && !isSteadfast(monster, state)) {
                if (canSeeMonster(monster)) await pline(`${monsterName(monster, { capitalized: true })} is knocked back!`);
                await hurtleMonster(monster, monster.mx - state.u.ux, monster.my - state.u.uy, rnd(2), { state });
            } else if (canSeeMonster(monster)) await pline(`${monsterName(monster, { capitalized: true })} doesn't budge.`);
            if (alive(monster)) {
                await wakeMonster(monster, { attacked: !monsterIsMindless(monster.mnum) });
                await abusePet(monster, state);
            }
        } else await dropSaddle(monster, state);
        break;
    }
    case SPE_HEALING:
    case SPE_EXTRA_HEALING:
        reveal = true;
        wake = await healMonsterWithMagic(monster, wand, state);
        break;
    case WAN_LIGHT: {
        const flashed = await flashHitsMonster(monster, wand, { state, onHead });
        learned = reveal = flashed.observed;
        break;
    }
    case WAN_SLEEP:
        reveal = true;
        await sleepMonsterWithMagic(monster, d(1 + wand.spe, 12), state);
        learned = !heroIsBlind(state);
        break;
    case SPE_STONE_TO_FLESH:
        wake = await fleshMonster(monster, state);
        break;
    case SPE_DRAIN_LIFE:
        revealMonsterAppearance(monster);
        await drainMonster(monster, attackLevel, state);
        break;
    case WAN_NOTHING:
        wake = false;
        break;
    default:
        await impossible(`What an interesting effect (${wand.otyp})`, { state });
        break;
    }
    if (state.program_state?.gameover) return result;
    if (wake && alive(monster)) {
        if (!alreadyWoke) await wakeAttackedMonster(monster);
        if (!state.program_state?.gameover) await respondToImmediateMagic(monster, state);
        if (monster.isshk && !state.u.ushops?.length) hotPursuitShopkeeper(monster, state);
    }
    if (reveal && alive(monster) && cansee(x, y) && !canSpotMonster(monster)) map_invisible(x, y);
    if (learned) learnWand(wand, { state });
    return result;
}

function alive(monster: Monster) {
    return !monster.dead && monster.mhp > 0;
}

async function revealLockMimic(monster: Monster, state: PlayingGameState) {
    if (M_AP_TYPE(monster) === M_AP_OBJECT && [CHEST, LARGE_BOX].includes(monster.mappearance ?? -1)
        || M_AP_TYPE(monster) === M_AP_FURNITURE
            && (monster.mappearance ?? -1) >= 13 && (monster.mappearance ?? -1) <= 16)
        await revealMimicIdentity(monster, { state });
}

async function sleepMonsterWithMagic(monster: Monster, duration: number, state: PlayingGameState) {
    if (!monster.msleeping && !monster.mfrozen && [M_AP_FURNITURE, M_AP_OBJECT].includes(M_AP_TYPE(monster)))
        revealMonsterAppearance(monster);
    if (monsterResistsSleep(monster) || monsterResistsEffect(monster, 12)) {
        await shieldeff(monster.mx, monster.my, state);
        return;
    }
    if (!putMonsterToSleep(monster, duration)) return;
    finishMonsterEating(monster, state);
    if (monster === state.u.ustuck && !state.u.uswallow && !heroFormSticks(state)) {
        await pline(`${possessiveName(monsterName(monster, { capitalized: true }))} grip relaxes.`);
        await releaseHeroFromMonster(monster, { state });
    }
}

async function dropSaddle(monster: Monster, state: PlayingGameState) {
    const saddle = (monster.minvent || monster.inventory || []).find(object => (object.owornmask ?? 0) & W_SADDLE);
    if (!saddle) return;
    if (cansee(monster.mx, monster.my))
        await pline(`${canSpotMonster(monster) ? possessiveName(monsterName(monster, { capitalized: true })) : 'A'} saddle falls to the ${surfaceName(monster.mx, monster.my, state)}.`);
    else if (canSpotMonster(monster)) await pline(`${possessiveName(monsterName(monster, { capitalized: true }))} saddle falls off.`);
    await removeObjectFromMonsterInventory(monster, saddle, state);
    await landFloorObject(saddle, monster.mx, monster.my, { state });
}

async function healMonsterWithMagic(monster: Monster, spell: GameObject, state: PlayingGameState) {
    const extra = spell.otyp === SPE_EXTRA_HEALING;
    const amount = d(6, extra ? 8 : 4);
    if (MONSTER_NAME[monster.mnum] === 'Pestilence') {
        await damageMonster(monster, Math.trunc(amount / 2), state.u.ulevel, true, state);
        return true;
    }
    const deficit = monster.mhpmax - monster.mhp;
    healMonster(monster, amount);
    if ((spell.blessed || extra) && !monster.mcansee) {
        monster.mcansee = 1;
        monster.mblinded = 0;
        if (canSeeMonster(monster) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x1000))
            await pline(`${monsterName(monster, { capitalized: true })} can see again.`);
    }
    if (canSeeMonster(monster)) {
        if (M_AP_TYPE(monster) === M_AP_OBJECT && monster.mappearance === 0) {
            await setMimicAppearance(monster);
            newsym(monster.mx, monster.my);
        } else if (M_AP_TYPE(monster) === M_AP_OBJECT) {
            const appearance = monster.mappearance;
            if (appearance === undefined) throw new Error('An object mimic requires an object appearance.');
            const name = objectName({ otyp: appearance, oclass: objectClassForType(appearance), dknown: true }, state, { minimal: true });
            const color = OBJECT_COLOR_NAMES[state.objectColors?.[appearance] ?? OBJECT_COLOR[appearance] ?? 0];
            await pline(`The ${name} seems a more vivid ${color} than before.`);
        } else if (!M_AP_TYPE(monster)) {
            await pline(`${monsterName(monster, { capitalized: true })} looks${extra ? ' much' : ''} better.`);
        }
    }
    if (monster.mtame && state.urole.key === 'healer' && deficit > 0) {
        addExperience(Math.min(deficit, amount), 0, state);
        await checkExperienceLevel();
    }
    if (monster.mtame || monster.mpeaceful)
        adjustHeroAlignment(state.urole.key === 'healer' ? 1 : Math.sign(state.u.ualign.type), state);
    return false;
}

async function damageMonster(monster: Monster, damage: number, attackLevel: number, tell: boolean, state: PlayingGameState) {
    const resisted = monsterResistsEffect(monster, attackLevel);
    if (resisted) {
        damage = Math.ceil(damage / 2);
        if (tell) {
            await shieldMonster(monster, state);
        }
    }
    monster.mhp -= damage;
    if (!alive(monster)) await finishHeroMonsterKill(monster, monster.mx, monster.my);
    return resisted;
}

async function drainMonster(monster: Monster, attackLevel: number, state: PlayingGameState) {
    let damage = monsterHitPointsPerLevel(monster);
    if (state.urole.key === 'knight' && state.u.uhave?.questart) damage *= 2;
    damage = adjustSpellDamage(damage, state);
    if (monsterHasDrainResistance(monster)) {
        await shieldMonster(monster, state);
        return;
    }
    if (await damageMonster(monster, damage, attackLevel, false, state) || !alive(monster)) return;
    monster.mhp -= damage;
    monster.mhpmax -= damage;
    if (monster.mhp <= 0 || monster.mhpmax <= 0 || monster.m_lev < 1)
        await finishHeroMonsterKill(monster, monster.mx, monster.my);
    else {
        monster.m_lev--;
        if (canSeeMonster(monster)) await pline(`${monsterName(monster, { capitalized: true })} suddenly seems weaker!`);
    }
}

async function shieldMonster(monster: Monster, state: PlayingGameState) {
    await shieldeff(monster.mx, monster.my, state);
    if (cansee(monster.mx, monster.my))
        await pline(`${monsterName(monster, { capitalized: true })} resists!`);
}

async function fleshMonster(monster: Monster, state: PlayingGameState) {
    if (MONSTER_SYMBOL[monster.mnum] === 55) {
        const name = monsterName(monster, { capitalized: true });
        let message = 'looks rather fleshy for a moment.';
        if (MONSTER_NAME[monster.mnum] === 'stone golem'
            && await changeMonsterForm(monster, MONSTER_NAME.indexOf('flesh golem'), state)) message = 'turns to flesh!';
        else if (MONSTER_NAME[monster.mnum] === 'flesh golem') message = 'seems fleshier...';
        if (canSeeMonster(monster)) await pline(`${name} ${message}`);
        return true;
    }
    const stoneObject = M_AP_TYPE(monster) === M_AP_OBJECT
        && [BOULDER, STATUE, FIGURINE].includes(monster.mappearance ?? -1);
    const stoneFurniture = M_AP_TYPE(monster) === M_AP_FURNITURE
        && ['wall', 'up stairs', 'down stairs', 'branch staircase up',
            'branch staircase down', 'altar', 'throne', 'sink']
            .includes(MAP_SYMBOLS[monster.mappearance ?? -1]?.name ?? '');
    if (stoneObject || stoneFurniture) {
        if (cansee(monster.mx, monster.my))
            await revealMimicIdentity(monster, { state, omitWait: true });
        return true;
    }
    return false;
}
