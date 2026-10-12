// C wizard.c:tactics(STRAT_HEAL), including choose_stairs() and the
// fall-through to harassment when the monster cannot heal at a distance.
import { BOLT_LIM, RLOC_MSG, STRAT_APPEARMSG, STRAT_HEAL, STRAT_WAITMASK } from './const.js';
import { dungeonBuildsUp, insideWizardTower } from './dungeon.js';
import { expelHero } from './hero_expulsion.js';
import { healMonster } from './mon.js';
import { AMULET_OF_YENDOR } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { mnearto } from './shop_damage.js';
import { randomMonsterRelocation } from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
export async function retreatCovetousMonster(monster, state, random = rn2, rollOne = rnd) {
    monster.mstrategy = ((monster.mstrategy ?? 0) & (STRAT_WAITMASK | STRAT_APPEARMSG)) | STRAT_HEAL;
    let healingX = monster.mx, healingY = monster.my;
    if (state.u.uswallow && state.u.ustuck === monster) {
        const expelled = await expelHero(monster, { state, random, rollOne });
        if (expelled.died)
            return 'blocked';
    }
    const stairs = chooseRetreatStairs(monster, state);
    monster.mavenge = 1;
    const amulet = (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_YENDOR);
    const staysInTower = insideWizardTower(healingX, healingY, state)
        || (monster.iswiz && !stairs && !amulet);
    if (staysInTower) {
        if (!monsterTeleportRestricted(monster, state)
            && random(3 + Math.trunc(monster.mhp / 10)) === 0)
            await randomMonsterRelocation(monster, { state, random, rollOne, flags: RLOC_MSG });
    }
    else if (stairs && (healingX !== stairs.sx || healingY !== stairs.sy)) {
        if (!monsterTeleportRestricted(monster, state)
            && !await mnearto(monster, stairs.sx, stairs.sy, state, { moveOther: true, flags: RLOC_MSG }))
            return 'blocked';
        healingX = monster.mx;
        healingY = monster.my;
    }
    // tactics() updates its cached position only when retreating to stairs.
    const dx = healingX - state.u.ux, dy = healingY - state.u.uy;
    if (dx * dx + dy * dy > BOLT_LIM * BOLT_LIM && monster.mhp <= monster.mhpmax - 8) {
        healMonster(monster, rollOne(8));
        return 'recovered';
    }
    return 'harass';
}
function chooseRetreatStairs(monster, state) {
    const forward = !!(monster.m_id % 2);
    const up = dungeonBuildsUp(state.u.uz, state) ? forward : !forward;
    const stairs = [];
    for (let stair = state.stairs; stair; stair = stair.next)
        stairs.push(stair);
    return stairs.find(stair => !stair.isladder && stair.up === up)
        ?? stairs.find(stair => stair.isladder && stair.up === up)
        ?? stairs.find(stair => stair.tolev.dnum !== state.u.uz.dnum)
        ?? stairs.find(stair => !stair.isladder && stair.up !== up)
        ?? stairs.find(stair => stair.isladder && stair.up !== up)
        ?? null;
}
//# sourceMappingURL=monster_covetous_retreat.js.map