// Tame monster state.
// C refs: dog.c tamedog(), newedog(), initedog(), and abuse_dog().
import { currentAttribute } from './attrib.js';
import { A_CHA, DISMOUNT_THROWN, W_ARMS } from './const.js';
import { heroEyeName, heroHasEyes } from './body_parts.js';
import { canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { heroHasConflict } from './hero_conflict.js';
import { publishMonsterYelp, publishMonsterGrowl, } from './monster_anger.js';
import { releaseMonsterLeashWithFeedback, } from './monster_leash.js';
import { finishMonsterEating } from './monster_eating.js';
import { monsterName } from './monster_name.js';
import { dismountHero } from './steed.js';
import { cansee } from './vision.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, monsterHasNoHands, monsterIsVerySmall, monsterTypeName, } from './monster_data.js';
import { CREDIT_CARD, DWARVISH_MATTOCK, LOCK_PICK, PICK_AXE, RIN_AGGRAVATE_MONSTER, SKELETON_KEY, UNICORN_HORN, } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { redrawMonsterWorm } from './monster_worm.js';
import { makeMonsterFlee } from './monster_flee.js';
import { setMonsterMalign } from './monster_alignment.js';
const M2_DOMESTIC = 0x00400000;
const M1_ANIMAL = 0x00040000;
const M1_MINDLESS = 0x00010000;
const M1_TUNNEL = 0x20;
const M1_NEEDPICK = 0x40;
// C dogmove.c:droppables(). Pets keep equipment and usable tools.
export function petDroppableObject(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const animalOrMindless = !!(flags & (M1_ANIMAL | M1_MINDLESS));
    const canDig = (flags & (M1_TUNNEL | M1_NEEDPICK)) === (M1_TUNNEL | M1_NEEDPICK);
    const canUnlock = !monsterHasNoHands(monster.mnum) && !monsterIsVerySmall(monster.mnum);
    const weapon = monster.mw;
    // Undefined means this body cannot use the tool; null means no tool has
    // been selected yet. C represents the first case with a dummy artifact.
    let pick = animalOrMindless || !canDig ? undefined : null;
    let horn = animalOrMindless ? undefined : null;
    let key = animalOrMindless || !canUnlock ? undefined : null;
    if (weapon) {
        if ([PICK_AXE, DWARVISH_MATTOCK].includes(weapon.otyp))
            pick = weapon;
        if (weapon.otyp === UNICORN_HORN)
            horn = weapon;
    }
    for (const object of monster.minvent || []) {
        switch (object.otyp) {
            case DWARVISH_MATTOCK:
            case PICK_AXE:
                if (object.otyp === DWARVISH_MATTOCK && ((monster.misc_worn_check ?? 0) & W_ARMS))
                    break;
                if (object.otyp === DWARVISH_MATTOCK && pick?.otyp === PICK_AXE && pick !== weapon
                    && (!pick.oartifact || object.oartifact))
                    return pick;
                if (pick === null || (pick !== undefined && object.oartifact && !pick.oartifact)) {
                    if (pick)
                        return pick;
                    pick = object;
                    continue;
                }
                break;
            case UNICORN_HORN:
                if (object.cursed)
                    break;
                if (horn === null || (horn !== undefined && object.oartifact && !horn.oartifact)) {
                    if (horn)
                        return horn;
                    horn = object;
                    continue;
                }
                break;
            case SKELETON_KEY:
            case LOCK_PICK:
            case CREDIT_CARD:
                if (key && object.otyp < key.otyp
                    && (!key.oartifact || object.oartifact))
                    return key;
                if (key === null || (key !== undefined && object.oartifact && !key.oartifact)) {
                    if (key)
                        return key;
                    key = object;
                    continue;
                }
                break;
        }
        if (!object.owornmask && object !== weapon)
            return object;
    }
    return null;
}
function heroAggravatesMonsters(state) {
    const rings = [
        state.uleft, state.uright, state.u?.uleft, state.u?.uright,
    ];
    return !!(state.u?.aggravateMonster || state.aggravateMonster
        || rings.some(ring => ring?.otyp === RIN_AGGRAVATE_MONSTER)
        || heroHasConflict(state));
}
export async function abusePet(monster, state = game) {
    requireLiveGame(state);
    if (monster.mtame === undefined || monster.mtame <= 0)
        return false;
    monster.mtame = heroAggravatesMonsters(state)
        ? Math.trunc(monster.mtame / 2) : monster.mtame - 1;
    monster.pet = monster.mtame > 0;
    if (monster.mtame > 0 && !monster.isminion) {
        const pet = monster.edog || monster.mextra?.edog;
        if (!pet)
            throw new Error('tame monster lacks its pet history');
        pet.abuse++;
    }
    if (!monster.mtame && monster.mleashed)
        await releaseMonsterLeashWithFeedback(monster, { state });
    if (monster.mx !== 0) {
        if (monster.mtame > 0 && rn2(monster.mtame) !== 0) {
            await publishMonsterYelp(monster);
        }
        else {
            await publishMonsterGrowl(monster);
        }
        if (!monster.mtame) {
            newsym(monster.mx, monster.my);
            if (monster.wormno)
                redrawMonsterWorm(monster, state);
        }
    }
    return true;
}
export async function abusePetAfterHeroHit(monster, damage, state = game) {
    if (damage <= 0 || !await abusePet(monster, state))
        return { heroDied: false };
    if ((monster.mtame ?? 0) > 0 && monster.mhp > 0) {
        const turns = 10 * rnd(damage);
        return makeMonsterFlee(monster, { state, turns, announce: false });
    }
    return { heroDied: false };
}
// C dog.c:initedog(). Existing pet history survives renewed taming.
export function initializePet(monster, { state = game, everything = true } = {}) {
    if (!monster)
        return false;
    const minimumTameness = ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DOMESTIC) ? 10 : 5;
    monster.mtame = Math.max(minimumTameness, monster.mtame || 0);
    monster.mpeaceful = 1;
    monster.mavenge = 0;
    monster.pet = true;
    setMonsterMalign(monster, state);
    const dog = monster.edog || monster.mextra?.edog || newPetData(monster);
    if (everything) {
        monster.mleashed = 0;
        monster.meating = 0;
        const apport = currentAttribute(A_CHA, state);
        dog.parentmid = monster.m_id;
        dog.droptime = 0;
        dog.dropdist = 10000;
        dog.apport = apport;
        dog.whistletime = 0;
        dog.ogoal = { x: -1, y: -1 };
        dog.abuse = 0;
        dog.revivals = 0;
        dog.mhpmax_penalty = 0;
        dog.killed_by_u = 0;
    }
    else if (!(dog.apport > 0)) {
        dog.apport = 1;
    }
    dog.hungrytime = Math.max(dog.hungrytime ?? 0, (state.moves ?? 0) + 1000);
    monster.edog = dog;
    monster.mextra = { ...(monster.mextra || {}), edog: dog };
    if (!state.u.uconduct)
        state.u.uconduct = {};
    if (!state.u.uconduct.pets && state._moveloopStarted) {
        const pet = withIndefiniteArticle(monsterTypeName(monster.mnum, monster.female));
        recordGameLogEvent(`obtained ${state.flags.female ? 'her' : 'his'} first pet (${pet})`, { state });
    }
    state.u.uconduct.pets = (state.u.uconduct.pets || 0) + 1;
    return true;
}
export async function makePetWary(monster, { wasDead = true, state = game, random = rn2, publish = plineWithContinuation, repaint = newsym, } = {}) {
    if (!monster)
        return;
    finishMonsterEating(monster, state);
    if (monster.mtame === undefined || monster.mtame <= 0)
        return;
    const dog = monster.isminion
        ? null : monster.edog || monster.mextra?.edog;
    if (dog?.mhpmax_penalty) {
        monster.mhpmax = (monster.mhpmax ?? 1) + dog.mhpmax_penalty;
        monster.mhp = (monster.mhp ?? 1) + dog.mhpmax_penalty;
        dog.mhpmax_penalty = 0;
    }
    if (dog && (dog.killed_by_u === 1 || (dog.abuse ?? 0) > 2)) {
        monster.mtame = 0;
        monster.mpeaceful = 0;
        if ((dog.abuse ?? 0) >= 0 && (dog.abuse ?? 0) < 10
            && random((dog.abuse ?? 0) + 1) === 0) {
            monster.mpeaceful = 1;
        }
        if (!wasDead && cansee(monster.mx, monster.my) && heroHasEyes(state)) {
            const subject = monsterName(monster, { state, capitalized: true });
            const hasEyes = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x1000);
            await publish(hasEyes
                ? `${subject} ${monster.mpeaceful ? 'seems unable' : 'refuses'} to look you in the ${heroEyeName(state)}.`
                : `${subject} avoids your gaze.`);
        }
    }
    else {
        monster.mtame = random(monster.mtame + 1);
        if (!monster.mtame)
            monster.mpeaceful = random(2) === 0 ? 0 : 1;
    }
    monster.pet = monster.mtame > 0;
    if (!monster.mtame) {
        if (!wasDead && canSpotMonster(monster)) {
            const subject = monsterName(monster, { state, capitalized: true });
            await publish(`${subject} ${monster.mpeaceful ? 'is no longer tame' : 'has become feral'}.`);
        }
        repaint(monster.mx, monster.my);
        if (monster.mleashed)
            await releaseMonsterLeashWithFeedback(monster, { state, publish });
        if (state.u.usteed === monster)
            await dismountHero(DISMOUNT_THROWN, { state, announce: publish });
        return;
    }
    if (dog) {
        dog.revivals = (dog.revivals ?? 0) + 1;
        dog.killed_by_u = 0;
        dog.abuse = 0;
        dog.ogoal = { x: -1, y: -1 };
        const hungerFloor = (state.moves ?? 0) + 500;
        if (wasDead || (dog.hungrytime ?? 0) < hungerFloor)
            dog.hungrytime = hungerFloor;
        if (wasDead) {
            dog.droptime = 0;
            dog.dropdist = 10000;
            dog.whistletime = 0;
            dog.apport = 5;
        }
    }
}
// C newedog() allocates a zeroed record and sets its parent before initedog().
function newPetData(monster) {
    return {
        parentmid: monster.m_id, droptime: 0, dropdist: 0, apport: 0,
        whistletime: 0, hungrytime: 0, ogoal: { x: 0, y: 0 }, abuse: 0,
        revivals: 0, mhpmax_penalty: 0, killed_by_u: 0,
    };
}
//# sourceMappingURL=dog.js.map