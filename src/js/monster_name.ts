import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
// C do_name.c:mon_nam()/Monnam(), and mondata.c:pronoun_gender().
// Ordinary definite names and the naming variants used by form changes.

import {
    In_endgame, Is_astralevel, M_AP_MONSTER, M_AP_TYPE, MGIVENNAME, W_SADDLE, ismnum,
} from './const.js';
import { canSpotMonster, randomDisplayMonsterIdentity } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { hallucinatedDeityName } from './alignment.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, SPECIAL_PM,
    monsterIsAnimal, monsterIsHumanoid, monsterIsMindless, monsterIsPlayerMonster,
    monsterTypeName,
} from './monster_data.js';
import { priestAlignment } from './priest.js';
import {
    indefiniteArticlePrefix, makePlural, verbForSubject, withIndefiniteArticle,
} from './object_grammar.js';
import { rn2 } from './rng.js';
import { RANDOM_SHOP_TYPES } from './shop_data.js';
import { roles } from './roles.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';

export type MonsterArticle = 'none' | 'the' | 'a' | 'your';

export interface MonsterNameOptions {
    capitalized?: boolean;
    state?: GameState;
    article?: MonsterArticle;
    adjective?: string;
    suppressIt?: boolean;
    suppressSaddle?: boolean;
    augmentIt?: boolean;
    suppressInvisible?: boolean;
    exact?: boolean;
}

interface NameFormatOptions extends Omit<MonsterNameOptions, 'state' | 'capitalized' | 'exact'> {
    suppressName?: boolean;
    suppressShopkeeper?: boolean;
    suppressHallucination?: boolean;
    suppressAppearance?: boolean;
}

interface PronounOptions {
    state?: GameState;
    random?: (limit: number) => number;
    noIt?: boolean;
}

type PronounGender = 0 | 1 | 2 | 3;
const POSSESSIVE_PRONOUNS: readonly [string, string, string, string] = ['his', 'her', 'its', 'their'];
const SUBJECT_PRONOUNS: readonly [string, string, string, string] = ['he', 'she', 'it', 'they'];
const OBJECT_PRONOUNS: readonly [string, string, string, string] = ['him', 'her', 'it', 'them'];
const REFLEXIVE_PRONOUNS: readonly [string, string, string, string] = ['himself', 'herself', 'itself', 'themselves'];

const G_UNIQ = 0x1000;
const M2_NEUTER = 0x00040000;
const M2_PNAME = 0x00080000;
const PM_GHOST = MONSTER_NAME.indexOf('ghost');
const PM_SHOPKEEPER = MONSTER_NAME.indexOf('shopkeeper');
const PM_ALIGNED_CLERIC = MONSTER_NAME.indexOf('aligned cleric');
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const PM_WIZARD_OF_YENDOR = MONSTER_NAME.indexOf('Wizard of Yendor');

// C shknam.c:shkname()/Shknam(). The scratch monster name consumes display
// RNG before the hallucinated shop type and name consume the core stream.
export function shopkeeperName(monster: Monster, { state = game, capitalized = false }: Pick<MonsterNameOptions, 'state' | 'capitalized'> = {}): string {
    requireLiveGame(state);
    formatMonsterName(monster, state, {
        article: 'your', suppressIt: true, suppressShopkeeper: true,
    });
    let raw = monster.eshk?.shknam || monster.name || 'shopkeeper';
    if (heroIsHallucinating(state) && !state.program_state?.gameover) {
        const shop = RANDOM_SHOP_TYPES[rn2(RANDOM_SHOP_TYPES.length)];
        if (!shop) throw new RangeError('Shop-name selection is outside the shop table.');
        const name = shop.names[rn2(shop.names.length)];
        if (name === undefined) throw new RangeError('Shopkeeper name selection is outside its name table.');
        raw = name;
    }
    const name = /^[^A-Za-z]/.test(raw) ? raw.slice(1) : raw;
    return capitalized ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

// C mcastu.c:death_inflicted_by(). This names the real species, not a
// perceived identity, priest title, shopkeeper name, or given name.
export function monsterSpellDeathReason(monster: Monster, reason: string): string {
    const current = monster.mnum;
    const base = ismnum(monster.cham) ? monster.cham : current;
    const unique = current === PM_WIZARD_OF_YENDOR
        || (!((MONSTER_FLAGS2[current] ?? 0) & M2_PNAME)
            && !!((MONSTER_GENO[current] ?? 0) & G_UNIQ)
            && current !== PM_HIGH_CLERIC && current !== SPECIAL_PM);
    let name = monsterTypeName(base, monster.female);
    if (!((MONSTER_FLAGS2[base] ?? 0) & M2_PNAME) && !unique)
        name = withIndefiniteArticle(name);
    let killer = `${reason} inflicted by ${unique ? 'the ' : ''}${name}`;
    if (base !== current) {
        const form = monsterTypeName(current, monster.female);
        killer += ` imitating ${withIndefiniteArticle(form)}`;
    }
    return killer;
}

function possessiveMonsterName(name: string) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// C do_name.c:x_monnam()/distant_monnam().  Species identity comes from
// mnum; `monster.name` is the optional C given-name extension.
export function monsterInstanceDisplayName(monster: Monster) {
    if (monster?.name && monster.mnum === PM_GHOST)
        return `${possessiveMonsterName(monster.name)} ghost`;
    if (monster?.name) return monster.name;
    return monsterTypeName(monster?.mnum, !!monster?.female);
}

export function quietMonsterName(monster: Pick<Monster, 'mnum' | 'female' | 'saddled'>): string {
    const name = monsterTypeName(monster?.mnum, !!monster?.female);
    return monster?.saddled ? `saddled ${name}` : name;
}

export function monsterName(monster: Monster, {
    capitalized = false, state = game, article = 'the', adjective = '',
    suppressIt = false, suppressSaddle = !!MGIVENNAME(monster), augmentIt = false,
    suppressInvisible = false, exact = false,
}: MonsterNameOptions = {}): string {
    requireLiveGame(state);
    const name = formatMonsterName(monster, state, {
        article, adjective, suppressIt: suppressIt || exact,
        suppressSaddle: suppressSaddle || exact, augmentIt,
        suppressInvisible: suppressInvisible || exact,
        suppressHallucination: exact, suppressAppearance: exact,
    });
    return capitalized ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

// C newcham(): YMonnam with the saddle always suppressed.
export function monsterFormChangeName(monster: Monster, { state = game }: { state?: GameState } = {}): string {
    requireLiveGame(state);
    const name = formatMonsterName(monster, state, {
        article: 'your', suppressSaddle: true,
    });
    return name.charAt(0).toUpperCase() + name.slice(1);
}

// C noname_monnam(monster, ARTICLE_NONE).
export function namelessMonsterName(monster: Monster, {
    state = game, article = 'none', suppressIt = false, suppressInvisible = false,
}: Pick<MonsterNameOptions, 'state' | 'article' | 'suppressIt' | 'suppressInvisible'> = {}): string {
    requireLiveGame(state);
    return formatMonsterName(monster, state, {
        article, suppressName: true, suppressSaddle: false, suppressIt, suppressInvisible,
    });
}

function formatMonsterName(monster: Monster, state: GameState, {
    adjective = '', article = 'the', suppressName = false,
    suppressSaddle = !!MGIVENNAME(monster), suppressIt = false,
    suppressShopkeeper = false, augmentIt = false, suppressInvisible = false,
    suppressHallucination = false, suppressAppearance = false,
}: NameFormatOptions = {}): string {
    const gameover = !!state.program_state?.gameover;
    const engulfing = state.u.uswallow && state.u.ustuck === monster;
    if (article === 'your' && !monster.mtame) article = 'the';
    if (engulfing) article = 'the';
    const hallucinating = !suppressHallucination && heroIsHallucinating(state) && !gameover;
    if (!suppressIt && !canSpotMonster(monster) && article !== 'your' && !gameover
        && monster !== state.u.usteed && !engulfing) {
        if (!augmentIt) return 'it';
        const someone = hallucinating ? !rn2(2)
            : monsterIsHumanoid(monster.mnum) && !monsterIsAnimal(monster)
                && !monsterIsMindless(monster.mnum);
        return someone ? 'someone' : 'something';
    }

    const invisible = !!monster.minvis && !engulfing && !suppressInvisible;
    const mimicking = !suppressAppearance && M_AP_TYPE(monster) === M_AP_MONSTER;
    if ((monster.ispriest || monster.isminion) && !mimicking) {
        const name = priestName(monster, { article, hallucinating, invisible, state });
        return article === 'none' ? name.replace(/^the /, '') : name;
    }

    let displayedSpecies = monster.mnum;
    if (mimicking) {
        if (monster.mappearance === undefined)
            throw new Error(`Monster ${monster.m_id} has no species for its monster disguise.`);
        displayedSpecies = monster.mappearance;
    }
    const typeName = monsterTypeName(displayedSpecies, monster.female);
    if (monster.isshk && !suppressShopkeeper && !hallucinating && !mimicking) {
        const name = shopkeeperName(monster, { state });
        if (adjective && article === 'the') return `the ${adjective} ${name}`;
        return monster.mnum === PM_SHOPKEEPER && !invisible ? name
            : `${name} the ${invisible ? 'invisible ' : ''}${typeName}`;
    }

    const givenName = !suppressName || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME)
        ? MGIVENNAME(monster) : null;
    let adjectives = adjective ? `${adjective} ` : '';
    if (invisible) adjectives += 'invisible ';
    if (!suppressSaddle && ((monster.misc_worn_check ?? 0) & W_SADDLE)
        && !heroIsBlind(state) && !heroIsHallucinating(state))
        adjectives += 'saddled ';

    let name;
    let personal;
    if (hallucinating) {
        const identity = randomDisplayMonsterIdentity();
        name = identity.name;
        personal = identity.personal;
    } else if (givenName) {
        personal = true;
        if (monster.mnum === PM_GHOST) {
            name = `${possessiveName(givenName)} ghost`;
        } else if (monsterIsPlayerMonster(monster.mnum)
            && / the /i.test(givenName)) {
            // A player monster's adjectives belong after its own "the".
            return givenName.replace(/ the /i, match => match + adjectives);
        } else {
            name = givenName;
        }
    } else if (monsterIsPlayerMonster(monster.mnum) && !In_endgame(state.u.uz)) {
        name = monsterRank(monster, state).toLowerCase();
        personal = false;
    } else {
        name = typeName;
        personal = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME);
    }
    if (personal && (article === 'your' || !adjectives))
        article = monster.mnum === PM_WIZARD_OF_YENDOR ? 'the' : 'none';
    else if (((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) && article === 'a')
        article = 'the';
    const description = adjectives + name;
    if (article === 'a') return withIndefiniteArticle(description);
    return (article === 'none' ? '' : `${article} `) + description;
}

function monsterRank(monster: Monster, state: GameState): string {
    const role = roles.find(candidate =>
        SPECIAL_PM + 1 + candidate.mnum === monster.mnum) || state.urole;
    if (!role) throw new Error('Naming a player monster requires an initialized hero role.');
    const level = monster.m_lev;
    const rank = level <= 2 ? 0 : level <= 30 ? Math.trunc((level + 2) / 4) : 8;
    for (let index = rank; index >= 0; index--) {
        const title = role.title[index];
        if (monster.female && title?.f) return title.f;
        if (title?.m) return title.m;
    }
    return monster.female && role.name.f || role.name.m || 'Player';
}

export function possessiveName(name: string): string {
    if (name.toLowerCase() === 'it') return name + 's';
    if (name.toLowerCase() === 'you') return name + 'r';
    return name + (name.endsWith('s') ? "'" : "'s");
}

// C priest.c:priestname().
function priestName(monster: Monster, { article, hallucinating, invisible, state }: {
    article: MonsterArticle; hallucinating: boolean; invisible: boolean; state: GameState;
}): string {
    const aligned = monster.mnum === PM_ALIGNED_CLERIC;
    const high = monster.mnum === PM_HIGH_CLERIC;
    // Even a priest whose hallucinated species is replaced by "poohbah"
    // consumes rndmonnam, and its proper-name marker still controls "the".
    const identity = hallucinating ? randomDisplayMonsterIdentity() : null;
    let name = identity?.name || monsterTypeName(monster.mnum, monster.female);
    if (monster.ispriest || aligned || high)
        name = hallucinating ? 'poohbah' : monster.female ? 'priestess' : 'priest';
    let prefix = '';
    if (article !== 'none' && !identity?.personal) {
        if (article === 'your' || (article === 'a' && high)) article = 'the';
        prefix = article === 'the' ? 'the ' : indefiniteArticlePrefix(name);
    }
    if (invisible) {
        if (prefix === 'a ') prefix = 'an ';
        prefix += 'invisible ';
    }
    const minion = monster.emin || monster.mextra?.emin;
    if (monster.isminion && !minion)
        throw new Error(`Minion ${monster.m_id} has no minion data for its title.`);
    if (monster.isminion && minion?.renegade) {
        if (prefix === 'an ' && !invisible) prefix = 'a ';
        prefix += 'renegade ';
    }
    if (monster.ispriest || aligned) {
        if (high) prefix += hallucinating ? 'grand ' : 'high ';
    } else if (monster.mtame && name.toLowerCase() === 'angel') {
        prefix += 'guardian ';
    }
    const nearby = Math.abs(monster.mx - state.u.ux) <= 1
        && Math.abs(monster.my - state.u.uy) <= 1;
    if (hallucinating || !high || !Is_astralevel(state.u.uz)
        || nearby || state.program_state?.gameover)
        name += ` of ${hallucinatedDeityName(priestAlignment(monster), state, hallucinating)}`;
    return prefix + name;
}

// C mhis(): hallucination precedes visibility and sex and uses the core RNG.
export function monsterPossessive(monster: Monster, { state = game, random = rn2, noIt = false }: PronounOptions = {}): string {
    return POSSESSIVE_PRONOUNS[monsterPronounGender(monster, { state, random, noIt })];
}

export function monsterSubjectPronoun(monster: Monster, { state = game }: { state?: GameState } = {}): string {
    return SUBJECT_PRONOUNS[monsterPronounGender(monster, { state })];
}

// C mhim()/noit_mhim(): the same perceived gender, in the object case.
export function monsterObjectPronoun(monster: Monster, { state = game, noIt = false }: PronounOptions = {}): string {
    return OBJECT_PRONOUNS[monsterPronounGender(monster, { state, noIt })];
}

// C do_name.c:monverbself(). Obtain the displayed name before choosing a
// hallucinated pronoun, since the two use distinct random streams.
export function monsterReflexiveAction(monster: Monster, name: string, verb: string, otherText = '', { state = game }: { state?: GameState } = {}): string {
    const reflexive = REFLEXIVE_PRONOUNS[monsterPronounGender(monster, { state })];
    const action = verbForSubject(reflexive, verb);
    if (action === verb) {
        name = makePlural(name);
        if (name.toLowerCase() === 'they') name = name[0] === 'T' ? 'Them' : 'them';
    }
    return `${name} ${action}${otherText ? ` ${otherText}` : ''} ${reflexive}`;
}

function monsterPronounGender(monster: Monster, { state = game, random = rn2, noIt = false }: PronounOptions = {}): PronounGender {
    requireLiveGame(state);
    if (heroIsHallucinating(state)) {
        const gender = random(4);
        if (gender === 0 || gender === 1 || gender === 2 || gender === 3) return gender;
        throw new RangeError(`Invalid hallucinated pronoun gender: ${gender}`);
    }
    if ((!noIt && !canSpotMonster(monster)) || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER))
        return 2;
    return monsterIsHumanoid(monster.mnum)
        || ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)
        || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME)
        ? monster.female ? 1 : 0 : 2;
}
