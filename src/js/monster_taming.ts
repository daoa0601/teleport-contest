// C dog.c:tamedog(). Food may be caught and consumed; magic has no object
// transfer. A true result tells a projectile caller that the food was caught,
// even when its meal kills the new pet.
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import { NEED_HTH_WEAPON } from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { initializePet } from './dog.js';
import { placeObject } from './floor_object.js';
import { game, requireLiveGame } from './gstate.js';
import { expelHero, releaseHeroFromMonster } from './hero_expulsion.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { AT_WEAP } from './monster_attack_types.js';
import { setMonsterMalign } from './monster_alignment.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS2, MONSTER_FLAGS3, MONSTER_NAME,
    MONSTER_SIZE, MONSTER_SYMBOL, monsterIsHuman,
} from './monster_data.js';
import { monsterName } from './monster_name.js';
import { sessionIsNight } from './monster_sound.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { wieldMonsterWeapon } from './monster_weapon.js';
import { redrawMonsterWorm } from './monster_worm.js';
import { CORPSE } from './object_data.js';
import { corpseName, objectName, observeObjectForNaming, pluralizeObjectNoun } from './objnam.js';
import { beginPetEating, finishPetEating } from './pet_eating.js';
import { ACCFOOD, DOGFOOD, MANFOOD, dogFood } from './pet_food.js';
import { rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { makeShopkeeperHappy } from './shop_damage.js';
import { hasShopkeeperData } from './shop_types.js';
import { cansee } from './vision.js';

const M2_DEMON = 0x00000100;
const M3_WANTSARTI = 0x0010;
const M3_COVETOUS = 0x001f;
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const S_DOG = 4;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;

export async function tameMonster(monster: Monster, source: GameObject | null = null, {
    state = game, announce = false,
}: { state?: GameState; announce?: boolean } = {}): Promise<boolean> {
    requireLiveGame(state);
    const magic = source?.oclass === SCROLL_CLASS || source?.oclass === SPBOOK_CLASS;
    const blessedScroll = !!(magic && source?.blessed);
    const food = magic ? null : source;
    if (monster.mfrozen) monster.mfrozen = Math.trunc((monster.mfrozen + 1) / 2);
    if (monster.msleeping) await wakeMonstersNearWithMessages(monster.mx, monster.my, 1, state);

    const speciesFlags = MONSTER_FLAGS3[monster.mnum] ?? 0;
    if (monster.iswiz || monster.mnum === PM_MEDUSA || (speciesFlags & M3_WANTSARTI))
        return false;
    if (announce && !monster.mpeaceful && canSpotMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} seems ${heroIsHallucinating(state) ? 'really chill' : 'more amiable'}.`);
        announce = false;
    }
    monster.mpeaceful = 1;
    setMonsterMalign(monster, state);
    // The moon roll precedes the food/species tests, including for magic.
    if (state.flags.moonphase === 4 && sessionIsNight(state.datetime)
        && rn2(6) && food && MONSTER_SYMBOL[monster.mnum] === S_DOG)
        return false;
    monster.mflee = monster.mfleetim = 0;
    if (state.u.ustuck === monster) {
        if (state.u.uswallow) {
            const expelled = await expelHero(monster, { state });
            if (expelled.died) return false;
        } else if (!heroFormSticks(state)) {
            await releaseHeroFromMonster(monster, { state });
        }
    }

    if (monster.mtame && food) {
        if (!willCatchFood(monster, food, state)) return false;
        await describeFoodCatch(monster, food, state);
        await feedTamedMonster(monster, food, false, state);
        return true;
    }
    if (monster.mtame && monster.mtame < 10) {
        if (monster.mtame < rnd(10)) monster.mtame++;
        if (blessedScroll) monster.mtame = Math.min(monster.mtame + 2, 10);
        return false;
    }
    if (monster.isshk) {
        if (!hasShopkeeperData(monster)) throw new Error('shopkeeper lacks shop history');
        await makeShopkeeperHappy(monster, { state });
        return false;
    }
    if (!monster.mcanmove || monster.isgd || monster.ispriest || monster.isminion
        || (speciesFlags & M3_COVETOUS) || monsterIsHuman(monster.mnum)
        || (((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DEMON)
            && !((MONSTER_FLAGS2[heroSpecies(state)] ?? 0) & M2_DEMON))
        || (food && dogFood(monster, food, rn2, [], state) >= MANFOOD))
        return false;
    if (monster.m_id === state.quest_status?.leader_m_id) return false;

    initializePet(monster, { state, everything: !(monster.edog || monster.mextra?.edog) });
    if (food) {
        await feedTamedMonster(monster, food, true, state);
        if (monster.dead || monster.mhp <= 0 || state.program_state.gameover)
            return true;
    }
    if (announce && canSpotMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} seems quite ${heroIsHallucinating(state) ? 'approachable' : 'friendly'}.`);
    }
    newsym(monster.mx, monster.my);
    if (monster.wormno) redrawMonsterWorm(monster, state);
    if ((MONSTER_ATTACKS[monster.mnum] || []).some(([type]) => type === AT_WEAP)) {
        monster.weaponCheck = NEED_HTH_WEAPON;
        await wieldMonsterWeapon(monster, state);
    }
    return true;
}

function willCatchFood(monster: Monster, food: GameObject, state: GameState): boolean {
    if (!monster.mcanmove || monster.mconf || monster.meating) return false;
    const quality = dogFood(monster, food, rn2, [], state);
    if (quality === DOGFOOD) return true;
    const pet = monster.edog ?? monster.mextra?.edog;
    return quality <= ACCFOOD && !!pet && pet.hungrytime <= state.moves;
}

async function describeFoodCatch(monster: Monster, food: GameObject, state: GameState): Promise<void> {
    const visible = canSeeMonster(monster);
    if (!visible && !cansee(monster.mx, monster.my)) return;
    observeObjectForNaming(food, { state });
    const noun = catchFoodName(food, state);
    if (visible) {
        const corpseSize = food.otyp === CORPSE && food.corpsenm !== undefined
            ? MONSTER_SIZE[food.corpsenm] : undefined;
        const tooLarge = corpseSize !== undefined
            && corpseSize > (MONSTER_SIZE[monster.mnum] ?? 0);
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} catches ${noun}${tooLarge ? ', or vice versa!' : '.'}`);
    } else {
        const subject = noun.charAt(0).toUpperCase() + noun.slice(1);
        await plineWithContinuation(`${subject} ${food.quan === 1 ? 'stops' : 'stop'}.`);
    }
}

function catchFoodName(food: GameObject, state: GameState): string {
    if (food.otyp === CORPSE) return corpseName(food, { definite: true });
    const name = objectName(food, state);
    const noun = food.quan === 1 ? name : pluralizeObjectNoun(food, name);
    return /^the /i.test(noun) ? noun.replace(/^The /, 'the ') : `the ${noun}`;
}

async function feedTamedMonster(monster: Monster, food: GameObject, devour: boolean, state: GameState): Promise<void> {
    await placeObject(food, monster.mx, monster.my, state);
    const meal = beginPetEating(monster, food, { x: monster.mx, y: monster.my }, state, devour);
    await finishPetEating(monster, meal, state);
}
