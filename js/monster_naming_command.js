// C do_name.c:do_mgivenname()/alreadynamed().
import { M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, MGIVENNAME } from './const.js';
import { visibleCommandKey } from './command_keys.js';
import { canSenseMonster, canSpotMonster, glyphAt, monsterVisible, plineWithContinuation as pline, seeMonsterWithInfrared } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { GlyphOffset } from './glyph_numbers.js';
import { describeGetposLocation, selectMapPosition, showGetposTip } from './getpos.js';
import { playerName } from './individual_naming.js';
import { heroBeautyDescription } from './mirror.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SOUND, monsterIsRider } from './monster_data.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { monsterAtPosition } from './monster_location.js';
import { distantMonsterName, monsterPossessive, monsterSubjectPronoun, shopkeeperName } from './monster_name.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { cansee } from './vision.js';
export async function nameChosenMonster() {
    requirePlayingGame(game);
    if (heroIsHallucinating(game)) {
        await pline('You would never recognize it anyway.');
        return;
    }
    const goal = 'the monster you want to name';
    const tip = await showGetposTip();
    if (game.flags.verbose) {
        const helpKey = game.commandBindings.specialKey('getpos.help');
        if (helpKey === undefined)
            throw new Error('Monster naming requires a getpos.help binding');
        await pline(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
    }
    if (tip)
        await pline(`Move cursor to ${goal}:`);
    const selected = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy }, goal, force: false,
        describe: describeGetposLocation,
        prompt: game._pending_message,
    });
    if (!selected)
        return;
    let monster;
    if (selected.x === game.u.ux && selected.y === game.u.uy) {
        const steed = game.u.usteed;
        if (steed && canSpotMonster(steed)) {
            monster = steed;
        }
        else {
            await pline(`This ${heroBeautyDescription()} creature is called ${game.plname} and cannot be renamed.`);
            return;
        }
    }
    else {
        monster = monsterAtPosition(game.level, selected.x, selected.y);
    }
    let swallowed = false;
    if (!monster && game.u.uswallow) {
        const glyph = glyphAt(selected.x, selected.y)?.glyph;
        if (glyph !== undefined && glyph >= GlyphOffset.swallow && glyph < GlyphOffset.explodeDark) {
            monster = game.u.ustuck ?? null;
            swallowed = true;
        }
    }
    // Seeing another part of a worm does not reveal the selected square.
    if (!monster || !swallowed && !canSenseMonster(monster)
        && (!(cansee(selected.x, selected.y) || seeMonsterWithInfrared(monster))
            || !monsterVisible(monster)
            || [M_AP_FURNITURE, M_AP_OBJECT].includes(M_AP_TYPE(monster)))) {
        await pline('I see no monster there.');
        return;
    }
    const oldName = distantMonsterName(monster, { article: 'the' });
    const name = await playerName(`What do you want to call ${oldName}?`);
    if (name === null)
        return;
    const subject = oldName.charAt(0).toUpperCase() + oldName.slice(1);
    if (((MONSTER_GENO[monster.mnum] ?? 0) & 0x1000) && !monster.ispriest) {
        if (!await rejectExistingName(monster, oldName, name))
            await pline(`${subject} doesn't like being called names!`);
    }
    else if (monster.isshk && !heroIsDeaf(game) && !monster.msleeping && monster.mcanmove
        && (MONSTER_SOUND[monster.mnum] ?? 0) > 17) {
        if (!await rejectExistingName(monster, oldName, name))
            await pline(`"I'm ${shopkeeperName(monster)}, not ${name}."`);
    }
    else if (monster.ispriest || monster.isminion || monster.isshk
        || MONSTER_NAME[monster.mnum] === 'ghost' || monster.mextra?.ebones) {
        if (!await rejectExistingName(monster, oldName, name))
            await pline(`${subject} will not accept the name ${name}.`);
    }
    else {
        setMonsterGivenName(monster, name);
    }
}
async function rejectExistingName(monster, oldName, proposed) {
    const subject = oldName.charAt(0).toUpperCase() + oldName.slice(1);
    const rider = monsterIsRider(monster);
    if (!proposed) {
        const personal = MGIVENNAME(monster) || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x80000) || monster.isshk;
        await pline(`${subject} would rather keep ${rider ? 'its' : monsterPossessive(monster)} existing ${personal ? 'name' : 'title'}.`);
        return true;
    }
    const fuzzy = (name) => name.replace(/[ _-]/g, '').toLowerCase();
    const candidates = [oldName, oldName.replace(/^the /i, '')];
    for (const prefix of ['invisible ', ' of ']) {
        const index = oldName.toLowerCase().indexOf(prefix);
        if (index >= 0)
            candidates.push(oldName.slice(index + prefix.length));
    }
    if (candidates.some(candidate => fuzzy(candidate) === fuzzy(proposed))) {
        if (rider)
            await pline(`${subject} is already called that.`);
        else {
            const pronoun = monsterSubjectPronoun(monster);
            await pline(`${pronoun.charAt(0).toUpperCase()}${pronoun.slice(1)} is already called ${oldName}.`);
        }
        return true;
    }
    if (MONSTER_NAME[monster.mnum] === 'Juiblex' && /Juiblex/i.test(oldName)
        && proposed.toLowerCase() === 'jubilex') {
        await pline(`${subject} doesn't like being called ${proposed}.`);
        return true;
    }
    return false;
}
//# sourceMappingURL=monster_naming_command.js.map