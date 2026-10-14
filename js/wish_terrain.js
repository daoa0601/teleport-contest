// C objnam.c:wizterrainwish(). Terrain wishes use the ordinary map, trap,
// light, and liquid-effect owners, then refresh the hero's changed square.
import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE, Align2amask, ALTAR, BEAR_TRAP, CLOUD, COLNO, CORR, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DB_UNDER, DBWALL, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, DOOR, DRAWBRIDGE_UP, F_LOOTED, FOUNTAIN, GRAVE, HWALL, ICE, ICED_MOAT, ICED_POOL, IRONBARS, IS_DRAWBRIDGE, IS_FURNITURE, IS_WALL, is_hole, Is_rogue_level, LADDER, LANDMINE, LAVAPOOL, LAVAWALL, MAGIC_PORTAL, MOAT, POOL, ROCKTRAP, ROOM, ROWNO, SCORR, SDOOR, SINK, S_LDWASHER, S_LPUDDING, S_LRING, STAIRS, THRONE, T_LOOTED, TRAPNUM, TREE, TREE_LOOTED, TREE_SWARM, TT_LAVA, VWALL, WATER, WM_MASK, W_NONDIGGABLE, W_NONPASSWALL, } from './const.js';
import { applyHeroLiquidEffects } from './cmd.js';
import { docrt, feel_newsym, plineWithContinuation } from './display.js';
import { iceDescriptionAt } from './dungeon_feature.js';
import { deleteEngravingAt } from './engrave.js';
import { fireDamageChain } from './fire_damage.js';
import { game, requireGameLevel } from './gstate.js';
import { canFallThrough, countLevelFeatures, fix_wall_spines, make_grave, maketrap } from './mklev.js';
import { BEARTRAP, LAND_MINE } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { LEVEL_TIMER_KIND, stopLevelTimer } from './object_timers.js';
import { propertyIsActive } from './properties.js';
import { rn2 } from './rng.js';
import { waterbodyName } from './terrain_name.js';
import { resetHeroTrap, switchHeroTerrain } from './terrain_movement.js';
import { isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { waterDamageObject } from './trap.js';
import { deleteTrap } from './trap_lifecycle.js';
import { trapName } from './trap_name.js';
import { vision_note_blocker_change } from './vision.js';
import { startMeltIceTimer } from './zap.js';
// Bear traps and mines are objects unless explicitly armed or followed by
// a suffix other than " object". "Untrapped" always asks for the object.
export function wizardTrapRequest(parsed) {
    const match = /^(bear ?trap|land ?mine)(.*)$/i.exec(parsed.name);
    if (!match)
        return null;
    const bear = match[1]?.startsWith('bear');
    const suffix = match[2] ?? '';
    if (parsed.trapped === 'untrapped' || suffix === ' object') {
        parsed.directType = bear ? BEARTRAP : LAND_MINE;
        return null;
    }
    return parsed.trapped === 'trapped' || suffix ? bear ? BEAR_TRAP : LANDMINE : null;
}
export async function wishForWizardTrap(type) {
    const { ux: x, uy: y } = game.u;
    if (is_hole(type) && !canFallThrough())
        type = ROCKTRAP;
    const trap = await maketrap(x, y, type);
    const name = trapName(trap?.ttyp ?? type, { ignoreHallucination: true });
    await say(trap ? `${withIndefiniteArticle(name)}${trap.ttyp === MAGIC_PORTAL ? ' to nowhere' : ''}.`
        : `Creation of ${withIndefiniteArticle(name)} failed.`);
}
export async function tryWizardTerrainWish(parsed) {
    const name = parsed.name;
    for (let type = 1; type < TRAPNUM; type++) {
        if (name.startsWith(trapName(type, { ignoreHallucination: true }))) {
            await wishForWizardTrap(type);
            return true;
        }
    }
    const level = requireGameLevel();
    const { ux: x, uy: y } = game.u;
    const location = level.requireAt(x, y);
    const previousType = location.typ;
    const bridge = IS_DRAWBRIDGE(previousType);
    let changed = true;
    if (name.endsWith('fountain')) {
        location.typ = FOUNTAIN;
        if (previousType !== FOUNTAIN)
            level.flags.nfountains++;
        setLooted(location, parsed.looted ? F_LOOTED : 0);
        location.blessedftn = parsed.buc === 'blessed' || name.startsWith('magic ');
        location.horizontal = !!location.blessedftn;
        await say(`A ${location.blessedftn ? 'magic ' : ''}fountain.`);
    }
    else if (name.endsWith('throne')) {
        location.typ = THRONE;
        setLooted(location, parsed.looted ? T_LOOTED : 0);
        await say('A throne.');
    }
    else if (name.endsWith('sink')) {
        location.typ = SINK;
        if (previousType !== SINK)
            level.flags.nsinks++;
        setLooted(location, parsed.looted ? S_LPUDDING | S_LDWASHER | S_LRING : 0);
        await say('A sink.');
    }
    else if (name.endsWith('pool') || name.endsWith('moat') || name.endsWith('wall of water')) {
        if (bridge)
            setBridgeSurface(location, DB_MOAT);
        else {
            location.typ = name.endsWith('pool') ? POOL : name.endsWith('moat') ? MOAT : WATER;
            clearMapFlags(location);
        }
        deleteEngravingAt(x, y);
        if (bridge)
            await bridgeMessage('Moat', previousType);
        else {
            const nameState = { ...game, u: { ...game.u, hallucinationResistance: true } };
            await say(`${withIndefiniteArticle(waterbodyName(x, y, nameState))}.`);
        }
        for (const object of [...(level.objects[x]?.[y] ?? [])])
            await waterDamageObject(object, [], game, { force: false, publish: plineWithContinuation });
    }
    else if (name.endsWith('lava')) {
        if (bridge)
            setBridgeSurface(location, DB_LAVA);
        else {
            location.typ = name.endsWith('wall of lava') ? LAVAWALL : LAVAPOOL;
            clearMapFlags(location);
        }
        deleteEngravingAt(x, y);
        if (bridge)
            await bridgeMessage('Lava', previousType);
        else {
            await say(`A ${location.typ === LAVAPOOL ? 'pool' : 'wall'} of molten lava.`);
            if (location.typ === LAVAWALL || !propertyIsActive('levitation') && !propertyIsActive('flying'))
                await applyHeroLiquidEffects();
        }
        await fireDamageChain(level.objects[x]?.[y], { force: true, publish: plineWithContinuation, x, y });
    }
    else if (name.endsWith('ice')) {
        if (bridge)
            setBridgeSurface(location, DB_ICE);
        else {
            location.typ = ICE;
            location.icedpool = location.flags = previousType === ROOM ? ICED_POOL : ICED_MOAT;
        }
        deleteEngravingAt(x, y);
        if (name.startsWith('melting '))
            startMeltIceTimer(x, y);
        if (bridge)
            await bridgeMessage('Ice', previousType);
        else
            await say(`${iceDescriptionAt(x, y)}.`);
    }
    else if (name.endsWith('altar')) {
        const alignment = name.startsWith('chaotic ') ? A_CHAOTIC
            : name.startsWith('neutral ') ? A_NEUTRAL
                : name.startsWith('lawful ') ? A_LAWFUL
                    : name.startsWith('unaligned ') ? A_NONE
                        : !rn2(6) ? A_NONE : rn2(3) - 1;
        location.typ = ALTAR;
        location.altarmask = location.flags = Align2amask(alignment);
        const word = alignment === A_CHAOTIC ? 'chaotic' : alignment === A_NEUTRAL ? 'neutral'
            : alignment === A_LAWFUL ? 'lawful' : 'unaligned';
        await say(`${withIndefiniteArticle(word)} altar.`);
    }
    else if (name.endsWith('grave') || name.endsWith('headstone')) {
        make_grave(x, y, null);
        if (location.typ !== GRAVE) {
            await say("Can't place a grave here.");
            return true;
        }
        setLooted(location, 0);
        location.disturbed = location.horizontal = parsed.looted;
        await say(`A ${parsed.looted ? 'disturbed ' : ''}grave.`);
    }
    else if (name.endsWith('tree')) {
        location.typ = TREE;
        setLooted(location, parsed.looted ? TREE_LOOTED | TREE_SWARM : 0);
        setWallProperties(location, parsed.fruitName);
        await say('A tree.');
    }
    else if (name.endsWith('bars')) {
        location.typ = IRONBARS;
        clearMapFlags(location);
        setWallProperties(location, parsed.fruitName);
        await say('Iron bars.');
    }
    else if (name.endsWith('cloud')) {
        location.typ = CLOUD;
        clearMapFlags(location);
        deleteEngravingAt(x, y);
        await say('A cloud.');
    }
    else if (name.endsWith('door') || parsed.door === 'doorless' && name.endsWith('doorway')) {
        const secret = name.endsWith('secret door');
        if (previousType !== DOOR && previousType !== SDOOR
            && (!IS_WALL(previousType) || previousType === DBWALL) && previousType !== IRONBARS) {
            await say(`${secret ? 'Secret door' : 'Door'} requires door or wall location.`);
            return true;
        }
        makeWishedDoor(location, parsed, secret, previousType);
        await say(`${withIndefiniteArticle(describeWishedDoor(location, secret))}.`);
    }
    else if (/(?:^| )wall$/.test(name)) {
        location.typ = [level.at(x, y - 1), level.at(x, y + 1)]
            .some(neighbor => neighbor && IS_WALL(neighbor.typ)) ? VWALL : HWALL;
        clearMapFlags(location);
        setWallProperties(location, parsed.fruitName);
        fix_wall_spines(Math.max(0, x - 1), Math.max(0, y - 1), Math.min(COLNO - 1, x + 1), Math.min(ROWNO - 1, y + 1));
        await say('A wall.');
    }
    else if (name.endsWith('secret corridor')) {
        if (previousType !== CORR) {
            await say('Secret corridor requires corridor location.');
            return true;
        }
        location.typ = SCORR;
        await say('Secret corridor.');
    }
    else if (name.endsWith('room') || name.endsWith('floor') || name.endsWith('ground')) {
        if (previousType === ROOM || IS_FURNITURE(previousType) && previousType !== STAIRS && previousType !== LADDER
            || previousType === ICE || isPoolAt(x, y) || isLavaAt(x, y)) {
            location.typ = ROOM;
            await say('Room floor.');
            if (IS_FURNITURE(previousType))
                countLevelFeatures();
            const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
            if (trap && trap.ttyp !== MAGIC_PORTAL)
                deleteTrap(trap);
        }
        else if (bridge) {
            setBridgeSurface(location, DB_FLOOR);
            await bridgeMessage('Floor', previousType);
        }
        else {
            await say('Room|floor|ground not allowed here.');
            return true;
        }
    }
    else
        changed = false;
    if (!changed)
        return false;
    feel_newsym(x, y);
    if (game.u.uinwater && !isPoolAt(game.u.ux, game.u.uy)) {
        game.u.uinwater = false;
        game.underwater = game.u.underwater = false;
        await switchHeroTerrain();
        await docrt();
    }
    else {
        if (game.u.utrap && game.u.utraptype === TT_LAVA && !isLavaAt(game.u.ux, game.u.uy))
            await resetHeroTrap(false);
        vision_note_blocker_change(x, y);
    }
    if (previousType === FOUNTAIN || previousType === SINK)
        countLevelFeatures();
    if (!isIceAt(x, y))
        stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY);
    if ((previousType === FOUNTAIN || previousType === GRAVE || IS_WALL(previousType)
        || previousType === IRONBARS || previousType === DOOR || previousType === SDOOR)
        && ![FOUNTAIN, GRAVE, DOOR, SDOOR].includes(location.typ))
        location.horizontal = false;
    await switchHeroTerrain();
    return true;
}
function makeWishedDoor(location, parsed, secret, previousType) {
    const wallInfo = previousType === DOOR ? 0 : location.wall_info;
    location.typ = secret ? SDOOR : DOOR;
    clearMapFlags(location);
    const rogue = Is_rogue_level(game.u.uz);
    location.doormask = !rogue && parsed.lock === 'locked' ? D_LOCKED
        : rogue || parsed.door === 'doorless' || secret ? D_NODOOR
            : parsed.door === 'open' ? D_ISOPEN : parsed.lock === 'broken' ? D_BROKEN : D_CLOSED;
    if (parsed.trapped === 'trapped' && (secret || location.doormask & (D_LOCKED | D_CLOSED)))
        location.doormask |= D_TRAPPED;
    location.wall_info = secret ? wallInfo & WM_MASK : 0;
    location.flags = location.doormask | location.wall_info;
}
function describeWishedDoor(location, secret) {
    const mask = location.doormask;
    const prefix = `${mask & D_TRAPPED ? 'trapped ' : ''}${mask & D_LOCKED ? 'locked ' : ''}`;
    if (secret)
        return `${prefix}secret door`;
    const state = mask & D_CLOSED ? 'closed ' : mask & D_ISOPEN ? 'open ' : mask & D_BROKEN ? 'broken ' : '';
    return `${prefix}${state}${(mask & ~D_TRAPPED) === D_NODOOR ? 'doorless doorway' : 'door'}`;
}
function setLooted(location, flags) {
    location.looted = location.flags = flags;
}
function clearMapFlags(location) {
    location.flags = location.doormask = location.wall_info = 0;
}
function setBridgeSurface(location, surface) {
    location.drawbridgemask = ((location.drawbridgemask ?? location.flags) & ~DB_UNDER) | surface;
    location.flags = location.drawbridgemask;
}
function setWallProperties(location, text) {
    const undiggable = text.includes('undiggable ') || text.includes('nondiggable ');
    const unphaseable = text.includes('unphaseable ') || text.includes('nonpasswall ');
    location.wall_info |= (undiggable ? W_NONDIGGABLE : 0) | (unphaseable ? W_NONPASSWALL : 0);
    location.flags |= location.wall_info;
}
async function bridgeMessage(surface, type) {
    await say(`${surface} ${type === DRAWBRIDGE_UP ? 'in front of' : 'under'} the drawbridge.`);
}
async function say(message) {
    await plineWithContinuation(message.charAt(0).toUpperCase() + message.slice(1));
}
//# sourceMappingURL=wish_terrain.js.map