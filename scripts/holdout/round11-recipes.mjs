function keys(value) {
    return { type: 'keys', value, dismissMore: true };
}
function choose(target, openKeys) {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}
function answer(prompt, value) {
    return { type: 'answer-prompt', prompt, value, dismissMore: true };
}
function wish(...items) {
    return [keys(items.map(item => `\x17${item}\r`).join('') + '\t\t\r')];
}
function confuse() {
    return [choose('of confusion', 'q*')];
}
function recipe(description, success, actions) {
    return {
        roles: ['wizard', 'rogue', 'barbarian'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none'],
        description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r20\r'), ...actions, keys('\x1b:\x1b'),
                ] }],
    };
}
function stoningMeal(food) {
    return [...wish(food), choose('petrifying', '#wizintrinsic\r'), keys('\r'),
        choose(food, 'me*'), keys('m.'.repeat(5))];
}
export const ROUND11_RECIPES = {
    // read.c:do_genocide(): ordinary and cursed scrolls take different branches.
    'species-genocide': recipe('Genocide one species while a member is present.', ['Jackals are wiped out.'], [...wish('uncursed scroll of genocide'), keys('\x07hostile jackal\r'),
        choose('scroll of genocide', 'r*'), answer('What type of monster', 'jackal\r')]),
    'reverse-genocide': recipe('Read cursed genocide to bring acid blobs into the level.', ['Acid blobs arrive.'], [...wish('cursed scroll of genocide'), choose('scroll of genocide', 'r*'),
        answer('What type of monster', 'acid blob\r')]),
    // read.c:seffect_charging(), recharge(). Use an empty wand.
    'scroll-recharging': recipe('Recharge a spent wand with a blessed charging scroll.', ['The wand gains charges.'], [...wish('uncursed wand of light (0:0)', 'blessed scroll of charging'),
        choose('scroll of charging', 'r*'), choose('wand of light', '*')]),
    'confused-charging': recipe('Read charging while confused to gain energy instead of charging an item.', ['The hero feels charged up.'], [...wish('uncursed potion of confusion', 'blessed scroll of charging'),
        ...confuse(), choose('scroll of charging', 'r*')]),
    // read.c:seffect_create_monster(): confusion fixes the species to acid blob.
    'confused-creation': recipe('Read create monster while confused to surround the hero with acid blobs.', ['Acid blobs are created.'], [...wish('uncursed potion of confusion', 'blessed scroll of create monster'),
        ...confuse(), choose('scroll of create monster', 'r*')]),
    'confused-fire': recipe('Read fire while confused and burn the hero hands.', ['The scroll burns the hero hands.'], [...wish('uncursed potion of confusion', 'uncursed scroll of fire'),
        ...confuse(), choose('scroll of fire', 'r*')]),
    'confused-mapping': recipe('Read magic mapping while confused to reveal only fragments of the map.', ['A map coalesces.'], [...wish('uncursed potion of confusion', 'uncursed scroll of magic mapping'),
        ...confuse(), choose('scroll of magic mapping', 'r*')]),
    // read.c:do_stinking_cloud(), can_center_cloud(), valid_cloud_pos().
    'cloud-placement': recipe('Place a stinking cloud over the hero and remain inside it.', ['Cloud placement is requested.', 'The hero coughs in the cloud.'], [
        ...wish('uncursed scroll of stinking cloud'), choose('scroll of stinking cloud', 'r*'),
        answer('Where do you want to center', '.'), keys('m.'.repeat(3)),
    ]),
    'room-illumination': recipe('Light the room, then darken it with a cursed light scroll.', ['Light spreads around the hero.', 'Darkness follows.'], [
        ...wish('blessed scroll of light', 'cursed scroll of light'),
        choose('blessed scroll of light', 'r*'), choose('a cursed scroll of light', 'r*'),
    ]),
    // zap.c:poly_obj(), obj_shudders(), do_osshock(), create_polymon().
    'floor-polymorph': recipe('Polymorph a floor pile of darts and arrows repeatedly.', ['The floor pile changes or melds into a creature.'], [
        ...wish('uncursed wand of polymorph (0:8)', '40 uncursed darts', '40 uncursed arrows'),
        choose('darts', 'd*'), choose('arrows', 'd*'),
        ...Array.from({ length: 5 }, () => [choose('wand of polymorph', 'z*'), keys('>:')]).flat(),
    ]),
    // zap.c:cancel_monst(): self-cancellation also cancels carried equipment.
    'self-cancellation': recipe('Cancel the hero in clay golem form and return to human form.', ['The golem writing vanishes.', 'The hero returns to human form.'], [
        ...wish('uncursed wand of cancellation', 'blessed +3 dagger'),
        keys('#polyself\rclay golem\r'), choose('wand of cancellation', 'z*'), keys('.'),
    ]),
    // dig.c:dig_up_grave(): a digging ray excavates the whole grave.
    'grave-excavation': recipe('Create a grave and excavate it with a downward digging ray.', ['The grave is excavated.'], [keys('\x14l.'), ...wish('fountain', 'floor', 'grave', 'uncursed wand of digging'),
        choose('wand of digging', 'z*'), keys('>')]),
    // polyself.c:dospit(), dohide(), domindblast(), dosummon().
    'cobra-spitting': recipe('Become a cobra and spit venom at the ceiling.', ['The cobra spits venom.'], [keys('#polyself\rcobra\r#monster\r'),
        answer('In what direction', '<')]),
    'mimic-hiding': recipe('Become a small mimic and hide as an object.', ['The hero mimics an object.'], [keys('#polyself\rsmall mimic\r#monster\r')]),
    'psychic-blast': recipe('Become a mind flayer and release psychic energy near a hostile creature.', ['Psychic energy is released.'], [keys('#polyself\rmind flayer\r\x07hostile floating eye\r#monster\r')]),
    'werewolf-summoning': recipe('Become a werewolf and call for tame brethren.', ['The hero calls for brethren.'], [...wish('blessed tin of human werewolf meat'),
        choose('tin of', 'me*'), answer('Eat it?', 'y'), keys('#polyself\rwerewolf\r#monster\r')]),
    // polyself.c:armor_to_dragon(), skinback().
    'dragon-armor-merging': recipe('Merge worn red dragon scales into dragon skin and restore them on reversion.', ['Scales merge with the hero.', 'Reversion restores the armor.'], [
        ...wish('uncursed red dragon scales'), keys('T'), keys('m.'.repeat(5)),
        choose('red dragon scales', 'W*'), keys('#polyself\rred dragon\r#polyself\rhuman\r'),
    ]),
    // lock.c:boxlock(), zap.c:boxlock_invent().
    'magical-box-locks': recipe('Lock a floor box magically, pick it up, and unlock it with a self zap.', ['The box locks.', 'The carried box unlocks.'], [
        ...wish('uncursed empty unlocked large box', 'uncursed wand of locking', 'uncursed wand of opening'),
        choose('large box', 'd*'), choose('wand of locking', 'z*'), keys('>,'),
        choose('wand of opening', 'z*'), keys('.'),
    ]),
    // eat.c:cprefx(), fix_petrification(): lizard and acidic flesh both cure it.
    'lizard-stoning-cure': recipe('Start petrifying with a wizard command, then eat lizard flesh.', ['Petrification starts.', 'Lizard flesh cures it.'], stoningMeal('lizard corpse')),
    'acidic-stoning-cure': recipe('Start petrifying with a wizard command, then eat acidic flesh.', ['Petrification starts.', 'Acidic flesh cures it.'], stoningMeal('acid blob corpse')),
};
const EFFECTS = {
    'species-genocide': [['species wiped out', /Wiped out all jackals\./]],
    'reverse-genocide': [['monsters sent in', /Sent in (?:some acid blobs|an acid blob)\./]],
    'scroll-recharging': [['wand charged', /wand of light (?:glows|glow)/]],
    'confused-charging': [['energy restored', /You feel charged up!/]],
    'confused-creation': [['acid blobs present', /acid blobs?/]],
    'confused-fire': [['hands burned', /scroll catches fire and you burn your hands/]],
    'confused-mapping': [['mapping performed', /A map coalesces in your mind!/]],
    'cloud-placement': [['cloud requested', /Where do you want to center/], ['cloud affects hero', /You cough|coughing/]],
    'room-illumination': [['light spreads', /lit field|lit up/], ['room darkens', /You are surrounded by darkness/]],
    'floor-polymorph': [],
    'self-cancellation': [['golem cancelled', /Some writing vanishes from your head!/], ['hero reverts', /You return to/]],
    'grave-excavation': [['grave excavated', /unearth a corpse|grave's owner|disturbed a tomb|grave is unoccupied/]],
    'cobra-spitting': [['venom spat', /A splash of venom hits the ceiling/]],
    'mimic-hiding': [['mimic hides', /now mimicking/]],
    'psychic-blast': [['psychic energy released', /A wave of psychic energy pours out/]],
    'werewolf-summoning': [['brethren called', /call upon your brethren for help/]],
    'dragon-armor-merging': [['armor merges', /You merge with your scaly armor/], ['armor restored', /skin returns to its original form/]],
    'magical-box-locks': [['box locked', /Klunk!/], ['box unlocked', /Klick!/]],
    'lizard-stoning-cure': [['petrification begins', /You are turning into stone/], ['flesh cures petrification', /You feel limber!/]],
    'acidic-stoning-cure': [['petrification begins', /You are turning into stone/], ['flesh cures petrification', /You feel limber!/]],
};
function floorPileChanged(screens) {
    return screens.some(screen => {
        if (/objects meld/.test(screen))
            return true;
        const lines = screen.split('\n');
        const heading = lines.findIndex(line => line.trim() === 'Things that are here:');
        if (heading < 0)
            return false;
        const firstObject = lines[heading + 1]?.trim() ?? '';
        return firstObject.length > 0 && !/\b(?:darts|arrows)\b/.test(firstObject);
    });
}
export function validateRound11Recipe(name, session) {
    const effects = EFFECTS[name];
    if (!effects)
        throw new Error(`unknown round-11 recipe ${name}`);
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    const checks = [
        { check: 'one recorded version-5 segment', ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' },
        { check: 'gameplay consumed turns', ok: (turns.at(-1) ?? 0) > (turns[0] ?? Infinity), evidence: '' },
        ...effects.map(([check, effect]) => ({ check, ok: effect.test(text), evidence: '' })),
    ];
    if (name === 'floor-polymorph')
        checks.push({
            check: 'the pile changes to other objects or a golem', ok: floorPileChanged(screens), evidence: '',
        });
    return checks;
}
//# sourceMappingURL=round11-recipes.mjs.map