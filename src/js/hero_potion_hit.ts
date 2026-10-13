// Native potion.c:potionhit(&youmonst, ..., POTHIT_MONST_THROW).
import { heroHeadName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { explodeLitOilPotion } from './fire_explosion.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { tryCallObjectType } from './object_call.js';
import { POT_ACID, POT_OIL, POT_POLYMORPH } from './object_data.js';
import { deleteObject } from './object_delete.js';
import {
    applySupportedPotionVapor, heroPotionVaporProfile, potionImpactObjectName, randomBottleName,
} from './potion_hit.js';
import { heroIsUnchanging, polymorphHero } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { chargeUnpaidObjectAsDebt, currentShopResident, removeObjectAndContentsFromBill } from './shk.js';
import { cansee } from './vision.js';
import type { MessagePublisher } from './display.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';

const POTION_CLASS = 8;

interface HeroPotionImpactOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    rollDice?: typeof d;
    source?: 'thrown' | 'propelled';
}

export async function hitHeroWithThrownPotion(potion: GameObject, {
    state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d,
    source = 'thrown',
}: HeroPotionImpactOptions = {}): Promise<{ heroDied: boolean }> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (potion.where !== 'free' || potion.oclass !== POTION_CLASS)
        throw new TypeError('Thrown potion impact requires the free potion from projectile flight');
    const bottle = randomBottleName(state, random);
    await publish(`The ${bottle} crashes on your ${heroHeadName(state)} and breaks into shards.`);
    let heroDied = await loseHeroHp(physicalDamage(rollOne(2), state), `${source} potion`, { state, publish });
    if (!heroDied) {
        if (potion.otyp !== POT_OIL && cansee(state.u.ux, state.u.uy))
            await publish(`The ${potionImpactObjectName(potion, state)} evaporates.`);
        heroDied = await applyDirectHeroPotion(potion, state, publish, random, rollDice);
    }
    if (!heroDied) {
        if (heroPotionVaporProfile(state).canReceive) {
            const vapor = await applySupportedPotionVapor({ state, potion, publish });
            // Potions without a vapor effect still reach native docall().
            if (!vapor) await tryCallObjectType(potion, state);
        } else if (potion.dknown && cansee(state.u.ux, state.u.uy)) {
            await tryCallObjectType(potion, state);
        }
        heroDied = !!state.program_state.gameover;
    }
    if (!heroDied && potion.unpaid && state.u.ushops.length) {
        const resident = currentShopResident(state);
        if (!resident) potion.unpaid = false;
        else if (state.context.mon_moving) removeObjectAndContentsFromBill(potion, state, { resident });
        else await chargeUnpaidObjectAsDebt(potion, state, publish);
    }
    await deleteObject(potion, state);
    return { heroDied };
}

async function applyDirectHeroPotion(
    potion: GameObject, state: PlayingGameState, publish: MessagePublisher,
    random: typeof rn2, rollDice: typeof d,
): Promise<boolean> {
    if (potion.otyp === POT_OIL && potion.lamplit) {
        const explosion = await explodeLitOilPotion(potion, state.u.ux, state.u.uy, {
            state, publish, random, rollDice, heroCaused: !state.context.mon_moving,
        });
        return explosion.heroDied;
    }
    if (potion.otyp === POT_POLYMORPH) {
        await publish(`You feel a little ${heroIsHallucinating(state) ? 'normal' : 'strange'}.`);
        if (!heroIsUnchanging(state) && !propertyIsActive('antimagic', state)) await polymorphHero();
        return !!state.program_state.gameover;
    }
    if (potion.otyp === POT_ACID && !propertyIsActive('acidResistance', state)) {
        await publish(`This burns${potion.blessed ? ' a little' : potion.cursed ? ' a lot' : ''}!`);
        const damage = rollDice(potion.cursed ? 2 : 1, potion.blessed ? 4 : 8);
        return await loseHeroHp(physicalDamage(damage, state), 'potion of acid', { state, publish });
    }
    return false;
}

function physicalDamage(damage: number, state: GameState): number {
    return propertyIsActive('halfPhysicalDamage', state) ? Math.trunc((damage + 1) / 2) : damage;
}
