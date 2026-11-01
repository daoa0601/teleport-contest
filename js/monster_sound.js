import { currency } from './currency.js';
// Pet begging and animal noises shared by #chat and mounted breath fallback.
// C ref: sounds.c domonnoise().
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { publishMonsterConversation } from './monster_conversation.js';
import { recorderLocalHour } from './calendar.js';
import { canSeeMonster, canSpotMonster, glyphAt, map_invisible } from './display.js';
import { plineWithContinuation } from './pline.js';
import { monsterName } from './monster_name.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { chatWithShopkeeper } from './shop_chat.js';
import { chatWithQuestCharacter } from './quest.js';
import { questMonsterSound } from './role_monsters.js';
import { consultOracle } from './rumor.js';
import { roles } from './roles.js';
import { rn2 } from './rng.js';
import { MONSTER_NAME, MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_SOUND } from './monster_data.js';
import { sameMonsterRace } from './mondata.js';
import { PLNMSG_GROWL } from './const.js';
import { stopRun } from './runmode.js';
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
const MS_ANIMAL = 17;
const MS_HUMANOID = 25;
const MS_ORC = 24;
const MS_LEADER = 36;
const MS_NEMESIS = 37;
const MS_ORACLE = 40;
const MS_GUARDIAN = 38;
const MS_GROAN = 44;
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const MS_SELL = 39;
const PM_DINGO = MONSTER_NAME.indexOf('dingo');
const PM_RAVEN = MONSTER_NAME.indexOf('raven');
const PM_GECKO = MONSTER_NAME.indexOf('gecko');
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
export function monsterSentenceSubject(monster) {
    return monsterName(monster, { capitalized: true });
}
export function sessionIsNight(datetime) {
    const hour = recorderLocalHour(datetime);
    return hour < 6 || hour > 21;
}
// C sounds.c:growl_sound(). Summoning uses the same noise while unseen.
export function monsterGrowlSound(monster) {
    switch (MONSTER_SOUND[monster.mnum] ?? MS_SILENT) {
        case MS_MEW:
        case MS_HISS: return 'hiss';
        case MS_BARK:
        case MS_GROWL: return 'growl';
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
export async function begForFood(monster, state) {
    requireLiveGame(state);
    if (monster.msleeping || !monster.mcanmove
        || !((MONSTER_FLAGS1[monster.mnum] ?? 0) & (M1_CARNIVORE | M1_HERBIVORE)))
        return;
    const sound = MONSTER_SOUND[monster.mnum] ?? MS_SILENT;
    if (sound !== MS_SILENT && sound <= MS_ANIMAL) {
        await publishMonsterNoise(monster, state);
    }
    else if (sound >= MS_HUMANOID) {
        if (!canSpotMonster(monster))
            await map_invisible(monster.mx, monster.my);
        await plineWithContinuation('"I\'m hungry."');
    }
    else if (canSpotMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, {
            capitalized: true, state,
        })} seems famished.`);
    }
}
// C sounds.c:domonnoise(). A true result spends a chat turn even if quiet.
export async function publishMonsterNoise(monster, state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let sound = questMonsterSound(monster.mnum, state);
    if (heroIsDeaf(state) || sound === MS_SILENT && !monster.isshk)
        return false;
    const hallucinating = heroIsHallucinating(state);
    if (monster.m_id === state.quest_status?.leader_m_id && sound > MS_ANIMAL)
        sound = MS_LEADER;
    else if (sound === MS_GUARDIAN && monster.mnum !== state.urole.guardnum) {
        const role = roles.find(role => role.guardnum === monster.mnum);
        if (!role)
            throw new Error(`Quest guardian ${monster.mnum} has no role`);
        sound = MONSTER_SOUND[MONSTER_NAME.indexOf('archeologist') + role.mnum] ?? MS_SILENT;
    }
    else if (monster.isshk)
        sound = MS_SELL;
    else if (sound === MS_ORC
        && (sameMonsterRace(monster.mnum, heroSpecies(state))
            || sameMonsterRace(monster.mnum, state.urace.mnum)
            || hallucinating))
        sound = MS_HUMANOID;
    else if (sound === MS_MOO && !monster.mtame)
        sound = MS_BELLOW;
    else if (hallucinating && looksLikeGecko(monster, state))
        sound = MS_SELL;
    if (!canSpotMonster(monster))
        await map_invisible(monster.mx, monster.my);
    if (sound === MS_ORACLE)
        return consultOracle(monster, state);
    if (sound === MS_LEADER || sound === MS_NEMESIS || sound === MS_GUARDIAN) {
        await chatWithQuestCharacter(monster, state);
        return true;
    }
    if (sound === MS_SELL) {
        if (!hallucinating || MONSTER_SOUND[monster.mnum] === MS_SILENT || monster.isshk && rn2(2) === 0)
            await chatWithShopkeeper(monster, state);
        else
            await plineWithContinuation(`"15 minutes could save you 15 ${currency(15, { state })}."`);
        return true;
    }
    if (sound > MS_ANIMAL)
        return publishMonsterConversation(monster, sound, state);
    let noise;
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
            if (monster.mpeaceful)
                return false;
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
    if (noise)
        await plineWithContinuation(`${monsterName(monster, {
            capitalized: true, state,
        })} ${noise}`);
    return true;
}
function bark(monster, state) {
    if (state.flags.moonphase === 4 && sessionIsNight(state.datetime))
        return 'howls.';
    if (!monster.mpeaceful)
        return 'growls.';
    const hungryTime = monster.edog?.hungrytime ?? 0;
    if (monster.mtame && (monster.mconf || monster.mflee || monster.mtrapped
        || state.moves > hungryTime || monster.mtame < 5))
        return 'whines.';
    if (monster.mtame && hungryTime > state.moves + 1000)
        return 'yips.';
    return monster.mnum === PM_DINGO ? null : 'barks.';
}
function mew(monster, state) {
    if (!monster.mtame)
        return monster.mpeaceful ? 'snarls.' : 'growls!';
    if (monster.mconf || monster.mflee || monster.mtrapped || monster.mtame < 5)
        return 'yowls.';
    const hungryTime = monster.edog?.hungrytime ?? 0;
    if (state.moves > hungryTime)
        return 'meows.';
    return hungryTime > state.moves + 1000 ? 'purrs.' : 'mews.';
}
function looksLikeGecko(monster, state) {
    if (monster.mnum === PM_GECKO)
        return true;
    if (monster.mnum === PM_LONG_WORM)
        return false;
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
// C sounds.c:vtense() third-person verb ending for monster noises.
function thirdPersonSoundVerb(verb) {
    return /(?:s|sh|ch|x|z)$/.test(verb) ? `${verb}es` : `${verb}s`;
}
// C sounds.c:growl(). The sounds of a seriously abused pet, including the
// player attacking it.
export async function publishMonsterGrowl(monster) {
    const sound = questMonsterSound(monster.mnum);
    if (monster.msleeping || !monster.mcanmove || !sound)
        return game._lastPlineKind === PLNMSG_GROWL;
    const verb = heroIsHallucinating()
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : monsterGrowlSound(monster);
    if (!verb)
        throw new Error('Missing hallucinated growl verb.');
    const noticed = canSeeMonster(monster) || !heroIsDeaf();
    if (noticed) {
        await plineWithContinuation(`${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}!`);
        game._lastPlineKind = PLNMSG_GROWL;
        if (game.context.run)
            stopRun();
    }
    await wakeMonstersNearWithMessages(monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 18);
    return game._lastPlineKind === PLNMSG_GROWL;
}
// C sounds.c:yelp(). The sounds of mistreated pets.
export async function publishMonsterYelp(monster) {
    const sound = questMonsterSound(monster.mnum);
    if (monster.msleeping || !monster.mcanmove || !sound)
        return;
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
    if (!verb)
        return;
    await plineWithContinuation(`${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}!`);
    if (game.context.run)
        stopRun();
    await wakeMonstersNearWithMessages(monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 12);
}
// C sounds.c:whimper(). The sounds of distressed pets.
export async function publishMonsterWhimper(monster) {
    const sound = questMonsterSound(monster.mnum);
    if (monster.msleeping || !monster.mcanmove || !sound)
        return;
    const verb = heroIsHallucinating()
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : sound === MS_MEW || sound === MS_GROWL ? 'whimper'
            : sound === MS_BARK ? 'whine' : sound === MS_SQEEK ? 'squeal' : null;
    if (!verb)
        return;
    await plineWithContinuation(`${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}.`);
    if (game.context.run)
        stopRun();
    await wakeMonstersNearWithMessages(monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 6);
}
//# sourceMappingURL=monster_sound.js.map