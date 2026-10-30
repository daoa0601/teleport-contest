const EFFECTS = {
    'query-spider-menu': [['spider actions offered', /s - Spin a web/], ['web spun', /You spin a web/]],
    'orc-supplemental-lore': [['orc named', /Zugzug of Mordor/], ['horde lore read', /member of a marauding horde of orcs/]],
    'stone-mimic-disguises': [['stone disguise revealed', /(?:That|Those).+(?:actually is |are |is )(?:a |an |the )?(?:sleeping )?small mimic!/]],
    'polymorph-boulder-piles': [['pile transformed', /You feel shuddering vibrations/], ['objects inspected', /Things that are here/]],
    'leap-day-glove-demand': [['gloves demanded', /you owe me .+gloves and eleven more pairs of\s+gloves/i]],
    'hilite-rule-editor': [
        ['numeric hitpoint rule added', /Added hilite hitpoints\/<20\/red/],
        ['change rule added', /Added hilite hitpoints\/down\/green/],
        ['alignment text rule added', /Added hilite alignment\/neutral\/blue/],
        ['condition rule added', /Added hilite condition\/Blind/],
        ['rules exported', /OPTIONS=hilite_status: alignment\/neutral\/blue/],
        ['condition menu sorted by rank', /sorted by ranking/],
    ],
    'hilite-config-reset': [
        ['configured rules counted', /status highlight rules\s+\[\(3 currently set\)\]/],
        ['highlighting disabled', /statushilites\s*\[0 \(off:/],
        ['highlighting enabled', /statushilites\s*\[3 \(on:/],
        ['surviving config rule exported', /OPTIONS=hilite_status: hitpoints\/always\/blue/],
    ],
    'help-file-pages': [
        ['command help', /Move commands:/],
        ['option menu help', /[Uu]sing the '[Oo]' command|[Ss]etting [Oo]ptions|[Oo]ptions [Mm]enu/],
        ['usage help', /This is a terse description of nethack's command line arguments/],
        ['license', /NETHACK GENERAL PUBLIC LICENSE/],
        ['debug command help', /[Ww]izard.mode commands|[Ww]izard mode commands/],
    ],
    'extended-command-menu': [['command menu opened', /Extended Command:/], ['version displayed', /NetHack Version/]],
    'distant-command-menu': [['distant action offered', /Travel here/], ['throw offered', /Throw something/]],
    'counted-search-occupation': [['turn count advances through search', /T:6\b/]],
    'query-response-menu': [['hand choice shown', /Right\s*\n.*Left/], ['ring worn', /ring of protection \(on (?:right|left) hand\)/], ['prayer default offered', /n \* No/]],
    'variable-inventory-letters': [['used slots listed', /Inventory letters used/], ['item moved', /(?:Moving|Swapping):.*named letter target/]],
    'death-novel-conversation': [['Death recognizes the novel', /AH, SO YOU HAVE A COPY OF \/[^\n]+\//]],
    'tree-embedded-fruit': [['fruit located in tree', /apple dangling in a tree/], ['nonfruit located in tree', /dagger stuck in a tree/]],
    'shop-unpaid-inventory': [['unpaid inventory listed', /named billed cargo.*zorkmids/], ['unpaid filter offered', /What kinds of thing do you want to drop\? \[[^\n]*u/]],
};
export const ROUND24_RECIPES = {
    'query-spider-menu': recipe('query-spider-menu', 'Choose web spinning through the spider ability response menu.', [
        ...room(), keys('ml#polyself\r'), answer('Become what kind of monster?', 'cave spider\r'),
        keys('#monster\r'), choose(' - Spin a web', ''),
    ], ['query_menu']),
    'orc-supplemental-lore': recipe('orc-supplemental-lore', 'Read the extra lore for a named marauding orc.', [
        ...room(), ...create('peaceful orc'), keys('#name\r'), choose('a monster', ''),
        answer('(For instructions type', 'm.'), answer('What do you want to call', 'Zugzug of Mordor\r'),
        keys('/y'), answer('(For instructions type', 'm.'), answer('More info about', 'y'), answer('More info about', 'y'),
    ]),
    'stone-mimic-disguises': recipe('stone-mimic-disguises', 'Cast stone to flesh on mimics hiding as stone objects or furniture.', [
        ...room(),
        ...Array.from({ length: 4 }, () => [
            ...create('8 peaceful sleeping small mimic'),
            ...[...'hykulnjb'].flatMap(direction => [choose('stone to flesh', '#wizcast\r'), answer('In what direction?', direction)]),
            ...clearMonsters(),
        ]).flat(),
    ]),
    'polymorph-boulder-piles': recipe('polymorph-boulder-piles', 'Polymorph piles with several boulders, leaving resistant boulders on top.', [
        ...room(), ...wish('uncursed wand of polymorph (0:20)'), identify(),
        ...Array.from({ length: 8 }, () => [
            ...wish(...Array.from({ length: 12 }, () => 'boulder')), choose('wand of polymorph', 'z*'),
            answer('In what direction?', '>'), keys(':\x1b'),
        ]).flat(),
    ]),
    // mhitu.c:ld() selects this dialogue on February 29; it requires a male hero.
    'leap-day-glove-demand': { genders: ['male'], datetime: '20000229090000', ...recipe('leap-day-glove-demand', 'Refuse a succubus while carrying gloves on leap day.', [
            ...room(), ...wish('uncursed leather gloves'), identify(),
            ...Array.from({ length: 12 }, () => [keys('Wb'), ...create('hostile female amorous demon'),
                ...Array.from({ length: 8 }, () => [answer('"Shall I remove your', 'n'), keys('m.'), answer('Die?', 'n')]).flat(),
            ]).flat(),
        ]) },
    'hilite-rule-editor': recipe('hilite-rule-editor', 'Edit numeric, changing, text and condition status rules, then remove a rule.', [
        choose('status highlight rules', 'O'), choose('hitpoints', ''), choose('Number threshold', ''),
        answer('Enter value for hitpoints threshold:', '20\r'), choose('Less than 20', ''), choose('red', ''), keys('\r'),
        choose('Add new hilites', ''), keys('\r'), choose('hitpoints value changes', ''), choose('Value goes down', ''), choose('green', ''), keys('\r'),
        keys('\x1b'), choose('hitpoints', ''), choose('hitpoints/<20', ''), choose('Remove selected hilites', ''), keys('\r'),
        choose('alignment', ''), choose('alignment text match', ''), choose('neutral', ''), choose('blue', ''), keys('\r\x1b'),
        choose('condition', ''), choose('Blind', ''), keys('\r'), choose('orange', ''), choose('inverse', ''), keys('\r\x1b'),
        choose('View all hilites in config format', ''), keys('\x1b'),
        choose('status condition fields', 'O'), choose('change sort order', ''), keys('\r\x1b\x1b'),
    ]),
    'hilite-config-reset': recipe('hilite-config-reset', 'Parse config rules and reset unchanged status fields by changing highlight duration.', [
        choose('status highlight rules', 'O'), choose('View all hilites in config format', ''), keys('\x1b\x1b'),
        choose('statushilites', '#optionsfull\r'), keys('\r'), answer('Set statushilites to what?', '0\r'), keys('\x1b'),
        choose('statushilites', '#optionsfull\r'), keys('\x1b'), choose('statushilites', '#optionsfull\r'), keys('\r'), answer('Set statushilites to what?', '3\r'), keys('\x1b'), choose('statushilites', '#optionsfull\r'), keys('\x1b'),
    ], ['statushilites:3', 'hilite_status:hp/red', '!hilite_status:x', 'hilite_status:hp/blue alignment/neutral/green condition/blind/orange']),
    'help-file-pages': recipe('help-file-pages', 'Read the command, option menu, usage, license and wizard help files.', [
        choose('List of game commands', '?'), choose('Using the', '?'), choose("Description of NetHack's command line", '?'),
        choose('The NetHack license', '?'), choose('List of wizard-mode commands', '?'),
    ]),
    'extended-command-menu': recipe('extended-command-menu', 'Choose a command through the letter-grouped extended-command menu.', [
        choose('version', '#'), choose('version', ''),
    ], ['extmenu']),
    'distant-command-menu': recipe('distant-command-menu', 'Open the keyboard command menu for a distant square.', [
        ...room(), ...Array.from({ length: 4 }, () => [keys('ml'), ...wish('floor')]).flat(), keys('mhmhmhmh#therecmdmenu\r'), answer('In what direction?', '_'), answer('(For instructions type', 'll,'), keys('\x1b'),
    ]),
    'counted-search-occupation': recipe('counted-search-occupation', 'Finish a counted search through the timed occupation.', [keys('5s:')]),
    'query-response-menu': recipe('query-response-menu', 'Choose a hand and decline prayer through query menus.', [
        ...wish('uncursed ring of protection'), identify(), choose('ring of protection', 'P*'), choose(' - Right', ''),
        keys('#pray\r'), answer('Are you sure you want to pray?', '\r'),
    ], ['query_menu']),
    'variable-inventory-letters': recipe('variable-inventory-letters', 'Reassign inventory letters and inspect used slots while adjusting an item.', [
        ...wish('uncursed dagger named letter target'), identify(), choose('named letter target', '#adjust\r*'),
        answer('Adjust letter to what', '?'), choose('quarterstaff', ''), keys('i\x1b'),
    ], ['!fixinv']),
    'death-novel-conversation': recipe('death-novel-conversation', 'Chat with Death while carrying a Discworld novel.', [
        ...room(), ...wish('uncursed novel named Thud!'), ...create('peaceful Death'),
        ...[...'hykulnjb'].flatMap(direction => [keys('#chat\r'), answer('Talk to whom?', direction)]),
    ]),
    'tree-embedded-fruit': recipe('tree-embedded-fruit', 'Detect fruit and another object inside trees and inspect their descriptions.', [
        ...room(), ...wish('uncursed apple', 'uncursed dagger', 'blessed potion of object detection'), identify(),
        choose('apple', 'd*'), ...wish('tree'), keys('ml'), choose('dagger', 'd*'), ...wish('tree'), keys('ml'),
        choose('potion of object detection', 'q*'), keys('\x1b;hh.\x1b;h.\x1b'),
    ]),
    'shop-unpaid-inventory': recipe('shop-unpaid-inventory', 'List a single unpaid item and filter an inventory query to unpaid goods.', [
        ...room(), ...lightingShop(), ...wish('uncursed oil lamp named billed cargo'), identify(), choose('named billed cargo', 'd*'),
        answer('Izchak offers', 'y'), choose('named billed cargo', 'm,'), keys('\rIu\x1b'),
        keys('D'), answer('What kinds of thing do you want to drop?', 'u\r'), answer('What would you like to drop?', '\x1b'), keys('\x1bD'), answer('What kinds of thing do you want to drop?', 'B\r'), keys('q'),
    ], ['menustyle:traditional']),
};
function recipe(name, description, actions, options = []) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-24 recipe ${name}`);
    return {
        roles: ['wizard'], options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: effects.map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [...actions, keys('\x1b:\x1b')] }],
    };
}
export function validateRound24Recipe(name, session) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-24 recipe ${name}`);
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}
function room() {
    const actions = [keys('#levelchange\r'), answer('To what experience level', '20\r'),
        keys('#wizintrinsic\r 5000'), choose('pass thru walls', ''), keys('\r'),
        ...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r'), keys('mhmk')];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            actions.push(...wish('fountain', 'floor'));
            if (column < 2)
                actions.push(keys(row % 2 === 0 ? 'ml' : 'mh'));
        }
        if (row < 2)
            actions.push(keys('mj'));
    }
    actions.push(keys('mhmk'));
    return actions;
}
function lightingShop() {
    return [keys('#wizintrinsic\r5000'), choose('monster detection', ''), keys('\r'), ...wish('blessed potion of object detection'), identify(),
        choose('minetn', 'm\x16'), choose('potion of object detection', 'q*'), keys('\x1b#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!'), choose('candle', 'o'), keys('.')];
}
function wish(...items) { return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]); }
function create(monster) { return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')]; }
function clearMonsters() {
    return [...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r')];
}
function wait(turns) {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Call ', '\r'), answer('Die?', 'n')]).flat();
}
function identify() { return keys('\t\t\r'); }
function choose(target, openKeys) { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt, value) { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value) { return { type: 'keys', value, dismissMore: true }; }
//# sourceMappingURL=round24-recipes.mjs.map