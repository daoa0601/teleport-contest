// C do_name.c:namefloorobj().
import { Upolyd } from './const.js';
import { glyphAt, plineWithContinuation as pline, randomBogusMonsterName } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { selectMapPosition, showGetposTip } from './getpos.js';
import { withMapObject } from './map_object_description.js';
import { roguePlayerName } from './monster_given_name.js';
import { callObjectType, objectTypeIsCallable } from './object_call.js';
import { definiteName, simpleObjectName } from './objnam.js';
import { heroFormHidesUnderObjects } from './polyself.js';
import { rankOf } from './quest_pager.js';
import { rn2Display } from './rng.js';
import { heroIsHallucinating } from './senses.js';
export async function nameFloorObject() {
    requirePlayingGame(game);
    const goal = `object on map (or '.' for one ${game.u.uundetected && heroFormHidesUnderObjects(game) ? 'over' : 'under'} you)`;
    const tip = await showGetposTip();
    const selected = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy }, goal, force: false,
        prompt: tip ? `Move cursor to ${goal}:`
            : game.flags.verbose ? "(For instructions type a '?')" : '',
    });
    if (!selected)
        return;
    const here = selected.x === game.u.ux && selected.y === game.u.uy;
    if (here) {
        const object = game.level.objects[selected.x]?.[selected.y]?.[0];
        if (object)
            await nameFloorType(object);
        else
            await pline("There doesn't seem to be any object under you.");
    }
    else {
        const result = await withMapObject(selected.x, selected.y, glyphAt(selected.x, selected.y), async (object) => {
            await nameFloorType(object);
            return true;
        });
        if (!result)
            await pline("There doesn't seem to be any object there.");
    }
}
async function nameFloorType(object) {
    const name = object.otyp === 0 ? 'strange object' : simpleObjectName(object);
    const plural = object.quan > 1;
    if (heroIsHallucinating(game)) {
        const female = Upolyd(game.u) ? game.u.mfemale : game.flags.female;
        const role = female && game.urole?.name.f || game.urole?.name.m || 'Player';
        const rank = rankOf(rn2Display(30) + 1, game);
        const bogus = randomBogusMonsterName();
        const choices = [role, rank, bogus, bogus, roguePlayerName(), 'Wibbly Wobbly'];
        const chosen = choices[rn2Display(choices.length)];
        if (chosen === undefined)
            throw new Error('Hallucinated floor naming selected a missing name');
        const subject = definiteName(name);
        await pline(`${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${plural ? 'decide' : 'decides'} to call you "${chosen}."`);
    }
    else if (!objectTypeIsCallable(object)) {
        await pline(`${plural ? 'Those' : 'That'} ${name} can't be assigned a type name.`);
    }
    else if (!object.dknown) {
        await pline(`You don't know ${plural ? 'those' : 'that'} ${name} well enough to name ${plural ? 'them' : 'it'}.`);
    }
    else {
        await callObjectType(object);
    }
}
//# sourceMappingURL=floor_naming.js.map