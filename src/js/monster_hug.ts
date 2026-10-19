// Physical hugs against the hero.
// C refs: uhitm.c:mhitm_ad_phys(), mhitu.c:u_slip_free().

import { setHeroGrip } from './hero_grip.js';
import { armorSimpleName } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import { A_STR } from './const.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { objectCombatName } from './objnam.js';
import { OBJECT_NAMES } from './object_data.js';
import { objectTypeKnown } from './shk.js';

const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');
const ROPE_GOLEM = MONSTER_NAME.indexOf('rope golem');

export async function resolvePhysicalHeroHug(
    monster: Monster, damage: number, state: PlayingGameState,
    random: (range: number) => number, publish: MessagePublisher,
): Promise<number> {
    const holder = state.u.ustuck;
    if (!holder && random(2)) {
        if (await heroSlipsFree(monster, state, random, publish)) return 0;
        setHeroGrip(monster, state);
        await publish(`${monsterName(monster, { state, capitalized: true })} grabs you!`);
    } else if (holder === monster) {
        await exerciseAttribute(A_STR, false, state);
        await publish(`You are being ${monster.mnum === ROPE_GOLEM ? 'choked' : 'crushed'}.`);
    }
    // A failed capture still deals the rolled hug damage. Another holder
    // prevents capture and crushing prose, but does not protect against it.
    return damage;
}

async function heroSlipsFree(
    monster: Monster, state: PlayingGameState,
    random: (range: number) => number, publish: MessagePublisher,
): Promise<boolean> {
    const armor = state.uarmc || state.uarm || state.uarmu;
    if (!armor || (!armor.greased && armor.otyp !== OILSKIN_CLOAK)) return false;
    if (armor.cursed && random(3) === 0) return false;

    const name = armor.greased || objectTypeKnown(armor, state)
        ? objectCombatName(armor, { state }) : armorSimpleName(armor, state);
    await publish(`${monsterName(monster, { state, capitalized: true })} grabs you, but cannot hold onto your ${armor.greased ? 'greased' : 'slippery'} ${name}!`);
    // The grease roll and inventory change follow the slip message, which
    // may suspend for a pager while the armor is still greased.
    if (armor.greased && random(2) === 0) {
        await publish('The grease wears off.');
        armor.greased = false;
    }
    return true;
}
