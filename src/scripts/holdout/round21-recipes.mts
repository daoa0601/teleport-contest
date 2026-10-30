import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

type Effect = readonly [string, RegExp];

// Every check must hold on any C-valid random outcome. Level depths are
// seed-dependent (dungeon.lua base+range), so level visits are validated by
// the wizard level-teleport menu listing the destination plus recorded
// arrival evidence, never by hardcoded Dlvl values.
const EFFECTS: Record<string, readonly Effect[]> = {
    'gehennom-lair-tour': [
        ['valley listed', /\bvalley: -?\d/], ['asmodeus listed', /\basmodeus: -?\d/],
        ['valley arrival', /You arrive at the Valley of the Dead/],
        ['hell odor', /odor of burnt flesh and decay/],
    ],
    'gehennom-swamp-tour': [
        ['juiblex listed', /\bjuiblex: -?\d/], ['baalz listed', /\bbaalz: -?\d/],
    ],
    'orcus-lair-cycle': [
        ['orcus listed', /\borcus: -?\d/],
    ],
    'wizard-tower-tour': [
        ['wizard1 listed', /\bwizard1: -?\d/], ['wizard2 listed', /\bwizard2: -?\d/],
        ['wizard3 listed', /\bwizard3: -?\d/], ['fakewiz1 listed', /\bfakewiz1: -?\d/],
        ['fakewiz2 listed', /\bfakewiz2: -?\d/], ['sanctum listed', /\bsanctum: -?\d/],
    ],
    'gehennom-descent': [
        ['valley listed', /\bvalley: -?\d/],
        ['valley arrival', /You arrive at the Valley of the Dead/],
        ['deep gehennom reached', /Dlvl:[3-9]\d/],
    ],
    'maze-filler-descent': [
        ['medusa listed', /\bmedusa: -?\d/],
        ['below-medusa depth reached', /Dlvl:\d{2}/],
    ],
    'minetown-variant-cycle': [['minetown listed', /\bminetn: -?\d/]],
    'mines-end-variant-cycle': [['mines end listed', /\bminend: -?\d/]],
    'sokoban-variant-cycle': [
        ['soko1 listed', /\bsoko1: -?\d/], ['soko2 listed', /\bsoko2: -?\d/],
        ['soko3 listed', /\bsoko3: -?\d/], ['soko4 listed', /\bsoko4: -?\d/],
    ],
    'medusa-variant-cycle': [['medusa listed', /\bmedusa: -?\d/]],
    'oracle-rogue-tour': [['oracle listed', /\boracle: -?\d/], ['rogue listed', /\brogue: -?\d/]],
    'bigroom-variant-cycle': [['big room listed', /\bbigrm: -?\d/]],
    'elemental-plane-tour': [
        ['fire listed', /\bfire: -?\d/], ['water listed', /\bwater: -?\d/],
        ['air listed', /\bair: -?\d/], ['earth listed', /\bearth: -?\d/],
        ['astral listed', /\bastral: -?\d/],
        ['plane of fire reached', /Fire/], ['plane of water reached', /Water/],
        ['plane of air reached', /Air/], ['plane of earth reached', /Earth/],
        ['astral plane reached', /Astral/],
    ],
    'stronghold-trapdoor-drop': [
        ['castle listed', /\bcastle: -?\d/],
        ['valley arrival', /You arrive at the Valley of the Dead/],
    ],
    'amulet-force-climb': [
        ['wizard tower listed', /\bwizard3: -?\d/],
        ['mysterious force', /A mysterious force momentarily surrounds you/],
    ],
    'fort-ludios-entry': [
        ['ludios listed', /\bknox: -?\d/],
        ['ludios security breach', /You have penetrated a high security area/],
        ['ludios alarm', /An alarm sounds!/],
        ['ludios status', /Fort Ludios/],
    ],
};

// must have executed (recorded keys, not plan contents).
const MAP_REVEALS: Record<string, number> = {
    'gehennom-lair-tour': 2, 'gehennom-swamp-tour': 1, 'orcus-lair-cycle': 5,
    'wizard-tower-tour': 6, 'gehennom-descent': 20,
    'maze-filler-descent': 9, 'minetown-variant-cycle': 9, 'mines-end-variant-cycle': 7,
    'sokoban-variant-cycle': 8, 'medusa-variant-cycle': 6, 'oracle-rogue-tour': 4,
    'bigroom-variant-cycle': 13, 'stronghold-trapdoor-drop': 2,
};

const LEVEL_REGENS: Record<string, number> = {
    'minetown-variant-cycle': 8, 'mines-end-variant-cycle': 6,
    'sokoban-variant-cycle': 4, 'medusa-variant-cycle': 5,
    'oracle-rogue-tour': 2, 'bigroom-variant-cycle': 12,
    'orcus-lair-cycle': 4,
};

const QUEST_CODES: readonly [string, string][] = [
    ['archeologist', 'Arc'], ['barbarian', 'Bar'], ['caveman', 'Cav'], ['healer', 'Hea'],
    ['knight', 'Kni'], ['monk', 'Mon'], ['priest', 'Pri'], ['ranger', 'Ran'],
    ['rogue', 'Rog'], ['samurai', 'Sam'], ['tourist', 'Tou'], ['valkyrie', 'Val'],
    ['wizard', 'Wiz'],
];

const BASE_OPTIONS = ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger'];

export const ROUND21_RECIPES: Record<string, Recipe> = {
    'gehennom-lair-tour': recipe('gehennom-lair-tour',
        'Level-teleport to the Valley and Asmodeus lairs and reveal each map.', [
            ...guarded(),
            ...visit('valley'), ...visit('asmodeus'),
        ]),
    'gehennom-swamp-tour': recipe('gehennom-swamp-tour',
        'Level-teleport to the Baalzebub and Juiblex lairs and inspect them.', [
            ...guarded(),
            ...visit('baalz'),
            // Juiblex's full-map reveal trips a recorder capture race; a
            // local look still records the level and its arrival effects.
            choose('juiblex', 'm\x16'), keys(':\x1b'),
        ]),
    'orcus-lair-cycle': recipe('orcus-lair-cycle',
        'Visit the Orcus lair and regenerate it for further layout draws.', [
            ...guarded(),
            ...visit('orcus'),
            ...regenerate(4),
        ]),
    'wizard-tower-tour': recipe('wizard-tower-tour',
        "Level-teleport through the Wizard's Tower, the fake towers, and the Sanctum.", [
            ...guarded(),
            ...visit('wizard1'), ...visit('wizard2'), ...visit('wizard3'),
            ...visit('fakewiz1'), ...visit('fakewiz2'), ...visit('sanctum'),
        ]),
    'gehennom-descent': recipe('gehennom-descent',
        'Enter the Valley and walk every stair down to the bottom of Gehennom.', [
            ...guarded(),
            ...visit('valley'),
            ...descend(20),
        ]),
    'maze-filler-descent': recipe('maze-filler-descent',
        'Descend from Medusa through the raw maze fillers, regenerating three of them.', [
            ...guarded(),
            ...visit('medusa'),
            ...descend(3, 3),
            ...descend(3),
        ]),
    'minetown-variant-cycle': recipe('minetown-variant-cycle',
        'Visit Minetown and regenerate it to cycle its seven variants, Orctown included.', [
            ...guarded(),
            ...visit('minetn'),
            ...regenerate(8),
        ]),
    'mines-end-variant-cycle': recipe('mines-end-variant-cycle',
        "Visit the Mines' End and regenerate it to cycle its three variants.", [
            ...guarded(),
            ...visit('minend'),
            ...regenerate(6),
        ]),
    'sokoban-variant-cycle': recipe('sokoban-variant-cycle',
        'Visit every Sokoban floor and regenerate each to cycle both variants.', [
            ...guarded(),
            ...visit('soko1'), ...regenerate(1), ...visit('soko2'), ...regenerate(1),
            ...visit('soko3'), ...regenerate(1), ...visit('soko4'), ...regenerate(1),
        ]),
    'medusa-variant-cycle': recipe('medusa-variant-cycle',
        'Visit Medusa level and regenerate it to cycle its four variants.', [
            ...guarded(),
            ...visit('medusa'),
            ...regenerate(5),
        ]),
    'oracle-rogue-tour': recipe('oracle-rogue-tour',
        'Visit the Oracle level and the Rogue level, regenerating each once.', [
            ...guarded(),
            ...visit('oracle'), ...regenerate(1), ...visit('rogue'), ...regenerate(1),
        ]),
    'bigroom-variant-cycle': recipe('bigroom-variant-cycle',
        'Visit the Big Room and regenerate it to cycle its thirteen variants.', [
            ...guarded(),
            ...visit('bigrm'),
            ...regenerate(12),
        ]),
    'elemental-plane-tour': recipe('elemental-plane-tour',
        'Walk the elemental planes in order: fire, water, air, earth, then Astral.', [
            ...guarded(),
            // Carrying the Amulet into the endgame grants one wish on the next
            // turn; spend it here so the waiting legs below type no wish text.
            ...wish('amulet of yendor'), identify(), keys('m.'),
            answer('For what do you wish', 'plain glass bead named marker\r'),
            ...wish('3 blessed potions of full healing'), identify(),
            ...Array.from({ length: 3 }, () => choose('full healing', 'q*')),
            ...intrinsic('magical breathing', 20000),
            ...intrinsic('half physical damage', 20000),
            ...intrinsic('half spell damage', 20000),
            ...visit('fire'), ...planeWait(5),
            ...visit('water'), ...planeWait(6),
            ...visit('air'), ...planeWait(5),
            ...visit('earth'), ...planeWait(3),
            ...visit('astral'),
        ]),
    'stronghold-trapdoor-drop': recipe('stronghold-trapdoor-drop',
        'Wish a hole open at the Stronghold and fall through it into the Valley.', [
            ...guarded(),
            ...visit('castle'),
            // Stand on open courtyard floor so the wished hole has free
            // neighbors on some side.
            keys('\x14'), answer('Where do you want to be teleported?', '..'),
            ...wish('trap door'),
            // '>' on the revealed trap door at the Stronghold takes
            // do.c:dodown() -> goto_hell() into the Valley.
            keys('#wizmap\r'), keys('>'),
            keys('#wizmap\r'),
        ]),
    'amulet-force-climb': recipe('amulet-force-climb',
        'Carry the Amulet up from the Wizard tower while the mysterious force pushes back.', [
            ...guarded(),
            ...wish('amulet of yendor'), identify(),
            ...visit('wizard3'),
            ...clearMonsters(),
            ...climb(24),
        ]),
    'fort-ludios-entry': recipe('fort-ludios-entry',
        'Generate the deep main-dungeon vaults until Fort Ludios anchors, then teleport in.', [
            ...guarded(),
            ...forDepth(11, 14, 15, 16, 17, 18, 19, 20, 21, 22),
            ...visit('knox'), ...wait(3),
        ]),
};

for (const [role, code] of QUEST_CODES) {
    ROUND21_RECIPES[`quest-home-${role}`] = questRecipe(role, code);
}

function questRecipe(role: string, code: string): Recipe {
    const genders = role === 'valkyrie' ? ['female'] : undefined;
    return {
        roles: [role],
        ...(genders ? { genders } : {}),
        options: BASE_OPTIONS,
        description: `Visit the ${role} quest home, locate, and goal levels.`,
        success: [`The ${code} quest home, locate, and goal levels are reached and mapped.`],
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r'), answer('To what experience level', '30\r'),
            ...guarded(),
            // Descending from the quest home is blocked until the leader
            // grants the quest (do.c: goto_level), so each quest level is
            // entered from the main dungeon instead.
            ...visit(`${code}-strt`), ...visit('oracle'),
            ...visit(`${code}-loca`), ...visit('oracle'),
            ...visit(`${code}-goal`),
            ...wait(2),
        ] }],
    };
}

function recipe(name: string, description: string, actions: SessionAction[], options: string[] = []): Recipe {
    return {
        roles: ['wizard'],
        options: [...BASE_OPTIONS, ...options],
        description, success: effectsFor(name).map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r'), answer('To what experience level', '30\r'), ...actions, keys('\x1b:\x1b'),
        ] }],
    };
}

export function validateRound21Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const screens = session.segments.flatMap(segment => (segment.steps ?? []).map(step =>
        step.screen.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')));
    const text = screens.join('\n');
    const moves = String(session.segments[0]?.moves ?? '');
    const checks: RecipeCheck[] = [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effectsFor(name).map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
    const reveals = MAP_REVEALS[name];
    if (reveals !== undefined) {
        const count = countIn(moves, 'wizmap');
        checks.push({ check: `at least ${reveals} map reveals`, ok: count >= reveals,
            evidence: `recorded ${count}` });
    }
    const regens = LEVEL_REGENS[name];
    if (regens !== undefined) {
        const count = countIn(moves, 'wizmakemap');
        checks.push({ check: `at least ${regens} level regenerations`, ok: count >= regens,
            evidence: `recorded ${count}` });
    }
    const quest = /^quest-home-(.+)$/.exec(name);
    if (quest) {
        const homes = screens.map(screen => /^Home (\d+)/m.exec(screen)?.[1]).filter(Boolean);
        const distinct = new Set(homes);
        checks.push({ check: 'visits at least three quest depths', ok: distinct.size >= 3,
            evidence: [...distinct].join(',') });
    }
    return checks;
}

function countIn(text: string, needle: string): number {
    let count = 0;
    for (let index = text.indexOf(needle); index !== -1; index = text.indexOf(needle, index + needle.length))
        count++;
    return count;
}

function effectsFor(name: string): readonly Effect[] {
    const effects = EFFECTS[name];
    if (!effects && !/^quest-home-/.test(name)) throw new Error(`unknown round-21 recipe ${name}`);
    return effects ?? [];
}

function guarded(): SessionAction[] {
    return [...wish('blessed +50 gray dragon scale mail', 'uncursed ring of slow digestion'),
        identify(), keys('T'), ...wait(5),
        choose('gray dragon scale mail', 'W*'), ...wait(5),
        choose('ring of slow digestion', 'P*'), answer('Which ring-finger', 'l'),
        ...intrinsic('invulnerable', 20000)];
}

function visit(destination: string): SessionAction[] {
    return [choose(destination, 'm\x16'), keys('#wizmap\r')];
}

function depth(level: number): SessionAction[] {
    return [keys(`\x16${level}\r`), keys('#wizmap\r')];
}

function forDepth(...levels: number[]): SessionAction[] {
    return levels.flatMap(level => depth(level));
}

// Teleport onto the down stair ('>' glyph) and take it. Levels without a down
// stair (the Stronghold, the un-invoked Sanctum approach) leave the hero in
// place, so fixed-length plans stay safe.
function descend(levels: number, regens = 0): SessionAction[] {
    const actions: SessionAction[] = [];
    for (let index = 0; index < levels; index++) {
        // Reveal first: getpos glyph jumps only reach cells the hero knows.
        actions.push(keys('#wizmap\r'), keys('\x14'),
            answer('Where do you want to be teleported?', '>.'),
            keys('>'), answer('Are you sure you want to enter?', 'y'));
        if (index < regens) actions.push(keys('#wizmakemap\r'), keys('#wizmap\r'));
    }
    return actions;
}

function climb(times: number): SessionAction[] {
    return Array.from({ length: times }, () => [
        keys('#wizmap\r'), keys('\x14'), answer('Where do you want to be teleported?', '<.'),
        keys('<'),
    ]).flat();
}

function regenerate(times: number): SessionAction[] {
    return Array.from({ length: times }, () => [keys('#wizmakemap\r'), keys('#wizmap\r')]).flat();
}

// Resting on the planes: the resurrected Wizard of Yendor pelts the
// hero with thrown potions, and an unidentified hit prompts for a name.
// Each unused naming answer is skipped by the driver, so one per turn is
// safe.
function planeWait(turns: number): SessionAction[] {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Call ', '\r')]).flat();
}

function wait(turns: number): SessionAction[] {
    return Array.from({ length: turns }, () => keys('m.'));
}

function intrinsic(property: string, turns: number): SessionAction[] {
    const page = ['pass thru walls', 'fire resistance', 'see invisible'].includes(property) ? 1
        : ['conflict', 'half physical damage', 'half spell damage'].includes(property) ? 2 : 0;
    return [keys(`#wizintrinsic\r${' '.repeat(page)}${turns}`), choose(property, ''), keys('\r')];
}

function clearMonsters(): SessionAction[] {
    return [...wish('blessed scroll of genocide'), identify(), choose('scroll of genocide', 'r*'),
        answer('What class of monsters', '*\r')];
}

function wish(...items: string[]): SessionAction[] {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}

function identify(): SessionAction { return keys('\t\t\r'); }

function choose(target: string, openKeys: string): SessionAction {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}

function answer(prompt: string, value: string): SessionAction {
    return { type: 'answer-prompt', prompt, value, dismissMore: true };
}

function keys(value: string): SessionAction {
    return { type: 'keys', value, dismissMore: true };
}
