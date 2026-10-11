import type { GameState } from './game_state.js';
// C zap.c:flash_str() and mthrowu.c:rnd_hallublast().
import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { heroIsHallucinating } from './senses.js';

export type RayNameKind = 'wand' | 'spell' | 'breath';

const names: Record<RayNameKind, readonly string[]> = {
    wand: ['magic missile', 'bolt of fire', 'bolt of cold', 'sleep ray',
        'death ray', 'bolt of lightning', '', '', '', ''],
    spell: ['magic missile', 'fireball', 'cone of cold', 'sleep ray',
        'finger of death', 'bolt of lightning', '', '', '', ''],
    breath: ['blast of missiles', 'blast of fire', 'blast of frost',
        'blast of sleep gas', 'blast of disintegration', 'blast of lightning',
        'blast of poison gas', 'blast of acid', '', ''],
};

const hallucinationBlasts = [
    "asteroids",
    "beads",
    "bubbles",
    "butterflies",
    "champagne",
    "chaos",
    "coins",
    "cotton candy",
    "crumbs",
    "dark matter",
    "darkness",
    "data",
    "dust specks",
    "emoticons",
    "emotions",
    "entropy",
    "flowers",
    "foam",
    "fog",
    "gamma rays",
    "gelatin",
    "gemstones",
    "ghosts",
    "glass shards",
    "glitter",
    "good vibes",
    "gravel",
    "gravity",
    "gravy",
    "grawlixes",
    "holy light",
    "hornets",
    "hot air",
    "hyphens",
    "hypnosis",
    "infrared",
    "insects",
    "jargon",
    "laser beams",
    "leaves",
    "lightening",
    "logic gates",
    "magma",
    "marbles",
    "mathematics",
    "megabytes",
    "metal shavings",
    "metapatterns",
    "meteors",
    "mist",
    "mud",
    "music",
    "nanites",
    "needles",
    "noise",
    "nostalgia",
    "oil",
    "paint",
    "photons",
    "pixels",
    "plasma",
    "polarity",
    "powder",
    "powerups",
    "prismatic light",
    "pure logic",
    "purple",
    "radio waves",
    "rainbows",
    "rock music",
    "rocket fuel",
    "rope",
    "sadness",
    "salt",
    "sand",
    "scrolls",
    "sludge",
    "smileys",
    "snowflakes",
    "sparkles",
    "specularity",
    "spores",
    "stars",
    "steam",
    "tetrahedrons",
    "text",
    "the past",
    "tornadoes",
    "toxic waste",
    "ultraviolet light",
    "viruses",
    "water",
    "waveforms",
    "wind",
    "X-rays",
    "zorkmids"
];

export function realRayName(damageType: number, kind: RayNameKind): string {
    const name = names[kind][damageType - 1];
    if (name === undefined) throw new RangeError(`Invalid ${kind} damage type ${damageType}`);
    return name;
}

export function displayRayName(damageType: number, kind: RayNameKind, { state = game, random = rn2 }: { state?: GameState; random?: typeof rn2 } = {}) {
    if (!heroIsHallucinating(state)) return realRayName(damageType, kind);
    const blast = hallucinationBlasts[random(hallucinationBlasts.length)];
    if (blast === undefined) throw new RangeError('Hallucinated blast selection was outside its range.');
    return `blast of ${blast}`;
}
