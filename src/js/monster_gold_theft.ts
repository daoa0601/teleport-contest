// C steal.c:stealgold(), somegold(), and uhitm.c:mhitm_ad_sgld().
import { heroFootName, monsterFootName } from './body_parts.js';
import { RLOC_MSG } from './const.js';
import { newsym, type MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { detachHeroGold, heroGoldAmount } from './hero_gold.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_SYMBOL, monsterIsSlithy } from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import { linkObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName, possessiveName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { GOLD_PIECE } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { unlinkObject } from './object_location.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { randomMonsterRelocation } from './teleport.js';
import type { rn2, rnd } from './rng.js';

export async function stealHeroGold(
    monster: Monster, state: PlayingGameState, publish: MessagePublisher,
    random: typeof rn2, rollOne: typeof rnd,
): Promise<void> {
    if (monster.mcan || MONSTER_SYMBOL[heroSpecies(state)] === MONSTER_SYMBOL[monster.mnum]) return;
    const purse = state.inventory.find(object => object.otyp === GOLD_PIECE);
    const floor = state.level.objects[state.u.ux]?.[state.u.uy]?.find(object => object.otyp === GOLD_PIECE);
    if (floor && (!purse || floor.quan > purse.quan || random(5) === 0)) {
        unlinkObject(floor, state);
        await linkObjectToMonsterInventory(monster, floor, { state });
        newsym(state.u.ux, state.u.uy);
        const steed = state.u.usteed;
        const species = steed ? steed.mnum : heroSpecies(state);
        const owner = steed ? possessiveName(monsterName(steed, { state, article: 'your' })) : 'your';
        const feet = monsterIsSlithy(species) ? 'coils'
            : makePlural(steed ? monsterFootName(species) : heroFootName(state)).replace(/^rear /, '');
        await publish(`${monsterName(monster, { state, capitalized: true })} quickly snatches some gold from ${state.u.levitating || state.u.flying ? 'beneath' : 'between'} ${owner} ${feet}!`);
        if (!purse || random(5) === 0) await fleeWithGold(monster, state, publish, random, rollOne);
        return;
    }
    if (!purse) return;
    const stolen = detachHeroGold(state, Math.min(purse.quan, someGold(heroGoldAmount(state), random)));
    if (!stolen) throw new Error('The leprechaun selected an absent purse.');
    await linkObjectToMonsterInventory(monster, stolen, { state });
    await publish('Your purse feels lighter.');
    await fleeWithGold(monster, state, publish, random, rollOne);
    state.context.botl = true;
}

function someGold(amount: number, random: typeof rn2): number {
    const gold = Math.min(amount, 0x7fff);
    if (gold < 50) return gold;
    const minimum = gold < 100 ? 25 : gold < 500 ? 50 : gold < 1000 ? 100
        : gold < 5000 ? 500 : gold < 10000 ? 1000 : 5000;
    return minimum + random(gold - minimum + 1);
}

async function fleeWithGold(
    monster: Monster, state: PlayingGameState, publish: MessagePublisher,
    random: typeof rn2, rollOne: typeof rnd,
): Promise<void> {
    if (!monsterTeleportRestricted(monster, state))
        await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
    await makeMonsterFlee(monster, { state, announce: false, publish, random, rollOne });
}
