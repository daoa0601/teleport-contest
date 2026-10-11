// Native muse.c:mbhit() and mbhitm(). Immediate rays complete every contact
// before the item-use owner resumes the monster's turn.
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { askTeleportDestination } from './cmd.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { D_BROKEN, D_CLOSED, D_LOCKED, DRAWBRIDGE_UP, IS_DOOR, M_SEEN_MAGR, RLOC_MSG, SDOOR, SHOPBASE, TEMPLE, ZAP_POS, isok, } from './const.js';
import { destroyDrawbridge, findDrawbridgeAt } from './dbridge.js';
import { canSpotMonster, map_invisible, plineWithContinuation, shieldeff } from './display.js';
import { changeDoorByMagic } from './door_magic.js';
import { loseHeroHp } from './hero_damage.js';
import { hitObjectWithWand } from './immediate_zap.js';
import { wakeMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { AD_RBRE } from './monster_attack_types.js';
import { monsterIsUndead, monsterIsVampireShifter } from './monster_data.js';
import { finishMonsterKilled } from './monster_death.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance } from './monster_perception.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { findMonsterArmorClass } from './monworn.js';
import { WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { stopHeroOccupation } from './occupation.js';
import { propertyIsActive } from './properties.js';
import { rayHitMessage, rayMissMessage } from './ray_hit_message.js';
import { d, rn2, rnd } from './rng.js';
import { roomsAt } from './room.js';
import { addShopDamage } from './shop_damage.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { randomMonsterRelocation, teleportHero } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { turnCarriedObjects, turnHeroWithUndeadMagic } from './undead_turning.js';
import { cansee } from './vision.js';
export async function resolveMonsterImmediateWand(source, wand, { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }) {
    if (![WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING].includes(wand.otyp))
        throw new RangeError(`Unsupported monster immediate wand ${wand.otyp}`);
    const context = {
        state, source, wand, random, rollOne, rollDice, publish,
        seen: !!state.context.zap_oseen,
    };
    let range = random(8) + 6;
    const dx = Math.sign((source.mux ?? 0) - source.mx);
    const dy = Math.sign((source.muy ?? 0) - source.my);
    state.bhitpos = { x: source.mx, y: source.my };
    while (range-- > 0) {
        const x = state.bhitpos.x + dx, y = state.bhitpos.y + dy;
        if (!isok(x, y))
            break;
        state.bhitpos = { x, y };
        if (x === state.u.ux && y === state.u.uy) {
            await hitHeroWithImmediateWand(context);
            range -= 3;
        }
        else {
            const target = monsterAtPosition(state.level, x, y);
            if (target) {
                if (cansee(x, y) && !canSpotMonster(target))
                    map_invisible(x, y);
                await hitMonsterWithImmediateWand(target, context);
                range -= 3;
            }
        }
        if (state.program_state.gameover)
            return { heroDied: true };
        if (await hitFloorObjects(context))
            range--;
        if (state.program_state.gameover)
            return { heroDied: true };
        // Native mbhit retains the terrain type from before door/bridge magic.
        const square = state.level.requireAt(state.bhitpos.x, state.bhitpos.y);
        const terrain = square.typ;
        const bridge = wand.otyp === WAN_STRIKING && terrain !== DRAWBRIDGE_UP
            ? findDrawbridgeAt(x, y, state) : null;
        if (bridge) {
            await destroyDrawbridge(bridge.x, bridge.y, state);
        }
        else if ((IS_DOOR(terrain) || terrain === SDOOR) && wand.otyp === WAN_STRIKING) {
            if (await changeDoorByMagic(wand, state.bhitpos.x, state.bhitpos.y, { state })) {
                if (context.seen)
                    learnObjectType(wand.otyp, state);
                if (square.doormask === D_BROKEN
                    && roomsAt(state.level, state.bhitpos.x, state.bhitpos.y, SHOPBASE).length)
                    addShopDamage(state.bhitpos.x, state.bhitpos.y, 0, state);
            }
        }
        if (state.program_state.gameover)
            return { heroDied: true };
        if (!ZAP_POS(terrain) || IS_DOOR(terrain) && !!(square.doormask & (D_LOCKED | D_CLOSED))) {
            state.bhitpos = { x: state.bhitpos.x - dx, y: state.bhitpos.y - dy };
            break;
        }
    }
    return { heroDied: false };
}
async function hitFloorObjects({ state, wand }) {
    const { x, y } = state.bhitpos;
    let affected = false;
    for (const object of [...(state.level.objects[x]?.[y] ?? [])]) {
        if (object.where !== 'floor' || object.ox !== x || object.oy !== y)
            continue;
        if (await hitObjectWithWand(object, wand, { state }))
            affected = true;
        if (state.program_state.gameover)
            break;
    }
    return affected;
}
async function hitHeroWithImmediateWand(context) {
    const { state, source, wand, seen, rollOne, rollDice, publish } = context;
    switch (wand.otyp) {
        case WAN_STRIKING: {
            let learned = false;
            if (state.u.antimagic || propertyIsActive('antimagic', state)
                || heroHasArtifactDefense('magic', state)) {
                monstersObserveHeroResistance(M_SEEN_MAGR, state);
                await shieldeff(state.u.ux, state.u.uy, state);
                await publish('Boing!');
                learned = true;
            }
            else if (rollOne(20) < 10 + state.u.uac && source.mwandexp) {
                monstersForgetHeroResistance(M_SEEN_MAGR, state);
                await publish('The wand hits you!');
                const damage = rollDice(2, 12);
                if (await loseHeroHp(heroHasHalfSpellDamage(state) ? Math.ceil(damage / 2) : damage, 'a wand', { state, publish }))
                    return;
                learned = true;
            }
            else
                await publish('The wand misses you.');
            await stopHeroOccupation(state);
            endVoluntaryMultiTurn(state);
            if (learned && seen)
                learnObjectType(wand.otyp, state);
            break;
        }
        case WAN_TELEPORTATION:
            await teleportHero({ chooseDestination: askTeleportDestination });
            if (!state.program_state.gameover && seen)
                learnObjectType(wand.otyp, state);
            break;
        case WAN_UNDEAD_TURNING:
            await turnHeroWithUndeadMagic(state, { roll: rollOne });
            if (!state.program_state.gameover && seen)
                learnObjectType(wand.otyp, state);
            break;
    }
}
async function hitMonsterWithImmediateWand(target, context) {
    const { state, wand, seen, rollOne, rollDice, publish } = context;
    let revealInvisible = false;
    if (wand.otyp !== WAN_UNDEAD_TURNING) {
        target.msleeping = 0;
        if (target.m_ap_type)
            revealMonsterAppearance(target);
    }
    switch (wand.otyp) {
        case WAN_STRIKING: {
            revealInvisible = true;
            let learned = false;
            if (monsterHasMagicResistance(target)) {
                await shieldeff(target.mx, target.my, state);
                await publish('Boing!');
                learned = true;
            }
            else if (rollOne(20) < 10 + findMonsterArmorClass(target)) {
                const damage = rollDice(2, 12);
                await publish(rayHitMessage('wand', target, { state, x: target.mx, y: target.my, damage }));
                await damageMonsterWithWand(target, damage, true, context);
                learned = true;
            }
            else
                await publish(rayMissMessage('wand', target, { state, x: target.mx, y: target.my }));
            if (state.program_state.gameover)
                return;
            if (learned && seen && cansee(target.mx, target.my))
                learnObjectType(wand.otyp, state);
            break;
        }
        case WAN_TELEPORTATION:
            if (target.ispriest && roomsAt(state.level, target.mx, target.my, TEMPLE).length) {
                if (cansee(target.mx, target.my))
                    await publish(`${monsterName(target, { state, capitalized: true })} resists the magic!`);
            }
            else if (!await reportMonsterTeleportRestriction(target, { state, publish })) {
                await randomMonsterRelocation(target, {
                    state, random: context.random, rollOne, flags: RLOC_MSG,
                });
            }
            break;
        case WAN_UNDEAD_TURNING: {
            let wake = await turnCarriedObjects(target.minvent, state) > 0;
            if (monsterIsUndead(target.mnum) || monsterIsVampireShifter(target)) {
                wake = revealInvisible = true;
                state.context.bypasses = true;
                await damageMonsterWithWand(target, rollOne(8), false, context);
            }
            if (state.program_state.gameover)
                return;
            if (wake) {
                if (target.mhp > 0 && !target.dead)
                    await wakeMonster(target);
                if (seen)
                    learnObjectType(wand.otyp, state);
            }
            break;
        }
    }
    if (revealInvisible && target.mhp > 0 && !target.dead
        && cansee(state.bhitpos.x, state.bhitpos.y) && !canSpotMonster(target))
        map_invisible(state.bhitpos.x, state.bhitpos.y);
}
async function damageMonsterWithWand(target, damage, tell, { state, random, rollDice, publish }) {
    if (monsterResistsEffect(target, 12, random)) {
        if (tell) {
            await shieldeff(target.mx, target.my, state);
            if (cansee(target.mx, target.my))
                await publish(`${monsterName(target, { state, capitalized: true })} resists!`);
        }
        damage = Math.ceil(damage / 2);
    }
    target.mhp -= damage;
    if (target.mhp <= 0)
        await finishMonsterKilled(target, state, { damageType: AD_RBRE, publish, random, rollDice });
}
//# sourceMappingURL=monster_wand_ray.js.map