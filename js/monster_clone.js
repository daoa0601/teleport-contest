// Monster cloning and splitting.
// C refs: makemon.c clone_mon() and potion.c split_mon().
import { G_EXTINCT, isok } from './const.js';
import { canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { game, requireGameLevel } from './gstate.js';
import { nextIdent } from './ident.js';
import { findMonsterNearPosition } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import { monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { monsterName, possessiveName, shopkeeperName } from './monster_name.js';
import { tameMonster } from './monster_taming.js';
import { rn2 } from './rng.js';
import { monsterEmitsLight } from './vision.js';
function copyPetState(monster, clone) {
    const source = monster.edog || monster.mextra?.edog;
    if (!source)
        return;
    const edog = {
        ...source,
        ogoal: source.ogoal ? { ...source.ogoal } : source.ogoal,
    };
    clone.edog = edog;
    clone.mextra = { ...(clone.mextra || {}), edog };
}
export async function cloneMonster(monster, state = game, { monsterMoving = !!state.context.mon_moving, random = rn2, position } = {}) {
    if (!monster || (monster.mhp ?? 0) <= 1)
        return null;
    if ((state.mvitals?.[monster.mnum]?.mvflags ?? 0) & G_EXTINCT)
        return null;
    const level = requireGameLevel(state);
    let destination = position ?? { x: monster.mx, y: monster.my };
    if (!isok(destination.x, destination.y))
        return null;
    if (monsterAtPosition(level, destination.x, destination.y)) {
        const nearby = findMonsterNearPosition(monster.mnum, destination.x, destination.y, { state });
        if (!nearby || monsterAtPosition(level, nearby.x, nearby.y))
            return null;
        destination = nearby;
    }
    const inventory = [];
    const clone = {
        ...monster,
        m_id: nextIdent(state),
        mx: destination.x,
        my: destination.y,
        mundetected: 0,
        mtrapped: 0,
        mcloned: 1,
        mleashed: 0,
        isshk: 0,
        isgd: 0,
        ispriest: 0,
        minvent: inventory,
        inventory,
        hasInventory: false,
        mtrack: [],
    };
    delete clone.mextra;
    delete clone.edog;
    delete clone.emin;
    delete clone.epri;
    delete clone.eshk;
    delete clone._egd;
    delete clone.mcorpsenm;
    if (monster.mextra?.mgivenname)
        clone.mextra = { mgivenname: monster.mextra.mgivenname };
    if (monster.isshk && !monster.mgivenname && !monster.mextra?.mgivenname)
        clone.name = shopkeeperName(monster, { state });
    clone.mhpmax = monster.mhpmax;
    clone.mhp = Math.trunc(monster.mhp / 2);
    monster.mhp -= clone.mhp;
    placeMonsterAt(clone, destination.x, destination.y);
    // cutworm replaces the copied body after cloning. During taming, the
    // copied worm number still refers to the parent's retained segments.
    level.monsters.push(clone);
    if (monsterEmitsLight(clone.mnum))
        state.vision_full_recalc = 1;
    if (!monsterMoving && monster.mpeaceful) {
        const attitudeRange = Math.max(2 + (state.u?.uluck ?? 0), 2);
        if ((monster.mtame ?? 0) > 0) {
            clone.mtame = random(attitudeRange) ? monster.mtame ?? 0 : 0;
        }
        else {
            clone.mpeaceful = random(attitudeRange) ? 1 : 0;
        }
    }
    if (clone.isminion) {
        const minion = monster.emin ?? monster.mextra?.emin;
        if (!minion)
            throw new Error(`Cloning minion ${monster.m_id} requires its alignment state.`);
        if (!state.u.ualign)
            throw new Error('Cloning a minion requires the hero alignment.');
        clone.emin = {
            ...minion,
            renegade: (minion.min_align !== state.u.ualign.type) !== !clone.mpeaceful,
        };
        clone.mextra = { ...clone.mextra, emin: clone.emin };
    }
    else if ((clone.mtame ?? 0) > 0) {
        clone.mtame = 0;
        clone.pet = false;
        if (await tameMonster(clone, null, { state }))
            copyPetState(monster, clone);
    }
    else {
        clone.pet = false;
        delete clone.edog;
        if (clone.mextra)
            delete clone.mextra.edog;
    }
    setMonsterMalign(clone, state);
    if (state === game)
        newsym(clone.mx, clone.my);
    return clone;
}
// C potion.c:split_mon() for a monster.  The heat source is named before
// cloning, and a spotted monster announces the division.
export async function splitMonster(monster, state = game, { heatSource = null, publish = plineWithContinuation, ...options } = {}) {
    if (!monster)
        return null;
    const reason = heatSource === 'hero' ? ' from your heat'
        : heatSource ? ` from ${possessiveName(monsterName(heatSource, { state }))} heat` : '';
    const maximumHp = monster.mhpmax ?? monster.mhp ?? 0;
    if ((monster.mhp ?? 0) > maximumHp)
        monster.mhp = maximumHp;
    const clone = await cloneMonster(monster, state, options);
    if (!clone)
        return null;
    clone.mhpmax = Math.trunc(maximumHp / 2);
    monster.mhpmax = maximumHp - clone.mhpmax;
    if (canSpotMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} multiplies${reason}!`);
    return clone;
}
//# sourceMappingURL=monster_clone.js.map