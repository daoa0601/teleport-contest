// Speech and non-animal noises in C sounds.c:domonnoise().
import { heroBloodName } from './body_parts.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { Upolyd, In_endgame } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { heroGoldAmount } from './hero_gold.js';
import { heroPolyGender, heroSpecies } from './hero_species.js';
import { aggravateMonsters } from './monster_anger.js';
import { AT_TUCH, AD_SSEX } from './monster_attack_types.js';
import { MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL, monsterIsPlayerMonster, monsterTypeName } from './monster_data.js';
import { monsterName, monsterPossessive } from './monster_name.js';
import { resolveHeroSeduction } from './monster_seduction.js';
import { sessionIsNight } from './monster_sound.js';
import type { Monster } from './monster_types.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { isWeaponTool } from './object_properties.js';
import { recorderLocalHour } from './calendar.js';
import { rn2, rnd } from './rng.js';
import { seductionCompatibility } from './seduction_compatibility.js';
import { heroIsHallucinating } from './senses.js';

const MS_SHRIEK = 18;
const MS_BONES = 19;
const MS_LAUGH = 20;
const MS_MUMBLE = 21;
const MS_IMITATE = 22;
const MS_WERE = 23;
const MS_ORC = 24;
const MS_HUMANOID = 25;
const MS_ARREST = 26;
const MS_SOLDIER = 27;
const MS_GUARD = 28;
const MS_DJINNI = 29;
const MS_NURSE = 30;
const MS_SEDUCE = 31;
const MS_VAMPIRE = 32;
const MS_RIDER = 35;
const MS_SPELL = 42;
const MS_BOAST = 43;
const MS_GROAN = 44;
const M2_ELF = 0x10;
const M2_DWARF = 0x20;
const M2_GNOME = 0x40;
const M2_MAGIC = 0x80000000;
const S_CENTAUR = 29;
const S_NYMPH = 14;

interface MonsterReply {
    action?: string;
    speech?: string;
}

export async function publishMonsterConversation(
    monster: Monster, sound: number, state: PlayingGameState,
): Promise<boolean> {
    const species = MONSTER_NAME[monster.mnum];
    let reply: MonsterReply = {};
    switch (sound) {
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
        endVoluntaryMultiTurn(state);
        state._helplessTurns = Math.max(state._helplessTurns ?? 0, 2);
        state.multi = -state._helplessTurns;
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
    case MS_SEDUCE:
        if (MONSTER_SYMBOL[monster.mnum] !== S_NYMPH
            && seductionCompatibility(monster, 'hero', null, state) === 1) {
            await resolveHeroSeduction(monster, {
                kind: 'hero-attack', attackType: AT_TUCH, damageType: AD_SSEX, hit: true,
            }, state, pline, rn2, rnd);
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
        // Death needs the persistent tribute passage selection used by files.c.
        if (species === 'Death') return false;
        reply.speech = 'Who do you think you are, War?';
        break;
    default:
        return false;
    }
    if (reply.action)
        await pline(`${monsterName(monster, { capitalized: true, state })} ${reply.action}`);
    else if (reply.speech)
        await pline(`"${reply.speech}"`);
    return true;
}

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
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    if (flags & M2_ELF) return { action: 'curses orcs.' };
    if (flags & M2_DWARF) return { action: 'talks about mining.' };
    if (flags & M2_MAGIC) return { action: 'talks about spellcraft.' };
    if (MONSTER_SYMBOL[monster.mnum] === S_CENTAUR) return { action: 'discusses hunting.' };
    if (flags & M2_GNOME) {
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

function nurseReply(state: PlayingGameState): string {
    const weapon = state.uwep || state.u.uwep;
    if (weapon && (weapon.oclass === 2 || isWeaponTool(weapon)))
        return 'Put that weapon away before you hurt someone!';
    const hero = state.u;
    if (state.uarmc || hero.uarmc || state.uarm || hero.uarm || state.uarmh || hero.uarmh
        || state.uarms || hero.uarms || state.uarmg || hero.uarmg || state.uarmf || hero.uarmf)
        return state.urole.key === 'healer' ? "Doc, I can't help you unless you cooperate."
            : 'Please undress so I can examine you.';
    return state.uarmu || hero.uarmu ? 'Take off your shirt, please.' : "Relax, this won't hurt a bit.";
}

function playerMonsterReply(monster: Monster, state: PlayingGameState): string {
    const sameRole = monster.mnum === MONSTER_NAME.indexOf('archeologist') + state.urole.mnum;
    return `Talk? -- ${select(sameRole ? [
        "I can't win, and neither will you!", "You don't deserve to win!",
        'Mine should be the honor, not yours!',
    ] : ['The low-life wants to talk, eh?', 'Fight, scum!', 'Here is what I have to say!'])}`;
}

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
    if (!rn2(2)) return `I vant to suck your ${heroBloodName(state)}!`;
    const race = state.urace.name === 'human' ? state.flags.female ? 'woman' : 'man' : state.urace.noun;
    const target = Upolyd(state.u) ? monsterTypeName(heroSpecies(state), !!state.flags.female) : race;
    return `I vill come after ${withIndefiniteArticle(target)} without regret!`;
}

function select(messages: readonly string[]): string {
    const message = messages[rn2(messages.length)];
    if (message === undefined) throw new RangeError('Monster speech selection is outside its message table');
    return message;
}
