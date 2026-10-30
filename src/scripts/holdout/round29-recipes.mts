import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

type Effect = readonly [string, RegExp];
const effects: Record<string, readonly Effect[]> = {};

export const ROUND29_RECIPES: Record<string, Recipe> = {
    'r29-quest-goal-return': recipe('r29-quest-goal-return', 'Return to the quest goal while the nemesis still holds the artifact.', [
        ['quest goal first entered', /feel your mentor.s presence/],
        ['quest artifact sought on return', /aura of the Eye of the Aethiopica tingles/],
    ], [...prepare(), ...intrinsic('invulnerable'),
        choose('Wiz-goal', 'm\x16'), choose('Wiz-loca', 'm\x16'), choose('Wiz-goal', 'm\x16')]),
    'r29-conjoined-pit-flip': recipe('r29-conjoined-pit-flip', 'Join two pits with a pick, flip the level, and attempt to leave the pit.', [
        ['pits joined', /clear some debris from between the pits/],
        ['pit retained after flip', /still in a pit|crawl to the edge of the pit|ascend from the pit/],
    ], [...prepare(12), ...wish('uncursed pick-axe', 'pit'), keys('ml'),
        ...wish('fountain', 'floor', 'pit'), keys('mh'), identify(),
        choose('pick-axe', 'a*'), answer('In what direction', 'l'),
        keys('#wizfliplevel\r'), answer('Flip 0=randomly', '2'), ...wait(12),
        keys('#wizmap\rh'), answer('Really step into that pit?', 'y'), keys(':')]),
    'r29-confined-worm': recipe('r29-confined-worm', 'Kick the only square an awake peaceful worm could move to, then examine its health.', [
        ['worm examined', /Status of (?:the )?long worm/],
    ], [...prepare(), ...corner(), keys('mlml'), ...wish('fountain', 'floor'), keys('mhmh'),
        ...wish('uncursed stethoscope'), identify(), ...create('peaceful long worm'),
        keys('ml'), ...wish('fountain', 'floor'), keys('mh'),
        ...Array.from({ length: 12 }, () => [keys('\x04'), answer('In what direction', 'l')]).flat(),
        keys('ml'), choose('stethoscope', 'a*'), answer('In what direction', 'l')]),
    'r29-zoo-sounds': recipe('r29-zoo-sounds', 'Listen on regenerated dungeon levels for the animals in a generated zoo.', [
        ['zoo animals heard', /sound reminiscent of (?:an elephant stepping on a peanut|a seal barking)/],
    ], [...prepare(), ...intrinsic('invulnerable'), ...intrinsic('stealth'),
        keys('\x16'), answer('To what level', '12\r'),
        ...Array.from({ length: 20 }, () => [...wait(400), keys('#wizmakemap\r'),
            answer('Really regenerate', 'y')]).flat()]),
    'r29-monster-undead-turning': recipe('r29-monster-undead-turning', 'Leave a corpse in the firing line of a monster that collects an undead-turning wand.', [
        ['monster uses wand', /(?:gnomish wizard|gnome) zaps (?:a|an|the) wand/],
        ['floor corpse revives', /(?:lichen|lizard) (?:corpse comes (?:back )?(?:to life|alive)|is resurrected|comes alive)/],
    ], [...prepare(), ...corner(), ...wish('blessed scroll of light'),
        ...Array.from({ length: 7 }, () => [keys('ml'), ...wish('fountain', 'floor',
            'uncursed wand of undead turning (0:30) named reanimator', 'uncursed lichen corpse'),
            identify(), choose('named reanimator', 'd*'), choose('lichen corpse', 'd*')]).flat(),
        ...intrinsic('invisible', 20), ...create('hostile gnomish wizard'), keys('\x14'),
        answer('Where do you want to be teleported?', 'hhhhhh.'), ...wait(20),
        ...wish('uncursed lichen corpse'), identify(), choose('lichen corpse', 'd*'),
        keys('\x14'), answer('Where do you want to be teleported?', 'll.'), choose('scroll of light', 'r*'), ...wait(60)]),
    'r29-unicorn-projectiles': recipe('r29-unicorn-projectiles', 'Receive sling ammunition from hostile hobbits while in unicorn form.', [
        ['unicorn form taken', /turn into a white unicorn/],
        ['sling ammunition reaches hero', /(?:rock|flint stone) (?:hits|misses) you|hit by (?:a|an) (?:rock|flint stone)/],
    ], [...prepare(), ...intrinsic('invulnerable'), ...intrinsic('polymorph control'),
        ...wish('uncursed wand of polymorph (0:5)'), identify(),
        choose('wand of polymorph', 'z*'), answer('In what direction', '.'),
        answer('Become what kind of monster', 'white unicorn\r'),
        ...corner(),
        ...Array.from({ length: 7 }, () => [keys('ml'), ...wish('fountain', 'floor')]).flat(),
        ...Array.from({ length: 8 }, () => [...create('hostile hobbit'), keys('\x14'),
            answer('Where do you want to be teleported?', 'hhhhhh.'), ...wait(8), ...clearMonsters(),
            keys('\x14'), answer('Where do you want to be teleported?', 'llllll.')]).flat()]),
    'r29-drawbridge-terrain': recipe('r29-drawbridge-terrain', 'Change the terrain beneath each Castle approach and operate its drawbridge.', [
        ['drawbridge terrain changed', /(?:Moat|Lava|Ice|Floor) (?:in front of|under) the drawbridge/],
        ['drawbridge operated', /drawbridge (?:coming|going) (?:up|down)/],
    ], [...prepare(150), ...intrinsic('water walking'), ...intrinsic('fire resistance'),
        ...wish('uncursed wand of opening (0:20)', 'uncursed wand of locking (0:20)', 'uncursed ring of levitation'), identify(),
        choose('ring of levitation', 'P*'), answer('Which ring-finger', 'l'),
        choose('castle:', 'm\x16'), ...clearMonsters(),
        keys('mh'.repeat(80) + 'mk'.repeat(21) + 'ml'.repeat(12) + 'mj'.repeat(9)),
        ...wish('pool'), choose('wand of opening', 'z*'), answer('In what direction', 'l'),
        choose('wand of locking', 'z*'), answer('In what direction', 'l'),
        keys('ml'.repeat(53)), ...wish('pool'),
        choose('wand of opening', 'z*'), answer('In what direction', 'h'),
        choose('wand of locking', 'z*'), answer('In what direction', 'h'),
        keys('mh'.repeat(53)), ...wait(150), keys('R'),
        ...Array.from({ length: 6 }, () => [choose('wand of opening', 'z*'), answer('In what direction', 'l'),
            answer('Die?', 'n'), choose('wand of locking', 'z*'), answer('In what direction', '>'),
            answer('Die?', 'n')]).flat()]),
    'r29-shop-overview': recipe('r29-shop-overview', 'Map shallow dungeon levels and inspect remembered shop types.', [
        ['one remembered shop described', /An? (?:general store|(?:\w+ )?shop|delicatessen|used armor dealership|liquor emporium)/],
    ], [...prepare(), ...Array.from({ length: 7 }, (_, index) => [keys('\x16'),
        answer('To what level', `${index + 2}\r`), keys('#wizmap\r#overview\r'), keys('          \x1b')]).flat()]),
    'r29-mimic-discovery': recipe('r29-mimic-discovery', 'Let a sleeping gold-seeker wake and discover the hero after a mimic meal.', [
        ['hero disguise discovered', /That (?:gold|pile|coin)[^\n]* is really/],
    ], [...prepare(), ...corner(), keys('ml'), ...wish('fountain', 'floor'), keys('mh'),
        ...Array.from({ length: 8 }, () => [...wish('uncursed small mimic corpse'), identify(),
            ...create('hostile sleeping ogre'), choose('small mimic corpse', 'me*'), ...wait(40),
            ...clearMonsters()]).flat()]),
};

function recipe(name: string, description: string, evidence: readonly Effect[], actions: SessionAction[]): Recipe {
    effects[name] = evidence;
    return { roles: ['wizard'],
        options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips', 'pettype:none', 'debug_hunger'],
        description, success: evidence.map(([effect]) => effect),
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(),
            driver: [...actions, keys('\x1b:\x1b')] }],
    };
}

export function validateRound29Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const evidence = effects[name];
    if (!evidence) throw new Error(`Unknown round-29 recipe ${name}`);
    const screens = session.segments.flatMap(segment => segment.steps ?? []).map(step =>
        step.screen.replace(/\x1b\[(\d+)C/g, (_match, count: string) => ' '.repeat(Number(count)))
            .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const checks: RecipeCheck[] = [
        { check: 'recorded live game', ok: session.version === 5 && session.segments.length === 1
            && session.segments.every(segment => (segment.steps?.length ?? 0) >= 2), evidence: '' },
        ...evidence.map(([check, pattern]) => ({ check, ok: pattern.test(text), evidence: '' })),
    ];
    if (name === 'r29-confined-worm') checks.push({
        check: 'stationary worm loses health',
        ok: [...text.matchAll(/Status of (?:the )?long worm[^\n]*HP (\d+)\((\d+)\)/g)]
            .some(match => Number(match[1]) < Number(match[2])),
        evidence: '',
    });
    if (name === 'r29-unicorn-projectiles') checks.push({
        check: 'ammunition reaches the unicorn form',
        ok: screens.some(screen => /White Unicorn/.test(screen)
            && /(?:rock|flint stone) (?:hits|misses) you|hit by (?:a|an) (?:rock|flint stone)/.test(screen)),
        evidence: '',
    });
    return checks;
}

function prepare(wallTurns = 5000): SessionAction[] {
    return [keys('#levelchange\r'), answer('To what experience level', '20\r'),
        ...wish('blessed scroll of genocide'), identify(), choose('of genocide', 'r*'), answer('What class of monsters', '*\r'),
        ...intrinsic('pass thru walls', wallTurns), keys('ml'), ...wish('fountain', 'floor')];
}
function clearMonsters(): SessionAction[] { return [...wish('blessed scroll of genocide'), identify(),
    choose('of genocide', 'r*'), answer('What class of monsters', '*\r')]; }
function corner(): SessionAction[] {
    return [keys('mh'.repeat(80) + 'mk'.repeat(21)), ...wish('fountain', 'floor')];
}
function intrinsic(property: string, turns = 5000): SessionAction[] {
    const page = property === 'invulnerable' || property === 'monster detection' ? '' : ' ';
    return [keys(`#wizintrinsic\r${page}${turns}`), choose(property, ''), keys('\r')];
}
function create(monster: string): SessionAction[] { return [keys('\x07'), answer('Create what kind of monster', `${monster}\r`), answer('Creating ', 'y')]; }
function wish(...items: string[]): SessionAction[] { return items.flatMap(item => [keys('\x17'), answer('For what do you wish?', `${item}\r`)]); }
function wait(turns: number): SessionAction[] {
    return Array.from({ length: turns }, () => [keys('m.'), answer('Die?', 'n'), answer('Call a ', '\r')]).flat();
}
function identify(): SessionAction { return keys('\t\t\r'); }
function choose(target: string, openKeys: string): SessionAction { return { type: 'select-menu-entry', target, openKeys, dismissMore: true }; }
function answer(prompt: string, value: string): SessionAction { return { type: 'answer-prompt', prompt, value, dismissMore: true }; }
function keys(value: string): SessionAction { return { type: 'keys', value, dismissMore: true }; }
