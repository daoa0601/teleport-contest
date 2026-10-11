// C wizard.c:wizdeadorgone() and resurrect().
import { game } from './gstate.js';
import { newsym, plineWithContinuation, canSpotMonster } from './display.js';
import { makemonNear } from './mklev.js';
import { STRAT_WAITMASK, MM_NOWAIT } from './const.js';
import { catchUpMonster, monsterArrive, WIZ_ARRIVE, } from './monster_migration.js';
import { AMULET_OF_YENDOR } from './object_data.js';
import { rn2 } from './rng.js';
const WIZARD = 285;
// Removal counts even when the Wizard leaves alive. The first removal starts
// demigod intervention; later deaths must not restart an existing countdown.
export function wizardDeadOrGone(state = game, random = rn2) {
    state.context.no_of_wizards = (state.context.no_of_wizards ?? 0) - 1;
    const events = state.u.uevent ??= {};
    if (!events.udemigod) {
        events.udemigod = true;
        state.u.udg_cnt = 50 + random(250);
    }
}
function carriesAmulet(monster) {
    // C mon.c:mon_has_amulet(): inventory search including containers.
    const objects = monster.minvent || monster.inventory || [];
    for (const object of objects) {
        if (object.otyp === AMULET_OF_YENDOR)
            return true;
        for (const content of object.contents || [])
            if (content.otyp === AMULET_OF_YENDOR)
                return true;
    }
    return false;
}
function monsterHelpless(monster) {
    // C mon.c:helpless().
    return !monster.mcanmove || !!monster.msleeping
        || (monster.mfrozen ?? 0) > 0;
}
function recallMigratingWizard() {
    // C wizard.c:resurrect() migrating_mons scan.  Returns a placed wizard
    // or null; placement failure re-queues the monster for later attempts.
    for (const candidate of [...(game._migratingMonsters || [])]) {
        if (!candidate.iswiz)
            continue;
        // if he has the Amulet, he won't bring it to you
        if (carriesAmulet(candidate))
            continue;
        let elapsed = (game.moves ?? 0) - (candidate.mlstmv ?? game.moves ?? 0);
        if (!(elapsed > 0))
            continue;
        catchUpMonster(candidate, elapsed, game);
        if (elapsed >= 0x7fffffff)
            elapsed = 0x7fffffff - 1;
        elapsed = Math.trunc(elapsed / 50);
        if (candidate.msleeping && rn2(elapsed + 1))
            candidate.msleeping = 0;
        if (candidate.mfrozen === 1) {
            // would unfreeze on next move
            candidate.mfrozen = 0;
            candidate.mcanmove = 1;
        }
        if (monsterHelpless(candidate))
            continue;
        // mon_arrive() might have sent him into limbo again; only a placed
        // wizard counts as resurrected.
        return monsterArrive(candidate, WIZ_ARRIVE, game)
            .then(placed => placed ? candidate : null);
    }
    return null;
}
export async function resurrectWizard() {
    const existing = game.level?.monsters?.find(monster => !monster.dead && monster.iswiz);
    if (existing)
        return existing;
    let wizard = null;
    let verb = 'kill';
    if (!game.context?.no_of_wizards) {
        wizard = await makemonNear(WIZARD, game.u.ux, game.u.uy, MM_NOWAIT);
        if (wizard) {
            // he's not coming back from a corpse but is subject to repeated
            // killing like a revived corpse
            wizard.mrevived = 1;
        }
    }
    else {
        verb = 'elude';
        wizard = await recallMigratingWizard();
    }
    if (wizard) {
        wizard.mstrategy = (wizard.mstrategy || 0) & ~STRAT_WAITMASK;
        // paranoia
        wizard.mtame = 0;
        wizard.mpeaceful = 0;
        delete wizard.malign;
        if (wizard.mrevived)
            newsym(wizard.mx, wizard.my);
        if (wizard.mrevived && canSpotMonster(wizard)) {
            await plineWithContinuation('The Wizard of Yendor suddenly appears next to you!');
        }
        if (!game.deaf && !game.u?.deaf) {
            await plineWithContinuation(`A voice booms out...  "So thou thought thou couldst ${verb} me, fool."`);
        }
    }
    return wizard;
}
//# sourceMappingURL=wizard.js.map