// Shared travel, hit, bounce, animation, and reflection rules for rays.
// C refs: zap.c dobuzz(), bounce_dir(), zap_hit(), and muse.c mon_reflects().
import { artifactById } from './artifacts.js';
import { liveSpellSkill } from './spell_casting_rules.js';
import { currentAttribute, exerciseWisdom } from './attrib.js';
import { findMonsterArmorClass } from './monworn.js';
import { monsterAtPosition } from './monster_location.js';
import { A_DEX, P_BASIC, P_SKILLED, P_EXPERT, COLNO, DOOR, D_CLOSED, D_LOCKED, In_mines, IS_ROOM, IS_WALL, Is_airlevel, ROWNO, STONE, W_AMUL, W_ARM, W_ARMS, ZAP_POS, } from './const.js';
import { canSpotMonster, flush_screen, lastDirtyMapCursor, map_invisible, newsym, unmap_invisible, zapdir_to_glyph, } from './display.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION, SILVER_DRAGON_SCALE_MAIL, SILVER_DRAGON_SCALES, } from './object_data.js';
import { recordObjectKnowledge } from './object_knowledge.js';
import { rn2, rnd } from './rng.js';
import { cansee } from './vision.js';
import { TemporaryMapEffect } from './temporary_map_effect.js';
const DIRECTION_X = Object.freeze({
    h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1,
});
const DIRECTION_Y = Object.freeze({
    h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1,
});
export function rayPositionIsValid(x, y) {
    return x >= 1 && x < COLNO && y >= 0 && y < ROWNO;
}
export function closedRayDoor(location) {
    return location?.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
}
export function rayPositionIsOpen(x, y, state = game) {
    if (!rayPositionIsValid(x, y))
        return false;
    const location = state.level?.at(x, y);
    return !!location && ZAP_POS(location.typ) && !closedRayDoor(location);
}
export function rayMonsterAt(x, y, state = game) {
    return state.level ? monsterAtPosition(state.level, x, y) : null;
}
export function rayHitsMonster(monster, random = rn2, rollOne = rnd, { state = game, spellType = 0, } = {}) {
    const armorClass = findMonsterArmorClass(monster);
    const chance = random(20);
    let bonus = 0;
    if (spellType) {
        const skill = liveSpellSkill(spellType, state);
        bonus = skill === P_EXPERT ? 3 : skill === P_SKILLED ? 2 : skill === P_BASIC ? 0 : -4;
        const dexterity = currentAttribute(A_DEX, state);
        bonus += dexterity < 4 ? -3 : dexterity < 6 ? -2 : dexterity < 8 ? -1
            : dexterity < 14 ? 0 : dexterity - 14;
    }
    if (!chance)
        return rollOne(10) < armorClass + bonus;
    const effectiveArmorClass = armorClass >= 0 ? armorClass : -rollOne(-armorClass);
    return 3 - chance < effectiveArmorClass + bonus;
}
export function rayHitsHero(state = game, random = rn2, rollOne = rnd) {
    const armorClass = typeof state.u.uac === 'number' && Number.isFinite(state.u.uac) ? state.u.uac : 10;
    const chance = random(20);
    if (!chance)
        return rollOne(10) < armorClass;
    const effectiveArmorClass = armorClass >= 0
        ? armorClass : -rollOne(-armorClass);
    return 3 - chance < effectiveArmorClass;
}
export function heroReflectionSource(state = game) {
    if (state.uarms?.otyp === SHIELD_OF_REFLECTION)
        return { object: state.uarms, noun: 'shield' };
    const weapon = state.uwep || state.u?.uwep;
    if (weaponReflects(weapon, state))
        return { object: weapon, noun: 'weapon' };
    const amulet = state.uamul || state.u?.uamul;
    if (amulet?.otyp === AMULET_OF_REFLECTION)
        return { object: amulet, noun: 'medallion' };
    const armor = state.uskin || state.uarm || state.u?.uarm;
    if (armor && [SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL]
        .includes(armor.otyp)) {
        return { object: armor, noun: state.uskin ? 'luster' : 'armor' };
    }
    if (MONSTER_NAME[state.u.umonnum ?? -1] === 'silver dragon')
        return { object: null, noun: 'scales' };
    return null;
}
export function heroReflectsRay(state = game) {
    return !!(state.u?.reflection
        || heroReflectionSource(state));
}
function weaponReflects(object, state) {
    if (!object)
        return false;
    return !!artifactById(object?.oartifact, state)?.flags.includes('SPFX_REFLECT');
}
export function monsterReflectionSource(monster, state = game) {
    const shield = monsterWornObject(monster, W_ARMS);
    if (shield?.otyp === SHIELD_OF_REFLECTION)
        return { noun: 'shield', object: shield };
    const weapon = monsterWieldedWeapon(monster);
    if (weaponReflects(weapon, state)) {
        return { noun: 'weapon', object: weapon };
    }
    const amulet = monsterWornObject(monster, W_AMUL);
    if (amulet?.otyp === AMULET_OF_REFLECTION)
        return { noun: 'amulet', object: amulet };
    const suit = monsterWornObject(monster, W_ARM);
    if (suit && [SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL]
        .includes(suit.otyp)) {
        return { noun: 'armor', object: suit };
    }
    const species = MONSTER_NAME[monster?.mnum];
    if (species === 'silver dragon' || species === 'Chromatic Dragon')
        return { noun: 'scales', object: null };
    return null;
}
export function monsterReflectsRay(monster, state = game) {
    return monsterReflectionSource(monster, state) !== null;
}
export function discoverHeroReflectionSource(source = heroReflectionSource(), state = game) {
    const object = source?.object;
    if (!object || ![SHIELD_OF_REFLECTION, AMULET_OF_REFLECTION].includes(object.otyp)
        || state._knownObjectTypes?.has(object.otyp))
        return;
    exerciseWisdom(true, state);
    recordObjectKnowledge(object.otyp, state);
    object.typeKnown = true;
}
export function discoverReflectingShield(state = game) {
    const shield = state.uarms;
    if (!shield || shield.otyp !== SHIELD_OF_REFLECTION)
        return;
    discoverHeroReflectionSource({ object: shield, noun: 'shield' }, state);
}
export function rayBounceDirection(x, y, dx, dy, bounceback, state = game, random = rn2) {
    if (!dx || !dy || (bounceback > 0 && random(bounceback) === 0))
        return { dx: -dx, dy: -dy };
    const previousX = x - dx;
    const previousY = y - dy;
    let bounce = 0;
    const vertical = state.level?.at(x, previousY);
    const verticalAhead = state.level?.at(x + dx, previousY);
    if (vertical && rayPositionIsOpen(x, previousY, state)
        && (IS_ROOM(vertical.typ)
            || rayPositionIsValid(x + dx, previousY)
                && !!verticalAhead && ZAP_POS(verticalAhead.typ))) {
        bounce = 1;
    }
    const horizontal = state.level?.at(previousX, y);
    const horizontalAhead = state.level?.at(previousX, y + dy);
    if (horizontal && rayPositionIsOpen(previousX, y, state)
        && (IS_ROOM(horizontal.typ)
            || rayPositionIsValid(previousX, y + dy)
                && !!horizontalAhead && ZAP_POS(horizontalAhead.typ))
        && (!bounce || random(2))) {
        bounce = 2;
    }
    if (bounce === 2)
        return { dx: -dx, dy };
    if (bounce === 1)
        return { dx, dy: -dy };
    return { dx: -dx, dy: -dy };
}
export async function runRay({ state = game, direction, range, beamType, originX = state.u.ux, originY = state.u.uy, random = rn2, canSee = (x, y) => cansee(x, y), onCell, stopAtObstacle = false, onObstacle = null, onBounce = async () => undefined, onVanish = async () => undefined, }) {
    let dx = DIRECTION_X[direction] || 0;
    let dy = DIRECTION_Y[direction] || 0;
    let x = originX;
    let y = originY;
    const beamCells = new TemporaryMapEffect('beam', zapdir_to_glyph(dx, dy, beamType));
    await beamCells.start();
    let heroDied = false;
    try {
        while (range-- > 0) {
            const previousX = x;
            const previousY = y;
            x += dx;
            y += dy;
            const valid = rayPositionIsValid(x, y);
            const location = valid ? state.level?.at(x, y) : null;
            let cell = {};
            if (valid && location?.typ !== STONE) {
                if (canSee(x, y)) {
                    const monster = rayMonsterAt(x, y, state);
                    if (monster && !canSpotMonster(monster))
                        map_invisible(x, y);
                    else if (!monster)
                        unmap_invisible(x, y);
                }
                if (canSee(x, y)
                    && (rayPositionIsOpen(x, y, state)
                        || (rayPositionIsValid(previousX, previousY)
                            && canSee(previousX, previousY)))) {
                    paintRayCell(beamCells, x, y, dx, dy, beamType);
                    await captureRayTraversalFrame(state);
                }
                state.bhitpos = { x, y };
                cell = await onCell({
                    x, y, dx, dy, location: location ?? null, remainingRange: range,
                }) || {};
                range += cell.rangeChange || 0;
                if (cell.reflected) {
                    dx = -dx;
                    dy = -dy;
                }
                if (cell.stop) {
                    heroDied = !!cell.result?.heroDied;
                    return cell.result;
                }
            }
            if (!rayPositionIsOpen(x, y, state)) {
                if (cell.absorbed)
                    break;
                range--;
                if ((range > 0 && rayPositionIsValid(previousX, previousY) && canSee(previousX, previousY)
                    || stopAtObstacle) && Is_airlevel(state.u?.uz)) {
                    await onVanish({ x, y, previousX, previousY });
                    break;
                }
                if (stopAtObstacle) {
                    await onObstacle?.({ x, y, previousX, previousY });
                    break;
                }
                if (range > 0 && rayPositionIsValid(previousX, previousY)
                    && canSee(previousX, previousY)) {
                    await onBounce({ x, y, previousX, previousY });
                }
                const bounceback = rayBouncebackChance(valid, location, state);
                ({ dx, dy } = rayBounceDirection(x, y, dx, dy, bounceback, state, random));
            }
        }
    }
    finally {
        if (!heroDied && !state.program_state?.gameover)
            beamCells.clear();
    }
    return undefined;
}
export async function captureRayTraversalFrame(state = game) {
    const frameCursor = lastDirtyMapCursor();
    const messageCursor = state._pending_message
        ? [state._pending_message.length, 0] : null;
    await flush_screen(1);
    if (frameCursor)
        state.nhDisplay?.setCursor(...frameCursor);
    else if (messageCursor)
        state.nhDisplay?.setCursor(...messageCursor);
    await state.animationFrame?.();
}
export function paintRayCell(effect, x, y, dx, dy, beamType) {
    const glyph = zapdir_to_glyph(dx, dy, beamType);
    effect.changeGlyph(glyph);
    effect.draw(x, y);
}
function rayBouncebackChance(valid, location, state) {
    if (!valid || location?.typ === STONE)
        return 10;
    if (In_mines(state.u?.uz) && IS_WALL(location?.typ ?? STONE))
        return 20;
    return 75;
}
function monsterWornObject(monster, mask) {
    const inventory = monster?.minvent || monster?.inventory || [];
    return inventory.find(object => ((object.owornmask ?? 0) & mask) !== 0)
        || null;
}
//# sourceMappingURL=ray.js.map