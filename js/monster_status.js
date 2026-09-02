// Monster status text used by stethoscopes and probing magic.
// C ref: insight.c mstatusline().

import {
    MONSTER_ALIGNMENT, MONSTER_EXPERIENCE_META, MONSTER_NAME, MONSTER_SIZE,
} from './monster_data.js';

export function monsterStatusLine(monster) {
    const monsterName = MONSTER_NAME[monster.mnum] || 'monster';
    const alignment = MONSTER_ALIGNMENT[monster.mnum] ?? 0;
    const alignmentName = alignment === -128 ? 'unaligned'
        : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    const sizeName = ({
        0: 'tiny', 1: 'small', 2: 'medium', 3: 'large',
        4: 'huge', 7: 'gigantic',
    })[MONSTER_SIZE[monster.mnum]] || 'unknown size';
    const article = monster.mtame ? 'your' : 'the';
    const conditions = [];
    if (monster.mtame) conditions.push('tame');
    else if (monster.mpeaceful) conditions.push('peaceful');
    if (monster.mcan) conditions.push('cancelled');
    if (monster.mconf) conditions.push('confused');
    if (monster.mblinded || monster.mcansee === 0) conditions.push('blind');
    if (monster.mstun) conditions.push('stunned');
    if (monster.msleeping) conditions.push('asleep');
    else if (monster.mcanmove === 0) conditions.push("can't move");
    if (monster.mflee) conditions.push('scared');
    if (monster.mtrapped) conditions.push('trapped');
    if (monster.minvis) conditions.push('invisible');
    const conditionText = conditions.length ? `, ${conditions.join(', ')}` : '';
    const armorClass = monster.ac
        ?? MONSTER_EXPERIENCE_META[monster.mnum]?.[0] ?? 10;
    const identity = `${article} ${monsterName} (${alignmentName}, ${sizeName})`;
    const health = `Level ${monster.m_lev ?? 0}  HP ${monster.mhp}(${monster.mhpmax})`;
    return `Status of ${identity}:  ${health}  AC ${armorClass}${conditionText}.`;
}
