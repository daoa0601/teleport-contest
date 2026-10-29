import type { SessionAction } from '../lib/session-types.mjs';
import type { Character, Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

function keys(value: string): SessionAction {
    return { type: 'keys', value, dismissMore: true };
}

function wait(turns: number): SessionAction {
    // Escape also declines wizard-mode death confirmation if a hit is fatal.
    return keys('m.\x1b'.repeat(turns));
}

function choose(target: string, openKeys: string): SessionAction {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}

function wish(...items: string[]): SessionAction[] {
    return [keys(items.map(item => `\x17${item}\r`).join('') + '\t\t\r')];
}

function create(monster: string): SessionAction {
    return keys(`\x07${monster}\r`);
}

function chat(answers = ''): SessionAction[] {
    return [...'hykulnjb'].map(direction => keys(`#chat\r${direction}${answers}\x1b`));
}

function recipe(description: string, success: string[],
    actions: SessionAction[] | ((character: Character) => SessionAction[])): Recipe {
    return {
        roles: ['knight', 'wizard', 'rogue'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none'],
        description, success,
        build: ({ seed, datetime, rc, character }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r20\r'), ...(typeof actions === 'function' ? actions(character) : actions), keys('\x1b:\x1b'),
        ] }],
    };
}

export const ROUND10_RECIPES: Record<string, Recipe> = {
    // steal.c:stealgold(), somegold().
    'leprechaun-purse': recipe('Let an awake leprechaun steal carried gold.',
        ['The hero loses gold to theft.'], [
            ...wish('1000 gold pieces', 'uncursed tin whistle'), create('hostile leprechaun'),
            choose('tin whistle', 'a*'), wait(20),
        ]),
    // steal.c:stealgold(), including gold under the hero's feet.
    'leprechaun-floor-gold': recipe('Leave gold on the floor for an awake leprechaun.',
        ['The leprechaun takes gold from the floor.'], [
            ...wish('1500 gold pieces', 'uncursed tin whistle'), keys('d1000$'), create('hostile leprechaun'),
            choose('tin whistle', 'a*'), wait(30),
        ]),
    // steal.c:steal(), including the animal thief branch.
    'monkey-theft': recipe('Let a monkey try to steal carried equipment.',
        ['The monkey attempts theft.'], [create('hostile monkey'), wait(20)]),
    // mhitu.c:doseduce(), mayberem(). Remove body armor first so refusing
    // the optional helmet/glove removal cannot stop the encounter.
    'demon-seduction': recipe('Accept a succubus invitation and resolve its aftermath.',
        ['The seducer approaches the hero.', 'Seduction reaches its aftermath.'], character => [
            ...(character.role === 'knight' ? [choose('ring mail', 'T*')] : [keys('T')]), wait(5),
            create('peaceful succubus'), ...chat('\x1b'.repeat(10)),
        ]),
    // mhitu.c:u_slow_down().
    'shade-slowing': recipe('Gain intrinsic speed, then endure a shade touch.',
        ['The shade removes intrinsic speed.'], [
            ...wish('uncursed potion of speed'), choose('potion of speed', 'q*'),
            create('hostile shade'), wait(20),
        ]),
    // mhitu.c:diseasemu(). Scorpius has a disease sting without engulfing.
    'disease-sting': recipe('Endure Scorpius disease sting and cure the infection.',
        ['The sting causes illness.', 'A healing potion cures the illness.'], [
            ...wish('blessed potion of full healing'), create('hostile Scorpius'), keys('y'), wait(2),
            choose('potion of full healing', 'q*'),
        ]),
    // minion.c:demon_talk(), bribe().
    'demon-bribery': recipe('Offer a peaceful demon all carried gold for safe passage.',
        ['The demon accepts a bribe and vanishes.'], [
            ...wish('1000 gold pieces'), create('peaceful Geryon'), keys('y'),
            ...chat('\x151000\r'),
        ]),
    // priest.c:priest_talk(). A priest outside a temple refuses friendly chat.
    'displaced-priest': recipe('Chat with a peaceful priest outside a temple.',
        ['The priest answers angrily.'], [create('peaceful aligned priest'), keys('y'), ...chat()]),
    // priest.c:priest_talk(), minion.c:bribe().
    'temple-donation': recipe('Visit the Minetown altar and offer a temple contribution.',
        ['The priest requests a contribution.', 'The hero donates gold.', 'The priest rewards the hero with protection.'], [
            ...wish('30000 gold pieces'), choose('minetn', 'm\x16'), keys('\x06\x14_.'),
            ...chat('20000\r'),
        ]),
    // were.c:you_were(), you_unwere(). Canned meat avoids carrying a heavy corpse.
    'lycanthropy-cure': recipe('Catch lycanthropy from werewolf meat and purify it with holy water.',
        ['The hero catches lycanthropy.', 'Holy water purifies the hero.'], [
            ...wish('blessed tin of human werewolf meat', 'potion of unholy water', 'potion of holy water'),
            choose('tin of', 'me*'), keys('y'), choose('potion of unholy water', 'q*'), keys('y'),
            choose('potion of holy water', 'q*'), keys('n'),
        ]),
    // mon.c:rescham(), normal_shape(), restartcham(), m_restartcham().
    'shapechanger-protection': recipe('Suppress a chameleon with a ring, then remove the ring.',
        ['The ring is worn.', 'The ring is removed.'], [
            ...wish('uncursed ring of protection from shape changers'), create('peaceful chameleon'),
            choose('ring of protection from shape changers', 'P*'), keys('l'),
            keys('R'), wait(4),
        ]),
    // mon.c:golemeffects(). The jelly's passive cold slows its attacker.
    'golem-elements': recipe('Let a flesh golem strike the hero in blue jelly form.',
        ['The golem resists the passive cold.'], [
            keys('#polyself\rblue jelly\r'), create('hostile flesh golem'), wait(12),
        ]),
    // mon.c:mon_to_stone(). Flesh golems survive petrification by changing.
    'golem-petrification': recipe('Let a flesh golem touch the hero in cockatrice form.',
        ['The flesh golem becomes a stone golem.'], [
            keys('#polyself\rcockatrice\r'), create('hostile flesh golem'), wait(12),
        ]),
    // minion.c:msummon(), monster_census(). Bone devils summon skeletons.
    'demon-summoning': recipe('Endure a bone devil until it summons a skeleton.',
        ['The devil summons a skeleton.'], [create('hostile bone devil'), wait(50)]),
    // mon.c:m_respond_shrieker().
    'shrieker-response': recipe('Wake nearby shriekers with a whistle and let them respond.',
        ['The shrieker cries out.'], [
            ...wish('uncursed tin whistle'), create('5 hostile shrieker'), choose('tin whistle', 'a*'), wait(15),
        ]),
    // mon.c:meatobj(), meatbox().
    'cube-container-meal': recipe('Leave a filled sack for a gelatinous cube to engulf.',
        ['The cube consumes a floor object.'], [
            ...wish('uncursed empty sack', 'uncursed ruby'), choose('sack', 'a*'), keys('s'), choose('ruby', '*'),
            choose('sack', 'd*'), create('hostile gelatinous cube'), keys('hykulnjb'), wait(40),
        ]),
    // mon.c:meatcorpse().
    'worm-corpse-meal': recipe('Leave a fresh corpse for a voracious purple worm.',
        ['The worm eats the corpse.'], [
            ...wish('newt corpse'), choose('newt corpse', 'd*'), create('peaceful purple worm'),
            keys('hykulnjb'), wait(20),
        ]),
    // dog.c:tamedog(), dogmove.c:dog_eat().
    'food-taming': recipe('Throw tripe to a wild dog and let it eat.',
        ['The dog eats offered food.'], [
            ...wish('8 uncursed tripe rations'), create('hostile dog'),
            ...[...'hykulnjb'].flatMap(direction => [choose('tripe ration', 't*'), keys(direction)]), wait(4),
        ]),
    // dogmove.c:quickmimic().
    'pet-mimic-meal': recipe('Feed a small mimic corpse to a tame dog.',
        ['The dog eats the mimic corpse.', 'The pet adopts a disguise.'], [
            ...wish('small mimic corpse'), choose('small mimic corpse', 'd*'),
            create('tame dog'), keys('hykulnjb'), wait(20),
        ]),
    // wizard.c:cuss(), clonewiz(), nasty().
    'wizard-harassment': recipe('Confront the Wizard of Yendor and endure his spells.',
        ['The Wizard addresses or attacks the hero.'], [
            ...wish('blessed amulet of life saving'), choose('amulet of life saving', 'P*'),
            create('hostile Wizard of Yendor'), keys('y'), wait(20),
        ]),
};

const EFFECTS: Record<string, readonly [string, RegExp][]> = {
    'leprechaun-purse': [['gold stolen', /Your purse feels lighter\./]],
    'leprechaun-floor-gold': [['floor gold taken', /snatches some gold|picks up[^.\n]*gold pieces/]],
    'monkey-theft': [['theft attempted', /monkey (?:steals|tries to|gives up|snatches)/i]],
    'demon-seduction': [['invitation', /murmurs[^.\n]*ear/], ['aftermath', /enjoyed it more/]],
    'shade-slowing': [['intrinsic speed lost', /You slow down\.|Your quickness feels less natural\./]],
    'disease-sting': [['illness', /You feel (?:deathly )?sick\./], ['healing', /You feel completely healed\./]],
    'demon-bribery': [['bribe accepted', /vanishes, laughing about cowardly mortals\./]],
    'displaced-priest': [['angry reply', /Thou wouldst have words|Talk\?  Here is what|Pilgrim, I would speak no longer/]],
    'temple-donation': [['contribution requested', /contribution for the temple/], ['donation', /You give [^.\n]*(?:gold|zorkmids)/],
        ['protection rewarded', /Thou hast been rewarded for thy devotion\./]],
    'lycanthropy-cure': [['beast form', /You (?:turn into|change into|feel like) a werewolf/],
        ['purification', /You feel purified\.|Your affinity to werewolves disappears!/]],
    'shapechanger-protection': [['ring worn', /ring of protection from shape changers \(on (?:left|right) hand\)/],
        ['ring removed', /You were wearing [^.\n]*ring of protection from shape changers/]],
    'golem-elements': [['passive cold', /(?:flesh golem|It) is mildly chilly\./i]],
    'golem-petrification': [['stone form', /Now it's a stone golem\./]],
    'demon-summoning': [['skeleton summoned', /skeleton appears in a/i]],
    'shrieker-response': [['shriek', /shrieker shrieks\./i]],
    'cube-container-meal': [['cube feeding', /gelatinous cube (?:eats|engulfs|devours)/i]],
    'worm-corpse-meal': [['corpse eaten', /purple worm eats [^.\n]*newt corpse/i]],
    'food-taming': [['food eaten', /dog (?:devours|eats) [^.\n]*tripe/i]],
    'pet-mimic-meal': [['corpse eaten', /dog (?:devours|eats) [^.\n]*mimic corpse/i],
        ['mimicking', /You see (?:a|an|some) [^!\n]+ appear where your dog was!/]],
    'wizard-harassment': [['wizard interaction', /Wizard of Yendor (?:casts|hits|touches|points|curses)|["\u201c](?:Thou|I |So |Relinquish|Insignificant)/]],
};

export function validateRound10Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const effects = EFFECTS[name];
    if (!effects) throw new Error(`unknown round-10 recipe ${name}`);
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    return [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        { check: 'gameplay consumed turns', ok: (turns.at(-1) ?? 0) > (turns[0] ?? Infinity), evidence: '' },
        ...effects.map(([check, effect]) => ({ check, ok: effect.test(text), evidence: '' })),
    ];
}
