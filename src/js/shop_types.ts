import type { GameState } from './game_state.js';
import type { GameMap } from './game.js';
import type { Hero, HeroInitialState } from './hero_types.js';
import type { GameObject } from './object_types.js';
import type { Monster, ShopBillEntry, ShopkeeperData } from './monster_types.js';
import type { Room } from './map_types.js';

export interface Shopkeeper extends Monster {
    eshk: ShopkeeperData;
}

export interface BilledShopkeeper extends Shopkeeper {
    eshk: ShopkeeperData & { bill: ShopBillEntry[] };
}

export function hasShopkeeperData(monster: Monster | null | undefined): monster is Shopkeeper {
    return !!monster?.eshk;
}

export function hasShopBill(monster: Monster | null | undefined): monster is BilledShopkeeper {
    return !!monster?.eshk?.bill;
}

export interface ShopRoom {
    room: Room;
    roomno: number;
}

export interface CostlyShopSpot extends ShopRoom {
    resident: Shopkeeper;
}

export interface CarriedShopBillItem {
    entry: ShopBillEntry;
    object: GameObject;
    price: number;
}

export interface ShopTransaction {
    resident: BilledShopkeeper;
    entry: ShopBillEntry | null;
    object: GameObject;
    offer: number;
    contentscount: number;
}

// Room membership precedes attributes and skills during newgame(). Shop entry
// must not require the later, fully initialized hero while D:1 is being made.
type ShopHero = Hero & Pick<HeroInitialState,
    'uz' | 'urooms' | 'urooms0' | 'uentered' | 'ushops'
    | 'ushops0' | 'ushops_entered' | 'ushops_left'>;

export interface ShopGameState extends GameState {
    u: ShopHero;
    level: GameMap;
}

export function requireShopGame(state: GameState): asserts state is ShopGameState {
    const hero = state.u;
    if (!state.level || !hero.uz || !hero.urooms || !hero.urooms0
        || !hero.uentered || !hero.ushops || !hero.ushops0
        || !hero.ushops_entered || !hero.ushops_left)
        throw new Error('Shop interaction requires a level and hero room membership');
}
