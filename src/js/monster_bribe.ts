// C minion.c:bribe(), shared by demon and priest conversations.
import { currency } from './currency.js';
import { plineWithContinuation } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { detachHeroGold, heroGoldAmount } from './hero_gold.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { getLine } from './query.js';
import { rn2 } from './rng.js';

export async function offerGoldToMonster(monster: Monster, prompt: string, state: PlayingGameState, random = rn2): Promise<number> {
    const text = await getLine(prompt, () => true);
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
