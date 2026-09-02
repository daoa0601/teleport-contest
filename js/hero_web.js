// Spinning a web with #monster while polymorphed into a spider.
// C refs: cmd.c domonability(), polyself.c dospinweb().

import { exerciseAttribute } from './attrib.js';
import {
    ANTI_MAGIC, ARROW_TRAP, A_DEX, BEAR_TRAP, DART_TRAP, FIRE_TRAP,
    HOLE, IS_AIR, LADDER, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL,
    MAGIC_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP,
    RUST_TRAP, SLP_GAS_TRAP, SPIKED_PIT, SQKY_BOARD, STAIRS,
    TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB,
} from './const.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { newsym, plineWithContinuation } from './display.js';
import {
    moveExpelledMonster, releaseHeroFromMonster,
} from './hero_expulsion.js';
import { triggerHeroTrap } from './hero_traps.js';
import { game } from './gstate.js';
import { buryFloorObjectsAt, maketrap } from './mklev.js';
import {
    MONSTER_ATTACKS, MONSTER_NAME, monsterDigests, monsterIsAnimal,
    monsterIsWhirly, monsterTypeName,
} from './monster_data.js';
import {
    AD_COLD, AD_ELEC, AD_FIRE, AD_WRAP, AT_ENGL,
} from './monster_attack_types.js';
import { heroMonsterForm } from './polyself.js';
import { promptKey } from './tty_prompts.js';

const PM_CAVE_SPIDER = MONSTER_NAME.indexOf('cave spider');
const PM_GIANT_SPIDER = MONSTER_NAME.indexOf('giant spider');

const TRAPS_TRIGGERED_BY_WEBBING = new Set([
    ARROW_TRAP, DART_TRAP, BEAR_TRAP, ROCKTRAP, FIRE_TRAP, LANDMINE,
    SLP_GAS_TRAP, RUST_TRAP, MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP,
]);

function webMaker(form) {
    return form === PM_CAVE_SPIDER || form === PM_GIANT_SPIDER;
}

export function heroCanSpinWeb(state = game) {
    return webMaker(heroMonsterForm(state));
}

export async function chooseSpiderAbility(readKey = promptKey) {
    for (;;) {
        const key = await readKey('Hide [h] or spin a web [s]? ');
        if ([27, 10, 13].includes(key)) return null;
        const choice = String.fromCharCode(key).toLowerCase();
        if (choice === 'q') return null;
        if (choice === 'h') return 'hide';
        if (choice === 's') return 'spin';
    }
}

function trapAtHero(state) {
    return state.level?.traps?.find(trap =>
        trap.tx === state.u.ux && trap.ty === state.u.uy) || null;
}

function removeTrap(trap, state) {
    const index = state.level?.traps?.indexOf(trap) ?? -1;
    if (index >= 0) state.level.traps.splice(index, 1);
}

function monsterName(monster) {
    return monster?.name
        || monsterTypeName(monster?.mnum, !!monster?.female);
}

function engulfingAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || []).find(
        ([attackType]) => attackType === AT_ENGL,
    );
}

function whirlyWebMessage(monster) {
    const damageType = engulfingAttack(monster)?.[1];
    let action = '';
    if (damageType === AD_FIRE) action = 'ignites and ';
    else if (damageType === AD_ELEC) action = 'fries and ';
    else if (damageType === AD_COLD) action = 'freezes, shatters and ';
    return `The web ${action}is swept away!`;
}

async function expelHero(monster, state, publish, refresh) {
    const name = monsterName(monster);
    if (monsterDigests(monster)) {
        await publish('You get regurgitated!');
    } else if (engulfingAttack(monster)?.[1] === AD_WRAP) {
        await publish(`The ${name} unfolds and you are released!`);
    } else {
        await publish(`You get expelled from the ${name} with a squelch!`);
    }
    releaseHeroFromMonster(monster, state);
    moveExpelledMonster(monster, state);
    refresh(state.u.ux, state.u.uy);
    refresh(monster.mx, monster.my);
}

async function spinWhileSwallowed(state, publish, refresh) {
    const monster = state.u.ustuck;
    const name = monsterName(monster);
    await publish(`You release web fluid inside the ${name}.`);
    if (monsterIsAnimal(monster)) {
        await expelHero(monster, state, publish, refresh);
    } else if (monsterIsWhirly(monster)) {
        await publish(whirlyWebMessage(monster));
    } else {
        await publish(`The web dissolves into the ${name}.`);
    }
}

export async function useHeroWeb({
    state = game,
    publish = plineWithContinuation,
    refresh = newsym,
    createTrap = maketrap,
    activateTrap = triggerHeroTrap,
} = {}) {
    if (!heroCanSpinWeb(state)) return { used: false, spentTime: false };

    const x = state.u.ux;
    const y = state.u.uy;
    const location = state.level?.at?.(x, y);
    const rejectsWeb = isPoolAt(x, y, state) || isLavaAt(x, y, state)
        || IS_AIR(location?.typ);
    if (state.u.levitating || state.u.levitation || state.levitating
        || rejectsWeb) {
        await publish(`You must be on ${
            rejectsWeb ? 'solid' : 'the'
        } ground to spin a web.`);
        return { used: true, spentTime: false, reason: 'terrain' };
    }

    if (state.u.uswallow) {
        await spinWhileSwallowed(state, publish, refresh);
        return { used: true, spentTime: false };
    }
    if (state.u.utrap) {
        await publish('You cannot spin webs while stuck in a trap.');
        return { used: true, spentTime: false, reason: 'trapped' };
    }

    exerciseAttribute(A_DEX, true, state);
    const trap = trapAtHero(state);
    if (trap) {
        if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
            await publish('You spin a web, covering up the pit.');
            removeTrap(trap, state);
            buryFloorObjectsAt(x, y, state);
            refresh(x, y);
            return { used: true, spentTime: true };
        }
        if (trap.ttyp === SQKY_BOARD) {
            await publish('The squeaky board is muffled.');
            removeTrap(trap, state);
            refresh(x, y);
            return { used: true, spentTime: true };
        }
        if ([
            TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL, VIBRATING_SQUARE,
        ].includes(trap.ttyp)) {
            await publish('Your webbing vanishes!');
            return { used: true, spentTime: false };
        }
        if (trap.ttyp === WEB) {
            await publish('You make the web thicker.');
            return { used: true, spentTime: true };
        }
        if (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) {
            await publish(`You web over the ${
                trap.ttyp === TRAPDOOR ? 'trap door' : 'hole'
            }.`);
            removeTrap(trap, state);
            refresh(x, y);
            return { used: true, spentTime: true };
        }
        if (trap.ttyp === ROLLING_BOULDER_TRAP) {
            await publish('You spin a web, jamming the trigger.');
            removeTrap(trap, state);
            refresh(x, y);
            return { used: true, spentTime: true };
        }
        if (TRAPS_TRIGGERED_BY_WEBBING.has(trap.ttyp)) {
            await publish('You have triggered a trap!');
            await activateTrap(trap);
            return { used: true, spentTime: true };
        }
        return { used: true, spentTime: false, reason: 'unknown-trap' };
    }

    if (location?.typ === STAIRS || location?.typ === LADDER) {
        await publish(`Your web fails to impede access to the ${
            location.typ === STAIRS ? 'stairs' : 'ladder'
        }.`);
        return { used: true, spentTime: true };
    }

    const web = await createTrap(x, y, WEB);
    if (web) {
        web.madeby_u = 1;
        web.tseen = true;
        refresh(x, y);
        await publish('You spin a web.');
    }
    return { used: true, spentTime: true, trap: web };
}
