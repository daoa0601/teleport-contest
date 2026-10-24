// C wizard.c:wizdeadorgone() and resurrect().
import { game } from './gstate.js';
import { artifactById } from './artifacts.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { plineWithContinuation } from './display.js';
import { makemonNear } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import { MAGIC_PORTAL, STRAT_WAITMASK, MM_NOWAIT } from './const.js';
import {
    catchUpMonster, monsterArrive, WIZ_ARRIVE,
} from './monster_migration.js';
import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import { rn2 } from './rng.js';
import { definiteObjectAction } from './objnam.js';
import { heroIsDeaf } from './senses.js';

const WIZARD = 285;

// C wizard.c:amulet(). Called once per global turn while carrying the Amulet.
export async function amuletTurn(state: PlayingGameState): Promise<void> {
    const amulet = state.uamul?.otyp === AMULET_OF_YENDOR ? state.uamul
        : state.uwep?.otyp === AMULET_OF_YENDOR ? state.uwep : null;
    if (amulet && !rn2(15)) {
        const portal = [...state.level.traps].reverse().find(trap => trap.ttyp === MAGIC_PORTAL);
        if (portal) {
            const dx = portal.tx - state.u.ux, dy = portal.ty - state.u.uy;
            const distance = dx * dx + dy * dy;
            const warmth = distance <= 9 ? 'hot!' : distance <= 64 ? 'very warm.'
                : distance <= 144 ? 'warm.' : null;
            if (warmth) {
                await plineWithContinuation(`${definiteObjectAction(amulet, 'feel', state)} ${warmth}`);
            }
        }
    }
    if (!state.context.no_of_wizards) return;
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0 || !monster.iswiz || !monster.msleeping || rn2(40)) continue;
        monster.msleeping = 0;
        if (Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy)) > 1)
            await plineWithContinuation('You get the creepy feeling that somebody noticed your taking the Amulet.');
        return;
    }
}

// Removal counts even when the Wizard leaves alive. The first removal starts
// demigod intervention; later deaths must not restart an existing countdown.
export function wizardDeadOrGone(state: GameState = game, random = rn2): void {
    state.context.no_of_wizards = (state.context.no_of_wizards ?? 0) - 1;
    const events = state.u.uevent ??= {};
    if (!events.udemigod) {
        events.udemigod = true;
        state.u.udg_cnt = 50 + random(250);
    }
}

export function monsterCarriesAmulet(monster: Monster): boolean {
    // C wizard.c:mon_has_amulet() searches only the top-level inventory.
    return (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_YENDOR);
}

// C wizard.c:mon_has_special() excludes objects inside carried containers.
export function monsterCarriesSpecialObject(monster: Monster, state: GameState = game): boolean {
    return (monster.minvent ?? []).some(object =>
        object.otyp === AMULET_OF_YENDOR
        || artifactById(object.oartifact, state)?.questArtifact
        || object.otyp === BELL_OF_OPENING
        || object.otyp === CANDELABRUM_OF_INVOCATION
        || object.otyp === SPE_BOOK_OF_THE_DEAD);
}

function monsterHelpless(monster: Monster): boolean {
    // C mon.c:helpless().
    return !monster.mcanmove || !!monster.msleeping;
}

function recallMigratingWizard(): Promise<Monster | null> | null {
    // C wizard.c:resurrect() migrating_mons scan.  Returns a placed wizard
    // or null; placement failure re-queues the monster for later attempts.
    // Migration arrays append where C prepends to migrating_mons.
    for (const candidate of [...(game._migratingMonsters ?? [])].reverse()) {
        if (!candidate.iswiz) continue;
        // if he has the Amulet, he won't bring it to you
        if (monsterCarriesAmulet(candidate)) continue;
        let elapsed = (game.moves ?? 0) - (candidate.mlstmv ?? game.moves ?? 0);
        if (!(elapsed > 0)) continue;
        catchUpMonster(candidate, elapsed, game);
        if (elapsed >= 0x7fffffff) elapsed = 0x7fffffff - 1;
        elapsed = Math.trunc(elapsed / 50);
        if (candidate.msleeping && rn2(elapsed + 1)) candidate.msleeping = 0;
        if (candidate.mfrozen === 1) {
            // would unfreeze on next move
            candidate.mfrozen = 0;
            candidate.mcanmove = 1;
        }
        if (monsterHelpless(candidate)) continue;
        // mon_arrive() might have sent him into limbo again; only a placed
        // wizard counts as resurrected.
        return monsterArrive(candidate, WIZ_ARRIVE, game)
            .then(placed => placed ? candidate : null);
    }
    return null;
}

export async function resurrectWizard(): Promise<Monster | null> {
    let wizard: Monster | null = null;
    let verb = 'kill';
    if (!game.context?.no_of_wizards) {
        wizard = await makemonNear(WIZARD, game.u.ux, game.u.uy, MM_NOWAIT);
        if (wizard) {
            // he's not coming back from a corpse but is subject to repeated
            // killing like a revived corpse
            wizard.mrevived = 1;
        }
    } else {
        verb = 'elude';
        wizard = await recallMigratingWizard();
    }

    if (wizard) {
        wizard.mstrategy = (wizard.mstrategy || 0) & ~STRAT_WAITMASK;
        // paranoia
        wizard.mtame = 0;
        wizard.mpeaceful = 0;
        setMonsterMalign(wizard);
        if (!heroIsDeaf(game)) {
            await plineWithContinuation('A voice booms out...');
            await plineWithContinuation(`"So thou thought thou couldst ${verb} me, fool."`);
        }
    }
    return wizard;
}
