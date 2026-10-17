// C dothrow.c:AutoReturn(), throwit(), and sho_obj_return_to_u().
import { reportHeroEncumbrance } from './encumbrance.js';
import { artifactById } from './artifacts.js';
import { heroArmName, heroFootName } from './body_parts.js';
import { KILLED_BY, W_QUIVER, W_WEP, isok } from './const.js';
import { flush_screen, newsym, plineWithContinuation, transientObjectGlyph } from './display.js';
import { hitHeroWithFallingArtifact } from './falling_artifact.js';
import { requirePlayingGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { dropObjectAtHero } from './object_drop.js';
import { shipObject } from './object_migration.js';
import { AKLYS, BOOMERANG } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { definiteName, killerObjectName, objectName, observeObjectForNaming } from './objnam.js';
import { propertyIsActive } from './properties.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { captureThrownObjectFlight } from './thrown_object.js';
import { addInventoryItemBefore } from './u_init.js';
import { cansee } from './vision.js';
import { setPrimaryWeapon, setQuiverObject, setTwoWeaponCombat } from './weapon_slots.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Position } from './map_types.js';
import type { monsterProjectileDisplay } from './monster_projectile_display.js';

export function isAutoReturningThrow(object: GameObject, weaponMask: number, state: GameState): boolean {
    return object.otyp === BOOMERANG || !!(weaponMask & W_WEP)
        && (object.otyp === AKLYS || artifactById(object.oartifact, state)?.name === 'Mjollnir'
            && state.urole?.key === 'valkyrie');
}

export function throwerIsImpaired(state: GameState): boolean {
    return heroIsBlind(state) || heroIsHallucinating(state)
        || state.u.confused || propertyIsActive('confusion', state)
        || state.u.stunned || propertyIsActive('stunned', state)
        || state.u.fumbling || propertyIsActive('fumbling', state);
}

interface ReturningThrowOptions {
    state: GameState;
    object: GameObject;
    impact: Position;
    impaired: boolean;
    twoWeapons: boolean;
    oldSlot: GameObject | null;
    tetherDisplay?: ReturnType<typeof monsterProjectileDisplay> | null;
}

// A failed return still needs throwit()'s landing at the target square.
export async function finishReturningThrow({
    state, object, impact, impaired, twoWeapons, oldSlot, tetherDisplay,
}: ReturningThrowOptions): Promise<boolean> {
    requirePlayingGame(state);
    if (rn2(100) === 0) {
        tetherDisplay?.clear();
        await plineWithContinuation(`${returningSubject(object, state)} fails to return!`);
        return false;
    }
    if (tetherDisplay) await tetherDisplay.backtrack();
    else await showReturnFlight(object, impact, state);

    if (!impaired && rn2(100) !== 0) {
        await plineWithContinuation(`${returningSubject(object, state)} returns to your hand!`);
        const returned = await addInventoryItemBefore(object, oldSlot);
        await reportHeroEncumbrance(state);
        if ((returned.owornmask ?? 0) & W_QUIVER) await setQuiverObject(null, state);
        await setPrimaryWeapon(returned, state);
        setTwoWeaponCombat(twoWeapons, state);
        if (cansee(impact.x, impact.y)) newsym(impact.x, impact.y);
        return true;
    }

    let damage = rn2(2);
    if (damage === 0) {
        const position = propertyIsActive('levitation', state) ? 'beneath' : 'at';
        const feet = makePlural(heroFootName(state));
        await plineWithContinuation(heroIsBlind(state)
            ? `Something lands ${position} your ${feet}.`
            : `${returningSubject(object, state)} returns back to you, landing ${position} your ${feet}.`);
    } else {
        damage += rnd(3);
        const arm = heroArmName(state);
        await plineWithContinuation(heroIsBlind(state)
            ? `${returningSubject(object, state)} hits your ${arm}!`
            : `${returningSubject(object, state)} flies back toward you, hitting your ${arm}!`);
        if (object.oartifact) {
            const hit = await hitHeroWithFallingArtifact(object, damage, {
                state, publish: plineWithContinuation, random: rn2, rollOne: rnd, dieRoll: 0,
            });
            if (hit.heroDied) return true;
            damage = hit.damage;
        }
        if (await loseHeroHp(state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage,
            killerObjectName(object, state), { state, killerFormat: KILLED_BY })) return true;
    }

    if (state.u.uswallow) {
        const engulfer = state.u.ustuck;
        if (!engulfer) throw new Error('A swallowed returning weapon needs an engulfer.');
        await addObjectToMonsterInventory(engulfer, object, state, { atFront: true });
    } else if (!await shipObject(object, state.u.ux, state.u.uy, { state })) {
        await dropObjectAtHero(object, { state });
    }
    return true;
}

function returningSubject(object: GameObject, state: GameState): string {
    observeObjectForNaming(object, { state });
    const name = definiteName(objectName(object, state), state);
    return name.charAt(0).toUpperCase() + name.slice(1);
}

async function showReturnFlight(object: GameObject, impact: Position, state: GameState): Promise<void> {
    const dx = state.u.dx ?? 0, dy = state.u.dy ?? 0;
    if (!(dx || dy) || impact.x === state.u.ux && impact.y === state.u.uy) return;
    const path: Position[] = [];
    let x = impact.x - dx, y = impact.y - dy;
    while (isok(x, y) && (x !== state.u.ux || y !== state.u.uy)) {
        path.push({ x, y });
        x -= dx;
        y -= dy;
    }
    const glyph = transientObjectGlyph(object);
    await flush_screen(0);
    await captureThrownObjectFlight(object, path, state, glyph);
}
