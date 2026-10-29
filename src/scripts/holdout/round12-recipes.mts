import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

function keys(value: string, expectExit = false): SessionAction {
    return { type: 'keys', value, dismissMore: true, ...(expectExit ? { expectExit: true } : {}) };
}

function choose(target: string, openKeys: string): SessionAction {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}

function answer(prompt: string, value: string): SessionAction {
    return { type: 'answer-prompt', prompt, value, dismissMore: true };
}

function wish(...items: string[]): SessionAction[] {
    return [keys(items.map(item => `\x17${item}\r`).join('') + '\t\t\r')];
}

function recipe(description: string, success: string[], actions: SessionAction[],
    options: string[] = []): Recipe {
    return {
        roles: null,
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', ...options],
        description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r20\r'), ...actions, keys('\x1b:\x1b'),
        ] }],
    };
}

function dyingRecipe(description: string, success: string[], actions: SessionAction[],
    options: string[] = []): Recipe {
    return {
        roles: null,
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', ...options],
        description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r20\r'), ...actions,
        ] }],
    };
}

function femaleRecipe(description: string, success: string[], actions: SessionAction[]): Recipe {
    return {
        roles: null,
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none'],
        description, success,
        // sit.c:lay_an_egg() refuses male heroes ("Males can't lay
        // eggs!"), so building a plan for one can never validate.
        build: ({ seed, datetime, rc, character }) => {
            if (character.gender !== 'female') {
                throw new Error('egg-laying needs a female character');
            }
            return [{
                seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r20\r'), ...actions, keys('\x1b:\x1b'),
                ],
            }];
        },
    };
}

// hack.c:moverock(), moverock_core(), movobj(), cannot_push(), dopush().
export const ROUND12_RECIPES: Record<string, Recipe> = {
    'boulder-push': recipe(
        'Wish a boulder, walk around it, and push it east until it jams against a wall.',
        ['The boulder is pushed across the floor and finally refuses to move.'],
        [...wish('boulder'), keys('h'), keys('l'.repeat(10))]),
    'boulder-giant-lift': recipe(
        'Polymorph into a stone giant and push a boulder against a wall; the giant maneuvers over it.',
        ['The giant maneuvers over the blocked boulder instead of pushing it.'],
        [...wish('boulder'), keys('h'), keys('#polyself\rstone giant\r'),
            keys('l'.repeat(10))]),
    'boulder-plug-hole': recipe(
        'Wish a hole underfoot, step aside, and push a boulder over the hole to plug it.',
        ['The boulder plugs a hole in the floor.'],
        [...wish('hole'), keys('l'), ...wish('boulder'), keys('l'), keys('h'),
            ...wish('hole'), keys('h'), ...wish('boulder'), keys('h'), keys('l')]),
    'boulder-mine-blast': recipe(
        'Push boulders over wished land mines until one explodes under the rolling boulder.',
        ['A land mine explodes when the boulder rolls onto it.'],
        [...wish('land mine trap'), keys('l'), ...wish('boulder'), keys('l'), keys('h'),
            ...wish('land mine trap'), keys('l'), ...wish('boulder'), keys('l'), keys('h'),
            ...wish('land mine trap'), keys('h'), ...wish('boulder'), keys('h'), keys('l'),
            ...wish('land mine trap'), keys('h'), ...wish('boulder'), keys('h'), keys('l')]),
    // rumors.c:doconsult(), outoracle(), outrumor() with BY_ORACLE.
    'oracle-minor': recipe(
        'Create an oracle, wish gold, and settle for a minor consultation.',
        ['The oracle answers a minor consultation.'],
        [...wish('1000 gold pieces'), keys('\x07oracle\ry'),
            ...[...'jkhluybn'].flatMap(dir => [keys(`#chat\r${dir}`),
                answer('"Wilt thou settle for a minor consultation?"', 'y')])]),
    'oracle-major': recipe(
        'Create an oracle, wish gold, decline the minor consultation and pay for the major one.',
        ['The oracle delivers a major consultation.'],
        [...wish('4000 gold pieces'), keys('\x07oracle\ry'),
            ...[...'jkhluybn'].flatMap(dir => [keys(`#chat\r${dir}`),
                answer('"Wilt thou settle for a minor consultation?"', 'n'),
                answer('"Then dost thou desire a major one?"', 'y')])]),
    // mon.c:m_respond_medusa() through m_respond() and the reflection reply.
    'medusa-gaze-reflection': recipe(
        'Wear an amulet of reflection, create a medusa, and let it gaze at its own reflection.',
        ['The medusa gazes and is stopped by the reflection.'],
        [...wish('amulet of reflection'), choose('amulet of reflection', 'P*'),
            keys('\x07medusa\ry'), keys('m.'.repeat(10))]),
    // sit.c:throne_sit_effect() and take_gold(); the debug prompt fixes the effect.
    'throne-gold-sit': recipe(
        'Wish a throne and gold, sit repeatedly, and pick the gold-removal throne effect.',
        ['The throne takes the gold (or reports none) and survives analysis.'],
        [...wish('throne', '3000 gold pieces'),
            ...Array.from({ length: 12 }, () => [keys('#sit\r'),
                answer('Throne sit effect', '5\r'), answer('Analyze throne?', 'n')]).flat()]),
    // sit.c:special_throne_effect(): Vlad tower thrones route to the special table.
    'throne-vlad-special': recipe(
        'Levelport into Vlad\'s tower, wish a throne, and pick a special throne effect.',
        ['The Vlad tower throne produces its special effect.'],
        [choose('tower2', 'm\x16'), ...wish('throne'),
            ...Array.from({ length: 12 }, () => [keys('#sit\r'),
                answer('Throne sit effect', '8\r'), answer('Analyze throne?', 'n')]).flat()]),
    // sit.c:lay_an_egg(): female hero polymorphed into an egg layer.
    'egg-laying': femaleRecipe(
        'A female hero polymorphs into a gray dragon and lays an egg.',
        ['The hero lays an egg.'],
        [keys('#polyself\rgray dragon\r'), keys('h'), keys('#sit\r')]),
    // polyself.c:dopoly(): #monster while polymorphed into a vampire.
    'vampire-shapeshift': recipe(
        'Polymorph into a vampire and use #monster to change shape again.',
        ['The vampire transforms into another vampire shape.'],
        [keys('#polyself\rvampire\r'), keys('#monster\r')]),
    // trap.c:trapeffect_vibrating_square(): hero branch reveals the square.
    'vibrating-square-step': recipe(
        'Wish a vibrating square, step off and back, and look at the revealed trap.',
        ['The vibrating square is revealed on the map.'],
        [keys('h'), keys('j'), ...wish('vibrating square'), keys('h'),
            keys('l'), keys(':\x1b')]),
    // trap.c:disarm_landmine().
    'land-mine-untrap': recipe(
        'Wish an armed land mine, reveal it with #wizdetect, and disarm it where you stand.',
        ['The land mine is disarmed into a pickable object, or it detonates.'],
        [keys('h'), keys('j'), ...wish('land mine trap'), keys('\x05'),
            keys('#untrap\r.\r'), keys('#untrap\r.\r'), keys('#untrap\r.\r')]),
    // trap.c:disarm_squeaky_board() and unsqueak_ok(). The untrap-with
    // getobj suggests only the grease, and u_init.c's random starting
    // kit (blindfold 1-in-5, lamp 1-in-6, merging potions) moves its
    // inventory letter per seed, so the recipe runs with force_invmenu:
    // the getobj opens a menu whose only listed candidate is the can of
    // grease, and the driver picks that entry by name. A space cannot
    // pick it (getobj() treats the empty space-commit as a cancel), and
    // a second untrap attempt after a successful repair shows no menu,
    // so one attempt per recording; try_disarm() still fails one roll
    // in three, which the recording seed choice absorbs.
    'squeaky-board-untrap': {
        roles: null,
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips',
            'pettype:none', 'force_invmenu'],
        description: 'Wish a squeaky board, reveal it, and repair it with a can of grease.',
        success: ['The squeaky board is repaired with grease.'],
        build: ({ seed, datetime, rc }) => [{
            seed, datetime, nethackrc: rc(), driver: [
                keys('#levelchange\r20\r'), keys('h'), keys('j'),
                ...wish('squeaky board', 'can of grease'), keys('\x05'),
                keys('#untrap\r.'), choose('can of grease', ''),
                keys('\x1b:\x1b'),
            ],
        }],
    },
    // teleport.c:level_tele_trap().
    'level-teleporter-step': recipe(
        'Wish a level teleporter and step onto it to be thrown to a random level.',
        ['The level teleport trap fires and the hero lands on a new level.'],
        [keys('h'), keys('j'), ...wish('level teleporter'), keys('h'), keys('l')]),
    // trap.c:drown(), emergency_disrobe(), pot_acid_damage().
    'drowning-crawl': recipe(
        'Wish a pool, carry a potion of acid, step in, sink, and crawl out.',
        ['The hero sinks like a rock, the pack is soaked, and the hero crawls out.'],
        [...wish('pool', 'potion of acid'), keys('mh'), keys('ml'), keys('h')]),
    // trap.c:fire_damage(), fire_damage_chain(), grease_protect(), lava_damage().
    'floor-fire-damage': recipe(
        'Levitate over a floor pile of scrolls, then wish lava under it to burn the pile.',
        ['Ungreased scrolls burn in the lava while the greased one survives.'],
        [...wish('scroll of mail', 'greased scroll of mail', 'potion of levitation'),
            choose('scroll of mail', 'd*'), choose('greased scroll of mail', 'd*'),
            choose('potion of levitation', 'q*'), ...wish('lava')]),
    // end.c done() Lifesaved branch and savelife().
    'death-lifesaving': recipe(
        'Wear an amulet of life saving and survive #wizkill suicide through lifesaving.',
        ['The medallion glows, crumbles, and the hero survives.'],
        [...wish('amulet of life saving'), choose('amulet of life saving', 'P*'),
            keys('#wizkill\r.'), answer('Commit suicide?', 'yes\r'), keys('.')]),
    // end.c disclosure, container_contents(), vanquished/genocided/conduct lists, topten().
    'death-disclosure': dyingRecipe(
        'Genocide jackals, carry a box, die by #wizkill, and step through full disclosure.',
        ['Possessions with the box contents, attributes, vanquished, genocided, conduct, and overview are disclosed.'],
        [...wish('uncursed scroll of genocide', 'empty unlocked large box'),
            choose('scroll of genocide', 'r*'), answer('What type of monster', 'jackal\r'),
            keys('#wizkill\r.'), answer('Commit suicide?', 'yes\r'), answer('Die?', 'y'),
            keys('yyyyyy'), answer('Save bones?', 'y'), keys(' '.repeat(8), true)],
        ['disclose:all']),
    'death-polymorphed': dyingRecipe(
        'Polymorph into a silver dragon, then die by #wizkill and rest in the tombstone.',
        ['The hero dies in dragon form; the tombstone names the hero\'s own player as the killer.'],
        [keys('.'), keys('#polyself\rsilver dragon\r'), keys('#wizkill\r.'),
            answer('Commit suicide?', 'yes\r'), answer('Die?', 'y'),
            answer('Save bones?', 'y'), keys(' ', true)],
        ['disclose:-i -a -v -g -c -o']),
    // end.c:done2().
    'quit-confirm': recipe(
        'Invoke #quit and decline the paranoid confirmation to keep playing.',
        ['The quit confirmation is answered with no and play continues.'],
        [keys('#quit\r'), answer('Really quit without saving?', 'n\r'), keys('.')]),
    // mkmaze.c:baalz_fixup(), wizcmds.c:wiz_makemap(), cmd.c:makemap_prepost().
    // Replacing the level discards its annotation through rm_mapseen().
    'gehennom-tour': recipe(
        'Visit the Valley and Baalzebub\'s lair, annotate the lair, and regenerate it.',
        ['The Valley and Baalzebub\'s lair load; replacing the lair discards its old annotation.'],
        [choose('valley', 'm\x16'), keys('.'.repeat(4)),
            choose('baalz', 'm\x16'), keys('.'.repeat(2)),
            keys('#wizwhere\r'), keys(' '.repeat(4)),
            keys('#annotate\r'), answer('What do you want to call this dungeon level?', 'old lair\r'),
            keys('#annotate\r'), answer('Replace annotation "old lair" with?', '\x1b'),
            keys('#wizmakemap\r'),
            keys('#annotate\r'), answer('What do you want to call this dungeon level?', '\x1b'),
            keys('.'.repeat(3))]),
    // topten.c:tt_doppel() and classmon().
    'doppelganger-players': recipe(
        'Create a doppelganger; its creation shape-change picks a player '
            + 'monster form out of the score list.',
        ['The doppelganger appears in a player monster form.'],
        [keys('\x07doppelganger\r'), keys('m.m.m.')]),
    // wizcmds.c:wiz_telekinesis().
    'wiz-telekinesis-self': recipe(
        'Use #wiztelekinesis targeting yourself and hurtle sideways.',
        ['The hero is hurtled by telekinesis.'],
        [keys('#wiztelekinesis\r.'), answer('which direction?', 'h'), keys('\x1b.'),
            keys('#wiztelekinesis\r.'), answer('which direction?', 'k'), keys('\x1b.'), keys('.')]),
    // wizcmds.c:wiz_where().
    'wiz-where-report': recipe(
        'Ask #wizwhere for the dungeon layout of the special levels.',
        ['The dungeon layout with named levels is displayed.'],
        [keys('#wizwhere\r'), keys(' '.repeat(4)), keys('.')]),
};

const EFFECTS: Record<string, readonly [string, RegExp][]> = {
    'boulder-push': [['push blocked at last', /(?:try to move the boulder, but in vain|tries to move the boulder, but cannot)/]],
    'boulder-giant-lift': [['giant maneuvers', /However, you (?:easily pick it up|maneuver over it)/]],
    'boulder-plug-hole': [['hole plugged', /plugs a hole/]],
    'boulder-mine-blast': [['mine explodes', /KAABLAMM|Gadzooks/]],
    'oracle-minor': [['minor consultation', /True to her word, the Oracle (?:\w+ )?says:/]],
    'oracle-major': [['major consultation', /(?:meditates for a moment|scornfully takes)/]],
    'medusa-gaze-reflection': [['gaze reflection', /gaze is reflected|is turned to stone/]],
    'throne-gold-sit': [['gold removed', /You notice you have no gold!/]],
    'throne-vlad-special': [['special effect', /(?:extremely out of place|Thine audience hath been summoned|terrible experience|throne somehow seems to be amused|calling for help|not meant for those such as you|body and mind start to warp|throne disintegrates)/]],
    'egg-laying': [['egg laid', /lay an egg/]],
    'vampire-shapeshift': [['vampire shifted', /You transform into/]],
    'vibrating-square-step': [['square revealed', /There is a vibrating square here/]],
    'land-mine-untrap': [['mine handled', /(?:disarm the land mine|set it off|KAABLAMM)/]],
    'squeaky-board-untrap': [['board repaired', /You repair the squeaky board/]],
    'level-teleporter-step': [['level trap fired', /You step onto a level teleport trap/]],
    'drowning-crawl': [['sank and crawled out', /(?:sink like|crawled out|Pheew)/]],
    'floor-fire-damage': [['pile burned', /catch(?:es)? fire and burns?|boils? and explodes?|burns? up/]],
    'death-lifesaving': [['lifesaved', /(?:begins to glow|crumbles to dust)/]],
    'death-disclosure': [['disclosure shown', /Do you want your possessions/]],
    'death-polymorphed': [
        ['dragon form', /You turn into a silver dragon!/],
        ['tombstone killer', /killed by (?:his|her)[\s|]*own player/],
        ['death summary', /You died in The Dungeons of Doom on dungeon level/],
    ],
    'quit-confirm': [['quit declined', /Really quit without saving/]],
    'gehennom-tour': [
        ['Valley arrival', /You arrive at the Valley of the Dead/],
        ['Baalzebub\'s lair visited', /\*\s+baalz:\s+\d+/],
    ],
    'doppelganger-players': [['doppel created', /appears next to you/]],
    'wiz-telekinesis-self': [['hero hurtled', /(?:hurtle|whammed|Ouch)/i]],
    'wiz-where-report': [['layout shown', /(?:Dungeon|Branch|Level)/]],
};

export function validateRound12Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-12 recipe ${name}`);
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    const checks: RecipeCheck[] = [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        { check: 'gameplay consumed turns', ok: (turns.at(-1) ?? 0) > (turns[0] ?? Infinity), evidence: '' },
        ...effects.map(([check, effect]) => ({ check, ok: effect.test(text), evidence: '' })),
    ];
    if (name === 'gehennom-tour') {
        const lairDepth = text.match(/\*\s+baalz:\s+(\d+)/)?.[1];
        const annotated = screens.findIndex(screen => screen.includes('Replace annotation "old lair" with?')
            && lairDepth !== undefined && screen.match(/\bDlvl:\s*(\d+)/)?.[1] === lairDepth);
        const replaced = screens.slice(annotated + 1).some(screen =>
            screen.includes('What do you want to call this dungeon level?')
            && lairDepth !== undefined && screen.match(/\bDlvl:\s*(\d+)/)?.[1] === lairDepth);
        checks.push({ check: 'replacement lair forgot its old annotation',
            ok: annotated >= 0 && replaced, evidence: '' });
    }
    return checks;
}
