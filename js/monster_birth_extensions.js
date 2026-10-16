// C makemon.c:makemon() allocates requested role records without appointing
// the monster to that role. The caller fills them before setting role flags.
import { MM_EDOG, MM_EGD, MM_EMIN, MM_EPRI, MM_ESHK } from './const.js';
export function allocateMonsterBirthExtensions(monster, flags) {
    if (!(flags & (MM_EDOG | MM_EGD | MM_EMIN | MM_EPRI | MM_ESHK)))
        return;
    monster.mcorpsenm = -1;
    // Native allocation precedes next_ident(), while the actor's ID is zero.
    const parentmid = 0;
    if (flags & MM_EDOG) {
        monster.edog = {
            parentmid, droptime: 0, dropdist: 0, apport: 0, whistletime: 0,
            hungrytime: 0, ogoal: { x: 0, y: 0 }, abuse: 0, revivals: 0,
            mhpmax_penalty: 0, killed_by_u: 0,
        };
    }
    if (flags & MM_EMIN)
        ensureMinionData(monster).parentmid = parentmid;
    if (flags & MM_EPRI) {
        monster.epri = {
            parentmid, shroom: 0, shralign: 0, shrpos: { x: 0, y: 0 },
            shrlevel: { dnum: 0, dlevel: 0 }, cheapskate_count: 0,
            intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
        };
    }
    if (flags & MM_ESHK) {
        monster.eshk = {
            parentmid, shoproom: 0, shoptype: 0, shoplevel: { dnum: 0, dlevel: 0 },
            shd: { x: 0, y: 0 }, shk: { x: 0, y: 0 }, shknam: '',
            bill: [], billct: 0, billUnavailable: true,
            credit: 0, debit: 0, loan: 0, robbed: 0, surcharge: 0,
            following: 0, customer: '', visitct: 0, dismiss_kops: false,
            break_seq: 0, seq_peaceful: 0,
        };
    }
    if (flags & MM_EGD) {
        monster._egd = {
            gdlevel: { dnum: 0, dlevel: 0 }, gddone: 0,
            ogx: 0, ogy: 0, gdx: 0, gdy: 0, vault: null,
            warncnt: 0, fcbeg: 0, fcend: 0, fakecorr: [], dropgoldcnt: 0,
        };
    }
}
// C minion.c:newemin(). Preserve an existing record and its ownership link.
export function ensureMinionData(monster) {
    const minion = monster.emin ?? monster.mextra?.emin
        ?? { parentmid: monster.m_id, min_align: 0, renegade: 0 };
    monster.emin = minion;
    monster.mextra ??= {};
    monster.mextra.emin = minion;
    return minion;
}
//# sourceMappingURL=monster_birth_extensions.js.map