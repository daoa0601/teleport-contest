// Wizard teleport mode selection and temporary capabilities.
// C refs: teleport.c:dotelecmd()/dotele() and spell.c:tport_spell().
import { currentAttribute, exerciseWisdom } from './attrib.js';
import { A_STR, MENU_ITEMFLAGS_SELECTED, NHW_MENU, PICK_ONE } from './const.js';
import { impossible } from './diagnostics.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { OBJECT_SPELL_LEVEL, SPE_TELEPORT_AWAY } from './object_data.js';
import { castSpell, createMemorizedSpell, knownSpell } from './spell.js';
import { heroHasTeleportation, heroFormCanTeleport } from './teleport.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from './tty_menu.js';
import { exceedsActionCapacity } from './weight.js';
export async function wizardTeleportCommand(teleport) {
    requirePlayingGame(game);
    const mode = game.iflags.menu_requested ? await chooseTeleportMode() : 'w';
    if (!mode) {
        game.context.move = 0;
        return;
    }
    if (mode === 'w') {
        await teleport(true);
        return;
    }
    await withTeleportMode(mode, () => teleport(false));
}
async function chooseTeleportMode() {
    const window = tty_create_nhwindow(NHW_MENU);
    try {
        await tty_start_menu(window);
        tty_add_menu(window, { identifier: 'n', selector: 'n', text: 'normal ^T on demand; no spell, obey restrictions' });
        tty_add_menu(window, { identifier: 's', selector: 's', text: 'via spellcast; no intrinsic teleport' });
        tty_add_menu(window, { identifier: 't', selector: 't', text: 'try ^T without having it; no spell' });
        tty_add_menu(window, {
            identifier: 'w', selector: 'w', text: 'debug mode; ignore restrictions',
            itemflags: MENU_ITEMFLAGS_SELECTED,
        });
        tty_end_menu(window, 'Which way do you want to teleport?');
        const result = await tty_select_menu(window, PICK_ONE);
        if (result.cancelled)
            return null;
        return result.selections.find(selection => selection.identifier !== 'w')?.identifier ?? 'w';
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
}
async function withTeleportMode(mode, action) {
    const hero = game.u;
    const teleporting = hero.teleporting;
    const teleportation = hero.teleportation;
    const turns = hero.teleportingTurns;
    const savedPropertySources = hero._propertySources;
    const sources = hero._propertySources ??= {};
    const savedSources = sources.teleportation;
    // I_SPECIAL confers an intrinsic for 'n'; 's' and 't' suppress both
    // intrinsic and extrinsic sources, including those from polymorph.
    sources.teleportation = {
        intrinsic: mode === 'n' ? { ...savedSources?.intrinsic, potion: true } : {},
        worn: mode === 'n' ? savedSources?.worn ?? [] : [],
        invoked: mode === 'n' ? savedSources?.invoked ?? null : null,
        carried: mode === 'n' ? savedSources?.carried ?? [] : [],
    };
    hero.teleportation = hero.teleporting = mode === 'n';
    if (mode !== 'n')
        hero.teleportingTurns = 0;
    const spells = game.spells;
    const index = spells.findIndex(spell => spell.otyp === SPE_TELEPORT_AWAY);
    // Native NO_SPELL hides the rest of the spell list too. Retain those
    // entries so their identities and letters survive restoration.
    const hidden = index >= 0 && mode !== 's' ? spells.splice(index) : [];
    let added = false;
    try {
        if (index < 0 && spells.length >= 52) {
            await impossible('tport_spell: spellbook full');
        }
        else if (index < 0 && mode === 's') {
            spells.push(createMemorizedSpell(SPE_TELEPORT_AWAY, 20000, game));
            added = true;
        }
        await action();
    }
    finally {
        if (added)
            spells.pop();
        spells.push(...hidden);
        if (teleporting === undefined)
            delete hero.teleporting;
        else
            hero.teleporting = teleporting;
        if (teleportation === undefined)
            delete hero.teleportation;
        else
            hero.teleportation = teleportation;
        if (turns === undefined)
            delete hero.teleportingTurns;
        else
            hero.teleportingTurns = turns;
        if (savedSources === undefined)
            delete sources.teleportation;
        else
            sources.teleportation = savedSources;
        if (!savedPropertySources && Object.keys(sources).length === 0)
            delete hero._propertySources;
    }
}
// A spell completes dotele() itself. Direct intrinsic teleport continues in
// the caller after energy is spent; all refusals leave its time result here.
export async function prepareWizardTeleportAtWill() {
    requirePlayingGame(game);
    const hero = game.u;
    const teleportation = heroHasTeleportation(game);
    const requiredLevel = game.urole.key === 'wizard' ? 8 : 12;
    let cast = false;
    if (!teleportation || hero.ulevel < requiredLevel && !heroFormCanTeleport(game)) {
        const known = knownSpell(SPE_TELEPORT_AWAY);
        cast = (known === 'fresh' || known === 'stale')
            && !(hero.confused || (hero.confusionTurns ?? 0) > 0);
        if (!cast) {
            await plineWithContinuation(!teleportation
                ? known === 'unknown' ? "You don't know that spell." : "You can't cast that spell."
                : 'You are not able to teleport at will.');
            game.context.move = 0;
            return false;
        }
    }
    const level = OBJECT_SPELL_LEVEL[SPE_TELEPORT_AWAY];
    if (level === undefined)
        throw new Error('Teleport-away has no spell level');
    const energy = 5 * level;
    const failure = hero.uhunger <= 10 ? 'are too weak from hunger'
        : currentAttribute(A_STR) < 4 ? 'lack the strength'
            : energy > hero.uen ? 'lack the energy' : null;
    if (failure) {
        await plineWithContinuation(`You ${failure} ${cast ? 'for a teleport spell' : 'to teleport'}.`);
        game.context.move = 0;
        return false;
    }
    if (exceedsActionCapacity(game)) {
        await plineWithContinuation('Your concentration falters from carrying so much.');
        game.context.move = 1;
        return false;
    }
    if (cast) {
        exerciseWisdom();
        const result = await castSpell(SPE_TELEPORT_AWAY, { atSelf: true });
        game.context.move = Number(result.spentTime);
        return false;
    }
    hero.uen -= energy;
    game.context.botl = true;
    return true;
}
//# sourceMappingURL=wizard_teleport.js.map