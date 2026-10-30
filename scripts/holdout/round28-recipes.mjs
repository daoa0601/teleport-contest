const effects = {};
export const ROUND28_RECIPES = {
    'r28-rogue-level': recipe('r28-rogue-level', 'Walk and regenerate the Rogue level using its colored symbols.', [
        ['Rogue level entered', /primitive world/], ['Rogue level remembered', /A primitive area/],
    ], [...prepare(), choose('rogue:', 'm\x16'), keys('#wizmap\r'), keys('mhml'),
        keys('#wizmakemap\r'), answer('Really regenerate', 'y'), keys('#wizmap\r'),
        keys('#overview\r'), keys('\x1b')], ['roguesymset:RogueEpyx']),
    'r28-branch-pet': recipe('r28-branch-pet', 'Climb out of Sokoban with a tame follower and inspect the branch connection.', [
        ['branch stairs remembered', /Stairs up to Sokoban/],
        ['pet follows to the dungeon', /little dog/],
    ], [...prepare(), choose('soko4:', 'm\x16'), keys('#wizmap\r'),
        keys('\x14'), answer('Where do you want to be teleported?', '!>.'),
        ...create('tame little dog'), keys('><'), keys('#overview\r'), keys('\x1b'),
        keys(';'), answer('Pick a monster, object or location.', 'm'), choose('tame little dog', ''), keys('.\x1b')]),
    'r28-interrupted-meal': recipe('r28-interrupted-meal', 'Stop eating a ration when nearly full and resume the same meal.', [
        ['meal resumed', /resume your meal|consume the last bite of your meal/],
        ['meal finished', /finish eating.*food ration|finally finished/],
    ], [...prepare(), ...wish('uncursed lump of royal jelly', 'uncursed food ration'), identify(),
        choose('royal jelly', 'me*'),
        choose('food ration', 'me*'), answer('Continue eating?', 'n'),
        choose('partly eaten food ration', 'me*'), answer('Continue eating?', 'y'), ...wait(10)]),
    'r28-hallucinated-breath': recipe('r28-hallucinated-breath', 'Receive a dragon breath attack while hallucinating.', [
        ['hallucination starts', /Everything looks so cosmic/i],
        ['hallucinated blast reaches hero', /blast of [^\n]+ (?:hits|misses) you/],
    ], [...prepare(), ...intrinsic('invulnerable'), ...intrinsic('fire resistance'),
        ...wish('uncursed potion of hallucination'), identify(),
        ...boulderRing(), ...create('hostile red dragon'),
        choose('potion of hallucination', 'q*'),
        ...wait(100)]),
    'r28-accessible-monsters': recipe('r28-accessible-monsters', 'Reveal several monsters and announce their relative positions.', [
        ['lichen announced', /lichen.*(?:north|south|east|west)|(?:north|south|east|west).*lichen/],
        ['dragon announced', /red dragon.*(?:north|south|east|west)|(?:north|south|east|west).*red dragon/],
    ], [...prepare(), ...wish('uncursed blindfold'), identify(), choose('blindfold', 'P*'),
        ...create('peaceful sleeping lichen'), ...create('peaceful sleeping red dragon'),
        keys('R')], ['accessiblemsg', 'spot_monsters']),
    'r28-clerical-geyser': recipe('r28-clerical-geyser', 'Fight a high cleric until it casts a physical geyser.', [
        ['geyser strikes', /sudden geyser slams into you/],
    ], [...prepare(), ...wish('blessed +30 gray dragon scale mail'), identify(),
        keys('T'), choose('gray dragon scale mail', 'W*'), ...create('hostile high cleric'), ...wait(150)]),
    'r28-monster-gaze': recipe('r28-monster-gaze', 'Let a hostile Medusa gaze at a visible tame dragon.', [
        ['Medusa gazes at a monster', /Medusa gazes (?:at|toward) the red dragon/],
    ], [...prepare(), ...intrinsic('stoning resistance'), ...intrinsic('see invisible'),
        ...create('tame red dragon'), ...create('hostile Medusa'), ...wait(30)]),
    'r28-rider-boulders': recipe('r28-rider-boulders', 'Make a Rider approach through a ring of boulders.', [
        ['Rider breaks a boulder', /boulder falls apart/],
    ], [...prepare(), ...boulderRing(),
        ...create('hostile Death'), ...wait(25)]),
    'r28-grabber-fear': recipe('r28-grabber-fear', 'Scare an owlbear into releasing the hero from its grasp.', [
        ['owlbear holds hero', /owlbear grabs you/], ['fear releases hero', /You get released!/],
    ], [...prepare(), ...openNeighbors(), ...wish('uncursed tooled horn'), identify(), ...create('hostile owlbear'),
        ...wait(5), choose('tooled horn', 'a*'), answer('Improvise?', 'y'), ...wait(2)]),
    'r28-monster-polymorph': recipe('r28-monster-polymorph', 'Let an intelligent monster collect and use a polymorph wand.', [
        ['monster uses polymorph', /zaps (?:himself|herself|itself)|suddenly mutates/],
        ['monster changes form', /turns into (?:a|an) |suddenly mutates/],
    ], [...prepare(), ...corridor(), ...wish('blessed scroll of light'), identify(),
        ...Array.from({ length: 5 }, () => [keys('ml'), ...wish('fountain', 'floor', 'uncursed wand of polymorph (0:20)'),
            identify(), choose('wand of polymorph', 'd*')]).flat(),
        ...create('hostile gnomish wizard'), keys('\x14'), answer('Where do you want to be teleported?', 'hhhhhh.'),
        choose('blessed scroll of light', 'r*'), ...wait(80)]),
    'r28-counted-pickup': recipe('r28-counted-pickup', 'Pick a requested count from a floor stack in traditional menu mode.', [
        ['counted pickup offered', /Pick 2 of what/], ['two rocks acquired', /2 (?:uncursed )?rocks/],
    ], [...prepare(), ...wish('uncursed rock', 'uncursed rock', 'uncursed rock'), identify(),
        choose('rocks', 'd*'), ...wish('uncursed apple', 'uncursed apple', 'uncursed apple'), identify(),
        choose('apples', 'd*'), keys('m2,'), choose('rocks', ''), keys('\r'), keys('i'), keys('\x1b')], ['menustyle:traditional']),
    'r28-chest-shattering': recipe('r28-chest-shattering', 'Force locked chests with a blunt weapon until one shatters its contents.', [
        ['chest destroyed', /totally destroyed the chest/], ['contents destroyed', /shatter|torn to shreds|is crushed|is pulped|is mashed|is destroyed/],
    ], [...prepare(), ...wish('uncursed +5 war hammer'), identify(), choose('war hammer', 'w*'),
        ...Array.from({ length: 8 }, (_, index) => [...wish(`uncursed locked chest named hammer ${index}`), identify(),
            choose(`named hammer ${index}`, 'd*'), keys('#force\r'), answer('There is ', 'y'),
            ...wait(60), ...clearMonsters(), keys('ml'), ...wish('fountain', 'floor')]).flat()]),
    'r28-castle-tune': recipe('r28-castle-tune', 'Play a tune at the intact Castle drawbridge and read the overview hint.', [
        ['Castle tune hint remembered', /play (?:5-note tune|notes "[A-G]{5}") to open or close drawbridge/],
    ], [...prepare(), ...wish('uncursed wooden flute'), identify(), ...castleApproach(),
        ...playTune(), keys('ml'.repeat(56)), ...playTune(), keys('#overview\r'), keys('\x1b')]),
    'r28-container-explosion': recipe('r28-container-explosion', 'Destroy a bag of holding during traditional insertion of several tools.', [
        ['nested bags explode', /magical explosion|magic bags.*explode/],
    ], [...prepare(), ...wish('uncursed empty bag of holding named outer', 'uncursed empty bag of holding named inner', 'uncursed stethoscope named waiting'), identify(),
        choose('named outer', 'a*'), answer('Your bag', 'i'),
        answer('What kinds of thing', '(\r'), answer('Put in:', 'a'), ...wait(2)], ['menustyle:traditional']),
    'r28-fumbling-decoration': recipe('r28-fumbling-decoration', 'Slip on ice while its terrain description is deferred.', [
        ['hero slips', /You (?:slip|flounder|trip|stumble|lose your balance)/],
    ], [...prepare(), keys('ml'), ...wish('ice'), keys('mh'),
        keys('#wizintrinsic\r 1'), choose('fumbling', ''), keys('\rml'), ...wait(3)], ['mention_decor']),
    'r28-interrupted-dressing': recipe('r28-interrupted-dressing', 'Have a nymph interrupt donning slow armor.', [
        ['donning interrupted', /stop putting on the plate mail/],
    ], [...prepare(), keys('T'), ...openNeighbors(), ...wish('uncursed plate mail'), identify(),
        ...create('8 hostile wood nymph'), choose('plate mail', 'W*'), ...wait(8)]),
    'r28-related-dragon-witness': recipe('r28-related-dragon-witness', 'Attack a peaceful dragon while its related juvenile or adult is present.', [
        ['attack resolves', /(?:hit|miss|kill) the (?:baby )?red dragon/],
        ['related dragons present', /red dragon appears/],
    ], [...prepare(), ...intrinsic('fire resistance'), ...openNeighbors(),
        ...create('peaceful baby red dragon'), ...create('peaceful red dragon'),
        ...[...'hykulnjb'].flatMap(direction => [keys(`F${direction}`), answer('Really attack', 'y'), answer('Die?', 'n')])]),
};
const bones = recipe('r28-ghostly-bow-restore', 'Die by sliming in a gas region, then recover a bow left on the ancestral floor.', [
    ['hero becomes slime', /become (?:a )?green slime|turn into a green slime|revenant persists as a green slime/],
    ['bones saved', /Save bones\?/], ['ancestral level loaded', /Get bones\?/],
    ['ancestral bow adjusted after pickup', /make adjustments to the bow(?: named ancestral)? to suit your (?:right|left) hand/],
], [], ['disclose:-i -a -v -g -c -o']);
bones.build = ({ seed, datetime, rc }) => [
    { seed, datetime, nethackrc: rc(), driver: [...prepare(), ...intrinsic('poison resistance'),
            choose('oracle:', 'm\x16'), ...clearMonsters(), ...wish('fountain', 'floor', 'uncursed bow named ancestral', 'blessed scroll of stinking cloud'), identify(),
            choose('named ancestral', 'd*'), ...create('peaceful sleeping green dragon'),
            keys('#wizintrinsic\r3'), choose('becoming slime', ''), keys('\r'),
            choose('stinking cloud', 'r*'), answer('Where do you want to center', '.'),
            answer('(For instructions type', '.'), keys('3.'), answer('Die?', 'y'), answer('Save bones?', 'y'),
            { type: 'keys', value: '', dismissMore: true, expectExit: true }] },
    { seed, datetime, nethackrc: rc(), driver: [...prepare(), ...intrinsic('poison resistance'),
            ...wish('blessed potion of object detection'), identify(), choose('oracle:', 'm\x16'),
            answer('Get bones?', 'y'), answer('Unlink bones?', 'y'), ...clearMonsters(),
            choose('potion of object detection', 'q*'), keys('#wizmap\r\x14'),
            // The handless slime form drops the staff on top of the bow.
            // Getpos describes only the top object of that ancestral pile.
            answer('Where do you want to be teleported?', '!'), choose('quarterstaff', 'o'), keys('.,'),
            answer('Pick up what?', '.\r'), keys('\x1b:\x1b')] },
];
ROUND28_RECIPES['r28-ghostly-bow-restore'] = bones;
const fallbackCharacter = recipe('r28-character-fallbacks', 'Start a random character when every race, gender and alignment is filtered out.', [
    ['character starts despite exhausted filters', /welcome to NetHack/i],
    ['playable character status displayed', /HP:\d+\(\d+\)/],
], []);
fallbackCharacter.roles = null;
fallbackCharacter.build = ({ seed, datetime, rc }) => [{ seed, datetime,
        nethackrc: rc(['role:random', 'race:random', 'gender:random', 'align:random',
            'race:!human', 'race:!elf', 'race:!dwarf', 'race:!gnome', 'race:!orc',
            'gender:!male', 'gender:!female', 'align:!lawful', 'align:!neutral', 'align:!chaotic']),
        driver: [answer('Shall I pick', 'y'), answer('Is this ok?', 'y'), keys(':')],
    }];
ROUND28_RECIPES['r28-character-fallbacks'] = fallbackCharacter;
function recipe(name, description, evidence, actions, options = []) {
    effects[name] = evidence;
    return { roles: ['wizard'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger', ...options],
        description, success: evidence.map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(),
                driver: [...actions, keys('\x1b:\x1b')] }],
    };
}
export function validateRound28Recipe(name, session) {
    const evidence = effects[name];
    if (!evidence)
        throw new Error(`Unknown round-28 recipe ${name}`);
    const text = session.segments.flatMap(segment => segment.steps ?? []).map(step => step.screen.replace(/\x1b\[(\d+)C/g, (_match, count) => ' '.repeat(Number(count)))
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, '')).join('\n');
    return [
        { check: 'recorded live game', ok: session.version === 5 && session.segments.length === (name.endsWith('-restore') ? 2 : 1)
                && session.segments.every(segment => (segment.steps?.length ?? 0) >= 2), evidence: '' },
        ...evidence.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}
function prepare() {
    return [keys('#levelchange\r'), answer('To what experience level', '20\r'),
        ...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r'),
        ...intrinsic('pass thru walls'), keys('ml'), ...wish('fountain', 'floor')];
}
function boulderRing() {
    return [...'hykulnjb'].flatMap(direction => [keys(`m${direction}`),
        ...wish('fountain', 'floor', 'boulder'), keys(`m${opposite(direction)}`)]);
}
function openNeighbors() {
    return [...'hykulnjb'].flatMap(direction => [keys(`m${direction}`),
        ...wish('fountain', 'floor'), keys(`m${opposite(direction)}`)]);
}
function clearMonsters() {
    return [...wish('blessed scroll of genocide'), identify(),
        choose('of genocide', 'r*'), answer('What class of monsters', '*\r')];
}
function corridor() {
    return [keys('mh'.repeat(80)), ...wish('fountain', 'floor'),
        ...Array.from({ length: 12 }, () => [keys('ml'), ...wish('fountain', 'floor')]).flat()];
}
function castleApproach() {
    return [...intrinsic('water walking'), choose('castle:', 'm\x16'), ...clearMonsters(),
        keys('mh'.repeat(80) + 'mk'.repeat(21) + 'ml'.repeat(10) + 'mj'.repeat(9))];
}
function playTune() {
    return [choose('wooden flute', 'a*'), answer('Improvise?', 'n'),
        answer('What tune are you playing?', 'AAAAA\r')];
}
function opposite(direction) {
    switch (direction) {
        case 'h': return 'l';
        case 'y': return 'n';
        case 'k': return 'j';
        case 'u': return 'b';
        case 'l': return 'h';
        case 'n': return 'y';
        case 'j': return 'k';
        case 'b': return 'u';
        default: throw new Error(`Unknown movement direction ${direction}`);
    }
}
function intrinsic(property) {
    // Paging clears an uncommitted count in the native tty menu.
    const page = property === 'invulnerable' || property === 'monster detection' ? '' : ' ';
    return [keys(`#wizintrinsic\r${page}5000`), choose(property, ''), keys('\r')];
}
function create(monster) { return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')]; }
function wish(...items) { return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]); }
function wait(turns) {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Die?', 'n'), answer('Call a ', '\r')]).flat();
}
function identify() { return keys('\t\t\r'); }
function choose(target, openKeys) { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt, value) { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value) { return { type: 'keys', value, dismissMore: true }; }
//# sourceMappingURL=round28-recipes.mjs.map