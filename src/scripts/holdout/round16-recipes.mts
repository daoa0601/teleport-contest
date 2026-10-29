import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

type Effect = readonly [string, RegExp];
const EFFECTS: Record<string, readonly Effect[]> = {
    'earthquake-drumming': [['earthquake occurs', /entire dungeon is shaking/], ['chasm opens', /(?:fall|falls|opens up).*chasm|a trap \(pit\)/]],
    'snake-serenade': [['snake becomes peaceful', /snake.*sways with the music|notice a snake, swaying/]],
    'nymph-serenade': [['nymph becomes peaceful', /nymph listens cheerfully.*seems quieter/]],
    'soldier-reveille': [['soldier wakes', /soldier is now ready for battle/]],
    'harp-taming': [['monster pacified', /little dog seems more amiable/]],
    'elemental-horns': [['fire horn releases fire', /(?:bolt of fire|fireball) blasts out of the horn/], ['frost horn releases cold', /(?:bolt of cold|frost) blasts out of the horn/]],
    'bag-release': [['bag charge used', /bag of tricks \(0:[0-7]\)/], ['monster released', /(?:appears|suddenly appears) next to you/]],
    'petrification-countdown': [['petrification progresses', /You are slowing down/], ['petrification completes', /You are a statue/], ['hero survives', /OK, so you don.t die/]],
    'slime-countdown': [['sliming progresses', /Your limbs are getting oozy/], ['sliming completes', /You have become a green slime/], ['hero survives', /OK, so you don.t die/]],
    'sleepiness-countdown': [['sleep approaches', /You yawn/], ['hero sleeps', /You fall asleep/]],
    'breathing-countdown': [['breathing protection fades', /The air here seems foul|You seem to have some trouble breathing/]],
    'weapon-enchantment': [['weapon enchanted', /dagger.*glows? blue/]],
    'scare-scroll-reading': [['monsters frightened', /maniacal laughter close by/], ['scroll crumbles on pickup', /scroll.*turns to dust/]],
    'confused-level-scroll': [['hero changes level', /materialize on a different level|Dlvl:2/]],
    'mail-reading': [['junk mail read', /chain letter threatening your luck|junk mail addressed to the finder/]],
    'towel-wetting-drying': [['towel wetted', /towel gets wet/], ['towel dries', /towel(?: \(\d+\))? dries/]],
    'blocked-boulder': [['boulder blocked', /(?:try to move|in vain|cannot push|can.t move|won.t move|does not move).*boulder|boulder.*(?:in vain|won.t move|cannot move)/]],
    'sink-landing': [['hero crashes onto sink', /crash to the floor/]],
    'stone-flesh-statue': [['statue becomes creature', /statue.*(?:comes to life|turns into)|lizard comes to life/]],
    'magicbane-strikes': [['Magicbane special hit', /magic-absorbing blade/]],
    'sting-orcs': [['Sting warns of orcs', /Sting.*(?:glimmers|gleams|flickers).*blue/]],
    'quest-leader-chat': [['leader speaks', /Neferet the Green/], ['leader refuses unready hero', /(?:rank of|too inexperienced|magician|not yet ready|not yet a)/i]],
    'quest-artifact-return': [['leader accepts artifact', /I knew you could defeat|We shall never forget this/]],
    'nemesis-conversation': [['nemesis answers', /puny powers|torment will last|I shall devour|beg for mercy|enslaved multitude|lack of will|faith in .*for naught|compared to my skill|How droll|My victory is imminent/]],
    'quest-purity-refusal': [['unworthy hero expelled', /You must go back and show your worthiness/]],
    'astral-guardian': [['guardian granted', /Thou hast been worthy of me/], ['guardian rebukes conflict', /Since you desire conflict, have some more/]],
    'terrain-chewing': [['terrain chewed', /You (?:eat the boulder|chew a hole in the (?:wall|rock))/]],
    'kicked-greedy-gold': [['kicked gold hits leprechaun', /gold pieces? harmlessly hits? the leprechaun|leprechaun.*catches the gold/]],
    'gecko-conversation': [['hallucinatory gecko pitch', /15 minutes could save you/]],
    'angry-lawful-minions': [['god sends a minion', /Then die, mortal/]],
    'demon-reinforcements': [['demon summons help', /appears in a (?:cloud|burst|flash) of/]],
    'astral-conflict': [['god sends hostile angels', /Thy desire for conflict shall be fulfilled/]],
    'astral-furies': [['alignment change summons furies', /erinys|erinyes/]],
    'acid-weapon-corrosion': [['acid corrodes a weapon', /(?:sword|spear|dagger|mace|pike|axe|knife|morning star).*corrodes/]],
    'lava-sinking': [['hero sinks into lava', /sink deeper into the lava/], ['sinking resolves', /sink below the surface and die/]],
    'adjacent-water-pit': [['water floods pit', /(?:water|Suddenly).*flows (?:in|into)|pit fills with water/]],
    'egg-unturning': [['undead turning hits hero', /You shudder in dread/], ['egg hatches', /hatches|egg.*hatch|drop out of your pack/]],
    'steed-probing': [['wand probes mounted pony', /pony.*HP|pony.*level|Status of.*pony/i]],
    'silver-shade-strikes': [['silver hurts shade', /silver (?:saber|sabre).*sears|shade.*(?:seared|sears)|destroy the shade/]],
    'skill-menu-practice': [['skills shown', /Current skills/], ['skill advanced', /more skilled in dagger/]],
};

export const ROUND16_RECIPES: Record<string, Recipe> = {
    'earthquake-drumming': recipe('earthquake-drumming', 'Drum until an earthquake opens a chasm in the surrounding room.', [
        ...wish('uncursed drum of earthquake (0:8)'), identify(),
        ...Array.from({ length: 3 }, () => choose('drum of earthquake', 'a*')), keys(';^.\x1b'),
    ]),
    'snake-serenade': recipe('snake-serenade', 'Charm a nearby hostile snake with a wooden flute.', [
        ...wish('uncursed wooden flute'), identify(), ...create('hostile sleeping snake'), ...play('wooden flute'),
    ]),
    'nymph-serenade': recipe('nymph-serenade', 'Calm a nearby hostile nymph with a wooden harp.', [
        ...wish('uncursed wooden harp'), identify(), ...create('hostile sleeping wood nymph'), ...play('wooden harp'),
    ]),
    'soldier-reveille': recipe('soldier-reveille', 'Wake a sleeping soldier with a bugle.', [
        ...wish('uncursed bugle'), identify(), ...create('hostile sleeping soldier'), ...play('bugle'),
    ]),
    'harp-taming': recipe('harp-taming', 'Pacify and tame a hostile dog with a magic harp.', [
        ...wish('uncursed magic harp (0:8)'), identify(), ...create('hostile sleeping little dog'), ...play('magic harp'),
    ]),
    'elemental-horns': recipe('elemental-horns', 'Blow charged fire and frost horns at the floor.', [
        ...wish('uncursed fire horn (0:8)', 'uncursed frost horn (0:8)'), identify(),
        ...play('fire horn'), answer('In what direction?', '>'), ...wait(30),
        ...play('frost horn'), answer('In what direction?', '>'),
    ]),
    'bag-release': recipe('bag-release', 'Release a monster from a charged bag of tricks and inspect its remaining charges.', [
        ...wish('uncursed bag of tricks (0:8)'), identify(), choose('bag of tricks', 'a*'), keys('i \x1b'),
    ]),
    'petrification-countdown': recipe('petrification-countdown', 'Let petrification run to completion, then decline death in wizard mode.', [
        ...intrinsic('petrifying', 5), ...waitWithLifeSaving(8),
    ]),
    'slime-countdown': recipe('slime-countdown', 'Turn into green slime and decline death in wizard mode.', [
        ...intrinsic('becoming slime', 10), ...waitWithLifeSaving(12),
    ]),
    'sleepiness-countdown': recipe('sleepiness-countdown', 'Let timed sleepiness expire and fall asleep.', [
        ...wish('uncursed amulet of restful sleep'), identify(), choose('restful sleep', 'P*'),
        ...intrinsic('sleepy', 5), ...wait(160),
    ]),
    'breathing-countdown': recipe('breathing-countdown', 'Let temporary magical breathing fade inside a stinking cloud.', [
        ...wish('uncursed scroll of stinking cloud'), identify(), ...intrinsic('magical breathing', 10),
        choose('stinking cloud', 'r*'), answer('Where do you want to center', '.'), answer('(For instructions type', '.'), ...wait(9),
    ]),
    'weapon-enchantment': recipe('weapon-enchantment', 'Enchant a wielded dagger with an uncursed scroll.', [
        ...wish('uncursed +0 dagger', 'uncursed scroll of enchant weapon'), identify(),
        choose('+0 dagger', 'w*'), choose('enchant weapon', 'r*'), keys('i\x1b'),
    ]),
    'scare-scroll-reading': recipe('scare-scroll-reading', 'Read a scare scroll beside a monster, then pick another up twice.', [
        ...wish('2 uncursed scrolls of scare monster'), identify(), ...create('hostile sleeping little dog'),
        choose('scare monster', 'r*'), choose('scare monster', 'd*'), keys(','), answer('Pick up what?', ',\r'),
        choose('scare monster', 'd*'), keys(','), answer('Pick up what?', ',\r'),
    ]),
    'confused-level-scroll': recipe('confused-level-scroll', 'Read teleportation while confused to teleport between dungeon levels.', [
        ...wish('uncursed scroll of teleportation'), identify(), ...intrinsic('confused', 10),
        choose('scroll of teleportation', 'r*'), answer('To what level', '2\r'),
    ]),
    'mail-reading': recipe('mail-reading', 'Read a wished scroll of mail.', [
        ...wish('uncursed scroll of mail'), identify(), choose('scroll of mail', 'r*'),
    ]),
    'towel-wetting-drying': recipe('towel-wetting-drying', 'Wet a towel with water and dry it with a fire wand.', [
        ...wish('uncursed towel', 'uncursed potion of water'), identify(),
        choose('towel', '#dip\r*'), choose('potion of water', '*'),
        ...intrinsic('fire resistance', 100), ...wish('uncursed wand of fire (0:8)'), identify(),
        ...Array.from({ length: 8 }, () => [choose('wand of fire', 'z*'), answer('In what direction?', '.')]).flat(),
    ]),
    'blocked-boulder': recipe('blocked-boulder', 'Push a boulder against a wall.', [
        ...wish('blessed scroll of genocide'), identify(), choose('scroll of genocide', 'r*'), answer('What class of monsters', '*\r'),
        ...intrinsic('pass thru walls', 3), ...wish('wall'), keys('ml'),
        ...wish('fountain', 'floor', 'boulder'), keys('ml'), ...wish('fountain', 'floor'), keys('m.h'),
    ]),
    'sink-landing': recipe('sink-landing', 'Levitate over a sink and crash onto it.', [
        ...intrinsic('pass thru walls', 100), ...wish('uncursed potion of levitation'), identify(),
        choose('potion of levitation', 'q*'), ...wish('sink'), keys('ml'), ...wish('fountain', 'floor'), keys('mh'),
    ]),
    'stone-flesh-statue': recipe('stone-flesh-statue', 'Turn a dropped lizard statue into a living lizard.', [
        ...wish('uncursed empty statue of a lizard'), identify(), choose('statue of a lizard', 'd*'),
        choose('stone to flesh', '#wizcast\r'), answer('In what direction?', '>'), keys(';m.\x1b'),
    ]),
    'magicbane-strikes': recipe('magicbane-strikes', 'Strike hostile monsters with Magicbane until its magic affects one.', [
        ...protectedHero(), ...wish('blessed +0 Magicbane'), identify(), choose('Magicbane', 'w*'), ...create('8 hostile ogre'),
        ...fight(32),
    ]),
    'sting-orcs': recipe('sting-orcs', 'Wield Sting near hostile orcs and attack them.', [
        ...protectedHero(), ...wish('blessed Sting'), identify(), choose('Sting', 'w*'), ...create('8 hostile hill orc'), ...fight(16),
    ]),
    'quest-leader-chat': recipe('quest-leader-chat', 'Speak to the quest leader on the native quest start level.', [
        ...questLeader(), keys('#levelchange\r'), answer('To what experience level', '1\r'), ...chat(),
    ]),
    'quest-artifact-return': recipe('quest-artifact-return', 'Bring the quest artifact to the native leader.', [
        ...wish('blessed Eye of the Aethiopica'), identify(),
        ...questLeader(), ...chat(),
    ]),
    'nemesis-conversation': recipe('nemesis-conversation', 'Chat with the role nemesis.', [
        ...protectedHero(), ...create('peaceful Dark One'), answer('Creating doppelganger instead', 'y'), ...chat(),
    ]),
    'angry-lawful-minions': recipe('angry-lawful-minions', 'Provoke a lawful god until a hostile minion is sent.', [
        ...protectedHero(), ...wish('uncursed amulet of reflection'), identify(), choose('amulet of reflection', 'P*'),
        ...Array.from({ length: 24 }, () => [keys('#pray\r'), answer('Are you sure you want to pray?', 'y'), answer('Force the gods to be pleased?', 'n'), ...waitWithLifeSaving(4)]).flat(),
    ], ['knight']),
    'demon-reinforcements': recipe('demon-reinforcements', 'Let hostile bone devils summon skeletons.', [
        ...protectedHero(), ...create('4 hostile bone devil'), ...waitWithLifeSaving(80),
    ]),
    'astral-conflict': recipe('astral-conflict', 'Enter the Astral Plane while causing conflict.', [
        ...protectedHero(), ...wish('uncursed ring of conflict'), identify(), choose('ring of conflict', 'P*'), answer('Which ring-finger', 'l'),
        choose('astral', 'm\x16'), answer('For what do you wish?', 'nothing\r'),
    ]),
    'astral-furies': recipe('astral-furies', 'Change alignment on the Astral Plane and face the furies.', [
        ...protectedHero(), ...wish('uncursed helm of opposite alignment'), identify(),
        choose('astral', 'm\x16'), answer('For what do you wish?', 'nothing\r'),
        choose('helm of opposite alignment', 'W*'), ...waitWithLifeSaving(5), keys(';m.\x1b'),
    ]),
    'acid-weapon-corrosion': recipe('acid-weapon-corrosion', 'Defend as a spotted jelly until a soldier weapon corrodes.', [
        ...create('8 hostile soldier'),
        ...Array.from({ length: 8 }, () => [keys('#polyself\r'), answer('Become what kind of monster?', 'spotted jelly\r'), ...waitWithLifeSaving(4)]).flat(),
    ]),
    'lava-sinking': recipe('lava-sinking', 'Step into lava while fire resistant and sink until wizard life saving.', [
        ...wish('fountain', 'floor'), ...intrinsic('fire resistance', 100),
        ...intrinsic('pass thru walls', 30), keys('ml'), ...wish('lava'), keys('mhml'),
        answer('Really', 'y'), ...waitWithLifeSaving(15),
    ]),
    'adjacent-water-pit': recipe('adjacent-water-pit', 'Dig sideways from a pit into an adjacent pool.', [
        ...wish('blessed scroll of genocide'), identify(), choose('scroll of genocide', 'r*'), answer('What class of monsters', '*\r'),
        ...wish('uncursed wand of digging (0:8)'), identify(), ...intrinsic('pass thru walls', 100),
        keys('ml'), ...wish('fountain', 'floor'), keys('ml'), ...wish('pool'), keys('mh'), ...wish('pit'), keys('mhml'),
        answer('Really', 'y'), choose('wand of digging', 'z*'), answer('In what direction?', 'l'),
        answer('Die?', 'n'),
    ]),
    'egg-unturning': recipe('egg-unturning', 'Revive a carried egg with undead turning and wait for it to hatch.', [
        ...protectedHero(), ...wish('uncursed cockatrice egg', 'uncursed wand of undead turning (0:8)'), identify(),
        choose('wand of undead turning', 'z*'), answer('In what direction?', '.'), ...wait(220),
    ]),
    'steed-probing': recipe('steed-probing', 'Mount a saddled pony and probe it by zapping down.', [
        ...wish('uncursed wand of probing (0:127)'), identify(),
        ...[...'hykulnjb'.repeat(8)].flatMap(direction => [keys('#ride\r'), answer('In what direction?', direction),
            answer('Force the mount to succeed?', 'y'), choose('wand of probing', 'z*'), answer('In what direction?', '>')]),
    ], ['knight']),
    'silver-shade-strikes': recipe('silver-shade-strikes', 'Fight a shade with a silver saber.', [
        ...protectedHero(), ...wish('uncursed +7 silver saber'), identify(), choose('silver saber', 'w*'), ...create('hostile shade'), ...fight(32),
    ]),
    'skill-menu-practice': recipe('skill-menu-practice', 'View skills and advance dagger in wizard mode.', [
        keys('#enhance\r'), answer('Advance skills without practice?', 'n'), keys('\x1b'),
        keys('#enhance\r'), answer('Advance skills without practice?', 'y'), choose('dagger', ''), keys('\x1b'),
    ]),
    'quest-purity-refusal': recipe('quest-purity-refusal', 'Let the quest leader reject an experienced hero with inadequate alignment.', [
        ...questLeader(), ...chat(),
    ]),
    'astral-guardian': recipe('astral-guardian', 'Receive a guardian angel and then lose it by wearing conflict.', [
        ...protectedHero(), ...wish('uncursed ring of conflict'), identify(), choose('astral', 'm\x16'),
        answer('For what do you wish?', 'nothing\r'), choose('ring of conflict', 'P*'), answer('Which ring-finger', 'l'), ...waitWithLifeSaving(5),
    ], ['knight']),
    'terrain-chewing': recipe('terrain-chewing', 'Chew a boulder as an umber hulk.', [
        ...intrinsic('pass thru walls', 2), ...wish('wall'), keys('ml'),
        ...wish('fountain', 'floor', 'boulder'), keys('mh'),
        keys('#polyself\r'), answer('Become what kind of monster?', 'umber hulk\r'), keys('l'.repeat(8)),
    ]),
    'kicked-greedy-gold': recipe('kicked-greedy-gold', 'Kick gold into a leprechaun who is asleep beyond the pile.', [
        ...wish('uncursed figurine of a leprechaun', 'uncursed wand of sleep (0:8)'), identify(), ...intrinsic('sleep resistance', 100),
        ...intrinsic('pass thru walls', 100), keys('ml'), ...wish('fountain', 'floor'),
        keys('ml'), ...wish('fountain', 'floor'), keys('mh'),
        choose('figurine of a leprechaun', 'a*'), answer('In what direction?', 'l'),
        choose('wand of sleep', 'z*'), answer('In what direction?', 'l'),
        choose('light', '#wizcast\r'), ...wish('1 gold piece'), keys('d$h'), keys('\x04'), answer('In what direction?', 'l'),
    ]),
    'gecko-conversation': recipe('gecko-conversation', 'Chat with a gecko while hallucinating.', [
        ...create('peaceful gecko'), ...intrinsic('hallucinating', 100), ...chat(),
    ]),
};

export function validateRound16Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-16 recipe ${name}`);
    const screens = session.segments.flatMap(segment => (segment.steps ?? []).map(step => step.screen.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')));
    const text = screens.join('\n');
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        ...effects.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
}

function recipe(name: string, description: string, actions: SessionAction[], roles = ['wizard']): Recipe {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-16 recipe ${name}`);
    return {
        roles,
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', ['steed-probing', 'astral-guardian'].includes(name) ? 'pettype:horse' : 'pettype:none', 'debug_hunger'],
        description,
        success: effects.map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r'), answer('To what experience level', '30\r'), ...actions, keys('\x1b:\x1b'),
        ] }],
    };
}
function protectedHero(): SessionAction[] {
    return [...wish('blessed +50 gray dragon scale mail'), identify(), keys('T'), ...wait(5),
        choose('gray dragon scale mail', 'W*'), ...wait(5)];
}
function questLeader(): SessionAction[] {
    return [...protectedHero(), choose('Wiz-strt', 'm\x16'), keys('#wizmap\r\x14'),
        answer('Where do you want to be teleported?', '\\h.'), answer('(For instructions type', '\\h.')];
}
function wish(...items: string[]): SessionAction[] {
    return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]);
}
function create(monster: string): SessionAction[] {
    return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`)];
}
function intrinsic(property: string, turns: number): SessionAction[] {
    const laterPage = ['pass thru walls', 'magical breathing', 'fire resistance', 'light-induced blindness resistance', 'sleep resistance'].includes(property);
    return [keys(`#wizintrinsic\r${laterPage ? ' ' : ''}${turns}`), choose(property, ''), keys('\r')];
}
function play(instrument: string): SessionAction[] {
    return [choose(instrument, 'a*'), answer('Improvise?', 'y')];
}
function wait(turns: number): SessionAction[] {
    return Array.from({ length: turns }, () => keys('m.'));
}
function waitWithLifeSaving(turns: number): SessionAction[] {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Die?', 'n'), answer('Call ', '\r'), answer('How much will you offer?', '0\r')]).flat();
}
function fight(turns: number): SessionAction[] {
    return [...'hykulnjb'.repeat(Math.ceil(turns / 8))].flatMap(direction => [keys(`F${direction}`), answer('Really attack', 'y'), answer('Call ', '\r'), answer('Die?', 'n')]);
}
function chat(): SessionAction[] {
    return [...'hykulnjb'.repeat(2)].flatMap(direction => [keys('#chat\r'), answer('Talk to whom?', direction)]);
}
function identify(): SessionAction { return keys('\t\t\r'); }
function choose(target: string, openKeys: string): SessionAction {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}
function answer(prompt: string, value: string): SessionAction {
    return { type: 'answer-prompt', prompt, value, dismissMore: true };
}
function keys(value: string): SessionAction { return { type: 'keys', value, dismissMore: true }; }
