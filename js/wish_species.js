// C objnam.c:readobjnam(), depicted gender, species admission, and food
// contents. Species changes use the normal corpse and egg timer owner.
import { CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE, CORPSTAT_NEUTER, CORPSTAT_RANDOM, G_GENOD, G_NOCORPSE, } from './const.js';
import { zombieForm } from './corpse_species.js';
import { hatchableEggSpecies } from './egg_species.js';
import { game } from './gstate.js';
import { set_corpsenm } from './mklev.js';
import { MONSTER_BODY_META, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SOUND, monsterClassSymbol, monsterIsVerySmall, } from './monster_data.js';
import { counterWereSpecies } from './monster_species.js';
import { CORPSE, EGG, FIGURINE, GLOB_OF_GRAY_OOZE, GRAY_DRAGON_SCALE_MAIL, STATUE, TIN, OBJECT_NAMES, } from './object_data.js';
import { deleteObjectContents } from './object_delete.js';
import { OBJECT_TIMER_KIND, scheduleObjectTimer } from './object_timers.js';
import { rn2 } from './rng.js';
import { setTinVariety } from './tin.js';
const M2_WERE = 0x00000004;
const M2_HUMAN = 0x00000008;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
const G_UNIQ = 0x1000;
const PM_GRAY_DRAGON = MONSTER_NAME.indexOf('gray dragon');
const PM_YELLOW_DRAGON = MONSTER_NAME.indexOf('yellow dragon');
const SCALE_MAIL = OBJECT_NAMES.indexOf('scale mail');
export function substituteWishedGlob(type, parsed) {
    const species = parsed.monsterSpecies;
    if (type !== CORPSE || species === null || monsterClassSymbol(species) !== 'P')
        return type;
    parsed.monsterSpecies = null;
    return GLOB_OF_GRAY_OOZE + species - MONSTER_NAME.indexOf('gray ooze');
}
export async function applyWishSpecies(object, parsed, wizardWish) {
    const requestedSpecies = parsed.monsterSpecies;
    if ([STATUE, FIGURINE, CORPSE].includes(object.otyp)) {
        object.spe = wishedGender(requestedSpecies, parsed);
        if (parsed.historic && object.otyp === STATUE)
            object.spe |= CORPSTAT_HISTORIC;
    }
    if (object.otyp === TIN && (parsed.empty || parsed.spinach)) {
        object.corpsenm = -1;
        object.spe = parsed.spinach ? 1 : 0;
    }
    if (requestedSpecies === null)
        return;
    let species = requestedSpecies === MONSTER_NAME.indexOf('long worm tail')
        ? MONSTER_NAME.indexOf('long worm') : requestedSpecies;
    let flags = MONSTER_FLAGS2[species] ?? 0;
    const noCorpse = (MONSTER_GENO[species] ?? 0) & G_NOCORPSE
        || (game.mvitals?.[species]?.mvflags ?? 0) & G_NOCORPSE;
    if (object.otyp !== FIGURINE && flags & M2_WERE && noCorpse) {
        species = counterWereSpecies(species) ?? species;
        flags = MONSTER_FLAGS2[species] ?? 0;
    }
    const unique = !!((MONSTER_GENO[species] ?? 0) & G_UNIQ);
    const leavesCorpse = !((MONSTER_GENO[species] ?? 0) & G_NOCORPSE)
        && !((game.mvitals?.[species]?.mvflags ?? 0) & G_NOCORPSE);
    switch (object.otyp) {
        case TIN:
            if ((game.mvitals?.[species]?.mvflags ?? 0) & G_GENOD)
                object.corpsenm = -1;
            else if ((!unique || wizardWish) && leavesCorpse && (MONSTER_BODY_META[species]?.[1] ?? 0))
                object.corpsenm = species;
            break;
        case CORPSE:
            if ((!unique || wizardWish) && leavesCorpse) {
                if (MONSTER_SOUND[species] === 38)
                    species = guardianGenus(species);
                set_corpsenm(object, species);
            }
            if (parsed.zombifying && zombieForm(species) !== null)
                scheduleObjectTimer(object, OBJECT_TIMER_KIND.ZOMBIFY_MON, game.moves + 10 + rn2(5));
            break;
        case EGG:
            set_corpsenm(object, hatchableEggSpecies(species));
            break;
        case FIGURINE:
            if (!unique && (!(flags & M2_HUMAN) || flags & M2_WERE)
                && species !== MONSTER_NAME.indexOf('mail daemon'))
                object.corpsenm = species;
            break;
        case STATUE:
            object.corpsenm = species;
            if (object.contents?.length && monsterIsVerySmall(species))
                await deleteObjectContents(object);
            break;
        case SCALE_MAIL:
            if (species >= PM_GRAY_DRAGON && species <= PM_YELLOW_DRAGON)
                object.otyp = GRAY_DRAGON_SCALE_MAIL + species - PM_GRAY_DRAGON;
            break;
    }
}
export function applyWishedTinVariety(object, parsed, wizardWish) {
    if (object.otyp === TIN && parsed.tinVariety !== null && (rn2(4) || wizardWish))
        setTinVariety(object, parsed.tinVariety);
}
function wishedGender(species, parsed) {
    if (species === null)
        return CORPSTAT_RANDOM;
    const flags = MONSTER_FLAGS2[species] ?? 0;
    if (flags & M2_NEUTER)
        return CORPSTAT_NEUTER;
    if (parsed.gender === 1 && !(flags & M2_MALE))
        return CORPSTAT_FEMALE;
    if (parsed.gender === 0 && !(flags & M2_FEMALE))
        return CORPSTAT_MALE;
    if (flags & M2_MALE)
        return CORPSTAT_MALE;
    if (flags & M2_FEMALE)
        return CORPSTAT_FEMALE;
    return rn2(2) ? CORPSTAT_MALE : CORPSTAT_FEMALE;
}
function guardianGenus(species) {
    const guardians = new Map([
        ['student', 'archeologist'], ['chieftain', 'barbarian'], ['neanderthal', 'cave dweller'],
        ['attendant', 'healer'], ['page', 'knight'], ['abbot', 'monk'], ['acolyte', 'cleric'],
        ['hunter', 'ranger'], ['thug', 'rogue'], ['roshi', 'samurai'], ['guide', 'tourist'],
        ['apprentice', 'wizard'], ['warrior', 'valkyrie'],
    ]);
    const genus = guardians.get(MONSTER_NAME[species] ?? '');
    return genus ? MONSTER_NAME.indexOf(genus) : species;
}
//# sourceMappingURL=wish_species.js.map