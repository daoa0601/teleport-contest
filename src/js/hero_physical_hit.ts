// Native uhitm.c:hmon(). Callers own accuracy, flight, turns, and passives.
import { applyArtifactHit } from './artifact_hit.js';
import { artifactById, artifactEmitsLight } from './artifacts.js';
import { barehandSkill, prepareHeroBarehandContact } from './barehand_combat.js';
import { confuseTouchedMonster } from './confusing_touch.js';
import { P_LANCE, Upolyd } from './const.js';
import { isZombieMaker } from './corpse_species.js';
import { plineWithContinuation } from './display.js';
import { abusePetAfterHeroHit } from './dog.js';
import { game, requirePlayingGame } from './gstate.js';
import { recordFirstHeroWeaponHit } from './hero_attack_conduct.js';
import { finishHeroHitAftermath, shouldAngerGuardsAfterHeroHit } from './hero_hit_aftermath.js';
import { finishHeroLiquidMonsterDeath, finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { resolveHeroObjectContact } from './hero_object_contact.js';
import { recalculateHeroPhysicalDamage } from './hero_physical_damage.js';
import {
    captureHeroPhysicalObjectName, captureUnpoisonedPhysicalObjectName,
    showHeroHarmlessStoneHit, showHeroPhysicalHit, showHeroPhysicalLight,
    showHeroPhysicalPoisonWoreOff, showHeroPhysicalSilver, showHeroShadeMiss,
} from './hero_physical_messages.js';
import { heroSpecies } from './hero_species.js';
import { prepareHeroWeaponContact } from './hero_weapon_contact.js';
import { resolveHeroJoust, rollHeroJoust, tryHeroPuddingSplit } from './hero_weapon_impact.js';
import { resolveHeroWeaponPoison } from './hero_weapon_poison.js';
import { tryKnockback } from './knockback.js';
import { wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_SYMBOL, monsterHatesLight,
    monsterHatesSilver, monsterIsShade, monsterIsUnsolid, requireMonsterData,
} from './monster_data.js';
import { tryUnarmedStagger } from './monster_hurtle.js';
import { monsterName } from './monster_name.js';
import { ELVEN_ARROW, ELVEN_BOW, OBJECT_SUBTYPE, YA, YUMI } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { isLauncherAmmunition, isMissileObject, isWeaponTool, launcherMatchesAmmo } from './object_properties.js';
import { heroIsBlind } from './senses.js';
import { dryTowel } from './towel.js';
import { cansee } from './vision.js';
import { isPolearm } from './weapon_type.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import type { FinishHeroMonsterDeath } from './hero_monster_death.js';
import type { HeroPhysicalHitOptions, HeroPhysicalHitResult } from './hero_physical_types.js';
import type { Position } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

interface ActivePhysicalHit extends Omit<HeroPhysicalHitOptions, 'state' | 'publish' | 'finishMonsterDeath' | 'twoHits' | 'target'> {
    state: PlayingGameState;
    publish: MessagePublisher;
    finishMonsterDeath: FinishHeroMonsterDeath;
    twoHits: number;
    target: Position;
}

interface PhysicalStrike {
    object: GameObject | null;
    damage: number;
    useWeaponSkill: boolean;
    trainWeaponSkill: boolean;
    getDamageBonus: boolean;
    hitTextShown: boolean;
    dryTowel: boolean;
    silverContact: boolean;
    silverObject: boolean;
    silverRings: number;
    lightContact: boolean;
    originalSpecies: number;
    material: number;
    savedObjectName: string;
    joust: -1 | 0 | 1;
    canUseWeaponPoison: boolean;
}

type PhysicalBodyResult = Pick<HeroPhysicalHitResult, 'survived' | 'heroDied'>;
type PreparedContact = { kind: 'strike'; strike: PhysicalStrike }
    | { kind: 'finished'; outcome: PhysicalBodyResult };

const SILVER = 14;
const GEMSTONE = 20;
const MINERAL = 21;
const RING_CLASS = 4;
const M1_WALLWALK = 0x00000008;
const S_TROLL = 46;

export async function hitMonsterWithHeroObject(
    monster: Monster, object: GameObject | null, options: HeroPhysicalHitOptions,
): Promise<HeroPhysicalHitResult> {
    const state = options.state ?? game;
    requirePlayingGame(state);
    const publish = options.publish ?? plineWithContinuation;
    const context: ActivePhysicalHit = {
        ...options, state, publish,
        target: options.target ?? { x: monster.mx, y: monster.my },
        twoHits: options.mode === 'melee' ? options.twoHits ?? 0 : 0,
        finishMonsterDeath: options.finishMonsterDeath
            ?? ((victim, death) => finishHeroMonsterKillOutcome(victim, victim.mx, victim.my, { ...death, publish })),
    };
    const angerGuards = shouldAngerGuardsAfterHeroHit(monster);
    const body = await resolvePhysicalHit(monster, object, context);
    const aftermath = body.heroDied ? body
        : await finishHeroHitAftermath(monster, { angerGuards, state, publish });
    return {
        survived: body.survived, heroDied: aftermath.heroDied,
        objectConsumed: object?.where === 'gone' || object?.where === 'onbill',
    };
}

async function resolvePhysicalHit(
    monster: Monster, originalObject: GameObject | null, context: ActivePhysicalHit,
): Promise<PhysicalBodyResult> {
    const { state, mode, publish, finishMonsterDeath } = context;
    const handToHand = mode === 'melee'
        || (mode === 'applied' && isPolearm(state.uwep || state.u.uwep));
    const unarmed = !(state.uwep || state.u.uwep || state.uarm || state.u.uarm || state.uarms || state.u.uarms);
    const prepared = await preparePhysicalContact(monster, originalObject, context);
    if (prepared.kind === 'finished') return prepared.outcome;
    const strike = prepared.strike;
    if (strike.damage > 0) strike.damage = await recalculateHeroPhysicalDamage(strike.damage, strike.object, {
        ...context, getDamageBonus: strike.getDamageBonus,
        useWeaponSkill: strike.useWeaponSkill, trainWeaponSkill: strike.trainWeaponSkill,
    });
    const poison = strike.canUseWeaponPoison && strike.object
        ? await resolveHeroWeaponPoison(monster, strike.object, { ...context }) : null;
    if (poison) strike.damage += poison.damage;
    if (strike.damage < 1) {
        const shade = monsterIsShade(monster);
        strike.damage = strike.getDamageBonus && !shade ? 1 : 0;
        if (shade && !strike.hitTextShown && mode !== 'thrown' && mode !== 'kicked')
            strike.hitTextShown = await showHeroShadeMiss(monster, strike.object, { state, publish });
    }

    let alreadyKilled = false;
    let maybeKnockback = false;
    if (strike.joust && strike.object) {
        const impact = await resolveHeroJoust(monster, strike.object, {
            damage: strike.damage, joust: strike.joust, state, publish,
        });
        if (impact.heroDied) return { survived: monster.mhp > 0, heroDied: true };
        strike.damage = impact.damage;
        strike.object = impact.weapon;
        strike.originalSpecies = monster.mnum;
        strike.hitTextShown = true;
        alreadyKilled = impact.alreadyKilled;
    } else if (unarmed && strike.damage > 1 && mode === 'melee' && !strike.object && !Upolyd(state.u)) {
        const stagger = await tryUnarmedStagger(monster, {
            skill: barehandSkill(state), damage: strike.damage,
            dx: state.u.dx ?? context.target.x - state.u.ux,
            dy: state.u.dy ?? context.target.y - state.u.uy,
            state, announce: publish,
            nameMonster: victim => monsterName(victim, { state, capitalized: true }),
            wakeMonster: () => wakeAttackedMonster(monster),
            finishMonsterDeath,
            finishLiquidDeath: (victim, death) => finishHeroLiquidMonsterDeath(victim, death),
        });
        if (stagger.heroDied) return { survived: monster.mhp > 0, heroDied: true };
        if (stagger.staggered) {
            strike.originalSpecies = monster.mnum;
            strike.hitTextShown = true;
        }
        alreadyKilled = !!stagger.dead;
    } else if (!unarmed && strike.damage > 1 && mode === 'melee' && !Upolyd(state.u)
        && !state.u.twoweap && (state.uwep || state.u.uwep)) maybeKnockback = true;

    if (!alreadyKilled) {
        if (shouldLogWeaponHit(strike, context)) recordFirstHeroWeaponHit(strike.object, state);
        monster.mhp -= strike.damage;
    }
    monster.mhp = Math.min(monster.mhp, monster.mhpmax);
    const offMap = monster.mx === 0;
    let destroyed = monster.mhp <= 0;
    const abuse = await abusePetAfterHeroHit(monster, strike.damage, state);
    if (abuse.heroDied) return { survived: !destroyed, heroDied: true };
    const split = await tryHeroPuddingSplit(monster, strike.object, {
        handToHand, material: strike.material, offMap, state, publish,
    });
    if (split.heroDied) return { survived: !destroyed, heroDied: true };
    strike.hitTextShown ||= split.split;
    await showHeroPhysicalHit(monster, strike.object, {
        ...context, damage: strike.damage, destroyed, hitTextShown: strike.hitTextShown,
    });
    if (strike.dryTowel) {
        if (!strike.object) throw new Error('A drying contact must retain its towel');
        await dryTowel(strike.object, -1, { state, verbose: true });
    }
    if (strike.silverContact) await showHeroPhysicalSilver(monster, { ...strike, state, publish });
    if (strike.lightContact) await showHeroPhysicalLight(monster, { ...strike, state, publish });
    const unpoisonedName = poison?.woreOff && strike.object
        ? captureUnpoisonedPhysicalObjectName(strike.object, state) : null;
    if (poison?.resisted)
        await publish(`The poison doesn't seem to affect ${monsterName(monster, { state })}.`);
    if (poison?.deadly) {
        await publish('The poison was deadly...');
        if (!alreadyKilled && (await finishMonsterDeath(monster, { showKillMessage: false })).heroDied)
            return { survived: false, heroDied: true };
        destroyed = true;
    } else if (destroyed) {
        if (!alreadyKilled) {
            const death = await finishMonsterDeath(monster, {
                noRevive: MONSTER_SYMBOL[monster.mnum] === S_TROLL
                    && artifactById(strike.object?.oartifact, state)?.enumName === 'TROLLSBANE',
                zombifyCorpse: !originalObject && isZombieMaker(state.u.umonnum, state.u.mcan),
            });
            if (death.heroDied) return { survived: false, heroDied: true };
        }
    } else if (state.u.umconf && handToHand) await confuseTouchedMonster(monster, { state });
    if (unpoisonedName) await showHeroPhysicalPoisonWoreOff(unpoisonedName, { state, publish });
    if (!destroyed && !offMap) {
        if ((await wakeAttackedMonster(monster)).heroDied) return { survived: true, heroDied: true };
        if (maybeKnockback) {
            const attack = requireMonsterData(MONSTER_ATTACKS, heroSpecies(state))[0];
            if (!attack) throw new Error('Hero knockback requires the first species attack');
            const impact = await tryKnockback(state.u, monster, { attackType: attack[0], damageType: attack[1] }, {
                state, publish, weaponUsed: true,
                nameMonster: victim => monsterName(victim, { state }),
                wakeDefender: () => wakeAttackedMonster(monster),
                finishMonsterDeath,
                finishLiquidDeath: (victim, death) => finishHeroLiquidMonsterDeath(victim, death),
            });
            if (impact.heroDied) return { survived: !impact.defenderDied, heroDied: true };
            destroyed = !!impact.defenderDied;
        }
    }
    return { survived: !destroyed, heroDied: false };
}

async function preparePhysicalContact(
    monster: Monster, object: GameObject | null, context: ActivePhysicalHit,
): Promise<PreparedContact> {
    const { state, publish, mode, dieRoll } = context;
    const material = object ? objectMaterial(object, state) : 0;
    if (object && (mode === 'thrown' || mode === 'kicked') && object.oclass !== RING_CLASS
        && (material === GEMSTONE || material === MINERAL)
        && (requireMonsterData(MONSTER_FLAGS1, monster.mnum) & M1_WALLWALK) && !monsterIsUnsolid(monster)) {
        await showHeroHarmlessStoneHit(monster, object, { ...context });
        const wake = await wakeAttackedMonster(monster);
        return { kind: 'finished', outcome: { survived: true, heroDied: wake.heroDied } };
    }
    const strike: PhysicalStrike = {
        object, damage: 0, useWeaponSkill: false, trainWeaponSkill: false,
        getDamageBonus: true, hitTextShown: false, dryTowel: false,
        silverContact: false, silverObject: false, silverRings: 0, lightContact: false,
        originalSpecies: monster.mnum, material,
        savedObjectName: object ? captureHeroPhysicalObjectName(object, state) : '',
        joust: 0, canUseWeaponPoison: false,
    };
    if (!object) {
        const contact = prepareHeroBarehandContact(monster, { state, twoHits: context.twoHits });
        strike.damage = contact.damage;
        strike.useWeaponSkill = contact.useWeaponSkill;
        strike.trainWeaponSkill = contact.trainWeaponSkill;
        strike.silverRings = Number(contact.silverRings);
        strike.silverContact = contact.silverRings;
        return { kind: 'strike', strike };
    }
    const weapon = await prepareHeroWeaponContact(monster, object, { mode, dieRoll, state, publish });
    if (!weapon) {
        const contact = await resolveHeroObjectContact(monster, object, { ...context });
        if (contact.heroDied || contact.done)
            return { kind: 'finished', outcome: { survived: contact.done ? contact.survived : monster.mhp > 0, heroDied: contact.heroDied } };
        strike.damage = contact.damage;
        // potionhit() refreshes hmon's cached species after changing the body.
        if (object.oclass === 8) strike.originalSpecies = monster.mnum;
        strike.getDamageBonus = contact.getDamageBonus;
        strike.hitTextShown = contact.specialMessage;
        strike.dryTowel = contact.dryTowel;
        strike.silverContact = strike.silverObject = contact.silverContact;
        return { kind: 'strike', strike };
    }
    if (weapon.heroDied) return { kind: 'finished', outcome: { survived: monster.mhp > 0, heroDied: true } };
    strike.damage = weapon.damage;
    strike.useWeaponSkill = weapon.useWeaponSkill;
    strike.trainWeaponSkill = weapon.trainWeaponSkill;
    strike.hitTextShown = weapon.specialMessage;
    if (weapon.useWeaponSkill && object.oartifact) {
        const visible = cansee(monster.mx, monster.my)
            || (!!state.u.uswallow && state.u.ustuck === monster && !heroIsBlind(state));
        const artifact = await applyArtifactHit(object, monster, strike.damage, {
            state, publish, dieRoll, visible,
            realizesDamage: visible || state.u.ustuck === monster,
            hitOnHead: context.target.x === monster.mx && context.target.y === monster.my,
            describeTarget: () => monsterName(monster, { state }),
        });
        if (artifact.heroDied) return { kind: 'finished', outcome: { survived: monster.mhp > 0, heroDied: true } };
        strike.damage = artifact.damage;
        if (artifact.specialMessage || artifact.attackStopped) {
            if (monster.mhp <= 0 || strike.damage === 0)
                return { kind: 'finished', outcome: { survived: monster.mhp > 0, heroDied: false } };
            strike.hitTextShown = true;
        }
    }
    strike.silverContact = strike.silverObject = material === SILVER && monsterHatesSilver(monster);
    if (weapon.useWeaponSkill) {
        strike.lightContact = artifactEmitsLight(object) && !!object.lamplit && monsterHatesLight(monster);
        if (state.u.usteed && mode === 'melee' && strike.damage > 0
            && Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0) === P_LANCE && monster !== state.u.ustuck) {
            strike.joust = rollHeroJoust(monster, object, { state });
            if (strike.joust) strike.trainWeaponSkill = true;
        }
        const primary = state.uwep || state.u.uwep;
        if (mode === 'thrown' && (isLauncherAmmunition(object) || isMissileObject(object))
            && launcherMatchesAmmo(object, primary)) {
            if (state.urole.key === 'samurai' && object.otyp === YA && primary?.otyp === YUMI) strike.damage++;
            else if (state.urace.name === 'elf' && object.otyp === ELVEN_ARROW && primary?.otyp === ELVEN_BOW) strike.damage++;
            strike.trainWeaponSkill = strike.damage > 0;
        }
        strike.canUseWeaponPoison = true;
    }
    return { kind: 'strike', strike };
}

function shouldLogWeaponHit(strike: PhysicalStrike, { state, mode }: ActivePhysicalHit): strike is PhysicalStrike & { object: GameObject } {
    const object = strike.object;
    return !!object && (object === (state.uwep || state.u.uwep)
        || (!!state.u.twoweap && object === (state.uswapwep || state.u.uswapwep)))
        && (object.oclass === 2 || isWeaponTool(object))
        && (mode === 'melee' || mode === 'applied')
        && !strike.joust && strike.damage > 0 && (state.u.uconduct.weaphit ?? 0) <= 1;
}
