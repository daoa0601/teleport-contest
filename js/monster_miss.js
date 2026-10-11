// Native mhitu.c:missmu(), wildmiss(), and the unfound-target engulf branch.
import { heroIsDisplaced } from './armor.js';
import { IS_WATERWALL } from './const.js';
import { impossible } from './diagnostics.js';
import { canSeeMonster } from './display.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { formatHeardMessage } from './hero_speech.js';
import { AD_SEDU, AD_SSEX, AT_BITE, AT_BUTT, AT_KICK, AT_STNG, } from './monster_attack_types.js';
import { MONSTER_FLAGS1, monsterDigests, monsterHasNoLimbs, monsterIsWhirly, } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { seductionCompatibility } from './seduction_compatibility.js';
import { cansee } from './vision.js';
const M1_SEE_INVIS = 0x01000000;
export async function monsterMissMessage(monster, attack, state, random) {
    if (attack.effect === 'wild-miss')
        return wildMissMessage(monster, attack, state, random);
    if (attack.effect === 'engulf-unfound')
        return engulfMissMessage(monster, state);
    const friendly = !monster.mcan && seductionCompatibility(monster, 'hero', [attack.attackType, attack.damageType, 0, 0], state);
    const subject = monsterName(monster, { state, capitalized: true });
    if (friendly)
        return `${subject} pretends to be friendly.`;
    return `${subject} ${attack.nearMiss && state.flags.verbose !== false ? 'just ' : ''}misses!`;
}
async function wildMissMessage(monster, attack, state, random) {
    const invisible = heroIsInvisible(state);
    const unseen = !monster.mcansee
        || invisible && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
    const displaced = heroIsDisplaced(state);
    const submerged = !!(state.underwater || state.u.uinwater);
    if (!unseen && !displaced && !submerged) {
        const subject = monsterName(monster, { state, capitalized: true, augmentIt: true });
        await impossible(`${subject} attacks you without knowing your location?`, { state });
        return null;
    }
    // Native gates both the monster name's display randomness and the unseen
    // target's wording draw on seeing the square, not identifying the attacker.
    if (state.flags.verbose === false || !cansee(monster.mx, monster.my))
        return null;
    const compatibility = attack.damageType === AD_SEDU || attack.damageType === AD_SSEX
        ? seductionCompatibility(monster, 'hero', [attack.attackType, attack.damageType, 0, 0], state) : 0;
    const subject = monsterName(monster, { state, capitalized: true });
    if (unseen) {
        if (compatibility)
            return `${subject} tries to touch you and misses!`;
        switch (random(3)) {
            case 0: {
                const verb = attack.attackType === AT_BITE ? 'snaps'
                    : attack.attackType === AT_KICK ? 'kicks'
                        : attack.attackType === AT_STNG || attack.attackType === AT_BUTT
                            || monsterHasNoLimbs(monster.mnum) ? 'lunges' : 'swings';
                return `${subject} ${verb} wildly and misses!`;
            }
            case 1:
                return `${subject} attacks a spot beside you.`;
            default: {
                const target = monster.mux === undefined || monster.muy === undefined
                    ? null : state.level.at(monster.mux, monster.muy);
                return `${subject} strikes at ${target && IS_WATERWALL(target.typ) ? 'empty water' : 'thin air'}!`;
            }
        }
    }
    if (displaced) {
        const image = `${invisible ? 'invisible ' : ''}displaced image`;
        return compatibility
            ? `${subject} smiles ${compatibility === 2 ? 'engagingly' : 'seductively'} at your ${image}...`
            : `${subject} strikes at your ${image} and misses you!`;
    }
    return compatibility ? `${subject} reaches towards your distorted image.`
        : `${subject} is fooled by water reflections and misses!`;
}
function engulfMissMessage(monster, state) {
    if (monsterDigests(monster))
        return `${monsterName(monster, { state, capitalized: true })} gulps some air!`;
    if (canSeeMonster(monster))
        return `${monsterName(monster, { state, capitalized: true })} lunges forward and recoils!`;
    return formatHeardMessage(`a ${monsterIsWhirly(monster) ? 'rushing noise' : 'splat'} nearby.`, state);
}
//# sourceMappingURL=monster_miss.js.map