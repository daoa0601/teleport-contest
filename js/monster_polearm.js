// A monster strikes the hero with a weapon it keeps in its hands.
// C refs: mthrowu.c thrwmu() polearm branch and thitu().
import { artifactById } from './artifacts.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_SIZE } from './monster_data.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { OBJECT_NAMES } from './object_data.js';
import { stopHeroOccupation } from './occupation.js';
import { rn2, rnd } from './rng.js';
import { couldsee } from './vision.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
import { isPolearm, monsterWeaponSwingVerb } from './weapon_type.js';
export async function attackHeroWithPolearm(monster, weapon, state = game, { publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    if (!isPolearm(weapon) || weapon !== monsterWieldedWeapon(monster))
        return;
    if (monster.mux === undefined || monster.muy === undefined)
        throw new Error('A polearm attack requires a perceived hero position');
    const distance = (monster.mx - monster.mux) ** 2 + (monster.my - monster.muy) ** 2;
    if (distance > 5 || !couldsee(monster.mx, monster.my))
        return;
    const artifact = artifactById(weapon.oartifact, state);
    const name = artifact?.name || OBJECT_NAMES[weapon.otyp];
    if (!name)
        throw new Error(`Unknown polearm object type ${weapon.otyp}`);
    const description = artifact ? name : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
    if (canSeeMonster(monster)) {
        const verb = monsterWeaponSwingVerb(weapon, distance <= 2, random);
        await publish(`${monsterSentenceSubject(monster)} ${verb} ${description}.`);
    }
    let damage = Math.max(1, rollPhysicalWeaponDamageAgainstHero(weapon, state, { rollOne }));
    if (state.u.halfPhysicalDamage)
        damage = Math.ceil(damage / 2);
    const heroDistance = Math.max(Math.abs(state.u.ux - monster.mx), Math.abs(state.u.uy - monster.my));
    let accuracy = Math.max(-4, 3 - heroDistance) + 8 + (weapon.spe ?? 0);
    if ((MONSTER_SIZE[heroSpecies(state)] ?? 0) >= 3)
        accuracy++;
    const result = await hitHeroWithObject(weapon, damage, accuracy, { state, publish, rollOne });
    if (!result.died)
        await stopHeroOccupation(state, publish);
}
//# sourceMappingURL=monster_polearm.js.map