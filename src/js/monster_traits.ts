// Monster state stored in a corpse or statue.
// C refs: mkobj.c save_mtraits() and zap.c montraits().

import { isReviver } from './corpse_species.js';
import { MON_DETACH, MON_FLOOR } from './const.js';
import {
    MONSTER_ATTACKS, MONSTER_GENO, MONSTER_LEVEL,
} from './monster_data.js';
import { AD_SEDU, AD_SSEX } from './monster_attack_types.js';
import { monsterHitPointsPerLevel } from './monster_hit_points.js';
import type { MonsterHitPointRandom } from './monster_hit_points.js';
import type { Monster, PetData, SavedMonsterTraits, ShopkeeperData } from './monster_types.js';
import { rnd, rn2 } from './rng.js';
import { forgetTempleEntry } from './priest.js';

const G_UNIQ = 0x1000;

function monsterHasSeductionAttack(mnum: number): boolean {
    return (MONSTER_ATTACKS[mnum] || []).some(
        ([, damageType]) => damageType === AD_SEDU
            || damageType === AD_SSEX,
    );
}

function copyPetData(value: PetData): PetData {
    return { ...value, ogoal: { ...value.ogoal } };
}

function copyShopkeeperData(value: ShopkeeperData): ShopkeeperData {
    const copy = { ...value };
    if (value.bill) copy.bill = value.bill.map(item => ({ ...item }));
    return copy;
}

export function saveMonsterTraits(monster: Monster): SavedMonsterTraits;
export function saveMonsterTraits(monster: null | undefined): null;
export function saveMonsterTraits(monster: Monster | null | undefined): SavedMonsterTraits | null;
export function saveMonsterTraits(monster: Monster | null | undefined): SavedMonsterTraits | null {
    if (!monster) return null;
    if (monster.ispriest) forgetTempleEntry(monster);
    const {
        minvent, inventory, mw, wormSegments, wormDetachedSegments, wormGrowTime, wormHead, lightRemoved, headOnMap,
        ...saved
    } = monster;
    saved.wormno = 0;
    saved.mhpmax = Math.max(saved.mhpmax ?? 1, (MONSTER_LEVEL[monster.mnum] ?? 0) + 1);
    saved.mhp = Math.max(0, Math.min(saved.mhp ?? 0, saved.mhpmax));
    saved.mstate = (saved.mstate ?? MON_FLOOR) & ~MON_DETACH;
    if (monster.edog) saved.edog = copyPetData(monster.edog);
    if (monster.mextra) {
        saved.mextra = { ...monster.mextra };
        if (monster.mextra.edog) saved.mextra.edog = copyPetData(monster.mextra.edog);
        if (monster.mextra.emin) saved.mextra.emin = { ...monster.mextra.emin };
        if (monster.mextra.epri) saved.mextra.epri = { ...monster.mextra.epri };
        if (monster.mextra.eshk)
            saved.mextra.eshk = copyShopkeeperData(monster.mextra.eshk);
    }
    if (monster.eshk) saved.eshk = copyShopkeeperData(monster.eshk);
    if (monster.emin) saved.emin = { ...monster.emin };
    if (monster.epri) saved.epri = { ...monster.epri };
    return saved;
}

export function corpseKeepsMonsterTraits(
    monster: Monster | null | undefined, questLeaderId = 0,
): boolean {
    if (!monster) return false;
    return !!monster.isshk
        || (monster.mtame ?? 0) > 0
        || !!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)
        || isReviver(monster.mnum)
        || (!!questLeaderId && monster.m_id === questLeaderId)
        || monsterHasSeductionAttack(monster.mnum);
}

// Both arguments have the same trait contract; the target's type determines
// which values the saved record may supply. Inventory/body ownership is restored
// separately below, and only the saved record's own fields are copied.
function copyRestoredTraits<Traits extends SavedMonsterTraits>(
    monster: Traits, saved: NoInfer<Traits>,
): void {
    for (const key in saved) {
        if (Object.hasOwn(saved, key)) monster[key] = saved[key];
    }
}

export function restoreMonsterTraits(
    monster: Monster, saved: SavedMonsterTraits | null | undefined,
    options?: MonsterHitPointRandom,
): Monster;
export function restoreMonsterTraits(
    monster: Monster | null | undefined, saved: SavedMonsterTraits | null | undefined,
    options?: MonsterHitPointRandom,
): Monster | null | undefined;
export function restoreMonsterTraits(
    monster: Monster | null | undefined, saved: SavedMonsterTraits | null | undefined, {
    rollOne = rnd,
    randomBelow = rn2,
}: MonsterHitPointRandom = {}): Monster | null | undefined {
    if (!monster || !saved) return monster;
    const created = {
        m_id: monster.m_id,
        mx: monster.mx,
        my: monster.my,
        mux: monster.mux,
        muy: monster.muy,
        minvent: monster.minvent || [],
        wormno: monster.wormno,
        wormSegments: monster.wormSegments,
        wormHead: monster.wormHead,
        wormGrowTime: monster.wormGrowTime,
        misc_worn_check: monster.misc_worn_check,
        weaponCheck: monster.weaponCheck,
        mtrapseen: monster.mtrapseen,
        mflee: monster.mflee,
        mfleetim: monster.mfleetim,
        mburied: monster.mburied,
        mlstmv: monster.mlstmv,
        mundetected: monster.mundetected,
        m_ap_type: monster.m_ap_type,
        m_lev: monster.m_lev ?? 0,
        mhpmax: monster.mhpmax ?? 1,
    };

    let restoredLevel = saved.m_lev ?? created.m_lev;
    const speciesLevel = MONSTER_LEVEL[saved.mnum] ?? 0;
    if (created.m_lev < speciesLevel) {
        const targetLevel = rollOne(speciesLevel + 1);
        if (targetLevel > created.m_lev) {
            while (created.m_lev < targetLevel) {
                created.m_lev++;
                created.mhpmax += monsterHitPointsPerLevel(
                    { mnum: saved.mnum, m_lev: created.m_lev },
                    { rollOne, randomBelow },
                );
            }
            restoredLevel = created.m_lev;
        }
    }

    copyRestoredTraits(monster, saved);
    monster.m_id = created.m_id;
    monster.mx = created.mx;
    monster.my = created.my;
    if (created.mux === undefined) delete monster.mux;
    else monster.mux = created.mux;
    if (created.muy === undefined) delete monster.muy;
    else monster.muy = created.muy;
    monster.minvent = created.minvent;
    monster.inventory = monster.minvent;
    monster.hasInventory = monster.minvent.length > 0;
    monster.mw = null;
    if (created.wormno === undefined) delete monster.wormno;
    else monster.wormno = created.wormno;
    if (created.wormSegments === undefined) delete monster.wormSegments;
    else monster.wormSegments = created.wormSegments;
    if (created.wormHead === undefined) delete monster.wormHead;
    else monster.wormHead = created.wormHead;
    if (created.wormGrowTime === undefined) delete monster.wormGrowTime;
    else monster.wormGrowTime = created.wormGrowTime;
    monster.misc_worn_check = created.misc_worn_check ?? 0;
    monster.weaponCheck = created.weaponCheck ?? 0;
    monster.mtrapseen = created.mtrapseen ?? 0;
    monster.mflee = created.mflee ?? 0;
    monster.mfleetim = created.mfleetim ?? 0;
    monster.mburied = created.mburied ?? 0;
    monster.mlstmv = created.mlstmv ?? 0;
    monster.mundetected = created.mundetected ?? 0;
    monster.m_ap_type = created.m_ap_type ?? 0;
    monster.m_lev = restoredLevel;
    monster.mhpmax = Math.max(created.mhpmax, saved.mhpmax ?? 1);
    monster.mhp = monster.mhpmax;
    monster.dead = false;
    monster.mrevived = 1;
    monster.mavenge = 0;
    monster.meating = 0;
    monster.mleashed = 0;
    monster.mtrapped = 0;
    monster.msleeping = 0;
    monster.mfrozen = 0;
    monster.mcanmove = 1;
    if (!monsterHasSeductionAttack(monster.mnum)) monster.mcan = 0;
    monster.mcansee = 1;
    monster.mblinded = 0;
    monster.mstun = 0;
    monster.mconf = 0;
    if (monster.edog) {
        monster.edog = copyPetData(monster.edog);
        monster.mextra = { ...(monster.mextra || {}), edog: monster.edog };
    }
    return monster;
}
