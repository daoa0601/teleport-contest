// C role.c:plnamesuffix(). Name tokens override rc-file character choices.
import { randomCharacterOption, str2align, str2gend, str2race, str2role } from './roles.js';
// C role.c:plnamesuffix(): split a dash-suffixed name into character
// facets; commas become spaces for the record file.
export function parseCharacterName(raw) {
    const [name = '', ...tokens] = raw.split('-');
    const result = {
        name: name.replaceAll(',', ' '),
        role: null, race: null, gender: null, align: null,
    };
    for (const token of tokens) {
        // Native tries roles first, so '*' requests a random role.
        if (str2role(token) || randomCharacterOption(token))
            result.role = token;
        else if (str2race(token))
            result.race = token;
        else if (str2gend(token))
            result.gender = token;
        else if (str2align(token))
            result.align = token;
    }
    return result;
}
//# sourceMappingURL=character_name.js.map