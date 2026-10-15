// Whistles and eucalyptus leaves. C apply.c:use_whistle(),
// use_magic_whistle(), magic_whistled(), and doapply's eucalyptus branch.

import { formatFeltMessage } from './hero_speech.js';
import {
    LUCKMIN, M_AP_TYPE, PLNMSG_enum, RLOC_MSG, RLOC_NONE,
} from './const.js';
import { heroNoseName } from './body_parts.js';
import {
    canSpotMonster, displayColorName, newsym, plineWithContinuation,
} from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { heroCanBlow } from './hero_species.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { monsterName } from './monster_name.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import { EUCALYPTUS_LEAF, MAGIC_WHISTLE } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { unblessObjectState } from './object_state.js';
import { ownedObjectName } from './objnam.js';
import { objectQuantity } from './object_stack.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { objectTypeKnown } from './shk.js';
import { monsterInAir } from './terrain_properties.js';
import { moveMonsterNextToHero, teleportHeroToRandomPet } from './teleport.js';
import { heroTeleportRestricted } from './teleport_rules.js';
import { summonVaultGuardSoon } from './vault.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

interface PetSummoningNotice {
    shift: string[];
    appear: string[];
    disappear: string[];
    trapped: number;
}

export async function useWhistle(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    const magic = object.otyp === MAGIC_WHISTLE
        || object.otyp === EUCALYPTUS_LEAF && object.blessed;
    if (!heroCanBlow(state)) {
        await plineWithContinuation('You are incapable of using the whistle.');
    } else if (magic) {
        await blowMagicWhistle(object, state);
    } else {
        await blowOrdinaryWhistle(object, state);
    }
    if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    if (object.otyp === EUCALYPTUS_LEAF && object.blessed && rn2(49) === 0) {
        if (!heroIsBlind(state)) {
            const verb = objectQuantity(object) > 1 ? 'glow' : 'glows';
            await plineWithContinuation(`${ownedObjectName(object, state)} ${verb} ${displayColorName('brown', state)}.`);
            object.bknown = true;
        }
        unblessObjectState(object);
    }
    return { spentTime: true, heroDied: false };
}

async function blowOrdinaryWhistle(object: GameObject, state: GameState) {
    if (state.u.uinwater) {
        await plineWithContinuation(`You blow bubbles through ${ownedObjectName(object, state, { capitalized: false })}.`);
        return;
    }
    await plineWithContinuation(heroIsDeaf(state)
        ? formatFeltMessage(`rushing air tickle your ${heroNoseName(state)}.`, state)
        : `You produce a ${object.cursed ? 'shrill' : 'high'} whistling sound.`);
    await callNearbyPets(state);
    if (object.cursed) summonVaultGuardSoon(state);
}

async function callNearbyPets(state: GameState) {
    requireInitializedHero(state.u);
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy,
        state.u.ulevel * 20, state, plineWithContinuation, { petCall: true });
}

async function blowMagicWhistle(object: GameObject, state: GameState) {
    if (object.cursed && rn2(2) === 0) {
        const pitch = state.u.uinwater ? 'very high' : 'high';
        const sound = heroIsDeaf(state) ? 'frequency vibration' : 'pitched humming noise';
        await plineWithContinuation(`You produce a ${pitch}-${sound}.`);
        await callNearbyPets(state);
        if (rn2(2) === 0 && !heroTeleportRestricted(state))
            await teleportHeroToRandomPet(state);
        return;
    }
    const quality = heroIsHallucinating(state) ? 'normal'
        : state.u.uinwater && !heroIsDeaf(state) ? 'strange, high-pitched' : 'strange';
    await plineWithContinuation(heroIsDeaf(state)
        ? `You produce a ${quality}, sharp vibration.`
        : `You produce a ${quality} whistling sound.`);
    await summonPets(object, state);
}

async function summonPets(object: GameObject, state: GameState) {
    requirePlayingGame(state);
    const level = state.level;
    const stasisUntil = level.flags.stasis_until;
    if (stasisUntil !== undefined && stasisUntil >= state.moves) return;
    const known = objectTypeKnown(object, state);
    const noticed: PetSummoningNotice = { shift: [], appear: [], disappear: [], trapped: 0 };
    for (const pet of [...level.monsters].reverse()) {
        if (pet.mhp <= 0 || !pet.mtame || pet === state.u.usteed) continue;
        if (pet.mtrapped) {
            pet.mtrapped = 0;
            await fillPitWithBoulderAt(pet.mx, pet.my, state);
            if (state.program_state.gameover) return;
        }
        const wasSeen = canSpotMonster(pet);
        const oldName = wasSeen ? petName(pet, state) : null;
        if (M_AP_TYPE(pet)) revealMonsterAppearance(pet);
        const oldx = pet.mx, oldy = pet.my;
        await moveMonsterNextToHero(pet, state, { flags: known ? RLOC_NONE : RLOC_MSG });
        if (state.program_state.gameover) return;
        if (pet.mx === oldx && pet.my === oldy) continue;
        if (pet.mundetected) {
            pet.mundetected = 0;
            newsym(pet.mx, pet.my);
        }
        state._lastPlineKind = PLNMSG_enum;
        const trap = await triggerImmediateMonsterTrap(pet, state, {
            inAir: monsterInAir(pet, state),
        });
        await finishImmediateMonsterTrap(trap, state);
        if (state.program_state.gameover) return;
        if (pet.mhp <= 0)
            state.u.uluck = Math.max(LUCKMIN, (state.u.uluck || 0) - 1);
        if (state._lastPlineKind !== PLNMSG_enum) {
            noticed.trapped++;
            continue;
        }
        const isSeen = pet.mhp > 0 && canSpotMonster(pet);
        if (isSeen) {
            noticed[wasSeen ? 'shift' : 'appear'].push(petName(pet, state));
        } else if (oldName !== null) {
            noticed.disappear.push(oldName);
        }
    }
    if (!known) {
        if (noticed.shift.length + noticed.appear.length + noticed.trapped > 0)
            learnObjectType(object.otyp, state);
        return;
    }
    const message = summonMessage(noticed);
    if (message) await plineWithContinuation(`${message}.`);
}

function petName(pet: Monster, state: GameState) {
    return monsterName(pet, { state, article: 'your', suppressIt: true });
}

function creatureCount(count: number) {
    if (count > 4) return count <= 7 ? 'several' : 'many';
    const name = ['zero', 'one', 'two', 'three', 'four'][count];
    if (!name) throw new RangeError(`Invalid creature count: ${count}`);
    return name;
}

function summonMessage({ shift, appear, disappear }: PetSummoningNotice) {
    const groups = [];
    if (shift.length) groups.push(shift.length === 1
        ? `${shift[0]} shifts location` : `${creatureCount(shift.length)} creatures shift locations`);
    if (appear.length) {
        const noun = !shift.length ? 'creatures' : shift.length === 1 ? 'other creatures' : 'others';
        groups.push(appear.length === 1 ? `${appear[0]} appears` : `${creatureCount(appear.length)} ${noun} appear`);
    }
    if (disappear.length) {
        const noun = !shift.length && !appear.length ? 'creatures'
            : shift.length < 2 && appear.length < 2 ? 'other creatures' : 'others';
        groups.push(disappear.length === 1 ? `${disappear[0]} disappears`
            : `${creatureCount(disappear.length)} ${noun} disappear`);
    }
    const message = groups.length < 3 ? groups.join(' and ')
        : `${groups[0]}, ${groups[1]}, and ${groups[2]}`;
    return message ? message.charAt(0).toUpperCase() + message.slice(1) : '';
}
