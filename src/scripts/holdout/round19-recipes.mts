import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

type Effect = readonly [string, RegExp];
const EFFECTS: Record<string, readonly Effect[]> = {
    'buried-punishment-release': [['ball buried', /iron ball gets buried/], ['chain escaped', /buried ball is no longer bound to you|slip free of the buried ball and chain/]],
    'buried-punishment-return': [['ball buried', /iron ball gets buried/], ['ball unearthed', /ball.*(?:comes|is).*chain|chained to a heavy iron ball/]],
    'grave-disturbance': [['grave disturbed', /You disturb the undead/]],
    'unreachable-engraving': [['floor unreachable', /You can.t reach the (?:floor|ground|stairs)/]],
    'landmine-disarming': [['mine disarmed', /You disarm (?:the|your) land mine/]],
    'trapped-door-opening': [['door explodes', /KABOOM!!.*door was booby-trapped/]],
    'ice-trap-melting': [['ice melted', /ice (?:crackles and melts|melts)/]],
    'oracle-consultations': [['minor consultation', /True to her word|The Oracle (?:speaks|says)/], ['major consultation', /The Oracle meditates for a moment and then intones/]],
    'demon-attack-help': [['demon summoned', /Some hell-p has arrived/]],
    'worm-digestion': [['prey swallowed', /You swallow .* whole/], ['prey digested', /You (?:totally digest|digest)/]],
    'black-light-attack': [['light explosion', /affected by your flash of light/]],
    'vortex-energy-clash': [['spellcaster engulfed', /energy vortex engulfs the kobold shaman/], ['monster expelled', /kobold shaman is expelled/]],
    'jelly-acid-clash': [['acid attack', /is covered in acid/]],
    'worm-digestion-clash': [['prey digested', /Burrrrp!/]],
    'cockatrice-stoning-clash': [['monster petrified', /turns to stone/]],
    'gremlin-light-damage': [['gremlin hurt by light', /gremlin (?:wails in agony|cries out in pain|recoils from the light)/]],
    'traditional-container-transfer': [['item stored', /You put .*cargo.* (?:in|into).*sack/], ['contents offered', /What kinds of thing do you want to take out/], ['contents inspected', /(?:^|\n)\s*(?:an? |\d+ )?uncursed potions? of gain energy named cargo/]],
    'combination-container-transfer': [['item stored', /You put .*cargo.* (?:in|into).*sack/], ['contents offered', /Take out what/]],
    'confused-reverse-looting': [['reverse loot', /You find old loot:|Ok, now there is loot here/]],
    'steed-saddle-recovery': [['saddle removed', /You take the saddle off of/]],
    'boulder-floor-push': [['boulder moved', /With (?:great|little) effort you move the boulder/]],
    'rumor-file-consistency': [['engravings shown', /Engravings:/], ['epitaphs shown', /Epitaphs:/], ['bogus monsters shown', /Bogus monsters:/]],
    'invocation-ritual': [['invocation begun', /floor shakes violently under you/], ['stairwell created', /standing at the top of a stairwell leading down/]],
    'combat-enlightenment': [['hit bonus reported', /bonus to hit/], ['damage bonus reported', /damage bonus/], ['physical reduction reported', /half physical damage/], ['spell reduction reported', /half spell damage/]],
    'monster-birth-counts': [['births listed', /died born/], ['created species listed', /lichen/]],
    'shop-credit-purchases': [['credit established', /credit|credited/], ['merchandise bought', /You bought/], ['credit spent', /credit.*(?:reduced|erased)|price is deducted from your credit/]],
    'shop-container-buyback': [['container sold', /(?:sold|relinquish).*parcel/], ['filled container bought', /bought.*parcel and its contents/]],
    'shop-unpaid-wand-use': [['usage charged', /Usage fee,/]],
    'lava-item-damage': [['item burns in lava', /hit lava and burn up/]],
    'acid-potion-water-damage': [['acid explodes in water', /potion of acid explodes/]],
    'greased-armor-acid': [['grease prevents corrosion', /protected by the layer of grease/]],
    'eyewear-already-worn': [['second eyewear refused', /can.t wear lenses because you.re wearing a blindfold there already/]],
    'homunculus-sleep-bite': [['prey sleeps', /is put to sleep by you/]],
    'green-slime-touch': [['prey slimed', /You turn .* into slime/]],
    'vanquished-sort-selection': [['sort offered', /Sort order for vanquished monster counts/], ['counts listed', /Vanquished creatures:/]],
    'rider-famine-touch': [['famine attack', /(?:Famine|It) reaches out, and your body shrivels/]],
    'rider-pestilence-touch': [['pestilence attack', /(?:Pestilence|It) reaches out, and you feel fever and chills/]],
    'rider-death-touch': [['death attack', /(?:Death|It) reaches out with its deadly touch/]],
    'yeenoghu-confusion': [['confusion attack', /You are getting (?:even more )?confused/]],
};

export const ROUND19_RECIPES: Record<string, Recipe> = {
    'buried-punishment-release': recipe('buried-punishment-release', 'Escape a buried punishment ball by becoming amorphous.', [
        ...buryBall(), ...polyself('gelatinous cube'),
    ]),
    'buried-punishment-return': recipe('buried-punishment-return', 'Unearth a punishment ball by teleporting away.', [
        ...buryBall(), keys('\x14'), answer('Where do you want to be teleported?', '<.'), keys('\x18 '),
    ]),
    'grave-disturbance': recipe('grave-disturbance', 'Engrave on a headstone and disturb its undead inhabitant.', [
        ...practiceRoom(), ...wish('grave', 'uncursed dagger named epitaph'), identify(), choose('dagger named epitaph', 'E*'), ...wait(5),
    ]),
    'unreachable-engraving': recipe('unreachable-engraving', 'Try to engrave while levitating above the floor.', [
        ...intrinsic('levitating', 100), keys('E-'),
    ]),
    'landmine-disarming': recipe('landmine-disarming', 'Disarm revealed land mines using ordinary untrap attempts.', [
        ...practiceRoom(), ...Array.from({ length: 16 }, () => [
            ...wish('land mine trap'), keys('\x05#untrap\r'), answer('In what direction?', '.'), ...wait(5),
        ]).flat(),
    ]),
    'trapped-door-opening': recipe('trapped-door-opening', 'Open a wizard-wished trapped door.', [
        ...practiceRoom(), keys('ml'), ...wish('wall', 'trapped closed door'), keys('mh'),
        ...Array.from({ length: 12 }, () => [keys('o'), answer('In what direction?', 'l')]).flat(),
    ]),
    'ice-trap-melting': recipe('ice-trap-melting', 'Melt ice beneath a bear trap while levitating.', [
        ...practiceRoom(), ...intrinsic('levitating', 100), ...wish('pool', 'uncursed wand of cold', 'uncursed wand of fire'), identify(),
        choose('wand of cold', 'z*'), answer('In what direction?', '>'), ...wish('bear trap trap'),
        choose('wand of fire', 'z*'), answer('In what direction?', '>'), keys(':'),
    ]),
    'oracle-consultations': recipe('oracle-consultations', 'Pay the Oracle for minor and major consultations.', [
        ...practiceRoom(), ...wish('5000 gold pieces'), ...create('peaceful Oracle'),
        ...[...'hykulnjb'].flatMap(direction => [keys('#chat\r'), answer('Talk to whom?', direction),
            answer('"Wilt thou settle for a minor consultation?', 'y')]),
        ...[...'hykulnjb'].flatMap(direction => [keys('#chat\r'), answer('Talk to whom?', direction),
            answer('"Wilt thou settle for a minor consultation?', 'n'), answer('"Then dost thou desire a major one?', 'y')]),
    ]),
    'demon-attack-help': recipe('demon-attack-help', 'Attack without a weapon in demon form until another demon helps.', [
        ...practiceRoom(), keys('w-'),
        ...Array.from({ length: 12 }, () => [...clearMonsters(), ...polyself('vrock'),
            ...create('hostile fog cloud'), ...fight(8)]).flat(),
    ]),
    'worm-digestion': recipe('worm-digestion', 'Swallow and digest living prey in purple worm form.', [
        ...practiceRoom(), keys('w-'),
        ...Array.from({ length: 4 }, () => [...clearMonsters(), ...polyself('purple worm'),
            ...create('hostile ogre'), ...fight(8), ...wait(8)]).flat(),
    ]),
    'black-light-attack': recipe('black-light-attack', 'Explode in black light form beside a sighted monster.', [
        ...practiceRoom(), ...intrinsic('monster detection', 1000), ...polyself('black light'), ...create('hostile sleeping gnome'),
        ...['hl', 'yn', 'kj', 'ub', 'lh', 'ny', 'jk', 'bu'].map(path => keys(path)),
    ]),
    'vortex-energy-clash': clash('vortex-energy-clash', 'energy vortex', 'kobold shaman'),
    'jelly-acid-clash': clash('jelly-acid-clash', 'ochre jelly', 'lichen'),
    'worm-digestion-clash': clash('worm-digestion-clash', 'purple worm', 'troll'),
    'cockatrice-stoning-clash': clash('cockatrice-stoning-clash', 'cockatrice', 'ogre'),
    'gremlin-light-damage': recipe('gremlin-light-damage', 'Flash an expensive camera at gremlins.', [
        ...practiceRoom(), ...wish('uncursed expensive camera (0:30)'), identify(), ...create('hostile gremlin'),
        ...[...'hykulnjb'.repeat(3)].flatMap(direction => [choose('expensive camera', 'a*'), answer('In what direction?', direction)]),
    ]),
    'traditional-container-transfer': containerTransfer('traditional-container-transfer', 'traditional'),
    'combination-container-transfer': containerTransfer('combination-container-transfer', 'combination'),
    'confused-reverse-looting': recipe('confused-reverse-looting', 'Try to loot without a container while confused.', [
        ...practiceRoom(), ...wish('1000 gold pieces'), ...intrinsic('confused', 200),
        ...Array.from({ length: 30 }, () => keys('#loot\r')).flat(),
    ]),
    'steed-saddle-recovery': recipe('steed-saddle-recovery', 'Remove a saddle from a nearby tame pony.', [
        ...practiceRoom(), ...create('tame saddled pony'),
        ...[...'hykulnjb'.repeat(3)].flatMap(direction => [keys('#loot\r'), answer('Loot in what direction?', direction),
            answer('Do you want to remove the saddle', 'y')]),
    ]),
    'boulder-floor-push': recipe('boulder-floor-push', 'Push a boulder along a cleared room floor.', [
        ...practiceRoom(40), ...wait(45), ...clearMonsters(), ...wish('boulder'), keys('mh'), keys('l'),
    ]),
    'rumor-file-consistency': recipe('rumor-file-consistency', 'Read the wizard rumor and supporting-text diagnostic.', [keys('#wizrumorcheck\r'), keys('     \x1b')]),
    'invocation-ritual': recipe('invocation-ritual', 'Prepare the three invocation relics on the real vibrating square.', [
        ...intrinsic('invulnerable', 1000), ...intrinsic('pass thru walls', 1000),
        ...wish('uncursed Bell of Opening', 'uncursed Candelabrum of Invocation', 'uncursed Book of the Dead',
            ...Array.from({ length: 7 }, () => 'uncursed wax candle')), identify(),
        choose('wax candles', 'a*'), answer('Attach ', 'y'),
        choose('sanctum', 'm\x16'), ...clearMonsters(), keys('#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '<.'), keys('<'), ...clearMonsters(),
        ...wish('blessed scroll of gold detection'), identify(), ...intrinsic('confused', 1),
        choose('of gold detection', 'r*'), keys('\x1b\x14'),
        answer('Where do you want to be teleported?', '~.'),
        choose('Candelabrum', 'a*'), choose('Bell of Opening', 'a*'), choose('Book of the Dead', 'r*'),
    ]),
    'combat-enlightenment': recipe('combat-enlightenment', 'Read combat bonuses and damage reductions in enlightenment.', [
        ...wish('uncursed +3 ring of increase accuracy', 'uncursed +9 ring of increase damage'), identify(),
        choose('ring of increase accuracy', 'P*'), answer('Which ring-finger', 'l'),
        choose('ring of increase damage', 'P*'), answer('Which ring-finger', 'r'),
        ...intrinsic('half physical damage', 300), ...intrinsic('half spell damage', 300), keys('\x18   \x1b'),
    ]),
    'monster-birth-counts': recipe('monster-birth-counts', 'Create a monster and read the wizard birth and death counts.', [
        ...create('peaceful lichen'), keys('#wizborn\r   \x1b'),
    ]),
    'shop-credit-purchases': recipe('shop-credit-purchases', 'Pick up shop stock, deposit gold, and pay with the credit.', [
        ...shopVisit(), ...Array.from({ length: 24 }, (_, visit) => [
            ...stockPosition(visit), ...pickUp(), ...wish('5000 gold pieces'), keys('d$'), ...pay(),
        ]).flat(),
    ], ['menustyle:traditional']),
    'shop-container-buyback': recipe('shop-container-buyback', 'Sell a filled sack on a shop floor, then buy it back.', [
        ...wish('uncursed empty sack named parcel', 'uncursed diamond named cargo', '10000 gold pieces'), identify(),
        choose('sack named parcel', 'a*'), answer('Your sack', 'i'), answer('What kinds of thing', '*a\r'),
        ...shopVisit(), ...Array.from({ length: 24 }, (_, visit) => [
            ...stockPosition(visit), choose('sack named parcel', 't*'), answer('In what direction?', '>'),
            // A second floor object keeps pickup in its menu, even on an
            // otherwise empty square. Leave heavy shop stock on the floor.
            ...wish('uncursed rock named pickup marker'), identify(), choose('named pickup marker', 't*'),
            answer('In what direction?', '>'), choose('sack named parcel', 'm,'),
            choose('named pickup marker', ''), keys('\r'), ...pay(),
        ]).flat(),
    ], ['menustyle:traditional']),
    'shop-unpaid-wand-use': recipe('shop-unpaid-wand-use', 'Sell wands, pick them up unpaid, and use their charges.', [
        ...wish('10000 gold pieces'), ...shopVisit(), ...Array.from({ length: 24 }, (_, visit) => [
            ...stockPosition(visit), ...wish(`uncursed wand of light (0:8) named meter ${visit}`), identify(),
            choose(`named meter ${visit}`, 't*'), answer('In what direction?', '>'),
            ...pickUp('/a'), choose(`named meter ${visit}`, 'z*'), ...pay(),
        ]).flat(),
    ], ['menustyle:traditional']),
    'lava-item-damage': recipe('lava-item-damage', 'Drop a ration into lava while levitating above it.', [
        ...practiceRoom(), ...intrinsic('levitating', 100), ...wish('lava', 'uncursed K-ration'), identify(), choose('K-ration', 'd*'),
    ]),
    'acid-potion-water-damage': recipe('acid-potion-water-damage', 'Dip acid potions into a fountain and let water destroy them.', [
        ...practiceRoom(), ...Array.from({ length: 4 }, () => [
            ...wish('fountain', 'uncursed potion of acid'), identify(), choose('potion of acid', '#dip\r*'), answer('Dip ', 'y'),
        ]).flat(),
    ]),
    'greased-armor-acid': recipe('greased-armor-acid', 'Expose a greased iron helm to acid.', [
        ...practiceRoom(), ...wish('uncursed greased dwarvish iron helm', 'uncursed potion of acid'), identify(),
        choose('dwarvish iron helm', '#dip\r*'), choose('potion of acid', '*'),
    ]),
    'eyewear-already-worn': recipe('eyewear-already-worn', 'Try to wear lenses over an equipped blindfold.', [
        ...wish('uncursed blindfold', 'uncursed lenses'), identify(), choose('blindfold', 'P*'), choose('lenses', 'P*'),
    ]),
    'homunculus-sleep-bite': recipe('homunculus-sleep-bite', 'Put a monster to sleep with a homunculus bite.', [
        ...practiceRoom(), keys('w-D'), answer('Drop what type of items?', 'a\r'),
        answer('What would you like to drop?', ',\r'), ...Array.from({ length: 4 }, () => [
            ...polyself('human'), ...clearMonsters(), ...polyself('homunculus'), ...create('hostile lichen'), ...fight(8),
        ]).flat(),
    ]),
    'green-slime-touch': recipe('green-slime-touch', 'Turn a vulnerable monster into slime with an unarmed touch.', [
        ...practiceRoom(), keys('w-'), ...Array.from({ length: 8 }, () => [
            ...polyself('human'), ...clearMonsters(), ...polyself('green slime'), ...create('hostile lichen'), ...fight(16),
        ]).flat(),
    ]),
    'vanquished-sort-selection': recipe('vanquished-sort-selection', 'Choose a sort order before reading monster death counts.', [
        ...practiceRoom(), ...create('hostile lichen'), keys('#wizkill\rm.\x1b'),
        choose('alphabetically', 'm#vanquished\r'), keys('   \x1b'),
    ]),
    'rider-famine-touch': rider('rider-famine-touch', 'Famine'),
    'rider-pestilence-touch': rider('rider-pestilence-touch', 'Pestilence'),
    'rider-death-touch': rider('rider-death-touch', 'Death'),
    'yeenoghu-confusion': recipe('yeenoghu-confusion', 'Let Yeenoghu land his confusing weapon attack.', [
        ...practiceRoom(), ...create('hostile Yeenoghu'), ...wait(30),
    ]),
};

export function validateRound19Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const screens = session.segments.flatMap(segment => (segment.steps ?? []).map(step =>
        step.screen.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effectsFor(name).map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}

function recipe(name: string, description: string, actions: SessionAction[], options: string[] = []): Recipe {
    return {
        roles: ['wizard'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: effectsFor(name).map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r'), answer('To what experience level', '30\r'), ...actions, keys('\x1b:\x1b'),
        ] }],
    };
}
function effectsFor(name: string): readonly Effect[] {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-19 recipe ${name}`);
    return effects;
}
function rider(name: string, monster: string): Recipe {
    return recipe(name, `Face ${monster}'s special touch attack.`, [
        ...practiceRoom(), ...create(`hostile ${monster}`), ...wait(20), keys('\x18   \x1b'),
    ]);
}
function clash(name: string, attacker: string, defender: string): Recipe {
    return recipe(name, `Let ${attacker} attack ${defender} under conflict.`, [
        ...practiceRoom(), ...intrinsic('invulnerable', 1000), ...intrinsic('conflict', 1000),
        ...Array.from({ length: 4 }, () => [...clearMonsters(),
            ...create(`hostile ${attacker}`), ...create(`peaceful ${defender}`),
            ...create(`peaceful ${defender}`), ...create(`peaceful ${defender}`), ...wait(30)]).flat(),
    ]);
}
function containerTransfer(name: string, style: string): Recipe {
    return recipe(name, 'Put a potion into a sack, inspect the contents, and take it back out.', [
        ...practiceRoom(), ...wish('uncursed empty sack', 'uncursed potion of gain energy named cargo'), identify(),
        choose('sack', 'a*'), answer('Your sack', 'i'),
        ...(style === 'traditional' ? [answer('What kinds of thing', '!a\r')]
            : [choose('named cargo', ''), keys('\r')]),
        choose('sack', 'a*'), answer('Do what with', 'o'), answer('What kinds of thing', ':\r'),
        ...(style === 'traditional' ? [answer('What kinds of thing', 'a\r')]
            : [choose('named cargo', ''), keys('\r')]),
    ], [`menustyle:${style}`]);
}
function shopVisit(): SessionAction[] {
    return [...wish('blessed +50 gray dragon scale mail', 'uncursed gauntlets of power'), identify(), keys('T'), ...wait(5),
        choose('gray dragon scale mail', 'W*'), ...wait(5), choose('gauntlets of power', 'W*'), ...wait(3),
        ...intrinsic('pass thru walls', 2000),
        ...wish('blessed potion of object detection'), identify(), choose('minetn', 'm\x16'),
        choose('potion of object detection', 'q*'), keys('\x1b#wizmap\r')];
}
function stockPosition(visit: number): SessionAction[] {
    const meal = visit % 2 === 0 ? [...wish('uncursed K-ration'), choose('K-ration', 'me*')] : [];
    // One native Minetown variant is abandoned. Replacing the level gives
    // the same plan further opportunities to find an active shop.
    const replaceTown = visit > 0 && visit % 8 === 0 ? [keys('#wizmakemap\r'),
        ...wish('blessed potion of object detection'), identify(),
        choose('potion of object detection', 'q*'), keys('\x1b#wizmap\r')] : [];
    return [...meal, ...replaceTown, keys('\x14'), answer('Where do you want to be teleported?', '<.'),
        keys('\x14'), answer('Where do you want to be teleported?', `${'o'.repeat(visit % 8 + 1)}.`)];
}
function pickUp(classes = 'a'): SessionAction[] {
    return [keys(','), answer('What kinds of thing', `${classes}\r`), answer('Pick up', 'a')];
}
function pay(): SessionAction[] {
    return [keys('mp'), answer('Pay whom?', 'm.'), answer('Pay for which items?', ',\r')];
}
function buryBall(): SessionAction[] {
    return [...practiceRoom(), ...wish('uncursed scroll of punishment'), identify(),
        choose('scroll of punishment', 'r*'), keys('#wizbury\r')];
}
function practiceRoom(phasing = 1000): SessionAction[] {
    const actions = [...clearMonsters(), ...intrinsic('pass thru walls', phasing), keys('mhmk')];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            actions.push(...wish('fountain', 'floor'));
            if (column < 2) actions.push(keys(row % 2 === 0 ? 'ml' : 'mh'));
        }
        if (row < 2) actions.push(keys('mj'));
    }
    actions.push(keys('mhmk'), ...clearMonsters());
    return actions;
}
function clearMonsters(): SessionAction[] {
    return [...wish('blessed scroll of genocide'), identify(), choose('scroll of genocide', 'r*'), answer('What class of monsters', '*\r')];
}
function wish(...items: string[]): SessionAction[] {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}
function create(monster: string): SessionAction[] {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')];
}
function polyself(monster: string): SessionAction[] {
    return [keys('#polyself\r'), answer('Become what kind of monster?', `${monster}\r`)];
}
function intrinsic(property: string, turns: number): SessionAction[] {
    const page = ['pass thru walls', 'fire resistance', 'see invisible'].includes(property) ? 1
        : ['conflict', 'half physical damage', 'half spell damage'].includes(property) ? 2 : 0;
    return [keys(`#wizintrinsic\r${' '.repeat(page)}${turns}`), choose(property, ''), keys('\r')];
}
function wait(turns: number): SessionAction[] {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Call ', '\r'), answer('Die?', 'n')]).flat();
}
function fight(turns: number): SessionAction[] {
    return [...'hykulnjb'.repeat(Math.ceil(turns / 8))].flatMap(direction => [keys(`F${direction}`), answer('Really attack', 'y'), answer('Die?', 'n')]);
}
function identify(): SessionAction { return keys('\t\t\r'); }
function choose(target: string, openKeys: string): SessionAction { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt: string, value: string): SessionAction { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value: string): SessionAction { return { type: 'keys', value, dismissMore: true }; }
