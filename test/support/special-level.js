import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL, MAXNROFROOMS } from '../../js/const.js';
import { init_objects } from '../../js/o_init.js';
import { init_rect } from '../../js/rect.js';
import { initRng } from '../../js/rng.js';
import { freshGame } from './game-state.js';
export function freshSpecialLevel({ prototype, variant, seed, depth = 11, defaultLit = false, monsterAlignment = null, }) {
    const attributes = [12, 12, 12, 12, 12, 12];
    const state = freshGame({
        heroX: 1,
        heroY: 1,
        hero: {
            uz: { dnum: 0, dlevel: depth },
            ulevel: Math.max(1, Math.min(depth, 30)),
            uhp: 80,
            uhpmax: 80,
            acurr: { a: [...attributes] },
            amax: { a: [...attributes] },
            uhave: {},
            ualign: { type: 0, record: 0 },
        },
        flags: {},
        context: {},
        moves: 2,
    });
    state.in_mklev = true;
    state.dungeons = [{
            dname: 'The Dungeons of Doom',
            depth_start: 1,
            num_dunlevs: 30, entry_lev: 1, dunlev_ureached: 0,
            flags: { maze_like: false, hellish: false, alignment: null },
            bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
        }];
    state.specialLevels = new Map([[prototype, {
                dnum: 0,
                dlevel: depth,
                flags: { town: false },
                alignment: monsterAlignment === null ? null
                    : { law: A_LAWFUL, neutral: A_NEUTRAL, chaos: A_CHAOTIC }[monsterAlignment],
            }]]);
    state.level.subrooms = [];
    state.level.nsubroom = 0;
    state.stairs = null;
    state.smeq = Array.from({ length: MAXNROFROOMS + 1 }, () => 0);
    init_rect();
    initRng(999n);
    init_objects();
    initRng(BigInt(seed));
    const active = {
        prototype, ...(variant === undefined ? {} : { variant }), defaultLit,
        file: variant ? `${prototype}-${variant}.lua` : `${prototype}.lua`,
        align: ['law', 'neutral', 'chaos'],
    };
    state._activeSpecialLevel = active;
    return active;
}
//# sourceMappingURL=special-level.js.map