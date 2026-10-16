import { feelTrap } from './trap.js';
// C hack.c:domove_swap_with_pet(), after the hero's tentative move.
import { IS_OBSTRUCTED, IS_STWALL, IS_TREE, W_NONDIGGABLE, W_NONPASSWALL, is_pit } from './const.js';
import { plineWithContinuation } from './display.js';
import { currentMonsterLoad } from './monster_carry.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE, monsterIsVerySmall } from './monster_data.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { monsterName } from './monster_name.js';
import { BOULDER } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { goodPosition } from './teleport_rules.js';
import { trapName } from './trap_name.js';
const TIP_UNTRAP_MON = 1 << 2;
const M1_WALLWALK = 0x08;
const M1_TUNNEL = 0x20;
const M1_NEEDPICK = 0x40;
export async function petRefusesHeroSwap(monster, state) {
    const hero = state.u;
    const x = hero.ux, y = hero.uy;
    // Reveal the pet while the hero is still drawn at the departure square.
    hero.ux = hero.ux0;
    hero.uy = hero.uy0;
    monster.mundetected = 0;
    revealMonsterAppearance(monster);
    hero.ux = x;
    hero.uy = y;
    const trap = monster.mtrapped ? state.level.traps.find(candidate => candidate.tx === monster.mx && candidate.ty === monster.my) : undefined;
    if (!trap)
        monster.mtrapped = 0;
    const boulder = state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
    if (trap && is_pit(trap.ttyp) && boulder)
        return true;
    const subject = monsterName(monster, { state, article: 'your', capitalized: true });
    const diagonal = hero.ux0 !== x && hero.uy0 !== y;
    let reason = null;
    if (diagonal && MONSTER_NAME[monster.mnum] === 'grid bug') {
        reason = "can't move diagonally";
    }
    else if (boulder && !(monsterIsVerySmall(monster.mnum) && currentMonsterLoad(monster) <= 600)) {
        reason = "won't fit into the same spot that you're at";
    }
    else if (diagonal && petBadRock(monster, state, x, hero.uy0)
        && petBadRock(monster, state, hero.ux0, y)
        && ((MONSTER_SIZE[monster.mnum] ?? 0) >= 3 || currentMonsterLoad(monster) > 600)) {
        reason = "won't fit through";
    }
    else if (monster.mpeaceful && trap) {
        const name = trapName(trap.ttyp, { state });
        const which = trap.tseen ? `that ${name}` : withIndefiniteArticle(name);
        if (!trap.tseen) {
            feelTrap(trap, state);
        }
        await plineWithContinuation(`You stop.  ${subject} can't move out of ${which}.`);
        if (state.flags.tips !== false && !((state.context.tips ?? 0) & TIP_UNTRAP_MON)) {
            state.context.tips = (state.context.tips ?? 0) | TIP_UNTRAP_MON;
            await plineWithContinuation('(Tip: perhaps #untrap would help?)');
        }
        return true;
    }
    else if (monster.mpeaceful && (!goodPosition(hero.ux0, hero.uy0, { kind: 'monster', monster }, { state })
        || state.level.traps.some(candidate => candidate.tx === hero.ux0 && candidate.ty === hero.uy0)
        || monster.ispriest || monster.isshk || monster.isgd
        || MONSTER_NAME[monster.mnum] === 'Oracle'
        || monster.m_id === state.quest_status?.leader_m_id)) {
        reason = "doesn't want to swap places";
    }
    if (!reason)
        return false;
    await plineWithContinuation(`You stop.  ${subject} ${reason}.`);
    return true;
}
function petBadRock(monster, state, x, y) {
    const location = state.level.at(x, y);
    if (!location)
        return true;
    if (state.level.flags.sokoban_rules
        && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER))
        return true;
    if (!IS_OBSTRUCTED(location.typ))
        return false;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const mayDig = !((IS_STWALL(location.typ) || IS_TREE(location.typ))
        && (location.wall_info & W_NONDIGGABLE));
    const tunnels = !!(flags & M1_TUNNEL) && !(flags & M1_NEEDPICK) && mayDig;
    const passesWalls = !!(flags & M1_WALLWALK)
        && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL));
    return !tunnels && !passesWalls;
}
//# sourceMappingURL=hero_pet_displacement.js.map