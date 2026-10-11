// Level ambience and its resident checks. C ref: sounds.c:dosounds().
import { hallucinatedDeityName } from './alignment.js';
import { heroHairName, heroHeadName, heroNeckName } from './body_parts.js';
import { BARRACKS, BEEHIVE, COURT, Is_astralevel, MON_FLOOR, MORGUE, ROOMOFFSET, SHOPBASE, TEMPLE, VAULT, ZOO, } from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { requireInitializedGame } from './gstate.js';
import { heroIsUnaware } from './hero_sleep.js';
import { isRoom } from './map_types.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL, monsterIsAnimal, monsterIsUndead, monsterIsVampireShifter, } from './monster_data.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { GOLD_PIECE } from './object_data.js';
import { verbForSubject } from './object_grammar.js';
import { priestIsInOwnTemple } from './priest.js';
import { roomForRoomno } from './room.js';
import { findVaultGuard } from './vault_guard.js';
import { rn2 } from './rng.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { shopkeeperInOwnShop } from './shk.js';
import { cansee } from './vision.js';
const M1_FLY = 0x00000001;
const M2_LORD_OR_PRINCE = 0x00000c00;
const M2_MERC = 0x00000200;
const S_ANT = 1;
const MS_ANIMAL = 17;
export async function dosounds(state = requireInitializedGame()) {
    if (heroIsDeaf(state) || state.flags.acoustics === false
        || state.u.uswallow || state.u.underwater || state.underwater)
        return;
    const flags = state.level.flags;
    const hallu = Number(heroIsHallucinating(state));
    if (flags.nfountains && !rn2(400))
        await hearChoice(state, [
            'bubbling water.', 'water falling on coins.',
            'the splashing of a naiad.', 'a soda fountain!',
        ], rn2(3) + hallu);
    if (flags.nsinks && !rn2(300))
        await hearChoice(state, [
            'a slow drip.', 'a gurgling noise.', 'dishes being washed!',
        ], rn2(2) + hallu);
    if (flags.has_court && !rn2(200)) {
        const resident = livingResidents(state).find(monster => (monster.msleeping || (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_LORD_OR_PRINCE)
            && !monsterIsAnimal(monster) && monInRoom(monster, COURT, state));
        if (resident) {
            const selection = rn2(3) + hallu;
            if (selection === 2)
                await plineWithContinuation(`Someone shouts "Off with ${state.flags.female ? 'her' : 'his'} head!"`);
            else
                await hearChoice(state, [
                    'the tones of courtly conversation.',
                    'a sceptre pounded in judgment.', '', "Queen Beruthiel's cats!",
                ], selection);
            return;
        }
    }
    if (flags.has_swamp && !rn2(200)) {
        await plineWithContinuation(choice(['You hear mosquitoes!', 'You smell marsh gas!', 'You hear Donald Duck!'], rn2(2) + hallu));
        return;
    }
    if (flags.has_vault && !rn2(200)) {
        const vault = findSpecialRoom(VAULT, state);
        if (!vault) {
            flags.has_vault = false;
            return;
        }
        const occupied = heroOccupies(VAULT, state);
        const guard = !occupied && findVaultGuard(state);
        if (!occupied && !guard) {
            const selection = rn2(2) + hallu;
            if (selection === 1) {
                let gold = false;
                for (let x = vault.lx; x <= vault.hx; x++)
                    for (let y = vault.ly; y <= vault.hy; y++)
                        if (state.level.objects[x]?.[y]?.some(object => object.otyp === GOLD_PIECE))
                            gold = true;
                const message = gold
                    ? hallu ? 'the quarterback calling the play.' : 'someone counting gold coins.'
                    : 'someone searching.';
                await hear(state, message);
            }
            else {
                await hear(state, selection === 2 ? 'Ebenezer Scrooge!' : 'the footsteps of a guard on patrol.');
            }
        }
        return;
    }
    if (flags.has_beehive && !rn2(200)) {
        const bee = livingResidents(state).find(monster => MONSTER_SYMBOL[monster.mnum] === S_ANT
            && (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY
            && monInRoom(monster, BEEHIVE, state));
        if (bee) {
            await hearChoice(state, [
                'a low buzzing.', 'an angry drone.',
                `bees in your ${state.uarmh || state.u.uarmh ? '' : '(nonexistent) '}bonnet!`,
            ], rn2(2) + hallu);
            return;
        }
    }
    if (flags.has_morgue && !rn2(200)) {
        const undead = livingResidents(state).find(monster => (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster))
            && monInRoom(monster, MORGUE, state));
        if (undead) {
            const selection = rn2(2) + hallu;
            const hair = heroHairName(state);
            if (selection === 0)
                await plineWithContinuation('You suddenly realize it is unnaturally quiet.');
            else if (selection === 1)
                await plineWithContinuation(`The ${hair} on the back of your ${heroNeckName(state)} ${verbForSubject(hair, 'stand')} up.`);
            else
                await plineWithContinuation(`The ${hair} on your ${heroHeadName(state)} ${verbForSubject(hair, 'seem')} to stand up.`);
            return;
        }
    }
    if (flags.has_barracks && !rn2(200)) {
        let count = 0;
        for (const monster of [...state.level.monsters].reverse()) {
            if (monster.dead || monster.mhp <= 0)
                continue;
            if ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_MERC
                && monInRoom(monster, BARRACKS, state)
                && (monster.msleeping || ++count > 5)) {
                await hearChoice(state, [
                    'blades being honed.', 'loud snoring.',
                    'dice being thrown.', 'General MacArthur!',
                ], rn2(3) + hallu);
                return;
            }
        }
    }
    if (flags.has_zoo && !rn2(200)) {
        const animal = livingResidents(state).find(monster => (monster.msleeping || monsterIsAnimal(monster)) && monInRoom(monster, ZOO, state));
        if (animal) {
            await hearChoice(state, [
                'a sound reminiscent of an elephant stepping on a peanut.',
                'a sound reminiscent of a seal barking.', 'Doctor Dolittle!',
            ], rn2(2) + hallu);
            return;
        }
    }
    if (flags.has_shop && !rn2(200)) {
        const shop = findSpecialRoom(SHOPBASE, state);
        if (!shop) {
            flags.has_shop = false;
            return;
        }
        const keeper = shop.resident;
        if (keeper && shopkeeperInOwnShop(keeper, state)
            && !state.u.ushops.includes(shop.roomnoidx + ROOMOFFSET)) {
            await hearChoice(state, [
                'someone cursing shoplifters.', 'the chime of a cash register.',
                'Neiman and Marcus arguing!',
            ], rn2(2) + hallu);
            await wakeMonstersNearWithMessages(keeper.mx, keeper.my, 11 * 11, state);
        }
        return;
    }
    if (flags.has_temple && !rn2(200) && !Is_astralevel(state.u.uz)
        && !(state.sanctum_level?.dnum === state.u.uz.dnum && state.sanctum_level.dlevel === state.u.uz.dlevel)) {
        for (const priest of livingResidents(state)) {
            if (await templePriestSound(priest, state, hallu))
                return;
        }
    }
    const oracleLevel = state.oracle_level;
    if (oracleLevel?.dnum === state.u.uz.dnum && oracleLevel.dlevel === state.u.uz.dlevel && !rn2(400)) {
        const oracle = livingResidents(state).find(monster => MONSTER_NAME[monster.mnum] === 'Oracle');
        if (oracle && (hallu || !canSeeMonster(oracle)))
            await hearChoice(state, [
                'a strange wind.', 'convulsive ravings.', 'snoring snakes.',
                'someone say "No more woodchucks!"', 'a loud ZOT!',
            ], rn2(3) + hallu * 2);
    }
}
async function templePriestSound(priest, state, hallu) {
    const shrine = priest.epri ?? priest.mextra?.epri;
    if (!priest.ispriest || !shrine || !priestIsInOwnTemple(priest, state)
        || priest.msleeping || !priest.mcanmove
        || heroOccupies(TEMPLE, state) === shrine.shroom)
        return false;
    const speechless = (MONSTER_SOUND[priest.mnum] ?? 0) <= MS_ANIMAL;
    const inSight = canSeeMonster(priest) || cansee(shrine.shrpos.x, shrine.shrpos.y);
    const messages = [
        '*someone praising %s.', '*someone beseeching %s.',
        '#an animal carcass being offered in sacrifice.', '*a strident plea for donations.',
    ];
    let message = '';
    for (let attempt = 0; attempt < 50; attempt++) {
        message = choice(messages, rn2(3 + hallu));
        if (message.startsWith('*') && speechless || message.startsWith('#') && inSight)
            continue;
        break;
    }
    message = message.slice(1);
    if (message.includes('%s'))
        message = message.replace('%s', hallucinatedDeityName(shrine.shralign, state));
    await hear(state, message);
    return true;
}
function livingResidents(state) {
    // C get_iter_mons() tests mstate, not square occupancy: a mounted steed
    // remains on fmon with MON_FLOOR even though the hero shares its square.
    return [...state.level.monsters].reverse().filter(monster => !monster.dead && monster.mhp > 0 && (monster.mstate ?? MON_FLOOR) === MON_FLOOR);
}
function monInRoom(monster, type, state) {
    const roomno = state.level.at(monster.mx, monster.my)?.roomno ?? 0;
    return roomForRoomno(state.level, roomno)?.rtype === type;
}
function heroOccupies(type, state) {
    return state.u.urooms.find(roomno => roomForRoomno(state.level, roomno)?.rtype === type);
}
function findSpecialRoom(type, state) {
    return [...state.level.rooms, ...(state.level.subrooms ?? [])].find((room) => isRoom(room) && (type === SHOPBASE ? room.rtype >= SHOPBASE : room.rtype === type));
}
function choice(messages, selection) {
    const message = messages[selection];
    if (message === undefined)
        throw new RangeError(`Ambient choice ${selection} is outside ${messages.length} messages`);
    return message;
}
async function hearChoice(state, messages, selection) {
    await hear(state, choice(messages, selection));
}
async function hear(state, message) {
    await plineWithContinuation(`${heroIsUnaware(state) ? 'You dream that you hear' : 'You hear'} ${message}`);
}
//# sourceMappingURL=ambient_sounds.js.map