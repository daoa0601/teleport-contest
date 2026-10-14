// C hack.c:air_turbulence()/water_turbulence() and mkmaze.c:water_friction().
import { exerciseAttribute } from './attrib.js';
import { A_DEX, Is_airlevel, Is_waterlevel, isok } from './const.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroCanSwim } from './hack.js';
import { rn2 } from './rng.js';
import { isPoolAt } from './terrain_properties.js';
import { MOD_ENCUMBER, SLT_ENCUMBER, nearCapacity } from './weight.js';
export async function airTurbulenceStopsHero() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!Is_airlevel(hero.uz) || !rn2(4) || hero.levitating || hero.flying)
        return false;
    switch (rn2(3)) {
        case 0:
            await plineWithContinuation('You tumble in place.');
            await exerciseAttribute(A_DEX, false);
            break;
        case 1:
            await plineWithContinuation("You can't control your movements very well.");
            break;
        case 2:
            await plineWithContinuation("It's hard to walk in thin air.");
            await exerciseAttribute(A_DEX, true);
            break;
    }
    return true;
}
export async function waterTurbulenceStopsHero() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!hero.uinwater)
        return false;
    const swimming = heroCanSwim(game);
    if (!swimming || !rn2(4))
        await applyWaterFriction();
    if (!hero.dx && !hero.dy) {
        endVoluntaryMultiTurn(game);
        return true;
    }
    const x = hero.ux + (hero.dx ?? 0), y = hero.uy + (hero.dy ?? 0);
    if (isok(x, y) && !isPoolAt(x, y, game) && !Is_waterlevel(hero.uz)
        && nearCapacity(game) > (swimming ? MOD_ENCUMBER : SLT_ENCUMBER)) {
        await plineWithContinuation('You are carrying too much to climb out of the water.');
        endVoluntaryMultiTurn(game);
        return true;
    }
    return false;
}
async function applyWaterFriction() {
    const hero = game.u;
    if (hero.dx && !rn2(hero.dy ? 6 : 3)) {
        let dy;
        do {
            dy = rn2(3) - 1;
        } while (dy && (!isok(hero.ux, hero.uy + dy) || !isPoolAt(hero.ux, hero.uy + dy, game)));
        hero.dx = 0;
        hero.dy = dy;
    }
    else if (hero.dy && !rn2(hero.dx ? 5 : 3)) {
        let dx;
        do {
            dx = rn2(3) - 1;
        } while (dx && (!isok(hero.ux + dx, hero.uy) || !isPoolAt(hero.ux + dx, hero.uy, game)));
        hero.dx = dx;
        hero.dy = 0;
    }
    else {
        return;
    }
    await plineWithContinuation('Water turbulence affects your movements.');
}
//# sourceMappingURL=hero_movement_turbulence.js.map