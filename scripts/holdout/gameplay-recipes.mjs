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
function moveToFloor() {
    // Changing the terrain under stairs leaves their separate stairway
    // record in place. Teleport away before preparing ordinary room floor.
    return [keys('\x14l.'), ...wish('fountain', 'floor')];
}
function pick(seed, choices) {
    return itemAt(choices, ((Math.imul(seed, 1664525) + 1013904223) >>> 0) % choices.length);
}
function recipe(description, success, actions, roles = ['knight']) {
    return {
        roles, options: ['playmode:debug', '!autopickup', '!menu_overlay', '!tips'], description, success,
        build: ({ seed, datetime, rc }) => [{ seed, datetime, nethackrc: rc(), driver: [
                    // Extra HP lets harmful effects finish without a wizard death prompt.
                    keys('#levelchange\r20\r'), ...actions(seed), keys('\x1b:\x1b'),
                ] }],
    };
}
const FORMS = ['shrieker', 'giant spider', 'mind flayer'];
const SPELLS = [
    { name: 'healing', direction: '.' },
    { name: 'cure sickness', direction: '' },
    { name: 'protection', direction: '' },
    { name: 'haste self', direction: '' },
    { name: 'extra healing', direction: '.' },
];
export const GAMEPLAY_RECIPES = {
    'lock-cycle': recipe('Unlock and relock a seeded empty chest or box with a key or lock pick.', ['The container is unlocked.', 'The same container is locked again.'], seed => {
        const box = pick(seed, ['chest', 'large box']);
        const tool = pick(seed + 1, ['skeleton key', 'lock pick']);
        return [...wish(`uncursed empty untrapped locked ${box}`, `uncursed ${tool}`),
            choose(box, 'd*'), choose(tool, 'a*'), keys('.y'),
            choose(tool, 'a*'), keys('.y')];
    }),
    'force-lock': recipe('Force a seeded locked container with a blunt weapon, exercising bashing and container breakage.', ['Bashing begins.', 'The lock is successfully forced.'], seed => {
        const box = pick(seed, ['chest', 'large box']);
        const weapon = pick(seed + 1, ['war hammer', 'mace', 'morning star']);
        return [...wish(`uncursed empty untrapped locked ${box}`, `uncursed +3 ${weapon}`),
            choose(box, 'd*'), choose(weapon, 'w*'), keys('#force\ry')];
    }),
    'digging-holes': recipe('Dig a pit with a seeded pick, then zap digging downward to open a hole and fall through.', ['Digging downward begins.', 'A pit is dug.', 'A hole is dug through the floor.'], seed => {
        const tool = pick(seed, ['pick-axe', 'dwarvish mattock']);
        const actions = [...moveToFloor(), ...wish(`uncursed +2 ${tool}`, 'uncursed wand of digging')];
        // A mattock needs both hands, so remove the starting shield.
        actions.push(choose('small shield', 'T*'), choose(tool, 'w*'));
        for (let attempt = 0; attempt < 8; attempt++)
            actions.push(choose(tool, 'a*'), keys('>'));
        actions.push(choose('wand of digging', 'z*'), keys('>'));
        return actions;
    }),
    'trap-disarming': recipe('Reveal and disarm a seeded arrow or dart trap, retaining ordinary failed-disarm effects.', ['The selected shooting trap is created.', 'A trap is successfully disarmed.'], seed => {
        const trap = pick(seed, ['arrow trap', 'dart trap']);
        return [...moveToFloor(), ...wish(trap), keys('\x06' + '#untrap\r.'.repeat(10))];
    }),
    'polymorph-abilities': recipe('Become a seeded monster, use its active ability, and return to the Knight form.', ['The hero changes into a monster.', 'The monster ability produces an effect.', 'The hero returns to human form.'], seed => {
        const form = pick(seed, FORMS);
        return [...moveToFloor(),
            keys(`#polyself\r${form}\r#monster\r#polyself\rknight\r.`)];
    }),
    'artifact-invoking': recipe('Invoke the Heart of Ahriman on, off, and during its cooldown, varying its beatitude.', ['Levitation starts.', 'Levitation ends.', 'The tired artifact refuses reinvocation.'], seed => {
        const blessing = pick(seed, ['blessed', 'uncursed']);
        return [...wish(`${blessing} the Heart of Ahriman`),
            choose('Heart of Ahriman', '#invoke\r*'),
            choose('Heart of Ahriman', '#invoke\r*'),
            choose('Heart of Ahriman', '#invoke\r*')];
    }, ['barbarian']),
    'spell-variety': recipe('Learn two seeded blessed spellbooks and cast their spells using the native wizard spell menu.', ['Two spells enter the repertoire.', 'Both spells produce their effects.'], seed => {
        const first = pick(seed, SPELLS);
        const second = pick(seed + 1, SPELLS.filter(spell => spell !== first));
        const actions = wish(`blessed spellbook of ${first.name}`, `blessed spellbook of ${second.name}`);
        for (const spell of [first, second]) {
            // Monster sightings may interrupt study. Resume the book;
            // ESC declines a refresh if an earlier attempt learned it.
            for (let attempt = 0; attempt < 6; attempt++)
                actions.push(choose(`spellbook of ${spell.name}`, 'r*'), keys('\x1b'));
            actions.push(choose(spell.name, '#wizcast\r'));
            if (spell.direction)
                actions.push(keys(spell.direction));
        }
        return actions;
    }),
    'fountain-dipping': recipe('Wash hands in a seeded ordinary or magic fountain, then drink from a magic fountain.', ['Hands are washed in fountain water.', 'Drinking refreshes hunger or improves attributes.'], seed => [
        // ESC also declines the conditional wizard dry-up question.
        ...wish(pick(seed, ['fountain', 'magic fountain'])), keys('#dip\r-y\x1b'),
        ...wish('magic fountain'), keys('qy'),
    ]),
    'riding-cycle': recipe('Try nearby directions in a seeded order, mount the Knight\'s saddled pony, and dismount.', ['The pony is mounted.', 'The hero dismounts.'], seed => {
        const directions = pick(seed, ['hykulnjb', 'lnjbhyku', 'jbhykuln', 'kulnjbhy']);
        // Decline wizard force-mounting. After a failed attempt, the
        // second #ride prompts for a direction and ESC cancels it.
        // After success it dismounts immediately; the ESC is harmless.
        return [keys([...directions].map(direction => `#ride\r${direction}n#ride\r\x1b`).join(''))];
    }),
};
export function validateGameplayRecipe(name, session) {
    const screens = (session.segments[0]?.steps ?? []).map(step => step.screen
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x0e\x0f]/g, ''));
    const text = screens.join('\n');
    const checks = [];
    const require = (check, ok) => { checks.push({ check, ok, evidence: '' }); };
    const has = (check, effect) => require(check, effect.test(text));
    require('one recorded version-5 segment', session.version === 5 && session.segments.length === 1 && screens.length >= 2);
    const turns = screens.flatMap(screen => [...screen.matchAll(/\bT:(\d+)/g)].map(match => Number(match[1])));
    require('gameplay consumed turns', (turns.at(-1) ?? 0) > (turns[0] ?? Infinity));
    switch (name) {
        case 'lock-cycle':
            has('container unlocked', /You succeed in (?:unlocking|picking).*\b(?:chest|box|lock)/);
            has('container locked again', /You succeed in locking/);
            break;
        case 'force-lock':
            has('bashing started', /You start bashing it with/);
            has('lock forced', /You succeed in forcing the lock/);
            break;
        case 'digging-holes':
            has('downward digging started', /You (?:start|continue) digging downward/);
            has('pit dug', /You dig a pit in the (?:floor|ground)/);
            has('hole dug', /You dig a hole through the (?:floor|ground)/);
            break;
        case 'trap-disarming':
            has('shooting trap created', /An? (?:dart|arrow) trap\./);
            has('trap disarmed', /You disarm (?:the|your) (?:dart trap|arrow trap|trap)\./);
            break;
        case 'polymorph-abilities':
            has('monster form taken', /You turn into (?:a|an) /);
            has('active monster ability used', /You shriek\.|You (?:spin a web|make the web thicker)\.|A wave of psychic energy pours out/);
            has('human form restored', /You return to human form/);
            break;
        case 'artifact-invoking':
            has('levitation started', /You float up|You start to float in the air/);
            has('levitation ended', /You float gently to the (?:floor|ground|stairs)/);
            has('cooldown refused reinvocation', /Heart of Ahriman is ignoring you/);
            break;
        case 'spell-variety': {
            const learned = new Set([...text.matchAll(/You (?:add|learn) "([a-z ]+)"/g)].map(match => match[1]));
            require('two spells learned', learned.size >= 2);
            const effects = /(?:You feel (?:better|much better)|You are (?:not|no longer) ill|You (?:speed up|are suddenly moving)|golden (?:haze|glow)|skin feels warm|lit field surrounds)/i;
            let casting = false, completed = 0;
            for (const screen of screens) {
                if (/Cast which spell\?/.test(screen))
                    casting = true;
                else if (/Never mind\.|What do you want to /.test(screen))
                    casting = false;
                else if (casting && effects.test(screen)) {
                    completed++;
                    casting = false;
                }
            }
            require('two spell effects observed', completed >= 2);
            break;
        }
        case 'fountain-dipping':
            has('hands washed', /You wash your (?:gloved )?hands in the water/);
            has('fountain drink completed', /cool draught refreshes you|Wow!\s+This makes you feel great/);
            break;
        case 'riding-cycle':
            has('pony mounted', /You mount (?:the |your )?(?:saddled )?pony/);
            has('pony dismounted', /You dismount|You've been through the dungeon on a pony with no name/);
            break;
    }
    return checks;
}
//# sourceMappingURL=gameplay-recipes.mjs.map