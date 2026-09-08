// A monster strikes the hero with a weapon it keeps in its hands.
// C refs: mthrowu.c thrwmu() polearm branch and thitu().

import { artifactById } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_CON, A_STR } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { heroHatesSilver, heroSpecies } from './hero_species.js';
import { MONSTER_SIZE } from './monster_data.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { OBJECT_MATERIAL, OBJECT_NAMES } from './object_data.js';
import { stopHeroOccupation } from './occupation.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { couldsee } from './vision.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
import { isPolearm, monsterWeaponSwingVerb } from './weapon_type.js';

const SILVER = 14;

export async function attackHeroWithPolearm(monster, weapon, state = game, {
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
} = {}) {
    if (!isPolearm(weapon) || weapon !== monsterWieldedWeapon(monster)) return;
    const distance = (monster.mx - monster.mux) ** 2 + (monster.my - monster.muy) ** 2;
    if (distance > 5 || !couldsee(monster.mx, monster.my)) return;

    const artifact = artifactById(weapon.oartifact, state);
    const name = artifact?.name || OBJECT_NAMES[weapon.otyp];
    const description = artifact ? name : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
    if (canSeeMonster(monster, monster.mx, monster.my)) {
        const verb = monsterWeaponSwingVerb(weapon, distance <= 2, random);
        await publish(`${monsterSentenceSubject(monster)} ${verb} ${description}.`);
    }

    let damage = Math.max(1, rollPhysicalWeaponDamageAgainstHero(weapon, state, { rollOne }));
    if (state.u.halfPhysicalDamage || state.u.half_physical_damage)
        damage = Math.ceil(damage / 2);
    const heroDistance = Math.max(Math.abs(state.u.ux - monster.mx), Math.abs(state.u.uy - monster.my));
    let accuracy = Math.max(-4, 3 - heroDistance) + 8 + (weapon.spe ?? 0);
    if (MONSTER_SIZE[heroSpecies(state)] >= 3) accuracy++;
    const roll = rollOne(20);
    const threshold = state.u.uac + accuracy;
    const hit = threshold > roll;
    const terse = heroIsBlind(state) || state.flags.verbose === false;
    if (!hit) {
        if (terse) await publish('It misses.');
        else if (threshold <= roll - 2) {
            const subject = description.charAt(0).toUpperCase() + description.slice(1);
            await publish(`${subject} misses you.`);
        } else await publish(`You are almost hit by ${description}.`);
        await stopHeroOccupation(state, publish);
        return;
    }

    const punctuation = damage > 4 ? '!' : '.';
    await publish(terse ? `You are hit${punctuation}`
        : `You are hit by ${description}${punctuation}`);
    if (OBJECT_MATERIAL[weapon.otyp] === SILVER && heroHatesSilver(state)) {
        await publish('The silver sears your flesh!');
        exerciseAttribute(A_CON, false, state);
    }
    const died = await loseHeroHp(damage, description, { state, publish });
    if (!died) {
        exerciseAttribute(A_STR, false, state);
        await stopHeroOccupation(state, publish);
    }
}
