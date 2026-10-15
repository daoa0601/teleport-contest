// C dogmove.c:dog_hunger() and dog_starve().

import { formatFeltMessage } from './hero_speech.js';
import { plineWithContinuation } from './display.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { begForFood } from './monster_sound.js';
import { stopHeroOccupation } from './occupation.js';
import { heroIsHallucinating } from './senses.js';
import { cansee, couldsee } from './vision.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

const DOG_WEAK = 500;
const DOG_STARVE = 750;
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;

// A starvation attempt ends this pet action even when an amulet saves it.
// Check only at dog_move entry; sleeping, frozen and eating pets wait until
// their next movement opportunity, as in dochug()/m_move().
export async function applyPetHunger(monster: Monster, state: GameState): Promise<boolean> {
    const dog = monster.mtame ? monster.edog ?? monster.mextra?.edog : null;
    if (!dog || state.moves <= dog.hungrytime + DOG_WEAK) return false;

    const diet = (MONSTER_FLAGS1[monster.mnum] ?? 0) & (M1_CARNIVORE | M1_HERBIVORE);
    if (!diet) {
        dog.hungrytime = state.moves + DOG_WEAK;
        return false;
    }

    if (!dog.mhpmax_penalty) {
        const maximum = Math.trunc(monster.mhpmax / 3);
        monster.mconf = 1;
        dog.mhpmax_penalty = monster.mhpmax - maximum;
        monster.mhpmax = maximum;
        monster.mhp = Math.min(monster.mhp, maximum);
        if (monster.mhp <= 0) {
            await starvePet(monster, state);
            return true;
        }

        if (cansee(monster.mx, monster.my)) {
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} is confused from hunger.`);
        } else if (couldsee(monster.mx, monster.my)) {
            await begForFood(monster, state);
        } else {
            await plineWithContinuation(formatFeltMessage(`worried about ${monsterName(monster, { state, article: 'your' })}.`, state));
        }
        await stopHeroOccupation(state);
        return false;
    }

    if (state.moves > dog.hungrytime + DOG_STARVE || monster.mhp <= 0) {
        await starvePet(monster, state);
        return true;
    }
    return false;
}

async function starvePet(monster: Monster, state: GameState): Promise<void> {
    if (monster.mleashed && monster !== state.u.usteed) {
        await plineWithContinuation('Your leash goes slack.');
    } else if (cansee(monster.mx, monster.my)) {
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} starves.`);
    } else {
        await plineWithContinuation(formatFeltMessage(`${heroIsHallucinating(state) ? 'bummed' : 'sad'} for a moment.`, state));
    }
    await finishEnvironmentalMonsterDeath(monster, state);
}
