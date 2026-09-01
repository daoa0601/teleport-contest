// Monster state stored in a corpse or statue.
// C refs: mkobj.c save_mtraits() and zap.c montraits().

import { isReviver } from './corpse_species.js';
import { MONSTER_ATTACKS, MONSTER_GENO } from './monster_data.js';

const G_UNIQ = 0x1000;
const AD_SEDU = 22;
const AD_SSEX = 35;

function monsterHasSeductionAttack(mnum) {
    return (MONSTER_ATTACKS[mnum] || []).some(
        ([, damageType]) => damageType === AD_SEDU
            || damageType === AD_SSEX,
    );
}

function copyRecord(value) {
    if (!value || typeof value !== 'object') return value;
    const copy = { ...value };
    if (value.ogoal) copy.ogoal = { ...value.ogoal };
    if (Array.isArray(value.bill)) copy.bill = value.bill.map(item => ({ ...item }));
    return copy;
}

export function saveMonsterTraits(monster) {
    if (!monster) return null;
    const saved = { ...monster, mnum: monster.mnum };
    delete saved.minvent;
    delete saved.inventory;
    delete saved.mw;
    delete saved.wormSegments;
    saved.wormno = 0;
    saved.mhpmax = Math.max(saved.mhpmax ?? 1, (saved.m_lev ?? 0) + 1);
    saved.mhp = Math.max(0, Math.min(saved.mhp ?? 0, saved.mhpmax));
    saved.edog = copyRecord(monster.edog);
    if (monster.mextra) {
        saved.mextra = { ...monster.mextra };
        for (const key of ['edog', 'emin', 'epri', 'eshk']) {
            if (monster.mextra[key])
                saved.mextra[key] = copyRecord(monster.mextra[key]);
        }
    }
    if (monster.eshk) saved.eshk = copyRecord(monster.eshk);
    if (monster.emin) saved.emin = copyRecord(monster.emin);
    if (monster.epri) saved.epri = copyRecord(monster.epri);
    return saved;
}

export function corpseKeepsMonsterTraits(monster, questLeaderId = 0) {
    if (!monster) return false;
    return !!monster.isshk
        || (monster.mtame ?? 0) > 0
        || !!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)
        || isReviver(monster.mnum)
        || (!!questLeaderId && monster.m_id === questLeaderId)
        || monsterHasSeductionAttack(monster.mnum);
}

export function restoreMonsterTraits(monster, saved) {
    if (!monster || !saved) return monster;
    const created = {
        m_id: monster.m_id,
        mx: monster.mx,
        my: monster.my,
        mux: monster.mux,
        muy: monster.muy,
        minvent: monster.minvent || [],
        wormno: monster.wormno,
        misc_worn_check: monster.misc_worn_check,
        weaponCheck: monster.weaponCheck,
        mtrapseen: monster.mtrapseen,
        mflee: monster.mflee,
        mfleetim: monster.mfleetim,
        mundetected: monster.mundetected,
        m_ap_type: monster.m_ap_type,
    };
    Object.assign(monster, saved);
    monster.m_id = saved.m_id || created.m_id;
    monster.mx = created.mx;
    monster.my = created.my;
    monster.mux = created.mux;
    monster.muy = created.muy;
    monster.minvent = created.minvent;
    monster.inventory = monster.minvent;
    monster.hasInventory = monster.minvent.length > 0;
    monster.mw = null;
    monster.wormno = created.wormno;
    monster.misc_worn_check = created.misc_worn_check ?? 0;
    monster.weaponCheck = created.weaponCheck ?? 0;
    monster.mtrapseen = created.mtrapseen ?? 0;
    monster.mflee = created.mflee ?? 0;
    monster.mfleetim = created.mfleetim ?? 0;
    monster.mundetected = created.mundetected ?? 0;
    monster.m_ap_type = created.m_ap_type ?? 0;
    monster.mhpmax = Math.max(monster.mhpmax ?? 1, saved.mhpmax ?? 1);
    monster.mhp = monster.mhpmax;
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
        monster.edog = copyRecord(monster.edog);
        monster.mextra = { ...(monster.mextra || {}), edog: monster.edog };
    }
    return monster;
}
