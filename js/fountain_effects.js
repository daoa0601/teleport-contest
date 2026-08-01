// Source-shaped fountain effect reducers.
// C refs: fountain.c fountain actor helpers and dipfountain() cases 16 through
// 20, 21 through 24, 26 through 27, and 29.

import { curseObjectState, uncurseObjectState } from './object_state.js';
import { rn2, rnd } from './rng.js';

function resolvedLiquidName(liquidName) {
    return typeof liquidName === 'function' ? liquidName() : liquidName;
}

export function resolveDippedBucFate({
    fate,
    object,
    isHands = false,
    blind = false,
    liquidName = 'water',
}) {
    if (fate === 16) {
        if (!isHands && object && !object.cursed)
            curseObjectState(object);
        return { handled: true, message: '' };
    }

    if (fate >= 17 && fate <= 20) {
        if (!isHands && object?.cursed) {
            const message = blind
                ? ''
                : `The ${resolvedLiquidName(liquidName)} glows for a moment.`;
            uncurseObjectState(object);
            return { handled: true, message };
        }
        return {
            handled: true,
            message: 'A feeling of loss comes over you.',
        };
    }

    return { handled: false, message: '' };
}

function resolvedArmName(armName) {
    return typeof armName === 'function' ? armName() : armName;
}

export function resolveDippedSensationFate({ fate, armName = 'arm' }) {
    if (fate === 26) {
        return {
            handled: true,
            message: `A strange tingling runs up your ${
                resolvedArmName(armName)
            }.`,
        };
    }
    if (fate === 27) {
        return {
            handled: true,
            message: 'You feel a sudden chill.',
        };
    }
    return { handled: false, message: '' };
}

export function resolveDippedCoinFate({
    fate,
    looted = false,
    dungeonLevels = 1,
    dungeonLevel = 1,
    blind = false,
    random = rnd,
}) {
    const empty = {
        createsCoins: false,
        quantity: 0,
        showMessage: false,
    };
    if (fate !== 29) return { handled: false, ...empty };
    if (looted) return { handled: true, ...empty };

    const amountRange = (dungeonLevels - dungeonLevel + 1) * 2;
    return {
        handled: true,
        createsCoins: true,
        quantity: random(amountRange) + 5,
        showMessage: !blind,
    };
}

export function dippedCoinMessage(liquidName = 'water') {
    return `Far below you, you see coins glistening in the ${liquidName}.`;
}

export function applyDippedCoinFate({
    fate,
    loc,
    dungeonLevels = 1,
    dungeonLevel = 1,
    blind = false,
    random = rnd,
    createGold = () => {},
    liquidName = 'water',
    exerciseWisdom = () => {},
    repaint = () => {},
}) {
    const effect = resolveDippedCoinFate({
        fate,
        looted: !!((loc?.looted ?? 0) & 1),
        dungeonLevels,
        dungeonLevel,
        blind,
        random,
    });
    if (!effect.createsCoins) return { ...effect, message: '' };

    loc.looted = (loc.looted ?? 0) | 1;
    createGold(effect.quantity);
    const message = effect.showMessage
        ? dippedCoinMessage(resolvedLiquidName(liquidName))
        : '';
    exerciseWisdom();
    repaint();
    return { ...effect, message };
}

export async function applyFountainGemDiscovery({
    loc,
    blind = false,
    announce = async () => {},
    chooseGem = () => null,
    createGem = gemType => ({ otyp: gemType }),
    placeGem = () => {},
    repaint = () => {},
    exerciseWisdom = () => {},
}) {
    if ((loc?.looted ?? 0) & 1) {
        return {
            discovered: false,
            message: '',
            gemType: null,
            gem: null,
        };
    }

    const message = blind
        ? 'You feel a gem here!'
        : 'You spot a gem in the sparkling waters!';
    await announce(message);
    const gemType = chooseGem();
    const gem = createGem(gemType);
    placeGem(gem);
    loc.looted = (loc.looted ?? 0) | 1;
    repaint();
    exerciseWisdom();
    return { discovered: true, message, gemType, gem };
}

const FURIOUS_BUBBLING_MESSAGE
    = 'The fountain bubbles furiously for a moment, then calms.';

async function announceFountainActor(message, announce) {
    if (message) await announce(message);
    return message;
}

async function triggerFountainActorTrap(monster, trapAt, triggerTrap) {
    if (!monster || !trapAt(monster)) return null;
    return triggerTrap(monster);
}

// fountain.c:dowaternymph().  Placement, trap effects, and presentation stay
// injected subsystem owners; this reducer owns only their source ordering.
export async function applyFountainNymphActor({
    gone = false,
    blind = false,
    createMonster = async () => null,
    announce = async () => {},
    nymphDescription = () => 'a water nymph',
    wakeMonster = monster => { monster.msleeping = 0; },
    trapAt = () => false,
    triggerTrap = async () => null,
}) {
    const monster = gone ? null : await createMonster();
    if (!monster) {
        const message = blind
            ? 'You hear a loud pop.'
            : 'A large bubble rises to the surface and pops.';
        await announceFountainActor(message, announce);
        return {
            created: false, monster: null, message,
            trap: null, fallback: true,
        };
    }

    const message = blind
        ? 'You hear a seductive voice.'
        : `You attract ${nymphDescription(monster)}!`;
    await announceFountainActor(message, announce);
    wakeMonster(monster);
    const trap = await triggerFountainActorTrap(
        monster, trapAt, triggerTrap,
    );
    return { created: true, monster, message, trap, fallback: false };
}

// fountain.c:dowaterdemon().  The wish roll is eligible only after a
// successful construction and its release message; a winning grant replaces
// immediate trap entry because mongrantswish() removes the actor first.
export async function applyFountainDemonActor({
    gone = false,
    blind = false,
    difficulty = 1,
    createMonster = async () => null,
    announce = async () => {},
    random = rnd,
    demonIndefiniteName = () => 'a water demon',
    demonPronouns = () => ({ possessive: 'his', pronoun: 'he' }),
    grantWish = async () => {},
    trapAt = () => false,
    triggerTrap = async () => null,
}) {
    if (gone) {
        await announceFountainActor(FURIOUS_BUBBLING_MESSAGE, announce);
        return {
            created: false, monster: null,
            message: FURIOUS_BUBBLING_MESSAGE,
            wishRoll: null, grantedWish: false, trap: null, fallback: true,
        };
    }

    const monster = await createMonster();
    if (!monster) {
        return {
            created: false, monster: null, message: '',
            wishRoll: null, grantedWish: false, trap: null, fallback: false,
        };
    }

    const message = blind
        ? 'You feel the presence of evil.'
        : `You unleash ${demonIndefiniteName(monster)}!`;
    await announceFountainActor(message, announce);
    const wishRoll = random(100);
    if (wishRoll > 80 + difficulty) {
        const description = demonPronouns(monster);
        const wishMessage = `Grateful for ${
            description.possessive
        } release, ${description.pronoun} grants you a wish!`;
        await announceFountainActor(wishMessage, announce);
        await grantWish(monster);
        return {
            created: true, monster, message, wishMessage,
            wishRoll, grantedWish: true, trap: null, fallback: false,
        };
    }

    const trap = await triggerFountainActorTrap(
        monster, trapAt, triggerTrap,
    );
    return {
        created: true, monster, message, wishRoll,
        grantedWish: false, trap, fallback: false,
    };
}

// fountain.c:dowatersnakes().  Unlike the other helpers, rn1(5,2) is paid
// before G_GONE.  Each requested actor independently constructs and enters a
// trap before the next request begins.
export async function applyFountainSnakeActors({
    gone = false,
    blind = false,
    hallucinating = false,
    random = rn2,
    hallucinatedPlural = () => 'snakes',
    announce = async () => {},
    createMonster = async () => null,
    trapAt = () => false,
    triggerTrap = async () => null,
}) {
    const requested = 2 + random(5);
    if (gone) {
        await announceFountainActor(FURIOUS_BUBBLING_MESSAGE, announce);
        return {
            requested, created: [], message: FURIOUS_BUBBLING_MESSAGE,
            traps: [], fallback: true,
        };
    }

    const message = blind
        ? 'You hear something hissing!'
        : `An endless stream of ${
            hallucinating ? hallucinatedPlural() : 'snakes'
        } pours forth!`;
    await announceFountainActor(message, announce);

    const created = [];
    const traps = [];
    for (let index = 0; index < requested; index++) {
        const monster = await createMonster(index);
        if (!monster) continue;
        created.push(monster);
        const trap = await triggerFountainActorTrap(
            monster, trapAt, triggerTrap,
        );
        if (trap != null) traps.push({ monster, trap });
    }
    return { requested, created, message, traps, fallback: false };
}
