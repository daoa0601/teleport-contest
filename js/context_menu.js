// C cmd.c:there_cmd_menu(), its entry builders, and act_on_act().
import { ALTAR, BOLT_LIM, CLICK_1, CLICK_2, D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, FOUNTAIN, NHW_MENU, PICK_ONE, SCORR, SINK, THRONE, Upolyd, VIBRATING_SQUARE, } from './const.js';
import { canSpotMonster, clearMessageWindow, glyphAt } from './display.js';
import { floorObjectDescription } from './floor_object_display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { GlyphOffset } from './glyph_numbers.js';
import { isContainer } from './container.js';
import { monsterCanBeSaddled } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { BOULDER, CREDIT_CARD, LOCK_PICK, SADDLE, SKELETON_KEY } from './object_data.js';
import { observeObjectForNaming } from './objnam.js';
import { monsterSaddle } from './steed.js';
import { couldsee } from './vision.js';
import { blockingTerrain } from './monster_ranged_alignment.js';
import { heroTestMove } from './cmd.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from './tty_menu.js';
const FOOD_CLASS = 7;
export async function selectContextMenu(x, y, click) {
    const entries = [];
    const add = (action, text) => entries.push({ action, text });
    const dx = x - game.u.ux, dy = y - game.u.uy;
    const self = dx === 0 && dy === 0;
    const adjacent = Math.max(Math.abs(dx), Math.abs(dy)) <= 1;
    if (self)
        await selfEntries(add, x, y);
    else if (adjacent)
        adjacentEntries(add, x, y, click);
    else if (click === CLICK_1) {
        if (canThrowToward(x, y)
            && dx * dx + dy * dy < 18 * 18)
            add('throw', 'Throw something');
        add('travel', 'Travel here');
    }
    if ((click === CLICK_1 || click === CLICK_2) && (!self || unusualHeroGlyph()))
        add('look-at', 'Look at map symbol');
    if (!entries.length) {
        // getdir's ordinary keyboard direction has no click modifier. With
        // no contextual action, native queues movement or travel directly.
        return adjacent && heroTestMove(x, y) ? { action: 'move', x, y }
            : game.flags.travel !== false ? { action: 'travel', x, y } : null;
    }
    if (entries.length === 1 && entries[0]?.action === 'attack')
        return { action: 'attack', x, y };
    clearMessageWindow();
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    for (const entry of entries)
        tty_add_menu(window, { identifier: entry.action, text: entry.text });
    tty_end_menu(window, 'What do you want to do?');
    const result = await tty_select_menu(window, PICK_ONE);
    await tty_destroy_nhwindow(window);
    const action = result.selections[0]?.identifier;
    return action ? { action, x, y } : null;
}
// C linedup(..., 1): boulders do not obstruct an explicitly chosen throw.
function canThrowToward(x, y) {
    requirePlayingGame(game);
    const dx = game.u.ux - x, dy = game.u.uy - y;
    if (dx && dy && Math.abs(dx) !== Math.abs(dy)
        || Math.max(Math.abs(dx), Math.abs(dy)) >= BOLT_LIM)
        return false;
    if (couldsee(x, y))
        return true;
    do {
        x += Math.sign(dx);
        y += Math.sign(dy);
        if (blockingTerrain(game, x, y))
            return false;
    } while (x !== game.u.ux || y !== game.u.uy);
    return true;
}
async function selfEntries(add, x, y) {
    const level = requireGameLevel();
    const terrain = level.requireAt(x, y).typ;
    if ((terrain === FOUNTAIN || terrain === SINK) && heroCanReachFloor())
        add('quaff', `Drink from the ${terrain === FOUNTAIN ? 'fountain' : 'sink'}`);
    if (terrain === FOUNTAIN && heroCanReachFloor())
        add('dip', 'Dip something into the fountain');
    if (terrain === THRONE)
        add('sit', 'Sit on the throne');
    if (terrain === ALTAR)
        add('offer', 'Sacrifice something on the altar');
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.sx !== x || stair.sy !== y)
            continue;
        add(stair.up ? 'up' : 'down', `Go ${stair.up ? 'up' : 'down'} the ${stair.isladder ? 'ladder' : 'stairs'}`);
        break;
    }
    if (game.u.usteed)
        add('dismount', `Dismount ${monsterName(game.u.usteed, { article: 'the', suppressSaddle: true })}`);
    const pile = level.objects[x]?.[y] ?? [];
    const first = pile[0];
    if (first) {
        add('pickup', `Pick up ${pile.length > 1 ? 'items' : await menuObjectName(first)}`);
        if (isContainer(first)) {
            add('loot', `Loot ${await menuObjectName(first)}`);
            add('tip', `Tip ${await menuObjectName(first)}`);
        }
        if (first.oclass === FOOD_CLASS)
            add('eat', `Eat ${await menuObjectName(first)}`);
    }
    if (game.inventory.length) {
        add('inventory', 'Inventory');
        add('drop', 'Drop items');
    }
    add('wait', 'Rest one turn');
    add('search', 'Search around you');
    add('look', 'Look at what is here');
    if (game.spells.length)
        add('cast', 'Cast a spell');
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap?.tseen && trap.ttyp !== VIBRATING_SQUARE)
        add('untrap-here', 'Attempt to disarm trap');
}
async function menuObjectName(object) {
    observeObjectForNaming(object);
    return floorObjectDescription(object);
}
function adjacentEntries(add, x, y, click) {
    const level = requireGameLevel();
    const location = level.requireAt(x, y);
    if (location.typ === DOOR) {
        if (location.doormask & (D_CLOSED | D_LOCKED)) {
            add('open', 'Open the door');
            const key = game.inventory.some(object => object.otyp === SKELETON_KEY || object.otyp === LOCK_PICK);
            if (key || game.inventory.some(object => object.otyp === CREDIT_CARD))
                add('lock', key ? 'Lock or unlock the door' : 'Unlock the door');
            add('untrap-door', 'Search the door for a trap');
            add('kick', 'Kick the door');
        }
        else if (location.doormask & D_ISOPEN && click === CLICK_2)
            add('close', 'Close the door');
    }
    if (location.typ <= SCORR)
        add('search', 'Search for secret doors');
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap?.tseen) {
        add('showtrap', 'Examine trap');
        if (trap.ttyp !== VIBRATING_SQUARE)
            add('untrap', 'Attempt to disarm trap');
        add('move', 'Move on the trap');
    }
    if (location.remembered_glyph?.glyph === GlyphOffset.object + BOULDER)
        add('move', 'Push the boulder');
    const occupant = monsterAtPosition(level, x, y);
    const monster = occupant && canSpotMonster(occupant) ? occupant : null;
    if (monster && monsterSaddle(monster)) {
        const name = monsterName(monster, { article: 'the', suppressSaddle: true });
        if (!game.u.usteed)
            add('ride', `Ride ${name}`);
        add('remove-saddle', `Remove saddle from ${name}`);
    }
    if (monster && monsterCanBeSaddled(monster) && !monsterSaddle(monster)
        && game.inventory.some(object => object.otyp === SADDLE))
        add('saddle', `Put saddle on ${monsterName(monster, { article: 'the' })}`);
    if (monster && (monster.mpeaceful || monster.mtame)) {
        add('chat', `Talk to ${monsterName(monster, { article: 'the' })}`);
        add('move', `Swap places with ${monsterName(monster, { article: 'the' })}`);
        add('name', `${monster.mgivenname || monster.mextra?.mgivenname ? 'Rename' : 'Name'} ${monsterName(monster, { article: 'the' })}`);
    }
    if (monster && !(monster.mpeaceful || monster.mtame) || glyphAt(x, y)?.glyph === GlyphOffset.invisible)
        add('attack', `Attack ${monster ? monsterName(monster, { article: 'the' }) : 'unseen creature'}`);
}
function unusualHeroGlyph() {
    const hero = game.u;
    if (Upolyd(hero))
        return true;
    const species = game.flags.showrace ? game.urace?.mnum : hero.umonnum;
    if (species === undefined)
        throw new Error('A contextual hero menu requires an initialized species');
    const glyph = (game.flags.female ? GlyphOffset.monFemale : GlyphOffset.monMale) + species;
    return glyphAt(hero.ux, hero.uy)?.glyph !== glyph;
}
//# sourceMappingURL=context_menu.js.map