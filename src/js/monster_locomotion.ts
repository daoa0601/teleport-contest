// C mondata.c:locomotion(). Describe the actual body, even when its name
// is hidden or hallucinated.
import { MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_SYMBOL, monsterIsAmorphous, monsterIsSlithy } from './monster_data.js';

const S_EYE = 5;
const S_LIGHT = 25;
const M1_FLY = 0x00000001;
const M1_NOLIMBS = 0x00006000;

export function monsterLocomotion(mnum: number, fallback: string): string {
    const body = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    let verb = fallback;
    if (symbol === S_EYE || symbol === S_LIGHT) verb = 'float';
    else if (body & M1_FLY) verb = 'fly';
    else if (monsterIsSlithy(mnum)) verb = 'slither';
    else if (monsterIsAmorphous({ mnum })) verb = 'ooze';
    else if (!MONSTER_MOVE[mnum]) verb = 'wiggle';
    else if ((body & M1_NOLIMBS) === M1_NOLIMBS) verb = 'crawl';
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}
