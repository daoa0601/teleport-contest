// botl.c — bottom-line status evaluation and windowport notification.
// The tty side that paints these lines (writeStatusLines) lives in wintty.ts.
import { game } from './gstate.js';
import { currentAttribute } from './attrib.js';
import { currentHungerState } from './hunger.js';
import { statusTitle } from './status_title.js';
import { statusConditions } from './status_conditions.js';
import { renderStatusLine2 } from './status_layout.js';
import { armorStatus, weaponStatus } from './status_equipment.js';
import { statusVersion } from './status_version.js';
import { statusTerrain } from './status_terrain.js';
import { hitpointBar, hitpointBarFill } from './status_hitpoint_bar.js';
import { firstStatusLineSpans } from './status_highlighting.js';
import { criticallyLowHp } from './prayer_trouble.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, COLNO, BL_WEAPON, BL_ARMOR, BL_TERRAIN, In_endgame, In_quest, Is_knox_level, Upolyd, } from './const.js';
import { MONSTER_LEVEL, SPECIAL_PM } from './monster_data.js';
import { GOLD_PIECE } from './object_data.js';
import { roles } from './roles.js';
import { depth as dungeonDepth, endgameLevelName } from './hacklib.js';
import { heroGoldAmount } from './hero_gold.js';
import { nearCapacity } from './weight.js';
import { activeObjectSymbols, objectClassForType, objectClassSymbol } from './display.js';
import { writeStatusLines } from './wintty.js';
// C ref: botl.c:get_strength_str(): strength values above 18 encode the exceptional
// 18/xx range; 118 is the traditional 18/** maximum.
export function formatStrength(value) {
    if (value == null)
        return '?';
    if (value <= 18)
        return String(value);
    if (value >= 119)
        return String(value - 100);
    if (value === 118)
        return '18/**';
    return `18/${String(value - 18).padStart(2, '0')}`;
}
// botl.c:check_gold_symbol(). This process flag changes at explicit
// option and level-change boundaries; dorecover() leaves it alone.
export function checkGoldSymbol() {
    game.iflags.invis_goldsym = objectClassSymbol(objectClassForType(GOLD_PIECE)) <= ' ';
}
// C botl.c:do_statusline1().
export function _statusLine1() {
    const u = game.u;
    if (!u)
        return '';
    const title = statusTitle(game);
    const stats = `St:${formatStrength(currentAttribute(A_STR))} `
        + `Dx:${currentAttribute(A_DEX)} Co:${currentAttribute(A_CON)} `
        + `In:${currentAttribute(A_INT)} Wi:${currentAttribute(A_WIS)} `
        + `Ch:${currentAttribute(A_CHA)}`;
    const align = u.ualign?.type === -1 ? 'Chaotic' : u.ualign?.type === 0 ? 'Neutral' : 'Lawful';
    if (game.flags.hitpointbar) {
        // wintty.c:4612 refreshes hpbar_crit_hp only when the HP field is
        // updated, so the dashes follow the sticky state; without a display
        // there is no sticky state yet.
        const highlights = game.nhDisplay?.statusHighlights;
        const critical = highlights
            ? highlights.barCritical
            : !!game.level && !!game.urole && !!game.urace && criticallyLowHp(true, game);
        return `${hitpointBar(title, critical)} ${stats} ${align}`;
    }
    // C uses cursor-forward for gap between title and stats
    // C pads to align stats starting at a fixed column
    const gap = Math.max(1, 31 - title.length);
    if (gap > 4)
        return `${title}\x1b[${gap}C${stats} ${align}`;
    return `${title}${' '.repeat(gap)}${stats} ${align}`;
}
// C botl.c:do_statusline2().
export function _statusLine2() {
    const fields = statusLine2Fields(nearCapacity(game));
    return fields ? renderStatusLine2(fields, game.nhDisplay?.cols ?? COLNO).text : '';
}
// C botl.c:do_statusline2() gathers the second line's fields; the
// location label follows botl.c:describe_level().
function statusLine2Fields(capacity) {
    const u = game.u;
    if (!u)
        return null;
    const dungeonName = game.dungeons?.[u.uz?.dnum ?? 0]?.dname;
    const endgameLocation = endgameLevelName(u.uz)
        .replace(/^Plane of /, '');
    const location = Is_knox_level(u.uz) ? dungeonName ?? ''
        : In_quest(u.uz) ? `Home ${u.uz?.dlevel ?? 1}`
            : In_endgame(u.uz) ? endgameLocation
                : `${game._tutorialActive ? 'Tutorial' : 'Dlvl'}:${dungeonDepth(u.uz)}`;
    const polymorphed = Upolyd(u);
    // botl.c bounds the printed numbers without changing combat state.
    const currentHp = (polymorphed ? u.mh : u.uhp) ?? 0;
    const displayedHp = Math.max(0, Math.min(currentHp, 9999));
    const maximumHp = Math.min((polymorphed ? u.mhmax : u.uhpmax) ?? 0, 9999);
    const displayedPower = Math.min(u.uen ?? 0, 9999);
    const maximumPower = Math.min(u.uenmax ?? 0, 9999);
    const goldSymbol = activeObjectSymbols()[objectClassForType(GOLD_PIECE)] ?? '$';
    const goldLabel = game.iflags.invis_goldsym ? '$' : goldSymbol;
    const displayedAc = u.uac ?? 10;
    const displayedGold = Math.max(0, Math.min(999999, game._statusGoldOverride ?? heroGoldAmount(game)));
    const experience = polymorphed ? `HD:${MONSTER_LEVEL[u.umonnum ?? -1] ?? 0}`
        : `Xp:${u.ulevel || 1}${game.flags.showexp ? `/${u.uexp || 0}` : ''}`;
    const hungerLabel = ['Satiated', '', 'Hungry', 'Weak', 'Fainting', 'Fainted', 'Starved'][u.uhs ?? currentHungerState(game)];
    return {
        location, gold: `${goldLabel}:${displayedGold}`,
        health: { hitpoints: displayedHp, maximumHitpoints: maximumHp,
            power: displayedPower, maximumPower, armorClass: displayedAc },
        experience, moves: game.flags.time ? game.moves : null,
        hunger: hungerLabel ?? '',
        capacity,
        conditions: statusConditions(game),
        equipment: [
            { field: BL_WEAPON, text: game.flags.weaponstatus ? weaponStatus(game) : '' },
            { field: BL_ARMOR, text: game.flags.armorstatus ? armorStatus(game) : '' },
            { field: BL_TERRAIN, text: game.flags.terrainstatus ? statusTerrain(game) : '' },
        ].filter(entry => entry.text.length > 0),
        version: game.flags.showvers ? statusVersion(game.flags.versinfo) : '',
    };
}
// ── bot ──
export async function bot() {
    refreshStatusLines();
}
// C botl.c:bot()/bot_via_windowport(): evaluate every status field and
// push changed ones through the windowport (wintty.ts paints them).
export function refreshStatusLines() {
    const display = game.nhDisplay;
    if (!display || game._statusUpdatesDisabled || game.program_state.saving
        || game.program_state.windows_exited || game._suppressMapStatusForFlush)
        return;
    // Native bot() needs youmonst.data, installed with the hero's species.
    if (game.u.uhp === -1 || game.u.umonnum === undefined) {
        game.context.botl = false;
        game.context.time_botl = false;
        return;
    }
    const capacity = nearCapacity(game);
    // botl.c notifies BL_CAP when its value changes; tty_status_update()
    // then clears any blank left by earlier encumbrance shortening.
    const capacityBlank = display.statusLine2Fields?.capacity === capacity
        && display.statusCapacityBlank;
    const fields = statusLine2Fields(capacity);
    const levelPrefixChanged = display.statusLine2Fields?.location === fields?.location
        && display.statusLevelPrefixChanged;
    display.statusLine2Fields = fields;
    const layout = display.statusLine2Fields
        ? renderStatusLine2(display.statusLine2Fields, display.cols, capacityBlank, levelPrefixChanged) : null;
    display.statusCapacityBlank = layout?.capacityBlank ?? false;
    display.statusLevelPrefixChanged = layout?.levelPrefixChanged ?? false;
    // The tty stores the hitpoint bar style while processing status updates
    // (wintty.c tty_status_update), so the title line is built afterwards.
    if (fields)
        display.statusHighlights.update(game, fields, objectClassSymbol(objectClassForType(GOLD_PIECE)));
    const firstLine = _statusLine1();
    const barFill = game.flags.hitpointbar
        ? hitpointBarFill(Upolyd(game.u) ? game.u.mh ?? 0 : game.u.uhp ?? 0, Upolyd(game.u) ? game.u.mhmax ?? 0 : game.u.uhpmax ?? 0)
        : 0;
    display.statusHighlights.spans = [firstStatusLineSpans(firstLine, !!game.flags.hitpointbar, barFill),
        layout?.spans ?? []];
    display.statusLines = [firstLine, layout?.text ?? ''];
    display.statusVisible = true;
    writeStatusLines(display, display.statusLines);
    game.context.botl = false;
    game.context.time_botl = false;
}
// C botl.c:status_initialize(REASSESS_ONLY) resends every enabled field,
// replacing tty's shortened level label and empty capacity separator.
export function reassessStatusFields(state = game) {
    const display = state.nhDisplay;
    if (display) {
        display.statusLine2Fields = null;
        display.statusCapacityBlank = false;
        display.statusLevelPrefixChanged = false;
        display.statusHighlights.reset();
    }
    state.context.botl = true;
}
// C display.c:flush_screen() and allmain.c once-per-input dispatch:
// `if (disp.botl || disp.botlx) bot(); else if (disp.time_botl) timebot();`.
// The status window updates while map changes stay in the glyph buffer
// until the next flush_screen().
export function updateStatusLines() {
    if (game.context.botl || game.nhDisplay?.statusLines === null)
        refreshStatusLines();
    else if (game.context.time_botl)
        timebot();
}
// C botl.c:status_eval_next_unhilite(): called once per time-taking hero
// action, before the next bot(). Zero-time menus and message flushes must
// not extend temporary highlights.
export function statusEvalNextUnhilite() {
    if (game.iflags.hiliteDelta && game.nhDisplay?.statusHighlights.evaluateNextUnhilite(game))
        game.context.botl = true;
}
// C botl.c:timebot()/stat_update_time() notifies only BL_TIME. Other
// fields keep the values from the last bot(), even if game state changed
// during an occupation.
export function timebot() {
    if (game._statusUpdatesDisabled)
        return;
    game.context.time_botl = false;
    const display = game.nhDisplay;
    if (!display?.statusLines || !display.statusLine2Fields || !game.flags.time
        || game.program_state.saving || game.program_state.windows_exited
        || game._suppressMapStatusForFlush)
        return;
    const [first] = display.statusLines;
    display.statusLine2Fields = { ...display.statusLine2Fields, moves: game.moves };
    const layout = renderStatusLine2(display.statusLine2Fields, display.cols, display.statusCapacityBlank, display.statusLevelPrefixChanged);
    display.statusCapacityBlank = layout.capacityBlank;
    display.statusLevelPrefixChanged = layout.levelPrefixChanged;
    display.statusHighlights.updateTime(game);
    display.statusHighlights.spans = [display.statusHighlights.spans[0], layout.spans];
    display.statusLines = [first, layout.text];
    display.statusVisible = true;
    writeStatusLines(display, display.statusLines);
}
// C botl.c:rank_of(). A player monster's title from its level; mon_nam()
// lowercase it for "the roguish Brigitte".
export function monsterRank(monster, state = game) {
    const role = roles.find(candidate => SPECIAL_PM + 1 + candidate.mnum === monster.mnum) || state.urole;
    if (!role)
        throw new Error('Naming a player monster requires an initialized hero role.');
    const level = monster.m_lev;
    const rank = level <= 2 ? 0 : level <= 30 ? Math.trunc((level + 2) / 4) : 8;
    for (let index = rank; index >= 0; index--) {
        const title = role.title[index];
        if (monster.female && title?.f)
            return title.f;
        if (title?.m)
            return title.m;
    }
    return monster.female && role.name.f || role.name.m || 'Player';
}
//# sourceMappingURL=botl.js.map