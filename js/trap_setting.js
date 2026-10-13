// C apply.c:use_trap(), set_trap(), reset_trapset().
import { currentAttribute } from './attrib.js';
import { A_DEX, A_STR, AIR, BEAR_TRAP, CLOUD, D_CLOSED, D_LOCKED, DOOR, IS_FURNITURE, IS_OBSTRUCTED, Is_airlevel, Is_waterlevel, LANDMINE, P_BASIC, P_RIDING, SHOPBASE } from './const.js';
import { map_trap, newsym, plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { triggerHeroTrap } from './hero_traps.js';
import { consumeInventoryItem } from './invent.js';
import { heroIsOnStairs } from './invocation_position.js';
import { gotoLevel } from './level_change.js';
import { finishTeleportArrival } from './location_effects.js';
import { maketrap } from './mklev.js';
import { monsterDigests } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { LAND_MINE } from './object_data.js';
import { heroHasNoHands } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { promptYesNo } from './query.js';
import { roomsAt } from './room.js';
import { rnl } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { billDummyObject, carriedObjectOwner } from './shk.js';
import { addShopDamage } from './shop_damage.js';
import { findObjectOwner, shopkeeperIsMuted } from './shop_loss.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { trapName } from './trap_name.js';
export function resetTrapSetting(state = game) {
    state._trapSetting = null;
}
export async function useSettableTrap(object) {
    requirePlayingGame(game);
    const hero = game.u;
    const refusal = trapSettingRefusal();
    if (refusal) {
        await pline(`You can't set a trap ${refusal}!`);
        resetTrapSetting();
        return object;
    }
    const type = object.otyp === LAND_MINE ? LANDMINE : BEAR_TRAP;
    const owner = carriedObjectOwner(object, game);
    const ownership = owner === 'Your' || owner === 'The' ? owner.toLowerCase() : owner;
    const old = game._trapSetting;
    if (old && old.object === object && old.level === game.level && old.x === hero.ux && old.y === hero.uy) {
        await pline(`You resume setting ${ownership} ${trapName(type)}.`);
        game._occupation = { key: 'set-trap', text: 'setting the trap' };
        return null;
    }
    const remaining = trapPreparationTime(type, currentAttribute(A_DEX, game), currentAttribute(A_STR, game), heroIsBlind(game));
    const progress = { object, level: game.level, x: hero.ux, y: hero.uy, remaining, forceBungle: false };
    game._trapSetting = progress;
    if (hero.usteed && (hero.weaponSkills?.[P_RIDING]?.skill ?? 0) < P_BASIC) {
        const bungle = rnl(10) > (propertyIsActive('fumbling', game) || object.cursed ? 3 : 5);
        await pline(`You aren't very skilled at reaching from ${monsterName(hero.usteed)}.`);
        if (await promptYesNo(`Continue your attempt to set the ${trapName(type)}?`) !== 'y') {
            resetTrapSetting();
            return object;
        }
        if (bungle) {
            if (type === LANDMINE) {
                progress.remaining = 0;
                progress.forceBungle = true;
            }
            else {
                resetTrapSetting();
                await pline(`You drop the ${trapName(type)}!`);
                await dropInventoryObjectAtHero(object);
                return object;
            }
        }
    }
    await pline(`You begin setting ${ownership} ${trapName(type)}.`);
    if (object.unpaid) {
        const keeper = findObjectOwner(object, hero.ux, hero.uy, game);
        if (!heroIsDeaf(game) && keeper && !shopkeeperIsMuted(keeper))
            await pline('"You set it, you buy it!"');
        await billDummyObject(object);
    }
    game._occupation = { key: 'set-trap', text: 'setting the trap' };
    return null;
}
export async function continueTrapSetting(state = game) {
    requirePlayingGame(state);
    const progress = state._trapSetting;
    if (!progress || progress.object.where !== 'inventory' || !state.inventory.includes(progress.object)
        || progress.level !== state.level || progress.x !== state.u.ux || progress.y !== state.u.uy) {
        resetTrapSetting(state);
        return false;
    }
    if (--progress.remaining > 0)
        return true;
    const object = progress.object;
    const type = object.otyp === LAND_MINE ? LANDMINE : BEAR_TRAP;
    const trap = await maketrap(state.u.ux, state.u.uy, type);
    if (trap) {
        trap.madeby_u = true;
        trap.tseen = true;
        map_trap(trap);
        newsym(trap.tx, trap.ty);
        if (roomsAt(state.level, trap.tx, trap.ty, SHOPBASE).length)
            addShopDamage(trap.tx, trap.ty, 0, state);
        if (!progress.forceBungle)
            await pline(`You finish arming the ${trapName(type)}.`);
        // C evaluates this luck roll before checking force_bungle too.
        const bungle = (object.cursed || propertyIsActive('fumbling', state)) && rnl(10) > 5;
        if (bungle || progress.forceBungle) {
            await triggerHeroTrap(trap, { forceBungle: progress.forceBungle, gotoLevel, finishTeleport: finishTeleportArrival });
            if (state.program_state.gameover)
                return false;
        }
    }
    else
        await pline('Your trap setting attempt fails.');
    await consumeInventoryItem(object, state);
    resetTrapSetting(state);
    return false;
}
function trapPreparationTime(type, dexterity, strength, blind) {
    let turns = 5;
    if (dexterity > 17)
        turns = 2;
    else if (dexterity > 12)
        turns = 3;
    else if (dexterity > 7)
        turns = 4;
    if (blind)
        turns *= 2;
    if (type !== BEAR_TRAP || strength >= 18)
        return turns;
    if (strength > 12)
        return turns + 1;
    return turns + (strength > 7 ? 2 : 4);
}
function trapSettingRefusal() {
    requirePlayingGame(game);
    const hero = game.u, level = game.level;
    const location = level.requireAt(hero.ux, hero.uy);
    if (heroHasNoHands(game))
        return 'without hands';
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0)
        return 'while stunned';
    if (hero.uswallow)
        return hero.ustuck && monsterDigests(hero.ustuck) ? 'while swallowed' : 'while engulfed';
    if (hero.uinwater || game.underwater)
        return 'underwater';
    if (propertyIsActive('levitation', game))
        return 'while levitating';
    if (isPoolAt(hero.ux, hero.uy))
        return 'in water';
    if (isLavaAt(hero.ux, hero.uy))
        return 'in lava';
    if (heroIsOnStairs(game)) {
        for (let stair = game.stairs; stair; stair = stair.next)
            if (stair.sx === hero.ux && stair.sy === hero.uy)
                return stair.isladder ? 'on the ladder' : 'on the stairs';
        return 'on the stairs';
    }
    if (IS_FURNITURE(location.typ) || IS_OBSTRUCTED(location.typ)
        || location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED))
        || level.traps.some(trap => trap.tx === hero.ux && trap.ty === hero.uy))
        return 'here';
    if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)) {
        if (location.typ === AIR)
            return 'in midair';
        return location.typ === CLOUD ? 'in a cloud' : 'in this place';
    }
    return null;
}
//# sourceMappingURL=trap_setting.js.map