// C pager.c:self_lookat(), look_at_monster(), monhealthdescr(). Native
// monhealthdescr() is disabled, so wounded creatures have no health prefix.
import {
    BEAR_TRAP, M_AP_FURNITURE, M_AP_OBJECT, MONSEEN_NORMAL,
    MONSEEN_SEEINVIS, MONSEEN_INFRAVIS, MONSEEN_TELEPAT, MONSEEN_XRAYVIS,
    MONSEEN_DETECT, MONSEEN_WARNMON, STRAT_WAITMASK, TT_BURIEDBALL,
    TT_INFLOOR, TT_LAVA, WEB, is_pit,
} from './const.js';
import { displayLiquidName, glyphAt, howMonsterSeen } from './display.js';
import { game } from './gstate.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { objectAtMapDescription } from './map_object_description.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL,
    monsterDigests, monsterTypeName,
} from './monster_data.js';
import { distantMonsterName, monsterName } from './monster_name.js';
import { monsterHiddenConditions } from './monster_status.js';
import type { Monster } from './monster_types.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { visibleRegionAt } from './regions.js';
import { heroIsHallucinating } from './senses.js';
import { isPoolAt } from './terrain_properties.js';
import { surfaceName } from './terrain_name.js';
import { trapName } from './trap_name.js';
import { cansee } from './vision.js';

const COYOTE_NAMES = [
    'Carnivorous Vulgaris', 'Road-Runnerus Digestus', 'Eatibus Anythingus',
    'Famishus-Famishus', 'Eatibus Almost Anythingus', 'Eatius Birdius',
    'Famishius Fantasticus', 'Eternalii Famishiis', 'Famishus Vulgarus',
    'Famishius Vulgaris Ingeniusi', 'Eatius-Slobbius', 'Hardheadipus Oedipus',
    'Carnivorous Slobbius', 'Hard-Headipus Ravenus', 'Evereadii Eatibus',
    'Apetitius Giganticus', 'Hungrii Flea-Bagius', 'Overconfidentii Vulgaris',
    'Caninus Nervous Rex', 'Grotesques Appetitus', 'Nemesis Ridiculii',
];

export async function lookAtMonster(monster: Monster, x: number, y: number): Promise<string> {
    const accurate = !heroIsHallucinating();
    const coyote = accurate && MONSTER_NAME[monster.mnum] === 'coyote';
    const name = coyote ? `${monsterName(monster, { article: 'none', suppressIt: true })} - ${
        monster.mcan ? 'Canis latrans' : COYOTE_NAMES[monster.m_id % COYOTE_NAMES.length]}`
        : distantMonsterName(monster);
    const tail = monster.mx !== x || monster.my !== y;
    const prefix = tail ? monster.isshk && accurate ? 'tail of ' : 'tail of a ' : '';
    let description = prefix + (accurate && monster.mtame ? 'tame '
        : accurate && monster.mpeaceful ? 'peaceful ' : '') + name;
    if (game.u.ustuck === monster) {
        description += game.u.uswallow ? monsterDigests(monster) ? ', swallowing you' : ', engulfing you'
            : heroFormSticks() ? ', being held' : ', holding you';
    }
    if (monster.mfrozen) description += ", can't move (paralyzed or sleeping or busy)";
    else if (monster.msleeping) description += ', asleep';
    else if ((monster.mstrategy ?? 0) & STRAT_WAITMASK) description += ', meditating';
    if (monster.mleashed) description += ', leashed to you';
    const trap = game.level?.traps.find(t => t.tx === monster.mx && t.ty === monster.my);
    if (monster.mtrapped && cansee(monster.mx, monster.my) && trap
        && (trap.ttyp === BEAR_TRAP || is_pit(trap.ttyp) || trap.ttyp === WEB)) {
        description += `, trapped in ${withIndefiniteArticle(trapName(trap.ttyp))}`;
        trap.tseen = true;
    }
    if (monster.mundetected || monster.m_ap_type || visibleRegionAt(game, x, y)) {
        const hidden = await monsterHiddenConditions(monster, game, { showAlternateMonster: false });
        if (hidden.length) description += `, ${hidden.join(', ')}`;
    }
    return description;
}

export function monsterSeenDescription(monster: Monster): string {
    const seen = howMonsterSeen(monster);
    if (!seen || seen === MONSEEN_NORMAL) return '';
    const senses = [
        [MONSEEN_NORMAL, 'normal vision'], [MONSEEN_SEEINVIS, 'see invisible'],
        [MONSEEN_INFRAVIS, 'infravision'], [MONSEEN_TELEPAT, 'telepathy'],
        [MONSEEN_XRAYVIS, 'astral vision'], [MONSEEN_DETECT, 'monster detection'],
    ] as const;
    const descriptions = senses.filter(([bit]) => seen & bit).map(([, text]): string => text);
    if (seen & MONSEEN_WARNMON) {
        if (heroIsHallucinating()) descriptions.push('paranoid delusion');
        else {
            const mask = (game.context.warntype?.obj ?? 0) | (game.context.warntype?.polyd ?? 0);
            const speciesFlags = MONSTER_FLAGS2[monster.mnum] ?? 0;
            const category = [[0x08, 'human'], [0x10, 'elf'], [0x40, 'orc'], [0x10000, 'demon']] as const;
            const name = category.find(([bit]) => mask & speciesFlags & bit)?.[1]
                ?? monsterTypeName(monster.mnum, monster.female);
            descriptions.push(`warned of ${makePlural(name)}`);
        }
    }
    return descriptions.join(', ');
}

export async function selfLookDetails(): Promise<string> {
    const hero = game.u;
    let result = hero.usteed ? `, mounted on ${monsterName(hero.usteed, { article: 'your' })}` : '';
    const species = heroSpecies();
    const appearance = (hero.m_ap_type ?? 0) & 3;
    if (appearance === M_AP_FURNITURE) {
        const name = MAP_SYMBOLS[hero.mappearance ?? -1]?.name;
        if (name) result += `, mimicking ${withIndefiniteArticle(name)}`;
    } else if (appearance === M_AP_OBJECT) {
        result += `, mimicking ${await objectAtMapDescription(hero.ux, hero.uy, glyphAt(hero.ux, hero.uy), game, 'hidden')}`;
    } else if (!appearance && hero.uundetected) {
        const flags = MONSTER_FLAGS1[species] ?? 0;
        if (flags & 0x80) result += ', hiding under something';
        else if (flags & 0x100) {
            const ceiling = !!(flags & 0x10) && MONSTER_SYMBOL[species] !== 13 || !!(flags & 1);
            result += `, hiding on the ${ceiling ? 'ceiling' : surfaceName(hero.ux, hero.uy)}`;
        } else result += `, hiding${MONSTER_SYMBOL[species] === 57 && isPoolAt(hero.ux, hero.uy) ? ' in murky water' : ''}`;
    }
    const region = visibleRegionAt(game, hero.ux, hero.uy);
    if (region) result += `, in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`;
    return result;
}

export function selfTrapDescription(): string {
    const hero = game.u;
    if (!hero.utrap) return '';
    if (hero.utraptype === TT_BURIEDBALL) return ', tethered to something buried';
    if (hero.utraptype === TT_LAVA) return `, sinking into ${displayLiquidName('lava')}`;
    if (hero.utraptype === TT_INFLOOR) return `, stuck in the ${surfaceName(hero.ux, hero.uy)}`;
    const trap = game.level?.traps.find(t => t.tx === hero.ux && t.ty === hero.uy);
    return `, trapped${trap ? ` in ${withIndefiniteArticle(trapName(trap.ttyp))}` : ''}`;
}
