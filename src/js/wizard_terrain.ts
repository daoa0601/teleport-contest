// C wizcmds.c:wiz_map_levltyp()/wiz_levltyp_legend(), cmd.c:levltyp[].
import {
    COLNO, ROWNO, STONE, Invocation_lev, In_endgame, In_mines, In_quest,
    In_sokoban, In_V_tower, Is_knox_level, Is_rogue_level,
} from './const.js';
import { levelIsWizardTower, sameDungeonLevel, specialDisplayName } from './dungeon.js';
import { displayMessageWindow, docrt, flush_screen } from './display.js';
import { game, requireGameLevel } from './gstate.js';
import { mayDig } from './hero_digging.js';
import { showTextWindow } from './windows.js';

const TERRAIN_NAMES = [
    'stone', 'vertical wall', 'horizontal wall', 'top-left corner wall',
    'top-right corner wall', 'bottom-left corner wall', 'bottom-right corner wall',
    'cross wall', 'tee-up wall', 'tee-down wall', 'tee-left wall', 'tee-right wall',
    'drawbridge wall', 'tree', 'secret door', 'secret corridor', 'pool', 'moat',
    'water', 'drawbridge up', 'lava pool', 'lava wall', 'iron bars', 'door',
    'corridor', 'room', 'stairs', 'ladder', 'fountain', 'throne', 'sink', 'grave',
    'altar', 'ice', 'drawbridge down', 'air', 'cloud', 'unreachable/undiggable',
] as const;

export async function showTerrainCodes(): Promise<void> {
    const level = requireGameLevel();
    // tty leaves row zero blank so map rows line up with the normal display.
    const lines = [''];
    for (let y = 0; y < ROWNO; y++) {
        let row = '';
        for (let x = 1; x < COLNO; x++) {
            const terrain = level.requireAt(x, y).typ;
            row += terrain === STONE && !mayDig(x, y) ? '*' : terrainCode(terrain);
        }
        if (level.requireAt(0, y).typ !== STONE || mayDig(0, y)) row += '!';
        lines.push(row);
    }
    lines.push(terrainLevelDescription().slice(0, COLNO - 1));
    await showTerrainText(lines);
}

export async function showTerrainCodeLegend(): Promise<void> {
    const lines = ['#terrain encodings:', ''];
    const half = TERRAIN_NAMES.length / 2;
    const entry = (index: number): string => {
        const name = TERRAIN_NAMES[index];
        if (name === undefined) throw new RangeError(`Terrain legend has no entry ${index}`);
        const code = name.startsWith('unreachable') ? '*' : terrainCode(index);
        return ` ${code} - ${name.padEnd(28)}`;
    };
    for (let index = 0; index < half; index++)
        lines.push(entry(index) + entry(index + half));
    await showTerrainText(lines);
}

async function showTerrainText(lines: readonly string[]): Promise<void> {
    await displayMessageWindow();
    await showTextWindow(lines);
    await docrt();
    await flush_screen(1);
}

function terrainCode(terrain: number): string {
    return String.fromCharCode(terrain < 10 ? 48 + terrain
        : terrain < 36 ? 97 + terrain - 10 : 65 + terrain - 36);
}

function terrainLevelDescription(): string {
    const flags = requireGameLevel().flags;
    const here = game.u.uz;
    if (!here) throw new Error('Terrain inspection requires the current dungeon level');
    const parts = [`D:${here.dnum},L:${here.dlevel}`];
    const special = [...(game.specialLevels?.entries() ?? [])]
        .find(([, location]) => sameDungeonLevel(here, location));
    if (special) {
        parts.push(`"${specialDisplayName(special[0])}"`);
        // The pinned dungeon.lua sets only town and roguelike on special levels.
        if (special[1].flags.town) parts.push('town');
        if (Is_rogue_level(here)) parts.push('roguelike');
    }
    if (flags.nfountains) parts.push(`{:${flags.nfountains}`);
    if (flags.nsinks) parts.push(`#:${flags.nsinks}`);
    const features: ReadonlyArray<readonly [boolean | undefined, string]> = [
        [flags.has_vault, 'vault'], [flags.has_shop, 'shop'],
        [flags.has_temple, 'temple'], [flags.has_court, 'throne'],
        [flags.has_zoo, 'zoo'], [flags.has_morgue, 'morgue'],
        [flags.has_barracks, 'barracks'], [flags.has_beehive, 'hive'],
        [flags.has_swamp, 'swamp'], [flags.noteleport, 'noTport'],
        [flags.hardfloor, 'noDig'], [flags.nommap, 'noMMap'],
        [!flags.hero_memory, 'noMem'], [flags.shortsighted, 'shortsight'],
        [flags.graveyard, 'graveyard'], [flags.is_maze_lev, 'maze'],
        [flags.is_cavernous_lev, 'cave'], [flags.arboreal, 'tree'],
        [flags.sokoban_rules, 'sokoban-rules'], [Invocation_lev(here), 'invoke'],
        [levelIsWizardTower(), 'tower'],
    ];
    for (const [enabled, label] of features) if (enabled) parts.push(label);
    parts.push(terrainBranchName());
    return parts.join(' ');
}

function terrainBranchName(): string {
    const here = game.u.uz;
    if (!here) throw new Error('Terrain inspection requires the current dungeon level');
    if (here.dnum === 0) return 'dungeon';
    if (In_mines(here)) return 'mines';
    if (In_sokoban(here)) return 'sokoban';
    if (In_quest(here)) return 'quest';
    if (Is_knox_level(here)) return 'ludios';
    if (here.dnum === 1) return 'gehennom';
    if (In_V_tower(here)) return 'vlad';
    if (In_endgame(here)) return 'endgame';
    return (game.dungeons[here.dnum]?.dname || 'unknown').replace(/^the /i, '');
}
