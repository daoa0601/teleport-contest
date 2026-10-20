// C read.c:drop_boulder_on_player(), drop_boulder_on_monster().
import { objectIsHardHelmet } from './armor.js';
import { heroHeadName, monsterStomachName } from './body_parts.js';
import { W_ARMH } from './const.js';
import { canSpotMonster, map_invisible, newsym, plineWithContinuation } from './display.js';
import { landFloorObject } from './floor_effects.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { finishHeroDeath as defaultHeroDeath } from './end.js';
import { loseHeroHp } from './hero_damage.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroSpecies } from './hero_species.js';
import { formatHeardMessage } from './hero_speech.js';
import { mksobj } from './mklev.js';
import { wakeMonster } from './monster_anger.js';
import { MONSTER_FLAGS1, monsterIsAmorphous, monsterIsNoncorporeal, monsterIsUnsolid, requireMonsterData } from './monster_data.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName, monsterObjectPronoun, possessiveName } from './monster_name.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { BOULDER, ROCK } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { inventoryItemDescription } from './invent.js';
import { objectName, observeObjectForNaming, ownedObjectName } from './objnam.js';
import { rn1 } from './rng.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';
import { rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero } from './weapon_damage.js';
const M1_WALLWALK = 0x00000008;
export async function dropBoulderOnHero({ state = game, confused = false, helmetProtects = true, heroCaused = true, skipSwallower = false, finishHeroDeath = defaultHeroDeath, finishMonsterKill = finishHeroMonsterKillOutcome, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state.u.uswallow && !skipSwallower)
        return dropBoulderOnMonster(state.u.ux, state.u.uy, {
            state, confused, heroCaused, finishHeroDeath, finishMonsterKill,
        });
    const object = await fallingRock(confused);
    let damage = 0;
    if (canBeHit({ mnum: heroSpecies(state) }) && !state.u.passesWalls) {
        await plineWithContinuation(`You are hit by ${fallingRockName(object, state)}!`);
        damage = rollPhysicalWeaponDamageAgainstHero(object, state) * object.quan;
        const helmet = state.uarmh || state.u.uarmh;
        if (helmet && helmetProtects) {
            if (objectIsHardHelmet(helmet)) {
                await plineWithContinuation('Fortunately, you are wearing a hard helmet.');
                damage = Math.min(damage, 2);
            }
            else if (state.flags.verbose !== false) {
                await plineWithContinuation(`${ownedObjectName(helmet, state)} does not protect you.`);
            }
        }
    }
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, 16, state);
    await landFallingRock(object, state.u.ux, state.u.uy, state);
    if (state.u.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    const heroDied = damage ? await loseHeroHp(damage, 'scroll of earth', {
        state, die: finishHeroDeath,
    }) : false;
    return { dropped: true, heroDied: !!heroDied };
}
export async function dropBoulderOnMonster(x, y, { state = game, confused = false, heroCaused = true, finishHeroDeath = defaultHeroDeath, finishMonsterKill = finishHeroMonsterKillOutcome, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const object = await fallingRock(confused);
    const monster = monsterAtPosition(state.level, x, y);
    const swallowsHero = monster && state.u.uswallow && state.u.ustuck === monster;
    if (monster && canBeHit(monster)) {
        const spotted = canSpotMonster(monster);
        if (cansee(x, y)) {
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} is hit by ${fallingRockName(object, state)}!`);
            if (monster.minvis && !spotted)
                map_invisible(x, y);
        }
        else if (swallowsHero) {
            await hear(`something hit ${possessiveName(monsterName(monster, { state }))} ${monsterStomachName(monster.mnum)} over your ${heroHeadName(state)}!`, state);
        }
        let damage = rollPhysicalWeaponDamage(object, monster) * object.quan;
        const inventory = monster.minvent ?? monster.inventory;
        const helmet = inventory?.find(item => (item.owornmask ?? 0) & W_ARMH);
        if (helmet) {
            if (objectIsHardHelmet(helmet)) {
                if (spotted)
                    await plineWithContinuation(`Fortunately, ${monsterName(monster, { state })} is wearing a hard helmet.`);
                else
                    await hear('a clanging sound.', state);
                damage = Math.min(damage, 2);
            }
            else if (spotted) {
                await plineWithContinuation(`${possessiveName(monsterName(monster, { state, capitalized: true }))} ${objectName(helmet, state)} does not protect ${monsterObjectPronoun(monster, { state })}.`);
            }
        }
        monster.mhp -= damage;
        if (monster.mhp <= 0) {
            if (heroCaused)
                await finishMonsterKill(monster, x, y);
            else {
                await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} is killed.`);
                await finishEnvironmentalMonsterDeath(monster, state);
            }
        }
        else
            await wakeMonster(monster, { attacked: heroCaused });
        if (state.program_state.gameover)
            return { dropped: true, heroDied: true };
        await wakeMonstersNearWithMessages(x, y, 16, state);
    }
    else if (swallowsHero) {
        await deleteObject(object, state);
        return dropBoulderOnHero({ state, confused, helmetProtects: true,
            heroCaused: false, skipSwallower: true, finishHeroDeath, finishMonsterKill });
    }
    await landFallingRock(object, x, y, state);
    return { dropped: true, heroDied: !!state.program_state.gameover };
}
function canBeHit(monster) {
    return !monsterIsAmorphous(monster) && !monsterIsNoncorporeal(monster)
        && !monsterIsUnsolid(monster) && !(requireMonsterData(MONSTER_FLAGS1, monster.mnum) & M1_WALLWALK);
}
async function fallingRock(confused) {
    const object = await mksobj(confused ? ROCK : BOULDER, false, false);
    object.quan = confused ? rn1(5, 2) : 1;
    object.owt = objectWeight(object);
    return object;
}
// C doname() observes the falling object, so later blind feeling still
// calls seen rocks "rocks" rather than "stones".
function fallingRockName(object, state) {
    observeObjectForNaming(object, { state });
    return inventoryItemDescription(object);
}
async function landFallingRock(object, x, y, state) {
    await landFloorObject(object, x, y, { state, verb: 'fall' });
    newsym(x, y);
}
async function hear(message, state) {
    const heard = formatHeardMessage(message, state);
    if (heard)
        await plineWithContinuation(heard);
}
//# sourceMappingURL=falling_boulder.js.map