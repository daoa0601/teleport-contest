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
import { objectCombatName } from './objnam.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { stopHeroOccupation } from './occupation.js';
import { rn2, rnd } from './rng.js';
import { couldsee } from './vision.js';
import { rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
import { isPolearm, monsterWeaponSwingVerb } from './weapon_type.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';

interface WeaponOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
}

export async function attackHeroWithPolearm(monster: Monster, weapon: GameObject, state: GameState = game, {
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
}: Omit<WeaponOptions, 'state'> = {}): Promise<void> {
    if (!isPolearm(weapon) || weapon !== monsterWieldedWeapon(monster)) return;
    if (monster.mux === undefined || monster.muy === undefined)
        throw new Error('A polearm attack requires a perceived hero position');
    const distance = (monster.mx - monster.mux) ** 2 + (monster.my - monster.muy) ** 2;
    if (distance > 5 || !couldsee(monster.mx, monster.my)) return;

    const artifact = artifactById(weapon.oartifact, state);
    const name = artifact?.name || objectCombatName(weapon, { state });
    if (!name) throw new Error(`Unknown polearm object type ${weapon.otyp}`);
    const description = artifact ? name : withIndefiniteArticle(name);
    if (canSeeMonster(monster)) {
        const verb = monsterWeaponSwingVerb(weapon, distance <= 2, random);
        await publish(`${monsterSentenceSubject(monster)} ${verb} ${description}.`);
    }

    let damage = Math.max(1, rollPhysicalWeaponDamageAgainstHero(weapon, state, { rollOne }));
    if (state.u.halfPhysicalDamage)
        damage = Math.ceil(damage / 2);
    const heroDistance = Math.max(Math.abs(state.u.ux - monster.mx), Math.abs(state.u.uy - monster.my));
    let accuracy = Math.max(-4, 3 - heroDistance) + 8 + (weapon.spe ?? 0);
    if ((MONSTER_SIZE[heroSpecies(state)] ?? 0) >= 3) accuracy++;
    const result = await hitHeroWithObject(weapon, damage, accuracy, { state, publish, rollOne });
    if (!result.died) await stopHeroOccupation(state, publish);
}
