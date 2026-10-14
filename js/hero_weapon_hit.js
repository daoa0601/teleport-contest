import { game, requirePlayingGame } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { hitMonsterWithHeroObject } from './hero_physical_hit.js';
import { makeMonsterFlee } from './monster_flee.js';
import { rnd, rn2 } from './rng.js';
import { monsterSpeciesSticks } from './monster_data.js';
import { showHeroMeleeMiss } from './hero_attack_accuracy.js';
import { isWeaponTool } from './object_properties.js';
import { isAxe, isBlade } from './weapon_type.js';
import { cutWorm } from './monster_worm.js';
export async function resolveHeroWeaponHit(monster, x, y, weapon, { attack, hit, threshold, armorPenalty, dieRoll, twoHits, confirmationOverridden = false }) {
    requirePlayingGame(game);
    if (confirmationOverridden && game.flags.verbose)
        await plineWithContinuation('Your bloodthirsty blade attacks!');
    if (!hit) {
        const miss = await showHeroMeleeMiss(monster, attack, threshold + armorPenalty > dieRoll);
        return { hit: false, survived: true, heroDied: miss.heroDied };
    }
    const sliceOrChop = isBlade(weapon) || isAxe(weapon);
    const oldHitPoints = monster.mhp;
    const oldWeaponHits = game.u.uconduct.weaphit ?? 0;
    if (weapon && (weapon.oclass === 2 || isWeaponTool(weapon)))
        game.u.uconduct.weaphit = oldWeaponHits + 1;
    const result = await hitMonsterWithHeroObject(monster, weapon, {
        mode: 'melee', dieRoll, twoHits, target: { x, y },
    });
    if (result.heroDied || !result.survived)
        return { ...result, hit: true };
    if (rn2(25) === 0 && monster.mhp < Math.trunc(monster.mhpmax / 2)
        && !(game.u.uswallow && game.u.ustuck === monster)) {
        const flight = await makeMonsterFlee(monster, { turns: rn2(3) === 0 ? rnd(100) : 0 });
        if (flight.heroDied)
            return { ...result, hit: true, heroDied: true };
        if (game.u.ustuck === monster && !game.u.uswallow && !monsterSpeciesSticks(game.u.umonnum)) {
            game.u.ustuck = null;
            game.context.botl = true;
        }
    }
    if (monster.mhp === oldHitPoints) {
        game.u.uconduct.weaphit = oldWeaponHits;
        return { ...result, hit: false };
    }
    if (monster.wormno)
        await cutWorm(monster, x, y, sliceOrChop);
    return { ...result, hit: true };
}
//# sourceMappingURL=hero_weapon_hit.js.map