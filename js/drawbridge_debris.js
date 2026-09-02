// Iron chains thrown loose when a drawbridge collapses.
// C ref: dbridge.c:destroy_drawbridge() -> explode.c:scatter().

import { plineWithContinuation } from './display.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { place_object } from './floor_object.js';
import { mksobj } from './mklev.js';
import { IRON_CHAIN } from './object_data.js';
import { rn2 } from './rng.js';
import { scatterFloorObjects } from './scatter.js';

export async function scatterDrawbridgeDebris(
    bridge,
    wall,
    state,
    options = {},
) {
    const finishMonsterKill = options.finishMonsterKill
        || finishHeroMonsterKill;
    for (let remaining = rn2(6); remaining > 0; remaining--) {
        const origin = {
            x: rn2(2) ? bridge.x : wall.x,
            y: rn2(2) ? bridge.y : wall.y,
        };
        const chain = mksobj(IRON_CHAIN, true, false);
        place_object(chain, origin.x, origin.y);
        await scatterFloorObjects(origin.x, origin.y, 1, {
            state,
            onlyObject: chain,
            mayDestroy: false,
            mayFracture: false,
            heroCaused: true,
            publish: plineWithContinuation,
            finishMonsterKill,
            finishMonsterDeath: async (monster, death) => {
                const killed = await finishMonsterKill(
                    monster, monster.mx, monster.my, {
                        showKillMessage: false,
                        weaponHit: false,
                        noCorpse: death.noCorpse,
                    },
                );
                return { monster, survived: !killed };
            },
        });
    }
}
