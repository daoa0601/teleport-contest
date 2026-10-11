// The mapped record makes adding an initialized field require a corresponding
// boundary check. Values remain the actual field names, so no string cast is
// needed when inspecting the partially initialized hero.
const INITIALIZED_FIELDS = {
    uz: 'uz', ulevel: 'ulevel', ulevelmax: 'ulevelmax', ulevelpeak: 'ulevelpeak',
    uhp: 'uhp', uhpmax: 'uhpmax', uhppeak: 'uhppeak',
    uen: 'uen', uenmax: 'uenmax', uenpeak: 'uenpeak',
    uhpinc: 'uhpinc', ueninc: 'ueninc', uexp: 'uexp', urexp: 'urexp',
    ublesscnt: 'ublesscnt', uac: 'uac', ualign: 'ualign',
    ualignbase: 'ualignbase', uroleplay: 'uroleplay', rightHanded: 'rightHanded',
    umovement: 'umovement', umonster: 'umonster', umonnum: 'umonnum',
    ulycn: 'ulycn', mh: 'mh', mhmax: 'mhmax', mtimedone: 'mtimedone',
    nv_range: 'nv_range', xray_range: 'xray_range', uhave: 'uhave', uconduct: 'uconduct',
    urooms: 'urooms', urooms0: 'urooms0', uentered: 'uentered',
    ushops: 'ushops', ushops0: 'ushops0',
    ushops_entered: 'ushops_entered', ushops_left: 'ushops_left',
    acurr: 'acurr', amax: 'amax', atemp: 'atemp',
    uhunger: 'uhunger', uhs: 'uhs', weaponSkills: 'weaponSkills',
    skillRecord: 'skillRecord', weapon_slots: 'weapon_slots',
};
export function requireInitializedHero(hero) {
    for (const field of Object.values(INITIALIZED_FIELDS)) {
        if (hero[field] === undefined)
            throw new Error(`Hero initialization has not installed ${field}`);
    }
}
// Allocation must preserve absence until the owning startup phase runs.
export function createHeroState() {
    return { ux: 0, uy: 0, ux0: 0, uy0: 0 };
}
export function requireHeroAttributes(hero) {
    const { acurr, amax, atemp } = hero;
    if (!acurr || !amax || !atemp)
        throw new Error('Hero attributes are not initialized');
    return { acurr, amax, atemp };
}
//# sourceMappingURL=hero_types.js.map