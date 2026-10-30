const EFFECTS = {
    'rush-vi-directions': [['movement consumed turns', /T:([2-9]|\d{2,})\b/]],
    'rush-keypad-directions': [['movement consumed turns', /T:([2-9]|\d{2,})\b/]],
    'qwertz-movement': [['movement consumed turns', /T:([2-9]|\d{2,})\b/]],
    'phone-keypad-movement': [['movement consumed turns', /T:([2-9]|\d{2,})\b/]],
    'custom-command-bindings': [['rebound discoveries opened', /Discoveries, by order/], ['rebound self direction used', /suddenly moving (?:much )?faster/], ['bindings listed', /Full Current Key Bindings List/]],
    'command-autocompletion': [['completion editor opened', /Which commands autocomplete/], ['extended commands listed', /Extended Commands List/]],
    'contextual-fountain-dip': [['contextual dip offered', /Dip something into the fountain/], ['acid reacted with water', /potion of acid explodes/]],
    'wizard-dungeon-layout': [['dungeon listed', /The Dungeons of Doom/], ['branches listed', /The Gnomish Mines/]],
    'wizard-hidden-detection': [['hidden trap revealed', /bear trap/]],
    'wizard-map-replacement': [['births listed after replacement', /died born/]],
    'wizard-monster-migration': [['monsters migrating', /[1-9]\d* for next level/], ['migrants listed', /All migrating monsters:/]],
    'wizard-timer-queue': [['timer queue listed', /Active timeout queue:/], ['burn timer listed', /burn_object/]],
    'wizard-mobile-lights': [['light listing opened', /Mobile light sources: hero/], ['object light listed', /location range flags/]],
    'wizard-custom-glyphs': [['customization listing opened', /#wizcustom: colorcount=/]],
    'wizard-memory-statistics': [['statistics opened', /Current memory statistics:/], ['contents counted', /contained/], ['totals shown', /Grand total/]],
    'escape-with-valuables': [['escaped alive', /escaped from the dungeon/], ['artifact valued', /Magicbane \(worth/], ['gems valued', /diamonds? \(worth/], ['amulet valued', /amulet of reflection \(worth/]],
    'quit-container-disclosure': [['contents disclosed', /Contents of the sack named luggage/], ['cargo disclosed', /diamond named cargo/], ['quit summary', /when you quit/]],
    'manual-character-selection': [['role offered', /Pick a role or profession/], ['race offered', /Pick a race or species/], ['gender offered', /Pick a gender or sex/], ['alignment offered', /Pick an alignment or creed/], ['wizard started', /[Ww]elcome to NetHack/]],
    'random-character-selection': [['character confirmed', /Is this ok/], ['game started', /[Ww]elcome to NetHack/]],
    'filtered-character-selection': [['filters offered', /Unacceptable roles/], ['character confirmed', /Is this ok/], ['game started', /[Ww]elcome to NetHack/]],
    'random-config-character': [['game started', /[Ww]elcome to NetHack/]],
};
export const ROUND20_RECIPES = {
    'rush-vi-directions': recipe('rush-vi-directions', 'Rush and run in all eight vi directions.', movement('hykulnjb')),
    'rush-keypad-directions': recipe('rush-keypad-directions', 'Rush and run in all eight keypad directions.', movement('47896321', true), ['number_pad:1']),
    'qwertz-movement': recipe('qwertz-movement', 'Move with the swapped y and z layout.', movement('hzkulnjb'), ['number_pad:-1']),
    'phone-keypad-movement': recipe('phone-keypad-movement', 'Move with the telephone keypad layout.', movement('41236987', true), ['number_pad:3']),
    'custom-command-bindings': recipe('custom-command-bindings', 'Use rebound commands and direction keys, then inspect bindings.', [
        ...wish('uncursed wand of speed monster'), identify(), keys('~'), keys('\x1b'),
        choose('wand of speed monster', 'z*'), answer('In what direction?', '!'),
        keys('s'), choose('Full list of keyboard commands', '?'), keys('\x1b'),
    ], [], 'BIND=~:known,!:getdir.self,s:search\n'),
    'command-autocompletion': recipe('command-autocompletion', 'Inspect and change extended command autocompletion.', [
        choose('autocompletions', '#optionsfull\r'), keys('\r'),
        choose('wizcustom:', ''), keys('\r\x1b'), keys('#?\r'), keys('\x1b\x1b'),
    ], [], 'AUTOCOMPLETE=wizwish,!wait\n'),
    'contextual-fountain-dip': recipe('contextual-fountain-dip', 'Choose a fountain dip, then supply its object through the command queue.', [
        keys('#levelchange\r'), answer('To what experience level', '30\r'),
        ...Array.from({ length: 4 }, (_, attempt) => [
            ...wish('fountain', `uncursed potion of acid named catalyst ${attempt}`), identify(),
            choose('Dip something into the fountain', '#herecmdmenu\r'),
            choose(`named catalyst ${attempt}`, '*'), keys(':'),
        ]).flat(),
    ]),
    'wizard-dungeon-layout': recipe('wizard-dungeon-layout', 'Read the wizard dungeon and branch layout.', [keys('#wizwhere\r'), keys('     \x1b')]),
    'wizard-hidden-detection': recipe('wizard-hidden-detection', 'Reveal a concealed bear trap.', [
        ...wish('bear trap trap'), keys('#wizdetect\r'), keys(':'),
    ]),
    'wizard-map-replacement': recipe('wizard-map-replacement', 'Replace a level containing a named monster.', [
        ...create('peaceful lichen'), keys('#wizmakemap\r'), keys('#wizborn\r'), keys('     \x1b'),
    ]),
    'wizard-monster-migration': recipe('wizard-monster-migration', 'Send existing monsters to the next level and list them.', [
        ...create('peaceful lichen'), ...create('peaceful newt'), keys('#migratemons\r'),
        answer('How many random monsters to migrate', '-2\r'), keys('#migratemons\r'),
        answer('List which?', 'a'), keys(' '), answer('How many random monsters to migrate', '\r'),
    ]),
    'wizard-timer-queue': recipe('wizard-timer-queue', 'Light a lamp and inspect its timeout.', [
        ...lamp(), keys('#timeout\r'), keys('     \x1b'),
    ]),
    'wizard-mobile-lights': recipe('wizard-mobile-lights', 'Light a lamp and inspect its mobile light source.', [
        ...lamp(), keys('#lightsources\r'), keys(' \x1b'),
    ]),
    'wizard-custom-glyphs': recipe('wizard-custom-glyphs', 'Inspect glyph customization under DECgraphics.', [keys('#wizcustom\r'), keys(' \x1b')]),
    'wizard-memory-statistics': recipe('wizard-memory-statistics', 'Count carried, contained, and monster-owned objects.', [
        ...filledSack(), ...create('peaceful gnome'), keys('#stats\r'), keys('       \x1b'),
    ]),
    'escape-with-valuables': recipe('escape-with-valuables', 'Escape carrying an artifact, gems, and an amulet.', [
        ...wish('uncursed Magicbane', 'uncursed diamond', 'uncursed diamond', 'uncursed ruby', 'uncursed amulet of reflection'),
        keys('\x14'), answer('Where do you want to be teleported?', '<.'), keys('<'),
        answer('Beware, there will be no return!', 'y'),
        ...disclosureAnswers(), keys(' ', true),
    ], ['disclose:-i -a -v -g -c -o', '!toptenwin']),
    'quit-container-disclosure': recipe('quit-container-disclosure', 'Quit and inspect the contents of a carried sack.', [
        ...filledSack(), keys('#quit\r'), answer('Really quit without saving?', 'y'),
        answer('Dump core?', 'n'), keys('> ', true),
    ], ['disclose:+i -a -v -g -c -o', '!toptenwin']),
    'manual-character-selection': startup('manual-character-selection', [
        answer('Shall I pick', 'n'), choose('Wizard', ''), choose('human', ''),
        choose('male', ''), choose('neutral', ''), answer('Is this ok?', 'y'),
    ]),
    'random-character-selection': startup('random-character-selection', [answer('Shall I pick', 'y'), answer('Is this ok?', 'y')]),
    'filtered-character-selection': startup('filtered-character-selection', [
        answer('Shall I pick', 'n'), answer('Pick a role or profession', '~'),
        choose('Rogue', ''), keys('\r'), answer('Pick a role or profession', '*'),
        answer('Pick a race or species', '*'), answer('Pick a gender or sex', '*'),
        answer('Pick an alignment or creed', '*'), answer('Is this ok?', 'y'),
    ]),
    'random-config-character': startup('random-config-character', [], 'OPTIONS=role:random,race:random,gender:random,align:random\n'),
};
for (const [choice, name] of [['0', 'random'], ['1', 'vertical'], ['2', 'horizontal'], ['3', 'both']]) {
    if (!choice || !name)
        throw new Error('Missing level flip choice');
    const key = `wizard-flip-${name}`;
    EFFECTS[key] = [['flip offered', /Flip 0=randomly, 1=vertically, 2=horizontally, 3=both:/]];
    ROUND20_RECIPES[key] = recipe(key, `Flip the live level ${name}.`, [keys('#wizfliplevel\r'), answer('Flip 0=randomly', choice), keys(':')]);
}
export function validateRound20Recipe(name, session) {
    const screens = session.segments.flatMap(segment => (segment.steps ?? []).map(step => step.screen.replace(/\x1b\[(\d+)C/g, (_, count) => ' '.repeat(Number(count)))
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')));
    const text = screens.join('\n');
    const checks = [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effectsFor(name).map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
    if (name.startsWith('wizard-flip-')) {
        const prompt = screens.map(screen => screen.includes('Flip 0=randomly')).lastIndexOf(true);
        checks.push({ check: 'map redisplayed after accepting the flip',
            ok: screens.slice(prompt + 1).some(screen => !screen.includes('Flip 0=randomly')
                && screen.split('\n').slice(1, 22).some(row => row.includes('@'))), evidence: '' });
    }
    if (name.includes('movement') || name.startsWith('rush-'))
        checks.push({ check: 'movement keys accepted', ok: !text.includes('Unknown command'), evidence: '' });
    return checks;
}
function recipe(name, description, actions, options = [], config = '') {
    return {
        roles: ['wizard'], options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: effectsFor(name).map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc() + config, driver: actions }],
    };
}
function startup(name, actions, config = '') {
    const entry = recipe(name, 'Choose a legal character through native startup selection.', actions);
    entry.roles = null;
    entry.characterSelection = 'startup';
    entry.build = ({ seed, datetime, rc }) => [{ seed, datetime,
            nethackrc: rc().replace(/,(?:role|race|gender|align):[^,\n]+/g, '') + config,
            driver: [...actions, keys(':')],
        }];
    return entry;
}
function effectsFor(name) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`Missing effects for ${name}`);
    return effects;
}
function movement(directions, keypad = false) {
    // Ctrl-H erases a typed count, so use it without a count to rush west.
    // Numeric keypad counts require the native 'n' prefix.
    return [
        ...[...directions].flatMap(direction => [keys(keypad ? `n2g${direction}`
                : direction === 'h' ? '\b' : `2${String.fromCharCode(direction.charCodeAt(0) & 31)}`), keys(':')]),
        ...[...directions].flatMap(direction => [keys(keypad ? `n2G${direction}` : `2${direction.toUpperCase()}`), keys(':')]),
    ];
}
function filledSack() {
    return [...wish('uncursed empty sack named luggage', 'uncursed diamond named cargo'), identify(),
        choose('sack named luggage', 'a*'), answer('Your sack', 'i'),
        choose('Gems/Stones', ''), keys('\r'), choose('diamond named cargo', ''), keys('\r'), answer('Do what with', 'q')];
}
function lamp() {
    return [...wish('uncursed oil lamp'), identify(), choose('oil lamp', 'a*')];
}
function wish(...items) {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}
function create(monster) {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')];
}
function disclosureAnswers() {
    return ['Do you want to see your possessions?', 'Do you want to see your attributes?',
        'Do you want an account of creatures vanquished?', 'Do you want a list of species genocided and extinct?',
        'Do you want to see your conduct?', 'Do you want to see the dungeon overview?'].map(prompt => answer(prompt, 'n'));
}
function identify() { return keys('\t\t\r'); }
function choose(target, openKeys) { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt, value) { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value, expectExit = false) { return { type: 'keys', value, dismissMore: true, ...(expectExit ? { expectExit: true } : {}) }; }
//# sourceMappingURL=round20-recipes.mjs.map