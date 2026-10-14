// C wizcmds.c:wiz_migrate_mons()/list_migrating_mons(). A negative count
// moves existing actors; a positive count creates random actors to migrate.
import { COLNO, Is_botlevel, Is_stronghold, MGIVENNAME, MIGR_EXACT_XY, MM_NOMSG, ROWNO } from './const.js';
import { plineWithContinuation } from './display.js';
import { levelAtDepth } from './dungeon.js';
import type { DungeonLocation } from './dungeon_types.js';
import { game, requirePlayingGame } from './gstate.js';
import { depth } from './hacklib.js';
import { makemonAt, rndmonstAdj } from './mklev.js';
import { monsterTypeName } from './monster_data.js';
import { migrateMonsterToLevel } from './monster_migration.js';
import type { Monster } from './monster_types.js';
import { getLine, promptChoice } from './query.js';
import { showTextWindow } from './windows.js';

export async function wizMigrateMonsters(): Promise<void> {
    requirePlayingGame(game);
    const destination = nextMigrationLevel();
    await listMigratingMonsters(destination);
    game.context.move = 0;
    if (!(destination.dnum || destination.dlevel)) {
        await plineWithContinuation("Can't get there from here.");
        return;
    }
    const input = await getLine('How many random monsters to migrate to next level? [0]');
    if (!input) return;
    const count = Number.parseInt(input, 10) || 0;
    const limit = Math.min(Math.abs(count), (COLNO - 1) * ROWNO);
    for (let index = 0; index < limit; index++) {
        const monster = count < 0 ? game.level.monsters[0]
            : await makemonAt(rndmonstAdj(), 0, 0, MM_NOMSG);
        if (monster) await migrateMonsterToLevel(monster, destination);
    }
}

function nextMigrationLevel(): DungeonLocation {
    requirePlayingGame(game);
    if (Is_stronghold(game.u.uz)) {
        if (!game.valley_level) throw new Error('The Castle has no Valley destination');
        return game.valley_level;
    }
    return Is_botlevel(game.u.uz) ? { dnum: 0, dlevel: 0 }
        : levelAtDepth(depth(game.u.uz) + 1);
}

type MigrationGroup = 'c' | 'n' | 'o';

function migrationGroup(monster: Monster, next: DungeonLocation): MigrationGroup {
    const destination = monster.migrationDestination;
    if (destination?.dnum === game.u.uz?.dnum && destination?.dlevel === game.u.uz?.dlevel) return 'c';
    if (destination?.dnum === next.dnum && destination?.dlevel === next.dlevel) return 'n';
    return 'o';
}

async function listMigratingMonsters(next: DungeonLocation): Promise<void> {
    const monsters = game._migratingMonsters ?? [];
    if (!monsters.length) {
        await plineWithContinuation('No monsters currently migrating.');
        return;
    }
    const counts = { c: 0, n: 0, o: 0 };
    for (const monster of monsters) counts[migrationGroup(monster, next)]++;
    await plineWithContinuation(`${counts.c} mon${counts.c === 1 ? '' : 's'} pending for current level, ${counts.n} for next level, ${counts.o} for others.`);
    const visible = `${counts.c ? 'c' : ''}${counts.n ? 'n' : ''}${counts.o ? 'o' : ''}a q`;
    const choice = await promptChoice('List which?', ['c', 'n', 'o', 'a', 'q'], 'q', { visibleChoices: visible });
    if (choice === 'q') return;
    const selected = monsters.filter(monster => choice === 'a' || migrationGroup(monster, next) === choice);
    if (!selected.length) {
        await plineWithContinuation('None.');
        return;
    }
    selected.sort((a, b) => (a.migrationDestination?.dnum ?? 0) - (b.migrationDestination?.dnum ?? 0)
        || (a.migrationDestination?.dlevel ?? 0) - (b.migrationDestination?.dlevel ?? 0)
        || a.m_id - b.m_id);
    const title = choice === 'a' ? 'All migrating monsters:'
        : `Monster${selected.length === 1 ? '' : 's'} migrating to ${choice === 'c' ? 'current level'
            : choice === 'n' ? 'next level' : "'other' levels"}:`;
    await showTextWindow([title, '', ...selected.map(monster => migratingMonsterLine(monster, choice === 'a' || choice === 'o'))]);
}

function migratingMonsterLine(monster: Monster, showDestination: boolean): string {
    let text = `  ${monster.mtame ? 'tame ' : monster.mpeaceful ? 'peaceful ' : ''}${monsterTypeName(monster.mnum, !!monster.female)}`;
    if (monster.cham !== undefined && monster.cham >= 0)
        text += `{${monsterTypeName(monster.cham, !!monster.female)}}`;
    const name = MGIVENNAME(monster);
    if (name) text += ` named ${name}`;
    if (showDestination) {
        const destination = monster.migrationDestination;
        if (!destination) throw new Error(`Migrating monster ${monster.m_id} has no destination`);
        text += ` to ${destination.dnum}:${destination.dlevel}`;
    }
    if (monster.migrationMode === MIGR_EXACT_XY && monster.migrationSource)
        text += ` at <${monster.migrationSource.x},${monster.migrationSource.y}>`;
    return text;
}
