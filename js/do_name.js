// do_name.js — The #call/#name command.
// C ref: do_name.c:docallcmd(), name_ok(), call_ok().  The individual
// owners are naming_categories.ts (the category menu), individual_naming.ts
// (do_oname), object_call.ts (docall) and monster_naming_command.ts.
import { game } from './gstate.js';
import { clearCannedCommands } from './command_state.js';
import { takeCommandKey } from './input.js';
import { takeRepeatCommand } from './command_repeat.js';
import { chooseNamingCategory } from './naming_categories.js';
import { nameChosenMonster } from './monster_naming_command.js';
import { nameFloorObject } from './floor_naming.js';
import { renameDiscoveredType } from './o_init.js';
import { queryLevelAnnotation } from './dungeon.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { GETOBJ_EXCLUDE, GETOBJ_DOWNPLAY, GETOBJ_SUGGEST } from './const.js';
import { SPE_NOVEL } from './object_data.js';
import { nameIndividualObject } from './individual_naming.js';
import { flush_screen } from './display.js';
import { callObjectType, objectTypeIsCallable } from './object_call.js';
import { objectTypeKnown } from './shk.js';
import { observeObjectForNaming } from './objnam.js';
import { pline } from './pline.js';
// C do_name.c:docallcmd().
// C do_name.c:name_ok().
// C do_name.c:call_ok().
export async function doname() {
    // do_name.c:docallcmd() uses a queued key as the naming category.
    // Any other queued entry selects nothing and clears the canned queue.
    let queuedChoice;
    if (game._inDoAgain) {
        const queued = takeRepeatCommand();
        if (queued && queued.kind === 'key')
            queuedChoice = queued.key;
        else if (queued) {
            queuedChoice = 0;
            clearCannedCommands();
        }
    }
    else {
        queuedChoice = takeCommandKey();
    }
    const choice = queuedChoice === undefined ? await chooseNamingCategory()
        : String.fromCharCode(queuedChoice);
    // C docallcmd() erases the category menu via its own dismissal
    // (erase_menu_or_text() -> docorner for a corner menu, docrt() for a
    // full-width one); no extra full redraw runs afterwards.
    // C refs: do_name.c:docallcmd()/do_oname() and
    // dungeon.c:donamelevel()/query_annotation().  The menu owns only the
    // category choice; level annotations live with mapseen, while an
    // individual object's name must stay on that same object identity.
    if (choice === 'm') {
        await nameChosenMonster();
    }
    else if (choice === 'f') {
        await nameFloorObject();
    }
    else if (choice === 'd') {
        await renameDiscoveredType();
    }
    else if (choice === 'a') {
        // donamelevel() is a getlin() prompt on the message row; it redraws
        // nothing, so no full-screen refresh follows it either.
        await queryLevelAnnotation();
        game._pending_message = '';
    }
    else if (choice === 'i') {
        // C do_name.c:name_ok() marks unseen, artifact and novel objects as
        // GETOBJ_DOWNPLAY.  getobj() omits those letters from the suggested
        // prompt while still accepting a directly typed inventory letter.
        const object = await chooseInventoryObject('name', candidate => candidate.oclass === 12 ? GETOBJ_EXCLUDE
            : candidate.dknown === false || candidate.oartifact || candidate.otyp === SPE_NOVEL
                ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST, { forcePrompt: true });
        if (object) {
            await nameIndividualObject(object);
            await flush_screen(1);
        }
    }
    else if (choice === 'o') {
        const object = await chooseInventoryObject('call', candidate => !objectTypeIsCallable(candidate) ? GETOBJ_EXCLUDE
            : !candidate.dknown || objectTypeKnown(candidate) && !game._objectCallNames?.[candidate.otyp]
                ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST);
        if (object) {
            observeObjectForNaming(object);
            if (!object.dknown) {
                await pline('You would never recognize another one.');
            }
            else {
                await callObjectType(object);
            }
            await flush_screen(1);
        }
    }
    game.context.move = 0;
}
//# sourceMappingURL=do_name.js.map