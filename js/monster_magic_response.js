// Monster responses and relocation caused by immediate magic.
// C refs: mon.c m_respond() and teleport.c u_teleport_mon().
import { RLOC_MSG } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { level_difficulty } from './dungeon.js';
import { game, requirePlayingGame } from './gstate.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { makemonAt } from './mklev.js';
import { aggravateMonsters } from './monster_anger.js';
import { MONSTER_DIFFICULTY, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SOUND, monsterIsRider, } from './monster_data.js';
import { respondMedusa } from './monster_gaze.js';
import { sendMonsterToLimbo } from './monster_migration.js';
import { monsterName } from './monster_name.js';
import { monsterHasLineOfSightToHero } from './monster_perception.js';
import { stopHeroOccupation } from './occupation.js';
import { templeRoomAt } from './priest.js';
import { rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { randomMonsterRelocation, relocateMonsterTo } from './teleport.js';
import { findNearbyMonsterPosition, monsterTeleportRestricted } from './teleport_rules.js';
export async function respondToImmediateMagic(monster, state = game) {
    requirePlayingGame(state);
    const distance = Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy));
    if (MONSTER_SOUND[monster.mnum] === 18 && distance <= 1) {
        if (!heroIsDeaf(state)) {
            await pline(`${monsterName(monster, { capitalized: true })} shrieks.`);
            await stopHeroOccupation();
        }
        if (!rn2(10)) {
            let species = null;
            if (!rn2(13)) {
                const adult = MONSTER_NAME.indexOf('purple worm');
                const maximum = Math.trunc((level_difficulty() + state.u.ulevel) / 2);
                species = (MONSTER_DIFFICULTY[adult] ?? 0) > maximum
                    ? MONSTER_NAME.indexOf('baby purple worm') : adult;
            }
            await makemonAt(species, 0, 0);
        }
        aggravateMonsters(state);
    }
    await respondMedusa(monster, { state });
    if (MONSTER_NAME[monster.mnum] === 'erinys' && !monster.mpeaceful
        && monsterHasLineOfSightToHero(monster, state))
        aggravateMonsters(state);
}
export async function teleportMonsterByHero(monster, { state = game, giveFeedback = true, } = {}) {
    requirePlayingGame(state);
    if ((state.level.flags.stasis_until ?? -1) >= state.moves) {
        if (giveFeedback)
            await pline(`A mysterious force prevents you teleporting ${monsterName(monster)}!`);
        return false;
    }
    if (monster.ispriest && templeRoomAt(state, monster.mx, monster.my)) {
        if (giveFeedback)
            await pline(`${monsterName(monster, { capitalized: true })} resists your magic!`);
        return false;
    }
    if (state.u.uswallow && state.u.ustuck === monster && monsterTeleportRestricted(monster, state)) {
        if (giveFeedback)
            await pline(`You are no longer inside ${monsterName(monster)}!`);
        await releaseHeroFromMonster(monster, { state });
        if (!await randomMonsterRelocation(monster, { state, flags: RLOC_MSG }))
            await sendMonsterToLimbo(monster, state);
        return true;
    }
    if ((monsterIsRider(monster) || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x04000000)) && rn2(13)) {
        const destination = findNearbyMonsterPosition(monster.mnum, state.u.ux, state.u.uy, { state });
        if (destination) {
            await relocateMonsterTo(monster, destination.x, destination.y, { state });
            return true;
        }
    }
    return !!await randomMonsterRelocation(monster, { state, flags: RLOC_MSG });
}
//# sourceMappingURL=monster_magic_response.js.map