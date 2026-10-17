// Spinning a web with #monster while polymorphed into a spider.
// C refs: cmd.c domonability(), polyself.c dospinweb().
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { feelTrap } from './trap.js';
import { deleteTrap } from './trap_lifecycle.js';
import { exerciseAttribute } from './attrib.js';
import { ANTI_MAGIC, ARROW_TRAP, A_DEX, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE, IS_AIR, LADDER, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, SHOPBASE, SHOP_WEB_COST, MAGIC_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP, SPIKED_PIT, SQKY_BOARD, STAIRS, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB, } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { expelHero } from './hero_expulsion.js';
import { triggerHeroTrap } from './hero_traps.js';
import { game } from './gstate.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { maketrap } from './mklev.js';
import { MONSTER_ATTACKS, MONSTER_NAME, monsterIsAnimal, monsterIsWhirly, } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { AD_COLD, AD_ELEC, AD_FIRE, AT_ENGL, } from './monster_attack_types.js';
import { heroMonsterForm } from './polyself.js';
import { promptKey } from './tty_prompts.js';
import { roomsAt } from './room.js';
import { addShopDamage } from './shop_damage.js';
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
        if ([27, 10, 13].includes(key))
            return null;
        const choice = String.fromCharCode(key).toLowerCase();
        if (choice === 'q')
            return null;
        if (choice === 'h')
            return 'hide';
        if (choice === 's')
            return 'spin';
    }
}
function trapAtHero(state) {
    return state.level?.traps?.find(trap => trap.tx === state.u.ux && trap.ty === state.u.uy) || null;
}
function engulfingAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || []).find(([attackType]) => attackType === AT_ENGL);
}
function whirlyWebMessage(monster) {
    const damageType = engulfingAttack(monster)?.[1];
    let action = '';
    if (damageType === AD_FIRE)
        action = 'ignites and ';
    else if (damageType === AD_ELEC)
        action = 'fries and ';
    else if (damageType === AD_COLD)
        action = 'freezes, shatters and ';
    return `The web ${action}is swept away!`;
}
async function spinWhileSwallowed(state, publish, refresh) {
    const monster = state.u.ustuck;
    if (!monster)
        throw new Error('A swallowed hero must have an engulfing monster');
    await publish(`You release web fluid inside ${monsterName(monster, { state })}.`);
    if (monsterIsAnimal(monster)) {
        await expelHero(monster, { state, publish, refresh });
    }
    else if (monsterIsWhirly(monster)) {
        await publish(whirlyWebMessage(monster));
    }
    else {
        await publish(`The web dissolves into ${monsterName(monster, { state })}.`);
    }
}
export async function useHeroWeb({ state = game, publish = plineWithContinuation, refresh = newsym, createTrap = maketrap, activateTrap = triggerHeroTrap, } = {}) {
    if (!heroCanSpinWeb(state))
        return { used: false, spentTime: false };
    const x = state.u.ux;
    const y = state.u.uy;
    const location = state.level?.at?.(x, y);
    const rejectsWeb = isPoolAt(x, y, state) || isLavaAt(x, y, state)
        || (location !== null && location !== undefined && IS_AIR(location.typ));
    if (state.u.levitating || state.u.levitation || state.levitating
        || rejectsWeb) {
        await publish(`You must be on ${rejectsWeb ? 'solid' : 'the'} ground to spin a web.`);
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
    await exerciseAttribute(A_DEX, true, state);
    const trap = trapAtHero(state);
    if (trap) {
        if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
            await publish('You spin a web, covering up the pit.');
            deleteTrap(trap, state);
            await buryFloorObjectsAt(x, y, state, { publish });
            refresh(x, y);
            return { used: true, spentTime: true };
        }
        if (trap.ttyp === SQKY_BOARD) {
            await publish('The squeaky board is muffled.');
            deleteTrap(trap, state);
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
            await publish(`You web over the ${trap.ttyp === TRAPDOOR ? 'trap door' : 'hole'}.`);
            deleteTrap(trap, state);
            refresh(x, y);
            return { used: true, spentTime: true };
        }
        if (trap.ttyp === ROLLING_BOULDER_TRAP) {
            await publish('You spin a web, jamming the trigger.');
            deleteTrap(trap, state);
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
        await publish(`Your web fails to impede access to the ${location.typ === STAIRS ? 'stairs' : 'ladder'}.`);
        return { used: true, spentTime: true };
    }
    const web = await createTrap(x, y, WEB);
    if (web) {
        await publish('You spin a web.');
        web.madeby_u = 1;
        feelTrap(web, state);
        if (roomsAt(state.level, x, y, SHOPBASE).length)
            addShopDamage(x, y, SHOP_WEB_COST, state);
    }
    return { used: true, spentTime: true, trap: web };
}
//# sourceMappingURL=hero_web.js.map