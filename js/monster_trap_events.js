// Shared presentation boundaries for monster trap events.
// State and RNG remain owned by monmove.js; callers inject tty policy and
// visible subject naming so this module can be used during movement or inside
// a source effect such as fountain actor construction.

function resolveSubject(subject, monster) {
    return typeof subject === 'function' ? subject(monster) : subject;
}

export async function presentMonsterWebTrap({
    event,
    monster,
    visible = false,
    subject = 'The monster',
    announce = async () => {},
}) {
    if (event?.kind !== 'web-trap')
        return { handled: false, presented: false, message: '' };
    if (!visible)
        return { handled: true, presented: false, message: '' };

    const message = `${resolveSubject(subject, monster)
        || 'The monster'} is caught in a spider web.`;
    await announce(message);
    return { handled: true, presented: true, message };
}
