// Source-owned new-game initialization before mklev().
// C refs: allmain.c:newgame(), o_init.c:init_objects(), role.c:role_init(),
// dungeon.c:init_dungeons(), u_init.c:u_init_misc().
import { game } from './gstate.js';
import { init_objects } from './o_init.js';
import { init_dungeons } from './dungeon.js';
import { initializeArtifacts } from './artifacts.js';
import { initializeMonsterVitals } from './monster_population.js';
import { rn2, rnd } from './rng.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { ensureQuestStatus } from './quest.js';
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const M2_NEUTER = 0x00040000;
// C role.c:role_init() recomputes these genders on both newgame and restore.
export function initializeRoleQuestGenders() {
    const role = game.urole;
    if (!role)
        throw new Error('Quest gender initialization requires a selected role');
    rollQuestFigureGenders(role, ensureQuestStatus());
}
// The rolls role_init() makes whenever the quest figure's own species has
// no fixed gender. On restore they run inside restgamestate() before the
// hero is even read, and the saved quest_status then overwrites the values.
export function rollQuestFigureGenders(role, quest) {
    quest.ldrgend = questMonsterGender(role.ldrnum);
    if (role.neminum !== undefined)
        quest.nemgend = questMonsterGender(role.neminum);
}
function questMonsterGender(species) {
    const flags = MONSTER_FLAGS2[species] ?? 0;
    if (flags & M2_NEUTER)
        return 2;
    if (flags & M2_FEMALE)
        return 1;
    if (flags & M2_MALE)
        return 0;
    return rn2(100) < 50 ? 1 : 0;
}
// This is the part of newgame() that runs before level creation. Role
// inventory and starting attributes run from u_init.js after mklev().
export async function initializeSourceStartup() {
    initializeMonsterVitals(game);
    init_objects();
    initializeRoleQuestGenders();
    // role_init(): Priests borrow a pantheon from a random non-Priest role.
    if (game.urole?.key === 'priest') {
        do
            game._priestPantheonIndex = rn2(13);
        while (game._priestPantheonIndex === 6);
    }
    await init_dungeons();
    initializeArtifacts(game);
    // newpw() precedes the human racial point applied by u_init_misc().
    if (game.urole?.key === 'priest' || game.urole?.key === 'wizard')
        game._initialPwBonus = rnd(3);
    else if (game.urole?.key === 'healer' || game.urole?.key === 'knight')
        game._initialPwBonus = rnd(4);
    else if (game.urole?.key === 'monk')
        game._initialPwBonus = rnd(2);
    return rn2(10);
}
//# sourceMappingURL=startup.js.map