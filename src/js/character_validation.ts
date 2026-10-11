import type {
    Advancement, Alignment, AlignmentName, AlignmentValue, AttributeValues,
    GenderedName, Race, Role, Spellcasting,
} from './roles.js';
import type { GameFlags } from './flags.js';
import { ismnum } from './const.js';
import {
    arrayOf, boolean, closedFieldsMatch, integer, nullable, oneOf, optional, string,
} from './saved_validation.js';

export function validSavedRole(value: unknown): value is Role {
    return closedFieldsMatch<Role>(value, {
        key: oneOf('archeologist', 'barbarian', 'caveman', 'healer', 'knight',
            'monk', 'priest', 'ranger', 'rogue', 'samurai', 'tourist', 'valkyrie', 'wizard'),
        filecode: string,
        name: validGenderedName,
        mnum: integer,
        title: arrayOf(validGenderedName),
        rank: optional(validGenderedName),
        gods: optional(validGodNames),
        goddessAlignments: optional(arrayOf(oneOf('lawful', 'neutral', 'chaotic'))),
        attrbase: validSavedAttributeValues,
        attrdist: validSavedAttributeValues,
        hpadv: validAdvancement,
        enadv: validAdvancement,
        xlev: integer,
        initrecord: integer,
        petnum: integer,
        intrinsicFast: optional(boolean),
        homebase: optional(string),
        intermediate: optional(string),
        ldrnum: integer,
        guardnum: integer,
        neminum: optional(integer),
        guardianName: optional(string),
        guardianPlural: optional(string),
        artifactName: string,
        enemy1num: optional(nullable(integer)),
        enemy1sym: optional(integer),
        enemy2num: optional(integer),
        enemy2sym: optional(integer),
        greeting: string,
        goodbye: string,
        spellcasting: validSpellcasting,
    });
}

export function validSavedRace(value: unknown): value is Race {
    return closedFieldsMatch<Race>(value, {
        name: oneOf('human', 'elf', 'dwarf', 'gnome', 'orc'),
        noun: string,
        adj: string,
        filecode: string,
        raceIndex: integer,
        selfmask: integer,
        lovemask: integer,
        hatemask: integer,
        mnum: ismnum,
        mummynum: ismnum,
        zombienum: ismnum,
        attrmin: validSavedAttributeValues,
        attrmax: validSavedAttributeValues,
        hpadv: validAdvancement,
        enadv: validAdvancement,
    });
}

export function validSavedAlignment(value: unknown): value is Alignment {
    return closedFieldsMatch<Alignment>(value, {
        name: oneOf('lawful', 'neutral', 'chaotic'),
        value: validSavedAlignmentValue,
    });
}

export function validSavedGameFlags(value: unknown): value is GameFlags {
    return closedFieldsMatch<GameFlags>(value, {
        accessiblemsg: optional(boolean),
        acoustics: optional(boolean),
        armorstatus: optional(boolean),
        autodescribe: optional(boolean),
        autodig: optional(boolean),
        autoopen: optional(boolean),
        pickup: optional(boolean),
        autoquiver: optional(boolean),
        checkpoint: optional(boolean),
        cmdassist: optional(boolean),
        color: optional(boolean),
        confirm: optional(boolean),
        customcolors: optional(boolean),
        customsymbols: optional(boolean),
        dark_room: optional(boolean),
        dropped_nopick: optional(boolean),
        eight_bit_tty: optional(boolean),
        extmenu: optional(boolean),
        fireassist: optional(boolean),
        fixinv: optional(boolean),
        force_invmenu: optional(boolean),
        goldX: optional(boolean),
        help: optional(boolean),
        herecmd_menu: optional(boolean),
        hilite_pet: optional(boolean),
        hilite_pile: optional(boolean),
        hitpointbar: optional(boolean),
        ignintr: optional(boolean),
        implicit_uncursed: optional(boolean),
        lit_corridor: optional(boolean),
        lootabc: optional(boolean),
        mail: optional(boolean),
        mention_decor: optional(boolean),
        mention_map: optional(boolean),
        mention_walls: optional(boolean),
        menu_overlay: optional(boolean),
        menucolors: optional(boolean),
        mon_movement: optional(boolean),
        null: optional(boolean),
        pickup_stolen: optional(boolean),
        pickup_thrown: optional(boolean),
        price_quotes: optional(boolean),
        pushweapon: optional(boolean),
        query_menu: optional(boolean),
        quick_farsight: optional(boolean),
        rest_on_space: optional(boolean),
        safe_pet: optional(boolean),
        safe_wait: optional(boolean),
        showdamage: optional(boolean),
        showexp: optional(boolean),
        showrace: optional(boolean),
        showvers: optional(boolean),
        silent: optional(boolean),
        sortpack: optional(boolean),
        sparkle: optional(boolean),
        spot_monsters: optional(boolean),
        standout: optional(boolean),
        terrainstatus: optional(boolean),
        time: optional(boolean),
        tips: optional(boolean),
        tombstone: optional(boolean),
        travel: optional(boolean),
        use_inverse: optional(boolean),
        verbose: optional(boolean),
        weaponstatus: optional(boolean),
        whatis_menu: optional(boolean),
        whatis_moveskip: optional(boolean),
        beginner: optional(boolean),
        blind: optional(boolean),
        bones: optional(boolean),
        deaf: optional(boolean),
        debug: optional(boolean),
        explore: optional(boolean),
        female: optional(boolean),
        friday13: optional(boolean),
        legacy: optional(boolean),
        made_fruit: optional(boolean),
        nudist: optional(boolean),
        pauper: optional(boolean),
        reroll: optional(boolean),
        safe_dog: optional(boolean),
        tutorial: optional(boolean),
        autounlock: optional((entry): entry is string | number | boolean =>
            string(entry) || integer(entry) || boolean(entry)),
        debug_fuzzer: optional(integer),
        disclose: optional(string),
        end_top: optional(integer),
        end_around: optional(integer),
        end_own: optional(boolean),
        initalign: optional(integer),
        initgend: optional(integer),
        inv_order: optional(arrayOf(integer)),
        menu_style: optional(oneOf(0, 1, 2, 3)),
        moonphase: optional(nullable(integer)),
        paranoia_bits: optional(integer),
        pettype: optional(string),
        pickup_burden: optional((entry): entry is string | number =>
            string(entry) || integer(entry)),
        pickup_types: optional(string),
        pile_limit: optional((entry): entry is string | number =>
            string(entry) || integer(entry)),
        runmode: optional(string),
        sortloot: optional(oneOf('n', 'l', 'f')),
        suppress_alert: optional(string),
    });
}

export function validSavedAttributeValues(value: unknown): value is AttributeValues {
    return arrayOf(integer)(value) && value.length === 6;
}

export function validSavedAlignmentValue(value: unknown): value is AlignmentValue {
    return value === -1 || value === 0 || value === 1;
}

function validGenderedName(value: unknown): value is GenderedName {
    return closedFieldsMatch<GenderedName>(value, { m: string, f: string });
}

function validGodNames(value: unknown): value is Record<AlignmentName, string> {
    return closedFieldsMatch<Record<AlignmentName, string>>(value, {
        lawful: string, neutral: string, chaotic: string,
    });
}

function validAdvancement(value: unknown): value is Advancement {
    return closedFieldsMatch<Advancement>(value, {
        infix: integer, inrnd: integer, lofix: integer,
        lornd: integer, hifix: integer, hirnd: integer,
    });
}

function validSpellcasting(value: unknown): value is Spellcasting {
    return closedFieldsMatch<Spellcasting>(value, {
        base: integer, healing: integer, shield: integer, armor: integer,
        stat: oneOf('intelligence', 'wisdom'), special: string, specialBonus: integer,
    });
}
