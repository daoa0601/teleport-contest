// C mhitu.c:doseduce(), mayberem(), and uhitm.c:mhitm_ad_ssex().
import { removeHeroAccessory, wearHeroAccessory } from './accessory.js';
import { adjustHeroAlignment } from './alignment.js';
import { armorSimpleName, armorSlotFor, heroHasDrainResistance, stopDonning } from './armor.js';
import { adjustAttribute, currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHairName, heroHandName } from './body_parts.js';
import { heroHasInvoluntaryDelay } from './command_state.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, LARGEST_INT, M_ATTK_AGR_DONE, RLOC_MSG, Upolyd } from './const.js';
import { currency } from './currency.js';
import { canSeeMonster, type MessagePublisher } from './display.js';
import { gainExperienceLevel, loseHeroExperience } from './exper.js';
import type { PlayingGameState } from './game_state.js';
import { loseHeroHp } from './hero_damage.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { detachHeroGold, heroGoldAmount } from './hero_gold.js';
import { heroSpecies } from './hero_species.js';
import { heroIsUnaware } from './hero_sleep.js';
import { inventoryItemDescription } from './invent.js';
import type { HeroContactAttack } from './monster_action_types.js';
import { MONSTER_NAME } from './monster_data.js';
import { addObjectToMonsterInventory, linkObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName, monsterObjectPronoun, monsterSubjectPronoun } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { OBJECT_NAMES } from './object_data.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { observeObjectForNaming } from './objnam.js';
import { objectName, ownedObjectName, simpleObjectName } from './objnam.js';
import type { GameObject } from './object_types.js';
import { unlinkObject } from './object_location.js';
import { promptYesNo } from './query.js';
import type { rn2, rnd } from './rng.js';
import { seductionCompatibility } from './seduction_compatibility.js';
import { heroIsDeaf } from './senses.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { isWeldedPrimary } from './weapon_slots.js';

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
): Promise<void> {
    if (monster.mcan || seductionCompatibility(monster, 'hero',
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
    await publish(visible ? `You feel very attracted to ${monsterName(monster, { state })}.`
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
            if (state.datetime?.slice(4, 8) === '0229' && female) {
                const gloves = state.inventory.find(object => armorSlotFor(object.otyp) === 'uarmg');
                // The succubus reveals the gloves even when the hero is blind.
                if (gloves) observeObject(gloves, state);
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
            let name = objectName(ring, state);
            if (name.length + suffix.length + 6 >= 128) name = simpleObjectName(ring, state);
            if (name.length + suffix.length + 6 >= 128) name = 'ring';
            learnObjectType(RIN_ADORNMENT, state);
            if (await promptYesNo(`"That ${name}${suffix}`) === 'n') continue;
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
        await publish(`${ring.invlet || '?'} - ${inventoryItemDescription(ring)}.`);
    }
    return triedGloves;
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
            await publish('You feel drained of energy.');
            hero.uen = 0;
            hero.uenmax -= rollOne(hero.halfPhysicalDamage ? 5 : 10);
            await exerciseAttribute(A_CON, false, state);
            hero.uenmax = Math.max(0, hero.uenmax);
        } else if (outcome === 1 || outcome === 2) {
            await publish(outcome === 1 ? 'You are down in the dumps.' : 'Your senses are dulled.');
            const attribute = outcome === 1 ? A_CON : A_WIS;
            adjustAttribute(attribute, -1, state);
            await exerciseAttribute(attribute, false, state);
            state.context.botl = true;
        } else if (outcome === 3) {
            if (!heroHasDrainResistance(state)) {
                await publish('You feel out of shape.');
                await loseHeroExperience('overexertion', { state, publish });
            } else await publish('You have a curious feeling...');
            await exerciseAttribute(A_CON, false, state);
            await exerciseAttribute(A_DEX, false, state);
            await exerciseAttribute(A_WIS, false, state);
        } else {
            await publish('You feel exhausted.');
            await exerciseAttribute(A_STR, false, state);
            const damage = 6 + random(10);
            await loseHeroHp(hero.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, 'exhaustion', { state, publish });
        }
        return;
    }
    monster.mspec_used = rollOne(100);
    await publish(`You seem to have enjoyed it more than ${monsterName(monster, { state, article: 'your', suppressIt: true })}...`);
    const outcome = random(5);
    if (outcome === 0) {
        await publish('You feel raised to your full potential.');
        await exerciseAttribute(A_CON, true, state);
        hero.uenmax += rollOne(5);
        hero.uen = hero.uenmax;
        hero.uenpeak = Math.max(hero.uenpeak, hero.uenmax);
    } else if (outcome === 1 || outcome === 2) {
        await publish(outcome === 1 ? 'You feel good enough to do it again.'
            : `You will always remember ${monsterName(monster, { state, article: 'your', suppressIt: true })}...`);
        const attribute = outcome === 1 ? A_CON : A_WIS;
        adjustAttribute(attribute, 1, state);
        await exerciseAttribute(attribute, true, state);
        state.context.botl = true;
    } else if (outcome === 3) {
        await publish('That was a very educational experience.');
        await gainExperienceLevel({ state, publish });
        await exerciseAttribute(A_WIS, true, state);
    } else {
        await publish('You feel restored to health!');
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
