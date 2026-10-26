// C pager.c:doidtrap(). Identifying a known trap never spends a turn.
import { BEAR_TRAP, ROCKTRAP, TRAPPED_CHEST, TRAPPED_DOOR, WEB, is_hole, PIT, HOLE } from './const.js';
import { glyphAt, pline } from './display.js';
import { game } from './gstate.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { detectedTrapDisguise } from './pager_features.js';
import { trapName } from './trap_name.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { resetCommandVariables } from './command_state.js';

export async function identifyTrap(): Promise<void> {
    game.context.move = 0;
    const direction = await promptDirection(readDirectionKey, { ctrlCommandHint: true });
    if (!direction) {
        // pager.c:doidtrap() returns ECMD_CANCEL when getdir() is declined;
        // rhack() clears the repeat queue after the command.
        resetCommandVariables(true);
        return;
    }
    const x = game.u.ux + direction.dx, y = game.u.uy + direction.dy;
    const glyph = glyphAt(x, y);
    if (glyph?.kind === 'trap' && [BEAR_TRAP, TRAPPED_CHEST, TRAPPED_DOOR].includes(glyph.trapType)) {
        const disguise = detectedTrapDisguise(glyph.trapType, x, y);
        if (disguise) { await pline(`That is a ${disguise}.`); return; }
    }
    const trap = game.level?.traps.find(t => t.tx === x && t.ty === y && t.tseen);
    if (trap && !(direction.dz && (direction.dz < 0 ? is_hole(trap.ttyp) : trap.ttyp === ROCKTRAP))) {
        const made = !trap.madeby_u ? '' : trap.ttyp === WEB ? ' woven'
            : trap.ttyp === HOLE || trap.ttyp === PIT ? ' dug' : ' set';
        await pline(`That is ${withIndefiniteArticle(trapName(trap.ttyp))}${made}${trap.madeby_u ? ' by you' : ''}.`);
    } else await pline("I can't see a trap there.");
}
