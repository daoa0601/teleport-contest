import { itemAt } from '../lib/session-types.mjs';
function keys(value) {
    return { type: 'keys', value, dismissMore: true };
}
function choose(target, openKeys) {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}
function wish(...items) {
    return [keys(items.map(item => `\x17${item}\r`).join('') + '\t\t\r')];
}
function pick(seed, choices) {
    return itemAt(choices, ((Math.imul(seed, 1664525) + 1013904223) >>> 0) % choices.length);
}
function recipe(description, success, actions, roles = ['knight']) {
    return {
        roles, options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips'], description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r20\r'), ...actions(seed), keys('\x1b:\x1b'),
                ] }],
    };
}
export const COVERAGE_RECIPES = {
    // artifact.c:invoke_create_ammo() uses the bow's beatitude for both
    // the new arrows and the extra quantity roll.
    'artifact-ammunition': recipe('Invoke the Longbow of Diana to create arrows, varying the bow\'s beatitude.', ['Invoking the bow grants a stack of arrows.'], seed => [
        ...wish(`${pick(seed, ['blessed', 'uncursed', 'cursed'])} the Longbow of Diana`),
        choose('Longbow of Diana', '#invoke\r*'), keys('i\x1b'),
    ], ['ranger']),
    'artifact-portals': recipe('Visit a seeded dungeon branch, then invoke the Eye of the Aethiopica to return to the Dungeons of Doom.', ['The artifact opens a portal.', 'The hero travels between dungeon levels.'], seed => [
        ...wish(`${pick(seed, ['blessed', 'uncursed'])} the Eye of the Aethiopica`),
        // The branch-name entries lead to their entrance in the main
        // dungeon. Named special levels put the hero inside the branch.
        choose(pick(seed + 1, ['minetn', 'soko1']), 'm\x16'),
        choose('Eye of the Aethiopica', '#invoke\r*'),
        choose('The Dungeons of Doom', ''),
    ], ['wizard']),
    'artifact-recharging': recipe('Invoke the Platinum Yendorian Express Card to recharge a seeded empty wand.', ['A selected wand receives a recharge effect.'], seed => {
        const wand = pick(seed, ['light', 'striking', 'fire', 'cold', 'opening']);
        return [...wish('blessed the Platinum Yendorian Express Card', `uncursed wand of ${wand} (0:0)`),
            choose('Platinum Yendorian Express Card', '#invoke\r*'),
            choose(`wand of ${wand}`, '*'), keys('i\x1b')];
    }, ['tourist']),
    'corpse-tinning': recipe('Preserve a seeded fresh corpse with a blessed tinning kit, then eat the homemade tin.', ['A homemade tin is created from the corpse.', 'The homemade meal is consumed.'], seed => {
        const corpse = pick(seed, ['lizard', 'newt', 'jackal', 'lichen']);
        return [...wish('blessed tinning kit', `uncursed ${corpse} corpse`),
            choose('tinning kit', 'a*'), choose(`${corpse} corpse`, '*'),
            keys('\t\t\r'), choose('tin of', 'me*'), keys('y')];
    }),
    'equipment-greasing': recipe('Grease a seeded cloak or boots, then coat the hero\'s gloves to exercise slippery fingers.', ['Equipment receives a layer of grease.', 'The hero coats their gloves with grease.'], seed => {
        const item = pick(seed, ['cloak of protection', 'elven cloak', 'low boots', 'speed boots']);
        return [...wish('uncursed can of grease', `uncursed ${item}`),
            choose('can of grease', 'a*'), choose(item, '*'),
            choose('can of grease', 'a*'), keys('-')];
    }),
    'trap-setting': recipe('Arm a seeded carried bear trap or land mine on prepared room floor.', ['Trap setting starts.', 'The trap is fully armed.'], seed => {
        const trap = pick(seed, ['beartrap', 'land mine']);
        // The stairway record survives a terrain wish. Move away from
        // the starting stairs before preparing a square for the trap.
        return [keys('\x14l.'), ...wish('fountain', 'floor', `uncursed ${trap}`),
            choose(trap, 'a*')];
    }),
    'crystal-scrying': recipe('Scry a distant landmark, then look for a seeded furniture, trap, or object symbol.', ['The crystal ball reveals a distant landmark.'], seed => [
        // A Wizard has enough intelligence to pass the blessed ball's
        // rnd(16) check. Digits select its distant-level vision branch.
        ...wish('blessed crystal ball (0:5)'),
        choose('crystal ball', 'a*'), keys(`${pick(seed, ['1', '2', '3'])}\x1b`),
        choose('crystal ball', 'a*'), keys(`${pick(seed + 1, ['_', '^', '$', ')'])}\x1b`),
    ], ['wizard']),
    'wand-breaking': recipe('Break a seeded charged wand, exercising explosions and effects on nearby squares.', ['The hero breaks the selected wand in two.'], seed => {
        const wand = pick(seed, ['light', 'striking', 'fire', 'cold', 'magic missile', 'digging', 'opening']);
        // One charge keeps even the elemental explosions survivable.
        return [...wish(`uncursed wand of ${wand} (0:1)`),
            choose(`wand of ${wand}`, 'a*'), keys('y')];
    }),
    'dragon-breath': recipe('Become a seeded elemental dragon, breathe on self, and return to human form.', ['A dragon form is taken.', 'The hero resists their own elemental breath.', 'Human form is restored.'], seed => [
        keys(`#polyself\r${pick(seed, ['red dragon', 'white dragon', 'yellow dragon'])}\r#monster\r.#polyself\rknight\r`),
    ]),
};
/** Match a completed effect while its initiating prompt is still pending. */
function followsPrompt(screens, prompt, effect) {
    let pending = false;
    for (const screen of screens) {
        if (/Never mind\./.test(screen))
            pending = false;
        else if (prompt.test(screen))
            pending = true;
        else if (/What do you want to /.test(screen))
            pending = false;
        if (pending && effect.test(screen))
            return true;
    }
    return false;
}
export function validateCoverageRecipe(name, session) {
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const checks = [];
    const require = (check, ok) => { checks.push({ check, ok, evidence: '' }); };
    const has = (check, pattern) => require(check, pattern.test(text));
    require('one recorded version-5 segment', session.version === 5 && session.segments.length === 1 && screens.length >= 2);
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    require('gameplay consumed turns', (turns.at(-1) ?? 0) > (turns[0] ?? Infinity));
    switch (name) {
        case 'artifact-ammunition':
            require('invocation grants arrows', followsPrompt(screens, /What do you want to invoke\?/, /^[a-zA-Z] - \d+ [^\n]*arrows?\b/));
            break;
        case 'artifact-portals': {
            has('portal opened', /You are surrounded by a shimmering sphere!/);
            const depths = new Set(screens.flatMap(screen => [...screen.matchAll(/\bDlvl:(\d+)/g)]
                .map(match => Number(match[1]))));
            require('different dungeon levels visited', depths.size >= 2);
            break;
        }
        case 'artifact-recharging':
            require('selected wand recharged', followsPrompt(screens, /What do you want to charge\?/, /Your wand of [a-z ]+ glows (?:briefly|blue for a moment)\./));
            break;
        case 'corpse-tinning':
            require('corpse made into tin', followsPrompt(screens, /What do you want to tin\?/, /^[a-zA-Z] - [^\n]*tin of /));
            has('homemade tin consumed', /You consume homemade /);
            break;
        case 'equipment-greasing':
            has('equipment greased', /You cover .* with a thick layer of grease\./);
            has('gloves greased', /You coat your (?:gloves|fingers) with grease\./);
            break;
        case 'trap-setting':
            has('trap setting started', /You begin setting your (?:bear trap|land mine)\./);
            has('trap fully armed', /You finish arming the (?:bear trap|land mine)\./);
            break;
        case 'crystal-scrying':
            require('distant landmark seen', followsPrompt(screens, /You peer into the crystal ball\.\.\./, /You see (?:Delphi|Medusa's lair|a castle|the Wizard of Yendor's tower), /));
            break;
        case 'wand-breaking':
            has('wand broken', /Raising .*wand .*high above your .*you (?:snap|break) it in two!/);
            break;
        case 'dragon-breath':
            has('dragon form taken', /You turn into an? (?:red|white|yellow) dragon!/);
            has('own breath resisted', /You don't feel (?:hot!|cold\.)|The acid doesn't hurt\./);
            has('human form restored', /You return to human form!/);
            break;
        default:
            throw new Error(`unknown coverage recipe ${name}`);
    }
    return checks;
}
//# sourceMappingURL=coverage-recipes.mjs.map