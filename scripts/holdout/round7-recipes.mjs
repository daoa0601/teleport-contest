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
function recipe(description, success, actions, roles = ['knight', 'barbarian', 'wizard']) {
    return {
        roles, options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips'], description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    keys('#levelchange\r20\r'), ...actions(seed), keys('\x1b:\x1b'),
                ] }],
    };
}
export const ROUND7_RECIPES = {
    // potion.c:peffect_gain_ability(), peffect_gain_level(), peffect_restore_ability().
    'restorative-draughts': recipe('Drink potions that raise attributes and experience, then restore ability.', ['Attributes increase.', 'Experience increases.', 'Restore ability takes effect.'], seed => [
        ...wish('blessed potion of gain ability', `${pick(seed, ['blessed', 'uncursed'])} potion of gain level`, 'blessed potion of restore ability'),
        choose('potion of gain ability', 'mq*'), choose('potion of gain level', 'mq*'),
        choose('potion of restore ability', 'mq*'),
    ]),
    // potion.c:peffect_booze(), peffect_enlightenment(), peffect_see_invisible().
    'perceptive-draughts': recipe('Drink booze and enlightenment, then cure blindness with see invisible.', ['Booze is drunk.', 'Enlightenment finishes.', 'See invisible cures blindness.'], seed => [
        ...wish(`${pick(seed, ['cursed', 'uncursed'])} potion of booze`, 'blessed potion of enlightenment', 'uncursed potion of blindness', 'uncursed potion of see invisible'),
        choose('potion of booze', 'mq*'), choose('potion of enlightenment', 'mq*'), keys('\x1b'),
        choose('potion of blindness', 'mq*'), choose('potion of see invisible', 'mq*'),
    ]),
    // potion.c:peffect_speed(), speed_up().
    'speed-draught': recipe('Drink a non-cursed speed potion to gain natural quickness.', ['The potion grants intrinsic speed.'], seed => [
        ...wish(`${pick(seed, ['blessed', 'uncursed'])} potion of speed`), choose('potion of speed', 'mq*'),
    ], ['wizard', 'rogue']),
    // apply.c:use_unicorn_horn(). Repeated uses allow the native cure roll
    // to succeed without deciding the outcome in the driver.
    'horn-curing': recipe('Cure potion blindness with a blessed unicorn horn.', ['The potion blinds the hero.', 'The horn restores sight.'], () => {
        const actions = [...wish('blessed unicorn horn', 'uncursed potion of blindness'),
            choose('potion of blindness', 'mq*')];
        for (let attempt = 0; attempt < 12; attempt++)
            actions.push(choose('unicorn horn', 'a*'));
        return actions;
    }),
    // apply.c:use_whistle().
    'ordinary-whistle': recipe('Blow an ordinary tin whistle.', ['The whistle sounds.'], seed => [
        ...wish(`${pick(seed, ['blessed', 'uncursed'])} tin whistle`), choose('tin whistle', 'a*'),
    ]),
    // do_wear.c:Blindf_off().
    'blindfold-removal': recipe('Put on a blindfold and remove it to recover sight.', ['The blindfold blocks sight.', 'Removing it restores sight.'], () => [
        ...wish('uncursed blindfold'), choose('blindfold', 'P*'), keys('R'),
    ]),
    // do_wear.c:adjust_attrib(), adj_abon(). A Wizard starts with a cloak
    // and no other armor; removing it makes the gloves the only enchant target.
    'attribute-equipment': recipe('Wear a constitution ring and enchant worn dexterity gloves.', ['The ring is worn.', 'The worn gloves are enchanted.'], seed => [
        keys('T'),
        ...wish('uncursed +2 ring of gain constitution', 'uncursed +1 gauntlets of dexterity', `${pick(seed, ['blessed', 'uncursed'])} scroll of enchant armor`),
        choose('ring of gain constitution', 'P*'), keys('l'), choose('gauntlets of dexterity', 'W*'),
        choose('scroll of enchant armor', 'r*'), keys('i\x1bR'),
    ], ['wizard']),
    // zap.c:cancel_item(), zap_updown().
    'floor-cancellation': recipe('Cancel a scroll on the floor into blank paper.', ['The floor scroll becomes blank paper.'], seed => [
        ...wish('uncursed wand of cancellation (0:3)', `uncursed scroll of ${pick(seed, ['identify', 'light'])}`),
        choose('scroll of', 'd*'), choose('wand of cancellation', 'z*'), keys('>:'),
    ]),
    // zap.c:fracture_rock(), zap_updown().
    'rock-fracturing': recipe('Strike a boulder downward and inspect the resulting rocks.', ['The boulder breaks into rocks.'], () => [
        ...wish('uncursed wand of striking (0:3)', 'boulder'),
        choose('wand of striking', 'z*'), keys('>:'),
    ]),
    // zap.c:probe_monster(). A sleeping eye stays still while directions
    // are tried; the downward probe also exercises zap_updown().
    'creature-probing': recipe('Probe a sleeping floating eye and then the floor.', ['A monster is probed.', 'The floor is probed.'], seed => {
        const actions = [...wish('uncursed wand of probing (0:20)'), keys('\x07sleeping floating eye\r')];
        for (const direction of pick(seed, ['hykulnjb', 'lnjbhyku']))
            actions.push(choose('wand of probing', 'z*'), keys(`${direction}\x1b`));
        actions.push(choose('wand of probing', 'z*'), keys('>'));
        return actions;
    }),
    // zap.c:zapnodir(), do_enlightenment_effect().
    'wand-enlightenment': recipe('Zap a directionless wand of enlightenment and finish its attribute display.', ['The wand grants self-knowledge.', 'The enlightenment display finishes.'], () => [
        ...wish('uncursed wand of enlightenment (0:3)'), choose('wand of enlightenment', 'z*'), keys('\x1b'),
    ]),
    // pickup.c:removed_from_icebox(). Power gloves let these ungloved roles
    // carry the ice box, keeping both container operations in inventory.
    'icebox-thawing': recipe('Freeze a corpse in an ice box and take it out again.', ['The corpse is put in the ice box.', 'The corpse is taken out.'], seed => {
        const corpse = `${pick(seed, ['lichen', 'lizard'])} corpse`;
        return [...wish('uncursed gauntlets of power'), choose('gauntlets of power', 'W*'),
            ...wish('uncursed empty ice box', `uncursed ${corpse}`),
            choose('ice box', 'a*'), keys('s'), choose(corpse, '*'),
            choose('ice box', 'a*'), keys('o'), choose(corpse, ''), keys('\r')];
    }, ['wizard', 'rogue']),
    // pickup.c:choose_tip_container_menu().
    'floor-container-tipping': recipe('Choose a floor sack from multiple containers and tip its contents out.', ['The floor container is selected.', 'Its contents spill out.'], seed => {
        const gem = pick(seed, ['ruby', 'emerald']);
        return [...wish('uncursed empty sack', 'uncursed empty large box', `uncursed ${gem}`),
            choose('sack', 'a*'), keys('s'), choose(gem, '*'),
            choose('large box', 'd*'), choose('sack', 'd*'), choose('sack', '#tip\r'), keys('\r:')];
    }),
    // trap.c:chest_trap().
    'trapped-box-opening': recipe('Open an unlocked trapped box, letting its one-shot trap resolve.', ['Opening the box triggers its trap.'], seed => [
        ...wish(`uncursed empty unlocked trapped ${pick(seed, ['chest', 'large box'])}`),
        choose('empty', 'a*'), keys('\x1b'),
    ]),
    // trap.c:trapeffect_slp_gas_trap().
    'sleeping-gas': recipe('Jump onto a sleeping gas trap and wait for its sleep to resolve.', ['Landing triggers the sleeping gas.'], () => [
        keys('\x14l.'), ...wish('fountain', 'floor', 'uncursed jumping boots'),
        choose('jumping boots', 'W*'), ...wish('sleeping gas trap'), keys('#jump\r.'),
    ], ['barbarian', 'knight']),
    // shk.c:money2u(), subfrombill(), donate_gold().
    'shop-trading': {
        ...recipe('Visit Minetown merchandise, offer owned daggers for sale, and deposit gold.', ['A shopkeeper buys an item.', 'Gold establishes shop credit.'], seed => {
            const actions = [...wish('blessed potion of object detection'),
                choose('minetn', 'm\x16'), choose('potion of object detection', 'mq*'), keys('\x1b')];
            for (let visit = 0; visit < 24; visit++) {
                const next = 'o'.repeat(visit + pick(seed, [1, 2]));
                // 'a' accepts a sale offer; elsewhere it starts apply,
                // which Escape cancels without moving the hero.
                actions.push(keys(`\x14${next}.`), ...wish('uncursed +0 dagger', '100 gold pieces'), choose('dagger', 'd*'), keys('a\x1bd$:\x1b'));
                // Teleporting consumes nutrition even when it takes
                // only one turn. Replace it before the hero faints.
                if (visit % 4 === 3)
                    actions.push(...wish('uncursed K-ration'), choose('K-ration', 'me*'));
            }
            return actions;
        }),
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'menustyle:traditional'],
    },
};
export function validateRound7Recipe(name, session) {
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
        case 'restorative-draughts':
            has('attributes raised', /You feel (?:strong|smart|wise|agile|tough|charismatic)/);
            has('experience raised', /Welcome to experience level 21\./);
            has('ability restored', /Wow!  This makes you feel (?:great|better)!/);
            break;
        case 'perceptive-draughts':
            has('booze drunk', /Ooph!  This tastes like liquid fire!/);
            has('enlightenment finished', /The feeling subsides\./);
            has('blindness cured', /You can see again\./);
            break;
        case 'speed-draught':
            has('intrinsic speed granted', /Your quickness feels very natural\./);
            break;
        case 'horn-curing':
            has('potion blinded the hero', /A cloud of darkness falls upon you\./);
            has('horn cured blindness', /You can see again\./);
            break;
        case 'ordinary-whistle':
            has('whistle sounded', /You produce a high whistling sound\./);
            break;
        case 'blindfold-removal':
            has('blindfold worn', /You can't see any more\./);
            has('blindfold removed', /You can see again\./);
            break;
        case 'attribute-equipment':
            has('ring worn', /ring of gain constitution \(on left hand\)/);
            has('gloves enchanted', /gauntlets of dexterity glow[^.\n]*silver/);
            break;
        case 'floor-cancellation':
            has('scroll cancelled', /(?:You see here|Things that are here:)[\s\S]*unlabeled scroll/);
            break;
        case 'rock-fracturing':
            has('rocks produced', /(?:You see here|Things that are here:)[\s\S]*\b\d+ rocks\b/);
            break;
        case 'creature-probing':
            has('monster probed', /Status of the floating eye/);
            has('floor probed', /You probe beneath /);
            break;
        case 'wand-enlightenment':
            has('wand granted self-knowledge', /You feel self-knowledgeable\.\.\./);
            has('enlightenment finished', /The feeling subsides\./);
            break;
        case 'icebox-thawing':
            has('corpse frozen', /You put [^.\n]*corpse into the ice box\./);
            checks.push({ check: 'corpse taken out', ok: screens.some((screen, index) => /Take out what\?/.test(screen) && screens.slice(index + 1).some(later => /^(?:You have (?:a little|much|extreme) trouble removing )?[a-zA-Z] - [^\n]*corpse\./m.test(later))), evidence: '' });
            break;
        case 'floor-container-tipping':
            has('floor container choice offered', /Tip which container\?/);
            has('sack emptied', /An object spills out: +an? uncursed (?:ruby|emerald)\./);
            break;
        case 'trapped-box-opening':
            has('box trap triggered', /You trigger a trap!/);
            break;
        case 'sleeping-gas':
            has('gas trap triggered', /A cloud of gas puts you to sleep!|You are enveloped in a cloud of gas!/);
            break;
        case 'shop-trading':
            has('item sold', /You sold [^.\n]* for \d+ gold pieces?\./);
            has('credit established', /You have established \d+ zorkmids? credit\./);
            break;
        default:
            throw new Error(`unknown round-7 recipe ${name}`);
    }
    return checks;
}
//# sourceMappingURL=round7-recipes.mjs.map