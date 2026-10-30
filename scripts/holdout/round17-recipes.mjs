// Each recipe documents the observable native effects a recording must show.
// Regexes accept every C-valid outcome; they never pin a lucky seed.
const EFFECTS = {
    'status-hilite-rules': [
        ['hitpoint percentage rule added', /Added hilite hitpoints\/<10%\//],
        ['criticalhp rule added', /Added hilite hitpoints\/criticalhp\//],
        ['condition rule added', /Added hilite condition\/Blind/],
        ['rules viewed in config format', /OPTIONS=hilite_status: (?:hitpoints|condition)\//],
        ['blind condition displayed', /^.*Blind\b.*$/m],
    ],
    'status-hilite-config': [
        ['config rules counted in options menu', /status highlight rules\s*\[\((\d+) currently set\)\]/],
        ['armor status field shown', / GAHB/],
        ['weapon status field shown', / 2H-Staff/],
        ['experience points shown', /Xp:\d+\/\d+/],
    ],
    'discovery-sorts': [
        ['sort menu offered', /Ordering of discoveries/],
        ['alphabetized listing shown', /Discoveries, alphabetical across all classes/],
        ['sortloot order listing shown', /Discoveries, sortloot order/],
        ['class discoveries shown', /Discovered [A-Za-z]+ in /],
        ['object type called', /Call an? .*:/],
        ['call name removed from type', /never heard|update_inventory|What do you want to name\?/],
    ],
    'inventory-classes': [
        ['class inventory shown', /What type of object do you want an inventory of\?/],
        ['drop chain prompt shown', /What kinds of thing do you want to drop\?/],
        ['askchain per-item drop', /\? \[ynaq\] \(n\)/],
    ],
    'identify-and-probe': [
        ['identify scroll read', /As you read the scroll, it disappears|What would you like to identify/],
        ['second pass identified all', /a - |b - /],
        ['probed monster inventory shown', /The Mordor orc's possessions:/],
    ],
    'loot-container': [
        ['container looted', /You put 2 uncursed scrolls of light into the chest|You put .* into the chest/],
        ['container contents listed', /take something out/],
    ],
    'overview-annotation': [
        ['annotation recorded', /Level 1: "start"/],
        ['overview lists levels', /The Dungeons of Doom: levels?/],
        ['descent level named', /Level \d+: "second"/],
    ],
    'orctown-raid': [
        ['named orc inspected', /orc called Zugzug of Mordor/],
        ['monster given a name', /is now called|What do you want to call/],
        ['orc lore offered', /More info about "(?:[^"\n]*orc[^"\n]*|Uruk-hai)"/i],
    ],
    'plane-water': [
        ['arrived on the water plane', /air bubble surrounded by water/],
        ['returned to the water plane', /materialize on a different level/],
    ],
    'plane-air-fire': [
        ['arrived on the air plane', /floating on air|suspended in air|air/i],
        ['arrived on the fire plane', /lava|fire|hot/i],
        ['fumarole heard', /whoosh|gas cloud/],
    ],
    'naming-calls': [
        ['fruit renamed', /\[kumquat\]/],
        ['novel read', /You read|It's about|novel/],
        ['novel named canonically', /already has a published name|Thud|novel called/],
        ['mimic appearance described', /\(chest|gold piece|large box|statue\)|mimic/],
        ['coyote latin name shown', /coyote - [A-Z][a-z]+ [A-Z][a-z]+/],
    ],
    'help-tour': [
        ['commands file shown', /Move commands:/],
        ['options explanation shown', /Boolean options not under specific compile flags/],
        ['usage help shown', /This is a terse description of nethack's command line arguments/],
        ['license shown', /NETHACK GENERAL PUBLIC LICENSE/],
        ['whatdoes help shown', /Depending upon hardware or operating system/],
        ['extended command list shown', /rub\s*rub a lamp or a stone|levelchange\s*change experience level/],
    ],
};
const BASE_OPTIONS = ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger'];
function recipe(name, description, actions, roles = ['wizard'], options = []) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-17 recipe ${name}`);
    return {
        roles,
        options: [...BASE_OPTIONS, ...options],
        description,
        success: effects.map(([effect]) => effect),
        build: ({ seed, datetime, rc, character }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r'), answer('To what experience level', '20\r'),
                    ...(typeof actions === 'function' ? actions(character) : actions), keys('\x1b:\x1b'),
                ] }],
    };
}
export const ROUND17_RECIPES = {
    // botl.c status_hilite_menu(): add threshold, criticalhp and condition
    // rules through the "status highlight rules" row of the options menu,
    // view them in config format, remove one, and pick the conditions the
    // status line displays.
    'status-hilite-rules': recipe('status-hilite-rules', 'Add, view and remove status hilite rules through the options menu, then enable a condition.', [
        choose('status highlight rules', 'O'),
        choose('hitpoints', ''),
        choose('Percentage threshold', ''),
        answer('Enter percentage value for hitpoints threshold:', '10\r'),
        choose('Less than 10', ''),
        choose('red', ''),
        keys('\r'),
        choose('hitpoints/<10%', ''),
        choose('Remove selected hilites', ''),
        keys('\r'),
        choose('hitpoints', ''),
        choose('Highlight critically low hitpoints', ''),
        choose('yellow', ''),
        keys('\r'),
        keys('\x1b'),
        choose('View all hilites in config format', ''),
        choose('condition', ''),
        choose('blind', ''),
        choose('Stun', ''),
        keys('\r'),
        choose('red', ''),
        choose('inverse', ''),
        keys('\r'),
        keys('\x1b'),
        keys('\x1b'),
        choose('status condition fields', 'O'),
        keys('b\r'),
        keys('\x1b'),
        ...wish('uncursed blindfold'),
        choose('blindfold', 'P*'),
        keys('m.'),
        keys('R'),
    ]),
    // botl.c parse_status_hl1()/parse_status_hl2() via config rules, plus
    // armor_status(), weapon_status(), exp_percentage() through the showexp,
    // armorstatus, weaponstatus and terrainstatus options.
    'status-hilite-config': recipe('status-hilite-config', 'Load hilite_status rules from the config, show equipment and experience fields, then fight.', [
        choose('status highlight rules', 'O'),
        keys('\x1b\x1b'),
        ...wish('blessed +2 gray dragon scale mail', 'elven boots', 'leather gloves', 'elven leather helm', 'uncursed orcish shield'),
        keys('T'),
        choose('gray dragon scale mail', 'W*'),
        choose('boots', 'W*'),
        choose('gloves', 'W*'),
        choose('hat', 'W*'),
        choose('shield', 'W*'),
        keys('m.'),
        ...create('hostile sleeping ogre'),
        keys('Fl'), keys('Fh'), keys('Fk'), keys('Fj'),
        keys('m.'),
    ], ['wizard'], [
        'hilite_status: hitpoints/<10%/red',
        'hilite_status: hitpoints/10%/green&inverse',
        'hilite_status: experience-points/50%/blue',
        'hilite_status: condition/blind/orange&inverse',
        'showexp', 'armorstatus', 'weaponstatus', 'terrainstatus', 'hitpointbar',
    ]),
    // o_init.c choose_disco_sort()/disco_output_sorted()/discovered_cmp() and
    // do_name.c docall(): every discoveries ordering plus call/uncall of an
    // object type.
    'discovery-sorts': recipe('discovery-sorts', 'Browse discoveries in every sort order, call and uncall an object type.', [
        ...wish('uncursed potion of object detection', 'uncursed ring of protection', 'uncursed wand of make invisible (0:0)', 'uncursed scroll of mail', 'uncursed amulet of versus poison', 'uncursed spellbook of haste self'),
        identify(),
        choose('alphabetical across all classes', 'm`'),
        choose('potions', ''),
        keys('\\'),
        choose('sortloot order', 'm`'),
        choose('potions', ''),
        keys('\\'),
        choose('alphabetical within each class', 'm`'),
        choose('scrolls', ''),
        keys('\\'),
        choose('the type of an object in inventory', 'C'),
        keys('p'),
        answer('Call a ', 'shiny\r'),
        choose('the type of an object on discoveries list', 'C'),
        choose('called shiny', ''),
        answer('Call a ', 'silver band\r'),
        choose('the type of an object in inventory', 'C'),
        keys('p'),
        answer('Call a ', ' \r'),
        keys('\\'),
    ]),
    // invent.c ggetobj()/askchain()/sortloot comparators with the traditional
    // and combination menu styles.
    'inventory-classes': recipe('inventory-classes', 'Browse per-class inventories, drop through the traditional ask chain, and sort loot menus.', [
        ...wish('uncursed short sword', 'uncursed elven mithril-coat', 'uncursed scroll of light', 'uncursed potion of healing', 'uncursed food ration', 'uncursed tin whistle', 'uncursed worthless piece of green glass'),
        identify(),
        keys('I!\x1b\x1b'),
        keys('I%\x1b\x1b'),
        keys('Ia\x1b\x1b'),
        keys('Di\r'), keys('q'), keys('%\r'), keys('y'),
        keys('i'), keys('\x1b'),
    ], ['wizard'], ['menustyle:traditional', 'sortloot:full']),
    // invent.c menu_identify() via a blessed scroll of identify, and
    // display_minventory() by probing a created Mordor orc.
    'identify-and-probe': recipe('identify-and-probe', 'Identify several items through one blessed scroll menu, then probe a monster for its inventory.', [
        ...wish('uncursed potion of object detection', 'uncursed ring of protection from cold', 'uncursed wand of make invisible (0:0)', 'blessed scroll of identify named lesson', 'blessed scroll of identify named lesson', 'uncursed wand of probing (0:8)'),
        choose('named lesson', 'r?'),
        keys('\x1b'),
        choose('named lesson', 'r?'),
        keys('\x1b'),
        identify(),
        keys('i'), keys('\x1b'),
        ...create('hostile Mordor orc'),
        ...[...'hykulnjb'].flatMap(direction => [
            choose('wand of probing', 'z*'),
            answer('In what direction?', direction),
            keys('\x1b'),
        ]),
    ]),
    // invent.c loot menus: doloot on a chest with contents.
    'loot-container': recipe('loot-container', 'Loot a chest: put items in, take items out, and read the container menu.', [
        ...wish('uncursed locked chest', 'uncursed food ration', 'uncursed scroll of light', 'uncursed skeleton key'),
        identify(),
        choose('chest', 'd*'),
        keys('#loot\r'),
        answer('Unlock it with your skeleton key?', 'y'),
        keys('#loot\r'),
        answer('There is a chest here, loot it?', 'y'),
        choose('put something in', ''),
        choose('Comestibles', ''),
        choose('Scrolls', ''),
        keys('\r'),
        choose('of light', ''),
        keys('\r'),
        keys('#loot\r'),
        answer('There is a chest here, loot it?', 'y'),
        keys(':'),
        keys('\x1b'),
    ]),
    // dungeon.c dooverview()/donamelevel()/print_dungeon() and do.c
    // next_level(): annotate two levels, fall through a wished hole to an
    // unconnected level below, then browse the overview.
    'overview-annotation': recipe('overview-annotation', 'Annotate levels, fall through a hole to the next level, and read the level overview.', [
        keys('#annotate\r'), answer('What do you want to call this dungeon level?', 'start\r'),
        keys('\x162\r'),
        keys('#annotate\r'), answer('What do you want to call this dungeon level?', 'second\r'),
        ...wish('hole'),
        keys('>'),
        keys('#annotate\r'), answer('What do you want to call this dungeon level?', 'third\r'),
        keys('\x0f'),
        keys(':'),
    ]),
    // do_name.c do_mgivenname() and pager.c do_supplemental_info() in
    // Minetown. Ransacked variants also generate the named orc horde.
    'orctown-raid': recipe('orctown-raid', 'Visit Minetown, name a created orc, and read its lore.', [
        choose('minetn', 'm\x16'),
        ...wish('blessed +2 gray dragon scale mail'),
        keys('T'),
        choose('gray dragon scale mail', 'W*'),
        ...Array.from({ length: 10 }, () => [keys('m.'), answer('Call ', '\r')]).flat(),
        keys(':'),
        ...create('hostile orc'),
        keys('#name\r'),
        choose('a monster', ''),
        answer('(For instructions type', 'm.'),
        answer('What do you want to call', 'Zugzug of Mordor\r'),
        keys('/y'),
        answer('(For instructions type', 'm.'),
        answer('More info about', 'y'),
        keys(':'),
    ]),
    // mkmaze.c setup_waterlevel()/movebubbles()/set_wportal() and
    // restore_waterlevel(): visit the Plane of Water twice.
    'plane-water': recipe('plane-water', 'Travel to the Plane of Water, drift with the bubbles, leave and return.', [
        ...wish('blessed amulet of magical breathing', 'blessed +2 gray dragon scale mail'),
        identify(),
        keys('T'),
        choose('gray dragon scale mail', 'W*'),
        choose('amulet of magical breathing', 'P*'),
        choose('water: -4', 'm\x16'),
        answer('For what do you wish?', 'uncursed apple\r'),
        keys(':'),
        keys('m.'), keys('m.'),
        keys('h'), keys('l'),
        keys(':'),
        answer('For what do you wish?', 'uncursed apple\r'),
        choose('fire: -3', 'm\x16'),
        keys(':'),
        answer('For what do you wish?', 'uncursed apple\r'),
        choose('water: -4', 'm\x16'),
        keys('m.'), keys('m.'),
        keys(':'),
    ]),
    // mkmaze.c movebubbles() clouds on the Plane of Air and fumaroles() on
    // the Plane of Fire.
    'plane-air-fire': recipe('plane-air-fire', 'Travel to the Plane of Air and the Plane of Fire and wait for fumaroles.', [
        ...wish('blessed ring of levitation', 'blessed fireproof +3 gray dragon scale mail', 'uncursed ring of fire resistance'),
        choose('gray dragon scale mail', 'W*'),
        choose('air: -2', 'm\x16'),
        answer('For what do you wish?', 'uncursed apple\r'),
        keys(':'),
        keys('m.'), keys('l'),
        choose('fire: -3', 'm\x16'),
        answer('For what do you wish?', 'uncursed apple\r'),
        keys(':'),
        keys('m.'), keys('m.'), keys('m.'), keys('m.'), keys('m.'),
        keys(':'),
    ]),
    // do_name.c docall()/do_oname() fruits and novels, objnam.c
    // mimic_obj_name() and pager.c coyotename().
    'naming-calls': recipe('naming-calls', 'Call a fruit, read and name a novel, look at a disguised mimic and a coyote.', [
        ...wish('uncursed slime mold', 'uncursed novel'),
        identify(),
        choose('fruit', 'O'),
        answer('Set fruit to what?', 'kumquat\r'),
        keys('\x1b'),
        keys('\x17'), answer('For what do you wish?', 'kumquat\r'),
        choose('novel', '#adjust\r*'),
        answer('Adjust letter to what', 'Z\r'),
        keys('C'),
        choose('a particular object in inventory', ''),
        keys('Z'),
        keys('rZ'),
        keys('\x1b'),
        ...create('small mimic'),
        keys(';'), answer('Pick a monster, object or location.', 'm.'),
        ...create('coyote'),
        keys(';'), answer('Pick a monster, object or location.', 'm.'),
        keys('i'), keys('\x1b'),
    ]),
    // pager.c dohelp() menu files, dowhatdoes()/whatdoes_help(),
    // hmenu_doextlist() and look_engrs().
    'help-tour': recipe('help-tour', 'Read the help menu files, ask what a key does, list extended commands and engravings.', [
        keys('E'), answer('What do you want to write with?', '-'),
        answer('What do you want to write', 'Elbereth\r'),
        choose('List of game commands', '?'),
        choose('Longer explanation of game options', '?'),
        choose("Description of NetHack's command line", '?'),
        choose('The NetHack license', '?'),
        choose('List of wizard-mode commands', '?'),
        choose('List of extended commands', '?'),
        keys('\x1b'),
        keys('&'), answer('What command?', '?'),
        keys('&'), answer('What command?', 'i'),
        choose('Info on a character in the game display', '?'),
        choose('nearby engravings', ''),
        keys(':'),
    ]),
};
export function validateRound17Recipe(name, session) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-17 recipe ${name}`);
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}
function keys(value) {
    return { type: 'keys', value, dismissMore: true };
}
function wish(...items) {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}
function create(monster) {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`)];
}
function identify() {
    return keys('\t\t\r');
}
function choose(target, openKeys) {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}
function answer(prompt, value) {
    return { type: 'answer-prompt', prompt, value, dismissMore: true };
}
//# sourceMappingURL=round17-recipes.mjs.map