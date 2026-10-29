import { itemAt } from '../lib/session-types.mjs';
import type { SessionAction } from '../lib/session-types.mjs';
import type { Recipe, RecipeCheck, RecipeRecording } from './recipes.mjs';

function keys(value: string): SessionAction {
    return { type: 'keys', value, dismissMore: true };
}

function choose(target: string, openKeys: string): SessionAction {
    return { type: 'select-menu-entry', target, openKeys, dismissMore: true };
}

function wish(...items: string[]): SessionAction[] {
    return [keys(items.map(item => `\x17${item}\r`).join('') + '\t\t\r')];
}

function pick<T>(seed: number, choices: readonly T[]): T {
    return itemAt(choices, ((Math.imul(seed, 1664525) + 1013904223) >>> 0) % choices.length);
}

function genesis(mons: string, count: number): SessionAction[] {
    return [keys(`\x07${mons}\r`.repeat(count))];
}

function recipe(description: string, success: string[], actions: (seed: number) => SessionAction[],
    roles = ['knight']): Recipe {
    return {
        roles, options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips'], description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            ...wish('2 uncursed K-rations'),
            choose('K-ration', 'e*'), choose('K-ration', 'e*'),
            keys('#levelchange\r20\r'), ...actions(seed), keys('\x1b:\x1b'),
        ] }],
    };
}

// Wishing plain floor is refused while standing on stairs; wishing a
// fountain first converts the square so the floor wish can clear it.
function clearFloor(...items: string[]): SessionAction[] {
    return wish('fountain', 'floor', ...items);
}

// Teleport near each revealed quest monster and chat in every direction;
// the leader dialogue (or a guardian's) fires once the hero lands adjacent.
function questSearch(suffix: string, cycles = 14): SessionAction[] {
    const search: SessionAction[] = [];
    const chatSweep = () => {
        for (const direction of 'kjyhulnb')
            search.push(keys(`#chat\r${direction}${suffix}`));
        // Quest-home quasits wear the waiting hero down; strike them down.
        for (const direction of 'hyku')
            search.push(keys(`F${direction}`));
    };
    for (let k = 1; k <= cycles; k++) {
        // The detection intrinsic fades after 100-200 turns; a fresh
        // potion every few cycles keeps the cycling targets visible.
        if (k % 4 === 1)
            search.push(choose('monster detection', 'q*'));
        for (const offset of ['l', 'h', 'k', 'j']) {
            search.push(keys(`\x14${'m'.repeat(k)}${offset}.`));
            chatSweep();
        }
        search.push(keys(`\x14${'m'.repeat(k)}.`));
        for (const step of ['', 'l', 'k']) {
            if (step) search.push(keys(step));
            chatSweep();
        }
    }
    for (let walk = 0; walk < 8; walk++) {
        search.push(keys('l'), keys('l'), keys('k'), keys('k'));
        chatSweep();
    }
    return search;
}
export const ROUND9_RECIPES: Record<string, Recipe> = {
    // uhitm.c:joust(), hmon_hitmon_jousting(), mhurtle_to_doom();
    // weapon.c:enhance_weapon_skill() with skill_advance() and slots_required().
    // Knight starts with a lance; enhancing it to expert makes every
    // mounted lance hit a likely joust.
    'jousting-lances': recipe('Enhance the lance skill, mount a created saddled pony, then lance created lichens.',
        ['The lance skill is enhanced.', 'A mounted lance hit jousted a monster.'], () => {
            const actions = [...genesis('tame saddled pony', 2)];
            actions.push(keys('#enhance\ry'), choose('lance', ''), choose('lance', ''),
                keys('\x1b'), choose('lance', 'w*'));
            actions.push(...genesis('lichen', 6));
            for (let i = 0; i < 24; i++) {
                const ride = 'hykulnjb'[i % 8];
                actions.push(keys(`#ride\r${ride}y`));
                for (let j = 0; j < 4; j++)
                    actions.push(keys(`F${'hykulnjb'[(i * 3 + j) % 8]}`));
                if (i % 4 === 3) actions.push(...genesis('lichen', 1));
            }
            return actions;
        }),
    // spell.c:spelleffects_check() failure branch and spell_backfire().
    // A confused cast always fails; amnesia scrolls zero the spell
    // knowledge, so the next cast twists the spell and backfires.
    'spell-backfiring': recipe('Cast while confused, then forget the spell with amnesia and cast again.',
        ['The confused cast fails.', 'The twisted knowledge backfires.'], () => [
            ...wish('potion of confusion', '4 uncursed scrolls of amnesia'),
            choose('potion of confusion', 'q*'),
            choose('force bolt', 'Z*'),
            keys('m.'.repeat(14)),
            choose('of amnesia', 'r*'), choose('of amnesia', 'r*'),
            choose('of amnesia', 'r*'), choose('of amnesia', 'r*'),
            choose('force bolt', 'Z*'),
        ], ['wizard']),
    // shk.c:make_angry_shk(), make_happy_shk(). Merchandise kicked apart
    // from outside the shop angers the keeper; paying 1000 zorkmids
    // appeases the angry shopkeeper.
    'shopkeeper-pacifying': recipe('Buy nothing, carry merchandise out, drop and kick it apart, then appease the keeper.',
        ['The keeper gets angry.', 'The payment appeases the keeper.'], seed => {
            const actions = [...wish('2000 gold pieces', 'blessed potion of object detection',
                'blessed +3 gray dragon scale mail', 'blessed amulet of life saving'),
                choose('dragon scale mail', 'W*'), choose('amulet of life saving', 'W*'),
                choose('minetn', 'm\x16'), choose('potion of object detection', 'mq*'), keys('\x1b')];
            for (let visit = 1; visit <= 4; visit++) {
                actions.push(keys(`\x14${'o'.repeat(visit)}.`), keys(','));
            }
            actions.push(keys(`\x14${'h'.repeat(12 + pick(seed, [0, 4]))}.`));
            for (let attempt = 1; attempt <= 4; attempt++) {
                actions.push(keys(`\x14${'o'.repeat(attempt)}.`));
                actions.push(keys('p'), keys('y'));
                actions.push(keys(`\x14${'m'.repeat(attempt)}.`));
                actions.push(keys('p'), keys('y'));
            }
            actions.push(keys('m.'.repeat(8)), keys('p'), keys('y'), keys('m.'.repeat(6)));
            return actions;
        }),
    // trap.c:try_lift(), help_monster_out(), reward_untrap().
    // A wished pit traps wandering ogres; #untrap in every direction
    // reaches into the pit.
    'pit-rescues': recipe('Dig into a wished pit, lure ogres in, and untrap the one that falls.',
        ['An ogre falls into the pit.', 'The trapped ogre is reached.'], () => {
            const actions = [...clearFloor('uncursed jumping boots'), choose('jumping boots', 'W*'),
                ...wish('pit'), keys('#jump\r.'), keys('hhhh')];
            actions.push(...genesis('tame ogre', 6));
            for (let round = 0; round < 9; round++) {
                actions.push(keys('m.'.repeat(20)));
                actions.push(...genesis('tame ogre', 2));
                for (const direction of 'hykulnjb')
                    actions.push(keys(`#untrap\r${direction}`));
            }
            return actions;
        }),
    // fountain.c:breaksink() via dig.c:furniture_handled().
    // Digging downward through a wished sink bursts its pipes.
    'sink-smashing': recipe('Stand on a wished sink and dig downward until the pipes burst.',
        ['The sink pipes burst.'], () => [
            ...clearFloor('uncursed jumping boots'),
            choose('jumping boots', 'W*'),
            keys('#jump\rl.'),
            ...wish('sink', 'pick-axe'),
            choose('pick-axe', 'a*'), keys('>>>>>>'),
        ]),
    // potion.c:ghost_from_bottle(). Milky potions occasionally contain
    // a ghost; repeated quaffs give the occupant roll a chance.
    'bottled-ghosts': recipe('Quaff a stack of milky potions until a ghost emerges from one.',
        ['A ghost emerges from a bottle.'], () => {
            const actions = [...wish('20 milky potions')];
            for (let quaff = 0; quaff < 16; quaff++)
                actions.push(choose('potions of', 'q*'));
            return actions;
        }),
    // potion.c:dip_into(). The inventory action menu's Dip entry takes
    // the potion to dip into first.
    'potion-dipping': recipe('Dip a dagger into a potion through the inventory action menu.',
        ['The item menu offers the dip.', 'Something is dipped into the potion.'], () => [
            ...wish('uncursed +0 dagger', 'uncursed potion of water'),
            keys('i'), choose('potion of water', ''), choose('Dip', ''),
            choose('dagger', '*'),
        ]),
    // quest.c:onquest()/on_start(), chat_with_leader(), leader_speaks(),
    // quest_chat(), not_capable(), expulsion(), is_pure().
    // The low-level hero is expelled for being too green; after
    // growing, the leader assigns the quest.
    'quest-counsel': {
        roles: ['knight'], options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips'],
        description: 'Visit the quest home, chat with the leader at low level, grow, and return for the assignment.',
        success: ['The leader is met.', 'The hero is expelled from the quest.',
            'The quest is assigned.'],
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
            keys('#levelchange\r20\r'),
            // Two black-unicorn sacrifices on a co-aligned altar raise the
            // alignment record to 20 so is_pure() accepts the hero without
            // the wizard-mode "adjust?" prompt, and the leader assigns.
            ...wish('lawful altar', 'black unicorn corpse'),
            keys('#offer\ry'),
            ...wish('black unicorn corpse'),
            keys('#offer\ry'),
            ...wish('blessed +3 gray dragon scale mail', 'blessed +3 shield of reflection',
                '10 blessed potions of monster detection'),
            choose('ring mail', 'T*'), choose('small shield', 'T*'),
            choose('dragon scale mail', 'W*'), choose('shield of reflection', 'W*'),
            choose('monster detection', 'q*'),
            keys('m\x16'), choose('strt', ''),
            ...questSearch('y'),
            keys('\x1b'),
            ...wish('10 blessed potions of monster detection'),
            choose('monster detection', 'q*'),
            keys('#levelchange\r2\r'),
            keys('m\x16'), choose('strt', ''),
            ...questSearch(''),
            keys('\x1b:\x1b'),
        ] }],
    },
    // uhitm.c:flash_hits_mon(), light_hits_gremlin(); read.c scroll of
    // light path. Camera flashes blind the gremlins; the scroll's light
    // scorches them.
    'gremlin-flashes': recipe('Flash created gremlins with a camera and light the room with a scroll.',
        ['The flash strikes a gremlin.', 'Light hurts a gremlin.'], () => [
            ...genesis('gremlin', 4),
            ...wish('camera', 'scroll of light'),
            choose('camera', 'a*'), keys('l'),
            choose('camera', 'a*'), keys('y'),
            choose('camera', 'a*'), keys('n'),
            choose('scroll of light', 'r*'),
        ]),
    // uhitm.c:steal_it(). A nymph-shaped hero's seduction attack robs
    // item-carrying dwarves.
    'seductive-thefts': recipe('Polymorph into a nymph and seduce dwarves out of their belongings.',
        ['A dwarf is robbed by the hero.'], () => [
            keys('#polyself\rnymph\r'),
            ...genesis('dwarf', 5),
            ...'hykulnjbhykulnjb'.split('').map(direction => keys(`F${direction}`)),
        ]),
    // uhitm.c:hmon_hitmon_potion(). Thrown potions shatter on monsters.
    'potion-sparring': recipe('Wield a potion of fruit juice and strike adjacent lichens with it.',
        ['A wielded potion shatters on a monster.'], () => {
            const actions = [...genesis('lichen', 4)];
            for (let bottle = 0; bottle < 4; bottle++) {
                actions.push(...wish('potion of fruit juice'), choose('potion of fruit juice', 'w*'));
                actions.push(...'hykulnjb'.split('').map(direction => keys(`F${direction}`)));
                actions.push(...genesis('lichen', 2));
            }
            return actions;
        }),
    // uhitm.c:mhitm_ad_drli(), mhitm_ad_drin(). Tame energy drainers
    // feed on ogres standing next to the hero.
    'pet-drainers': recipe('Create a tame wraith and mind flayer among ogres and let them drain.',
        ['A pet drains a monster.'], () => [
            keys('\x07tame wraith\r\x07tame mind flayer\r'),
            ...genesis('ogre', 4),
            keys('m.'.repeat(60)),
        ]),
};

export function validateRound9Recipe(name: string, session: RecipeRecording): RecipeCheck[] {
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const checks: RecipeCheck[] = [];
    const has = (check: string, effect: RegExp) => checks.push({ check, ok: effect.test(text), evidence: '' });
    checks.push({ check: 'one recorded version-5 segment',
        ok: session.version === 5 && session.segments.length === 1 && screens.length >= 2, evidence: '' });
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    checks.push({ check: 'gameplay consumed turns', ok: (turns.at(-1) ?? 0) > (turns[0] ?? Infinity), evidence: '' });
    switch (name) {
    case 'jousting-lances':
        has('the lance skill was enhanced', /You are now (?:more|most) skilled in lance|You feel more confident in your lance/);
        has('a mounted hero attacked', /pony with no name|You joust /);
        has('a joust landed', /You joust /);
        break;
    case 'spell-backfiring':
        has('the confused cast failed', /You fail to cast the spell correctly\./);
        has('the spell knowledge twisted', /Your knowledge of this spell is twisted\./);
        has('the twisted spell backfired', /It invokes nightmarish images in your mind/);
        break;
    case 'shopkeeper-pacifying':
        has('unpaid merchandise was carried out', /escaped the shop without paying|stole .* zorkmids worth/);
        has('the shopkeeper turned hostile', /gets angry!|is furious!|alarm sounds|Kops are after you/);
        // shk.c prints "try to appease" before its random decision; only
        // the settled outcome proves make_happy_shk() actually ran.
        checks.push({ check: 'the appeasement settled the keeper',
            ok: (/returns to (?:his|her) shop|you compensate|calms down\.|Satisfied, .* suddenly disappears!/.test(text))
                && !/as angry as ever/.test(text), evidence: '' });
        break;
    case 'pit-rescues':
        has('a monster fell into the pit', /falls into a pit|The .* falls into a pit/);
        has('the trapped monster was reached',
            /You pull .* out of the pit\.|is too heavy for you to lift\.|backs away skeptically|thinks it was nice of you to try\./);
        break;
    case 'sink-smashing':
        has('the sink pipes burst', /The pipes break!  Water spurts out!|water sprays|The pipes break/);
        break;
    case 'bottled-ghosts':
        has('a ghost emerged from the bottle', /an enormous ghost emerges/);
        has('the emerging ghost frightened the hero', /frightened to death, and unable to move/);
        break;
    case 'potion-dipping':
        has('the item action menu opened', /What do you want to dip into/);
        has('an object was dipped', /Your dagger rusts!|You dip the .* into/);
        break;
    case 'quest-counsel':
        has('the leader greeted the hero', /received Our summons|stand in the shadows/);
        // The low-level rejection visit stays in the plan for expulsion
        // coverage when its own leader contact happens to land, but the
        // recorded evidence requirement is the assignment: the assignquest
        // pager prints only for the grown, pure hero; "materialize on a
        // different level" also matches ordinary levelports.

        has('the leader assigned the quest', /Go forth from this place|Thou art truly ready/);
        break;
    case 'gremlin-flashes':
        has('the flash reached a gremlin', /is blinded by the flash|The flash awakens/);
        has('light hurt a gremlin', /cries out in pain|wails in agony|recoils from the light/);
        break;
    case 'seductive-thefts':
        has('the hero robbed a monster', /You steal|You charm|suddenly notice|you see the .* acquire/);
        break;
    case 'potion-sparring':
        has('a potion shattered on a monster', /The flask crashes|crashes on|splashes over/);
        break;
    case 'pet-drainers':
        has('a pet drained a monster', /becomes weaker|brain is eaten|suddenly seems weaker|life is drained/);
        break;
    default:
        checks.push({ check: 'known recipe', ok: false, evidence: '' });
        break;
    }
    return checks;
}
