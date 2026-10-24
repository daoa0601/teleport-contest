// C uhitm.c:steal_it(), theft_petrifies(), and hero AD_SGLD/SEDU/SITM/SSEX.
import { A_DEX, M_ATTK_MISS, W_ARM, W_ARMG, W_WEP } from './const.js';
import { findArtifact } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { heroSeductionCompatibility } from './hero_form_contact.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { inventoryItemDescription } from './invent.js';
import { AD_SGLD } from './monster_attack_types.js';
import { MONSTER_FLAGS2, MONSTER_SYMBOL } from './monster_data.js';
import {
    addObjectToMonsterInventory, removeObjectFromMonsterInventory, unlinkMonsterObject,
} from './monster_inventory.js';
import { monsterName, monsterPossessive, monsterSubjectPronoun } from './monster_name.js';
import { monsterSelfTouch } from './monster_stoning.js';
import { updateMonsterWeaponAfterPolymorph } from './monster_weapon.js';
import { CORPSE } from './object_data.js';
import { dropObjectAtHero } from './object_drop.js';
import { mergable } from './object_merge.js';
import { corpseName } from './objnam.js';
import { heroIsPolymorphed } from './polyself.js';
import { heroIsBlind } from './senses.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { addInventoryItem } from './u_init.js';
import type { HeroNaturalEffectContext, HeroNaturalEffectResult } from './hero_natural_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

const COIN_CLASS = 12;
const S_NYMPH = 14;
const M2_NEUTER = 0x00040000;

export async function applyHeroNaturalTheft(
    monster: Monster, context: HeroNaturalEffectContext,
): Promise<HeroNaturalEffectResult> {
    if (context.attack[1] === AD_SGLD) await stealGold(monster, context);
    else await stealItems(monster, context);
    const heroDied = !!context.state.program_state.gameover;
    return { damage: 0, nativeResult: M_ATTK_MISS, done: heroDied, heroDied };
}

async function stealGold(monster: Monster, { state, publish }: HeroNaturalEffectContext): Promise<void> {
    const gold = monsterGold(monster);
    if (gold) {
        unlinkMonsterObject(monster, gold);
        const canMerge = state.inventory.some(object => mergable(object, gold, state));
        const slots = state.inventory.filter(object => object.oclass !== COIN_CLASS).length;
        if (canMerge || slots < 52) {
            await addInventoryItem(gold, null, false);
            if (state.program_state.gameover) return;
            await publish('Your purse feels heavier.');
        } else {
            await publish(`You grab ${monsterName(monster, { state })}'s gold, but find no room in your knapsack.`);
            await dropObjectAtHero(gold, { state, publish });
            if (state.program_state.gameover) return;
        }
    }
    await exerciseAttribute(A_DEX, true, state);
}

async function stealItems(monster: Monster, context: HeroNaturalEffectContext): Promise<void> {
    const { state, publish } = context;
    const inventory = monster.minvent || monster.inventory || [];
    const first = inventory[0];
    if (!first || first.oclass === COIN_CLASS && inventory.length === 1) return;

    const suit = moveSeducedSuitLast(monster, context);
    let gold = monsterGold(monster);
    if (suit) await announceDisrobing(monster, !!gold, context);
    if (gold) unlinkMonsterObject(monster, gold);

    for (;;) {
        const object = (monster.minvent || monster.inventory || [])[0];
        if (!object) break;
        // Restore gold before any touch, artifact, or equipment effect can kill
        // either participant. Death and statues must retain the real inventory.
        if (gold) {
            await addObjectToMonsterInventory(monster, gold, state);
            gold = null;
        }
        if (!heroIsPolymorphed(state)) break;
        const wornMask = object.owornmask ?? 0;
        if (object.oartifact && !heroIsBlind(state)) findArtifact(object, { state });
        await removeObjectFromMonsterInventory(monster, object, state, { publish });
        if (state.program_state.gameover) return;
        if (object === suit) {
            const subject = monsterName(monster, { state, capitalized: true });
            const possessive = monsterPossessive(monster, { state });
            await publish(`${subject} finishes taking off ${possessive} suit.`);
        }
        const description = await inventoryItemDescription(object);
        const held = await holdAnotherObject(object, {
            state, publish, holdMessage: 'You steal: ',
            dropMessage: `You snatched but dropped ${description}.`,
        });
        if (held.heroDied) return;
        if (!held.object || held.object.where !== 'inventory') continue;
        if (await theftPetrifies(held.object, context)) break;

        if (wornMask & W_WEP) {
            await updateMonsterWeaponAfterPolymorph(monster, state, { publish });
        } else if (wornMask & W_ARMG) {
            const touch = await monsterSelfTouch(monster, {
                state, publish, creditHero: true,
                finishDeath: async (target, options) => finishHeroMonsterKillOutcome(
                    target, target.mx, target.my,
                    { ...options, showKillMessage: false, recordConduct: false, publish },
                ),
            });
            if (touch.heroDied || !touch.survived) break;
        }
        if (!suit) break;
        gold = monsterGold(monster);
        if (gold) unlinkMonsterObject(monster, gold);
    }
    if (gold) await addObjectToMonsterInventory(monster, gold, state);
}

function monsterGold(monster: Monster): GameObject | null {
    return (monster.minvent || monster.inventory || []).find(object => object.oclass === COIN_CLASS) ?? null;
}

function moveSeducedSuitLast(monster: Monster, { state, attack }: HeroNaturalEffectContext): GameObject | null {
    if (!monster.mcanmove || !heroSeductionCompatibility(monster, attack, state)) return null;
    const inventory = monster.minvent || monster.inventory || [];
    const suits = inventory.filter(object => (object.owornmask ?? 0) & W_ARM);
    if (suits.length > 1) throw new Error(`Monster ${monster.m_id} wears multiple suits`);
    const suit = suits[0];
    if (!suit) return null;
    inventory.splice(inventory.indexOf(suit), 1);
    inventory.push(suit);
    return suit;
}

async function announceDisrobing(monster: Monster, hasGold: boolean, { state, publish }: HeroNaturalEffectContext): Promise<void> {
    const neuter = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER);
    const sameGender = !neuter && !!monster.female === !!state.u.mfemale;
    const name = monsterName(monster, { state });
    const subject = monsterSubjectPronoun(monster, { state });
    const possessive = monsterPossessive(monster, { state });
    if (sameGender && MONSTER_SYMBOL[state.u.umonnum] === S_NYMPH) {
        const capitalized = subject.charAt(0).toUpperCase() + subject.slice(1);
        await publish(`You charm ${name}.  ${capitalized} gladly hands over ${hasGold ? 'most of ' : ''}${possessive} possessions.`);
    } else {
        await publish(`You seduce ${name} and ${subject} starts to take off ${possessive} clothes.`);
    }
}

async function theftPetrifies(object: GameObject, { state, publish }: HeroNaturalEffectContext): Promise<boolean> {
    if (state.uarmg || state.u.uarmg || object.otyp !== CORPSE
        || !touchPetrifies(object.corpsenm) || heroResistsStoning(state)) return false;
    await resolveImmediatePetrification({
        state, publish,
        killer: corpseName(object, { adjective: 'stolen', includeArticle: true }),
    });
    // Life saving does not resume this theft sequence.
    return true;
}
