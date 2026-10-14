// Artifact powers used by the #invoke command.
// C ref: artifact.c arti_invoke() and its invoke_* helpers.

import type { Artifact } from './artifacts.js';
import type { ArtifactPower } from './data_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import type { PropertyName } from './property_types.js';
import type { UntrapOptions } from './untrap.js';
import { heroIsHallucinating } from './senses.js';
import { I_SPECIAL, P_EXPERT, TIMEOUT, Upolyd, W_ARTI } from './const.js';
import { newsym, pline } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { hasNonArtifactConflict, syncHeroConflict } from './hero_conflict.js';
import {
    hasNonArtifactInvisibility,
    invisibilityIsBlocked,
    syncHeroInvisibility,
} from './hero_invisibility.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { showEnlightenment } from './insight.js';
import { mksobj } from './mklev.js';
import { ARROW, SPE_CONE_OF_COLD, SPE_FIREBALL } from './object_data.js';
import {
    captureLevitationState,
    hasInvokedProperty,
    propertyHasOtherSources,
    refreshProperty,
    setInvokedProperty,
} from './properties.js';
import { floatHeroDown, floatHeroUp } from './terrain_movement.js';
import { applyHeroLocationEffects } from './cmd.js';
import { d, rnd, rnz } from './rng.js';
import { heroIsBlind, setHeroBlindnessTurns } from './senses.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { addInventoryItem } from './u_init.js';
import { untrap } from './untrap.js';
import { objectWeight } from './weight.js';
import { chooseObjectToCharge, rechargeObject } from './recharge.js';
import { doBlindingRay } from './flash.js';
import { heroSpecies } from './hero_species.js';
import { lightDamage, lightRoom } from './light.js';
import { MONSTER_NAME } from './monster_data.js';
import { objectName, objectNameIsPlural } from './objnam.js';
import { flashBurn } from './sight_change.js';
import { promptDirection } from './tty_prompts.js';
import { castSpell } from './spell.js';
import { spellSkillType } from './spell_casting_rules.js';
import { ensureHeroSkills } from './skills.js';

type PropertyPowerName = 'conflict' | 'invisibility' | 'levitation';
type PropertyArtifact = Artifact & { invokePower: PropertyPowerName };

interface InvokedPropertyPower {
    property: PropertyName;
    hasOtherSource: (state: GameState) => boolean;
    sync: (state: GameState) => void;
}

type PropertyInvocationResult =
    | { used: true; ready: false; on: false }
    | { used: true; ready: true; on: boolean };

export type ArtifactInvocationResult =
    | PropertyInvocationResult
    | { used: false }
    | { used: true; ready: false }
    | { used: true; ready: true; spentTime?: boolean }
    | { used: true; heroDied: true };

interface ArtifactInvocationOptions {
    state?: GameState;
    publish?: MessagePublisher;
    rollDice?: (count: number, sides: number) => number;
    rollOne?: (limit: number) => number;
    scaledRandom?: (range: number) => number;
    enterTrap?: UntrapOptions['enterTrap'];
}

const DIRECT_POWERS = [
    'healing',
    'energy-boost',
    'enlightening',
    'create-ammo',
    'untrap',
    'charge-object',
    'blinding-ray',
    'snowstorm',
    'firestorm',
] as const;

function isDirectPower(power: ArtifactPower | null): power is (typeof DIRECT_POWERS)[number] {
    return DIRECT_POWERS.some((candidate) => candidate === power);
}

// C do_wear.c-style extrinsic check: an invoked artifact is nothing special
// while an independent intrinsic (including the potion timeout), worn ring,
// or boots source also grants levitation (artifact.c:2197-2201).
function hasNonArtifactLevitation(state: GameState): boolean {
    return propertyHasOtherSources('levitation', state);
}

function syncHeroLevitation(state: GameState): void {
    refreshProperty('levitation', state);
}

const PROPERTY_POWERS = Object.freeze({
    conflict: {
        property: 'conflict',
        hasOtherSource: hasNonArtifactConflict,
        sync: syncHeroConflict,
    },
    invisibility: {
        property: 'invisible',
        hasOtherSource: hasNonArtifactInvisibility,
        sync: syncHeroInvisibility,
    },
    levitation: {
        property: 'levitation',
        hasOtherSource: hasNonArtifactLevitation,
        sync: syncHeroLevitation,
    },
} satisfies Record<PropertyPowerName, InvokedPropertyPower>);

function isPropertyArtifact(artifact: Artifact | null | undefined): artifact is PropertyArtifact {
    const power = artifact?.invokePower;
    return power === 'conflict' || power === 'invisibility' || power === 'levitation';
}

export function artifactInvokeIsActive(
    artifact: Artifact | null | undefined,
    state: GameState = game,
): boolean {
    return (
        isPropertyArtifact(artifact) &&
        hasInvokedProperty(PROPERTY_POWERS[artifact.invokePower].property, state)
    );
}

async function nothingSpecial(
    object: GameObject,
    state: GameState,
    publish: MessagePublisher,
): Promise<void> {
    if ((state.inventory || []).includes(object)) {
        await publish('You feel a surge of power, but nothing seems to happen.');
    }
}

async function beginInvocation(
    object: GameObject,
    artifact: Artifact,
    state: GameState,
    publish: MessagePublisher,
    rollDice: (count: number, sides: number) => number,
    scaledRandom: (range: number) => number,
): Promise<boolean> {
    requirePlayingGame(state);
    const turn = state.moves ?? 0;
    if ((object.age ?? 0) > turn) {
        const energyCost = artifact.invokePower === 'blinding-ray'
            || artifact.invokePower === 'fling-poison' ? 25 : -1;
        if (energyCost < 0 || state.u.uen < energyCost) {
            await ignoringHero(object, state, publish);
            object.age += rollDice(3, 10);
            return false;
        }
        await publish('You feel drained...');
        state.u.uen -= energyCost;
        state.context.botl = true;
    } else {
        object.age = turn + scaledRandom(100);
    }
    return true;
}

async function ignoringHero(object: GameObject, state: GameState, publish: MessagePublisher) {
    const name = objectName(object, state).replace(/^The /, 'the ');
    const subject = /^[A-Z]/.test(name) || name.startsWith('the ') ? name : `the ${name}`;
    await publish(`You feel that ${subject} ${objectNameIsPlural(object, state) ? 'are' : 'is'} ignoring you.`);
}

async function invokeProperty(
    object: GameObject,
    artifact: PropertyArtifact,
    state: GameState,
    publish: MessagePublisher,
    rollDice: (count: number, sides: number) => number,
    scaledRandom: (range: number) => number,
): Promise<PropertyInvocationResult> {
    // Artifact property toggles mutate the invoked source and the object's
    // invoke cooldown, then run the live float owners.
    requireLiveGame(state);
    const power = PROPERTY_POWERS[artifact.invokePower];
    const turn = state.moves ?? 0;
    const on = !hasInvokedProperty(power.property, state);
    // C toggles the artifact's extrinsic bit before every check (artifact.c
    // 2179).  Capture the levitation masks first so the shared float owners
    // can still report the pre-toggle flying and blocked state.
    const previous = power.property === 'levitation' ? captureLevitationState(state) : null;
    setInvokedProperty(power.property, object, on, state);

    if (on && (object.age ?? 0) > turn) {
        setInvokedProperty(power.property, object, false, state);
        power.sync(state);
        await ignoringHero(object, state, publish);
        object.age += rollDice(3, 10);
        return { used: true, ready: false, on: false };
    }
    if (!on) object.age = turn + scaledRandom(100);

    const hasOtherSource = power.hasOtherSource(state);
    power.sync(state);
    if (hasOtherSource) {
        await nothingSpecial(object, state, publish);
        return { used: true, ready: true, on };
    }

    if (artifact.invokePower === 'conflict') {
        await publish(
            on ? 'You feel like a rabble-rouser.' : 'You feel the tension decrease around you.',
        );
        return { used: true, ready: true, on };
    }

    if (artifact.invokePower === 'levitation') {
        // artifact.c:2209-2215.  Unlike Ring_on(), this spoteffects() call
        // is unconditional; the other-source guard above already ensured no
        // independent levitation keeps the hero aloft.
        if (on) {
            await floatHeroUp(state, previous);
            await applyHeroLocationEffects(publish, { pick: false });
        } else {
            await floatHeroDown(I_SPECIAL | TIMEOUT, W_ARTI, state, previous);
        }
        return { used: true, ready: true, on };
    }

    if (invisibilityIsBlocked(state) || heroIsBlind(state)) {
        await nothingSpecial(object, state, publish);
        return { used: true, ready: true, on };
    }
    newsym(state.u.ux, state.u.uy);
    if (on) {
        const transparency = heroIsHallucinating(state) ? 'normal' : 'strange';
        await publish(`Your body takes on a ${transparency} transparency...`);
    } else {
        await publish('Your body seems to unfade...');
    }
    return { used: true, ready: true, on };
}

async function invokeHealing(
    object: GameObject,
    state: GameState,
    publish: MessagePublisher,
): Promise<void> {
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const hitPoints = polymorphed ? 'mh' : 'uhp';
    const maximumHitPoints = polymorphed ? 'mhmax' : 'uhpmax';
    const current = hero[hitPoints] ?? 0;
    const maximum = hero[maximumHitPoints] ?? current;
    const healing = Math.trunc((maximum + 1 - current) / 2);
    const cream = hero.ucreamed ?? 0;
    const curesBlindness = (hero.blindTurns ?? 0) > cream;
    const helps = healing > 0 || heroIsSick(state) || heroIsSliming(state) || curesBlindness;

    if (!helps) {
        await nothingSpecial(object, state, publish);
        return;
    }
    await publish('You feel better.');
    if (healing > 0) hero[hitPoints] = current + healing;
    cureHeroSickness(state);
    clearHeroSliming(state);
    if (curesBlindness) setHeroBlindnessTurns(cream, state);
    state.context.botl = true;
}

async function invokeEnergyBoost(
    object: GameObject,
    state: GameState,
    publish: MessagePublisher,
): Promise<void> {
    const hero = state.u;
    const missing = Math.max(0, (hero.uenmax ?? 0) - (hero.uen ?? 0));
    let restored = Math.trunc((missing + 1) / 2);
    if (restored > 120) restored = 120;
    else if (restored < 12) restored = missing;

    if (!restored) {
        await nothingSpecial(object, state, publish);
        return;
    }
    hero.uen = (hero.uen ?? 0) + restored;
    state.context.botl = true;
    await publish('You feel re-energized.');
}

async function invokeCreateAmmo(
    object: GameObject,
    rollOne: (limit: number) => number,
): Promise<GameObject> {
    const arrows = await mksobj(ARROW, true, false);
    arrows.blessed = !!object.blessed;
    arrows.cursed = !!object.cursed;
    arrows.bknown = !!object.bknown;
    arrows.oeroded = 0;
    arrows.oeroded2 = 0;
    if (object.blessed) {
        if (arrows.spe < 0) arrows.spe = 0;
        arrows.quan += rollOne(10);
    } else if (object.cursed) {
        if (arrows.spe > 0) arrows.spe = 0;
    } else {
        arrows.quan += rollOne(5);
    }
    arrows.quantity = arrows.quan;
    arrows.owt = objectWeight(arrows);
    return await addInventoryItem(arrows);
}

async function invokeBlindingRay(object: GameObject, state: GameState, publish: MessagePublisher) {
    requireLiveGame(state);
    const direction = await promptDirection();
    if (!direction) {
        await publish('Never mind.');
        object.age = state.moves;
        return false;
    }
    if (direction.dx || direction.dy) {
        await doBlindingRay(object, direction, { state });
    } else if (direction.dz) {
        await lightRoom(true, { radius: 0, source: object });
        const spot = state.level?.at(state.u.ux, state.u.uy);
        await publish(!heroIsBlind(state) && spot?.lit && !spot.waslit
            ? 'It is lit here now.' : 'Nothing seems to happen.');
    } else {
        const vulnerable = heroSpecies(state) === MONSTER_NAME.indexOf('gremlin');
        const damage = object.blessed ? 15 : object.cursed ? 5 : 10;
        if (vulnerable) await lightDamage(object, true, 2 * damage, { state });
        if (!state.program_state.gameover
            && !await flashBurn(damage + rnd(damage), false, { state, publish }) && !vulnerable)
            await publish('Nothing seems to happen.');
    }
    return true;
}

async function invokeStorm(power: 'snowstorm' | 'firestorm', state: GameState) {
    const spell = power === 'snowstorm' ? SPE_CONE_OF_COLD : SPE_FIREBALL;
    const skill = ensureHeroSkills(state)?.[spellSkillType(spell)];
    if (!skill) throw new Error('Artifact storm requires initialized spell skills');
    const previous = skill.skill;
    skill.skill = P_EXPERT;
    try {
        await castSpell(spell, { force: true, state });
    } finally {
        skill.skill = previous;
    }
}

export async function invokeArtifactPower(
    object: GameObject,
    artifact: Artifact | null | undefined,
    {
        state = game,
        publish = pline,
        rollDice = d,
        rollOne = rnd,
        scaledRandom = rnz,
        enterTrap = null,
    }: ArtifactInvocationOptions = {},
): Promise<ArtifactInvocationResult> {
    if (!artifact) return { used: false };
    if (isPropertyArtifact(artifact)) {
        return invokeProperty(object, artifact, state, publish, rollDice, scaledRandom);
    }
    const power = artifact.invokePower;
    if (!isDirectPower(power)) return { used: false };
    const ready = await beginInvocation(object, artifact, state, publish, rollDice, scaledRandom);
    if (!ready) return { used: true, ready: false };

    switch (power) {
        case 'snowstorm':
        case 'firestorm':
            await invokeStorm(power, state);
            if (state.program_state.gameover) return { used: true, heroDied: true };
            break;
        case 'blinding-ray': {
            const spentTime = await invokeBlindingRay(object, state, publish);
            if (state.program_state.gameover) return { used: true, heroDied: true };
            return { used: true, ready: true, spentTime };
        }
        case 'charge-object': {
            const target = await chooseObjectToCharge(state);
            if (!target) {
                object.age = 0;
                return { used: true, ready: true, spentTime: false };
            }
            const heroRole = state.urole;
            if (object.blessed && artifact.role && !heroRole)
                throw new Error('Artifact recharging requires a chosen hero role');
            const blessedEffect =
                object.blessed && (!artifact.role || artifact.role === heroRole?.key);
            const charged = await rechargeObject(
                target,
                blessedEffect ? 1 : object.cursed ? -1 : 0,
                state,
            );
            if (charged.heroDied) return { used: true, heroDied: true };
            break;
        }
        case 'healing':
            await invokeHealing(object, state, publish);
            break;
        case 'energy-boost':
            await invokeEnergyBoost(object, state, publish);
            break;
        case 'enlightening':
            await showEnlightenment({ basic: false, magic: true });
            break;
        case 'create-ammo':
            await invokeCreateAmmo(object, rollOne);
            break;
        case 'untrap': {
            const spentTime = await untrap({
                state,
                force: true,
                enterTrap,
                publish,
            });
            if (state.program_state.gameover) return { used: true, heroDied: true };
            if (!spentTime) object.age = 0;
            return { used: true, ready: true, spentTime };
        }
    }
    return { used: true, ready: true };
}

export async function deactivateArtifactProperty(
    object: GameObject,
    artifact: Artifact | null | undefined,
    {
        state = game,
        publish = pline,
        rollDice = d,
        scaledRandom = rnz,
    }: Pick<ArtifactInvocationOptions, 'state' | 'publish' | 'rollDice' | 'scaledRandom'> = {},
): Promise<boolean> {
    if (!isPropertyArtifact(artifact) || !artifactInvokeIsActive(artifact, state)) return false;
    await invokeProperty(object, artifact, state, publish, rollDice, scaledRandom);
    return true;
}
