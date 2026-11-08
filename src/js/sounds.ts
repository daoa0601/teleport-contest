// Level ambience, its resident checks, the #chat command, helmet tipping,
// and monster noises and speech. C ref: sounds.c:dosounds(), dochat(),
// responsive_mon_at(), tipherat(), domonnoise(), growl(), yelp(), whimper(),
// beg(), growl_sound().

import { WEAPON_CLASS } from './objclass.js';
import { sessionIsNight } from './calendar.js';
import { hallucinatedDeityName } from './pray.js';

import { ANY_SHOP, BARRACKS, BEEHIVE, BOLT_LIM, COURT, IRONBARS, Is_astralevel, MON_FLOOR, MORGUE, ROOMOFFSET, TEMPLE, VAULT, W_ARMH, ZOO, IS_WALL, SDOOR, STRAT_WAITMASK, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, In_endgame, PLNMSG_GROWL, Upolyd, NECK, HEAD, HAIR, BLOOD } from './const.js';
import { isok, commandResultCancelled, promptDirection } from './cmd.js';
import { canSeeMonster, canSpotMonster, glyphAt, map_invisible } from './display.js';
import { plineWithContinuation, plineWithContinuation as pline, publishHeardMessage } from './pline.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame, requireInitializedGame } from './gstate.js';
import { nomul, heroGoldAmount, roomForRoomno, stopRun } from './hack.js';
import { heroPolyGender, heroSpecies, body_part } from './polyself.js';
import { MONSTER_LEVEL, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL } from './monster_data.js';
import { propertyIsActive } from './properties.js';
import { verbForSubject, withIndefiniteArticle } from './objnam.js';
import { monsterName, novelTitle, randomDisplayMonsterName, monsterTypeName } from './do_name.js';
import {
    monsterPossessive, sameMonsterRace, carnivorous, herbivorous, is_dwarf, is_elf, is_gnome, is_lord,
    is_mercenary, is_minion, is_prince, likes_magic, monsterHasEyes, monsterIsAnimal, monsterIsFlyer,
    monsterIsHelpless, monsterIsHumanoid, monsterIsPlayerMonster, monsterIsSilent, monsterIsUndead,
    monsterIsVampireShifter, monsterPerceives, monsterIsEel,
} from './mondata.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating, heroIsUnderwater } from './senses.js';
import { STATUE, SPE_NOVEL, GOLD_PIECE } from './object_data.js';
import { isWeaponTool } from './object_properties.js';
import { monsterAtPosition } from './steed.js';
import { armorSimpleName } from './do_wear.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { isAccessibleAt } from './monmove.js';
import { couldsee } from './vision.js';
import type { GameObject } from './object_types.js';
import { searchSpecial } from './mkroom.js';
import { wakeMonstersNearWithMessages, livingResidents } from './mon.js';
import { priestIsInOwnTemple, monsterAlignmentType } from './priest.js';
import { findVaultGuard } from './vault.js';
import { rn1, rn2, rnd } from './rng.js';
import { recorderLocalHour } from './calendar.js';
import { currency } from './invent.js';
import { roles } from './role.js';
import { chatWithQuestCharacter } from './quest.js';
import { questMonsterSound } from './role_monsters.js';
import { consultOracle } from './rumors.js';
import { demandDemonBribe } from './minion.js';
import { DEATH_QUOTES } from './death_quotes.js';
import { doseduce } from './mhitu.js';
import { selectTributePassage } from './novel_tribute.js';
import { could_seduce } from './mhitu.js';
import { talkToPriest } from './priest.js';
import { aggravateMonsters, publishMonsterCuss } from './wizard.js';
import { AT_TUCH, AD_SSEX } from './monster_attack_types.js';
import type { GameState, PlayingGameState } from './game_state.js';
import { shopkeeperInOwnShop, quoteShopGoods, chatWithShopkeeper } from './shk.js';
import { cansee } from './vision.js';
import type { Monster } from './monster_types.js';
import { playerMonsterReply } from './mplayer.js';

const S_ANT = 1;
const MS_ANIMAL = 17;

// C sounds.c:dosounds()
// Also C vault.c:gd_sound(): occupied-vault and guard checks are inlined here
// Periodic ambient noise. The shop branch's
// wake_nearto() over an 11-square radius is C shk.c:noisy_shop() inlined.
// C sounds.c:throne_mon_sound(), beehive_mon_sound(), morgue_mon_sound(),
// zoo_mon_sound(), and oracle_sound(): the per-room resident tests are the
// find() branches below; C's get_iter_mons() walkers became livingResidents().
export async function dosounds(state: PlayingGameState = requireInitializedGame()): Promise<void> {
    if (heroIsDeaf(state) || state.flags.acoustics === false
        || state.u.uswallow || heroIsUnderwater(state)) return;
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
        const resident = livingResidents(state).find(monster =>
            (monster.msleeping || (is_lord(monster.mnum) || is_prince(monster.mnum)))
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
                        if (state.level.objects[x]?.[y]?.some(object => object.otyp === GOLD_PIECE)) gold = true;
                const message = gold
                    ? hallu ? 'the quarterback calling the play.' : 'someone counting gold coins.'
                    : 'someone searching.';
                await publishHeardMessage(message, plineWithContinuation, state);
            } else {
                await publishHeardMessage(
                    selection === 2 ? 'Ebenezer Scrooge!' : 'the footsteps of a guard on patrol.',
                    plineWithContinuation, state);
            }
        }
        return;
    }
    if (flags.has_beehive && !rn2(200)) {
        const bee = livingResidents(state).find(monster =>
            MONSTER_SYMBOL[monster.mnum] === S_ANT
            && monsterIsFlyer(monster.mnum)
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
        const undead = livingResidents(state).find(monster =>
            (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster))
            && monInRoom(monster, MORGUE, state));
        if (undead) {
            const selection = rn2(2) + hallu;
            const hair = body_part(HAIR, state);
            if (selection === 0)
                await plineWithContinuation('You suddenly realize it is unnaturally quiet.');
            else if (selection === 1)
                await plineWithContinuation(`The ${hair} on the back of your ${body_part(NECK, state)} ${verbForSubject(hair, 'stand')} up.`);
            else
                await plineWithContinuation(`The ${hair} on your ${body_part(HEAD, state)} ${verbForSubject(hair, 'seem')} to stand up.`);
            return;
        }
    }
    if (flags.has_barracks && !rn2(200)) {
        let count = 0;
        for (const monster of [...state.level.monsters].reverse()) {
            if (monster.dead || monster.mhp <= 0) continue;
            if (is_mercenary(monster.mnum)
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
        const animal = livingResidents(state).find(monster =>
            (monster.msleeping || monsterIsAnimal(monster)) && monInRoom(monster, ZOO, state));
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
            if (await templePriestSound(priest, state, hallu)) return;
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

// C sounds.c:temple_priest_sound()
async function templePriestSound(priest: Monster, state: PlayingGameState, hallu: number): Promise<boolean> {
    const shrine = priest.epri ?? priest.mextra?.epri;
    if (!priest.ispriest || !shrine || !priestIsInOwnTemple(priest, state)
        || priest.msleeping || !priest.mcanmove
        || heroOccupies(TEMPLE, state) === shrine.shroom) return false;
    const speechless = (MONSTER_SOUND[priest.mnum] ?? 0) <= MS_ANIMAL;
    const inSight = canSeeMonster(priest) || cansee(shrine.shrpos.x, shrine.shrpos.y);
    const messages = [
        '*someone praising %s.', '*someone beseeching %s.',
        '#an animal carcass being offered in sacrifice.', '*a strident plea for donations.',
    ];
    let message = '';
    for (let attempt = 0; attempt < 50; attempt++) {
        message = choice(messages, rn2(3 + hallu));
        if (message.startsWith('*') && speechless || message.startsWith('#') && inSight) continue;
        break;
    }
    message = message.slice(1);
    if (message.includes('%s'))
        message = message.replace('%s', hallucinatedDeityName(shrine.shralign, state));
    await publishHeardMessage(message, plineWithContinuation, state);
    return true;
}


// C sounds.c:mon_in_room()
function monInRoom(monster: Monster, type: number, state: PlayingGameState): boolean {
    const roomno = state.level.at(monster.mx, monster.my)?.roomno ?? 0;
    return roomForRoomno(state.level, roomno)?.rtype === type;
}

// Part of C priest.c:temple_occupied()/vault.c:vault_occupied(): the
// u.urooms walk testing a room type.
function heroOccupies(type: number, state: PlayingGameState): number | undefined {
    return state.u.urooms.find(roomno => roomForRoomno(state.level, roomno)?.rtype === type);
}

// Port only: validate an ambient-message table index.
function choice(messages: readonly string[], selection: number): string {
    const message = messages[selection];
    if (message === undefined) throw new RangeError(`Ambient choice ${selection} is outside ${messages.length} messages`);
    return message;
}

// Port only: publish an indexed ambient message through the hearing boundary.
async function hearChoice(state: PlayingGameState, messages: readonly string[], selection: number): Promise<void> {
    await publishHeardMessage(choice(messages, selection), plineWithContinuation, state);
}

// C sounds.c:dochat()
// Also C sounds.c:dotalk(): command dispatch calls dochat directly
export async function dochat() {
    const species = heroSpecies(game);
    let refusal: string | null = null;
    if (monsterIsSilent(species))
        refusal = `As ${withIndefiniteArticle(monsterTypeName(species, !!game.flags.female))}, you cannot speak.`;
    else if (propertyIsActive('strangled', game)) refusal = "You can't speak.  You're choking!";
    else if (game.u.uswallow) refusal = "They won't hear you out there.";
    else if (game.u.uinwater) refusal = 'Your speech is unintelligible underwater.';
    if (refusal) {
        await plineWithContinuation(refusal);
        game.context.move = 0;
        return;
    }
    if (await quoteShopGoods()) {
        game.context.move = 1;
        return;
    }
    const direction = await promptDirection('Talk to whom? (in what direction) ');
    if (!direction) {
        commandResultCancelled(); // sounds.c:dochat() returns ECMD_CANCEL.
        return;
    }
    const steed = game.u.usteed;
    if (steed && direction.dz > 0) {
        if (steed.msleeping || !steed.mcanmove) {
            await plineWithContinuation(`${monsterName(steed, { capitalized: true })} seems not to notice you.`);
            game.context.move = 1;
        } else {
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
    if (!isok(x, y)) return;
    const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
    if (!monster || monster.mundetected) {
        const topObject = game.level?.objects[x]?.[y]?.[0];
        const loc = game.level?.at(x, y);
        if (topObject?.otyp === STATUE) {
            if (!heroIsBlind(game))
                await plineWithContinuation(`The ${heroIsHallucinating(game) ? randomDisplayMonsterName() : 'statue'} seems not to notice you.`);
        } else if (!heroIsDeaf(game) && loc && (IS_WALL(loc.typ) || loc.typ === SDOOR)
            && (!heroIsBlind(game) || IS_WALL(loc.lastseentyp))) {
            if (!heroIsHallucinating(game)) {
                await plineWithContinuation("It's like talking to a wall.");
            } else {
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
        if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
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

interface TipRecipient {
    monster: Monster | null;
    visible: boolean;
    unseen: boolean;
    statue: boolean;
    x: number;
    y: number;
}

// C sounds.c:tiphat().
// C sounds.c:responsive_mon_at().
export async function tipWornHelmet(helmet: GameObject): Promise<boolean> {
    const discovery = !helmet.bknown;
    if (helmet.cursed) {
        await pline(`You can't.  ${helmet.quan > 1 ? 'They are' : 'It is'} cursed.`);
        helmet.bknown = true;
        return discovery;
    }
    const direction = await promptDirection('At whom? (in what direction) ');
    if (!direction) return discovery;
    await pline(`You briefly doff your ${armorSimpleName(helmet)}.`);
    if (!direction.dx && !direction.dy) {
        const steed = game.u.usteed;
        if (steed && direction.dz > 0) {
            if (monsterIsHelpless(steed))
                await pline(`${monsterName(steed, { capitalized: true })} doesn't notice.`);
            else await publishMonsterNoise(steed);
        } else if (direction.dz)
            await pline(`There's no one ${direction.dz < 0 ? 'up' : 'down'} there.`);
        else await pline("The lout here doesn't acknowledge you...");
        return true;
    }
    await acknowledgeHelmetTip(findTipRecipient(direction.dx, direction.dy));
    return true;
}

// Part of C sounds.c:tiphat(): scan along the chosen direction for a recipient.
function findTipRecipient(dx: number, dy: number): TipRecipient {
    const level = requireGameLevel();
    let target: TipRecipient = { monster: null, visible: false, unseen: false,
        statue: false, x: game.u.ux, y: game.u.uy };
    for (let range = 1; range <= BOLT_LIM + 1; range++) {
        const x = target.x + dx, y = target.y + dy;
        if (!isok(x, y) || range > 1 && !couldsee(x, y)) break;
        let monster = monsterAtPosition(level, x, y);
        let visible = !!monster && canSeeMonster(monster);
        const glyph = glyphAt(x, y);
        const unseen = glyph?.kind === 'invisible';
        const statue = glyph?.kind === 'object' && !!glyph.statueGlyph
            || !visible && !unseen && level.objects[x]?.[y]?.[0]?.otyp === STATUE;
        if (visible && monster && [M_AP_FURNITURE, M_AP_OBJECT].includes(M_AP_TYPE(monster))) {
            visible = false;
            monster = null;
        }
        target = { monster, visible, unseen, statue, x, y };
        if (visible || unseen || statue && heroIsHallucinating()
            || range === 1 && monster && canAcknowledgeTip(monster, x, y)
                && (MONSTER_SOUND[monster.mnum] ?? 0) !== 0
            || !(isAccessibleAt(x, y) || level.at(x, y)?.typ === IRONBARS)) break;
    }
    return target;
}

// Part of C sounds.c:tiphat(): publish the recipient's response.
async function acknowledgeHelmetTip({ monster, visible, unseen, statue, x, y }: TipRecipient): Promise<void> {
    if (unseen || statue && heroIsHallucinating()) {
        await pline(`That ${unseen ? 'unseen ' : ''}creature is ignoring you!`);
        return;
    }
    if (!monster || !canAcknowledgeTip(monster, x, y)) {
        await pline(visible && monster
            ? `${monsterName(monster, { capitalized: true })} seems not to notice you.`
            : 'Nothing happens.');
        return;
    }
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (visible && monsterIsHumanoid(monster.mnum)) {
        if (monster.mpeaceful && !propertyIsActive('conflict', game)) {
            const helmet = (monster.minvent ?? monster.inventory ?? [])
                .find(object => (object.owornmask ?? 0) & W_ARMH);
            const name = monsterName(monster, { capitalized: true });
            if (!helmet) await pline(`${name} waves.`);
            else if (helmet.cursed) {
                await pline(`${name} grasps ${monsterPossessive(monster)} ${armorSimpleName(helmet)} but can't remove it.`);
                helmet.bknown = true;
            } else await pline(`${name} tips ${monsterPossessive(monster)} ${armorSimpleName(helmet)} in response.`);
        } else {
            const reactions = ['curses', 'gestures rudely', 'gestures offensively'];
            const deaf = heroIsDeaf();
            const which = deaf ? rn1(2, 1) : rn2(3);
            const twice = deaf || which > 0 || rn2(3) ? 0 : rn1(2, 1);
            await pline(`${monsterName(monster, { capitalized: true })} ${reactions[which]}${twice ? ` and ${reactions[twice]}` : ''} at you...`);
        }
        return;
    }
    if (Math.abs(x - game.u.ux) <= 1 && Math.abs(y - game.u.uy) <= 1
        && !heroIsDeaf() && await publishMonsterNoise(monster)) {
        if (!visible) await map_invisible(x, y);
    } else await pline(visible ? `${monsterName(monster, { capitalized: true })} doesn't respond.`
        : 'Nothing happens.');
}

// C sounds.c:responsive_mon_at(): test whether the target monster can respond.
function canAcknowledgeTip(monster: Monster, x: number, y: number): boolean {
    return !monsterIsHelpless(monster) && !!monster.mcansee && monsterHasEyes(monster.mnum)
        && (!heroIsInvisible(game) || monsterPerceives(monster.mnum))
        && monster.mx === x && monster.my === y;
}

// ---------------------------------------------------------------------------
// C sounds.c:domonnoise(), growl(), yelp(), whimper(), beg(), growl_sound().
// Pet begging and animal noises shared by #chat and mounted breath fallback.
const MS_SILENT = 0;
const MS_BARK = 1;
const MS_MEW = 2;
const MS_ROAR = 3;
const MS_BELLOW = 4;
const MS_GROWL = 5;
const MS_SQEEK = 6;
const MS_SQAWK = 7;
const MS_CHIRP = 8;
const MS_HISS = 9;
const MS_BUZZ = 10;
const MS_GRUNT = 11;
const MS_NEIGH = 12;
const MS_MOO = 13;
const MS_WAIL = 14;
const MS_GURGLE = 15;
const MS_BURBLE = 16;
const MS_TRUMPET = 17;
const MS_HUMANOID = 25;
const MS_ORC = 24;
const MS_LEADER = 36;
const MS_NEMESIS = 37;
const MS_ORACLE = 40;
const MS_GUARDIAN = 38;
const MS_GROAN = 44;

const MS_SELL = 39;
const PM_DINGO = MONSTER_NAME.indexOf('dingo');
const PM_RAVEN = MONSTER_NAME.indexOf('raven');
const PM_GECKO = MONSTER_NAME.indexOf('gecko');
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');

// C sounds.c:growl_sound(). Summoning uses the same noise while unseen.
export function monsterGrowlSound(monster: Monster): string {
    switch (MONSTER_SOUND[monster.mnum] ?? MS_SILENT) {
    case MS_MEW: case MS_HISS: return 'hiss';
    case MS_BARK: case MS_GROWL: return 'growl';
    case MS_ROAR: return 'roar';
    case MS_BELLOW: return 'bellow';
    case MS_BUZZ: return 'buzz';
    case MS_SQEEK: return 'squeal';
    case MS_SQAWK: return 'screech';
    case MS_NEIGH: return 'neigh';
    case MS_WAIL: return 'wail';
    case MS_GROAN: return 'groan';
    case MS_MOO: return 'low';
    case MS_SILENT: return 'commotion';
    default: return 'scream';
    }
}

// C sounds.c:beg(). Speech is deliberately not gated by deafness here:
// native verbalize() publishes text; only domonnoise() has a hearing guard.
export async function begForFood(monster: Monster, state: GameState): Promise<void> {
    requireLiveGame(state);
    if (monster.msleeping || !monster.mcanmove
        || !(carnivorous(monster.mnum) || herbivorous(monster.mnum)))
        return;

    const sound = MONSTER_SOUND[monster.mnum] ?? MS_SILENT;
    if (sound !== MS_SILENT && sound <= MS_ANIMAL) {
        await publishMonsterNoise(monster, state);
    } else if (sound >= MS_HUMANOID) {
        if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
        await plineWithContinuation('"I\'m hungry."');
    } else if (canSpotMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, {
            capitalized: true, state,
        })} seems famished.`);
    }
}

// C sounds.c:cry_sound(): the hatchling cry used by the mommy/daddy message.
export function hatchlingCry(mnum: number): string {
    const sound = MONSTER_SOUND[mnum] ?? 0;
    if (sound === 9) return 'hiss';
    if (sound === 3 || sound === 5) return 'growl';
    if (sound === 8) return 'chirp';
    if (sound === 10) return 'buzz';
    if (sound === 7) return 'screech';
    if (sound === 11) return 'grunt';
    if (sound === 21) return 'mumble';
    return monsterIsEel(mnum) ? 'gurgle' : 'chitter';
}

// C sounds.c:domonnoise(). A true result spends a chat turn even if quiet.
export async function publishMonsterNoise(
    monster: Monster, state: GameState = game,
): Promise<boolean> {
    requireLiveGame(state);
    requirePlayingGame(state);
    let sound = questMonsterSound(monster.mnum, state);
    if (heroIsDeaf(state) || sound === MS_SILENT && !monster.isshk) return false;

    const hallucinating = heroIsHallucinating(state);
    if (monster.m_id === state.quest_status?.leader_m_id && sound > MS_ANIMAL)
        sound = MS_LEADER;
    else if (sound === MS_GUARDIAN && monster.mnum !== state.urole.guardnum) {
        const role = roles.find(role => role.guardnum === monster.mnum);
        if (!role) throw new Error(`Quest guardian ${monster.mnum} has no role`);
        sound = MONSTER_SOUND[MONSTER_NAME.indexOf('archeologist') + role.mnum] ?? MS_SILENT;
    } else if (monster.isshk) sound = MS_SELL;
    else if (sound === MS_ORC
        && (sameMonsterRace(monster.mnum, heroSpecies(state))
            || sameMonsterRace(monster.mnum, state.urace.mnum)
            || hallucinating))
        sound = MS_HUMANOID;
    else if (sound === MS_MOO && !monster.mtame) sound = MS_BELLOW;
    else if (hallucinating && looksLikeGecko(monster, state)) sound = MS_SELL;
    if (!canSpotMonster(monster)) await map_invisible(monster.mx, monster.my);
    if (sound === MS_ORACLE) return consultOracle(monster, state);
    if (sound === MS_LEADER || sound === MS_NEMESIS || sound === MS_GUARDIAN) {
        await chatWithQuestCharacter(monster, state);
        return true;
    }
    if (sound === MS_SELL) {
        if (!hallucinating || monsterIsSilent(monster.mnum) || monster.isshk && rn2(2) === 0)
            await chatWithShopkeeper(monster, state);
        else
            await plineWithContinuation(`"15 minutes could save you 15 ${currency(15, { state })}."`);
        return true;
    }
    if (sound > MS_ANIMAL) return publishMonsterConversation(monster, sound, state);

    let noise: string | null;
    switch (sound) {
    case MS_BARK:
        noise = bark(monster, state);
        break;
    case MS_MEW:
        noise = mew(monster, state);
        break;
    case MS_ROAR:
        noise = monster.mpeaceful ? 'snarls.' : 'roars!';
        break;
    case MS_BELLOW:
        noise = 'bellows!';
        break;
    case MS_GROWL:
        noise = monster.mpeaceful ? 'snarls.' : 'growls!';
        break;
    case MS_SQEEK:
        noise = 'squeaks.';
        break;
    case MS_SQAWK:
        if (monster.mnum === PM_RAVEN && !monster.mpeaceful) {
            await plineWithContinuation('"Nevermore!"');
            return true;
        }
        noise = 'squawks.';
        break;
    case MS_CHIRP:
        noise = 'chirps.';
        break;
    case MS_HISS:
        if (monster.mpeaceful) return false;
        noise = 'hisses!';
        break;
    case MS_BUZZ:
        noise = monster.mpeaceful ? 'drones.' : 'buzzes angrily.';
        break;
    case MS_GRUNT:
        noise = 'grunts.';
        break;
    case MS_NEIGH:
        noise = (monster.mtame ?? 0) < 5 ? 'neighs.'
            : state.moves > (monster.edog?.hungrytime ?? 0) ? 'whinnies.' : 'whickers.';
        break;
    case MS_MOO:
        noise = monster.mtame ? 'moos.' : 'bellows!';
        break;
    case MS_WAIL:
        noise = 'wails mournfully.';
        break;
    case MS_GURGLE:
        noise = 'gurgles.';
        break;
    case MS_BURBLE:
        noise = 'burbles.';
        break;
    case MS_TRUMPET:
        noise = 'trumpets!';
        await wakeMonstersNearWithMessages(monster.mx, monster.my, 11 * 11, state);
        break;
    default:
        return false;
    }
    if (noise) await plineWithContinuation(`${monsterName(monster, {
        capitalized: true, state,
    })} ${noise}`);
    return true;
}

// Part of C sounds.c:domonnoise(): canine sound selection.
function bark(monster: Monster, state: GameState): string | null {
    if (state.flags.moonphase === 4 && sessionIsNight(state.datetime)) return 'howls.';
    if (!monster.mpeaceful) return 'growls.';
    const hungryTime = monster.edog?.hungrytime ?? 0;
    if (monster.mtame && (monster.mconf || monster.mflee || monster.mtrapped
        || state.moves > hungryTime || monster.mtame < 5)) return 'whines.';
    if (monster.mtame && hungryTime > state.moves + 1000) return 'yips.';
    return monster.mnum === PM_DINGO ? null : 'barks.';
}

// Part of C sounds.c:domonnoise(): feline sound selection.
function mew(monster: Monster, state: GameState): string {
    if (!monster.mtame) return monster.mpeaceful ? 'snarls.' : 'growls!';
    if (monster.mconf || monster.mflee || monster.mtrapped || monster.mtame < 5)
        return 'yowls.';
    const hungryTime = monster.edog?.hungrytime ?? 0;
    if (state.moves > hungryTime) return 'meows.';
    return hungryTime > state.moves + 1000 ? 'purrs.' : 'mews.';
}

// C sounds.c:mon_is_gecko(): a real gecko, or a hallucinated or mimicked
// map spot that depicts one.
function looksLikeGecko(monster: Monster, state: GameState): boolean {
    if (monster.mnum === PM_GECKO) return true;
    if (monster.mnum === PM_LONG_WORM) return false;
    const glyph = glyphAt(monster.mx, monster.my, state);
    return glyph?.kind === 'monster' && glyph.mnum === PM_GECKO;
}

// C sounds.c:h_sounds[] — hallucinated noise verbs, shared by growl(),
// yelp() and whimper().
const HALLUCINATED_GROWL_VERBS = [
    'beep', 'boing', 'sing', 'belche', 'creak', 'cough',
    'rattle', 'ululate', 'pop', 'jingle', 'sniffle', 'tinkle',
    'eep', 'clatter', 'hum', 'sizzle', 'twitter', 'wheeze',
    'rustle', 'honk', 'lisp', 'yodel', 'coo', 'burp', 'moo',
    'boom', 'murmur', 'oink', 'quack', 'rumble', 'twang',
    'toot', 'gargle', 'hoot', 'warble',
];

// Part of C objnam.c:vtense(): third-person verb endings used by monster noises.
function thirdPersonSoundVerb(verb: string) {
    return /(?:s|sh|ch|x|z)$/.test(verb) ? `${verb}es` : `${verb}s`;
}

// C sounds.c:growl(). The sounds of a seriously abused pet, including the
// player attacking it.
export async function publishMonsterGrowl(monster: Monster) {
    const sound = questMonsterSound(monster.mnum);
    if (monster.msleeping || !monster.mcanmove || !sound)
        return game._lastPlineKind === PLNMSG_GROWL;

    const verb = heroIsHallucinating()
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : monsterGrowlSound(monster);
    if (!verb) throw new Error('Missing hallucinated growl verb.');
    const noticed = canSeeMonster(monster) || !heroIsDeaf();
    if (noticed) {
        await plineWithContinuation(
            `${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}!`,
        );
        game._lastPlineKind = PLNMSG_GROWL;
        if (game.context.run) stopRun();
    }
    await wakeMonstersNearWithMessages(
        monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 18,
    );
    return game._lastPlineKind === PLNMSG_GROWL;
}

// C sounds.c:yelp(). The sounds of mistreated pets.
export async function publishMonsterYelp(monster: Monster) {
    const sound = questMonsterSound(monster.mnum);
    if (monster.msleeping || !monster.mcanmove || !sound) return;

    const deaf = heroIsDeaf();
    const ordinaryVerb = new Map([
        [MS_BARK, deaf ? 'recoil' : 'yelp'],
        [MS_MEW, deaf ? 'arch' : 'yowl'],
        [MS_ROAR, deaf ? 'bluff' : 'snarl'],
        [MS_GROWL, deaf ? 'recoil' : 'yelp'],
        [MS_SQEEK, deaf ? 'quiver' : 'squeal'],
        [MS_SQAWK, deaf ? 'thrash' : 'screak'],
        [MS_WAIL, deaf ? 'cringe' : 'wail'],
    ]).get(sound);
    const verb = heroIsHallucinating()
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : ordinaryVerb;
    if (!verb) return;

    await plineWithContinuation(
        `${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}!`,
    );
    if (game.context.run) stopRun();
    await wakeMonstersNearWithMessages(
        monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 12,
    );
}

// C sounds.c:whimper(). The sounds of distressed pets.
export async function publishMonsterWhimper(monster: Monster) {
    const sound = questMonsterSound(monster.mnum);
    if (monster.msleeping || !monster.mcanmove || !sound) return;
    const verb = heroIsHallucinating()
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : sound === MS_MEW || sound === MS_GROWL ? 'whimper'
            : sound === MS_BARK ? 'whine' : sound === MS_SQEEK ? 'squeal' : null;
    if (!verb) return;
    await plineWithContinuation(`${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}.`);
    if (game.context.run) stopRun();
    await wakeMonstersNearWithMessages(monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 6);
}

// Speech and non-animal noises in C sounds.c:domonnoise().
const MS_SHRIEK = 18;
const MS_BONES = 19;
const MS_LAUGH = 20;
const MS_MUMBLE = 21;
const MS_IMITATE = 22;
const MS_WERE = 23;
const MS_ARREST = 26;
const MS_SOLDIER = 27;
const MS_GUARD = 28;
const MS_DJINNI = 29;
const MS_NURSE = 30;
const MS_SEDUCE = 31;
const MS_VAMPIRE = 32;
const MS_BRIBE = 33;
const MS_CUSS = 34;
const MS_RIDER = 35;
const MS_PRIEST = 41;
const MS_SPELL = 42;
const MS_BOAST = 43;

const S_CENTAUR = 29;
const S_NYMPH = 14;

interface MonsterReply {
    action?: string;
    speech?: string;
}

// Part of C sounds.c:domonnoise(): speaking-monster branches and reply publication.
export async function publishMonsterConversation(
    monster: Monster, sound: number, state: PlayingGameState,
): Promise<boolean> {
    const species = MONSTER_NAME[monster.mnum];
    let reply: MonsterReply = {};
    switch (sound) {
    case MS_PRIEST:
        await talkToPriest(monster, state);
        break;
    case MS_GROAN:
        if (!rn2(3)) reply.action = 'groans.';
        break;
    case MS_SHRIEK:
        aggravateMonsters(state);
        reply.action = 'shrieks.';
        break;
    case MS_IMITATE:
        reply.action = 'imitates you.';
        break;
    case MS_BONES:
        await pline(`${monsterName(monster, { capitalized: true, state })} rattles noisily.`);
        await pline('You freeze for a moment.');
        nomul(-2, state);
        state._helplessReason = 'scared by rattling';
        state._helplessDoneMessage = null;
        break;
    case MS_LAUGH:
        reply.action = select(['giggles.', 'chuckles.', 'snickers.', 'laughs.']);
        break;
    case MS_MUMBLE:
        reply.action = 'mumbles incomprehensibly.';
        break;
    case MS_ORC:
        reply.action = 'grunts.';
        break;
    case MS_DJINNI:
        if (monster.mtame) reply.speech = "Sorry, I'm all out of wishes.";
        else if (monster.mpeaceful) {
            if (species === 'water demon') reply.action = 'gurgles.';
            else reply.speech = "I'm free!";
        } else reply.speech = species === 'prisoner' ? 'Get me out of here.'
            : 'This will teach you not to disturb me!';
        break;
    case MS_WERE:
        if (state.flags.moonphase === 4 && sessionIsNight(state.datetime) !== !rn2(13)) {
            const name = monsterName(monster, { capitalized: true, state });
            const possessive = monsterPossessive(monster, { state });
            await pline(`${name} throws back ${possessive} head and lets out a blood curdling ${species === 'wererat' ? 'shriek' : 'howl'}!`);
            await wakeMonstersNearWithMessages(monster.mx, monster.my, 11 * 11, state);
        } else reply.action = 'whispers inaudibly.  All you can make out is "moon".';
        break;
    case MS_BOAST:
        if (!monster.mpeaceful) {
            const selection = rn2(4);
            if (selection === 0) {
                const name = monsterName(monster, { capitalized: true, state });
                await pline(`${name} boasts about ${monsterPossessive(monster, { state })} gem collection.`);
            } else if (selection === 1) reply.action = 'complains about a diet of mutton.';
            else {
                reply.action = 'shouts "Fee Fie Foe Foo!" and guffaws.';
                await wakeMonstersNearWithMessages(monster.mx, monster.my, 7 * 7, state);
            }
            break;
        }
        reply = humanoidReply(monster, state);
        break;
    case MS_HUMANOID:
        reply = !monster.mpeaceful && In_endgame(state.u.uz) && monsterIsPlayerMonster(monster.mnum)
            ? { speech: playerMonsterReply(monster, state) } : humanoidReply(monster, state);
        break;
    case MS_VAMPIRE:
        reply.speech = vampireReply(monster, state);
        break;
    case MS_BRIBE:
        if (monster.mpeaceful && !monster.mtame) {
            await demandDemonBribe(monster, state);
            break;
        }
        if (!monster.mpeaceful) await publishMonsterCuss(monster, state);
        else reply.speech = "We're all doomed.";
        break;
    case MS_CUSS:
        if (!monster.mpeaceful) await publishMonsterCuss(monster, state);
        else reply.speech = is_minion(monster.mnum)
            && monsterAlignmentType(monster) === 1 ? "It's not too late." : "We're all doomed.";
        break;
    case MS_SEDUCE:
        if (MONSTER_SYMBOL[monster.mnum] !== S_NYMPH
            && could_seduce(monster, 'hero', null, state) === 1) {
            await doseduce(monster, {
                kind: 'hero-attack', attackType: AT_TUCH, damageType: AD_SSEX, hit: true,
            }, state, pline, rn2, rnd, { allowCancelledSeducer: true });
        } else {
            const selection = heroPolyGender(state) !== Number(monster.female) ? rn2(3) : 0;
            if (selection === 2) reply.speech = 'Hello, sailor.';
            else reply.action = selection === 1 ? 'comes on to you.' : 'cajoles you.';
        }
        break;
    case MS_ARREST:
        reply.speech = monster.mpeaceful ? `Just the facts, ${state.flags.female ? "Ma'am" : 'Sir'}.`
            : select(['Anything you say can be used against you.', "You're under arrest!", 'Stop in the name of the Law!']);
        break;
    case MS_SPELL:
        reply.action = 'seems to mutter a cantrip.';
        break;
    case MS_NURSE:
        reply.speech = monster.mcan ? 'I hate this job!' : nurseReply(state);
        break;
    case MS_GUARD:
        reply.speech = heroGoldAmount(state) ? 'Please drop that gold and follow me.' : 'Please follow me.';
        break;
    case MS_SOLDIER:
        reply.speech = select(monster.mpeaceful ? [
            "What lousy pay we're getting here!", "The food's not fit for Orcs!",
            "My feet hurt, I've been on them all day!",
        ] : ['Resistance is useless!', "You're dog meat!", 'Surrender!']);
        break;
    case MS_RIDER:
        reply = species === 'Death' ? deathReply(state) : { speech: 'Who do you think you are, War?' };
        break;
    default:
        return false;
    }
    if (reply.action)
        await pline(`${monsterName(monster, { capitalized: true, state })} ${reply.action}`);
    else if (reply.speech)
        await pline(species === 'Death' ? reply.speech.toUpperCase() : `"${reply.speech}"`);
    return true;
}

// Part of C sounds.c:domonnoise(): peaceful humanoid conversation.
function humanoidReply(monster: Monster, state: PlayingGameState): MonsterReply {
    if (!monster.mpeaceful) return { action: 'threatens you.' };
    if (monster.mflee) return { action: 'wants nothing to do with you.' };
    if (monster.mhp < Math.trunc(monster.mhpmax / 4)) return { action: 'moans.' };
    if (monster.mconf || monster.mstun)
        return { speech: !rn2(3) ? 'Huh?' : rn2(2) ? 'What?' : 'Eh?' };
    if (!monster.mcansee) return { speech: "I can't see!" };
    if (monster.mtrapped) {
        const trap = state.level.traps.find(trap => trap.tx === monster.mx && trap.ty === monster.my);
        if (trap) trap.tseen = true;
        return { speech: "I'm trapped!" };
    }
    if (monster.mhp < Math.trunc(monster.mhpmax / 2)) return { action: 'asks for a potion of healing.' };
    if (monster.mtame && !monster.isminion && state.moves > (monster.edog?.hungrytime ?? 0))
        return { speech: "I'm hungry." };

    if (is_elf(monster.mnum)) return { action: 'curses orcs.' };
    if (is_dwarf(monster.mnum)) return { action: 'talks about mining.' };
    if (likes_magic(monster.mnum)) return { action: 'talks about spellcraft.' };
    if (MONSTER_SYMBOL[monster.mnum] === S_CENTAUR) return { action: 'discusses hunting.' };
    if (is_gnome(monster.mnum)) {
        const plan = heroIsHallucinating(state) ? rn2(4) : 0;
        return { speech: plan % 2 ? plan === 1 ? 'Phase one, collect underpants.' : 'Phase three, profit!'
            : 'Many enter the dungeon, and few return to the sunlit lands.' };
    }
    switch (MONSTER_NAME[monster.mnum] ?? '') {
    case 'hobbit':
        return { action: monster.mhp < monster.mhpmax && (monster.mhpmax <= 10 || monster.mhp <= monster.mhpmax - 10)
            ? 'complains about unpleasant dungeon conditions.' : 'asks you about the One Ring.' };
    case 'archeologist':
        return { action: 'describes a recent article in "Spelunker Today" magazine.' };
    case 'tourist':
        return { speech: 'Aloha.' };
    default:
        return { action: 'discusses dungeon exploration.' };
    }
}

// Part of C sounds.c:domonnoise(): nurse dialogue about the hero's equipment.
function nurseReply(state: PlayingGameState): string {
    const weapon = state.uwep || state.u.uwep;
    if (weapon && (weapon.oclass === WEAPON_CLASS || isWeaponTool(weapon)))
        return 'Put that weapon away before you hurt someone!';
    const hero = state.u;
    if (state.uarmc || hero.uarmc || state.uarm || hero.uarm || state.uarmh || hero.uarmh
        || state.uarms || hero.uarms || state.uarmg || hero.uarmg || state.uarmf || hero.uarmf)
        return state.urole.key === 'healer' ? "Doc, I can't help you unless you cooperate."
            : 'Please undress so I can examine you.';
    return state.uarmu || hero.uarmu ? 'Take off your shirt, please.' : "Relax, this won't hurt a bit.";
}

// Part of C sounds.c:domonnoise(): vampire conversation by attitude, form and time.
function vampireReply(monster: Monster, state: PlayingGameState): string {
    const night = sessionIsNight(state.datetime);
    const species = MONSTER_NAME[heroSpecies(state)];
    const kindred = Upolyd(state.u) && (species === 'vampire' || species === 'vampire leader');
    const nightchild = Upolyd(state.u) && (species === 'wolf' || species === 'winter wolf' || species === 'winter wolf cub');
    if (monster.mtame) {
        if (kindred) return `Good ${night ? 'evening' : 'day'} to you Master${night ? '!' : '.  Why do we not rest?'}`;
        return `${nightchild ? 'Child of the night, ' : ''}${recorderLocalHour(state.datetime) === 0
            ? 'I can stand this craving no longer!' : night
                ? 'I beg you, help me satisfy this growing craving!' : 'I find myself growing a little weary.'}`;
    }
    if (monster.mpeaceful) {
        if (kindred && night) return `Good feeding ${state.flags.female ? 'sister' : 'brother'}!`;
        if (nightchild && night) return 'How nice to hear you, child of the night!';
        return 'I only drink... potions.';
    }
    if (kindred) return 'This is my hunting ground that you dare to prowl!';
    if (species === 'silver dragon' || species === 'baby silver dragon')
        return `${species === 'silver dragon' ? 'Fool' : 'Young Fool'}!  Your silver sheen does not frighten me!`;
    if (!rn2(2)) return `I vant to suck your ${body_part(BLOOD, state)}!`;
    const race = state.urace.name === 'human' ? state.flags.female ? 'woman' : 'man' : state.urace.noun;
    const target = Upolyd(state.u) ? monsterTypeName(heroSpecies(state), !!state.flags.female) : race;
    return `I vill come after ${withIndefiniteArticle(target)} without regret!`;
}

// Part of C sounds.c:domonnoise(): Death's novel and tribute replies.
// Death's reply; invent.c:u_have_novel() is the tribute-novel lookup.
function deathReply(state: PlayingGameState): MonsterReply {
    const book = state.context.deathNotice ? undefined : state.inventory.find(object => object.otyp === SPE_NOVEL);
    if (book) {
        const title = novelTitle(book);
        state.context.deathNotice = true;
        return { speech: `Ah, so you have a copy of /${title}/.${title === 'Snuff' || title === 'The Wee Free Men'
            ? '' : '  I may have been misquoted there.'}` };
    }
    if (rn2(3)) {
        const passage = selectTributePassage(DEATH_QUOTES.length, 1, state);
        const speech = DEATH_QUOTES[passage - 1];
        if (speech === undefined) throw new RangeError(`Death has no tribute passage ${passage}`);
        return { speech };
    }
    return !rn2(10) ? { action: 'is busy reading a copy of Sandman #8.' }
        : { speech: 'Who do you think you are, War?' };
}

// Port only: select a random entry from a monster-speech table.
function select(messages: readonly string[]): string {
    const message = messages[rn2(messages.length)];
    if (message === undefined) throw new RangeError('Monster speech selection is outside its message table');
    return message;
}
