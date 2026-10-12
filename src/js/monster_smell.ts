// C mon.c:usmellmon(). A hero with a sense of smell notices a monster
// they cannot currently spot. Species-specific smells take precedence;
// remaining species fall through to a class-based smell, and several
// species are deliberately smell-free.

import { plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { heroHasOlfaction, heroMonsterForm } from './polyself.js';
import type { GameState } from './game_state.js';

const S_DOG = 4;
const S_DRAGON = 30;
const S_FUNGUS = 32;
const S_UNICORN = 21;
const S_ZOMBIE = 52;
const S_EEL = 57;
const S_ORC = 15;
const M2_ORC = 0x00000080;

const PM_PONY = 100;

// Species with their own smell, mirroring the mndx switch in usmellmon().
const SPECIES_SMELLS = new Map<number, string>([
    [81, 'You notice a bovine smell.'],               // rothe
    [177, 'You notice a bovine smell.'],              // minotaur
    [333, 'You smell body odor.'],                    // cave dweller
    [332, 'You smell body odor.'],                    // barbarian
    [371, 'You smell body odor.'],                    // neanderthal
    [261, "You detect an odor reminiscent of an animal's den."], // human wererat
    [262, "You detect an odor reminiscent of an animal's den."], // human werejackal
    [263, "You detect an odor reminiscent of an animal's den."], // human werewolf
    [91, "You detect an odor reminiscent of an animal's den."],  // wererat
    [15, "You detect an odor reminiscent of an animal's den."],  // werejackal
    [21, "You detect an odor reminiscent of an animal's den."],  // werewolf
    [235, "You detect an odor reminiscent of an animal's den."], // owlbear
    [110, 'You smell steam.'],                        // steam vortex
    [208, 'Something stinks.'],                       // green slime
    [164, 'You smell mushrooms.'],                    // violet fungus
    [163, 'You smell mushrooms.'],                    // shrieker
]);

// Species the mndx switch holds smell-free so the class switch below
// cannot trigger for them.
const UNSCENTED_SPECIES = new Set([
    291,  // horned devil
    302,  // balrog
    309,  // Asmodeus
    307,  // Dispater
    304,  // Yeenoghu
    305,  // Orcus
    101,  // white unicorn
    102,  // gray unicorn
    103,  // black unicorn
    316,  // jellyfish
]);

// C maybe_polyd(is_orc(gy.youmonst.data), Race_if(PM_ORC)): a polymorphed
// hero smells like the current form, an unpolymorphed one like the race.
function heroSmellsAttractiveToOrcs(state: GameState): boolean {
    const form = heroMonsterForm(state);
    if (form !== null) return !!((MONSTER_FLAGS2[form] ?? 0) & M2_ORC);
    return state.urace?.name === 'orc';
}

export async function smellUnseenMonster(
    mnum: number, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<boolean> {
    if (!Number.isInteger(mnum) || MONSTER_NAME[mnum] === undefined) return false;
    if (!heroHasOlfaction(state)) return false;

    const speciesSmell = SPECIES_SMELLS.get(mnum);
    if (speciesSmell !== undefined) {
        await publish(speciesSmell);
        return true;
    }
    if (UNSCENTED_SPECIES.has(mnum)) return false;

    switch (MONSTER_SYMBOL[mnum] ?? 0) {
    case S_DOG:
        await publish('You notice a dog smell.');
        return true;
    case S_DRAGON:
        await publish('You smell a dragon!');
        return true;
    case S_FUNGUS:
        await publish('Something smells moldy.');
        return true;
    case S_UNICORN:
        await publish(mnum === PM_PONY
            ? 'You detect an odor reminiscent of a stable.'
            : 'You detect a strong odor reminiscent of a stable.');
        return true;
    case S_ZOMBIE:
        await publish('You smell rotting flesh.');
        return true;
    case S_EEL:
        await publish('You smell fish.');
        return true;
    case S_ORC:
        await publish(heroSmellsAttractiveToOrcs(state)
            ? 'You notice an attractive smell.'
            : 'A foul stench makes you feel a little nauseated.');
        return true;
    default:
        return false;
    }
}
