// C wizcmds.c:wiz_smell(). The command can sniff visible or unseen actors
// repeatedly, and updates remembered invisible markers without taking time.
import { heroArmName } from './body_parts.js';
import { visibleCommandKey } from './command_keys.js';
import { glyphAt, map_invisible, plineWithContinuation, unmap_invisible } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { selectMapPosition, showGetposTip } from './getpos.js';
import { monsterAtPosition } from './monster_location.js';
import { smellUnseenMonster } from './monster_smell.js';
import { heroSpecies } from './hero_species.js';
import { heroHasOlfaction } from './polyself.js';
export async function wizSmell(describe) {
    requirePlayingGame(game);
    game.context.move = 0;
    if (!heroHasOlfaction(game)) {
        await plineWithContinuation('You are incapable of detecting odors in your present form.');
        return;
    }
    await plineWithContinuation('You can move the cursor to a monster that you want to smell.');
    let cursor = { x: game.u.ux, y: game.u.uy };
    for (;;) {
        await plineWithContinuation('Pick a monster to smell.');
        const tipShown = await showGetposTip();
        if (game.flags.verbose) {
            const helpKey = game.commandBindings.specialKey('getpos.help');
            if (helpKey === undefined)
                throw new Error('Smell targeting requires a getpos.help binding');
            await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
        }
        const target = await selectMapPosition({
            start: cursor, goal: 'a monster', describe,
            prompt: tipShown ? 'Move cursor to a monster:'
                : game._pending_message,
        });
        if (!target)
            return;
        cursor = target;
        const atHero = cursor.x === game.u.ux && cursor.y === game.u.uy;
        const monster = atHero ? game.u.usteed : monsterAtPosition(game.level, cursor.x, cursor.y);
        const self = atHero && !monster;
        const species = self ? heroSpecies(game) : monster?.mnum;
        const glyph = glyphAt(cursor.x, cursor.y);
        if (species === undefined) {
            await plineWithContinuation("You don't smell any monster there.");
            if (glyph?.kind === 'invisible')
                unmap_invisible(cursor.x, cursor.y);
            continue;
        }
        if (self)
            await plineWithContinuation(`You surreptitiously sniff under your ${heroArmName(game)}.`);
        if (!await smellUnseenMonster(species, game))
            await plineWithContinuation(`${self ? 'You seem' : 'That monster seems'} to not give off any smell.`);
        if (glyph?.kind !== 'monster')
            map_invisible(cursor.x, cursor.y);
    }
}
//# sourceMappingURL=wizard_smell.js.map