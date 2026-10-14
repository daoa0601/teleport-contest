// Peaceful demons demand payment before letting the hero pass.
// C minion.c:demon_talk()/bribe() and monmove.c:dochug().
import { artifactById } from './artifacts.js';
import { currentAttribute } from './attrib.js';
import { endVoluntaryMultiTurn, heroHasInvoluntaryDelay } from './command_state.js';
import { A_CHA, FAINTED, In_hell, NON_PM, RLOC_MSG, STRAT_APPEARMSG } from './const.js';
import { currency } from './currency.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { recordGameLogEvent } from './gamelog.js';
import { detachHeroGold, heroGoldAmount } from './hero_gold.js';
import { heroSpecies } from './hero_species.js';
import { resetHeroFaint } from './hunger.js';
import { setMonsterMalign } from './monster_alignment.js';
import { MONSTER_ALIGNMENT, MONSTER_FLAGS2, MONSTER_SYMBOL } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName } from './monster_name.js';
import { stopHeroOccupation } from './occupation.js';
import { getLine } from './query.js';
import { rn2, rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { cansee } from './vision.js';
import { AMULET_OF_YENDOR } from './object_data.js';
import type { PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';

const M2_DEMON = 0x00000100;
const M2_PRINCE = 0x00000800;
const S_DEMON = 56;

function angerDemon(monster: Monster, state: PlayingGameState): void {
    monster.mpeaceful = 0;
    setMonsterMalign(monster, state);
}

export async function talkToDemon(monster: Monster, state: PlayingGameState,
    random = rn2, rollOne = rnd): Promise<boolean> {
    const subject = () => monsterName(monster, { state, capitalized: true, article: 'a' });
    const heroIsDemon = MONSTER_SYMBOL[heroSpecies(state)] === S_DEMON;
    const relocate = async (): Promise<void> => {
        if (!await reportMonsterTeleportRestriction(monster, { state }))
            await randomMonsterRelocation(monster, { state, flags: RLOC_MSG, random, rollOne });
    };
    if (monster.mux !== state.u.ux || monster.muy !== state.u.uy) {
        await plineWithContinuation(`${cansee(monster.mux ?? 0, monster.muy ?? 0)
            ? monsterName(monster, { state, capitalized: true }) : 'It'} whispers at thin air.`);
        if ((MONSTER_FLAGS2[heroSpecies(state)] ?? 0) & M2_DEMON) await relocate();
        else {
            monster.minvis = monster.perminvis = false;
            await plineWithContinuation(`${subject()} gets angry!`);
            angerDemon(monster, state);
        }
        return false;
    }
    const weapon = state.uwep || state.u.uwep;
    if (['Excalibur', 'Demonbane'].includes(artifactById(weapon?.oartifact, state)?.name ?? '')) {
        await plineWithContinuation(canSpotMonster(monster)
            ? `${subject()} looks very angry.` : 'You feel tension building.');
        monster.mtame = 0;
        angerDemon(monster, state);
        newsym(monster.mx, monster.my);
        return false;
    }
    if (state.u.uhs === FAINTED) await resetHeroFaint({ state });
    else {
        await stopHeroOccupation(state);
        if ((state.multi ?? 0) > 0) endVoluntaryMultiTurn(state);
    }
    if (((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PRINCE) && monster.minvis) {
        const unseen = !canSpotMonster(monster);
        monster.minvis = monster.perminvis = false;
        if (unseen && canSpotMonster(monster)) {
            await plineWithContinuation(`${subject()} appears before you.`);
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_APPEARMSG;
        }
        newsym(monster.mx, monster.my);
    }
    const deaf = heroIsDeaf(state);
    if (heroIsDemon) {
        if (!deaf) await plineWithContinuation(`${subject()} says, "Good hunting, ${state.flags.female ? 'Sister' : 'Brother'}."`);
        else if (canSeeMonster(monster)) await plineWithContinuation(`${subject()} says something.`);
        await relocate();
        return true;
    }
    const cash = heroGoldAmount(state);
    const atHome = In_hell(state.u.uz) && (monster.cham ?? NON_PM) === NON_PM;
    const sameAlignment = Math.sign(state.u.ualign.type) === Math.sign(MONSTER_ALIGNMENT[monster.mnum] ?? 0);
    let demand = Math.trunc(cash * (rollOne(80) + (atHome ? 20 : 0)) / (100 * (1 + Number(sameAlignment))));
    if (!demand || heroHasInvoluntaryDelay(state)) {
        angerDemon(monster, state);
        return false;
    }
    if (deaf || monster.minvent?.some(object => object.otyp === AMULET_OF_YENDOR))
        demand = cash + random(1000) + 125;
    if (!deaf) await plineWithContinuation(`${subject()} demands ${demand} ${currency(demand, { state, random })} for safe passage.`);
    else if (canSeeMonster(monster)) await plineWithContinuation(`${subject()} seems to be demanding something.`);
    const offer = deaf ? 0 : await bribeDemon(monster, state, random);
    if (!deaf && offer >= demand)
        await plineWithContinuation(`${subject()} vanishes, laughing about cowardly mortals.`);
    else if (offer > 0 && rollOne(5 * currentAttribute(A_CHA, state)) > demand - offer)
        await plineWithContinuation(`${subject()} scowls at you menacingly, then vanishes.`);
    else {
        await plineWithContinuation(`${subject()} gets angry...`);
        angerDemon(monster, state);
        return false;
    }
    recordGameLogEvent(`bribed ${monsterName(monster, { state, article: 'a', exact: true })} with ${offer} ${offer === 1 ? 'zorkmid' : 'zorkmids'} for safe passage`, { state });
    await removeMonsterFromGame(monster);
    return true;
}

async function bribeDemon(monster: Monster, state: PlayingGameState, random: typeof rn2): Promise<number> {
    const text = await getLine('How much will you offer?', () => true);
    const digits = /^\s*[+-]?\d+/u.exec(text ?? '');
    let offer = digits ? Number(digits[0]) : 0;
    if (!Number.isFinite(offer)) offer = 0;
    if (offer < 0) {
        await plineWithContinuation(`You try to shortchange ${monsterName(monster, { state })}, but fumble.`);
        return 0;
    }
    if (!offer) {
        await plineWithContinuation('You refuse.');
        return 0;
    }
    const name = monsterName(monster, { state });
    const cash = heroGoldAmount(state);
    if (offer >= cash) {
        await plineWithContinuation(`You give ${name} all your gold.`);
        offer = cash;
    } else await plineWithContinuation(`You give ${name} ${offer} ${currency(offer, { state, random })}.`);
    const gold = detachHeroGold(state, offer);
    if (gold) await addObjectToMonsterInventory(monster, gold, state);
    state.context.botl = true;
    return offer;
}
