const EFFECTS = {
    'vampire-shape-revival': [['vampire rises in its original form', /rises as a vampire/]],
    'polymorphed-self-genocide': [['living form survives self-genocide', /You feel dead inside/]],
    'contained-corpse-revival': [['corpse escapes its container', /(?:troll|sack).*(?:out of|resurrect|reviv|moves)|startled/i]],
    'cursed-whistle-teleport': [['cursed whistle hums', /high-pitched humming noise/]],
    'wizard-intervention': [['Wizard killed', /kill the Wizard of Yendor/]],
    'mounted-polymorph': [['steed changes while ridden', /adjust yourself in the saddle on your new/]],
    'pet-revival-traits': [['pet revived', /(?:little dog|dog) (?:rises|is resurrected|comes alive)|corpse.*(?:life|alive)/]],
    'mimic-key-absorption': [['mimic takes a key', /(?:pulls .* away from you and absorbs|mimic absorbs)/]],
    'pet-starvation': [['pet dies of hunger', /(?:dog|kitten|cat) starves/]],
    'divine-crowning': [['hero crowned', /Hand of Elbereth|Envoy of Balance|chosen to .*My Glory/]],
    'amulet-high-altar': [['Amulet accepted by a deity', /offer the Amulet of Yendor to/], ['final judgment', /ascend to the status of Demigod|cloud of .* smoke surrounds you/]],
    'shop-usage-debt': [['usage charged', /owe .* for (?:the )?use|[Uu]sage fee|bill for .*use/], ['debt reported', /owe Izchak [1-9][0-9]* zorkmids/]],
    'shop-stack-splitting': [['stack billed', /named billed candles.*unpaid/], ['financial report', /owe Izchak [1-9][0-9]* zorkmids/]],
    'shop-container-theft': [['teleport wand used', /What do you want to zap/], ['container contents stolen', /owe Izchak [1-9][0-9]* zorkmids|escaped the shop without paying|[Tt]hief/]],
    'shopkeeper-revival': [['resident revived', /Izchak (?:is resurrected|rises|comes alive)|corpse.*(?:alive|life)/]],
    'minetown-fountain-warning': [['watch warns about the fountain', /stop using that fountain|earnestly (?:waves|shakes)/]],
    'sticky-form-release': [['victim released', /is no longer in your clutches/]],
    'swamp-level-generation': [['swamp entered', /looks rather muddy down here|feels rather humid down here|smell marsh gas|hear mosquitoes/]],
    'mounted-floor-reach': [['rider cannot reach the floor', /aren.t skilled enough to reach from/]],
    'traditional-spell-selection': [['spell letter requested', /Cast which spell\?/], ['casting resolved', /You bash yourself|You fail to cast the spell correctly|In what direction/]],
};
export const ROUND26_RECIPES = {
    'vampire-shape-revival': recipe('vampire-shape-revival', 'Kill a vampire bat that is a shifted vampire.', [
        ...prepare(), choose('monpolycontrol', '#optionsfull\r'), keys('\r\x1b'),
        ...create('hostile sleeping vampire'), answer('Change ', 'vampire bat\r'),
        keys('#wizkill\r'), answer('Pick first monster to slay:', 'm.'), keys('\x1b'),
        answer('Change ', 'vampire\r'),
    ]),
    'polymorphed-self-genocide': recipe('polymorphed-self-genocide', 'Genocide the human race while in a living nonhuman form.', [
        ...prepare(), ...polyself('red dragon'), ...wish('uncursed scroll of genocide'), identify(),
        choose('of genocide', 'r*'), answer('What type of monster do you want to genocide?', 'human\r'),
    ]),
    'contained-corpse-revival': recipe('contained-corpse-revival', 'Wait for a troll corpse inside a carried sack to revive.', [
        ...prepare(), ...wish('uncursed empty sack', 'uncursed troll corpse'), identify(),
        choose('sack', 'a*'), answer('Your sack', 'i'), choose('Comestibles', ''), keys('\r'),
        choose('troll corpse', ''), keys('\r'), ...wait(100),
    ]),
    'cursed-whistle-teleport': recipe('cursed-whistle-teleport', 'Blow a cursed magic whistle with a pet on the level.', [
        ...prepare(), ...create('tame little dog'), ...wish('cursed magic whistle'), identify(),
        ...Array.from({ length: 30 }, () => [choose('magic whistle', 'a*')]).flat(),
    ]),
    'wizard-intervention': recipe('wizard-intervention', 'Kill the Wizard and wait through his first harassment timer.', [
        ...prepare(), ...create('hostile sleeping Wizard of Yendor'), keys('#wizkill\r'),
        answer('Pick first monster to slay:', 'm.'), keys('\x1b'), ...wait(350),
    ]),
    'mounted-polymorph': { ...recipe('mounted-polymorph', 'Polymorph a ridden pony into a horse under monster polymorph control.', [
            ...room(), ...wish('uncursed wand of polymorph (0:20)'), identify(),
            choose('monpolycontrol', '#optionsfull\r'), keys('\r\x1b'), ...create('tame saddled pony'),
            ...[...'hykulnjb'].flatMap(direction => [keys('#ride\r'), answer('In what direction?', direction),
                answer('Force the mount to succeed?', 'y'), choose('wand of polymorph', 'z*'),
                answer('In what direction?', '>'), answer('Change ', 'horse\r')]),
        ]), roles: ['knight'] },
    'pet-revival-traits': recipe('pet-revival-traits', 'Revive a slain pet and restore its saved traits.', [
        ...room(), ...wish('uncursed wand of undead turning (0:100)'), identify(),
        ...Array.from({ length: 10 }, () => [...create('tame little dog'),
            keys('#wizkill\r'), answer('Pick first monster to slay:', 'm.'), keys('\x1b'),
            ...[...'hykulnjb'].flatMap(direction => [choose('wand of undead turning', 'z*'), answer('In what direction?', direction)])]).flat(),
    ]),
    'mimic-key-absorption': recipe('mimic-key-absorption', 'Poke door-disguised mimics with keys until one absorbs a key.', [
        ...prepare(),
        ...Array.from({ length: 4 }, () => [
            ...Array.from({ length: 8 }, (_, index) => [keys(`m${'hykulnjb'[index]}`), ...wish('wall', 'open door'), keys(`m${'lnjbhyku'[index]}`)]).flat(),
            ...create('hostile sleeping small mimic'),
            ...[...'hykulnjb'].flatMap(direction => [...wish('uncursed skeleton key'), identify(), choose('skeleton key', 'a*'), answer('In what direction?', direction), answer('Unlock it?', 'n'), answer('Lock it?', 'n')]), ...clearMonsters(),
        ]).flat(),
    ]),
    'pet-starvation': recipe('pet-starvation', 'Wait without feeding a tame carnivorous pet.', [
        ...room(), ...intrinsic('monster detection'), ...create('tame little dog'), ...wait(2000),
    ]),
    'divine-crowning': { ...recipe('divine-crowning', 'Build alignment and luck, then pray until crowned.', [
            ...room(), ...wait(2000), ...clearMonsters(), ...wish('neutral altar', 'blessed luckstone'),
            ...Array.from({ length: 25 }, () => [...create('hostile sleeping orc'), keys('#wizkill\r'), answer('Pick first monster to slay:', 'm.'), keys('\x1b')]).flat(),
            ...wish(...Array.from({ length: 24 }, () => 'uncursed red dragon corpse')),
            ...Array.from({ length: 24 }, () => [keys('#offer\r'), answer('There are ', 'y'), answer('There is ', 'y'), answer('Gift an artifact?', 'n')]).flat(),
            ...Array.from({ length: 32 }, () => [keys('#pray\r'), answer('Are you sure you want to pray?', 'y'), answer('Force the gods to be pleased?', 'y'), ...wait(4)]).flat(),
        ]), roles: ['wizard'] },
    'amulet-high-altar': recipe('amulet-high-altar', 'Offer the real Amulet at an Astral high altar.', [
        ...prepare(), ...intrinsic('monster detection'), choose('astral', 'm\x16'), answer('For what do you wish?', 'nothing\r'),
        ...clearMonsters(), keys('#wizmap\r\x14'), answer('Where do you want to be teleported?', '!_.'),
        ...wish('Amulet of Yendor'), identify(), choose('Amulet of Yendor', '#offer\r*'),
        ...disclose(), { type: 'keys', value: '', dismissMore: true, expectExit: true },
    ]),
    'shop-usage-debt': recipe('shop-usage-debt', 'Use an unpaid wand and request the financial report.', [
        ...prepare(), ...lightingShop(), ...wish('uncursed wand of light (0:10) named rental'), identify(),
        ...sellAndPick('named rental'), choose('named rental', 'z*'), keys('$'),
    ]),
    'shop-stack-splitting': recipe('shop-stack-splitting', 'Split billed candles and inspect the remaining debt.', [
        ...prepare(), ...lightingShop(), ...wish(...Array.from({ length: 6 }, () => 'uncursed wax candle named billed candles')), identify(),
        ...sellAndPick('named billed candles'), choose('named billed candles', 'd1*'), keys('$'),
    ]),
    'shop-container-theft': recipe('shop-container-theft', 'Steal a sold sack with its merchandise still inside.', [
        ...prepare(), ...lightingShop(), ...wish('uncursed empty sack', 'uncursed wax candle named packed cargo'), identify(),
        choose('sack', 'a*'), answer('Your sack', 'i'), choose('Tools', ''), keys('\r'), choose('named packed cargo', ''), keys('\r'),
        ...sellAndPick('sack'),
        ...wish('uncursed wand of teleportation (0:20)'), identify(), choose('sack', 'd*'), choose('wand of teleportation', 'z*'), answer('In what direction?', '>'),
    ]),
    'shopkeeper-revival': recipe('shopkeeper-revival', 'Kill and revive the resident shopkeeper from his corpse.', [
        ...prepare(), ...lightingShop(), ...wish('uncursed wand of undead turning (0:20)'), identify(),
        keys('#wizkill\r'), answer('Pick first monster to slay:', 'm'), choose('Izchak', ''), keys('.\x1b'),
        ...[...'hykulnjb'].flatMap(direction => [choose('wand of undead turning', 'z*'), answer('In what direction?', direction)]),
    ]),
    'minetown-fountain-warning': recipe('minetown-fountain-warning', 'Use a Minetown fountain in view of a peaceful watchman.', [
        ...prepare(), ...wish('uncursed dagger'), identify(), choose('minetn', 'm\x16'), keys('#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!{.'), ...create('peaceful watchman'),
        ...Array.from({ length: 20 }, () => [choose('dagger', '#dip\r*'), answer('Dip ', 'y'), answer('Dry up fountain?', 'n'),
            answer('Die?', 'n')]).flat(),
    ]),
    'sticky-form-release': recipe('sticky-form-release', 'Release a held monster by leaving a sticky polymorph form.', [
        ...room(), ...polyself('giant mimic'), ...create('hostile sleeping iron golem'), ...fight(), ...polyself('human'),
    ]),
    'swamp-level-generation': recipe('swamp-level-generation', 'Generate deep dungeon rooms and enter a swamp.', [
        ...prepare(), ...intrinsic('water walking'), keys('\x16'), answer('To what level', '20\r'),
        ...Array.from({ length: 64 }, () => [keys('#wizmakemap\r#wizmap\r\x14'),
            answer('Where do you want to be teleported?', '!}.'), keys('m.'), answer('Die?', 'n')]).flat(),
    ]),
    'mounted-floor-reach': recipe('mounted-floor-reach', 'Try to loot a box while riding without basic riding skill.', [
        ...room(), ...create('tame saddled pony'),
        ...[...'hykulnjb'].flatMap(direction => [keys('#ride\r'), answer('In what direction?', direction),
            answer('Force the mount to succeed?', 'y'), ...wish('uncursed empty large box'), identify(), choose('large box', 'd*'),
            keys('#loot\r'), answer('Loot in what direction?', '.'), answer('Loot it?', 'n'), keys('\x1b')]),
    ]),
    'traditional-spell-selection': recipe('traditional-spell-selection', 'Choose a known spell by letter in traditional menus.', [
        ...prepare(), keys('Z'), answer('Cast which spell?', 'a'), answer('In what direction?', '.'),
    ], ['menustyle:traditional']),
};
function recipe(name, description, actions, options = []) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-26 recipe ${name}`);
    return {
        roles: ['wizard'], options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: [...effects.map(([effect]) => effect), ...(name === 'wizard-intervention' ? ['harassment timer elapsed'] : [])],
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: actions.at(-1)?.expectExit ? actions : [...actions, keys('\x1b:\x1b')] }],
    };
}
export function validateRound26Recipe(name, session) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-26 recipe ${name}`);
    const text = session.segments.flatMap(segment => segment.steps ?? [])
        .map(step => step.screen.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, '')).join('\n');
    const checks = [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && (session.segments[0]?.steps?.length ?? 0) >= 2, evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
    if (name === 'wizard-intervention') {
        // wizdeadorgone() starts a timer of at most 299 world turns.
        // intervene() can choose aggravate(), which has no message.
        let turn = 0;
        for (const match of text.matchAll(/\bT:(\d+)\b/g))
            turn = Math.max(turn, Number(match[1]));
        checks.push({ check: 'harassment timer elapsed', ok: turn >= 350, evidence: `T:${turn}` });
    }
    return checks;
}
function prepare() {
    return [keys('#levelchange\r'), answer('To what experience level', '20\r'),
        ...clearMonsters(), ...intrinsic('pass thru walls'), keys('ml'), ...wish('fountain', 'floor')];
}
function room() {
    const actions = [...prepare(), keys('mhmhmkmk')];
    for (let row = 0; row < 5; row++) {
        for (let column = 0; column < 5; column++) {
            const edge = row === 0 || row === 4 || column === 0 || column === 4;
            actions.push(...wish(edge ? 'wall' : 'fountain', edge ? 'wall' : 'floor'));
            if (column < 4)
                actions.push(keys(row % 2 === 0 ? 'ml' : 'mh'));
        }
        if (row < 4)
            actions.push(keys('mj'));
    }
    actions.push(keys('mhmhmkmk'));
    return actions;
}
function lightingShop() {
    return [...intrinsic('monster detection'), ...wish('blessed potion of object detection'), identify(),
        choose('minetn', 'm\x16'), choose('potion of object detection', 'q*'), keys('\x1b#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!'), choose('candle', 'o'), keys('.')];
}
function sellAndPick(target) {
    return [choose(target, 'd*'), answer('Izchak offers', 'y'), choose(target, 'm,'), keys('\r')];
}
function disclose() {
    return ['Do you want your possessions identified?', 'Do you want to see your attributes?',
        'Do you want an account of creatures vanquished?', 'Do you want a list of species genocided?',
        'Do you want to see your conduct and achievements?', 'Do you want to see the dungeon overview?',
        'Save bones?'].map(prompt => answer(prompt, 'n'));
}
function clearMonsters() {
    return [...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r')];
}
function intrinsic(property) { return [keys('#wizintrinsic\r5000'), choose(property, ''), keys('\r')]; }
function create(monster) { return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')]; }
function polyself(monster) { return [keys('#polyself\r'), answer('Become what kind of monster?', `${monster}\r`)]; }
function wish(...items) { return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]); }
function fight() { return [...'hykulnjb'].flatMap(direction => [keys(`F${direction}`), answer('Really attack', 'y'), answer('Die?', 'n')]); }
function wait(turns) { return Array.from({ length: turns }, () => [keys('m.'), answer('Die?', 'n'), answer('Call ', '\r')]).flat(); }
function identify() { return keys('\t\t\r'); }
function choose(target, openKeys) { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt, value) { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value) { return { type: 'keys', value, dismissMore: true }; }
//# sourceMappingURL=round26-recipes.mjs.map