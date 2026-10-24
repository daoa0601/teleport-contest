// C role.c:plnamesuffix(). Name tokens override rc-file character choices.
import { findAlignment, findGender, findRace, findRole, randomCharacterOption } from './roles.js';

export interface ParsedCharacterName {
    name: string;
    role: string | null;
    race: string | null;
    gender: string | null;
    align: string | null;
}

export function parseCharacterName(raw: string): ParsedCharacterName {
    const [name = '', ...tokens] = raw.split('-');
    const result: ParsedCharacterName = {
        name: name.replaceAll(',', ' '),
        role: null, race: null, gender: null, align: null,
    };
    for (const token of tokens) {
        // Native tries roles first, so '*' requests a random role.
        if (findRole(token) || randomCharacterOption(token)) result.role = token;
        else if (findRace(token)) result.race = token;
        else if (findGender(token)) result.gender = token;
        else if (findAlignment(token)) result.align = token;
    }
    return result;
}
