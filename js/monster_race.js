// Native mondata.c:same_race(). Species families used by cannibalism.
import { MONSTER_FLAGS2, MONSTER_GROWTH_TARGET, MONSTER_NAME, MONSTER_SYMBOL, monsterIsMindFlayer, monsterIsRider, monsterIsUndead, monsterIsUnicorn, monsterYoungerForm, requireMonsterData, } from './monster_data.js';
const species = (name) => MONSTER_NAME.indexOf(name);
const symbol = (name) => requireMonsterData(MONSTER_SYMBOL, species(name));
const GOLEM = symbol('stone golem');
const KOBOLD = symbol('kobold');
const IMP = symbol('imp');
const raceFlags = [0x08, 0x10, 0x20, 0x40, 0x80, 0x2000];
const classFamilies = ['ogre', 'water nymph', 'plains centaur', 'red dragon', 'red naga'].map(symbol);
const undeadFamilies = ['human zombie', 'human mummy', 'vampire', 'lich', 'wraith', 'ghost'].map(symbol);
const kobolds = new Set(['kobold zombie', 'kobold mummy'].map(species));
const gargoyles = new Set(['gargoyle', 'winged gargoyle'].map(species));
const bees = new Set(['killer bee', 'queen bee'].map(species));
const longWorms = new Set(['baby long worm', 'long worm', 'long worm tail'].map(species));
const TENGU = species('tengu');
export function sameMonsterRace(left, right) {
    if (left === right)
        return true;
    const leftFlags = requireMonsterData(MONSTER_FLAGS2, left);
    const rightFlags = requireMonsterData(MONSTER_FLAGS2, right);
    const leftClass = requireMonsterData(MONSTER_SYMBOL, left);
    const rightClass = requireMonsterData(MONSTER_SYMBOL, right);
    for (const flag of raceFlags)
        if (leftFlags & flag)
            return !!(rightFlags & flag);
    if (leftClass === GOLEM)
        return rightClass === GOLEM;
    if (monsterIsMindFlayer(left))
        return monsterIsMindFlayer(right);
    if (leftClass === KOBOLD || kobolds.has(left))
        return rightClass === KOBOLD || kobolds.has(right);
    if (classFamilies.includes(leftClass))
        return leftClass === rightClass;
    if (monsterIsUnicorn(left))
        return monsterIsUnicorn(right);
    if (monsterIsRider({ mnum: left }))
        return monsterIsRider({ mnum: right });
    if (leftFlags & 0x1000)
        return !!(rightFlags & 0x1000);
    if (left === TENGU || right === TENGU)
        return false;
    if (leftClass === IMP)
        return rightClass === IMP;
    if (rightClass === IMP)
        return false;
    if (leftFlags & 0x100)
        return !!(rightFlags & 0x100);
    if (monsterIsUndead(left)) {
        if (undeadFamilies.includes(leftClass))
            return leftClass === rightClass;
    }
    else if (monsterIsUndead(right))
        return false;
    if (leftClass === rightClass) {
        for (const nextForm of [monsterYoungerForm,
            (mnum) => requireMonsterData(MONSTER_GROWTH_TARGET, mnum)]) {
            let current = left;
            for (;;) {
                const next = nextForm(current);
                if (next === current)
                    break;
                if (next === right)
                    return true;
                current = next;
            }
        }
    }
    for (const family of [gargoyles, bees, longWorms])
        if (family.has(left))
            return family.has(right);
    return false;
}
//# sourceMappingURL=monster_race.js.map