import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';
import { ROUND17_RECIPES, validateRound17Recipe } from './round17-recipes.mjs';

type Effect = readonly [string, RegExp];
const effects: Record<string, readonly Effect[]> = {};
type ReusedRecipe = { name: string; validate(recording: RecipeRecording): RecipeCheck[] };
const reused: Record<string, ReusedRecipe> = {};

export const ROUND27_RECIPES: Record<string, Recipe> = {
    'r27-wizard-senses': recipe('r27-wizard-senses', 'Inspect live vision and wall modes, then smell the hero.', [
        ['vision flags displayed', /Flags:.*could see.*in sight/],
        ['seen vectors displayed', /@@/],
        ['wall modes displayed', /x{20}/],
        ['hero smelled', /surreptitiously sniff under your/],
        ['game identifier displayed', /The NHUUID for this game is/],
    ], [
        keys('#vision\r'), keys('\x1b'), keys('#wizseenv\r'), keys('\x1b'),
        keys('#wmode\r'), keys('\x1b'), keys('#wizshownhuuid\r'),
        keys('#wizsmell\r'), answer('Pick a monster to smell.', '.'), keys('\x1b'),
    ]),
    'r27-wizard-hurtle': recipe('r27-wizard-hurtle', 'Hurtle the hero with wizard telekinesis.', [
        ['hero propelled', /(?:float|fly|hurtl|sail|bump|collid)/i],
    ], [
        ...prepare(), keys('#wiztelekinesis\r'), answer('Pick a monster to hurtle.', '.'),
        answer('which direction?', 'l'), keys('\x1b'),
    ]),
    'r27-terrain-legend': recipe('r27-terrain-legend', 'Read the terrain encoding legend.', [
        ['terrain legend displayed', /#terrain encodings:/],
        ['terrain types explained', /stone.*(?:corridor|pool|room|door)|secret door/],
    ], [choose('legend of base-36', '#terrain\r'), keys('\x1b')]),
    'r27-healing-artifact-full-health': { ...recipe('r27-healing-artifact-full-health', 'Invoke a healing artifact while healthy.', [
        ['ineffective invocation reported', /surge of power, but nothing seems to happen/],
    ], [...prepare(), ...wish('blessed Staff of Aesculapius'), identify(), choose('Staff of Aesculapius', '#invoke\r*')]), roles: ['healer'] },
    'r27-royal-jelly-strength': recipe('r27-royal-jelly-strength', 'Eat royal jelly and gain strength.', [
        ['royal jelly eaten', /(?:royal jelly.*delicious|finish eating.*royal jelly)/],
        ['strength gained', /feel strong/],
    ], [...prepare(), ...wish('uncursed lump of royal jelly'), identify(), choose('royal jelly', 'me*'), ...wait(5)]),
    'r27-floating-fountain': recipe('r27-floating-fountain', 'Try drinking from a fountain while levitating.', [
        ['fountain beyond reach', /floating high above the fountain/],
    ], [...prepare(), ...wish('fountain'), ...intrinsic('levitating'), keys('>')]),
    'r27-punishment-ball-drop': recipe('r27-punishment-ball-drop', 'Carry then drop the punishment ball.', [
        ['punishment applied', /punished for your misbehavior/],
        ['ball dropped', /drop.*heavy iron ball/],
    ], [...prepare(), ...wish('uncursed scroll of punishment'), identify(), choose('scroll of punishment', 'r*'),
        keys(','), choose('heavy iron ball', 'd*')]),
    'r27-pick-boulder': recipe('r27-pick-boulder', 'Break an adjacent boulder with a pick.', [
        ['boulder broken', /boulder falls apart/],
    ], [...prepare(), ...wish('uncursed pick-axe'), identify(), keys('ml'), ...wish('boulder'), keys('mh'),
        choose('pick-axe', 'a*'), answer('In what direction', 'l'), ...wait(30)]),
    'r27-dig-altar': recipe('r27-dig-altar', 'Try digging down through an altar.', [
        ['altar resists digging', /altar is too hard to break apart/],
    ], [...prepare(), ...wish('neutral altar', 'uncursed pick-axe'), identify(),
        choose('pick-axe', 'a*'), answer('In what direction', '>'), ...wait(2)]),
    'r27-submerged-view': recipe('r27-submerged-view', 'Enter a pool as an eel and inspect the submerged view.', [
        ['hero enters water', /(?:water feels|under water|underwater|dive|submerge|plunge|touch bottom)/i],
        ['eel form acquired', /turn into a giant eel/],
    ], [...prepare(), ...polyself('giant eel'), ...wish('pool'), keys('mhml'), keys('\x12:'), ...wait(2)]),
    'r27-mimic-stethoscope': recipe('r27-mimic-stethoscope', 'Examine an object-disguised mimic with a stethoscope.', [
        ['disguise exposed', /(?:small|large|giant) mimic|That.s a mimic/],
        ['stethoscope used', /(?:heartbeat|healthy|Status of|mimic.*HP|mimic.*level)/i],
    ], [...prepare(), ...wish('uncursed stethoscope'), identify(),
        ...[...'hykulnjb'].flatMap(direction => [keys(`m${direction}`), ...wish('uncursed rock named mimic disguise'), identify(), choose('named mimic disguise', 'd*'), keys(`m${opposite(direction)}`)]),
        ...create('peaceful sleeping small mimic'),
        ...[...'hykulnjb'].flatMap(direction => [choose('stethoscope', 'a*'), answer('In what direction?', direction)])]),
    'r27-cursed-weapon-weld': recipe('r27-cursed-weapon-weld', 'Try to replace a welded cursed dagger.', [
        ['weapon welded', /(?:welded to your|cannot drop.*cursed|can.t.*welded)/],
    ], [...prepare(), ...wish('cursed +0 dagger named welded'), identify(), choose('named welded', 'w*'), choose('quarterstaff', 'w*')]),
    'r27-polymorph-resisted': recipe('r27-polymorph-resisted', 'Try to polymorph a magic-resistant gray dragon.', [
        ['dragon resists polymorph', /gray dragon resists/],
    ], [...prepare(), ...wish('uncursed wand of polymorph (0:30)', 'uncursed stethoscope'), identify(), ...create('peaceful sleeping gray dragon'),
        ...[...'hykulnjb'].flatMap(direction => [choose('wand of polymorph', 'z*'), answer('In what direction?', direction)]),
        ...[...'hykulnjb'].flatMap(direction => [choose('stethoscope', 'a*'), answer('In what direction?', direction)])]),
    'r27-container-action-help': recipe('r27-container-action-help', 'Ask for help at the traditional container prompt.', [
        ['container actions explained', /Container actions:/],
        ['stash action explained', /Stash: put one item in/],
    ], [...prepare(), ...wish('uncursed empty sack'), identify(), choose('sack', 'a*'),
        answer('Your sack', '?'), answer('Your sack', 'q'), answer('Do what with', 'q')], ['menustyle:traditional']),
    'r27-polymorphed-level-gain': recipe('r27-polymorphed-level-gain', 'Gain experience while in monster form.', [
        ['monster form acquired', /turn into a red dragon/],
        ['level gained while polymorphed', /more experienced/],
    ], [...prepare(), ...polyself('red dragon'), ...wish('uncursed potion of gain level'), identify(),
        choose('potion of gain level', 'q*')]),
    'r27-target-area-filter': recipe('r27-target-area-filter', 'Limit farlook targets to the current terrain area.', [
        ['area filter selected', /Limiting targets to those in same area/],
        ['monster examined', /lichen/],
    ], [...prepare(), ...create('peaceful sleeping lichen'), keys(';'),
        answer('Pick a monster, object or location.', '""m.'), keys('\x1b')]),
    'r27-item-protection': recipe('r27-item-protection', 'Describe carried-item protection supplied by worn rings.', [
        ['fire protection described', /items are protected from fire by your ring/],
        ['cold protection described', /items are protected from cold by your ring/],
    ], [...prepare(), ...wish('uncursed ring of fire resistance', 'uncursed ring of cold resistance'), identify(),
        choose('ring of fire resistance', 'P*'), answer('Which ring-finger', 'l'),
        choose('ring of cold resistance', 'P*'), answer('Which ring-finger', 'r'), keys('\x18'), keys('         \x1b')]),
    'r27-zero-strength-ring': recipe('r27-zero-strength-ring', 'Wear an unidentified ring with no strength adjustment.', [
        ['ring worn', /named zero strength.*(?:left|right) hand/],
    ], [...prepare(), ...wish('uncursed +0 ring of gain strength named zero strength'),
        choose('named zero strength', 'P*'), answer('Which ring-finger', 'l'), keys('i'), keys('\x1b')]),
    'r27-restricted-artifact-name': recipe('r27-restricted-artifact-name', 'Try to name an ordinary long sword Excalibur.', [
        ['artifact name rejected', /While engraving, your hand slips|cannot name|can.t name|name.*(?:slip|fades)/],
    ], [...prepare(), ...wish('uncursed long sword named candidate'), identify(),
        choose('a particular object in inventory', 'C'), choose('named candidate', '*'),
        answer('What do you want to name', 'Excalibur\r'), keys('i'), keys('\x1b')]),
    'r27-unique-discoveries': recipe('r27-unique-discoveries', 'List invocation-item and artifact discoveries.', [
        ['unique objects listed', /Unique items/], ['artifact list displayed', /Artifacts\n.*Excalibur/s],
    ], [...prepare(), ...wish('uncursed Bell of Opening', 'uncursed Candelabrum of Invocation', 'uncursed Book of the Dead'),
        identify(), keys('\\'), keys('\x1b'), keys('`'), answer('View discoveries', 'a'), answer('Dump information about all artifacts?', 'y'), keys('     \x1b')], ['menustyle:traditional']),
    'r27-earth-cave-digging': recipe('r27-earth-cave-digging', 'Chop a tree on the Plane of Earth with a blessed axe.', [
        ['earth plane reached', /\bEarth\b/],
        ['cave reshaped', /mysterious force.*cave around you|ceiling collapses around you/],
    ], [...prepare(), ...wish('blessed +5 battle-axe'), identify(), ...intrinsic('invulnerable'), choose('earth', 'm\x16'),
        answer('For what do you wish', 'nothing\r'), ...clearMonsters(),
        ...Array.from({ length: 10 }, () => [keys('ml'), ...wish('tree'), keys('mh'),
            choose('battle-axe', 'a*'), answer('In what direction', 'l'), ...wait(12), ...clearMonsters()]).flat()]),
    'r27-obstructed-door': recipe('r27-obstructed-door', 'Close an open doorway containing an object.', [
        ['door blocked', /Something.s in the way/],
    ], [...prepare(), keys('ml'), ...wish('wall', 'open door', 'uncursed apple'), identify(), choose('apple', 'd*'), keys('mh'),
        keys('c'), answer('In what direction?', 'l')]),
    'r27-acid-iron-bars': recipe('r27-acid-iron-bars', 'Dissolve iron bars with a wielded potion of acid.', [
        ['bars dissolved', /iron bars (?:are dissolved|dissolve|disappear)|bars dissolve/],
    ], [...prepare(), ...wish('iron bars', 'uncursed potion of acid'), identify(), choose('potion of acid', 'w*'),
        keys('mhFl')]),
    'r27-mimic-meal-expiration': recipe('r27-mimic-meal-expiration', 'Eat a small mimic corpse and let the disguise wear off.', [
        ['mimic meal finished', /finish eating the small mimic corpse/],
        ['mimicry ends', /prefer mimicking (?:a human|an elf|a gnome|an orc|a dwarf) again/],
    ], [...prepare(), ...wish('uncursed small mimic corpse'), identify(), choose('small mimic corpse', 'me*'), ...wait(40)]),
    'r27-floor-meal': recipe('r27-floor-meal', 'Eat food from the floor across several bites.', [
        ['floor meal finished', /finish eating the food ration|finally finished/],
    ], [...prepare(), ...wish('uncursed food ration'), identify(), choose('food ration', 'd*'), keys('e'),
        answer('There is ', 'y'), answer('There are ', 'y'), ...wait(10)]),
    'r27-controlled-class-polymorph': recipe('r27-controlled-class-polymorph', 'Choose a class letter during controlled polymorph.', [
        ['dragon class chosen', /turn into (?:a|an) (?:baby )?[^.\n]+ dragon/],
    ], [...prepare(), ...polyself('D')]),
    'r27-angel-figurine': recipe('r27-angel-figurine', 'Animate Angel figurines as ordinary pets.', [
        ['Angel animated', /figurine transform into.*Angel|Angel (?:appears|comes to life)|figurine beside you and it transforms/],
    ], [...prepare(), ...Array.from({ length: 6 }, () => [
        ...wish('blessed figurine of an Angel'), identify(), choose('figurine of an Angel', 'a*'),
        answer('In what direction?', 'l'), keys('mhmh'),
    ]).flat()]),
    'r27-monster-adventurer-chat': recipe('r27-monster-adventurer-chat', 'Chat with a hostile adventurer on an elemental plane.', [
        ['adventurer answers', /Talk\? -- (?:I can.t win|You don.t deserve|Mine should|The low-life|Fight, scum|Here is what)/],
    ], [...prepare(), ...intrinsic('invulnerable'), choose('air:', 'm\x16'),
        answer('For what do you wish', 'nothing\r'), ...clearMonsters(), ...create('hostile barbarian'), ...[...'hykulnjb'].flatMap(direction =>
        [keys('#chat\r'), answer('Talk to whom?', direction)])]),
    'r27-wish-assistance': recipe('r27-wish-assistance', 'Ask for wish syntax assistance at the wish prompt.', [
        ['wish help displayed', /Wish details:/], ['remaining tries explained', /randomly chosen item will be granted/],
    ], [keys('\x17'), answer('For what do you wish', 'help\r'),
        answer('For what do you wish', 'nothing\r')]),
    'r27-interactive-key-binding': recipe('r27-interactive-key-binding', 'Bind a key to toggle autopickup and inspect the changed binding.', [
        ['key bound to command', /(?:Bound|Changed) key.*~.*toggle/],
        ['changed binding listed', /BIND=~:toggle\(autopickup\)/], ['bound key works', /autopickup.*(?:toggled on|ON)/],
    ], [choose('bind keys', '#optionsfull\r'), keys('\r'), choose('bind key to a command', ''),
        answer('Bind which key?', '~'), choose('toggle:', ''), answer('Command toggle requires a parameter:', 'autopickup\r'), choose('view changed key binds', ''), keys('\x1b'),
        keys('\x1b\x1b~'), keys('\x1b')]),
    'r27-status-title-and-timeout': recipe('r27-status-title-and-timeout', 'Highlight a polymorphed title and expire temporary status changes.', [
        ['polymorphed title described', /Red Dragon/], ['experience gained', /more experienced/],
    ], [...prepare(), ...polyself('red dragon'), ...wish('uncursed potion of gain level'), identify(),
        choose('potion of gain level', 'q*'), ...wait(10)],
        ['hilite_status:title/(polymorphed)/green', 'hilite_status:hitpoints/down/red',
            'hilite_status:experience-points/>50%/blue', 'statushilites:3']),
    'r27-critical-hitpointbar': recipe('r27-critical-hitpointbar', 'Display critical HP in a hitpoint bar.', [
        ['critical HP reached', /HP:[1-3]\(/], ['critical title padded', /Wizard.* - -|Wizard.*--|Wizard.*- /],
    ], [...clearMonsters(), ...wish('uncursed potion of sickness'), identify(),
        ...Array.from({ length: 8 }, () => [...wish('uncursed potion of sickness'), identify(),
            choose('of sickness', 'q*'), answer('Die?', 'n')]).flat()],
        ['hitpointbar', 'hilite_status:hitpoints/criticalhp/red']),
    'r27-trapped-chest-colors': recipe('r27-trapped-chest-colors', 'Open trapped chests until a colored gas trap fires.', [
        ['colored gas released', /cloud of (?!noxious\b)[^\n]+ gas billows|puff of .* gas/],
    ], [...prepare(), ...intrinsic('invulnerable'), ...intrinsic('free action'), ...intrinsic('drain resistance'),
        ...Array.from({ length: 12 }, (_, index) => [
            ...wish(`uncursed empty unlocked trapped chest named gas ${index}`), identify(),
            choose(`named gas ${index}`, 'a*'), answer('Do what', 'q'), answer('Your chest', 'q'), answer('Die?', 'n'),
            keys('\x1b\x1b'), choose(`named gas ${index}`, 'd*'), ...wait(25),
        ]).flat()]),
    'r27-prayer-cloud-safety': recipe('r27-prayer-cloud-safety', 'Pray for rescue from a dangerous stinking cloud.', [
        ['cloud removed by prayer', /gas cloud enveloping you dissipates|gas cloud has dissipated/],
    ], [...prepare(), ...wish('blessed scroll of stinking cloud'), identify(),
        choose('stinking cloud', 'r*'), answer('Where do you want to center', '.'),
        answer('(For instructions type', '.'), keys('#pray\r'), answer('Are you sure you want to pray?', 'y'),
        answer('Force the gods to be pleased?', 'y'), ...wait(5)]),
    'r27-visible-cloud-timeout': recipe('r27-visible-cloud-timeout', 'Inspect the remaining lifetime of a stinking cloud.', [
        ['region lifetime listed', /Visible regions/], ['poison cloud described', /poison gas/],
    ], [...intrinsic('poison resistance'), ...wish('uncursed scroll of stinking cloud'), identify(),
        choose('stinking cloud', 'r*'), answer('Where do you want to center', '.'),
        answer('(For instructions type', '.'), keys('#timeout\r'), keys('          \x1b')]),
    'r27-guardian-corpse-genus': recipe('r27-guardian-corpse-genus', 'Wish for a quest guardian corpse and inspect its role species.', [
        ['guardian becomes role corpse', /wizard corpse/],
    ], [...prepare(), ...wish('uncursed apprentice corpse'), identify(), keys('i'), keys('\x1b')]),
    'r27-missile-spell-hit': recipe('r27-missile-spell-hit', 'Cast magic missile at a dragon.', [
        ['missile resolves against monster', /magic missile (?:hits|misses)|(?:red dragon|dragon) (?:is killed|is destroyed)/],
    ], [...prepare(), ...intrinsic('invulnerable'), ...create('hostile sleeping red dragon'),
        ...[...'hykulnjb'].flatMap(direction => [choose('magic missile', '#wizcast\r'), answer('In what direction?', direction)])]),
    'r27-mjollnir-return': { ...recipe('r27-mjollnir-return', 'Throw Mjollnir as a Valkyrie with giant strength.', [
        ['hammer flight resolved', /Mjollnir.*(?:returns|return|hand|back)/],
    ], [...prepare(), ...wish('blessed Mjollnir', 'uncursed gauntlets of power'), identify(),
        choose('gauntlets of power', 'W*'), choose('Mjollnir', 'w*'),
        choose('Mjollnir', 't*'), answer('In what direction?', 'h')]), roles: ['valkyrie'], genders: ['female'] },
    'r27-minetown-dig-witness': recipe('r27-minetown-dig-witness', 'Damage town terrain in view of a watchman.', [
        ['watchman arrests vandal', /Halt, vandal!.*under arrest/],
    ], [...prepare(), ...intrinsic('invulnerable'), ...wish('uncursed wand of digging (0:20)'), identify(),
        choose('minetn', 'm\x16'), keys('#wizmap\r\x14'), answer('Where do you want to be teleported?', '!{.'),
        ...create('peaceful watchman'),
        choose('wand of digging', 'z*'), answer('In what direction?', '>')]),
    'r27-long-worm-probing': recipe('r27-long-worm-probing', 'Tame a long worm and inspect its growing tail.', [
        ['worm tamed', /long worm.*(?:tame|friendly)|Status of.*long worm/],
        ['segments described', /of [2-9][0-9]* segments/],
    ], [...prepare(), ...intrinsic('invulnerable'), ...wish('uncursed stethoscope', 'blessed scroll of taming'), identify(),
        ...create('hostile long worm'), choose('scroll of taming', 'r*'), ...wait(40),
        ...[...'hykulnjb'].flatMap(direction => [choose('stethoscope', 'a*'), answer('In what direction?', direction)])]),
    'r27-unchanging-prayer': recipe('r27-unchanging-prayer', 'Pray while trapped in a handless form by a cursed amulet.', [
        ['unchanging amulet uncursed', /amulet of unchanging.*(?:glows|uncursed)|amber/],
    ], [...prepare(), ...wish('cursed amulet of unchanging'), identify(), ...polyself('giant eel'),
        choose('amulet of unchanging', 'P*'), keys('#pray\r'), answer('Are you sure you want to pray?', 'y'),
        answer('Force the gods to be pleased?', 'y'), ...wait(5)]),
    'r27-artifact-storm-path': recipe('r27-artifact-storm-path', 'Aim an artifact fire storm beyond the hero.', [
        ['fire storm aimed', /Where do you want to cast/], ['storm explodes', /caught in the fireball/],
    ], [...prepare(), ...intrinsic('fire resistance'), ...wish('uncursed Fire Brand'), identify(), keys('ml'), ...wish('fountain', 'floor'), keys('mh'),
        choose('Fire Brand', '#invoke\r*'), answer('Where do you want to cast', 'l.'), answer('(For instructions type', 'l.')]),
    'r27-worn-ring-polymorph': recipe('r27-worn-ring-polymorph', 'Polymorph a ring without removing it from the finger.', [
        ['polymorphed ring stays worn', /ring.*left hand|Nothing seems to happen/],
        ['polymorph potion selected', /potion of polymorph/],
    ], [...prepare(), ...wish('uncursed +2 ring of gain strength named changing', 'uncursed potion of polymorph'), identify(),
        choose('named changing', 'P*'), answer('Which ring-finger', 'l'), choose('named changing', '#dip\r*'),
        choose('potion of polymorph', '*'), keys('i'), keys('\x1b')]),
    'r27-oracle-existing-name': recipe('r27-oracle-existing-name', 'Ask the Oracle to keep her existing name.', [
        ['existing name recognized', /already called.*Oracle|already named.*Oracle/],
    ], [...prepare(), ...create('peaceful Oracle'), choose('a monster', 'C'), keys('m.'),
        answer('What do you want to call', 'Oracle\r')]),
    'r27-overexertion': recipe('r27-overexertion', 'Move while heavily loaded until there is too little stamina to continue.', [
        ['heavy load reached', /(?:Overtaxed|Strained)/], ['movement exhausts hero', /enough stamina to move/],
    ], [...prepare(), keys('#levelchange\r'), answer('To what experience level', '1\r'),
        ...wish('cursed loadstone', 'cursed loadstone', 'cursed loadstone'), identify(),
        ...Array.from({ length: 120 }, () => [keys('mhml'), answer('Die?', 'n')]).flat()]),
    'r27-shop-price-and-throw': recipe('r27-shop-price-and-throw', 'Ask a candle price and throw an owned dagger inside its shop.', [
        ['shop price quoted', /price.*[0-9]+ (?:zorkmids|gold)|[0-9]+ zorkmids.*(?:each|for)/],
        ['owned dagger thrown', /dagger.*(?:floor|sell|offer|drop)|What do you want to throw/],
    ], [...prepare(), ...lightingShop(), keys('#chat\r'), answer('Talk to whom?', '.'),
        ...wish('uncursed dagger named thrown merchandise'), identify(), choose('named thrown merchandise', 't*'),
        answer('In what direction?', 'l'), answer('Izchak offers', 'y'), keys('#overview\r'), keys('          \x1b')]),
    'r27-monster-invisibility': recipe('r27-monster-invisibility', 'Make a visible monster invisible while seeing invisible.', [
        ['invisibility noticed', /transparent|invisible lichen/],
    ], [...prepare(), ...intrinsic('see invisible'), ...wish('uncursed wand of make invisible (0:20)'), identify(),
        ...create('peaceful sleeping lichen'), ...[...'hykulnjb'].flatMap(direction => [choose('wand of make invisible', 'z*'), answer('In what direction?', direction)]),
        keys(';'), answer('Pick a monster, object or location.', 'm.'), keys('\x1b')]),
    'r27-temporary-strength-highlight': recipe('r27-temporary-strength-highlight', 'Let a temporary strength highlight expire after eating royal jelly.', [
        ['strength gained', /feel strong/], ['sound option displayed', /soundlib.*nosound/],
    ], [...prepare(), ...wish('uncursed lump of royal jelly'), identify(), choose('royal jelly', 'me*'), ...wait(8),
        keys('#optionsfull\r'), keys('            \x1b')],
        ['hilite_status:strength/up/green', 'statushilites:3', 'cond_blind', 'soundlib:nosound']),
    'r27-alternate-weapon-actions': recipe('r27-alternate-weapon-actions', 'Unwield the alternate dagger through its inventory actions.', [
        ['alternate weapon unwielded', /no longer.*(?:alternate|second)|no longer have a second weapon|no secondary weapon|no alternate weapon/],
    ], [...prepare(), ...wish('uncursed dagger named alternate'), identify(), choose('named alternate', 'w*'), keys('x'),
        choose('named alternate', '*'), answer('Do what with', '-'), keys('i'), keys('\x1b')]),
    'r27-slippery-offhand': { ...recipe('r27-slippery-offhand', 'Try using two weapons with slippery fingers.', [
        ['offhand slips out', /slips? from your left hand/],
    ], [...prepare(), ...wish('uncursed short sword', 'uncursed dagger named offhand'), identify(),
        choose('named offhand', 'w*'), choose('short sword', 'w*'),
        ...intrinsic('slippery fingers'), keys('#twoweapon\r')], ['pushweapon']), roles: ['rogue'] },
    'r27-swallowed-fire-and-throw': recipe('r27-swallowed-fire-and-throw', 'Throw a dagger and ignite a fire scroll inside an air elemental.', [
        ['hero swallowed', /air elemental engulfs you/], ['internal explosion described', /gets heartburn|gets slightly toasted/],
        ['dagger thrown', /What do you want to throw/],
    ], [...swallowedSetup(), choose('dagger', 't*'), answer('In what direction?', 'l'),
        choose('scroll of fire', 'r*'), answer('Call ', '\r')]),
    'r27-starting-pauper-reroll': recipe('r27-starting-pauper-reroll', 'Inspect and accept a rerollable pauper character.', [
        ['reroll offered', /Reroll this character/], ['pauper has no inventory', /Not carrying anything/],
    ], [choose('start the game with this character', ''), keys('i')], ['pauper', 'reroll']),
};

const tutorialEntry = recipe('r27-tutorial-entry', 'Enter the tutorial and read its command-key engraving.', [
    ['tutorial entered', /Entering the tutorial/], ['tutorial level displayed', /Tutorial/],
    ['tutorial engraving read', /engraved here|Welcome to the tutorial|Welcome to NetHack/],
], []);
tutorialEntry.build = ({ seed, datetime, rc }) => [{ seed, datetime,
    nethackrc: rc().replace(',!tutorial', ''),
    driver: [choose('Yes, do a tutorial', ''), keys(':')],
}];
ROUND27_RECIPES['r27-tutorial-entry'] = tutorialEntry;

const waterRestore = recipe('r27-punished-water-restore', 'Drift with the ball and chain, then restore the Plane of Water.', [
    ['water plane reached', /air bubble surrounded by water/],
    ['punishment applied', /punished for your misbehavior/],
    ['game saved', /Be seeing you/], ['water plane restored', /welcome back to NetHack/i],
], []);
waterRestore.build = ({ seed, datetime, rc }) => [
    { seed, datetime, nethackrc: rc(), driver: [...prepare(), ...intrinsic('magical breathing'), ...intrinsic('invulnerable'),
        ...wish('uncursed scroll of punishment'), identify(), choose('of punishment', 'r*'),
        choose('water', 'm\x16'), answer('For what do you wish', 'nothing\r'), ...clearMonsters(),
        ...wait(5), keys('mh'.repeat(10) + 'ml'.repeat(10)), keys('S'), answer('Really save?', 'y'),
        { type: 'keys', value: '', dismissMore: true, expectExit: true }] },
    { seed, datetime, nethackrc: rc(), driver: [...wait(3), keys(':\x1b')] },
];
ROUND27_RECIPES['r27-punished-water-restore'] = waterRestore;

const oracleBones = recipe('r27-oracle-bones-restore', 'Leave fruit and an engraving on Oracle bones, then load the ancestral level.', [
    ['bones saved', /Save bones\?/], ['bones loaded', /Get bones\?/],
    ['ancestral level restored', /Unlink bones\?/],
], [], ['disclose:-i -a -v -g -c -o', 'fruit:coverage pear']);
oracleBones.build = ({ seed, datetime, rc }) => [
    { seed, datetime, nethackrc: rc(), driver: [...prepare(), ...intrinsic('fire resistance'), choose('oracle', 'm\x16'),
        ...wish('uncursed bow named ancestral', 'uncursed coverage pear'), identify(),
        keys('E'), answer('What do you want to write with?', '-'), answer('What do you want to write', 'Elbereth\r'),
        keys('#wizkill\r'), answer('Pick first monster to slay:', '.'), answer('Commit suicide?', 'yes\r'), answer('Die?', 'y'),
        answer('Save bones?', 'y'), { type: 'keys', value: '', dismissMore: true, expectExit: true }] },
    { seed, datetime, nethackrc: rc(), driver: [...prepare(), ...intrinsic('monster detection'),
        ...wish('blessed potion of object detection'), identify(), choose('oracle', 'm\x16'), answer('Get bones?', 'y'),
        answer('Unlink bones?', 'y'), keys(':\x1b')] },
];
ROUND27_RECIPES['r27-oracle-bones-restore'] = oracleBones;

const partialCharacter = recipe('r27-partial-character', 'Choose the missing gender for an otherwise specified character.', [
    ['partial choice offered', /Shall I pick.*gender/], ['gender chosen', /Pick a gender or sex/],
    ['game started', /welcome to NetHack/i],
], []);
partialCharacter.characterSelection = 'startup';
partialCharacter.build = ({ seed, datetime, rc }) => [{ seed, datetime,
    nethackrc: rc().replace(/,gender:[^,\n]+/g, '') + 'OPTIONS=role:!monk\n',
    driver: [answer('Shall I pick', 'n'), answer('Pick a gender or sex', 'm'), answer('Is this ok?', 'y'), keys(':')],
}];
ROUND27_RECIPES['r27-partial-character'] = partialCharacter;

const disabledCount = recipe('r27-unbound-count-key', 'List the disabled count prefix in numeric keypad mode.', [
    ['disabled count prefix described', /\[count\].*Prefix/],
], [], ['number_pad:1']);
disabledCount.build = ({ seed, datetime, rc }) => [{ seed, datetime,
    nethackrc: rc() + 'BIND=^C:count\n',
    driver: [choose('Full list of keyboard commands', '?'), keys('                  \x1b')],
}];
ROUND27_RECIPES['r27-unbound-count-key'] = disabledCount;

// These command plans already test the intended effects. Re-record them with
// native profiles: their original round did not retain function coverage.
for (const name of ['status-hilite-config', 'discovery-sorts', 'naming-calls', 'help-tour']) {
    reuse(name, ROUND17_RECIPES, recording => validateRound17Recipe(name, recording));
}

function reuse(name: string, group: Record<string, Recipe>, validate: ReusedRecipe['validate']): void {
    const original = group[name];
    if (!original) throw new Error(`Missing reusable recipe ${name}`);
    const key = `r27-${name}`;
    ROUND27_RECIPES[key] = original;
    reused[key] = { name, validate };
}

function recipe(name: string, description: string, evidence: readonly Effect[], actions: SessionAction[], options: string[] = []): Recipe {
    effects[name] = evidence;
    return {
        roles: ['wizard'], options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: evidence.map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [...actions, keys('\x1b:\x1b')] }],
    };
}

export function validateRound27Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const prior = reused[name];
    if (prior) return prior.validate(session);
    const evidence = effects[name];
    if (!evidence) throw new Error(`Unknown round-27 recipe ${name}`);
    const text = session.segments.flatMap(segment => segment.steps ?? []).map(step =>
        step.screen.replace(/\x1b\[(\d+)C/g, (_match, count: string) => ' '.repeat(Number(count)))
            .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, '')).join('\n');
    return [
        { check: 'recorded version-5 segments', ok: session.version === 5 && session.segments.length === (name.endsWith('-restore') ? 2 : 1) && session.segments.every(segment => (segment.steps?.length ?? 0) >= 2), evidence: '' },
        ...evidence.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}

function prepare(): SessionAction[] {
    return [keys('#levelchange\r'), answer('To what experience level', '20\r'),
        ...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r'),
        ...intrinsic('pass thru walls'), keys('ml'), ...wish('fountain', 'floor')];
}
function clearMonsters(): SessionAction[] { return [...wish('blessed scroll of genocide'), identify(),
    choose('of genocide', 'r*'), answer('What class of monsters', '*\r')]; }
function swallowedSetup(): SessionAction[] {
    return [...prepare(), ...intrinsic('fire resistance'), ...wish('uncursed ring of slow digestion',
        'uncursed dagger', 'uncursed scroll of fire', 'uncursed scroll of scare monster',
        ...Array.from({ length: 8 }, () => 'blessed potion of full healing')), identify(),
        choose('ring of slow digestion', 'P*'), answer('Which ring-finger', 'l'), ...create('hostile air elemental'),
        ...Array.from({ length: 12 }, (_, index) => index % 3 === 2
            ? [choose('of full healing', 'q*'), answer('Die?', 'n')]
            : wait(1)).flat()];
}
function lightingShop(): SessionAction[] {
    return [...intrinsic('monster detection'), ...wish('blessed potion of object detection'), identify(),
        choose('minetn', 'm\x16'), choose('potion of object detection', 'q*'), keys('\x1b#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '!'), choose('candle', 'o'), keys('.')];
}
function opposite(direction: string): string {
    return direction === 'h' ? 'l' : direction === 'y' ? 'n' : direction === 'k' ? 'j' : direction === 'u' ? 'b'
        : direction === 'l' ? 'h' : direction === 'n' ? 'y' : direction === 'j' ? 'k' : 'u';
}
function intrinsic(property: string): SessionAction[] { return [keys('#wizintrinsic\r5000'), choose(property, ''), keys('\r')]; }
function create(monster: string): SessionAction[] { return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')]; }
function polyself(monster: string): SessionAction[] { return [keys('#polyself\r'), answer('Become what kind of monster?', `${monster}\r`)]; }
function wish(...items: string[]): SessionAction[] { return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]); }
function wait(turns: number): SessionAction[] { return Array.from({ length: turns }, () => [keys('m.'), answer('Die?', 'n')]).flat(); }
function identify(): SessionAction { return keys('\t\t\r'); }
function choose(target: string, openKeys: string): SessionAction { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt: string, value: string): SessionAction { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value: string): SessionAction { return { type: 'keys', value, dismissMore: true }; }
