// A monster beginning to flee.
// C ref: monmove.c monflee(), release_hero(), and flees_light().
import { BOLT_LIM, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE } from './const.js';
import { artifactById, artifactEmitsLight } from './artifacts.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { releaseMonsterHold } from './hero_expulsion.js';
import { MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_NAME } from './monster_data.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { inHeroSanctuary } from './priest.js';
import { monsterName } from './monster_name.js';
import { ownedObjectName } from './objnam.js';
import { createPoisonGasCloud } from './regions.js';
import { rn2, rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { heroIsUnaware } from './hero_sleep.js';
import { couldsee } from './vision.js';
import { monsterIsScaredAt } from './monster_fear.js';
const PM_GREMLIN = MONSTER_NAME.indexOf('gremlin');
const PM_VROCK = MONSTER_NAME.indexOf('vrock');
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const M1_SEE_INVIS = 0x01000000;
// C monmove.c:distfleeck(). The range is measured before fleeing can release
// or expel the hero, and remains the caller's range for this attack phase.
export async function checkMonsterHeroRange(monster, { state = game, random = rn2, rollOne = rnd, } = {}) {
    const braveGremlin = random(5) === 0;
    const targetX = monster.mux ?? state.u.ux;
    const targetY = monster.muy ?? state.u.uy;
    const dx = monster.mx - targetX, dy = monster.my - targetY;
    const inRange = dx * dx + dy * dy <= BOLT_LIM * BOLT_LIM;
    const nearby = inRange && Math.abs(dx) <= 1 && Math.abs(dy) <= 1
        && !(monster.mnum === PM_GRID_BUG && dx && dy);
    const seesHero = monster.mcansee
        && (!heroIsInvisible(state)
            || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS));
    const scary = monsterIsScaredAt(monster, state, seesHero ? state.u.ux : targetX, seesHero ? state.u.uy : targetY);
    const scared = nearby && (scary
        || (fleesLight(monster, state) && !braveGremlin)
        || (!monster.mpeaceful && inHeroSanctuary(monster, 0, 0, state)));
    let heroDied = false;
    if (scared) {
        const turns = rollOne(random(7) ? 10 : 100);
        ({ heroDied } = await makeMonsterFlee(monster, {
            state, turns, first: true, random, rollOne,
        }));
    }
    return { inRange, nearby, scared, heroDied };
}
export async function makeMonsterFlee(monster, { state = game, turns = 0, first = false, announce = true, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    requireLiveGame(state);
    if (monster.mhp <= 0)
        return { heroDied: false };
    if (await releaseMonsterHold(monster, { state, publish, random, rollOne }))
        return { heroDied: true };
    const canStart = !first || !monster.mflee;
    if (canStart) {
        if (turns === 0) {
            monster.mfleetim = 0;
        }
        else if (!monster.mflee || monster.mfleetim) {
            const total = turns + (monster.mfleetim ?? 0);
            monster.mfleetim = Math.min(total === 1 ? 2 : total, 127);
        }
        if (!monster.mflee && announce
            && canSeeMonster(monster)
            && M_AP_TYPE(monster) !== M_AP_FURNITURE
            && M_AP_TYPE(monster) !== M_AP_OBJECT) {
            await announceFlight(monster, state, publish, random);
        }
        if (monster.mnum === PM_VROCK && !monster.mspec_used) {
            monster.mspec_used = 75 + random(25);
            await createPoisonGasCloud(state, monster.mx, monster.my, 5, 8, random, publish);
        }
        monster.mflee = 1;
    }
    monster.mtrack = [];
    return { heroDied: false };
}
async function announceFlight(monster, state, publish, random) {
    if (!monster.mcanmove || !MONSTER_MOVE[monster.mnum]) {
        const name = monsterName(monster, {
            adjective: 'immobile', capitalized: true, state,
        });
        await publish(`${name} seems to flinch.`);
    }
    else if (fleesLight(monster, state)) {
        if (heroIsUnaware(state)) {
            await publish(`${monsterName(monster, { capitalized: true, state })} is frightened.`);
        }
        else if (random(10) || heroIsDeaf(state)) {
            const weapon = state.uwep || state.u.uwep;
            const armor = state.uarm || state.u.uarm;
            let source;
            if (weapon && artifactEmitsLight(weapon)) {
                const artifact = artifactById(weapon.oartifact, state);
                if (!artifact)
                    throw new Error('A glowing artifact weapon has no artifact definition');
                source = artifact.name.replace(/^The /, 'the ');
            }
            else {
                if (!armor)
                    throw new Error('A monster fled equipment light without its source');
                source = ownedObjectName(armor, state, { capitalized: false });
            }
            const name = monsterName(monster, { capitalized: true, state });
            await publish(`${name} flees from the painful light of ${source}.`);
        }
        else {
            await publish('"Bright light!"');
        }
    }
    else {
        await publish(`${monsterName(monster, { capitalized: true, state })} turns to flee.`);
    }
}
function fleesLight(monster, state) {
    const weapon = state.uwep || state.u.uwep;
    const armor = state.uarm || state.u.uarm;
    return !!(monster.mnum === PM_GREMLIN
        && ((weapon?.lamplit && artifactEmitsLight(weapon))
            || (armor?.lamplit && artifactEmitsLight(armor)))
        && monster.mcansee && couldsee(monster.mx, monster.my));
}
//# sourceMappingURL=monster_flee.js.map