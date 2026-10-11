// C trap.c:trapname(). Cosmetic trap choices use the display RNG.
import { TRAPNUM, TRAP_EXPLANATIONS, Upolyd } from './const.js';
import { experienceRankIndex } from './exper.js';
import { game, requirePlayingGame } from './gstate.js';
import { rn2, rn2Display } from './rng.js';
import { heroIsHallucinating } from './senses.js';
const HALLUCINATED_TRAPS = [
    "bottomless pit",
    "polymorphism trap",
    "devil teleporter",
    "falling boulder trap",
    "anti-anti-magic field",
    "weeping gas trap",
    "queasy board",
    "electrified web",
    "owlbear trap",
    "sand mine",
    "vacillating triangle",
    "death trap",
    "disintegration trap",
    "ice trap",
    "monochrome trap",
    "axeblade trap",
    "pool of boiling oil",
    "pool of quicksand",
    "field of caltrops",
    "buzzsaw trap",
    "spiked floor",
    "revolving wall",
    "uneven floor",
    "finger trap",
    "jack-in-a-box",
    "yellow snow",
    "booby trap",
    "rat trap",
    "poisoned nail",
    "snare",
    "whirlpool",
    "trip wire",
    "roach motel (tm)",
    "negative space",
    "tensor field",
    "singularity",
    "imperial fleet",
    "black hole",
    "thermal detonator",
    "event horizon",
    "entoptic phenomenon",
    "sweet-smelling gas vent",
    "phone booth",
    "exploding runes",
    "never-ending elevator",
    "slime pit",
    "warp zone",
    "illusory floor",
    "pile of poo",
    "honey trap",
    "tourist trap",
    "banana peel",
    "garden rake",
    "whoopie cushion",
    "box and stick trap",
    "fly trap",
    "legal trap",
    "pit of snakes",
    "pollywog trap",
    "slippery slope",
    "thirst trap",
    "suntrap"
];
export function trapName(type, { ignoreHallucination = false, state = game } = {}) {
    if (heroIsHallucinating(state) && !ignoreHallucination) {
        const total = TRAPNUM + HALLUCINATED_TRAPS.length;
        const index = rn2Display(total + 1);
        if (index === total) {
            requirePlayingGame(state);
            const female = Upolyd(state.u) ? state.u.mfemale : state.flags.female;
            const names = rn2(3) ? state.urole.name
                : state.urole.title[experienceRankIndex(state.u.ulevel)];
            if (!names)
                throw new Error('The hero role has no title for the current rank.');
            return `${(female && names.f ? names.f : names.m).slice(0, 27)} trap`.toLowerCase();
        }
        if (index >= TRAPNUM) {
            const name = HALLUCINATED_TRAPS[index - TRAPNUM];
            if (name === undefined)
                throw new RangeError(`Invalid hallucinated trap ${index}`);
            return name;
        }
        if (index !== 0)
            type = index;
    }
    const name = TRAP_EXPLANATIONS[type];
    if (name === undefined)
        throw new RangeError(`Invalid native trap type ${type}`);
    return name;
}
//# sourceMappingURL=trap_name.js.map