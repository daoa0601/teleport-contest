// botl.c — bottom-line status evaluation and windowport notification.
// The tty side that paints these lines (writeStatusLines) lives in wintty.ts.
import { game } from './gstate.js';
import { currentAttribute } from './attrib.js';
import { currentHungerState } from './hunger.js';
import { renderStatusLine2, writeStatusLines, hitpointBar, conditionStyle } from './wintty.js';
import { statusVersion } from './version.js';
import { criticallyLowHp } from './prayer_trouble.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, BL_AC, BL_ALIGN, BL_ARMOR, BL_ATTCLR_MAX, BL_CAP, BL_CH, BL_CHARACTERISTICS, BL_CONDITION, BL_CO, BL_DX, BL_ENE, BL_ENEMAX, BL_EXP, BL_FLUSH, BL_GOLD, BL_HP, BL_HD, BL_HPMAX, BL_HUNGER, BL_IN, BL_LEVELDESC, BL_WI, BL_MASK_BAREH, BL_MASK_BLIND, BL_MASK_BUSY, BL_MASK_CONF, BL_MASK_DEAF, BL_MASK_ELF_IRON, BL_MASK_FLY, BL_MASK_FOODPOIS, BL_MASK_GLOWHANDS, BL_MASK_GRAB, BL_MASK_HALLU, BL_MASK_HELD, BL_MASK_HOLDING, BL_MASK_ICY, BL_MASK_INLAVA, BL_MASK_LEV, BL_MASK_PARLYZ, BL_MASK_RIDE, BL_MASK_SLEEPING, BL_MASK_SLIME, BL_MASK_SLIPPERY, BL_MASK_STONE, BL_MASK_STRNGL, BL_MASK_STUN, BL_MASK_SUBMERGED, BL_MASK_TERMILL, BL_MASK_TETHERED, BL_MASK_TRAPPED, BL_MASK_UNCONSC, BL_MASK_WOUNDEDL, BL_SCORE, BL_STR, BL_TH_ALWAYS_HILITE, BL_TH_CONDITION, BL_TH_CRITICALHP, BL_TH_NONE, BL_TH_TEXTMATCH, BL_TH_UPDOWN, BL_TH_VAL_ABSOLUTE, BL_TH_VAL_PERCENTAGE, BL_TIME, BL_TITLE, BL_VERS, BL_WEAPON, BL_TERRAIN, BL_XP, CLR_MAX, COLNO, EQ_VALUE, GE_VALUE, GT_VALUE, HL_ATTCLR_BLINK, HL_ATTCLR_BOLD, HL_ATTCLR_DIM, HL_ATTCLR_INVERSE, HL_ATTCLR_ITALIC, HL_ATTCLR_ULINE, HL_BLINK, HL_BOLD, HL_DIM, HL_INVERSE, HL_ITALIC, HL_NONE, HL_ULINE, ICE, In_endgame, In_quest, Is_knox_level, LARGEST_INT, LE_VALUE, LT_VALUE, MAXBLSTATS, NO_LTEQGT, P_LANCE, P_MORNING_STAR, P_POLEARMS, P_QUARTERSTAFF, P_SABER, P_SHORT_SWORD, P_UNICORN_HORN, SICK_NONVOMITABLE, SICK_VOMITABLE, TT_BURIEDBALL, TT_LAVA, TXT_VALUE, Upolyd, MAX_TYPE, } from './const.js';
import { MONSTER_FLAGS1, MONSTER_LEVEL, SPECIAL_PM, monsterClassSymbol, monsterTypeName, } from './monster_data.js';
import { AKLYS, AMULET_OF_GUARDING, CLOAK_OF_PROTECTION, CREAM_PIE, GOLD_PIECE, OBJECT_BIMANUAL, OBJECT_SUBTYPE, RIN_PROTECTION, } from './object_data.js';
import { roles } from './roles.js';
import { depth as dungeonDepth, endgameLevelName } from './hacklib.js';
import { heroGoldAmount } from './hero_gold.js';
import { nearCapacity } from './weight.js';
import { activeObjectSymbols, objectClassForType, objectClassSymbol } from './display.js';
import { rankOf } from './quest_pager.js';
import { heroHasInvoluntaryDelay } from './command_state.js';
import { heroIsSick } from './hero_illness.js';
import { heroIsUnconscious } from './hero_sleep.js';
import { heroFormSticks } from './hero_species.js';
import { heroIsStrangled } from './hero_strangulation.js';
import { propertyIsActive } from './properties.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { heroIsSliming } from './slime.js';
import { heroIsPetrifying } from './stoning.js';
import { armorSimpleName } from './armor.js';
import { artifactById } from './artifacts.js';
import { isWeaponTool } from './object_properties.js';
import { weaponDescription } from './weapon.js';
import { newExperienceThreshold } from './exper.js';
import { pline } from './pline.js';
import { getLine } from './query.js';
import { showMultiSelectWindow, showTextWindow } from './windows.js';
import { colorName, fuzzyMatch, matchAttributeName, matchColorName, queryAttributeSet, queryAttributeMenu, queryColorMenu, } from './color_query.js';
import { NO_COLOR, ATR_BOLD, ATR_INVERSE, ATR_UNDERLINE } from './terminal.js';
import { classifyStatusTerrain } from './hack.js';
import { ATR_BLINK, TERMINAL_DIM, TERMINAL_ITALIC } from './terminal_attributes.js';
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
// ── botl.c:bot_via_windowport() BL_TITLE — the full rank before tty cuts it ──
export function statusTitle(state) {
    let name = state.plname || state.displayName || 'Hero';
    name = name.charAt(0).toUpperCase() + name.slice(1);
    const role = Upolyd(state.u)
        ? monsterTypeName(state.u.umonnum ?? -1, state.u.mfemale)
            .replace(/(^| )[a-z]/g, letter => letter.toUpperCase())
        : rankOf(state.u.ulevel ?? 1, state);
    if (name.length + 5 + role.length > 30)
        name = name.slice(0, Math.max(16, 30 - 5 - role.length));
    return `${name} the ${role}`;
}
const definitions = [
    { option: 'barehanded', rank: 20, enabled: false, text: ['Bare', 'Bar', 'Bh'] },
    { option: 'blind', rank: 10, enabled: true, text: ['Blind', 'Blnd', 'Bl'] },
    { option: 'busy', rank: 20, enabled: false, text: ['Busy', 'Bsy', 'By'] },
    { option: 'conf', rank: 10, enabled: true, text: ['Conf', 'Cnf', 'Cf'] },
    { option: 'deaf', rank: 10, enabled: true, text: ['Deaf', 'Def', 'Df'] },
    { option: 'iron', rank: 15, enabled: true, text: ['Iron', 'Irn', 'Fe'] },
    { option: 'fly', rank: 10, enabled: true, text: ['Fly', 'Fly', 'Fl'] },
    { option: 'foodPois', rank: 6, enabled: true, text: ['FoodPois', 'Fpois', 'Poi'] },
    { option: 'glowhands', rank: 20, enabled: false, text: ['Glow', 'Glo', 'Gl'] },
    { option: 'grab', rank: 2, enabled: true, text: ['Grab', 'Grb', 'Gr'] },
    { option: 'hallucinat', rank: 10, enabled: true, text: ['Hallu', 'Hal', 'Hl'] },
    { option: 'held', rank: 20, enabled: false, text: ['Held', 'Hld', 'Hd'] },
    { option: 'ice', rank: 20, enabled: false, text: ['Icy', 'Icy', 'Ic'] },
    { option: 'lava', rank: 8, enabled: true, text: ['InLava', 'Lav', 'La'] },
    { option: 'levitate', rank: 10, enabled: true, text: ['Lev', 'Lev', 'Lv'] },
    { option: 'paralyzed', rank: 20, enabled: false, text: ['Parlyz', 'Para', 'Par'] },
    { option: 'ride', rank: 10, enabled: true, text: ['Ride', 'Rid', 'Rd'] },
    { option: 'sleep', rank: 20, enabled: false, text: ['Zzz', 'Zzz', 'Zz'] },
    { option: 'slime', rank: 6, enabled: true, text: ['Slime', 'Slim', 'Slm'] },
    { option: 'slip', rank: 20, enabled: false, text: ['Slip', 'Slp', 'Sl'] },
    { option: 'stone', rank: 6, enabled: true, text: ['Stone', 'Ston', 'Sto'] },
    { option: 'strngl', rank: 4, enabled: true, text: ['Strngl', 'Stngl', 'Str'] },
    { option: 'stun', rank: 10, enabled: true, text: ['Stun', 'Stun', 'St'] },
    { option: 'submerged', rank: 15, enabled: false, text: ['Submrg', 'Subm', 'Sm'] },
    { option: 'termIll', rank: 6, enabled: true, text: ['TermIll', 'Ill', 'Ill'] },
    { option: 'tethered', rank: 20, enabled: false, text: ['Teth', 'Tth', 'Te'] },
    { option: 'trap', rank: 20, enabled: false, text: ['Trap', 'Trp', 'Tr'] },
    { option: 'unconscious', rank: 20, enabled: false, text: ['Out', 'Out', 'KO'] },
    { option: 'woundedlegs', rank: 20, enabled: false, text: ['WLegs', 'Leg', 'Lg'] },
    { option: 'holding', rank: 20, enabled: false, text: ['UHold', 'UHld', 'UHd'] },
];
const defaultMask = definitions.reduce((mask, condition, index) => condition.enabled ? mask | (1 << index) : mask, 0);
export function statusConditionBit(text) {
    const index = definitions.findIndex(condition => condition.text[0] === text[0]);
    return index >= 0 ? 1 << index : 0;
}
// parse_cond_option() accepts each option's first four letters (or its
// complete name if shorter). Config parsing supplies the negation separately.
export function setConditionOption(option, enabled, mask = defaultMask) {
    const name = option.slice(5).toLowerCase();
    const index = definitions.findIndex(condition => name.length >= Math.min(4, condition.option.length)
        && condition.option.toLowerCase().startsWith(name));
    if (index < 0)
        return null;
    const bit = 1 << index;
    return enabled ? mask | bit : mask & ~bit;
}
// C botl.c:cond_cmp().
export function statusConditions(state) {
    const mask = state.flags.statusConditionMask ?? defaultMask;
    const enabled = (name) => statusConditionEnabled(name, state);
    const selected = definitions.filter((condition, index) => (mask & (1 << index)) !== 0 && conditionApplies(condition.option, state, enabled));
    selected.sort((left, right) => left.rank - right.rank
        || (left.option.toLowerCase() < right.option.toLowerCase() ? -1 : 1));
    return selected.map(condition => condition.text);
}
export function statusConditionEnabled(name, state) {
    const mask = state.flags.statusConditionMask ?? defaultMask;
    return definitions.some((condition, index) => condition.option === name && (mask & (1 << index)) !== 0);
}
export function statusConditionOptions(state) {
    const mask = state.flags.statusConditionMask ?? defaultMask;
    return definitions.map((condition, index) => ({
        name: condition.option, rank: condition.rank, bit: 1 << index,
        enabled: (mask & (1 << index)) !== 0,
    }));
}
function conditionApplies(name, state, enabled) {
    const hero = state.u;
    const helpless = heroHasInvoluntaryDelay(state);
    const drowningHold = !!hero.ustuck && !hero.uswallow && !heroFormSticks(state)
        && monsterClassSymbol(hero.ustuck.mnum) === ';';
    const holding = !!hero.ustuck && !hero.uswallow && heroFormSticks(state);
    const unconscious = enabled('unconscious') && !hero.usleep && heroIsUnconscious(state);
    const reason = typeof state._helplessReason === 'string'
        ? state._helplessReason : state._helplessReason?.text ?? '';
    const paralyzed = enabled('paralyzed')
        && (reason.startsWith('paralyzed') || reason.startsWith('frozen'));
    const sleeping = enabled('sleep') && !!hero.usleep;
    switch (name) {
        case 'barehanded': return !state.uarmg && !state.uwep;
        case 'blind': return heroIsBlind(state);
        case 'busy': return helpless && !unconscious && !paralyzed && !sleeping;
        case 'conf': return propertyIsActive('confusion', state);
        case 'deaf': return heroIsDeaf(state);
        case 'iron': return false; // Native currently disables this test too.
        case 'fly': return propertyIsActive('flying', state);
        case 'foodPois': return heroIsSick(state) && !!((hero.sickType ?? 0) & SICK_VOMITABLE);
        case 'glowhands': return !!hero.umconf;
        case 'grab': return drowningHold;
        case 'hallucinat': return heroIsHallucinating(state);
        case 'held': return !!hero.ustuck && !holding && !(enabled('grab') && drowningHold);
        case 'ice': return state.level?.at(hero.ux, hero.uy)?.typ === ICE;
        case 'lava': return !!hero.utrap && hero.utraptype === TT_LAVA;
        case 'levitate': return propertyIsActive('levitation', state);
        case 'paralyzed': return helpless && !unconscious && paralyzed;
        case 'ride': return !!hero.usteed;
        case 'sleep': return helpless && !unconscious && !paralyzed && sleeping;
        case 'slime': return heroIsSliming(state);
        case 'slip': return (hero.glibTurns ?? 0) > 0;
        case 'stone': return heroIsPetrifying(state);
        case 'strngl': return heroIsStrangled(state);
        case 'stun': return !!hero.stunned || propertyIsActive('stunned', state);
        case 'submerged': return !!hero.uinwater;
        case 'termIll': return heroIsSick(state) && !!((hero.sickType ?? 0) & SICK_NONVOMITABLE);
        case 'tethered': return !!hero.utrap && hero.utraptype === TT_BURIEDBALL;
        case 'trap': return !!hero.utrap
            && !(enabled('lava') && hero.utraptype === TT_LAVA)
            && !(enabled('tethered') && hero.utraptype === TT_BURIEDBALL);
        case 'unconscious': return helpless && unconscious;
        case 'woundedlegs': return (hero._woundedLegTurns ?? 0) > 0 || !!hero._woundedLegSide;
        case 'holding': return holding;
    }
}
// ── botl.c:weapon_status() and armor_status() ──
export function weaponStatus(state) {
    const weapon = state.uwep;
    if (!weapon) {
        if (state.uarmg)
            return 'Empty-hnd';
        return ((MONSTER_FLAGS1[state.u.umonnum ?? -1] ?? 0) & 0x00020000)
            ? 'Bare-hnds' : 'No-weapon';
    }
    const skill = weaponSkill(weapon);
    if (state.u.twoweap)
        return state.u.usteed && (skill === P_LANCE || weaponSkill(state.uswapwep) === P_LANCE)
            ? 'Dual+joust' : 'Dual-weps';
    let text;
    if (state.u.usteed && skill === P_LANCE)
        text = 'joust';
    else if (weapon.otyp === AKLYS)
        text = 'aklys';
    else if (weapon.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER)
        text = 'sword';
    else if (skill === P_QUARTERSTAFF)
        text = 'staff';
    else if (skill === P_MORNING_STAR)
        text = 'mrng-star';
    else if (skill === P_POLEARMS)
        text = 'pole';
    else if (skill === P_UNICORN_HORN)
        text = 'unihorn';
    else {
        text = weaponDescription(weapon);
        if (text.toLowerCase() === 'food' && weapon.otyp === CREAM_PIE)
            text = 'pie';
    }
    const twoHanded = (weapon.oclass === 2 || isWeaponTool(weapon))
        && OBJECT_BIMANUAL[weapon.otyp] && !text.startsWith('2')
        && !text.toLowerCase().startsWith('two');
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return `${twoHanded ? '2H-' : ''}${text.replace(/ /g, '-')}`;
}
function weaponSkill(object) {
    return object && [2, 6, 13].includes(object.oclass)
        ? Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0) : 0;
}
export function armorStatus(state) {
    const armor = [
        [state.uarmg, 'G', 'gloves'], [state.uarmc, 'C', 'cloak'],
        [state.uarm, 'A', 'suit'], [state.uarmu, 'U', 'shirt'],
        [state.uarmh, 'H', state.uarmh ? armorSimpleName(state.uarmh, state) : ''],
        [state.uarmf, 'B', 'boots'], [state.uarms, 'S', 'shield'],
    ];
    const worn = armor.filter(([object]) => !!object);
    let text = worn.length === 0 ? 'naked' : worn.length === 1
        ? worn[0]?.[2] ?? '' : worn.map(([, letter]) => letter).join('');
    const protection = state.uright?.otyp === RIN_PROTECTION || state.uleft?.otyp === RIN_PROTECTION
        || state.uamul?.otyp === AMULET_OF_GUARDING || state.uarmc?.otyp === CLOAK_OF_PROTECTION
        || artifactById(state.uarmh?.oartifact, state)?.name === 'The Mitre of Holiness'
        || artifactById(state.uwep?.oartifact, state)?.name === 'The Tsurugi of Muramasa';
    if (protection)
        text += '+';
    return text.charAt(0).toUpperCase() + text.slice(1);
}
// ── botl.c:terrain_descr[] and the BL_TERRAIN evaluation ──
const descriptions = [
    'Stone', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall',
    'Wall', 'Wall', 'Portcullis', 'Tree', 'Wall', 'Stone', 'Pool', 'Moat', 'Water', '(gap)',
    'Lava', 'LavaWall', 'Bars', 'Doorway', 'Corridor', 'Room', 'Stairs', 'Ladder', 'Fountain', 'Throne',
    'Sink', 'Grave', 'Altar', 'Ice', 'Bridge', 'Air', 'Cloud', '', 'Wall',
    'Floor', 'Ground', 'Open-door', 'Shut-door', 'Swamp', 'Submerged', 'Sea', 'WaterWall',
];
export function statusTerrain(state) {
    if (state.iflags.terrain_typ === undefined || state.iflags.terrain_typ === MAX_TYPE)
        classifyStatusTerrain(state);
    return descriptions[state.iflags.terrain_typ ?? MAX_TYPE] ?? '';
}
// ── botl.c:percentage() feeding wintty.c's bar_pos ──
// botl.c:percentage() feeding wintty.c:5220-5229's bar_pos, the number of
// lit cells in the fixed thirty-character bar.  Dead heroes light nothing;
// a nonzero health fraction keeps one cell even above the display cap.
export function hitpointBarFill(hp, maximum) {
    const health = Math.max(0, hp);
    let percent = maximum ? Math.trunc(100 * health / maximum) : 0;
    if (health && !percent)
        percent = 1;
    if (percent >= 100)
        return 30;
    if (!percent)
        return 0;
    return Math.max(1, Math.min(29, Math.trunc(30 * percent / 100)));
}
// botl.c initblstats evaluates gold as the eleventh field.  A forced
// gu.update_all from the gold encoding check therefore re-evaluates gold
// and every field after it, leaving title, attributes, alignment, score
// and carrying-capacity alone.
const AT_OR_AFTER_GOLD = new Set([BL_GOLD, BL_ENE, BL_ENEMAX, BL_XP, BL_AC, BL_HD,
    BL_TIME, BL_HUNGER, BL_HP, BL_HPMAX, BL_LEVELDESC, BL_EXP, BL_VERS,
    BL_WEAPON, BL_ARMOR, BL_TERRAIN]);
export class StatusHighlights {
    fields = new Map();
    styles = new Map();
    currentPercentages = new Map();
    previousPercentages = new Map();
    conditionMasks = [];
    enabled = false;
    resetPending = true;
    moves = null;
    // botl.c:1498-1499 oldrndencode/oldgoldsym statics.
    oldRndEncode = null;
    oldGoldSym = null;
    // wintty.c tty_status[NOW][BL_TITLE].color/.attr and hpbar_crit_hp: the
    // hitpoint bar style, owned by whichever title or HP update ran last.
    barStyle = { color: NO_COLOR, attr: 0 };
    barCritical = false;
    spans = [[], []];
    // botl.c gu.update_all re-evaluates every field as unchanged. A tty
    // botlx repaint alone keeps the cached rules and temporary highlights.
    reset() {
        this.resetPending = true;
    }
    // botl.c:status_hilite_remove() clears references to the deleted rule
    // and its timer. The tty retains the last color until a field update.
    removeRule(rule) {
        const field = this.fields.get(rule.fld);
        if (field?.rule !== rule)
            return;
        field.rule = null;
        field.expires = 0;
    }
    evaluateNextUnhilite(state) {
        this.moves = state.moves;
        let update = !!state.context.botl;
        for (const field of this.fields.values()) {
            if (field.changed) {
                field.expires = field.rule?.behavior === BL_TH_UPDOWN
                    ? state.moves + (state.iflags.hiliteDelta ?? 0) : 0;
                field.changed = false;
                update = true;
            }
            else if (!state.multi && field.expires > 0 && field.expires < state.moves)
                update = true;
        }
        return update;
    }
    update(state, fields, goldSymbol = '$') {
        // bot_via_windowport() alternates buffers even when values are unchanged.
        // Each buffer keeps its percentage until that field recalculates it.
        const previous = this.currentPercentages;
        this.currentPercentages = this.previousPercentages;
        this.previousPercentages = previous;
        this.moves ??= state.moves;
        this.enabled = !!state.iflags.hiliteDelta;
        this.conditionMasks = [...(state.iflags.condHilites ?? [])];
        // botl.c:1564-1570: a changed gold encoding (the new-game rndencode
        // or a new symbol set) forces gu.update_all while gold is evaluated.
        // The first update never needs it; status_initialize already set
        // update_all for that round.
        const encodingChanged = this.oldGoldSym !== null
            && (this.oldGoldSym !== goldSymbol || this.oldRndEncode !== (state.rndencode ?? 0));
        this.oldGoldSym = goldSymbol;
        this.oldRndEncode = state.rndencode ?? 0;
        for (const [field, value] of fieldValues(state, fields))
            this.updateField(state, field, value, encodingChanged);
        this.resetPending = false;
    }
    updateTime(state) {
        this.enabled = !!state.iflags.hiliteDelta;
        this.updateField(state, BL_TIME, numberValue(state.moves));
    }
    // botl.c exp_percent_changing(): hidden points can change the level's rule.
    experiencePercentChanging(state) {
        if (state.context.botl)
            return false;
        const rules = state.iflags.statusThresholds?.[BL_XP] ?? [];
        if (rules.length === 0)
            return false;
        const percent = experiencePercentage(state);
        if (percent === (this.currentPercentages.get(BL_XP) ?? 0))
            return false;
        const level = state.u.ulevel ?? 1;
        const rule = chooseHilite(rules, numberValue(level, level, percent), 0, false, false);
        return rule !== (this.fields.get(BL_XP)?.rule ?? null);
    }
    style(span) {
        if (!this.enabled)
            return { color: NO_COLOR, attr: 0 };
        if (span.condition !== undefined)
            return conditionStyle(span.condition, this.conditionMasks);
        return this.styles.get(span.field) ?? { color: NO_COLOR, attr: 0 };
    }
    // wintty.c:5233-5241: the lit portion of the hitpoint bar takes the
    // title cell's colour, applied only while status highlighting is on.
    barSpanStyle() {
        return { color: this.enabled ? this.barStyle.color : NO_COLOR, attr: this.barStyle.attr };
    }
    updateField(state, field, current, encodingChanged = false) {
        const previous = this.fields.get(field);
        const rules = state.iflags.statusThresholds?.[field] ?? [];
        // botl.c:1574-1576: gu.update_all, forced from BL_GOLD onward by a
        // gold encoding change, evaluates the field as unchanged (chg = 0)
        // and clears its temporary-highlight timer.
        const reset = this.resetPending || !previous
            || encodingChanged && AT_OR_AFTER_GOLD.has(field);
        let change = reset ? 0 : compare(previous.raw, current.raw);
        const percentMatters = field === BL_HP || field === BL_ENE || field === BL_XP || field === BL_EXP;
        const calculatePercent = (percentMatters && rules.length > 0 && (change !== 0 || reset || field === BL_XP))
            || (field === BL_HP && state.flags.hitpointbar);
        // C keeps the cached percentage but passes zero to get_hilite() when
        // this update does not calculate it, including temporary hilite expiry.
        const percent = calculatePercent ? current.percent : 0;
        const previousPercent = this.previousPercentages.get(field) ?? 0;
        if (calculatePercent)
            this.currentPercentages.set(field, percent);
        const percentChanged = calculatePercent && !reset && percent !== previousPercent;
        if (percentChanged) {
            change = compare(previousPercent, percent);
            if (change === 1 && field === BL_XP && previous)
                change = compare(previous.raw, current.raw);
        }
        const expired = !!previous?.expires && !state.multi && previous.expires < (this.moves ?? state.moves);
        // botl.c:1584 re-sends a field only for gu.update_all, a value or
        // percentage change, or a temporary-hilite expiry. A rule list that
        // changed on its own never re-sends anything: the tty keeps the
        // buffered color of a removed rule until one of those rounds runs
        // (reset_status_hilites() supplies update_all when highlighting is on).
        if (!reset && !change && !percentChanged && !expired)
            return;
        const rule = chooseHilite(rules, { ...current, percent }, change, field === BL_HP && rules.some(entry => entry.behavior === BL_TH_CRITICALHP)
            && criticallyLowHp(false, state), field === BL_TITLE && Upolyd(state.u));
        this.fields.set(field, { raw: current.raw, rule, changed: true,
            expires: reset || expired ? 0 : previous?.expires ?? 0 });
        this.styles.set(field, rule ? decodeStyle(rule.coloridx) : { color: NO_COLOR, attr: 0 });
        // wintty.c:4588-4589 stores the title rule's colour and attribute on
        // the title cell; wintty.c:4613-4615 overwrite the cell when the HP
        // field is updated (botl.c evaluates the title first).  A status
        // round that updates neither field keeps the previous bar style.
        if (field === BL_TITLE)
            this.barStyle = rule ? decodeStyle(rule.coloridx) : { color: NO_COLOR, attr: 0 };
        if (field === BL_HP && state.flags.hitpointbar) {
            this.barCritical = criticallyLowHp(true, state);
            this.barStyle = { color: rule ? rule.coloridx & 255 : NO_COLOR,
                attr: hiliteAttributes(HL_INVERSE | (this.barCritical ? HL_BLINK : 0)) };
        }
    }
}
// C best-fit precedence is shared between absolute and percentage rules:
// exact matches win; otherwise prefer the closest lower/upper bound. Change
// rules override persistent rules, and a qualifying critical-HP rule wins.
// C botl.c:get_hilite().
function chooseHilite(rules, current, change, critical, polymorphed) {
    let selected = null;
    let exact = false, updown = false, changed = false, numeric = false, criticalHp = false;
    let minPercent = 101, maxPercent = -1;
    const limit = rules.some(rule => rule.anytype === 'long') ? Number.MAX_SAFE_INTEGER : 32767;
    let minValue = limit, maxValue = -limit;
    for (const rule of rules) {
        if (criticalHp && rule.behavior !== BL_TH_CRITICALHP)
            continue;
        if ((updown || changed) && rule.behavior !== BL_TH_UPDOWN)
            continue;
        if (numeric && rule.behavior === BL_TH_ALWAYS_HILITE)
            continue;
        if (rule.behavior === BL_TH_VAL_ABSOLUTE || rule.behavior === BL_TH_VAL_PERCENTAGE) {
            const percent = rule.behavior === BL_TH_VAL_PERCENTAGE;
            const value = percent ? current.percent : current.value;
            if (typeof value !== 'number')
                continue;
            const threshold = rule.value;
            let matched = false;
            if (rule.rel === EQ_VALUE && value === threshold) {
                exact = matched = true;
                if (percent)
                    minPercent = maxPercent = threshold;
                else
                    minValue = maxValue = threshold;
            }
            else if (!exact) {
                const lower = rule.rel === LT_VALUE && value < threshold || rule.rel === LE_VALUE && value <= threshold;
                const upper = rule.rel === GT_VALUE && value > threshold || rule.rel === GE_VALUE && value >= threshold;
                if (lower && threshold <= (percent ? minPercent : minValue)) {
                    matched = true;
                    if (percent)
                        minPercent = threshold;
                    else
                        minValue = threshold;
                }
                else if (upper && threshold >= (percent ? maxPercent : maxValue)) {
                    matched = true;
                    if (percent)
                        maxPercent = threshold;
                    else
                        maxValue = threshold;
                }
            }
            if (matched) {
                selected = rule;
                numeric = true;
            }
        }
        else if (rule.behavior === BL_TH_UPDOWN) {
            if (change < 0 && rule.rel === LT_VALUE || change > 0 && rule.rel === GT_VALUE) {
                selected = rule;
                updown = true;
            }
            else if (change && rule.rel === EQ_VALUE && !updown) {
                selected = rule;
                changed = true;
            }
        }
        else if (rule.behavior === BL_TH_TEXTMATCH && rule.rel === TXT_VALUE && rule.textmatch) {
            const pattern = fuzzyText(rule.textmatch);
            if (pattern === fuzzyText(current.text)) {
                selected = rule;
                exact = true;
            }
            else if (!exact && polymorphed && isPolymorphedTitleFallback(rule.textmatch))
                selected = rule;
        }
        else if (rule.behavior === BL_TH_ALWAYS_HILITE)
            selected = rule;
        else if (rule.behavior === BL_TH_CRITICALHP && critical) {
            selected = rule;
            criticalHp = true;
            updown = changed = numeric = false;
        }
    }
    return selected;
}
// C botl.c:noneoftheabove(). Each spelling has its own ignored punctuation.
function isPolymorphedTitleFallback(text) {
    return fuzzyText(text) === 'noneoftheabove'
        || text.replace(/["()]/g, '').toLowerCase() === 'polymorphed'
        || text.replace(/[" _()\-]/g, '').toLowerCase() === 'noneoftheabovepolymorphed';
}
function compare(previous, current) {
    if (typeof previous === 'string' && typeof current === 'string')
        return previous < current ? -1 : previous > current ? 1 : 0;
    return previous < current ? 1 : previous > current ? -1 : 0;
}
function fuzzyText(text) { return text.replace(/[" _-]/g, '').toLowerCase(); }
function numberValue(value, raw = value, percent = 0, text = String(value)) {
    return { value, raw, percent, text };
}
function textValue(text) { return { value: text, raw: text, text, percent: 0 }; }
function percentage(value, maximum) {
    if (!maximum)
        return 0;
    const percent = Math.trunc(100 * value / maximum);
    return value && !percent ? 1 : percent;
}
// botl.c exp_percentage(): the final point before a new level counts as 100%.
function experiencePercentage(state) {
    const level = state.u.ulevel ?? 1;
    if (level >= 30)
        return 0;
    const start = newExperienceThreshold(level - 1);
    const range = newExperienceThreshold(level) - start;
    const progress = (state.u.uexp ?? 0) - start;
    return progress === range - 1 ? 100 : percentage(progress, range);
}
function fieldValues(state, fields) {
    const hero = state.u;
    const hp = Math.max(0, (Upolyd(hero) ? hero.mh : hero.uhp) ?? 0);
    const maximum = (Upolyd(hero) ? hero.mhmax : hero.uhpmax) ?? 0;
    const energy = hero.uen ?? 0, energyMaximum = hero.uenmax ?? 0;
    const level = hero.ulevel ?? 1, experience = hero.uexp ?? 0;
    const gold = Math.max(0, state._statusGoldOverride ?? heroGoldAmount(state));
    const title = statusTitle(state).padEnd(30);
    const nameLength = (state.plname || state.displayName || 'Hero').length;
    const values = new Map([
        [BL_TITLE, { ...textValue(title), text: title.slice(nameLength + 5) }],
        [BL_ALIGN, textValue(hero.ualign?.type === -1 ? 'Chaotic' : hero.ualign?.type === 0 ? 'Neutral' : 'Lawful')],
        [BL_HP, numberValue(Math.min(hp, 9999), hp, percentage(hp, maximum))],
        [BL_HPMAX, numberValue(Math.min(maximum, 9999), maximum)],
        [BL_ENE, numberValue(Math.min(energy, 9999), energy, percentage(energy, energyMaximum))],
        [BL_ENEMAX, numberValue(Math.min(energyMaximum, 9999), energyMaximum)],
        [BL_AC, numberValue(hero.uac ?? 10)], [BL_TIME, numberValue(state.moves)],
        [BL_HUNGER, numberValue(hero.uhs ?? 0, hero.uhs ?? 0, 0, fields.hunger)],
        [BL_CAP, numberValue(fields.capacity, fields.capacity, 0, ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'][fields.capacity] ?? '')],
        [BL_GOLD, numberValue(Math.min(gold, 999999), gold)],
        [BL_LEVELDESC, textValue(fields.location)], [BL_VERS, textValue(fields.version)],
    ]);
    const experiencePercent = experiencePercentage(state);
    values.set(BL_XP, numberValue(level, level, experiencePercent));
    values.set(BL_EXP, numberValue(experience, experience, experiencePercent));
    values.set(BL_HD, numberValue(Upolyd(hero) ? MONSTER_LEVEL[hero.umonnum ?? -1] ?? 0 : 0));
    for (const [field, attribute] of [[BL_STR, A_STR], [BL_DX, A_DEX], [BL_CO, A_CON],
        [BL_IN, A_INT], [BL_WI, A_WIS], [BL_CH, A_CHA]])
        values.set(field, numberValue(currentAttribute(attribute, state)));
    for (const equipment of fields.equipment)
        values.set(equipment.field, textValue(equipment.text));
    if (!state.flags.time)
        values.delete(BL_TIME);
    if (!state.flags.showvers)
        values.delete(BL_VERS);
    if (Upolyd(hero)) {
        values.delete(BL_XP);
        values.delete(BL_EXP);
    }
    else
        values.delete(BL_HD);
    if (!state.flags.showexp)
        values.delete(BL_EXP);
    return values;
}
function plainStatusText(text) {
    return text.replace(/\x1b\[(\d+)C/g, (_match, count) => ' '.repeat(Number(count)))
        .replace(/\x1b\[[0-9;]*m/g, '');
}
export function firstStatusLineSpans(text, hitpointBar, hitpointBarFill = 0) {
    const plain = plainStatusText(text);
    const stats = plain.lastIndexOf(' St:');
    const spans = [{ field: BL_TITLE, start: hitpointBar ? 1 : 0,
            end: hitpointBar ? 31 : Math.max(0, stats), hitpointBar,
            ...(hitpointBar ? { fill: hitpointBarFill } : {}) }];
    const fields = new Map([['St', BL_STR], ['Dx', BL_DX], ['Co', BL_CO], ['In', BL_IN], ['Wi', BL_WI], ['Ch', BL_CH]]);
    for (const match of plain.slice(stats + 1).matchAll(/(St|Dx|Co|In|Wi|Ch):\S+/g)) {
        const field = fields.get(match[1] ?? '');
        if (field !== undefined)
            spans.push({ field, start: stats + 1 + match.index,
                end: stats + 1 + match.index + match[0].length });
    }
    const alignment = plain.match(/(?:Lawful|Neutral|Chaotic)\s*$/);
    if (alignment?.index !== undefined)
        spans.push({ field: BL_ALIGN, start: alignment.index, end: plain.trimEnd().length });
    return spans;
}
// term_attr_fixup() is identity for the recorded terminal, so hilite
// attribute masks map straight onto terminal attributes.
function hiliteAttributes(mask) {
    let attr = 0;
    for (const [hilite, terminal] of [[HL_BOLD, ATR_BOLD], [HL_DIM, TERMINAL_DIM], [HL_ITALIC, TERMINAL_ITALIC],
        [HL_ULINE, ATR_UNDERLINE], [HL_BLINK, ATR_BLINK], [HL_INVERSE, ATR_INVERSE]])
        if (mask & hilite)
            attr |= terminal;
    return attr;
}
function decodeStyle(coloridx) {
    return { color: coloridx & 255, attr: hiliteAttributes(coloridx >> 8) };
}
// botl.c initblstats[] in its own order: the menus index this table by
// position, not by enum value. The last five rows are permuted — the table
// runs condition, version, weapon, armor, terrain while the enum numbers
// weapon, armor, terrain, vers — and `fld` below carries C's initblstats[].fld
// (the enum value) exactly, so the main menu's identifiers pick the shifted
// rows just as native does. idxmax is the field a percentage is taken
// against (-1: no percentage rules).
const STATUS_FIELDS = [
    { fld: BL_TITLE, name: 'title', anytype: 'str', idxmax: -1 },
    { fld: 1, name: 'strength', anytype: 'int', idxmax: -1 },
    { fld: 2, name: 'dexterity', anytype: 'int', idxmax: -1 },
    { fld: 3, name: 'constitution', anytype: 'int', idxmax: -1 },
    { fld: 4, name: 'intelligence', anytype: 'int', idxmax: -1 },
    { fld: 5, name: 'wisdom', anytype: 'int', idxmax: -1 },
    { fld: 6, name: 'charisma', anytype: 'int', idxmax: -1 },
    { fld: 7, name: 'alignment', anytype: 'str', idxmax: -1 },
    { fld: BL_SCORE, name: 'score', anytype: 'long', idxmax: -1 },
    { fld: 9, name: 'carrying-capacity', anytype: 'int', idxmax: -1 },
    { fld: 10, name: 'gold', anytype: 'long', idxmax: -1 },
    { fld: BL_ENE, name: 'power', anytype: 'int', idxmax: BL_ENEMAX },
    { fld: BL_ENEMAX, name: 'power-max', anytype: 'int', idxmax: -1 },
    { fld: BL_XP, name: 'experience-level', anytype: 'int', idxmax: BL_EXP },
    { fld: BL_AC, name: 'armor-class', anytype: 'int', idxmax: -1 },
    { fld: 15, name: 'HD', anytype: 'int', idxmax: -1 },
    { fld: 16, name: 'time', anytype: 'long', idxmax: -1 },
    { fld: BL_HUNGER, name: 'hunger', anytype: 'int', idxmax: -1 },
    { fld: BL_HP, name: 'hitpoints', anytype: 'int', idxmax: BL_HPMAX },
    { fld: BL_HPMAX, name: 'hitpoints-max', anytype: 'int', idxmax: -1 },
    { fld: 20, name: 'dungeon-level', anytype: 'str', idxmax: -1 },
    { fld: BL_EXP, name: 'experience', anytype: 'long', idxmax: BL_EXP },
    { fld: BL_CONDITION, name: 'condition', anytype: 'mask32', idxmax: -1 },
    { fld: BL_VERS, name: 'version', anytype: 'str', idxmax: -1 },
    { fld: BL_WEAPON, name: 'weapon', anytype: 'str', idxmax: -1 },
    { fld: BL_ARMOR, name: 'armor', anytype: 'str', idxmax: -1 },
    { fld: BL_TERRAIN, name: 'terrain', anytype: 'str', idxmax: -1 },
];
if (STATUS_FIELDS.length !== MAXBLSTATS)
    throw new Error('initblstats must list every status field');
/** botl.c initblstats[] table for the config rule parser. */
export function statusFieldTable() {
    return STATUS_FIELDS;
}
// botl.c conditions[]: the picker order and canonical display names.
const HILITE_CONDITIONS = [
    [BL_MASK_BAREH, 'Bare'], [BL_MASK_BLIND, 'Blind'], [BL_MASK_BUSY, 'Busy'],
    [BL_MASK_CONF, 'Conf'], [BL_MASK_DEAF, 'Deaf'], [BL_MASK_ELF_IRON, 'Iron'],
    [BL_MASK_FLY, 'Fly'], [BL_MASK_FOODPOIS, 'FoodPois'], [BL_MASK_GLOWHANDS, 'Glow'],
    [BL_MASK_GRAB, 'Grab'], [BL_MASK_HALLU, 'Hallu'], [BL_MASK_HELD, 'Held'],
    [BL_MASK_ICY, 'Icy'], [BL_MASK_INLAVA, 'InLava'], [BL_MASK_LEV, 'Lev'],
    [BL_MASK_PARLYZ, 'Parlyz'], [BL_MASK_RIDE, 'Ride'], [BL_MASK_SLEEPING, 'Zzz'],
    [BL_MASK_SLIME, 'Slime'], [BL_MASK_SLIPPERY, 'Slip'], [BL_MASK_STONE, 'Stone'],
    [BL_MASK_STRNGL, 'Strngl'], [BL_MASK_STUN, 'Stun'], [BL_MASK_SUBMERGED, 'Submrg'],
    [BL_MASK_TERMILL, 'TermIll'], [BL_MASK_TETHERED, 'Teth'], [BL_MASK_TRAPPED, 'Trap'],
    [BL_MASK_UNCONSC, 'Out'], [BL_MASK_WOUNDEDL, 'WLegs'], [BL_MASK_HOLDING, 'UHold'],
];
/** botl.c conditions[] for the config rule parser. */
export function conditionEntries() {
    return HILITE_CONDITIONS;
}
// botl.c condition_aliases[]; conditionbitmask2str() starts comparing at
// index 1, so the "strangled" spelling never names a rendered mask.
const CONDITION_ALIASES = [
    ['strangled', BL_MASK_STRNGL],
    ['all', BL_MASK_BAREH | BL_MASK_BLIND | BL_MASK_BUSY | BL_MASK_CONF | BL_MASK_DEAF
            | BL_MASK_ELF_IRON | BL_MASK_FLY | BL_MASK_FOODPOIS | BL_MASK_GLOWHANDS
            | BL_MASK_GRAB | BL_MASK_HALLU | BL_MASK_HELD | BL_MASK_ICY | BL_MASK_INLAVA
            | BL_MASK_LEV | BL_MASK_PARLYZ | BL_MASK_RIDE | BL_MASK_SLEEPING | BL_MASK_SLIME
            | BL_MASK_SLIPPERY | BL_MASK_STONE | BL_MASK_STRNGL | BL_MASK_STUN
            | BL_MASK_SUBMERGED | BL_MASK_TERMILL | BL_MASK_TETHERED | BL_MASK_TRAPPED
            | BL_MASK_UNCONSC | BL_MASK_WOUNDEDL | BL_MASK_HOLDING],
    ['major_troubles', BL_MASK_FOODPOIS | BL_MASK_GRAB | BL_MASK_INLAVA | BL_MASK_SLIME
            | BL_MASK_STONE | BL_MASK_STRNGL | BL_MASK_TERMILL],
    ['minor_troubles', BL_MASK_BLIND | BL_MASK_CONF | BL_MASK_DEAF | BL_MASK_HALLU
            | BL_MASK_PARLYZ | BL_MASK_SUBMERGED | BL_MASK_STUN],
    ['movement', BL_MASK_LEV | BL_MASK_FLY | BL_MASK_RIDE],
    ['opt_in', BL_MASK_BAREH | BL_MASK_BUSY | BL_MASK_GLOWHANDS | BL_MASK_HELD | BL_MASK_ICY
            | BL_MASK_PARLYZ | BL_MASK_SLEEPING | BL_MASK_SLIPPERY | BL_MASK_SUBMERGED
            | BL_MASK_TETHERED | BL_MASK_TRAPPED | BL_MASK_UNCONSC | BL_MASK_WOUNDEDL
            | BL_MASK_HOLDING],
];
/** botl.c condition_aliases[] for the config rule parser. */
export function conditionAliasEntries() {
    return CONDITION_ALIASES;
}
// botl.c enc_stat[] (index SLT_ENCUMBER..OVERLOADED), the alignment texts,
// and the hunger names hu_stat[] carries between Satiated and Hungry.
const ENC_STAT = ['', 'Burdened', 'Stressed', 'Strained', 'Overtaxed', 'Overloaded'];
const ALIGN_TEXTS = ['chaotic', 'neutral', 'lawful'];
const HUNGER_TEXTS = ['Satiated', null, 'Hungry', 'Weak', 'Fainting', 'Fainted', 'Starved'];
/** botl.c enc_stat[] indices SLT_ENCUMBER..OVERLOADED. */
export function encStatNames() {
    return ENC_STAT;
}
/** botl.c aligntxt[]. */
export function alignTexts() {
    return ALIGN_TEXTS;
}
/** botl.c hutxt[]: hu_stat[] names between Satiated and Starved. */
export function hungerTexts() {
    return HUNGER_TEXTS;
}
function fieldThresholds() {
    return game.iflags.statusThresholds ??= Array.from({ length: MAXBLSTATS }, () => []);
}
function condHilites() {
    return game.iflags.condHilites ??= new Array(BL_ATTCLR_MAX).fill(0);
}
// botl.c conditionbitmask2str(): canonical names joined with '+', replaced
// by an alias name when the whole mask equals that alias.
function conditionBitmaskToString(mask) {
    if (!mask)
        return '';
    let alias = null;
    for (const [aliasName, aliasMask] of CONDITION_ALIASES.slice(1))
        if (aliasMask === mask)
            alias = aliasName;
    const text = HILITE_CONDITIONS.filter(([bit]) => (bit & mask) !== 0)
        .map(([, name]) => name).join('+');
    return text && alias ? alias : text;
}
// botl.c hlattr2attrname(): the attribute half of a hilite rule's
// coloridx, as written into config-format rule text.
function hlAttrToAttrName(attrib) {
    if (!attrib)
        return null;
    if (attrib === HL_NONE)
        return 'normal';
    const parts = [];
    if (attrib & HL_BOLD)
        parts.push('bold');
    if (attrib & HL_DIM)
        parts.push('dim');
    if (attrib & HL_ITALIC)
        parts.push('italic');
    if (attrib & HL_ULINE)
        parts.push('underline');
    if (attrib & HL_BLINK)
        parts.push('blink');
    if (attrib & HL_INVERSE)
        parts.push('inverse');
    return parts.join('+') || null;
}
// botl.c status_hilite2str(): the config-format "field/behavior/color"
// rendering of one rule. a_int reads truncate the stored value to 32 bits
// for both int and long rules, as C's union read does in practice.
function statusHiliteToString(rule) {
    const field = STATUS_FIELDS[rule.fld];
    const op = rule.rel === LT_VALUE ? '<' : rule.rel === LE_VALUE ? '<='
        : rule.rel === GT_VALUE ? '>' : rule.rel === GE_VALUE ? '>='
            : rule.rel === EQ_VALUE ? '=' : '';
    let behave = '';
    switch (rule.behavior) {
        case BL_TH_VAL_PERCENTAGE:
            behave = `${op}${rule.value | 0}%`;
            break;
        case BL_TH_UPDOWN:
            behave = rule.rel === LT_VALUE ? 'down' : rule.rel === GT_VALUE ? 'up' : 'changed';
            break;
        case BL_TH_VAL_ABSOLUTE:
            behave = `${op}${rule.value | 0}`;
            break;
        case BL_TH_TEXTMATCH:
            behave = rule.textmatch;
            break;
        case BL_TH_CONDITION:
            behave = conditionBitmaskToString(rule.value);
            break;
        case BL_TH_ALWAYS_HILITE:
            behave = 'always';
            break;
        case BL_TH_CRITICALHP:
            behave = 'criticalhp';
            break;
        default: break;
    }
    const attr = rule.coloridx >> 8;
    const clrbuf = colorName(rule.coloridx & 0xff).replace(/ /g, '-')
        + (attr !== 0 ? `&${hlAttrToAttrName(attr) ?? ''}` : '');
    return `${field?.name ?? ''}/${behave}/${clrbuf}`;
}
// C keeps the gathered display list in function statics; ids restart at one
// for every gather. Rules live on the per-game flags, this list does not.
let hiliteStrs = [];
let hiliteStrId = 0;
// C botl.c:status_hilite_linestr_add().
function linestrAdd(fld, rule, mask, str) {
    // status_hilite_linestr_add() strips every space except for title rows.
    hiliteStrs.push({ id: ++hiliteStrId, fld, rule, mask,
        str: fld === BL_TITLE ? str : str.replace(/ /g, '') });
}
// C botl.c:status_hilite_linestr_done().
function linestrDone() {
    hiliteStrs = [];
    hiliteStrId = 0;
}
// C botl.c:status_hilite_linestr_countfield().
function linestrCountField(fld) {
    return hiliteStrs.reduce((count, line) => count + (fld === BL_FLUSH || line.fld === fld ? 1 : 0), 0);
}
// botl.c status_hilite_linestr_gather_conditions(): every condition mask
// that shares a color/attribute pair becomes one grouped rule row.
function linestrGatherConditions() {
    const condMaps = HILITE_CONDITIONS.map(() => ({ mask: 0, clratr: -1 }));
    for (const [mask] of HILITE_CONDITIONS) {
        const conds = condHilites();
        let clr = NO_COLOR;
        let atr = HL_NONE;
        for (let j = 0; j < CLR_MAX; j++)
            if (((conds[j] ?? 0) & mask) !== 0) {
                clr = j;
                break;
            }
        if (((conds[HL_ATTCLR_BOLD] ?? 0) & mask) !== 0)
            atr |= HL_BOLD;
        if (((conds[HL_ATTCLR_DIM] ?? 0) & mask) !== 0)
            atr |= HL_DIM;
        if (((conds[HL_ATTCLR_ITALIC] ?? 0) & mask) !== 0)
            atr |= HL_ITALIC;
        if (((conds[HL_ATTCLR_ULINE] ?? 0) & mask) !== 0)
            atr |= HL_ULINE;
        if (((conds[HL_ATTCLR_BLINK] ?? 0) & mask) !== 0)
            atr |= HL_BLINK;
        if (((conds[HL_ATTCLR_INVERSE] ?? 0) & mask) !== 0)
            atr |= HL_INVERSE;
        if (atr !== HL_NONE)
            atr &= ~HL_NONE;
        if (clr === NO_COLOR && atr === HL_NONE)
            continue;
        const ca = clr | (atr << 8);
        const existing = condMaps.find(entry => entry.clratr === ca);
        if (existing)
            existing.mask |= mask;
        else {
            const free = condMaps.find(entry => entry.mask === 0);
            if (free) {
                free.mask = mask;
                free.clratr = ca;
            }
        }
    }
    for (const { mask, clratr } of condMaps) {
        if (!mask)
            continue;
        const clr = clratr & 0xff;
        const atr = clratr >> 8;
        if (clr === NO_COLOR && atr === HL_NONE)
            continue;
        const clrbuf = colorName(clr).replace(/ /g, '-')
            + (hlAttrToAttrName(atr) !== null ? `&${hlAttrToAttrName(atr)}` : '');
        linestrAdd(BL_CONDITION, null, mask, `condition/${conditionBitmaskToString(mask)}/${clrbuf}`);
    }
}
// C botl.c:status_hilite_linestr_gather().
function linestrGather() {
    linestrDone();
    const thresholds = fieldThresholds();
    for (let fld = 0; fld < MAXBLSTATS; fld++)
        for (const rule of thresholds[fld] ?? [])
            linestrAdd(fld, rule, 0, statusHiliteToString(rule));
    linestrGatherConditions();
}
// botl.c count_status_hilites(), used by the options-menu rows.
export function countStatusHilites() {
    linestrGather();
    const count = linestrCountField(BL_FLUSH);
    linestrDone();
    return count;
}
export function clearStatusHilites(iflags = game.iflags) {
    iflags.statusThresholds = Array.from({ length: MAXBLSTATS }, () => []);
}
// botl.c reset_status_hilites(): the tty repaint (disp.botlx = TRUE, a full
// BL_RESET render of both rows) is carried by context.botl here because every
// status refresh repaints the rows in full; the update_all round that
// re-evaluates unchanged fields runs only while highlighting is on.
export function resetStatusHilites() {
    if (game.iflags.hiliteDelta)
        game.nhDisplay?.statusHighlights.reset();
    game.context.botl = true;
}
// botl.c query_conditions(): PICK_ANY over the condition names.
async function queryConditions() {
    const picks = await showMultiSelectWindow({
        title: 'Choose status conditions', omitHeadings: true, signalEscape: true,
        pageLocalKeys: true,
        sections: [{ items: HILITE_CONDITIONS.map(([mask, name]) => ({ value: mask, text: name })) }],
    });
    return (picks ?? []).reduce((mask, bit) => mask | bit, 0);
}
// botl.c query_arrayvalue(): PICK_ONE over a slice of a name table.
async function queryArrayValue(prompt, values, arrmin, arrmax) {
    const adj = arrmin > 0 ? 1 : arrmax;
    const rows = [];
    for (let i = arrmin; i < arrmax; i++) {
        const text = values[i];
        if (text === null || text === undefined)
            continue; // hunger gap
        rows.push({ value: i + adj, text });
    }
    const picks = await showMultiSelectWindow({
        title: prompt, omitHeadings: true, pickOne: true, signalEscape: true,
        pageLocalKeys: true,
        sections: [{ items: rows.map(row => ({ value: row.value, text: row.text })) }],
    });
    if (!picks || picks[0] === undefined)
        return arrmin - 1;
    return picks[0] - adj;
}
// botl.c status_hilite_menu_choose_field(): BL_FLUSH when nothing is picked.
async function statusHiliteMenuChooseField() {
    const thresholds = fieldThresholds();
    const rows = [];
    for (let i = 0; i < MAXBLSTATS; i++) {
        // SCORE_ON_BOTL is not compiled in: 'score' appears only when its
        // rules came from the config file.
        if (i === BL_SCORE && !(thresholds[BL_SCORE]?.length))
            continue;
        rows.push({ value: i + 1, text: STATUS_FIELDS[i]?.name ?? '' });
    }
    const picks = await showMultiSelectWindow({
        title: 'Select a hilite field:', omitHeadings: true, pickOne: true,
        signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows.map(row => ({ value: row.value, text: row.text })) }],
    });
    if (!picks || picks[0] === undefined)
        return BL_FLUSH;
    return picks[0] - 1;
}
// botl.c status_hilite_menu_choose_behavior(): BL_TH_NONE-1 for a cancelled
// menu, BL_TH_NONE for an answered-but-empty one.
async function statusHiliteMenuChooseBehavior(fld) {
    if (fld < 0 || fld >= MAXBLSTATS)
        return BL_TH_NONE;
    const field = STATUS_FIELDS[fld];
    if (!field)
        return BL_TH_NONE;
    const rows = [];
    let onlyBehavior = BL_TH_NONE;
    if (fld !== BL_CONDITION) {
        onlyBehavior = BL_TH_ALWAYS_HILITE;
        rows.push({ key: 'a', value: onlyBehavior, text: `Always highlight ${field.name}` });
    }
    if (fld === BL_CONDITION) {
        onlyBehavior = BL_TH_CONDITION;
        rows.push({ key: 'b', value: onlyBehavior, text: 'Bitmask of conditions' });
    }
    if (fld !== BL_CONDITION && fld !== BL_VERS) {
        onlyBehavior = BL_TH_UPDOWN;
        rows.push({ key: 'c', value: onlyBehavior, text: `${field.name} value changes` });
    }
    if (fld !== BL_CAP && fld !== BL_HUNGER && (field.anytype === 'int' || field.anytype === 'long')) {
        onlyBehavior = BL_TH_VAL_ABSOLUTE;
        rows.push({ key: 'n', value: onlyBehavior, text: 'Number threshold' });
    }
    if (field.idxmax >= 0) {
        onlyBehavior = BL_TH_VAL_PERCENTAGE;
        rows.push({ key: 'p', value: onlyBehavior, text: 'Percentage threshold' });
    }
    if (fld === BL_HP) {
        onlyBehavior = BL_TH_CRITICALHP;
        rows.push({ key: 'C', value: onlyBehavior, text: `Highlight critically low ${field.name}` });
    }
    if (field.anytype === 'str' || fld === BL_CAP || fld === BL_HUNGER) {
        onlyBehavior = BL_TH_TEXTMATCH;
        rows.push({ key: 't', value: onlyBehavior, text: `${field.name} text match` });
    }
    if (rows.length <= 1)
        return onlyBehavior;
    const picks = await showMultiSelectWindow({
        title: `Select ${field.name} field hilite behavior:`, omitHeadings: true,
        pickOne: true, signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows.map(row => ({ key: row.key, value: row.value, text: row.text })) }],
    });
    if (picks === null)
        return BL_TH_NONE - 1;
    if (picks[0] === undefined)
        return BL_TH_NONE;
    return picks[0];
}
// botl.c status_hilite_menu_choose_updownboth().
async function statusHiliteMenuChooseUpDownBoth(fld, str, ltok, gtok) {
    const rows = [];
    if (ltok) {
        if (str !== null)
            rows.push({ value: 10 + LT_VALUE, text: `${fld === BL_AC ? 'Better (lower)' : 'Less'} than ${str}` });
        else
            rows.push({ value: 10 + LT_VALUE, text: 'Value goes down' });
        if (str !== null)
            rows.push({ value: 10 + LE_VALUE, text: `${str} or ${fld === BL_AC ? 'better (lower)' : 'less'}` });
    }
    rows.push(str !== null
        ? { value: 10 + EQ_VALUE, text: `Exactly ${str}` }
        : { value: 10 + EQ_VALUE, text: 'Value changes' });
    if (gtok) {
        if (str !== null)
            rows.push({ value: 10 + GE_VALUE, text: `${str} or ${fld === BL_AC ? 'worse (higher)' : 'more'}` });
        if (str !== null)
            rows.push({ value: 10 + GT_VALUE, text: `${fld === BL_AC ? 'Worse (higher)' : 'More'} than ${str}` });
        else
            rows.push({ value: 10 + GT_VALUE, text: 'Value goes up' });
    }
    const picks = await showMultiSelectWindow({
        title: `Select field ${STATUS_FIELDS[fld]?.name ?? ''} value:`, omitHeadings: true,
        pickOne: true, signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows.map(row => ({ value: row.value, text: row.text })) }],
    });
    if (!picks || picks[0] === undefined)
        return NO_LTEQGT;
    return picks[0] - 10;
}
// botl.c status_hilite_menu_add(): one whole rule entry session, including
// C's goto retry structure. Returns whether a rule was added.
async function statusHiliteMenuAdd(origfld) {
    const printable = (_character, key) => key >= 32 && key < 127;
    let retry = 0;
    chooseField: for (;;) {
        let fld = origfld;
        if (fld === BL_FLUSH) {
            fld = await statusHiliteMenuChooseField();
            if (fld === BL_FLUSH)
                return false;
        }
        const field = STATUS_FIELDS[fld];
        if (!field)
            return false;
        let behavior = BL_TH_NONE;
        let colorqry = '';
        let attrqry = '';
        let cond = 0;
        let ltGtEq = NO_LTEQGT;
        let value = 0;
        const rule = {
            fld, set: false, anytype: field.anytype, value: 0,
            behavior: BL_TH_NONE, textmatch: '', rel: NO_LTEQGT, coloridx: 0,
        };
        chooseBehavior: for (;;) {
            behavior = await statusHiliteMenuChooseBehavior(fld);
            if (behavior === BL_TH_NONE - 1)
                return false;
            if (behavior === BL_TH_NONE) {
                if (origfld === BL_FLUSH)
                    continue chooseField;
                return false;
            }
            rule.behavior = behavior;
            chooseValue: for (;;) {
                // C's `retry++ > 5` blocks the seventh value prompt.
                if (retry++ > 5) {
                    await pline("That's enough tries.");
                    return false;
                }
                if (behavior === BL_TH_VAL_PERCENTAGE || behavior === BL_TH_VAL_ABSOLUTE) {
                    const percent = behavior === BL_TH_VAL_PERCENTAGE;
                    const answer = await getLine(`Enter ${percent ? 'percentage ' : ''}value for ${field.name} threshold:`, printable);
                    if (answer === null || answer.trim() === '')
                        continue chooseBehavior;
                    // C walks and mangles the response buffer in place;
                    // trimspaces() only skips the leading blanks in it, so
                    // they stay in the buffer and reach the value rows.
                    const raw = [...answer];
                    let start = 0;
                    let cut = raw.length;
                    while (/\s/.test(raw[start] ?? ''))
                        start++;
                    while (cut > start && /\s/.test(raw[cut - 1] ?? ''))
                        cut--;
                    const chars = raw.slice(0, cut);
                    let position = start;
                    let numstart = start;
                    let gotnum = false;
                    ltGtEq = NO_LTEQGT;
                    const first = chars[start];
                    if (first === '>' || first === '<' || first === '=') {
                        const second = chars[start + 1];
                        ltGtEq = first === '>' ? (second === '=' ? GE_VALUE : GT_VALUE)
                            : first === '<' ? (second === '=' ? LE_VALUE : LT_VALUE)
                                : EQ_VALUE;
                        chars[position] = ' ';
                        position++;
                        numstart++;
                        if (ltGtEq === GE_VALUE || ltGtEq === LE_VALUE) {
                            chars[position] = ' ';
                            position++;
                            numstart++;
                        }
                    }
                    if (chars[position] === '-')
                        position++;
                    else if (chars[position] === '+') {
                        chars[position] = ' ';
                        position++;
                        numstart++;
                    }
                    while (/[0-9]/.test(chars[position] ?? '')) {
                        position++;
                        gotnum = true;
                    }
                    let end = chars.length;
                    if (chars[position] === '%') {
                        if (!percent) {
                            await pline('Not expecting a percentage.');
                            continue chooseBehavior;
                        }
                        // strip '%': trailing junk past it is accepted
                        chars[position] = '\0';
                        end = position;
                    }
                    else if (chars[position] !== undefined) {
                        await pline(`"${chars.slice(position).join('')}" is not a recognized number.`);
                        continue chooseValue;
                    }
                    if (!gotnum) {
                        await pline('Is that an invisible number?');
                        continue chooseValue;
                    }
                    const op = ltGtEq === LT_VALUE ? '<' : ltGtEq === LE_VALUE ? '<='
                        : ltGtEq === GT_VALUE ? '>' : ltGtEq === GE_VALUE ? '>='
                            : ltGtEq === EQ_VALUE ? '=' : '';
                    let numText = chars.slice(numstart, end).join('');
                    value = Number.parseInt(numText, 10) || 0;
                    const int32 = Math.trunc(value) | 0;
                    if (percent) {
                        if (field.idxmax === -1) {
                            await pline(`Field '${field.name}' does not support percentage values.`);
                            behavior = BL_TH_VAL_ABSOLUTE;
                            continue chooseValue;
                        }
                        if ((int32 < 0 && (int32 !== -1 || ltGtEq !== GT_VALUE))
                            || (int32 === 0 && ltGtEq === LT_VALUE)
                            || (int32 === 100 && ltGtEq === GT_VALUE)
                            || (int32 > 100 && (int32 !== 101 || ltGtEq !== LT_VALUE))) {
                            await pline(`'${op}${int32}%' is not a valid percent value.`);
                            continue chooseValue;
                        }
                        numText += '%';
                    }
                    else if (field.anytype === 'int'
                        && int32 < (fld === BL_AC ? -128
                            : ltGtEq === GT_VALUE ? -1 : ltGtEq === LT_VALUE ? 1 : 0)) {
                        await pline(`${THRESHOLD_VALUE}'${op}${int32}'${IS_OUT_OF_RANGE}`);
                        continue chooseValue;
                    }
                    else if (field.anytype === 'long'
                        && value < (ltGtEq === GT_VALUE ? -1 : ltGtEq === LT_VALUE ? 1 : 0)) {
                        await pline(`${THRESHOLD_VALUE}'${op}${value}'${IS_OUT_OF_RANGE}`);
                        continue chooseValue;
                    }
                    const displayStr = chars.slice(0, end).join('') + (percent ? '%' : '');
                    if (ltGtEq === NO_LTEQGT) {
                        const ltok = field.anytype === 'int' ? (int32 > 0 || fld === BL_AC) : value > 0;
                        const gtok = !percent || value < 100;
                        ltGtEq = await statusHiliteMenuChooseUpDownBoth(fld, displayStr, ltok, gtok);
                        if (ltGtEq === NO_LTEQGT)
                            continue chooseValue;
                    }
                    const relation = ltGtEq === LT_VALUE ? 'less than '
                        : ltGtEq === GT_VALUE ? 'more than ' : '';
                    const suffix = ltGtEq === LE_VALUE ? ' or less' : ltGtEq === GE_VALUE ? ' or more' : '';
                    colorqry = `Choose a color for when ${field.name} is ${relation}${numText}${suffix}:`;
                    attrqry = `Choose attribute for when ${field.name} is ${relation}${numText}${suffix}:`;
                    rule.rel = ltGtEq;
                    rule.value = value;
                }
                else if (behavior === BL_TH_UPDOWN) {
                    if (field.anytype !== 'str') {
                        const ltok = fld !== BL_TIME;
                        ltGtEq = await statusHiliteMenuChooseUpDownBoth(fld, null, ltok, true);
                        if (ltGtEq === NO_LTEQGT)
                            continue chooseBehavior;
                    }
                    else {
                        // ordered text comparison is pointless for the string
                        // fields; skip the single-choice menu, use 'changed'
                        ltGtEq = EQ_VALUE;
                    }
                    const verb = ltGtEq === EQ_VALUE ? 'changes'
                        : ltGtEq === LT_VALUE ? 'decreases' : 'increases';
                    colorqry = `Choose a color for when ${field.name} ${verb}:`;
                    attrqry = `Choose attribute for when ${field.name} ${verb}:`;
                    rule.rel = ltGtEq;
                }
                else if (behavior === BL_TH_CONDITION) {
                    cond = await queryConditions();
                    if (!cond) {
                        if (origfld === BL_FLUSH)
                            continue chooseField;
                        return false;
                    }
                    const names = conditionBitmaskToString(cond);
                    colorqry = `Choose a color for conditions ${names}:`;
                    attrqry = `Choose attribute for conditions ${names}:`;
                }
                else if (behavior === BL_TH_TEXTMATCH) {
                    const lead = (fld === BL_CAP || fld === BL_ALIGN || fld === BL_HUNGER
                        || fld === BL_TITLE) ? 'Choose' : 'Enter';
                    const query = `${lead} ${field.name} text value to match:`;
                    if (fld === BL_CAP) {
                        const rv = await queryArrayValue(query, ENC_STAT, 1, 6);
                        if (rv < 1)
                            continue chooseBehavior;
                        rule.rel = TXT_VALUE;
                        rule.textmatch = ENC_STAT[rv] ?? '';
                    }
                    else if (fld === BL_ALIGN) {
                        const rv = await queryArrayValue(query, ALIGN_TEXTS, 0, 3);
                        if (rv < 0)
                            continue chooseBehavior;
                        rule.rel = TXT_VALUE;
                        rule.textmatch = ALIGN_TEXTS[rv] ?? '';
                    }
                    else if (fld === BL_HUNGER) {
                        const rv = await queryArrayValue(query, HUNGER_TEXTS, 0, 7);
                        if (rv < 0)
                            continue chooseBehavior;
                        rule.rel = TXT_VALUE;
                        rule.textmatch = HUNGER_TEXTS[rv] ?? '';
                    }
                    else if (fld === BL_TITLE) {
                        const rows = titleTextMatchRows();
                        const rv = await queryArrayValue(query, rows, 0, rows.length);
                        if (rv >= 0) {
                            rule.rel = TXT_VALUE;
                            rule.textmatch = rows[rv] ?? '';
                        }
                        if (rv < 0)
                            continue chooseBehavior;
                    }
                    else {
                        const answer = await getLine(query, printable);
                        if (answer === null || answer === '')
                            continue chooseBehavior;
                        // struct hilite_s.textmatch[MAXVALWIDTH]
                        if (new TextEncoder().encode(answer).length >= 80)
                            return false;
                        rule.rel = TXT_VALUE;
                        rule.textmatch = answer;
                    }
                    colorqry = `Choose a color for when ${field.name} is '${rule.textmatch}':`;
                    attrqry = `Choose attribute for when ${field.name} is '${rule.textmatch}':`;
                }
                else if (behavior === BL_TH_ALWAYS_HILITE) {
                    colorqry = `Choose a color to always hilite ${field.name}:`;
                    attrqry = `Choose attribute to always hilite ${field.name}:`;
                }
                chooseColor: for (;;) {
                    const clr = await queryColorMenu(colorqry, NO_COLOR);
                    if (clr === null) {
                        if (behavior !== BL_TH_ALWAYS_HILITE)
                            continue chooseValue;
                        continue chooseBehavior;
                    }
                    // "Choose" prompts allow combining attributes; the
                    // empty criticalhp prompt is a plain PICK_ONE.
                    const atr = behavior === BL_TH_CRITICALHP
                        ? await queryAttributeMenu(attrqry, 0)
                        : await queryAttributeSet(attrqry);
                    if (atr === null || atr === -1)
                        continue chooseColor;
                    if (behavior === BL_TH_CONDITION) {
                        const conds = condHilites();
                        if (atr & HL_BOLD)
                            conds[HL_ATTCLR_BOLD] = (conds[HL_ATTCLR_BOLD] ?? 0) | cond;
                        if (atr & HL_DIM)
                            conds[HL_ATTCLR_DIM] = (conds[HL_ATTCLR_DIM] ?? 0) | cond;
                        if (atr & HL_ITALIC)
                            conds[HL_ATTCLR_ITALIC] = (conds[HL_ATTCLR_ITALIC] ?? 0) | cond;
                        if (atr & HL_ULINE)
                            conds[HL_ATTCLR_ULINE] = (conds[HL_ATTCLR_ULINE] ?? 0) | cond;
                        if (atr & HL_BLINK)
                            conds[HL_ATTCLR_BLINK] = (conds[HL_ATTCLR_BLINK] ?? 0) | cond;
                        if (atr & HL_INVERSE)
                            conds[HL_ATTCLR_INVERSE] = (conds[HL_ATTCLR_INVERSE] ?? 0) | cond;
                        if (atr === HL_NONE) {
                            conds[HL_ATTCLR_BOLD] = (conds[HL_ATTCLR_BOLD] ?? 0) & ~cond;
                            conds[HL_ATTCLR_DIM] = (conds[HL_ATTCLR_DIM] ?? 0) & ~cond;
                            conds[HL_ATTCLR_ITALIC] = (conds[HL_ATTCLR_ITALIC] ?? 0) & ~cond;
                            conds[HL_ATTCLR_ULINE] = (conds[HL_ATTCLR_ULINE] ?? 0) & ~cond;
                            conds[HL_ATTCLR_BLINK] = (conds[HL_ATTCLR_BLINK] ?? 0) & ~cond;
                            conds[HL_ATTCLR_INVERSE] = (conds[HL_ATTCLR_INVERSE] ?? 0) & ~cond;
                        }
                        conds[clr] = (conds[clr] ?? 0) | cond;
                        const clrbuf = colorName(clr).replace(/ /g, '-')
                            + (hlAttrToAttrName(atr) !== null ? `&${hlAttrToAttrName(atr)}` : '');
                        await pline(`Added hilite condition/${conditionBitmaskToString(cond)}/${clrbuf}`);
                    }
                    else {
                        rule.coloridx = clr | (atr << 8);
                        rule.set = true;
                        const rules = fieldThresholds()[fld] ?? [];
                        const orSplit = fld === BL_TITLE ? rule.textmatch.indexOf(' or ') : -1;
                        if (orSplit >= 0) {
                            const male = { ...rule, textmatch: rule.textmatch.slice(0, orSplit) };
                            rules.push(male);
                            await pline(`Added hilite ${statusHiliteToString(male)}`);
                            rule.textmatch = rule.textmatch.slice(orSplit + 4);
                        }
                        rules.push(rule);
                        await pline(`Added hilite ${statusHiliteToString(rule)}`);
                    }
                    resetStatusHilites();
                    return true;
                }
            }
        }
    }
}
// botl.c status_hilite_menu_add() BL_TITLE branch: the role's nine ranks,
// female variants first for a female hero, then the polymorph fallback.
function titleTextMatchRows() {
    const rows = [];
    const female = game.flags.female === true;
    for (const rank of game.urole?.title ?? []) {
        const male = `"${rank.m}"`;
        const femaleExists = rank.f !== rank.m;
        const femaleText = `"${rank.f}"`;
        const both = `"${female ? rank.f : rank.m}" or "${female ? rank.m : rank.f}"`;
        if (female) {
            if (femaleExists)
                rows.push(femaleText);
            rows.push(male);
            if (femaleExists)
                rows.push(both);
        }
        else {
            rows.push(male);
            if (femaleExists)
                rows.push(femaleText);
            if (femaleExists)
                rows.push(both);
        }
    }
    rows.push('"none of the above (polymorphed)"');
    return rows;
}
// botl.c status_hilite_remove().
function statusHiliteRemove(id) {
    const line = hiliteStrs.find(entry => entry.id === id);
    if (!line)
        return false;
    if (line.fld === BL_CONDITION) {
        const conds = condHilites();
        for (let i = 0; i < CLR_MAX; i++)
            conds[i] = (conds[i] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_BOLD] = (conds[HL_ATTCLR_BOLD] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_DIM] = (conds[HL_ATTCLR_DIM] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_ITALIC] = (conds[HL_ATTCLR_ITALIC] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_ULINE] = (conds[HL_ATTCLR_ULINE] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_BLINK] = (conds[HL_ATTCLR_BLINK] ?? 0) & ~line.mask;
        conds[HL_ATTCLR_INVERSE] = (conds[HL_ATTCLR_INVERSE] ?? 0) & ~line.mask;
        return true;
    }
    const rules = fieldThresholds()[line.fld] ?? [];
    const index = line.rule === null ? -1 : rules.indexOf(line.rule);
    if (index < 0)
        return false;
    rules.splice(index, 1);
    if (line.rule)
        game.nhDisplay?.statusHighlights.removeRule(line.rule);
    return true;
}
// botl.c status_hilite_menu_fld().
async function statusHiliteMenuFld(fld) {
    const field = STATUS_FIELDS[fld];
    if (!field)
        return false;
    let count = linestrCountField(fld);
    if (!count) {
        if (await statusHiliteMenuAdd(fld)) {
            linestrDone();
            linestrGather();
            count = linestrCountField(fld);
        }
        else {
            return false;
        }
    }
    const items = [];
    for (const line of hiliteStrs)
        if (line.fld === fld)
            items.push({ value: line.id, text: line.str });
    // A stored rule the gather step skips (a condition rule with "no color"
    // and attribute none) leaves the list empty; native says so.
    if (!count)
        items.push({ selectable: false, text: `No current hilites for ${field.name}` });
    items.push({ selectable: false, text: '' });
    if (count)
        items.push({ key: 'X', value: -1, text: 'Remove selected hilites' });
    // SCORE_ON_BOTL is not compiled in, so 'score' never offers new rules.
    if (fld !== BL_SCORE)
        items.push({ key: 'Z', value: -2, text: 'Add new hilites' });
    const picks = await showMultiSelectWindow({
        title: `Current ${field.name} hilites:`, omitHeadings: true, signalEscape: true,
        pageLocalKeys: true,
        sections: [{ items }],
    });
    let acted = false;
    if (picks && picks.length) {
        const remove = picks.includes(-1);
        const add = picks.includes(-2);
        if (remove) {
            for (const id of picks)
                if (id > 0 && statusHiliteRemove(id))
                    acted = true;
        }
        if (add) {
            while (await statusHiliteMenuAdd(fld))
                acted = true;
        }
    }
    return acted;
}
// botl.c status_hilites_viewall(): every rule in config format.
async function statusHilitesViewAll() {
    const lines = hiliteStrs.map(line => `OPTIONS=hilite_status: ${line.str}`);
    await showTextWindow(lines);
}
// botl.c status_hilite_menu(): the "status highlight rules" handler.
export async function statusHiliteMenu() {
    let countAll = 0;
    for (;;) {
        linestrGather();
        countAll = linestrCountField(BL_FLUSH);
        const items = [];
        if (countAll) {
            items.push({ value: 0, text: 'View all hilites in config format' });
            items.push({ selectable: false, text: '' });
        }
        for (let i = 0; i < MAXBLSTATS; i++) {
            const row = STATUS_FIELDS[i];
            if (!row)
                continue;
            const count = linestrCountField(row.fld);
            // SCORE_ON_BOTL is not compiled in: hide 'score' without rules.
            if (row.fld === BL_SCORE && !count)
                continue;
            let text = row.name.padEnd(18);
            if (count)
                text += ` (${count} defined)`;
            items.push({ value: row.fld + 1, text });
        }
        const picks = await showMultiSelectWindow({
            title: 'Status hilites:', omitHeadings: true, pickOne: true, signalEscape: true,
            pageLocalKeys: true,
            sections: [{ items }],
        });
        let redo = false;
        if (picks && picks[0] !== undefined) {
            const fld = picks[0] - 1;
            if (fld < 0)
                await statusHilitesViewAll();
            else if (await statusHiliteMenuFld(fld))
                resetStatusHilites();
            redo = true;
        }
        // The listing survives a field edit, including deleted rules. C
        // uses that listing's count before destroying it, even for fuzzer exit.
        countAll = linestrCountField(BL_FLUSH);
        linestrDone();
        // The native fuzzer gets one attempt at the nested field menus.
        if (!redo || game.iflags.debug_fuzzer)
            break;
    }
    // statushilites doubles as the on-switch for highlighting: enabling a
    // default duration when rules now exist.
    if (countAll > 0 && !game.iflags.hiliteDelta)
        game.iflags.hiliteDelta = 3;
    return true;
}
// ── botl.c parse_status_hl1()/parse_status_hl2()/parse_condition() ──
const THRESHOLD_VALUE = 'hilite_status threshold ';
const IS_OUT_OF_RANGE = ' is out of range';
// wintype.h ATR_* selector values as carried by ATTRIBUTE_NAMES; these
// differ from the port's terminal attribute bits in terminal.js.
const WINTYPE_ATR_NONE = 0, WINTYPE_ATR_BOLD = 1, WINTYPE_ATR_DIM = 2, WINTYPE_ATR_ITALIC = 3, WINTYPE_ATR_ULINE = 4, WINTYPE_ATR_BLINK = 5, WINTYPE_ATR_INVERSE = 7;
// botl.c fieldids_alias[].
const FIELD_ALIASES = [
    ['characteristics', BL_CHARACTERISTICS],
    ['encumbrance', BL_CAP],
    ['experience-points', BL_EXP],
    ['dx', BL_DX], ['co', BL_CO], ['con', BL_CO],
    ['points', BL_SCORE],
    ['cap', BL_CAP],
    ['pw', BL_ENE], ['pw-max', BL_ENEMAX],
    ['xl', BL_XP], ['xplvl', BL_XP],
    ['ac', BL_AC],
    ['hit-dice', BL_HD],
    ['turns', BL_TIME],
    ['hp', BL_HP], ['hp-max', BL_HPMAX],
    ['dgn', BL_LEVELDESC],
    ['xp', BL_EXP], ['exp', BL_EXP],
    ['flags', BL_CONDITION],
];
// botl.c fldname_to_bl_indx().
function fieldNameToIndex(name) {
    const table = statusFieldTable();
    if (!name)
        return BL_FLUSH;
    let fld = 0;
    let matches = 0;
    for (const field of table)
        if (fuzzyMatch(field.name, name)) {
            fld = field.fld;
            matches++;
        }
    if (!matches) {
        for (const [alias, value] of FIELD_ALIASES)
            if (fuzzyMatch(alias, name)) {
                fld = value;
                matches++;
            }
    }
    if (!matches) {
        for (const field of table)
            if (field.name.toLowerCase().startsWith(name.toLowerCase())) {
                fld = field.fld;
                matches++;
            }
    }
    return matches === 1 ? fld : BL_FLUSH;
}
// botl.c is_ltgt_percentnumber(): "[<>]?=?[-+]?[0-9]+%?"
function isLtgtPercentNumber(text) {
    return /^[<>]?=?[+-]?\d+%?$/.test(text);
}
// botl.c has_ltgt_percentnumber().
function hasLtgtPercentNumber(text) {
    return /^[<>=\-+0-9%]*$/.test(text);
}
// botl.c splitsubfields(): split on '+' or '&'.
function splitSubfields(text) {
    const pieces = text.split(/[+&]/);
    // C rejects fifteen separators, even when the final piece is empty.
    if (pieces.length >= 16)
        return [];
    if (pieces.length > 1 && pieces.at(-1) === '')
        pieces.pop();
    return pieces;
}
// C botl.c:is_fld_arrayvalues().
function isFieldArrayValue(text, values, minimum, maximum) {
    for (let index = minimum; index < maximum; index++) {
        const entry = values[index];
        if (entry !== undefined && entry !== null && entry.toLowerCase() === text.toLowerCase())
            return index;
    }
    return null;
}
// botl.c s_to_anything(): C's atoi()/atol() semantics stop at the first
// non-digit, so a leading number is read and anything after it ignored.
function cAtoi(text) {
    const match = /^[+-]?\d+/.exec(text.trim());
    return match ? Number.parseInt(match[0], 10) : 0;
}
function stripChars(text, remove) {
    return [...text].filter(character => !remove.includes(character)).join('');
}
/** botl.c parse_status_hl1(): split one config entry into rules. */
export function parseStatusHl1(option, addError, fromConfigFile = false, operations = []) {
    const MAX_THRESH = 21;
    const fields = Array.from({ length: MAX_THRESH }, () => '');
    let badOption = false;
    let fieldCount = 0;
    let count = 0;
    let position = 0;
    while (position < option.length && fieldCount < MAX_THRESH && count < 128 - 2) {
        const character = option[position]?.toLowerCase() ?? '';
        if (character === ' ') {
            if (fieldCount >= 1) {
                if (fieldCount === 1 && fields[0] === 'title') {
                    // spaces are allowed inside a title match
                    fields[fieldCount] += character;
                    count++;
                    position++;
                    continue;
                }
                if (!parseStatusHl2(fields, addError, fromConfigFile, operations)) {
                    badOption = true;
                    break;
                }
            }
            fields.fill('');
            fieldCount = 0;
            count = 0;
        }
        else if (character === '/') {
            fieldCount++;
            count = 0;
        }
        else {
            fields[fieldCount] += character;
            count++;
        }
        position++;
    }
    if (fieldCount >= 1 && !badOption) {
        if (!parseStatusHl2(fields, addError, fromConfigFile, operations))
            badOption = true;
    }
    if (badOption)
        return false;
    // make sure highlighting is On; use short duration for temp highlights
    operations.push({ enableDelta: true });
    return true;
}
/** botl.c parse_status_hl2(): parse one field/behavior/color rule. */
export function parseStatusHl2(fields, addError, fromConfigFile = false, operations = []) {
    void fromConfigFile;
    let successes = 0;
    let sidx = 0;
    const fld = fieldNameToIndex(fields[sidx] ?? '');
    if (fld === BL_CHARACTERISTICS) {
        // recursively set each of strength, dexterity, constitution, &c
        const table = statusFieldTable();
        for (const field of table) {
            if (field.fld >= BL_STR && field.fld <= BL_CH) {
                const copy = [...fields];
                copy[sidx] = field.name;
                if (!parseStatusHl2(copy, addError, false, operations))
                    return false;
            }
        }
        return true;
    }
    if (fld === BL_FLUSH) {
        addError(`Unknown status field '${fields[sidx] ?? ''}'`);
        return false;
    }
    if (fld === BL_CONDITION)
        return parseCondition(fields, sidx, addError, operations);
    sidx++;
    while ((fields[sidx] ?? '') !== '') {
        let txt = null;
        let percent = false, numeric = false, always = false;
        let down = false, up = false, changed = false;
        let criticalhp = false;
        let grt = false, gte = false, eq = false, le = false, lt = false;
        let txtval = false;
        const field = statusFieldTable().find(entry => entry.fld === fld);
        const anytype = field?.anytype ?? 'int';
        const idxmax = field?.idxmax ?? -1;
        const rule = {
            fld, set: false, anytype, value: 0,
            behavior: BL_TH_NONE, textmatch: '', rel: NO_LTEQGT, coloridx: 0,
        };
        let value = 0;
        let relation = NO_LTEQGT;
        const token = fields[sidx] ?? '';
        if ((fields[sidx + 1] ?? '') === '' || token.toLowerCase() === 'always') {
            // "field/always/color" OR "field/color"
            always = true;
            if ((fields[sidx + 1] ?? '') === '')
                sidx--;
        }
        else if (token.toLowerCase() === 'up' || token.toLowerCase() === 'down') {
            if (anytype === 'str') {
                // ordered string comparison is pointless; treat as 'changed'
            }
            else if (token.toLowerCase() === 'down')
                down = true;
            else
                up = true;
            changed = true;
        }
        else if (fld === BL_CAP
            && isFieldArrayValue(token, encStatNames(), 1, 6) !== null) {
            txt = encStatNames()[isFieldArrayValue(token, encStatNames(), 1, 6) ?? 0] ?? null;
            txtval = true;
        }
        else if (fld === BL_ALIGN
            && isFieldArrayValue(token, alignTexts(), 0, 3) !== null) {
            txt = alignTexts()[isFieldArrayValue(token, alignTexts(), 0, 3) ?? 0] ?? null;
            txtval = true;
        }
        else if (fld === BL_HUNGER
            && isFieldArrayValue(token, hungerTexts(), 0, 7) !== null) {
            txt = hungerTexts()[isFieldArrayValue(token, hungerTexts(), 0, 7) ?? 0] ?? null;
            txtval = true;
        }
        else if (token.toLowerCase() === 'changed') {
            changed = true;
        }
        else if (fld === BL_HP && token.toLowerCase() === 'criticalhp') {
            criticalhp = true;
        }
        else if (isLtgtPercentNumber(token)) {
            percent = token.includes('%');
            if (token.startsWith('<')) {
                if (token[1] === '=')
                    le = true;
                else
                    lt = true;
            }
            else if (token.startsWith('>')) {
                if (token[1] === '=')
                    gte = true;
                else
                    grt = true;
            }
            const digits = stripChars(token, '%<>=+');
            numeric = true;
            value = cAtoi(digits);
            const op = grt ? '>' : gte ? '>=' : lt ? '<' : le ? '<=' : '=';
            const minimum = fld === BL_AC ? -128 : grt ? -1 : lt ? 1 : 0;
            const maximum = percent ? (lt ? 101 : 100) : LARGEST_INT;
            if ((anytype === 'int' || percent) && (value < minimum || value > maximum)) {
                addError(`${THRESHOLD_VALUE}'${op}${value}${percent ? '%' : ''}'${IS_OUT_OF_RANGE}`);
                return false;
            }
            if (anytype === 'long'
                && value < (grt ? -1 : lt ? 1 : 0)) {
                addError(`${THRESHOLD_VALUE}'${op}${value}'${IS_OUT_OF_RANGE}`);
                return false;
            }
        }
        else if (anytype === 'str') {
            txt = token;
            txtval = true;
        }
        else {
            addError(hasLtgtPercentNumber(token)
                ? `Wrong format '${token}', expected a threshold number or percent`
                : `Unknown behavior '${token}'`);
            return false;
        }
        // relationships {LT_VALUE, LE_VALUE, EQ_VALUE, GE_VALUE, GT_VALUE}
        if (grt || up)
            relation = GT_VALUE;
        else if (lt || down)
            relation = LT_VALUE;
        else if (gte)
            relation = GE_VALUE;
        else if (le)
            relation = LE_VALUE;
        else if (eq || percent || numeric || changed)
            relation = EQ_VALUE;
        else if (txtval)
            relation = TXT_VALUE;
        else
            relation = LT_VALUE;
        if (anytype === 'str' && (percent || numeric)) {
            const name = statusFieldTable().find(entry => entry.fld === fld)?.name ?? '';
            addError(`Field '${name}' does not support numeric values`);
            return false;
        }
        if (percent) {
            if (idxmax < 0) {
                const name = statusFieldTable().find(entry => entry.fld === fld)?.name ?? '';
                addError(`Cannot use percent with '${name}'`);
                return false;
            }
            // The pinned C compares these boundary values to the relation
            // constants by mistake, rejecting both -1% and 101%.
            if (value < -1 || value === -1
                || (value === 0 && relation === LT_VALUE)
                || (value === 100 && relation === GT_VALUE)
                || value === 101 || value > 101) {
                const prefix = relation === LT_VALUE ? '<'
                    : relation === LE_VALUE ? '<='
                        : relation === GT_VALUE ? '>'
                            : relation === GE_VALUE ? '>=' : '=';
                addError(`hilite_status: invalid percentage value '${prefix}${value}%'`);
                return false;
            }
        }
        // actions
        sidx++;
        const how = fields[sidx] ?? '';
        if (how === '') {
            if (!successes)
                return false;
        }
        let coloridx = -1;
        let dispAttrib = 0;
        const subfields = splitSubfields(how);
        if (subfields.length < 1)
            return false;
        for (const subfield of subfields) {
            const attribute = matchAttributeName(subfield, null);
            if (attribute === WINTYPE_ATR_BOLD)
                dispAttrib |= HL_BOLD;
            else if (attribute === WINTYPE_ATR_DIM)
                dispAttrib |= HL_DIM;
            else if (attribute === WINTYPE_ATR_ITALIC)
                dispAttrib |= HL_ITALIC;
            else if (attribute === WINTYPE_ATR_ULINE)
                dispAttrib |= HL_ULINE;
            else if (attribute === WINTYPE_ATR_BLINK)
                dispAttrib |= HL_BLINK;
            else if (attribute === WINTYPE_ATR_INVERSE)
                dispAttrib |= HL_INVERSE;
            else if (attribute === WINTYPE_ATR_NONE)
                dispAttrib = HL_NONE;
            else {
                const color = matchColorName(subfield, addError);
                if (color >= CLR_MAX || coloridx !== -1) {
                    addError(`bad color '${color} ${coloridx}'`);
                    return false;
                }
                coloridx = color;
            }
        }
        if (coloridx === -1)
            coloridx = NO_COLOR;
        rule.coloridx = coloridx | (dispAttrib << 8);
        if (always)
            rule.behavior = BL_TH_ALWAYS_HILITE;
        else if (percent)
            rule.behavior = BL_TH_VAL_PERCENTAGE;
        else if (changed)
            rule.behavior = BL_TH_UPDOWN;
        else if (numeric)
            rule.behavior = BL_TH_VAL_ABSOLUTE;
        else if (txtval)
            rule.behavior = BL_TH_TEXTMATCH;
        else if (value !== 0)
            rule.behavior = BL_TH_VAL_ABSOLUTE;
        else if (criticalhp)
            rule.behavior = BL_TH_CRITICALHP;
        else
            rule.behavior = BL_TH_NONE;
        rule.rel = relation;
        rule.value = value;
        if (rule.behavior === BL_TH_TEXTMATCH && txt !== null)
            rule.textmatch = txt.trim();
        rule.set = true;
        operations.push({ threshold: { fld, rule } });
        successes++;
        sidx++;
    }
    return successes > 0;
}
/** botl.c parse_condition(). */
function parseCondition(fields, start, addError, operations) {
    let result = false;
    let coloridx = NO_COLOR;
    let sidx = start;
    sidx++;
    if ((fields[sidx] ?? '') === '') {
        addError('Missing condition(s)');
        return false;
    }
    while ((fields[sidx] ?? '') !== '') {
        const bits = str2ConditionBitmask(fields[sidx] ?? '', addError);
        if (!bits)
            return false;
        sidx++;
        const how = fields[sidx] ?? '';
        if (how === '') {
            addError('Missing color+attribute');
            return false;
        }
        const subfields = splitSubfields(how);
        const setBits = (index) => {
            operations.push({ condition: { index, bits, clear: false } });
        };
        const clearBits = (index) => {
            operations.push({ condition: { index, bits, clear: true } });
        };
        for (const subfield of subfields) {
            const attribute = matchAttributeName(subfield, null);
            if (attribute === WINTYPE_ATR_BOLD)
                setBits(CLR_MAX + 2);
            else if (attribute === WINTYPE_ATR_DIM)
                setBits(CLR_MAX + 3);
            else if (attribute === WINTYPE_ATR_ITALIC)
                setBits(CLR_MAX + 4);
            else if (attribute === WINTYPE_ATR_ULINE)
                setBits(CLR_MAX + 5);
            else if (attribute === WINTYPE_ATR_BLINK)
                setBits(CLR_MAX + 6);
            else if (attribute === WINTYPE_ATR_INVERSE)
                setBits(CLR_MAX + 7);
            else if (attribute === WINTYPE_ATR_NONE) {
                for (let index = CLR_MAX + 2; index < CLR_MAX + 8; index++)
                    clearBits(index);
            }
            else {
                const color = matchColorName(subfield, addError);
                if (color >= CLR_MAX) {
                    addError(`bad color ${color}`);
                    return false;
                }
                coloridx = color;
            }
        }
        operations.push({ condition: { index: coloridx, bits, clear: false } });
        result = true;
        sidx++;
    }
    return result;
}
// botl.c str2conditionbitmask().
function str2ConditionBitmask(text, addError) {
    let mask = 0;
    const subfields = splitSubfields(text);
    if (subfields.length < 1)
        return 0;
    for (const subfield of subfields) {
        const bits = matchConditionBitmask(subfield);
        if (!bits) {
            addError(`Unknown condition '${subfield}'`);
            return 0;
        }
        mask |= bits;
    }
    return mask;
}
// botl.c match_str2conditionbitmask().
function matchConditionBitmask(text) {
    let mask = 0;
    let matches = 0;
    if (!text)
        return 0;
    for (const [bit, name] of conditionEntries())
        if (fuzzyMatch(name, text)) {
            mask |= bit;
            matches++;
        }
    if (!matches) {
        for (const [alias, bits] of conditionAliasEntries())
            if (fuzzyMatch(alias, text)) {
                mask |= bits;
                matches++;
            }
    }
    if (!matches) {
        for (const [alias, bits] of conditionAliasEntries())
            if (alias.toLowerCase().startsWith(text.toLowerCase())) {
                mask |= bits;
                matches++;
            }
    }
    return mask;
}
// Apply every successful installation, including those before a parse error.
// Each config entry is applied immediately so later options see its changes.
export function replayStatusHiliteOperations(operations, iflags) {
    for (const operation of operations) {
        if (operation.threshold) {
            const thresholds = iflags.statusThresholds
                ??= Array.from({ length: MAXBLSTATS }, () => []);
            thresholds[operation.threshold.fld]?.push(operation.threshold.rule);
        }
        if (operation.condition) {
            const conditions = iflags.condHilites
                ??= new Array(BL_ATTCLR_MAX).fill(0);
            const { index, bits, clear } = operation.condition;
            conditions[index] = clear
                ? (conditions[index] ?? 0) & ~bits
                : (conditions[index] ?? 0) | bits;
        }
        if (operation.enableDelta && !iflags.hiliteDelta)
            iflags.hiliteDelta = 3;
    }
}
//# sourceMappingURL=botl.js.map