// Pet begging and animal noises shared by #chat and mounted breath fallback.
// C ref: sounds.c domonnoise().
import { game, requireLiveGame } from './gstate.js';
import { canSpotMonster, glyphAt, map_invisible, plineWithContinuation } from './display.js';
import { monsterName, monsterObjectPronoun, monsterSubjectPronoun, shopkeeperName } from './monster_name.js';
import { wakeMonstersNear } from './monster_wake.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { heroArmName } from './body_parts.js';
import { rn2 } from './rng.js';
import { MONSTER_NAME, MONSTER_FLAGS1, MONSTER_SOUND, monsterTypeName, } from './monster_data.js';
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
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const COIN_CLASS = 12;
const PM_DINGO = MONSTER_NAME.indexOf('dingo');
const PM_RAVEN = MONSTER_NAME.indexOf('raven');
const PM_GECKO = MONSTER_NAME.indexOf('gecko');
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
export function monsterSentenceSubject(monster) {
    if (monster.name)
        return monster.name.charAt(0).toUpperCase() + monster.name.slice(1);
    const saddle = monster.saddled ? 'saddled ' : '';
    return `The ${saddle}${monsterTypeName(monster.mnum, !!monster.female)}`;
}
export function sessionIsNight(datetime) {
    const hour = Number(String(datetime || '').slice(8, 10));
    return Number.isInteger(hour) && (hour < 6 || hour > 21);
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
            map_invisible(monster.mx, monster.my);
        await plineWithContinuation('"I\'m hungry."');
    }
    else if (canSpotMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, {
            capitalized: true, state,
        })} seems famished.`);
    }
}
// The animal branch of C sounds.c:domonnoise(), including its map and wake
// effects. A true result spends a chat turn even when a dingo stays quiet.
export async function publishMonsterNoise(monster, state = game) {
    requireLiveGame(state);
    const sound = MONSTER_SOUND[monster.mnum] ?? MS_SILENT;
    if (heroIsDeaf(state) || sound > MS_ANIMAL
        || sound === MS_SILENT && !monster.isshk)
        return false;
    const hallucinating = heroIsHallucinating(state);
    const wildBellow = sound === MS_MOO && !monster.mtame;
    const selling = !!monster.isshk
        || !wildBellow && hallucinating && looksLikeGecko(monster, state);
    if (!canSpotMonster(monster))
        map_invisible(monster.mx, monster.my);
    if (selling) {
        if (!hallucinating || sound === MS_SILENT || monster.isshk && rn2(2) === 0)
            await publishAnimalShopkeeperGesture(monster, state);
        else
            await plineWithContinuation('"15 minutes could save you 15 zorkmids."');
        return true;
    }
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
            wakeMonstersNear(monster.mx, monster.my, 11 * 11, state);
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
// C shk.c:shk_chat() for keepers whose current form cannot speak. This
// publisher is only reached through the animal/silent sound branch above.
async function publishAnimalShopkeeperGesture(monster, state) {
    const shop = monster.eshk;
    if (!monster.isshk || !shop)
        throw new Error('An animal-form shopkeeper needs its shop data.');
    const name = () => shopkeeperName(monster, { state, capitalized: true });
    const currency = (amount) => amount === 1 ? 'zorkmid' : 'zorkmids';
    let message;
    if (!monster.mpeaceful) {
        message = `${name()} indicates how much ${monsterSubjectPronoun(monster, { state })} dislikes ${shop.robbed ? 'non-paying' : 'rude'} customers.`;
    }
    else if (shop.following) {
        if (shop.customer !== state.plname) {
            shop.following = 0;
            return;
        }
        message = `${name()} taps you on the ${heroArmName(state)}.`;
    }
    else if (shop.billct) {
        const total = (shop.bill ?? []).reduce((sum, item) => sum + item.bquan * item.price, 0)
            + (shop.debit ?? 0);
        message = `${name()} indicates that your bill comes to ${total} ${currency(total)}.`;
    }
    else if (shop.debit) {
        message = `${name()} indicates that you owe ${monsterObjectPronoun(monster, {
            state, noIt: true,
        })} ${shop.debit} ${currency(shop.debit)}.`;
    }
    else if (shop.credit) {
        message = `${name()} encourages you to use your ${shop.credit} ${currency(shop.credit)} of credit.`;
    }
    else if (shop.robbed) {
        message = `${name()} indicates concern about a recent robbery.`;
    }
    else if (shop.surcharge) {
        message = `${name()} indicates that ${monsterSubjectPronoun(monster, { state })} is watching you carefully.`;
    }
    else {
        const money = monster.minvent?.find(object => object.oclass === COIN_CLASS)?.quan ?? 0;
        if (money >= 50 && money <= 4000)
            return;
        message = `${name()} indicates that business is ${money < 50 ? 'bad' : 'good'}.`;
    }
    await plineWithContinuation(message);
}
//# sourceMappingURL=monster_sound.js.map