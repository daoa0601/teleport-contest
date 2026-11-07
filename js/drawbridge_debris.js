// Iron chains thrown loose when a drawbridge collapses.
// C ref: dbridge.c:destroy_drawbridge() -> explode.c:scatter().
import { plineWithContinuation } from './pline.js';
import { finishEnvironmentalMonsterDeath, finishHeroMonsterKill, } from './mon.js';
import { mksobj, placeCreatedObject } from './mkobj.js';
import { IRON_CHAIN } from './object_data.js';
import { rn2 } from './rng.js';
import { scatterFloorObjects } from './explode.js';
// Part of C dbridge.c:destroy_drawbridge(): the iron-chain debris loop
// around explode.c:scatter().
export async function scatterDrawbridgeDebris(bridge, wall, state, options = {}) {
    const heroCaused = !state.context.mon_moving;
    const finishMonsterKill = options.finishMonsterKill || finishHeroMonsterKill;
    for (let remaining = rn2(6); remaining > 0; remaining--) {
        const origin = {
            x: rn2(2) ? bridge.x : wall.x,
            y: rn2(2) ? bridge.y : wall.y,
        };
        const chain = await mksobj(IRON_CHAIN, true, false);
        placeCreatedObject(chain, origin.x, origin.y);
        await scatterFloorObjects(origin.x, origin.y, 1, {
            state,
            onlyObject: chain,
            mayDestroy: false,
            mayFracture: false,
            heroCaused,
            publish: plineWithContinuation,
            ...(heroCaused ? { finishMonsterKill } : {}),
            finishMonsterDeath: async (monster, death) => {
                if (!heroCaused)
                    return finishEnvironmentalMonsterDeath(monster, state, death);
                const killed = await finishMonsterKill(monster, monster.mx, monster.my, {
                    showKillMessage: false,
                    noCorpse: death?.noCorpse ?? false,
                });
                return { monster, survived: !killed };
            },
        });
    }
}
//# sourceMappingURL=drawbridge_debris.js.map