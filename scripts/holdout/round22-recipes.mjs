const EFFECTS = {
    'peaceful-force-fight': [['peaceful attacked', /You (?:hit|smite|kill|destroy) the (?:lichen|shrieker)/]],
    'peaceful-whip-attack': [['whip attack', /You flick your bullwhip towards/], ['peaceful attacked', /You (?:hit|miss|kill|lash) the shrieker/]],
    'invisible-monster-reveal': [['unseen monster found', /invisible ogre|ogre, (?:invisible|seen via monster detection)/]],
    'cleaver-swing': [['Cleaver wielded', /Cleaver.*weapon in hands/], ['target struck', /You (?:hit|smite|kill|destroy) the/]],
    'nymph-item-theft': [['item stolen', /You steal:|You snatched but dropped/]],
    'shade-misc-strike': [['shade affected', /shade (?:is seared|turns to flee)|sears the shade/]],
    'confusing-hand-strike': [['confusion charged', /hands begin to glow/], ['charge spent', /hands (?:stop glowing|no longer glow so brightly)/]],
    'artifact-light-strike': [['radiance hurts monster', /radiance penetrates deep into|light sears/]],
    'black-light-conflict': [['monster hallucination', /(?:ogre|troll) looks (?:more )?confused/]],
    'poisonous-monster-conflict': [['poison affects monster', /queen bee.s sting was poisoned/]],
    'metallivore-ring-digestion': [['accessory eaten', /Magic spreads through your body as you digest the (?:ring|amulet)/]],
    'squeaky-board-repair': [['board repaired', /You repair the squeaky board/]],
    'cursed-bag-loss': [['bag contents vanish', /diamond named cargo.*(?:vanished|disappear)/]],
    'shop-theft-restitution': [['shop robbed', /escaped the shop without paying/], ['keeper satisfied', /calms down|returns to (?:his|her|its) shop|Satisfied, .* suddenly disappears!/]],
    'shopkeeper-death-return': [['keeper killed', /kill Izchak/], ['shop deserted', /This shop (?:is|seems to be) (?:deserted|untended)/]],
    'shop-sale-credit': [['sale credited', /(?:traded|relinquish).*credit/], ['shop prices quoted', /Fine goods for sale:/]],
    'shop-unpaid-inheritance': [['unpaid stock', /unpaid|will cost you/], ['possessions inherited', /(?:inherits|takes) all your possessions/], ['inventory disclosed', /Do you want your possessions identified|Final Attributes|Final attributes|You were/]],
    'petrifying-corpse-meal': [['corpse eaten safely', /finish eating the cockatrice corpse/], ['temporary resistance expires', /no longer feel secure from petrification/]],
    'acidic-corpse-meal': [['corpse eaten safely', /finish eating the ochre jelly corpse/], ['temporary resistance expires', /no longer feel safe from acid/]],
    'monster-kick-evasion': [['kick evaded', /evading your (?:clumsy )?kick/]],
    'quest-guardian-reaction': [['guardians angered', /apprentices? appears? to be angry too/]],
    'sokoban-pit-replacement': [['Sokoban completed', /completed (?:1st|2nd|3rd|4th) Sokoban level/]],
    'shop-stock-scattering': [['shop stock inspected', /for sale, \d+ zorkmids/], ['stock scattered by mine', /KAABLAMM!!!/]],
    'shop-gold-withdrawal': [['deposit credited', /(?:established|increased).*credit|credit for/], ['gold withdrawn', /Your credit is (?:reduced|erased)/]],
    'quantum-box-observation': [['cat observed', /(?:housecat|cat) inside the box is (?:still alive|dead)!/]],
};
const LEADER_APPROACHES = [
    ['h', 'l'], ['k', 'j'], ['l', 'h'], ['j', 'k'],
];
export const ROUND22_RECIPES = {
    'peaceful-force-fight': recipe('peaceful-force-fight', 'Force an attack on a peaceful monster.', [
        ...room(), ...create('peaceful shrieker'), ...fight(16),
    ]),
    'peaceful-whip-attack': recipe('peaceful-whip-attack', 'Flick a bullwhip at a peaceful monster.', [
        ...room(), ...wish('uncursed bullwhip'), identify(), choose('bullwhip', 'w*'), ...create('peaceful shrieker'),
        ...[...'hykulnjb'.repeat(3)].flatMap(direction => [choose('bullwhip', 'a*'), answer('In what direction?', direction)]),
    ]),
    'invisible-monster-reveal': recipe('invisible-monster-reveal', 'Create an unseen monster and detect its presence.', [
        ...room(), ...create('hostile invisible ogre'), ...intrinsic('monster detection', 100), keys(';m.\x1b'),
    ]),
    'cleaver-swing': recipe('cleaver-swing', 'Swing Cleaver through adjacent monsters.', [
        ...room(), ...wish('uncursed +0 Cleaver'), identify(), choose('Cleaver', 'w*'),
        ...create('hostile shrieker'), ...create('hostile shrieker'), ...create('hostile shrieker'), ...fight(24),
    ]),
    'nymph-item-theft': recipe('nymph-item-theft', 'Steal a soldier\'s equipment in nymph form.', [
        ...room(), keys('w-'), ...polyself('wood nymph'),
        ...Array.from({ length: 5 }, () => [...create('hostile sleeping soldier'), ...fight(16)]).flat(),
    ]),
    'shade-misc-strike': recipe('shade-misc-strike', 'Hit a shade with a silver ring used as a hand weapon.', [
        ...room(), ...wish('uncursed silver ring named shade striker'), identify(), choose('named shade striker', 'w*'),
        ...create('hostile shade'), ...fight(32),
    ]),
    'confusing-hand-strike': recipe('confusing-hand-strike', 'Charge a confusing touch and hit a durable monster.', [
        ...room(), ...wish('uncursed scroll of confuse monster'), identify(),
        choose('of confuse monster', 'r*'), ...create('hostile ogre lord'), ...fight(32),
    ]),
    'artifact-light-strike': recipe('artifact-light-strike', 'Strike a light-hating monster with lit Sunsword.', [
        ...room(), ...wish('uncursed +0 Sunsword'), identify(), choose('Sunsword', 'w*'),
        ...Array.from({ length: 8 }, () => [...create('hostile sleeping gremlin'), ...fight(8)]).flat(),
    ]),
    'black-light-conflict': clash('black-light-conflict', 'black light', 'ogre'),
    'poisonous-monster-conflict': clash('poisonous-monster-conflict', 'queen bee', 'ogre'),
    'metallivore-ring-digestion': recipe('metallivore-ring-digestion', 'Eat enchanted rings as a xorn.', [
        // Ring materials vary. Keep an iron item so the eating command
        // still offers its menu when the next ring is made of stone.
        // Renew the form before each meal; a polymorph timeout is random.
        ...room(), ...wish('uncursed dagger named edible fallback'),
        ...['adornment', 'gain strength', 'gain constitution', 'increase accuracy', 'increase damage', 'protection', 'free action', 'slow digestion', 'teleport control', 'see invisible', 'fire resistance', 'cold resistance', 'shock resistance', 'poison resistance'].flatMap(ring => [
            ...wish(`uncursed +4 ring of ${ring}`), identify(), ...polyself('xorn'), choose(`ring of ${ring}`, 'me*'),
            answer('Continue eating?', 'y'), ...wait(2),
        ]),
        ...Array.from({ length: 12 }, () => [
            ...wish('uncursed amulet of guarding'), identify(), ...polyself('xorn'), choose('amulet of guarding', 'me*'), ...wait(2),
        ]).flat(), keys('\x18   \x1b'),
    ]),
    'squeaky-board-repair': recipe('squeaky-board-repair', 'Repair squeaky boards with grease.', [
        ...room(), ...wish('uncursed can of grease (0:30)'), identify(),
        ...Array.from({ length: 12 }, () => [
            ...wish('squeaky board trap'), keys('\x05#untrap\r'), answer('In what direction?', '.'),
            choose('can of grease', '*'), ...wait(2),
        ]).flat(),
    ]),
    'cursed-bag-loss': recipe('cursed-bag-loss', 'Open a cursed bag of holding until stored cargo vanishes.', [
        ...room(), ...wish('cursed empty bag of holding', 'uncursed diamond named cargo'), identify(),
        choose('bag of holding', 'a*'), answer('Your bag', 'i'), choose('Gems/Stones', ''), keys('\r'), choose('named cargo', ''), keys('\r'),
        ...Array.from({ length: 50 }, () => [choose('bag of holding', 'a*'), keys('\x1b')]).flat(),
    ]),
    'shop-theft-restitution': recipe('shop-theft-restitution', 'Steal lighting stock, then pay the pursuing keeper.', [
        ...lightingShop(), ...pickUp(), keys('\x14'), answer('Where do you want to be teleported?', '<.'),
        ...wish('10000 gold pieces'),
        ...[...'hykulnjb'].flatMap((direction, index) => [
            ...(index % 4 === 3 ? meal() : []), keys('\x14'), choose('Izchak', 'm'), keys(`${direction}.`),
            keys('p'), answer('Pay whom?', '\x1b'), answer('Pay?', 'y'),
        ]), ...wait(3),
    ]),
    'shopkeeper-death-return': recipe('shopkeeper-death-return', 'Kill the lighting-shop keeper and re-enter the empty shop.', [
        ...lightingShop(), keys('#wizkill\r'), choose('Izchak', 'm'), keys('.\x1b'),
        keys('\x14'), answer('Where do you want to be teleported?', '<.'),
        keys('\x14'), choose('candle', 'o'), keys('.'),
    ]),
    'shop-sale-credit': recipe('shop-sale-credit', 'Sell lamps until the keeper offers credit, then discuss the account.', [
        ...lightingShop(),
        // Native initial capital is at most 4000; these lamps sell for
        // at least 25 each, so later sales must offer credit.
        ...Array.from({ length: 170 }, (_, index) => [
            ...wish(`uncursed magic lamp named sale ${index}`), identify(), choose(`named sale ${index}`, 'd*'),
            answer('Izchak offers', 'y'), answer('Will you accept', 'y'),
        ]).flat(),
        ...[...'hykulnjb'].flatMap(direction => [keys('#chat\r'), answer('Talk to whom?', direction)]),
    ]),
    'shop-unpaid-inheritance': recipe('shop-unpaid-inheritance', 'Die with unpaid stock and disclose the possessions inherited by the keeper.', [
        ...lightingShop(), ...pickUp(), keys('#wizkill\r.'), answer('Commit suicide?', 'yes\r'), answer('Die?', 'y'),
        answer('Do you want your possessions identified?', 'y'), keys('\x1b'),
        answer('Do you want to see your attributes?', 'y'), keys('\x1b'),
        answer('Do you want an account of creatures vanquished?', 'n'),
        answer('Do you want a list of species genocided and extinct?', 'n'),
        answer('Do you want to see your conduct?', 'n'),
        answer('Do you want to see the dungeon overview?', 'n'),
        answer('Save bones?', 'n'), { type: 'keys', value: ' ', dismissMore: true, expectExit: true },
    ], 'exit'),
    'petrifying-corpse-meal': recipe('petrifying-corpse-meal', 'Finish a cockatrice corpse while temporary stoning resistance expires.', [
        ...room(), ...intrinsic('stoning resistance', 2), ...wish('uncursed cockatrice corpse'), identify(),
        choose('cockatrice corpse', 'me*'), ...wait(10),
    ]),
    'acidic-corpse-meal': recipe('acidic-corpse-meal', 'Finish an acidic corpse while temporary acid resistance expires.', [
        ...room(), ...wish('uncursed ochre jelly corpse'), identify(), ...intrinsic('acid resistance', 2),
        choose('ochre jelly corpse', 'me*'), ...wait(15),
    ]),
    'monster-kick-evasion': recipe('monster-kick-evasion', 'Kick quick, unarmored monsters until one dodges.', [
        ...room(), ...intrinsic('monster detection', 10000), keys(';!\x1b'),
        ...Array.from({ length: 24 }, (_, index) => [
            ...(index % 4 === 3 ? meal() : []), ...create('hostile monkey'),
            keys('\x14'), choose('monkey', 'm'), keys('h.'), keys('\x04'), answer('In what direction?', 'l'),
        ]).flat(),
    ]),
    'quest-guardian-reaction': recipe('quest-guardian-reaction', 'Attack a peaceful quest leader in view of guardians.', [
        ...room(), ...intrinsic('monster detection', 1000), ...create('peaceful sleeping Neferet the Green'),
        ...create('peaceful sleeping apprentice'), keys(';!\x1b'),
        ...LEADER_APPROACHES.flatMap(([direction, attack]) => [
            keys('\x14'), choose('Neferet the Green', 'm'), keys(`${direction}.`),
            keys(`F${attack}`), answer('Really attack', 'y'), answer('Die?', 'n'),
        ]),
    ]),
    'sokoban-pit-replacement': recipe('sokoban-pit-replacement', 'Replace every Sokoban pit with a squeaky board, then read the completion event.', [
        ...protect(), ...intrinsic('levitating', 5000), choose('soko4', 'm\x16'), ...clearMonsters(), keys('#wizmap\r'),
        ...Array.from({ length: 40 }, (_, index) => [
            ...(index % 4 === 0 ? meal() : []), keys('\x14'), answer('Where do you want to be teleported?', '^.'),
            ...wish('squeaky board trap'),
        ]).flat(), keys('#chronicle\r\x1b'),
    ]),
    'shop-stock-scattering': recipe('shop-stock-scattering', 'Detonate a mine beneath lighting-shop stock.', [
        ...lightingShop(), ...wish('land mine trap'), keys('mhml'), answer('Really step into', 'y'),
        answer('Die?', 'n'), keys(':'),
    ]),
    'shop-gold-withdrawal': recipe('shop-gold-withdrawal', 'Deposit gold for shop credit, then pick the coins back up.', [
        ...lightingShop(), ...wish('1000 gold pieces'), keys('d$'),
        keys('m,'), answer('Pick up what?', '$\r'),
    ]),
    'quantum-box-observation': recipe('quantum-box-observation', 'Recover a quantum mechanic\'s box and observe its cat.', [
        ...room(), ...intrinsic('monster detection', 5000), keys(';!\x1b'),
        // m_initinv gives each quantum mechanic a one-in-20 box chance.
        // Open it on the floor so single-item pickup cannot skip a menu.
        ...create('60 hostile sleeping quantum mechanic'),
        ...Array.from({ length: 60 }, () => [keys('#wizkill\r'), choose('quantum mechanic', 'm'), keys('.\x1b')]).flat(),
        ...wish('blessed potion of object detection', 'uncursed wand of opening'), identify(), choose('potion of object detection', 'q*'), keys('\x1b\x14'),
        choose('large box', 'o'), keys('.'), choose('wand of opening', 'z*'), answer('In what direction?', '>'),
        keys('#loot\r\x1b'),
    ]),
};
const whipRecipe = ROUND22_RECIPES['peaceful-whip-attack'];
if (whipRecipe)
    whipRecipe.roles = ['archeologist'];
const QUESTS = [
    ['archeologist', 'Arc', 'Lord Carnarvon'], ['barbarian', 'Bar', 'Pelias'],
    ['caveman', 'Cav', 'Shaman Karnov'], ['healer', 'Hea', 'Hippocrates'],
    ['knight', 'Kni', 'King Arthur'], ['monk', 'Mon', 'Grand Master'],
    ['priest', 'Pri', 'Arch Priest'], ['ranger', 'Ran', 'Orion'],
    ['rogue', 'Rog', 'Master of Thieves'], ['samurai', 'Sam', 'Lord Sato'],
    ['tourist', 'Tou', 'Twoflower'], ['valkyrie', 'Val', 'Norn'],
    ['wizard', 'Wiz', 'Neferet the Green'],
];
for (const [role, code, leader] of QUESTS) {
    const name = `quest-fillers-${role}`;
    EFFECTS[name] = [['quest granted', /granted access to proceed deeper into the quest/]];
    const plan = recipe(name, `Receive the ${role} quest and descend through its filler levels.`, [
        ...protect(role === 'wizard'), ...wish('100 gold pieces'), ...intrinsic('pass thru walls', 5000), ...intrinsic('monster detection', 5000),
        choose(`${code}-strt`, 'm\x16'), keys('#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!'),
        ...[...'hykulnjb'].flatMap((adjacent, index) => [
            ...(index > 0 ? [...(index % 4 === 3 ? meal() : []), keys('\x14')] : []), choose(leader, 'm'), keys(`${adjacent}.`), answer('adjust?', 'y'),
            ...[...'hykulnjb'].flatMap(direction => [keys('#chat\r'), answer('Talk to whom?', direction), answer('adjust?', 'y'), answer('How much will you offer', '1\r')]),
        ]),
        keys('#chronicle\r\x1b'),
        ...Array.from({ length: 7 }, (_, index) => [...(index % 4 === 0 ? meal() : []), ...clearMonsters(), keys('#wizmap\r\x14'),
            answer('Where do you want to be teleported?', '>.'), keys('>'),
            answer('Are you sure you want to enter?', 'y'), answer('Call ', '\r')]).flat(),
    ]);
    plan.roles = [role];
    if (role === 'valkyrie')
        plan.genders = ['female'];
    ROUND22_RECIPES[name] = plan;
}
export function validateRound22Recipe(name, session) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-22 recipe ${name}`);
    const screens = session.segments.flatMap(segment => (segment.steps ?? []).map(step => step.screen));
    const text = screens.join('\n');
    const checks = [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length > 1, evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: pattern.exec(text)?.[0] ?? '' })),
    ];
    if (name.startsWith('quest-fillers-')) {
        const quest = QUESTS.find(([role]) => name === `quest-fillers-${role}`);
        if (!quest)
            throw new Error(`missing quest role for ${name}`);
        const [, code] = quest;
        const start = new RegExp(`\\b${code}-strt:\\s*(-?\\d+)`).exec(text);
        const goal = new RegExp(`\\b${code}-goal:\\s*(-?\\d+)`).exec(text);
        // The menu lists absolute depths; Home status uses quest depths.
        // Visiting every intervening floor reaches both filler families.
        const goalDepth = Number(goal?.[1]) - Number(start?.[1]) + 1;
        const depths = new Set(screens.flatMap(screen => [...screen.matchAll(/Home (\d+)/g)].map(match => match[1])));
        checks.push({ check: 'every quest depth from home through goal visited',
            ok: Number.isInteger(goalDepth) && goalDepth > 0 && depths.size === goalDepth
                && [...depths].every(depth => Number(depth) >= 1 && Number(depth) <= goalDepth),
            evidence: [...depths].join(', ') });
    }
    return checks;
}
function recipe(name, description, actions, finish = 'command') {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`missing effects for ${name}`);
    return { roles: ['wizard'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger'],
        description, success: effects.map(([check]) => check),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r'), answer('To what experience level', '30\r'), ...actions, ...(finish === 'command' ? [keys('\x1b:\x1b')] : []),
                ] }],
    };
}
function clash(name, attacker, defender) {
    return recipe(name, `Let ${attacker} attack ${defender} under conflict.`, [
        ...room(), ...(attacker === 'black light' ? [...wish('uncursed Grayswandir'), identify(), choose('Grayswandir', 'w*')] : []), ...intrinsic('conflict', 1000),
        ...Array.from({ length: 5 }, () => [
            ...clearMonsters(), ...create(`hostile ${attacker}`),
            ...create(`peaceful ${defender}`), ...create(`peaceful ${defender}`), ...create(`peaceful ${defender}`), ...wait(20),
        ]).flat(),
    ]);
}
function room() {
    const actions = [...protect(), ...clearMonsters(), ...intrinsic('pass thru walls', 5000), keys('mhmk')];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            actions.push(...wish('fountain', 'floor'));
            if (column < 2)
                actions.push(keys(row % 2 === 0 ? 'ml' : 'mh'));
        }
        if (row < 2)
            actions.push(keys('mj'));
    }
    actions.push(keys('mhmk'), ...clearMonsters());
    return actions;
}
function protect(removeCloak = true) {
    return [...wish('blessed +50 gray dragon scale mail', 'uncursed ring of slow digestion'), identify(),
        ...(removeCloak ? [keys('T'), ...wait(5)] : []), choose('gray dragon scale mail', 'W*'), ...wait(5),
        choose('ring of slow digestion', 'P*'), answer('Which ring-finger', 'l')];
}
function meal() {
    return [...wish('uncursed K-ration'), identify(), choose('K-ration', 'me*'), answer('Stop eating?', 'n')];
}
function lightingShop() {
    return [...protect(), ...intrinsic('pass thru walls', 5000), ...intrinsic('monster detection', 5000),
        ...wish('blessed potion of object detection'), identify(), choose('minetn', 'm\x16'),
        choose('potion of object detection', 'q*'), keys('\x1b#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!'), choose('candle', 'o'), keys('.')];
}
function pickUp() {
    return [keys(','), answer('What kinds of thing', 'a\r'), answer('Pick up', 'a')];
}
function clearMonsters() {
    return [...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r')];
}
function intrinsic(property, turns) {
    const page = ['pass thru walls', 'stoning resistance', 'acid resistance'].includes(property) ? 1 : property === 'conflict' ? 2 : 0;
    return [keys(`#wizintrinsic\r${' '.repeat(page)}${turns}`), choose(property, ''), keys('\r')];
}
function wish(...items) {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}
function create(monster) {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')];
}
function polyself(monster) {
    return [keys('#polyself\r'), answer('Become what kind of monster?', `${monster}\r`)];
}
function fight(turns) {
    return [...'hykulnjb'.repeat(Math.ceil(turns / 8))].flatMap(direction => [
        keys(`F${direction}`), answer('Really attack', 'y'), answer('Die?', 'n'),
    ]);
}
function wait(turns) {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Call ', '\r'), answer('Die?', 'n')]).flat();
}
function identify() { return keys('\t\t\r'); }
function choose(target, openKeys) { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt, value) { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value) { return { type: 'keys', value, dismissMore: true }; }
//# sourceMappingURL=round22-recipes.mjs.map