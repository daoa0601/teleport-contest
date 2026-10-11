// Hero-versus-monster engulfing and delayed digestion.
// C uhitm.c:gulpum()/start_engulf()/end_engulf(), eat.c:Finish_digestion().
import {
    A_CON, DIED, DOOR, D_CLOSED, D_LOCKED, G_NOCORPSE, IRONBARS,
    IS_OBSTRUCTED, IS_TREE, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import { heroStomachName } from './body_parts.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { applyCorpsePostEffects } from './corpse_eating.js';
import {
    canSpotMonster, flush_screen, map_invisible, map_location, newsym,
    plineWithContinuation, show_glyph_cell, transientMonsterGlyph,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { eatingConducts } from './food_conduct.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroPassesWalls, heroSpecies } from './hero_species.js';
import { updateHeroHunger } from './hunger.js';
import { applyMonsterGolemEffects } from './mon.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import {
    AD_ACID, AD_BLND, AD_COLD, AD_DGST, AD_DREN, AD_ELEC, AD_FIRE, AD_PHYS,
} from './monster_attack_types.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SIZE,
    monsterDigests, monsterEnfolds, monsterIsAnimal, monsterIsRider,
    monsterIsVampireShifter, monsterIsWhirly, monsterTypeName, requireMonsterData,
} from './monster_data.js';
import { resolveMonsterCorpseChance } from './monster_death.js';
import { drainMonsterEnergy } from './monster_energy.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import { snuffMonsterInventoryLights } from './monster_inventory_light.js';
import { monsterName, namelessMonsterName, possessiveName } from './monster_name.js';
import { changeMonsterForm } from './monster_polymorph.js';
import {
    monsterHasAcidResistance, monsterHasColdResistance,
    monsterHasFireResistance, monsterHasShockResistance,
} from './monster_resistance.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { heroIsUnchanging } from './polyself.js';
import { d, rn2 } from './rng.js';
import { heroIsFlaming, setHeroSlimingTimeout } from './slime.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { cansee } from './vision.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import type { AttackTuple } from './monster_action_types.js';
import type { Monster } from './monster_types.js';
import type { MapLocation } from './map_types.js';

interface HeroCombatEngulfOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
}

export interface HeroCombatEngulfResult {
    nativeResult: number;
    heroDied: boolean;
}

const M1_WALLWALK = 0x08;
const M1_AMPHIBIOUS = 0x200;
const M1_BREATHLESS = 0x400;
const M1_NOEYES = 0x1000;
const M2_PNAME = 0x80000;
const MZ_HUGE = 4;
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const FLAMING_SPECIES = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander']
    .map(name => MONSTER_NAME.indexOf(name)));

export async function resolveHeroCombatEngulf(defender: Monster, attack: AttackTuple, {
    state = game, publish = plineWithContinuation, random = rn2, rollDice = d,
}: HeroCombatEngulfOptions = {}): Promise<HeroCombatEngulfResult> {
    requirePlayingGame(state);
    const [, damageType, dice, sides] = attack;
    let damage = rollDice(dice, sides);
    const species = defender.mnum;
    const heroBody = { mnum: heroSpecies(state) };
    const digests = monsterDigests(heroBody);
    const enfolds = monsterEnfolds(heroBody);
    const expel = digests ? 'regurgitate' : enfolds ? 'release' : 'expel';
    if (!heroCanEngulf(defender, state)
        || (digests && state.u.uhunger >= 1500) || state.u.uswallow)
        return { nativeResult: M_ATTK_MISS, heroDied: false };

    if (!heroIsFlaming(state)) await snuffMonsterInventoryLights(defender, state, publish);
    if (monsterIsVampireShifter(defender)) {
        const change = await changeMonsterForm(defender, defender.cham, state, { publish });
        if (change?.heroDied) return { nativeResult: M_ATTK_MISS, heroDied: true };
        if (change) {
            await publish(`You ${digests ? 'swallow' : enfolds ? 'enclose' : 'engulf'} it, then ${expel} it.`);
            if (canSpotMonster(defender)) {
                await publish(`It turns into ${namelessMonsterName(defender, {
                    state, article: 'a', suppressIt: true, suppressInvisible: true,
                })}.`);
            } else map_invisible(defender.mx, defender.my);
            return { nativeResult: M_ATTK_HIT, heroDied: false };
        }
    }

    const rider = monsterIsRider({ mnum: species });
    const fatal = (touchPetrifies(species) && !heroResistsStoning(state))
        || (damageType === AD_DGST && (rider || (species === PM_MEDUSA && !heroResistsStoning(state))));
    if (damageType === AD_DGST && (!state.u.slowDigestion || fatal))
        await eatingConducts(species, { state });
    if (fatal && !rider) {
        await publish(`You ${digests ? 'englut' : 'engulf'} ${monsterName(defender, { state })}.`);
        const rawName = monsterTypeName(species, !!defender.female);
        const name = (requireMonsterData(MONSTER_FLAGS2, species) & M2_PNAME)
            ? rawName : withIndefiniteArticle(rawName);
        const death = await resolveImmediatePetrification({ state, publish,
            killer: `${digests ? 'swallowing' : enfolds ? 'enclosing' : 'engulfing'} ${name}${digests ? ' whole' : ''}` });
        return { nativeResult: M_ATTK_MISS, heroDied: death.died };
    }

    const display = await startHeroEngulfDisplay(defender, state, publish);
    if (damageType === AD_DGST && rider) {
        await publish('Unfortunately, digesting any of it is fatal.');
        endHeroEngulfDisplay(display, state);
        const cause = `unwisely tried to eat ${monsterTypeName(species, !!defender.female)}`;
        const died = await finishHeroDeath({ killer: cause, deathCause: cause, deathType: DIED });
        return { nativeResult: M_ATTK_MISS, heroDied: died };
    }
    if (damageType === AD_DGST && !state.u.slowDigestion) {
        try {
            return await digestDefender(defender, species, state, { publish, random, rollDice });
        } finally {
            endHeroEngulfDisplay(display, state);
        }
    }

    try {
        damage = await engulfDamage(defender, damageType, damage, state, { publish, random, rollDice });
    } finally {
        endHeroEngulfDisplay(display, state);
    }
    defender.mhp -= damage;
    if (defender.mhp <= 0) {
        const death = await finishHeroMonsterKillOutcome(defender, defender.mx, defender.my, { publish });
        if (death.heroDied) return { nativeResult: death.killed ? M_ATTK_DEF_DIED : M_ATTK_MISS, heroDied: true };
        if (death.killed) return { nativeResult: M_ATTK_DEF_DIED, heroDied: false };
    }
    await publish(`You ${expel} ${monsterName(defender, { state })}!`);
    if (digests && (state.u.slowDigestion || monsterIsAnimal(heroBody)))
        await publish(`Obviously, you didn't like ${possessiveName(monsterName(defender, { state }))} taste.`);
    return { nativeResult: M_ATTK_MISS, heroDied: false };
}

function heroCanEngulf(defender: Monster, state: PlayingGameState): boolean {
    const hero = heroSpecies(state);
    const size = requireMonsterData(MONSTER_SIZE, defender.mnum);
    if (size >= MZ_HUGE || (requireMonsterData(MONSTER_SIZE, hero) < size
        && !monsterIsWhirly({ mnum: hero })) || defender.mtrapped) return false;
    if (!(requireMonsterData(MONSTER_FLAGS1, defender.mnum) & M1_WALLWALK)
        && engulfSquareBlocked(state.level.at(defender.mx, defender.my), hero)) return false;
    return heroPassesWalls(state)
        || !engulfSquareBlocked(state.level.at(state.u.ux, state.u.uy), defender.mnum);
}

function engulfSquareBlocked(square: MapLocation | null, otherSpecies: number): boolean {
    return !square || IS_OBSTRUCTED(square.typ) || IS_TREE(square.typ)
        || (square.typ === DOOR && !!(square.doormask & (D_CLOSED | D_LOCKED)))
        || (square.typ === IRONBARS && !monsterIsWhirly({ mnum: otherSpecies }));
}

async function digestDefender(defender: Monster, species: number, state: PlayingGameState, {
    publish, random, rollDice,
}: Required<Pick<HeroCombatEngulfOptions, 'publish' | 'random' | 'rollDice'>>): Promise<HeroCombatEngulfResult> {
    const amulet = wornMonsterLifeSaver(defender);
    if (amulet) await destroyObjectFromMonsterInventory(defender, amulet, state, { silently: true, publish });
    await updateHeroHunger(false, { state });
    if (state.program_state.gameover) return { nativeResult: M_ATTK_MISS, heroDied: true };
    const previous = state._monsterSwallower;
    state._monsterSwallower = { kind: 'hero' };
    try {
        const death = await finishHeroMonsterKillOutcome(defender, defender.mx, defender.my, { noCorpse: true, publish });
        if (death.heroDied) return { nativeResult: M_ATTK_DEF_DIED, heroDied: true };
        if (!death.killed) {
            await publish(`You hurriedly regurgitate the sizzling in your ${heroStomachName(state)}.`);
            return { nativeResult: M_ATTK_DEF_DIED, heroDied: false };
        }
        const [weight, nutrition] = requireMonsterData(MONSTER_BODY_META, species);
        const corpse = await resolveMonsterCorpseChance(defender, { state, random, rollDice, publish });
        if (corpse.heroDied) return { nativeResult: M_ATTK_DEF_DIED, heroDied: true };
        const nutritious = corpse.leavesRemains && !((state.mvitals?.[species]?.mvflags ?? 0) & G_NOCORPSE);
        let delay = nutritious ? 1 + (weight >> 8) : 0;
        if (nutritious) state.u.uhunger += Math.trunc((nutrition + 1) / 2);
        const doneMessage = `You totally digest ${monsterName(defender, { state })}.`;
        if (delay) {
            await publish(`You digest ${monsterName(defender, { state })}.`);
            if (state.u.slowDigestion) delay *= 2;
            endVoluntaryMultiTurn(state);
            state._helplessTurns = Math.max(state._helplessTurns ?? 0, delay);
            state._helplessReason = 'digesting something';
            state._helplessDoneMessage = doneMessage;
            state._digestedMonsterSpecies = species;
            state._helplessAfter = 'finish-digestion';
        } else await publish(doneMessage);
        if (species === PM_GREEN_SLIME) {
            if (delay) state._helplessDoneMessage = `The ${monsterTypeName(species, !!defender.female)} isn't sitting well with you.`;
            if (!heroIsUnchanging(state)) await setHeroSlimingTimeout(5, { state, publish });
        } else await exerciseAttribute(A_CON, true, state);
        return { nativeResult: M_ATTK_DEF_DIED, heroDied: false };
    } finally {
        state._monsterSwallower = previous;
    }
}

export async function finishHeroDigestion(state: GameState = game): Promise<void> {
    const species = state._digestedMonsterSpecies;
    if (species === undefined || species === null) return;
    await applyCorpsePostEffects(species, { state });
    state._digestedMonsterSpecies = null;
}

async function engulfDamage(defender: Monster, type: AttackTuple[1], damage: number, state: PlayingGameState, {
    publish, random, rollDice,
}: Required<Pick<HeroCombatEngulfOptions, 'publish' | 'random' | 'rollDice'>>): Promise<number> {
    const name = () => monsterName(defender, { state, capitalized: true });
    // Native gulpum leaves other damage types as the original physical roll.
    if (type !== AD_DGST && type !== AD_PHYS && type !== AD_ACID && type !== AD_BLND
        && type !== AD_ELEC && type !== AD_COLD && type !== AD_FIRE && type !== AD_DREN)
        return damage;
    switch (type) {
    case AD_DGST: return 0;
    case AD_PHYS:
        if (heroSpecies(state) === PM_FOG_CLOUD) {
            await publish(`${name()} is laden with your moisture.`);
            if ((requireMonsterData(MONSTER_FLAGS1, defender.mnum) & (M1_BREATHLESS | M1_AMPHIBIOUS))
                && !FLAMING_SPECIES.has(defender.mnum)) {
                await publish(`${name()} seems unharmed.`);
                return 0;
            }
        } else await publish(`${name()} is ${monsterEnfolds({ mnum: heroSpecies(state) })
            ? 'being squashed' : 'pummeled with your debris'}!`);
        break;
    case AD_ACID:
        await publish(`${name()} is covered with your goo!`);
        if (monsterHasAcidResistance(defender)) {
            await publish(`It seems harmless to ${monsterName(defender, { state })}.`);
            return 0;
        }
        break;
    case AD_BLND:
        if (!(requireMonsterData(MONSTER_FLAGS1, defender.mnum) & M1_NOEYES)
            && (defender.mcansee || defender.mblinded) && !defender.msleeping) {
            if (defender.mcansee) await publish(`${name()} can't see in there!`);
            defender.mcansee = 0;
            defender.mblinded = Math.min(127, damage + (defender.mblinded ?? 0));
        }
        return 0;
    case AD_ELEC:
    case AD_COLD:
    case AD_FIRE:
        if (!random(2)) return 0;
        if (type === AD_ELEC) {
            await publish(`The air around ${monsterName(defender, { state })} crackles with electricity.`);
            if (monsterHasShockResistance(defender)) {
                await publish(`${name()} seems unhurt.`);
                damage = 0;
            }
        } else {
            const resists = type === AD_COLD ? monsterHasColdResistance(defender) : monsterHasFireResistance(defender);
            await publish(resists ? `${name()} seems mildly ${type === AD_COLD ? 'chilly' : 'hot'}.`
                : `${name()} is ${type === AD_COLD ? 'freezing to death' : 'burning to a crisp'}!`);
            if (resists) damage = 0;
        }
        await applyMonsterGolemEffects(defender, type, damage, { state, publish });
        break;
    case AD_DREN:
        if (!random(4)) await drainMonsterEnergy(defender, { state, publish, rollDice });
        return 0;
    }
    return damage;
}

interface EngulfDisplay { x: number; y: number; }

async function startHeroEngulfDisplay(defender: Monster, state: PlayingGameState, publish: MessagePublisher): Promise<EngulfDisplay> {
    const heroBody = { mnum: heroSpecies(state) };
    const digest = monsterDigests(heroBody);
    if (!heroIsInvisible(state)) {
        map_location(state.u.ux, state.u.uy, true);
        const glyph = transientMonsterGlyph(heroBody);
        show_glyph_cell(defender.mx, defender.my, glyph.ch, glyph.color, false, 0, glyph);
    }
    await publish(`You ${digest ? 'swallow' : monsterEnfolds(heroBody) ? 'enclose' : 'engulf'} ${monsterName(defender, { state })}${digest ? ' whole' : ''}!`);
    await flush_screen(1);
    await state.animationFrame?.();
    await state.animationFrame?.();
    return { x: defender.mx, y: defender.my };
}

function endHeroEngulfDisplay(display: EngulfDisplay, state: PlayingGameState): void {
    if (heroIsInvisible(state)) return;
    newsym(display.x, display.y);
    newsym(state.u.ux, state.u.uy);
}

