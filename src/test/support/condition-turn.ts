// Isolated condition tests run the same two phases as nh_timeout().
import {
    advanceHeroPetrification as tickPetrification, petrificationDialogue,
} from '../../js/stoning.js';
import { advanceHeroSliming as tickSlime, slimeDialogue } from '../../js/slime.js';
import {
    advanceHeroStrangulation as tickStrangulation, strangulationDialogue,
} from '../../js/hero_strangulation.js';
import {
    advanceHeroSickness as tickSickness, sicknessDialogue,
    advanceHeroVomiting as tickVomiting, vomitingDialogue,
} from '../../js/hero_illness.js';

export async function advanceHeroPetrification(options: NonNullable<Parameters<typeof tickPetrification>[0]>
    & NonNullable<Parameters<typeof petrificationDialogue>[0]> = {}) {
    await petrificationDialogue(options);
    return tickPetrification(options);
}

export async function advanceHeroSliming(options: NonNullable<Parameters<typeof tickSlime>[0]> = {}) {
    await slimeDialogue(options);
    return tickSlime(options);
}

export async function advanceHeroStrangulation(options: NonNullable<Parameters<typeof tickStrangulation>[0]> = {}) {
    await strangulationDialogue(options);
    return tickStrangulation(options);
}

export async function advanceHeroSickness(options: NonNullable<Parameters<typeof tickSickness>[0]> = {}) {
    await sicknessDialogue(options);
    return tickSickness(options);
}

export async function advanceHeroVomiting(options: NonNullable<Parameters<typeof vomitingDialogue>[0]> = {}) {
    const dialogue = await vomitingDialogue(options);
    return { ...dialogue, ...await tickVomiting(options) };
}
