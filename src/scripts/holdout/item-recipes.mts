import { itemAt } from '../lib/session-types.mjs';
import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

// These plans use the existing recorder actions. Identification makes menu
// labels stable without relying on a role's inventory letters or appearances.
function keys(value: string): SessionAction {
    return { type: 'keys', value, dismissMore: true };
}

function choose(target: string, openKeys: string): SessionAction {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}

function wish(...items: string[]): SessionAction[] {
    return [keys(items.map(item => `\x17${item}\r`).join('') + '\t\t\r')];
}

function pickItems<T>(seed: number, items: readonly T[], count: number): T[] {
    const remaining = items.slice();
    const selected: T[] = [];
    let state = seed >>> 0;
    while (selected.length < count && remaining.length) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const index = state % remaining.length;
        selected.push(itemAt(remaining, index));
        remaining.splice(index, 1);
    }
    return selected;
}

function itemRecipe(description: string, success: string[], actions: (seed: number) => SessionAction[]): Recipe {
    return {
        // Full-width menus keep item selectors at the start of each line,
        // where the recorder's existing menu action can read them.
        roles: ['knight'], options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips'], description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            // Extra HP allows harmful item effects to run without an early
            // wizard death prompt. It does not grant elemental resistances.
            keys('#levelchange\r20\r'), ...actions(seed), keys('\x1b:\x1b'),
        ] }],
    };
}

const SCROLLS = [
    'identify', 'enchant weapon', 'enchant armor', 'remove curse', 'teleportation',
    'gold detection', 'food detection', 'light', 'fire', 'earth', 'create monster',
    'taming', 'genocide', 'charging', 'magic mapping', 'amnesia', 'destroy armor',
    'confuse monster', 'scare monster', 'punishment', 'stinking cloud',
];
const POTIONS = [
    'gain ability', 'restore ability', 'confusion', 'blindness', 'paralysis',
    'speed', 'levitation', 'hallucination', 'invisibility', 'see invisible',
    'healing', 'extra healing', 'full healing', 'gain level', 'enlightenment',
    'monster detection', 'object detection', 'gain energy', 'sleeping',
    'booze', 'sickness', 'fruit juice', 'acid', 'oil', 'water', 'polymorph',
];
const WANDS = [
    'striking', 'fire', 'cold', 'lightning', 'sleep', 'polymorph',
    'teleportation', 'create monster', 'undead turning', 'opening', 'locking',
    'make invisible', 'slow monster', 'speed monster', 'cancellation', 'light',
    'secret door detection', 'enlightenment', 'nothing', 'stasis',
];
const NO_DIRECTION = new Set(['light', 'secret door detection', 'enlightenment', 'create monster', 'stasis']);
const BLESSINGS = ['blessed', 'uncursed', 'cursed'];

interface ToolUse { name: string; after: string; }
const TOOLS: ToolUse[] = [
    { name: 'tin whistle', after: '' }, { name: 'magic whistle', after: '' },
    { name: 'mirror', after: '.' }, { name: 'stethoscope', after: '.' },
    { name: 'oil lamp', after: '' }, { name: 'brass lantern', after: '' },
    { name: 'towel', after: '' }, { name: 'unicorn horn', after: '' },
    { name: 'bell', after: '' }, { name: 'horn of plenty', after: '' },
    { name: 'expensive camera', after: '.' }, { name: 'bag of tricks', after: '' },
    { name: 'wooden flute', after: 'y' }, { name: 'tooled horn', after: 'y' },
    { name: 'wooden harp', after: 'y' }, { name: 'leather drum', after: '' },
];

export const ITEM_RECIPES: Record<string, Recipe> = {
    'scroll-reading': itemRecipe(
        'Read three seeded scroll types, sometimes while confused; answer genocide, charging, and targeting prompts.',
        ['Three scrolls are read and disappear or report that they were read.'], seed => {
            const scrolls = pickItems(seed, SCROLLS, 3);
            // Confused genocide targets the hero's own race and ends the
            // game; keep those scrolls for the ordinary reading variants.
            const confused = seed % 3 === 0 && !scrolls.includes('genocide');
            const actions = wish(...scrolls.map(name => `uncursed scroll of ${name}`),
                ...(confused ? ['uncursed potion of confusion'] : []));
            if (confused) actions.push(choose('potion of confusion', 'mq*'));
            for (const name of scrolls) {
                actions.push(choose(`scroll of ${name}`, 'r*'));
                if (name === 'genocide') actions.push(keys('jackal\r'));
                if (name === 'charging' && !confused) actions.push(keys('a'));
                if (name === 'stinking cloud') actions.push(keys('.'));
                if (name === 'teleportation' && confused) actions.push(keys('2\r'));
                // Close detection maps, or decline wizard monster selection
                // so create_critters() generates its ordinary random monsters.
                actions.push(keys('\x1b'));
            }
            return actions;
        }),
    'potion-quaffing': itemRecipe(
        'Quaff two seeded potions with varied beatitude, bless a weapon by dipping, and throw a third potion down.',
        ['Two potions are drunk with turns consumed.', 'The dipped weapon glows.', 'The thrown potion shatters.'], seed => {
            // The recipe wishes for its own holy water; a second water wish
            // would merge into that stack and change its name.
            const potions = pickItems(seed, POTIONS.filter(name => name !== 'water'), 3);
            const blessing = itemAt(pickItems(seed + 1, BLESSINGS, 1), 0);
            const actions = wish(...potions.map(name => `${blessing} potion of ${name}`),
                'blessed potion of water', 'uncursed +0 dagger');
            // Dip and throw before quaffing: blindness and levitation then
            // cannot hide the breakage message or block floor interactions.
            actions.push(choose('dagger', 'm#dip\r*'), choose('potion of holy water', '*'));
            const label = (name: string) => `potion of ${name}`;
            actions.push(choose(label(itemAt(potions, 2)), 't*'), keys('>'));
            // A new form might have no hands. Drink polymorph last.
            for (const name of potions.slice(0, 2).sort((a, b) => Number(a === 'polymorph') - Number(b === 'polymorph'))) {
                // Some drinks have no message or immediate status refresh.
                // Show inventory so validation can observe their consumption.
                actions.push(choose(label(name), 'mq*'), keys('\x1bi\x1b'));
            }
            return actions;
        }),
    'wand-zapping': itemRecipe(
        'Engrave with a digging wand, zap two seeded wand types, and probe the hero.',
        ['Wand engraving leaves visible text.', 'Engraving and all three zaps spend charges.', 'Self probing reports the hero status.'], seed => {
            const wands = pickItems(seed, WANDS, 2);
            const actions = wish('uncursed wand of digging', 'uncursed wand of probing',
                ...wands.map(name => `uncursed wand of ${name}`));
            actions.push(choose('wand of digging', 'E*'), keys('Elbereth\r:'));
            for (const name of wands) {
                actions.push(choose(`wand of ${name}`, 'z*'));
                if (!NO_DIRECTION.has(name)) actions.push(keys(seed % 2 ? 'h' : 'l'));
                actions.push(keys('\x1b'));
            }
            actions.push(choose('wand of probing', 'z*'), keys('.i\x1b'));
            return actions;
        }),
    'tool-applying': itemRecipe(
        'Apply three seeded tools, including directed and musical tools.',
        ['At least two applications produce tool effects and turns pass.'], seed => {
            const tools = pickItems(seed, TOOLS, 3);
            const actions = wish(...tools.map(tool => `uncursed ${tool.name}`));
            for (const tool of tools) {
                actions.push(choose(tool.name, 'a*'));
                if (tool.after) actions.push(keys(tool.after));
            }
            return actions;
        }),
    'container-looting': itemRecipe(
        'Stash a seeded gem in a seeded empty bag and take it back out.',
        ['An item is put into a container.', 'An item is taken out of that container.'], seed => {
            const bag = itemAt(pickItems(seed, ['sack', 'oilskin sack', 'bag of holding'], 1), 0);
            const gem = itemAt(pickItems(seed + 1, ['ruby', 'emerald', 'diamond', 'amethyst', 'opal'], 1), 0);
            return [...wish(`uncursed empty ${bag}`, `uncursed ${gem}`),
                choose(bag, 'a*'), keys('s'), choose(gem, '*'),
                choose(bag, 'a*'), keys('o'), choose(gem, ''), keys('\r')];
        }),
    'wear-cycle': itemRecipe(
        'Wear and remove seeded boots and a cloak, cycle a ring and amulet, then attempt to remove a cursed ring.',
        ['Armor and accessories are worn and removed.', 'A cursed accessory refuses removal.'], seed => {
            const boots = itemAt(pickItems(seed, ['speed boots', 'water walking boots', 'elven boots', 'kicking boots'], 1), 0);
            const cloak = itemAt(pickItems(seed + 1, ['cloak of protection', 'cloak of displacement', 'oilskin cloak'], 1), 0);
            const ring = itemAt(pickItems(seed + 2, ['ring of protection', 'ring of stealth', 'ring of regeneration', 'ring of searching'], 1), 0);
            const amulet = itemAt(pickItems(seed + 3, ['amulet of life saving', 'amulet of reflection', 'amulet of guarding'], 1), 0);
            const actions = wish(`uncursed +1 ${boots}`, `uncursed +1 ${cloak}`, `uncursed +1 ${ring}`,
                `uncursed ${amulet}`, 'cursed ring of hunger');
            for (const armor of [boots, cloak]) actions.push(choose(armor, 'W*'), choose(armor, 'T*'));
            // R removes the sole accessory directly in native doremring().
            actions.push(choose(ring, 'P*'), keys('rR'));
            actions.push(choose(amulet, 'P*'), keys('R'));
            actions.push(choose('ring of hunger', 'P*'), keys('rR'));
            actions.push(choose('small shield', 'T*'), keys('X#enhance\r\x1b'));
            return actions;
        }),
    'eating': itemRecipe(
        'Eat a seeded safe corpse or snack, a blessed tin, and a partly eaten ration.',
        ['Food is eaten.', 'A tin is opened and eaten.', 'The hero eats from a partly eaten ration.'], seed => {
            const food = itemAt(pickItems(seed, ['lichen corpse', 'lizard corpse', 'egg', 'fortune cookie', 'candy bar', 'meatball'], 1), 0);
            const tin = itemAt(pickItems(seed + 1, ['newt meat', 'lichen', 'lizard meat', 'jackal meat'], 1), 0);
            return [...wish(`uncursed ${food}`, `blessed tin of ${tin}`, 'uncursed partly eaten food ration'),
                choose(food, 'me*'), choose('tin of', 'me*'), keys('y'), choose('food ration', 'me*')];
        }),
    'pray-variants': itemRecipe(
        'Wish for a seeded altar and corpse, sacrifice, then pray twice without forcing success.',
        ['The offering is consumed or rejected by a god.', 'Two prayers receive divine responses.'], seed => {
            const alignment = itemAt(pickItems(seed, ['lawful', 'neutral', 'chaotic'], 1), 0);
            const corpse = itemAt(pickItems(seed + 1, ['lichen', 'lizard', 'newt', 'jackal'], 1), 0);
            return [...wish(`${alignment} altar`, `uncursed ${corpse} corpse`),
                choose(`${corpse} corpse`, '#offer\r*'), keys('#pray\ryn#pray\ryn')];
        }),
    'help-pager': itemRecipe(
        'Read a seeded help entry, inspect a map location, attributes, terrain, overview, and discoveries.',
        ['Help content is displayed.', 'A map location is described.', 'Attributes and dungeon overview are displayed.'], seed => {
            const help = itemAt(pickItems(seed, ['Concise history', 'List of game commands',
                'List menu control keys', 'List of wizard-mode commands', 'About NetHack'], 1), 0);
            return [choose(help, '?'), keys('\x1b;.\x1b\x18\x1b'),
                choose('known map without monsters and objects', '#terrain\r'), keys('\x1b#overview\r\x1b\\\x1b')];
        }),
};

function screens(session: RecipeRecording): string[] {
    return (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
}

function transitions(screens: string[], pattern: RegExp): number {
    return screens.filter((screen, index) => pattern.test(screen)
        && (index === 0 || !pattern.test(screens[index - 1] ?? ''))).length;
}

function completedEffects(screens: string[], prompt: RegExp, effect: RegExp): number {
    let awaitingEffect = false;
    let completed = 0;
    for (const [index, screen] of screens.entries()) {
        if (prompt.test(screen) && !prompt.test(screens[index - 1] ?? '')) awaitingEffect = true;
        // getobj() reports an escaped selection; later messages belong to
        // other commands.
        else if (awaitingEffect && /^Never mind\./.test(screen)) awaitingEffect = false;
        else if (awaitingEffect && !prompt.test(screen) && effect.test(screen)) {
            completed++;
            awaitingEffect = false;
        }
    }
    return completed;
}

function inventoryPotionCount(screen: string): number | undefined {
    if (!/(?:^|\n)\s*\(end\)\s*(?:\n|$)/.test(screen)
        || !/(?:^|\n)\s*[a-zA-Z] [-+] /.test(screen)) return undefined;
    let count = 0;
    for (const item of screen.matchAll(/(?:^|\n)\s*[a-zA-Z] [-+] (an?|\d+) ([^\n]+)/g)) {
        if (/\bpotions?\b/.test(item[2] ?? ''))
            count += item[1] === 'a' || item[1] === 'an' ? 1 : Number(item[1]);
    }
    return count;
}

function completedDrinks(screens: string[]): number {
    let awaitingDrink = false;
    let before: number | undefined;
    let completed = 0;
    for (const screen of screens) {
        if (/What do you want to drink\?/.test(screen)) {
            awaitingDrink = true;
            before = undefined;
        } else if (/Never mind\.|What do you want to /.test(screen)) {
            // Inventory lost during another action is not a drink, even
            // when cancellation itself was silent (!verbose).
            awaitingDrink = false;
        }
        if (!awaitingDrink) continue;
        const count = inventoryPotionCount(screen);
        if (count === undefined) continue;
        if (before === undefined) before = count;
        else {
            if (count < before) completed++;
            awaitingDrink = false;
        }
    }
    return completed;
}

function dischargedWands(screens: string[]): number {
    const charges = new Map<string, { first: number; last: number }>();
    for (const screen of screens) {
        for (const match of screen.matchAll(/wand of ([a-z ]+) \(\d+:(\d+)\)/g)) {
            const name = match[1];
            if (!name) continue;
            const value = Number(match[2]);
            charges.set(name, { first: charges.get(name)?.first ?? value, last: value });
        }
    }
    return [...charges.values()].filter(charge => charge.last < charge.first).length;
}

export function validateItemRecipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const observed = screens(session);
    const text = observed.join('\n');
    const checks: RecipeCheck[] = [];
    const require = (check: string, ok: boolean, evidence = '') => { checks.push({ check, ok, evidence }); };
    const has = (check: string, pattern: RegExp) => require(check, pattern.test(text));
    require('one recorded version-5 segment', session.version === 5 && session.segments.length === 1 && observed.length >= 2);
    const turns = observed.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    if (name !== 'help-pager') require('item use consumed turns',
        (turns.at(-1) ?? 0) > (turns[0] ?? Infinity));
    switch (name) {
    case 'scroll-reading': {
        const read = transitions(observed, /As you read the scroll, it disappears\.|You read the scroll\.|As you (?:pronounce|cogitate) the formula on it, the scroll disappears\.|You (?:pronounce|cogitate) the formula on the scroll\./);
        require('three scrolls read', read >= 3, `${read} read messages`);
        break;
    }
    case 'potion-quaffing':
        require('two drinks completed', completedDrinks(observed) >= 2);
        has('dipped weapon blessed', /dagger.*(?:glows|shines).*light blue aura/);
        has('thrown potion broke', /(?:potion|bottle).*(?:shatters|breaks|shards|crashes)/i);
        break;
    case 'wand-zapping':
        has('wand engraving visible', /engraved here.*(?:floor|ground)|read:.*Elbereth/i);
        require('engraving and all three zaps spent charges', dischargedWands(observed) >= 4);
        has('self probing completed', /Status of wizard/);
        break;
    case 'tool-applying':
        require('multiple applications produce effects', completedEffects(observed, /What do you want to use or apply\?/,
            /(?:You (?:produce|whistle|ring|play|start playing|begin playing|hear|see|look|feel|take a picture|are blinded by the flash)|lamp.*(?:on|lit)|lantern.*(?:on|lit)|Nothing (?:happens|seems to happen)|face is already clean|spills out|Status of wizard)/i) >= 2);
        break;
    case 'container-looting':
        has('item put into container', /You put .* into (?:the|your) /);
        // out_container() prints the inventory letter when the takeout
        // menu closes. Later wielding or inventory messages are unrelated.
        require('item taken out of container', observed.some((screen, index) =>
            /Take out what\?/.test(observed[index - 1] ?? '')
            && !/Take out what\?/.test(screen) && /^[a-zA-Z] - an? /.test(screen)));
        break;
    case 'wear-cycle':
        has('armor worn', /finish your dressing maneuver|You are now wearing/);
        has('armor removed', /finish taking off|You were wearing/);
        has('ring worn', /ring of .*on (?:right|left) hand/);
        has('amulet worn', /amulet of .*being worn/);
        has('ring removed', /You were wearing .*ring of /);
        has('amulet removed', /You were wearing .*amulet of /);
        has('curse prevents removal', /You can't\.\s+It is cursed/);
        break;
    case 'eating':
        has('food eaten', /This .* (?:tastes|is (?:delicious|fatty|terrible|bland))|finish eating|last bite|This is delicious/);
        has('tin opened', /succeed in opening the tin|easily open the tin|tin opens like magic/);
        has('tin eaten', /You consume /);
        has('partly eaten ration resumed', /You (?:begin|resume) eating .*partly eaten food ration/);
        break;
    case 'pray-variants':
        has('sacrifice evaluated', /sacrifice is consumed|Nothing happens|altar.*(?:reject|stain)|god.*(?:reject|accept)/i);
        require('two prayers received verdicts', completedEffects(observed, /You begin praying to/,
            /pleased|angry|booms|thunders|rings out|satisfied|malignant aura|benediction|feel.*(?:lucky|hopeful|reconciled)/i) >= 2);
        break;
    case 'help-pager':
        require('help content displayed', observed.some(screen => !screen.includes('Select one item:')
            && /NetHack.*(?:history|commands|version)|Menu control|wizard.mode commands|Debug-Mode Quick Reference|General commands/i.test(screen)));
        has('map location described', /\(human knight called wizard\)/i);
        has('attributes displayed', /Current Attributes|Current Status|Background:|Basics:/);
        has('overview displayed', /The Dungeons of Doom|Dungeon overview/);
        break;
    default:
        throw new Error(`unknown item recipe ${name}`);
    }
    return checks;
}
