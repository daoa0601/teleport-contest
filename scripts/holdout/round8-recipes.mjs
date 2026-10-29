import { itemAt } from '../lib/session-types.mjs';
function keys(value) {
    return { type: 'keys', value, dismissMore: true };
}
function choose(target, openKeys) {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}
function wish(...items) {
    return [keys(items.map(item => `\x17${item}\r`).join('') + '\t\t\r')];
}
function pick(seed, choices) {
    return itemAt(choices, ((Math.imul(seed, 1664525) + 1013904223) >>> 0) % choices.length);
}
// Wishing plain floor is refused while standing on stairs; wishing a
// fountain first converts the square so the floor wish can clear it.
function clearFloor(...items) {
    return wish('fountain', 'floor', ...items);
}
function recipe(description, success, actions, roles = ['knight']) {
    return {
        roles, options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips'], description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r20\r'), ...actions(seed), keys('\x1b:\x1b'),
                ] }],
    };
}
export const ROUND8_RECIPES = {
    // fountain.c:dowatersnakes(), dowaterdemon(), dowaternymph(), dofindgem(),
    // dogushforth(). Each quaff draws fate=rnd(30); re-wishing the fountain
    // keeps it from drying up.
    'fountain-quaffing': recipe('Wish a fresh fountain and drink from it repeatedly.', ['Water is drawn from the fountain.', 'One rare fountain event occurs.'], seed => {
        const actions = [];
        for (let drink = 0; drink < 18; drink++) {
            actions.push(...wish('fountain'), keys('qy'));
        }
        return actions;
    }),
    // fountain.c:drinksink().
    'sink-guzzling': recipe('Wish a kitchen sink and take several sips from it.', ['A sip is taken from the sink.'], () => [
        ...wish('sink'), keys('qyqyqyqyqy'),
    ]),
    // fountain.c:dipsink(), sink_backs_up(); do.c:polymorph_sink().
    'sink-drain-dipping': recipe('Pour a potion of levitation and a potion of polymorph down a wished sink.', ['The sink backs up with muddy waste.', 'The sink transforms.'], () => [
        ...wish('sink', 'potion of levitation', 'potion of polymorph'),
        choose('potion of levitation', '#dip\r*'), keys('y'),
        choose('potion of polymorph', '#dip\r*'), keys('y'),
    ]),
    // do.c:dosinkring(), teleport_sink().
    'ring-drains': recipe('Drop rings down a wished sink drain.', ['A teleportation ring drains the sink away.', 'A slow digestion ring is regurgitated.'], () => [
        ...wish('sink', 'ring of teleportation', 'ring of slow digestion'),
        choose('ring of teleportation', 'd*'),
        ...wish('sink'), choose('ring of slow digestion', 'd*'),
    ]),
    // dokick.c:kick_monster(), kickdmg(), maybe_kick_monster().
    'monster-kicking': recipe('Create lichens and kick around at them.', ['A created monster is kicked.'], () => [
        keys('\x07lichen\r\x07lichen\r'),
        ...'hykulnjb'.split('').map(direction => keys(`\x04${direction}`)),
    ]),
    // spell.c:cursed_book(). A level 1 book always draws case 0.
    'cursed-study': recipe('Read a cursed level 1 spellbook and suffer its runes.', ['The cursed book misfires.'], () => [
        ...wish('cursed spellbook of magic missile'), choose('spellbook of magic missile', 'r*'),
    ]),
    // spell.c:confused_book(). A blessed book skips the too-hard roll.
    'confused-study': recipe('Quaff confusion, then study a blessed spellbook.', ['Confused study produces its special outcome.'], () => [
        ...wish('potion of confusion', 'blessed spellbook of magic missile'),
        choose('potion of confusion', 'q*'),
        choose('spellbook of magic missile', 'r*'),
    ]),
    // read.c:seffect_amnesia(), forget(); spell.c:losespells().
    'amnesiac-wizardry': recipe('Learn two spells, then read a scroll of amnesia.', ['The amnesia scroll wipes memories.', 'A learned spell is affected.'], () => [
        ...wish('blessed spellbook of magic missile', 'blessed spellbook of dig', 'scroll of amnesia'),
        choose('spellbook of magic missile', 'r*'), keys('..........'),
        choose('spellbook of dig', 'r*'), keys('..........'),
        choose('scroll of amnesia', 'r*'),
    ], ['wizard']),
    // spell.c:cast_chain_lightning(), propagate_chain_lightning().
    'chain-lightning': recipe('Learn chain lightning, list spells, then cast it amid lichens.', ['The spell is learned.', 'The chain lightning is cast.'], () => [
        ...wish('blessed spellbook of chain lightning'),
        choose('spellbook of chain lightning', 'r*'), keys('..............'),
        keys('+\x1b'),
        keys('\x07lichen\r\x07lichen\r'),
        choose('chain lightning', 'Z*'),
    ], ['wizard']),
    // potion.c:peffect_acid(), peffect_hallucination(), peffect_invisibility(),
    // peffect_paralysis(), peffect_sleeping(), peffect_levitation().
    'draught-effects': recipe('Quaff six unexecuted potion effects in sequence.', ['Each potion takes effect.'], () => [
        ...wish('potion of hallucination', 'potion of acid', 'potion of invisibility', 'potion of sleeping', 'potion of paralysis', 'potion of levitation'),
        choose('potion of hallucination', 'q*'),
        choose('potion of acid', 'q*'),
        choose('potion of invisibility', 'q*'),
        choose('potion of sleeping', 'q*'), keys('..........'),
        choose('potion of paralysis', 'q*'), keys('..........'),
        choose('potion of levitation', 'q*'),
    ]),
    // trap.c:trapeffect_poly_trap(); potion.c:peffect_polymorph().
    'polymorph-trap': recipe('Jump in place onto a wished polymorph trap, then quaff a potion of polymorph.', ['The polymorph trap changes the hero.'], () => [
        ...clearFloor('uncursed jumping boots', 'polymorph trap', 'potion of polymorph'),
        choose('jumping boots', 'W*'), keys('#jump\r.'),
        choose('potion of polymorph', 'q*'),
    ]),
    // trap.c:trapeffect_fire_trap(), dofiretrap().
    'fire-trap': recipe('Jump in place onto a wished fire trap.', ['The fire trap erupts.'], () => [
        ...clearFloor('uncursed jumping boots', 'fire trap'),
        choose('jumping boots', 'W*'), keys('#jump\r.'),
    ]),
    // trap.c:trapeffect_rolling_boulder_trap().
    'boulder-trap': recipe('Jump in place onto a wished rolling boulder trap.', ['The rolling boulder trap is triggered.'], () => [
        ...clearFloor('uncursed jumping boots', 'rolling boulder trap'),
        choose('jumping boots', 'W*'), keys('#jump\r.'),
    ]),
    // trap.c:openholdingtrap(), closeholdingtrap(),
    // disarm_holdingtrap().
    'bear-trap': recipe('Jump into a wished bear trap, struggle, then open, close, and disarm it.', ['The bear trap catches the hero.', 'The bear trap is disarmed.'], () => [
        ...clearFloor('uncursed jumping boots', 'trapped beartrap'),
        choose('jumping boots', 'W*'), keys('#jump\r.'),
        ...wish('wand of opening', 'wand of locking'),
        choose('wand of opening', 'z*'), keys('.'),
        choose('wand of locking', 'z*'), keys('.'),
        keys('yubnyubnyubn'),
        ...'hykulnjbhykulnjb'.split('').map(direction => keys(`#untrap\r${direction}`)),
    ]),
    // pray.c:fix_worst_trouble(), fix_curse_trouble(). A black unicorn
    // corpse on a co-aligned altar raises the alignment record first.
    'troubled-prayer': recipe('Sacrifice a black unicorn, wear a cursed blindfold, and pray.', ['The sacrifice pleases the god.', 'The prayer fixes the hero\'s trouble.'], () => [
        ...wish('lawful altar', 'black unicorn corpse', 'cursed blindfold'),
        keys('#offer\ry'),
        choose('blindfold', 'a*'),
        keys('#pray\ryy '), keys('m.'.repeat(8)),
    ]),
    // pray.c:sacrifice_your_race(), offer_negative_valued(), offer_too_soon().
    'altar-offerings': recipe('Insult a chaotic altar with a black unicorn, sacrifice a human, then offer the Amulet.', ['The unicorn insults the altar.', 'The human sacrifice angers the altar.',
        'The Amulet is refused.'], () => [
        ...wish('chaotic altar'),
        keys('\x17Amulet of Yendor\r'), keys('gold piece\r\t\t\r'),
        keys('#offer\r'), choose('Amulet of Yendor', '*'),
        ...wish('black unicorn corpse'), keys('#offer\ry'),
        ...wish('human corpse'), keys('#offer\ry'),
    ], ['rogue']),
    // shk.c:rob_shop(), rile_shk(), call_kops(), makekops(), hot_pursuit().
    'shop-robbery': recipe('Visit Minetown shops, grab merchandise, and teleport out without paying.', ['Merchandise is stolen.', 'The shopkeeper or Kops respond.'], seed => {
        const actions = [...wish('blessed potion of object detection'),
            choose('minetn', 'm\x16'), choose('potion of object detection', 'mq*'), keys('\x1b')];
        for (let visit = 0; visit < 16; visit++) {
            const next = 'o'.repeat(visit + pick(seed, [1, 2]));
            actions.push(keys(`\x14${next}.`), keys(','));
            if (visit % 2 === 1)
                actions.push(keys('\x14.'));
        }
        return actions;
    }),
    // steed.c:use_saddle(), kick_steed(), exercise_steed();
    // uhitm.c jousting stayed unexecuted; the steed care functions did not.
    'steed-combat': recipe('Saddle a created pony, mount the starting steed, kick it, ride around, then joust a lichen.', ['The pony is saddled and mounted.', 'A riding attack lands.'], () => {
        const actions = [...wish('saddle'),
            keys('\x07tame sleeping pony\r\x07tame sleeping pony\r')];
        for (const direction of 'hykulnjb')
            actions.push(...wish('saddle'), choose('saddle', 'a*'), keys(direction));
        actions.push(choose('lance', 'w*'));
        actions.push(keys('\x07lichen\r\x07lichen\r\x07lichen\r\x07lichen\r'));
        const dirs = 'hykulnjbhykulnjb';
        for (let i = 0; i < dirs.length; i++) {
            actions.push(keys(`#ride\r${dirs[i]}y\x04F${dirs[(i + 1) % dirs.length]}`));
            if (i % 3 === 2)
                actions.push(keys('\x07lichen\r'));
        }
        return actions;
    }),
    // uhitm.c:hmonas(), gulpum(), damageum(), end_engulf().
    'worm-engulfing': recipe('Polymorph into a purple worm and engulf created monsters.', ['The worm form engulfs a monster.'], () => [
        keys('#polyself\rpurple worm\r'),
        keys('\x07ogre\r\x07ogre\r\x07ogre\r'),
        ...'hykulnjbhykulnjb'.split('').map(direction => keys(`F${direction}`)),
    ]),
    // uhitm.c:explum().
    'exploding-form': recipe('Polymorph into a yellow light and detonate against a lichen.', ['The light form explodes.'], () => [
        keys('#polyself\ryellow light\r'),
        keys('\x07lichen\r\x07lichen\r\x07lichen\r\x07lichen\r'),
        ...'hykulnjbhykul'.split('').map(direction => keys(`F${direction}`)),
    ]),
    // mhitu.c:cloneu().
    'pudding-splitting': recipe('Polymorph into a black pudding and let armed dwarves split you.', ['The pudding form divides.'], () => [
        keys('#polyself\rblack pudding\r'),
        keys('\x07dwarf\r\x07dwarf\r\x07dwarf\r\x07dwarf\r'),
        keys('m.'.repeat(48)),
    ], ['wizard']),
    // mhitu.c:explmu().
    'yellow-light-blast': recipe('Create a yellow light and let it detonate beside the hero.', ['The yellow light explodes near the hero.'], () => [
        keys('\x07yellow light\r\x07yellow light\r'), keys('m.'.repeat(40)),
    ]),
    // uhitm.c:hmon_hitmon_msg_silver().
    'silver-searing': recipe('Wield a silver dagger and stab werejackals.', ['Silver sears a lycanthrope.'], () => [
        ...wish('2 silver daggers'), choose('silver dagger', 'w*'),
        keys('\x07werejackal\r\x07werejackal\r\x07werejackal\r'),
        ...'hykulnjbhykulnjb'.split('').map(direction => keys(`F${direction}`)),
    ]),
    // mhitu.c:doseduce(), mayberem().
    'nymph-seduction': recipe('Create nymphs and wait for their seduction attacks.', ['A nymph seduces the hero.'], () => [
        keys('\x07nymph\r\x07nymph\r\x07nymph\r'), keys('m.'.repeat(40)),
    ]),
};
export function validateRound8Recipe(name, session) {
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const checks = [];
    const has = (check, effect) => checks.push({ check, ok: effect.test(text), evidence: '' });
    checks.push({ check: 'one recorded version-5 segment',
        ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' });
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    checks.push({ check: 'gameplay consumed turns', ok: (turns.at(-1) ?? 0) > (turns[0] ?? Infinity), evidence: '' });
    switch (name) {
        case 'fountain-quaffing':
            has('hero drank from the fountain', /Drink from the fountain\?/);
            has('a drink had a mundane outcome', /The cool draught refreshes you\.|This tepid water is tasteless\./);
            has('a rare fountain event occurred', /An endless stream of snakes pours forth!|You unleash |You attract |You spot a gem in the sparkling waters!|Water gushes forth from the overflowing fountain!|Your thirst is quenched\./);
            break;
        case 'sink-guzzling':
            has('hero sipped from the sink', /Drink from the sink\?/);
            has('a sip was taken', /You take a sip of /);
            break;
        case 'sink-drain-dipping':
            has('potion poured down the drain', /You pour .* down the drain\./);
            has('the sink backed up', /Flupp!  Muddy waste pops up from the drain\./);
            has('a ring appeared in the backup', /You see a ring shining in its midst\./);
            has('the sink transformed', /The sink transforms into |The sink vanishes\./);
            break;
        case 'ring-drains':
            has('a ring went down the drain', /You drop .*ring of teleportation down the drain\./);
            has('the teleporting ring removed the sink', /The sink vanishes\./);
            has('the slow digestion ring came back', /The ring is regurgitated!|got lost in the sink, but there it is!/);
            break;
        case 'monster-kicking':
            has('a monster was kicked', /You kick the (?:lichen|kobold)\.|Your clumsy kick does no damage\./);
            break;
        case 'cursed-study':
            has('cursed book effect hit', /You feel a wrenching sensation\./);
            break;
        case 'confused-study':
            has('confused study outcome', /(?:accidentally tear the spellbook to pieces|reading the (?:first|next) line over and over again)\./);
            break;
        case 'amnesiac-wizardry':
            has('a spell was learned', /You (?:learn|add) /);
            has('amnesia took hold', /(?:Who was that Maud person anyway\?|Thinking of Maud you forget everything else\.)/);
            break;
        case 'chain-lightning':
            has('study began', /You begin to memorize the runes\./);
            has('spell list shown', /Currently known spells|Spells:/);
            has('chain lightning discharged', /You shock |resists\.|You kill the lichen/);
            break;
        case 'draught-effects':
            has('hallucination took hold', /Oh wow!  Everything (?:looks|feels) so cosmic!|You perceive yourself\.\.\./);
            has('acid potion burned', /This tastes sour\.|This burns like acid!/);
            has('invisibility set in', /see right through yourself|Far out, man!  You can't see yourself/);
            has('paralysis or stiffening struck', /You (?:stiffen momentarily|are frozen in place!)|(?:feet are frozen to the|is frozen to the) /);
            has('sleep overcame the hero', /You (?:suddenly fall asleep!|yawn\.)/);
            has('levitation began', /start to float in the air|walking on air/);
            break;
        case 'polymorph-trap':
            has('the trap changed the hero', /You feel a change coming over you\./);
            break;
        case 'fire-trap':
            has('the fire trap erupted', /A tower of flame erupts from the [a-z]+|You feel a blast of hot air\.|You are engulfed in flames!/);
            break;
        case 'boulder-trap':
            has('the boulder trap clicked', /Click!  You trigger a rolling boulder trap!/);
            break;
        case 'bear-trap':
            has('hero caught in bear trap', /You are caught in a bear trap[.!]/);
            has('hero struggled out of the trap', /You finally wriggle free\./);
            has('the opening wand acted on the trap', /You are released from the bear trap\.|The bear trap opens/);
            has('the locking wand acted on the trap', /bear trap closes on your foot!|bear trap closes harmlessly/);
            has('the bear trap was disarmed', /You disarm .* bear trap\.|You extract .* from .* bear trap\.|Whoops\.\.\.  A bear trap closes on your foot!/);
            break;
        case 'troubled-prayer':
            has('sacrifice raised alignment', /You feel (?:you are )?(?:appropriately lawful|thoroughly on the right path)\./);
            has('hero wore the blindfold', /You are now wearing .* blindfold/);
            has('prayer fixed a trouble', /You feel that .* is (?:well-)?pleased|You can see again|Your vision clears/);
            break;
        case 'altar-offerings':
            has('unicorn insulted the altar', /Such an action is an insult to chaos!/);
            has('human sacrifice happened', /You'll regret this infamous offense!|find the idea very satisfying\.|The blood covers the altar!/);
            has('amulet offering refused', /You feel (?:an urge to return to the surface|ashamed)\./);
            break;
        case 'shop-robbery':
            has('merchandise was taken', /You escaped the shop without paying!|You stole .* worth of merchandise\./);
            has('the shop or Kops responded', /An alarm sounds!|Keystone Kops|Please pay before leaving|Don't you leave without paying!/);
            break;
        case 'steed-combat':
            has('the saddle went on', /You put the saddle on the pony\.|You saddle the pony/);
            has('the pony was mounted', /You mount the pony\.|\bRide\b/);
            has('the steed was kicked', /You kick the (?:saddled )?pony\.|Kick your steed\?/);
            has('a mounted attack reached a monster', /You joust |You hit the (?:lichen|saddled pony|pony|fox|jackal|newt)|You kill the (?:lichen|poor saddled pony)/);
            break;
        case 'worm-engulfing':
            has('a monster was engulfed', /You (?:swallow|engulf|enclose) the /);
            break;
        case 'exploding-form':
            has('the form exploded', /You explode!?|You explode at thin air/);
            break;
        case 'pudding-splitting':
            has('the pudding divided', /You divide as /);
            break;
        case 'yellow-light-blast':
            has('the light exploded', /The yellow light explodes!/);
            break;
        case 'silver-searing':
            has('silver seared a monster', /[Ss]ilver .*sears?/);
            break;
        case 'nymph-seduction':
            has('the nymph seduced the hero', /seduces you|Time stands still while you |charms you/);
            break;
        default:
            throw new Error(`unknown round-8 recipe ${name}`);
    }
    return checks;
}
//# sourceMappingURL=round8-recipes.mjs.map