// Level ambience, its resident checks, and the #chat command.
// C ref: sounds.c:dosounds(), dochat().
import { hallucinatedDeityName } from './alignment.js';
import { heroHairName, heroHeadName, heroNeckName } from './body_parts.js';
import { ANY_SHOP, BARRACKS, BEEHIVE, COURT, Is_astralevel, MON_FLOOR, MORGUE, ROOMOFFSET, SHOPBASE, TEMPLE, VAULT, ZOO, IS_WALL, SDOOR, STRAT_WAITMASK, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, isok, } from './const.js';
import { canSeeMonster, canSpotMonster, map_invisible, randomDisplayMonsterName } from './display.js';
import { plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import { commandResultCancelled } from './command_state.js';
import { heroSpecies } from './hero_species.js';
import { monsterIsHumanoid, monsterTypeName } from './monster_data.js';
import { propertyIsActive } from './properties.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { quoteShopGoods } from './shop_price_quote.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { publishMonsterNoise } from './monster_sound.js';
import { monsterName } from './monster_name.js';
import { monsterAtPosition } from './monster_location.js';
import { heroIsBlind } from './senses.js';
import { STATUE } from './object_data.js';
import { requireInitializedGame } from './gstate.js';
import { publishHeardMessage } from './hero_speech.js';
import { searchSpecial } from './mkroom.js';
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
        || state.u.uswallow || state.u.uinwater || state.u.underwater || state.underwater)
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
        const vault = searchSpecial(VAULT, state);
        if (!vault) {
            flags.has_vault = false;
            return;
        }
        const occupied = heroOccupies(VAULT, state);
        const guard = !occupied && await findVaultGuard(state);
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
        const shop = searchSpecial(ANY_SHOP, state);
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
    await publishHeardMessage(message, plineWithContinuation, state);
}
// C sounds.c:dochat().
export async function dochat() {
    const species = heroSpecies(game);
    let refusal = null;
    if (MONSTER_SOUND[species] === 0)
        refusal = `As ${withIndefiniteArticle(monsterTypeName(species, !!game.flags.female))}, you cannot speak.`;
    else if (propertyIsActive('strangled', game))
        refusal = "You can't speak.  You're choking!";
    else if (game.u.uswallow)
        refusal = "They won't hear you out there.";
    else if (game.u.uinwater)
        refusal = 'Your speech is unintelligible underwater.';
    if (refusal) {
        await plineWithContinuation(refusal);
        game.context.move = 0;
        return;
    }
    if (await quoteShopGoods()) {
        game.context.move = 1;
        return;
    }
    const direction = await promptDirection((_message, retry) => readDirectionKey('Talk to whom? (in what direction) ', retry));
    if (!direction) {
        commandResultCancelled(); // sounds.c:dochat() returns ECMD_CANCEL.
        return;
    }
    const steed = game.u.usteed;
    if (steed && direction.dz > 0) {
        if (steed.msleeping || !steed.mcanmove) {
            await plineWithContinuation(`${monsterName(steed, { capitalized: true })} seems not to notice you.`);
            game.context.move = 1;
        }
        else {
            game.context.move = Number(await publishMonsterNoise(steed, game));
        }
        return;
    }
    game.context.move = 0;
    if (direction.dz) {
        await plineWithContinuation(`They won't hear you ${direction.dz < 0 ? 'up' : 'down'} there.`);
        return;
    }
    if (!direction.dx && !direction.dy) {
        await plineWithContinuation('Talking to yourself is a bad habit for a dungeoneer.');
        return;
    }
    const x = game.u.ux + direction.dx;
    const y = game.u.uy + direction.dy;
    if (!isok(x, y))
        return;
    const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
    if (!monster || monster.mundetected) {
        const topObject = game.level?.objects[x]?.[y]?.[0];
        const loc = game.level?.at(x, y);
        if (topObject?.otyp === STATUE) {
            if (!heroIsBlind(game))
                await plineWithContinuation(`The ${heroIsHallucinating(game) ? randomDisplayMonsterName() : 'statue'} seems not to notice you.`);
        }
        else if (!heroIsDeaf(game) && loc && (IS_WALL(loc.typ) || loc.typ === SDOOR)
            && (!heroIsBlind(game) || IS_WALL(loc.lastseentyp))) {
            if (!heroIsHallucinating(game)) {
                await plineWithContinuation("It's like talking to a wall.");
            }
            else {
                const wallTalk = [
                    'gripes about its job.', 'tells you a funny joke!',
                    'insults your heritage!', 'chuckles.', 'guffaws merrily!',
                    'deprecates your exploration efforts.', 'suggests a stint of rehab...',
                    "doesn't seem to be interested.",
                ];
                await plineWithContinuation(`The wall ${wallTalk[Math.min(rn2(10), wallTalk.length - 1)]}`);
            }
        }
        return;
    }
    if (M_AP_TYPE(monster) === M_AP_FURNITURE || M_AP_TYPE(monster) === M_AP_OBJECT)
        return;
    if (!monster.ispriest && (monster.msleeping || !monster.mcanmove)) {
        if (canSpotMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} seems not to notice you.`);
        return;
    }
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!heroIsDeaf(game) && monster.mtame && monster.meating) {
        if (!canSpotMonster(monster))
            await map_invisible(monster.mx, monster.my);
        await plineWithContinuation(`${monsterName(monster, { capitalized: true })} is eating noisily.`);
        return;
    }
    if (heroIsDeaf(game)) {
        const response = monsterIsHumanoid(species)
            ? 'falls on deaf ears' : 'is inaudible';
        // Native calls canspotmon() for each fragment but names the target once.
        await plineWithContinuation(`Any response${canSpotMonster(monster) ? ` from ${monsterName(monster)}` : ''} ${response}.`);
        return;
    }
    game.context.move = Number(await publishMonsterNoise(monster, game));
}
//# sourceMappingURL=ambient_sounds.js.map