// C read.c:create_particular(), create_particular_parse(), and
// create_particular_creation(). The caller owns the command's turn.
import { COLNO, MM_FEMALE, MM_MALE, MM_MINVIS, MM_NOEXCLAM, ROWNO } from './const.js';
import { canSpotMonster, flashGlyphAt, newsym, plineWithContinuation,
    transientMonsterGlyph } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { mkclassAligned, makemonNear, rndmonstAdj } from './mklev.js';
import { nameToMonsterClass, resolveMonsterName } from './mondata.js';
import type { MonsterNameGender } from './mondata.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL,
    requireMonsterData } from './monster_data.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { tameMonster } from './monster_taming.js';
import { setMonsterMalign } from './monster_alignment.js';
import { getLine, promptYesNo } from './query.js';
import { revivalReplacement } from './revival_species.js';
import { monsterSaddle, putSaddleOnMonster } from './steed.js';
import { isPoolAt } from './terrain_properties.js';
import { couldsee } from './vision.js';
import type { Monster } from './monster_types.js';

type Gender = -1 | MonsterNameGender;
type MonsterChoice = { kind: 'species'; species: number; gender: MonsterNameGender }
    | { kind: 'class'; monsterClass: number }
    | { kind: 'random' };
interface CreationRequest {
    quantity: number;
    choice: MonsterChoice;
    gender: Gender;
    genderConflict: boolean;
    disposition: 'tame' | 'peaceful' | 'hostile' | null;
    saddled: boolean;
    sleeping: boolean;
    invisible: boolean;
    hidden: boolean;
}

const PM_STALKER = MONSTER_NAME.indexOf('stalker');

export async function createParticularMonster(): Promise<boolean> {
    requirePlayingGame(game);
    let prompt = 'Create what kind of monster?';
    let explainedEmptyInput = false;
    for (let attempt = 0; attempt < 5; attempt++) {
        const response = await getLine(prompt, (_ch, key) => key >= 32 && key < 127);
        if (response === null || response.startsWith('\u001b')) return false;
        const text = response.trim().replace(/\s+/g, ' ');
        const request = parseCreationRequest(text);
        if (request) return createRequestedMonsters(request);
        if (text || explainedEmptyInput || attempt === 4)
            await plineWithContinuation("I've never heard of such monsters.");
        else {
            await plineWithContinuation('Try again (type * for random, ESC to cancel).');
            explainedEmptyInput = true;
        }
        prompt = 'Create what kind of monster? [type name or symbol]';
    }
    await plineWithContinuation("That's enough tries!");
    return false;
}

function parseCreationRequest(text: string): CreationRequest | null {
    const explicitQuantity = /^(\d+) */u.exec(text);
    let quantity = explicitQuantity ? Number.parseInt(explicitQuantity[1] ?? '', 10)
        : 1 + Math.max(game.multi, 0);
    const limit = ROWNO * (COLNO - 1);
    if (quantity < 1 || quantity > limit) quantity = limit - monsterCensus();
    let name = explicitQuantity ? text.slice(explicitQuantity[0].length) : text;
    // Native removes one occurrence of each modifier before lookup. Checking
    // female first prevents the embedded "male " from being mistaken for it.
    const modifiers = new Set<string>();
    for (const modifier of ['saddled', 'sleeping', 'invisible', 'hidden', 'female', 'male']) {
        const pattern = new RegExp(`${modifier} `, 'i');
        if (pattern.test(name)) {
            modifiers.add(modifier);
            name = name.replace(pattern, ' '.repeat(modifier.length + 1));
        }
    }
    name = name.trim().replace(/\s+/g, ' ');
    let disposition: CreationRequest['disposition'] = null;
    for (const candidate of ['tame', 'peaceful', 'hostile'] as const) {
        if (name.toLowerCase().startsWith(`${candidate} `)) {
            disposition = candidate;
            name = name.slice(candidate.length + 1);
            break;
        }
    }
    const choice = monsterChoice(name);
    if (!choice) return null;
    const namedGender = choice.kind === 'species' ? choice.gender : -1;
    const explicitGender = modifiers.has('male') ? 0 : modifiers.has('female') ? 1 : null;
    return {
        quantity, choice, disposition,
        gender: explicitGender ?? namedGender,
        genderConflict: explicitGender !== null && namedGender !== -1
            && namedGender !== 2 && explicitGender !== namedGender,
        saddled: modifiers.has('saddled'), sleeping: modifiers.has('sleeping'),
        invisible: modifiers.has('invisible'), hidden: modifiers.has('hidden'),
    };
}

function monsterChoice(name: string): MonsterChoice | null {
    if (game.flags.debug && (name === '*' || name === 'random')) return { kind: 'random' };
    const match = resolveMonsterName(name);
    if (match) return { kind: 'species', species: match.mnum, gender: match.gender };
    if (name === '~') return { kind: 'species', species: 114, gender: 2 }; // long worm
    if (name === 'I') return { kind: 'species', species: PM_STALKER, gender: 2 };
    const monsterClass = nameToMonsterClass(name);
    if (monsterClass === 35) return { kind: 'species', species: PM_STALKER, gender: 2 };
    if (monsterClass === 59) return { kind: 'species', species: 114, gender: 2 };
    return monsterClass > 0 ? { kind: 'class', monsterClass } : null;
}

async function createRequestedMonsters(request: CreationRequest): Promise<boolean> {
    requirePlayingGame(game);
    const firstChoice = request.choice.kind === 'species' ? request.choice.species
        : request.choice.kind === 'class' ? game.u.umonster : -1;
    let species = firstChoice;
    if (request.choice.kind === 'species') {
        const replacement = revivalReplacement(species, null, false);
        if (replacement !== null) {
            species = replacement;
            if (firstChoice !== 330) {
                const answer = await promptYesNo(`Creating ${requireMonsterData(MONSTER_NAME, species)} instead; force ${requireMonsterData(MONSTER_NAME, firstChoice)}?`);
                if (answer === 'y') species = firstChoice;
            }
        }
    }
    let madeAny = false;
    for (let index = 0; index < request.quantity; index++) {
        const selected = request.choice.kind === 'class' ? mkclassAligned(request.choice.monsterClass)
            : request.choice.kind === 'random' ? rndmonstAdj() : species;
        const flags = creationFlags(request, selected);
        const monster = await makemonNear(selected, game.u.ux, game.u.uy, flags);
        if (!monster) {
            if (request.choice.kind === 'species') break;
            continue;
        }
        if (request.disposition === 'tame') await tameMonster(monster);
        else if (request.disposition) {
            monster.mtame = 0;
            monster.pet = false;
            monster.mpeaceful = request.disposition === 'peaceful' ? 1 : 0;
            setMonsterMalign(monster);
        }
        if (request.saddled && !monsterSaddle(monster)) await putSaddleOnMonster(null, monster);
        if (request.hidden && canHideCreatedMonster(monster)) monster.mundetected = 1;
        if (request.sleeping) monster.msleeping = 1;
        if ((request.hidden || request.invisible) && !canSpotMonster(monster))
            await flashCreatedMonster(monster);
        madeAny = true;
        if (monster.cham !== undefined && monster.cham >= 0 && firstChoice >= 0
            && monster.cham !== firstChoice) await changeMonsterForm(monster, firstChoice);
    }
    return madeAny;
}

function creationFlags(request: CreationRequest, species: number | null): number {
    const fixedGender = species !== null && (requireMonsterData(MONSTER_FLAGS2, species) & 0x00030000);
    const setGender = request.genderConflict || !fixedGender;
    const gender = setGender && request.gender === 1 ? MM_FEMALE
        : setGender && request.gender === 0 ? MM_MALE : 0;
    return gender | (request.genderConflict ? 0 : MM_NOEXCLAM)
        | (request.invisible ? MM_MINVIS : 0);
}

function canHideCreatedMonster(monster: Monster): boolean {
    const traits = requireMonsterData(MONSTER_FLAGS1, monster.mnum);
    const symbol = requireMonsterData(MONSTER_SYMBOL, monster.mnum);
    return !!(traits & 0x00000100) && symbol !== 13
        || !!(traits & 0x00000080) && !!game.level?.objects[monster.mx]?.[monster.my]?.length
        || symbol === 57 && isPoolAt(monster.mx, monster.my);
}

async function flashCreatedMonster(monster: Monster): Promise<void> {
    let count = couldsee(monster.mx, monster.my) ? 8 : 4;
    if (!game.flags.sparkle) count /= 2;
    const row = game.viz_array?.[monster.my];
    const saved = row?.[monster.mx];
    if (!row || saved === undefined) throw new Error('A created monster needs its visibility cell');
    row[monster.mx] = saved | 3;
    try {
        await flashGlyphAt(monster.mx, monster.my, transientMonsterGlyph(monster), count);
    } finally {
        row[monster.mx] = saved;
        newsym(monster.mx, monster.my);
    }
}

function monsterCensus(): number {
    return game.level?.monsters.filter(monster => monster.mhp > 0
        && !(monster.isgd && monster.mx === 0)).length ?? 0;
}
