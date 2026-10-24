// C dothrow.c:toss_up(). Ceiling contact precedes the fall onto the hero;
// floor effects precede damage from an intact falling object.
import { objectIsHardHelmet, simpleArmorName } from './armor.js';
import { heroCanBeBlindedByObject } from './blinding_attack.js';
import { heroFaceName, heroHeadName } from './body_parts.js';
import { KILLED_BY, STONING, Upolyd, WT_TO_DMG } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { hitHeroWithFallingArtifact } from './falling_artifact.js';
import { game, requirePlayingGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { hitHeroWithThrownPotion } from './hero_potion_hit.js';
import { heroHatesSilver, heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS1, MONSTER_NAME, monsterHatesBlessings } from './monster_data.js';
import { breakObjectAtLocation, objectBreaksOnImpact } from './object_breakage.js';
import { BLINDING_VENOM, CORPSE, CREAM_PIE, EGG } from './object_data.js';
import { objectDescription } from './object_description.js';
import { dropObjectAtHero, hitFloorWithObject } from './object_drop.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { objectMaterial } from './object_material.js';
import { observeObjectForNaming, simpleObjectName } from './objnam.js';
import { polymonHero } from './polyself.js';
import { harmlessMissile } from './projectile.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { formCanBecomeStoneGolem, heroResistsStoning, touchPetrifies } from './stoning.js';
import { ceilingName } from './terrain_name.js';
import { levelHasCeiling } from './terrain_properties.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
const POTION_CLASS = 8;
const RING_CLASS = 4;
const SILVER = 14;
const GEMSTONE = 20;
const MINERAL = 21;
const M1_WALLWALK = 0x08;
const M1_UNSOLID = 0x00100000;
export async function tossObjectUp(object, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const hasCeiling = levelHasCeiling(state);
    const hitsRoof = random(5) !== 0 && !(state.underwater || hero.uinwater);
    const ceiling = ceilingName(hero.ux, hero.uy, state);
    const breakObject = () => breakObjectAtLocation(object, {
        x: hero.ux, y: hero.uy, fromInventory: true, state, publish, random,
    });
    const hitFloor = (verbose) => hitFloorWithObject(object, { state, publish, verbose });
    const petrifier = (object.otyp === EGG || object.otyp === CORPSE)
        && touchPetrifies(object.corpsenm);
    if (hasCeiling && hitsRoof && objectBreaksOnImpact(object, random)) {
        await publish(`${await fallingObjectSubject(object, state)} hits the ${ceiling}.`);
        const broken = await breakObject();
        if (broken.destroyed || state.program_state.gameover)
            return null;
        return hitFloor(false);
    }
    const action = !hasCeiling ? 'flies up into' : hitsRoof ? 'hits' : 'almost hits';
    await publish(`${await fallingObjectSubject(object, state)} ${action} the ${ceiling}, then falls back on top of your ${heroHeadName(state)}.`);
    if (object.oclass === POTION_CLASS) {
        await hitHeroWithThrownPotion(object, { state, publish, random, rollOne });
        return null;
    }
    const helmet = state.uarmh || hero.uarmh || null;
    if (objectBreaksOnImpact(object, random)) {
        const blindIncrement = heroCanBeBlindedByObject(object.otyp, state) ? rollOne(25) : 0;
        const broken = await breakObject();
        if (state.program_state.gameover)
            return null;
        const remaining = broken.destroyed ? null : object;
        if (object.otyp === EGG && petrifier && !heroResistsStoning(state)
            && await petrifyFromFallingObject(remaining, helmet, state, publish))
            return remaining;
        if (object.otyp === EGG || object.otyp === CREAM_PIE || object.otyp === BLINDING_VENOM) {
            await publish(`You've got it all over your ${heroFaceName(state)}!`);
            if (blindIncrement) {
                if (object.otyp === BLINDING_VENOM && !heroIsBlind(state))
                    await publish('It blinds you!');
                hero.ucreamed = (hero.ucreamed ?? 0) + blindIncrement;
                await makeBlinded((hero.blindTurns ?? 0) + blindIncrement, { state, talk: false, publish });
                if (!heroIsBlind(state))
                    await publish('Your vision quickly clears.');
            }
        }
        return remaining ? hitFloor(false) : null;
    }
    if (harmlessMissile(object, state)) {
        await publish("It doesn't hurt.");
        return hitFloor(false);
    }
    const material = objectMaterial(object, state);
    const silver = material === SILVER;
    const hatesSilver = heroHatesSilver(state);
    const lessDamage = objectIsHardHelmet(helmet) && (!silver || !hatesSilver);
    const formFlags = MONSTER_FLAGS1[heroSpecies(state)] ?? 0;
    let harmless = object.oclass !== RING_CLASS && (material === GEMSTONE || material === MINERAL)
        && !!(formFlags & M1_WALLWALK) && !(formFlags & M1_UNSOLID);
    let damage = rollPhysicalWeaponDamageAgainstHero(object, state, { rollOne });
    let artifactMessage = false;
    if (object.oartifact && !harmless) {
        const artifact = await hitHeroWithFallingArtifact(object, damage, {
            state, publish, random, rollOne, dieRoll: random(18) + 2,
        });
        if (artifact.heroDied)
            return object;
        damage = artifact.damage;
        artifactMessage = artifact.specialMessage;
    }
    if (!damage) {
        const weightDamage = Math.max(1, Math.ceil(object.owt / WT_TO_DMG));
        damage = Math.min(6, weightDamage <= 1 ? 1 : rollOne(weightDamage));
        if (MONSTER_NAME[heroSpecies(state)] === 'shade' && !silver)
            damage = 0;
        if (object.blessed && monsterHatesBlessings({ mnum: heroSpecies(state) }))
            damage += rollOne(4);
        if (silver && hatesSilver)
            damage += rollOne(20);
    }
    if (damage > 1 && lessDamage)
        damage = 1;
    if (damage > 0)
        damage += hero.udaminc ?? 0;
    damage = Math.max(0, damage);
    if (hero.halfPhysicalDamage)
        damage = Math.ceil(damage / 2);
    if (helmet) {
        const helmetName = simpleArmorName(helmet, 'uarmh', state);
        const hp = Upolyd(hero) ? hero.mh : hero.uhp;
        if ((lessDamage && damage < hp) || harmless) {
            if (!artifactMessage)
                await publish(harmless
                    ? `Unfortunately, you are wearing ${withIndefiniteArticle(helmetName)}.`
                    : 'Fortunately, you are wearing a hard helmet.');
        }
        else if (!petrifier && state.flags.verbose !== false) {
            await publish(`Your ${helmetName} does not protect you.`);
        }
        harmless = false;
    }
    else if (petrifier && !heroResistsStoning(state)
        && await petrifyFromFallingObject(object, null, state, publish))
        return object;
    if (silver && hatesSilver)
        await publish('The silver sears you!');
    if (harmless)
        await publish(`The ${simpleObjectName(object, state)} hits you but doesn't hurt.`);
    const landed = await hitFloor(true);
    state._thrownObject = null;
    if (!harmless && !state.program_state.gameover)
        await loseHeroHp(damage, 'falling object', { state, publish });
    return landed;
}
async function fallingObjectSubject(object, state) {
    observeObjectForNaming(object, { state });
    const name = await objectDescription(object, { state });
    return name.charAt(0).toUpperCase() + name.slice(1);
}
async function petrifyFromFallingObject(object, helmet, state, publish) {
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        const result = await polymonHero(MONSTER_NAME.indexOf('stone golem'));
        if (result.transformed)
            return false;
        if (result.died)
            return true;
    }
    if (helmet)
        await publish(`Your ${simpleArmorName(helmet, 'uarmh', state)} fails to protect you.`);
    await publish('You turn to stone.');
    if (object)
        await dropObjectAtHero(object, { state, publish });
    state._thrownObject = null;
    await finishHeroDeath({
        killer: 'elementary physics', killerFormat: KILLED_BY,
        deathVerb: 'turned to stone', deathLineShown: true, deathType: STONING,
    });
    return true;
}
//# sourceMappingURL=toss_up.js.map