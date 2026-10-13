// Monster status text used by stethoscopes and probing magic.
// C ref: insight.c mstatusline().

import { M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, STRAT_WAITMASK } from './const.js';
import { monsterLegName } from './body_parts.js';
import { game } from './gstate.js';
import { heroFormSticks } from './hero_species.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { monsterAlignmentType } from './monster_alignment.js';
import { objectAtMonsterDescription } from './monster_birth.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL,
    monsterDigests, monsterEnfolds, monsterIsAnimal, monsterTypeName,
} from './monster_data.js';
import { monsterName as nameMonster } from './monster_name.js';
import { findMonsterArmorClass } from './monworn.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { visibleRegionAt } from './regions.js';
import { isPoolAt } from './terrain_properties.js';
import { surfaceName } from './terrain_name.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

const SIZE_NAMES = new Map([
    [0, 'tiny'], [1, 'small'], [2, 'medium'], [3, 'large'],
    [4, 'huge'], [7, 'gigantic'],
]);

interface StatusLineOptions {
    state?: GameState;
    x?: number;
    y?: number;
}

export async function monsterStatusLine(monster: Monster, {
    state = game, x = monster.mx, y = monster.my,
}: StatusLineOptions = {}): Promise<string> {
    const alignment = monsterAlignmentType(monster);
    const alignmentName = alignment === -128 ? 'unaligned'
        : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    const sizeName = SIZE_NAMES.get(MONSTER_SIZE[monster.mnum] ?? -1) || 'unknown size';
    const conditions: string[] = [];
    if (monster.mtame) {
        let tame = 'tame';
        if (state.flags.debug) {
            const pet = monster.edog || monster.mextra?.edog;
            let details = '';
            if (!monster.isminion) {
                if (!pet) throw new Error(`Pet ${monster.m_id} has no pet state`);
                details = `; hungry ${pet.hungrytime}; apport ${pet.apport}`;
            }
            tame += ` (${monster.mtame}${details})`;
        }
        conditions.push(tame);
    }
    else if (monster.mpeaceful) conditions.push('peaceful');
    if (MONSTER_NAME[monster.mnum] === 'long worm') {
        const segments = monster.wormSegments || [];
        const count = segments.length + 1;
        const index = x === monster.mx && y === monster.my ? 1
            : segments.findIndex(segment => segment.x === x && segment.y === y) + 2;
        const suffix = index % 100 >= 11 && index % 100 <= 13 ? 'th'
            : ['', 'st', 'nd', 'rd'][index % 10] || 'th';
        conditions.push(count === 1 ? 'single segment' : `${index}${suffix} of ${count} segments`);
    }
    if (monster.cham !== undefined && monster.cham >= 0 && monster.cham !== monster.mnum)
        conditions.push('shapechanger');
    if (monster.meating) conditions.push('eating');
    conditions.push(...await monsterHiddenConditions(monster, state));
    if (monster.mcan) conditions.push('cancelled');
    if (monster.mconf) conditions.push('confused');
    if (monster.mblinded || monster.mcansee === 0) conditions.push('blind');
    if (monster.mstun) conditions.push('stunned');
    if (monster.msleeping) conditions.push('asleep');
    else if (monster.mfrozen || monster.mcanmove === 0) conditions.push("can't move");
    else if ((monster.mstrategy ?? 0) & STRAT_WAITMASK) conditions.push('meditating');
    if (monster.mflee) conditions.push('scared');
    if (monster.mtrapped) conditions.push('trapped');
    if (monster.mspeed) conditions.push(monster.mspeed === 2 ? 'fast'
        : monster.mspeed === 1 ? 'slow' : '[? speed]');
    if (monster.minvis) conditions.push('invisible');
    if (monster === state.u.ustuck) {
        if (state.u.uswallow) conditions.push(monsterDigests(monster) ? 'digesting you'
            : monsterIsAnimal(monster) && !monsterEnfolds(monster) ? 'swallowing you' : 'engulfing you');
        else conditions.push(heroFormSticks(state) ? 'held by you' : 'holding you');
    }
    if (monster === state.u.usteed) {
        conditions.push('carrying you');
        if ((state.u._woundedLegTurns ?? 0) > 0 || state.u._woundedLegSide) {
            const leg = monsterLegName(monster.mnum);
            conditions.push(`injured ${state.u._woundedLegSide === 'both' ? makePlural(leg) : leg}`);
        }
    }
    if (monster.mleashed) conditions.push('leashed');
    const conditionText = conditions.length ? `, ${conditions.join(', ')}` : '';
    const armorClass = findMonsterArmorClass(monster);
    const name = nameMonster(monster, {
        state, article: 'your', suppressIt: true, suppressInvisible: true,
        suppressSaddle: false,
    });
    const identity = `${name} (${alignmentName}, ${sizeName})`;
    const health = `Level ${monster.m_lev ?? 0}  HP ${monster.mhp}(${monster.mhpmax})`;
    return `Status of ${identity}:  ${health}  AC ${armorClass}${conditionText}.`;
}

// C pager.c:mhidden_description(). Probing reveals an alternate monster
// identity; farlook only describes furniture, objects, hiding, and regions.
export async function monsterHiddenConditions(
    monster: Monster, state: GameState,
    { showAlternateMonster = true }: { showAlternateMonster?: boolean } = {},
): Promise<string[]> {
    const conditions: string[] = [];
    const appearance = M_AP_TYPE(monster);
    const x = monster.mx, y = monster.my;
    if (appearance === M_AP_FURNITURE) {
        const symbol = MAP_SYMBOLS[monster.mappearance ?? -1];
        if (!symbol) throw new Error(`Monster ${monster.m_id} has no furniture disguise`);
        conditions.push(`mimicking ${withIndefiniteArticle(symbol.name)}`);
    } else if (appearance === M_AP_OBJECT) {
        conditions.push(`mimicking ${await objectAtMonsterDescription(monster, state)}`);
    } else if (appearance === M_AP_MONSTER && showAlternateMonster) {
        if (monster.mappearance === undefined)
            throw new Error(`Monster ${monster.m_id} has no disguise species`);
        const form = monsterTypeName(monster.mappearance, monster.female);
        conditions.push(`masquerading as ${withIndefiniteArticle(form)}`);
    } else if (!appearance && monster.mundetected) {
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        if (flags & 0x80) {
            conditions.push(`hiding under ${await objectAtMonsterDescription(monster, state)}`);
        } else if (flags & 0x100) {
            const ceiling = (flags & 0x10) && MONSTER_SYMBOL[monster.mnum] !== 13
                || (flags & 1);
            conditions.push(`hiding on the ${ceiling ? 'ceiling' : surfaceName(x, y, state)}`);
        } else {
            const water = MONSTER_SYMBOL[monster.mnum] === 57 && isPoolAt(x, y, state);
            conditions.push(`hiding${water ? ' in murky water' : ''}`);
        }
    }
    const region = visibleRegionAt(state, x, y);
    if (region)
        conditions.push(`in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`);
    return conditions;
}
