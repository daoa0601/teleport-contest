// C mondata.c:locomotion() and stagger(). Describe the actual body, even
// when its name is hidden or hallucinated.
import { MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsAmorphous, monsterIsSlithy, } from './monster_data.js';
const S_EYE = 5;
const S_LIGHT = 25;
const M1_FLY = 0x00000001;
const M1_NOLIMBS = 0x00006000;
const MZ_SMALL = 1;
export function monsterLocomotion(mnum, fallback) {
    const body = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    let verb = fallback;
    if (symbol === S_EYE || symbol === S_LIGHT)
        verb = 'float';
    else if (body & M1_FLY)
        verb = 'fly';
    else if (monsterIsSlithy(mnum))
        verb = 'slither';
    else if (monsterIsAmorphous({ mnum }))
        verb = 'ooze';
    else if (!MONSTER_MOVE[mnum])
        verb = 'wiggle';
    else if ((body & M1_NOLIMBS) === M1_NOLIMBS)
        verb = 'crawl';
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}
// C mondata.c:stagger(): the faltering counterpart of locomotion().
export function monsterStagger(mnum, fallback) {
    const body = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    let verb = fallback;
    if (symbol === S_EYE || symbol === S_LIGHT)
        verb = 'wobble';
    else if (body & M1_FLY)
        verb = (MONSTER_SIZE[mnum] ?? 0) <= MZ_SMALL ? 'flutter' : 'stagger';
    else if (monsterIsSlithy(mnum))
        verb = 'falter';
    else if (monsterIsAmorphous({ mnum }))
        verb = 'tremble';
    else if (!MONSTER_MOVE[mnum])
        verb = 'pulsate';
    else if ((body & M1_NOLIMBS) === M1_NOLIMBS)
        verb = 'falter';
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}
//# sourceMappingURL=monster_locomotion.js.map