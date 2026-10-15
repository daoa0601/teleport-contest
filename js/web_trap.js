// C trap.c:mu_maybe_destroy_web() and the monster half of trapeffect_web().
import { game } from './gstate.js';
import { canSeeMonster, newsym, plineWithContinuation } from './display.js';
import { deleteTrap } from './trap_lifecycle.js';
import { heroSpecies } from './hero_species.js';
import { monsterName } from './monster_name.js';
import { heroIsDeaf } from './senses.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL, monsterIsAmorphous, monsterIsUnsolid, monsterIsWhirly, } from './monster_data.js';
const FLAMING = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander'].map((name) => MONSTER_NAME.indexOf(name)));
const WEB_TEARERS = new Set([
    'titanothere',
    'baluchitherium',
    'purple worm',
    'jabberwock',
    'iron golem',
    'balrog',
    'kraken',
    'mastodon',
    'Orion',
    'Norn',
    'Cyclops',
    'Lord Surtur',
].map((name) => MONSTER_NAME.indexOf(name)));
const M1_ACID = 0x08000000;
const M2_NASTY = 0x02000000;
const S_GIANT = 34, S_DRAGON = 30;
export async function maybeDestroyWeb(target, trap, { state = game, message = true, publish = plineWithContinuation } = {}) {
    const hero = target === state.u;
    const monster = !hero && 'mnum' in target ? target : null;
    if (!hero && !monster)
        throw new TypeError('Web effects require the live hero or a monster.');
    // youmonst.data describes the natural body as well as polymorphed bodies.
    const species = monster?.mnum ?? heroSpecies(state);
    const body = monster ?? { mnum: species };
    const flaming = FLAMING.has(body.mnum);
    if (!monsterIsAmorphous(body) &&
        !monsterIsWhirly(body) &&
        !flaming &&
        !monsterIsUnsolid(body) &&
        MONSTER_NAME[body.mnum] !== 'gelatinous cube')
        return false;
    const destroy = flaming || !!((MONSTER_FLAGS1[body.mnum] ?? 0) & M1_ACID);
    const owner = trap.madeby_u ? 'your' : 'a';
    if (message) {
        const action = destroy ? (flaming ? 'burn' : 'dissolve') : 'flow through';
        const subject = monster ? monsterName(monster, { capitalized: true, state }) : 'You';
        const verb = hero ? action : action === 'flow through' ? 'flows through' : `${action}s`;
        await publish(`${subject} ${verb} ${owner} spider web${destroy ? '!' : '.'}`);
        if (!hero && !destroy)
            trap.tseen = true;
    }
    if (destroy) {
        deleteTrap(trap, state);
        newsym(trap.tx, trap.ty);
    }
    return true;
}
export async function finishMonsterWebTrap(monster, trap, { state = game, publish = plineWithContinuation, subject = () => monsterName(monster, { capitalized: true, state }), } = {}) {
    const species = MONSTER_NAME[monster.mnum];
    if (species === 'cave spider' || species === 'giant spider')
        return;
    const visible = monster === state.u.usteed || canSeeMonster(monster);
    if (await maybeDestroyWeb(monster, trap, { state, message: visible, publish }))
        return;
    const hiddenBear = !visible && (species === 'owlbear' || species === 'bugbear');
    const tear = !hiddenBear &&
        (WEB_TEARERS.has(monster.mnum) ||
            MONSTER_SYMBOL[monster.mnum] === S_GIANT ||
            (MONSTER_SYMBOL[monster.mnum] === S_DRAGON &&
                (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NASTY) ||
            (!!monster.wormno && (monster.wormSegments?.length || 0) > 5));
    const owner = trap.madeby_u ? 'your' : 'a';
    if (hiddenBear) {
        if (!heroIsDeaf(state))
            await publish('You hear the roaring of a confused bear!');
    }
    else if (visible) {
        const name = typeof subject === 'function' ? subject(monster) : subject;
        if (tear) {
            await publish(`${name} tears through ${owner} spider web!`);
        }
        else {
            await publish(`${name} is caught in ${owner} spider web.`);
            trap.tseen = true;
        }
    }
    monster.mtrapped = tear ? 0 : 1;
    if (tear) {
        deleteTrap(trap, state);
        newsym(monster.mx, monster.my);
    }
}
//# sourceMappingURL=web_trap.js.map