// Isolated condition tests run the same two phases as nh_timeout().
import { advanceHeroPetrification as tickPetrification, petrificationDialogue } from '../../js/timeout.js';
import { advanceHeroSliming as tickSlime, slimeDialogue } from '../../js/timeout.js';
import { advanceHeroStrangulation as tickStrangulation, strangulationDialogue } from '../../js/timeout.js';
import { advanceHeroSickness as tickSickness, sicknessDialogue, advanceHeroVomiting as tickVomiting, vomitingDialogue } from '../../js/timeout.js';
export async function advanceHeroPetrification(options = {}) {
    await petrificationDialogue(options);
    return tickPetrification(options);
}
export async function advanceHeroSliming(options = {}) {
    await slimeDialogue(options);
    return tickSlime(options);
}
export async function advanceHeroStrangulation(options = {}) {
    await strangulationDialogue(options);
    return tickStrangulation(options);
}
export async function advanceHeroSickness(options = {}) {
    await sicknessDialogue(options);
    return tickSickness(options);
}
export async function advanceHeroVomiting(options = {}) {
    const dialogue = await vomitingDialogue(options);
    return { ...dialogue, ...await tickVomiting(options) };
}
//# sourceMappingURL=condition-turn.js.map