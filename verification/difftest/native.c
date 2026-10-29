/* Link real recorder functions. The only RNG hook counts next-word calls. */
#define RNGLOG_IN_RND_C
#include "hack.h"
#include "isaac64.h"
#include <ctype.h>
#include <errno.h>

static isaac64_ctx *streams[2];
static unsigned positions[2];

uint64_t difftest_next_uint64(isaac64_ctx *ctx)
{
    int stream = ctx == streams[0] ? 0 : 1;
    if (ctx != streams[stream]) abort();
    positions[stream]++;
    return isaac64_next_uint64(ctx);
}

/* Including the actual translation unit exposes its private stream records
 * and log FILE without modifying the pinned source or reimplementing RNG. */
#define isaac64_next_uint64 difftest_next_uint64
#include "rnd.c"
#undef isaac64_next_uint64

/* Small JSON reader for canonical inputs from model.py. Each token remembers
 * the next sibling, so nested object contents remain ordinary JSON arrays. */
struct token { int begin, end, next; };
static struct token tokens[8192];
static int ntokens, cursor;
static const char *input;

static void reject_input(const char *message)
{
    fprintf(stderr, "difftest input: %s at column %d\n", message, cursor);
    exit(2);
}

static void whitespace(void)
{
    while (isspace((unsigned char) input[cursor])) cursor++;
}

static int parse_value(void)
{
    int id, closing = 0;
    whitespace();
    if (ntokens == SIZE(tokens)) reject_input("too many JSON tokens");
    id = ntokens++;
    tokens[id].begin = cursor;
    if (input[cursor] == '{' || input[cursor] == '[') {
        closing = input[cursor++] == '{' ? '}' : ']';
        whitespace();
        while (input[cursor] != closing) {
            if (!input[cursor]) reject_input("unclosed collection");
            if (input[cursor] == ',' || input[cursor] == ':') cursor++;
            else parse_value();
            whitespace();
        }
        cursor++;
    } else if (input[cursor] == '"') {
        cursor++;
        while (input[cursor] && input[cursor] != '"') {
            if (input[cursor] == '\\') reject_input("escaped keys are not canonical");
            cursor++;
        }
        if (!input[cursor]) reject_input("unclosed string");
        cursor++;
    } else {
        if (input[cursor] == '-') cursor++;
        if (!isdigit((unsigned char) input[cursor])) reject_input("expected integer");
        while (isdigit((unsigned char) input[cursor])) cursor++;
    }
    tokens[id].end = cursor;
    tokens[id].next = ntokens;
    return id;
}

static int member(int parent, const char *name)
{
    int i;
    for (i = parent + 1; i < tokens[parent].next;) {
        int size = tokens[i].end - tokens[i].begin;
        if (size == (int) strlen(name) + 2
            && !strncmp(input + tokens[i].begin + 1, name, strlen(name)))
            return i + 1;
        i = tokens[i + 1].next;
    }
    reject_input(name);
    return 0;
}

static long number(int parent, const char *name, long low, long high)
{
    int id = member(parent, name);
    char *end;
    long value;
    errno = 0;
    value = strtol(input + tokens[id].begin, &end, 10);
    if (errno || end != input + tokens[id].end || value < low || value > high)
        reject_input(name);
    return value;
}

static struct obj *load_object(int id, int depth)
{
    struct obj *object = calloc(1, sizeof *object), **tail;
    int children, child;
    if (!object || depth > 4) reject_input("object depth/allocation");
    object->otyp = number(id, "otyp", 1, NUM_OBJECTS - 1);
    object->oclass = objects[object->otyp].oc_class;
    object->quan = number(id, "quan", 1, 1000000);
    object->owt = number(id, "owt", 0, 10000000);
    object->corpsenm = number(id, "corpsenm", NON_PM, NUMMONS - 1);
    object->oeaten = number(id, "oeaten", 0, 1000000);
    object->spe = number(id, "spe", -20, 20);
    object->blessed = number(id, "blessed", 0, 1);
    object->cursed = number(id, "cursed", 0, 1);
    object->globby = number(id, "globby", 0, 1);
    object->oeroded = number(id, "oeroded", 0, 3);
    object->oeroded2 = number(id, "oeroded2", 0, 3);
    children = member(id, "contents");
    tail = &object->cobj;
    for (child = children + 1; child < tokens[children].next; child = tokens[child].next) {
        *tail = load_object(child, depth + 1);
        (*tail)->where = OBJ_CONTAINED;
        (*tail)->ocontainer = object;
        tail = &(*tail)->nobj;
    }
    return object;
}

static void print_object_chain(struct obj *, boolean);

static void print_objects(struct obj *object)
{
    print_object_chain(object, FALSE);
}

static void print_object_chain(struct obj *object, boolean single)
{
    printf("[");
    while (object) {
        printf("{\"otyp\":%d,\"quan\":%ld,\"owt\":%u,\"corpsenm\":%d,"
               "\"oeaten\":%u,\"spe\":%d,\"blessed\":%d,\"cursed\":%d,"
               "\"globby\":%d,\"oeroded\":%d,\"oeroded2\":%d,\"wornMask\":%ld,"
               "\"where\":\"%s\",\"containerType\":%d,\"contents\":",
               object->otyp, object->quan, object->owt, object->corpsenm,
               object->oeaten, object->spe, object->blessed, object->cursed,
               object->globby, object->oeroded, object->oeroded2, object->owornmask,
               object->where == OBJ_CONTAINED ? "contained"
                   : object->where == OBJ_INVENT ? "inventory" : "free",
               object->where == OBJ_CONTAINED ? object->ocontainer->otyp : NON_PM);
        print_objects(object->cobj);
        printf("}");
        object = single ? NULL : object->nobj;
        if (object) printf(",");
    }
    printf("]");
}

static void free_objects(struct obj *object)
{
    while (object) {
        struct obj *next = object->nobj;
        free_objects(object->cobj);
        free(object);
        object = next;
    }
}

static void run_case(void)
{
    int hero, inventory, i, target, armor_penalty = 0, attacks, result;
    int monster_id, method, legs, form, armed, x, y;
    struct obj *object, **tail;
    struct monst monster = { 0 };
    unsigned long seed;
    unsigned skip;
    char line[1024], operation[128];
    decl_globals_init();
    objects_globals_init();
    monst_globals_init();
    memset(&u, 0, sizeof u);
    memset(levl, 0, sizeof levl);
    for (x = 7; x <= 16; x++)
        for (y = 6; y <= 14; y++) levl[x][y].typ = ROOM;
    u.ux = u.uy = 10;
    uarm = uarmf = uarmg = uarmh = uwep = uarms = uleft = uright = 0;
    target = number(0, "target", 0, 5);
    hero = member(0, "hero");
    gu.urole = roles[0];
    if (number(hero, "role", 0, 1)) {
        for (i = 0; roles[i].name.m; i++)
            if (roles[i].mnum == PM_MONK) gu.urole = roles[i];
    }
    gu.urace = races[0];
    u.umonster = gu.urole.mnum;
    form = number(hero, "form", NON_PM, NUMMONS - 1);
    u.umonnum = form == NON_PM ? u.umonster : form;
    u.mtimedone = form == NON_PM ? 0 : 100;
    gy.youmonst.data = &mons[u.umonnum];
    for (i = 0; i < A_MAX; i++) ABON(i) = ATEMP(i) = 0, ABASE(i) = AMAX(i) = 12;
    ABASE(A_STR) = AMAX(A_STR) = number(hero, "str", 3, 125);
    ABASE(A_DEX) = AMAX(A_DEX) = number(hero, "dex", 3, 25);
    ABASE(A_CON) = AMAX(A_CON) = number(hero, "con", 3, 25);
    u.ulevel = number(hero, "level", 1, 30);
    u.uluck = number(hero, "luck", -13, 13);
    u.moreluck = number(hero, "moreluck", -3, 3);
    u.uhitinc = number(hero, "hitinc", -40, 40);
    u.utrap = number(hero, "trapped", 0, 1);
    u.ualign.record = 10;
    u.uz.dnum = 0; u.uz.dlevel = 1;
    svd.dungeons[0].depth_start = 1;
    HLevitation = number(hero, "levitating", 0, 1) ? FROMOUTSIDE : 0;
    HFlying = number(hero, "flying", 0, 1) ? FROMOUTSIDE : 0;
    legs = number(hero, "legs", 0, 3);
    EWounded_legs = (legs & 1 ? LEFT_SIDE : 0) | (legs & 2 ? RIGHT_SIDE : 0);
    set_uasmon(); /* includes form intrinsics and float_vs_flight() */
    inventory = member(0, "inventory");
    tail = &gi.invent;
    for (i = inventory + 1; i < tokens[inventory].next; i = tokens[i].next) {
        *tail = load_object(i, 0);
        (*tail)->where = OBJ_INVENT;
        tail = &(*tail)->nobj;
    }
    object = load_object(member(0, "object"), 0);
    armed = target == 5 && number(0, "armed", 0, 1);
    if (armed) {
        *tail = object; tail = &object->nobj;
        object->where = OBJ_INVENT;
        object->owornmask = W_WEP;
        uwep = object;
    }
    for (i = 0; i < 2; i++) {
        int enchantment = number(hero, i ? "rightRing" : "leftRing", -21, 20);
        if (enchantment != -21) {
            struct obj *ring = calloc(1, sizeof *ring);
            if (!ring) reject_input("ring allocation");
            ring->otyp = RIN_INCREASE_ACCURACY; ring->oclass = RING_CLASS;
            ring->quan = 1; ring->spe = enchantment; ring->corpsenm = NON_PM;
            ring->owt = objects[ring->otyp].oc_weight;
            ring->where = OBJ_INVENT; ring->owornmask = i ? W_RINGR : W_RINGL;
            *tail = ring; tail = &ring->nobj;
            if (i) uright = ring; else uleft = ring;
            Ring_on(ring);
        }
    }
    monster_id = member(0, "monster");
    monster.mnum = number(monster_id, "mnum", 0, NUMMONS - 1);
    monster.data = &mons[monster.mnum];
    monster.cham = NON_PM;
    monster.mcanmove = number(monster_id, "mcanmove", 0, 1);
    monster.msleeping = number(monster_id, "msleeping", 0, 1);
    monster.mstun = number(monster_id, "mstun", 0, 1);
    monster.mflee = number(monster_id, "mflee", 0, 1);
    monster.mx = 11; monster.my = 10;
    attacks = number(0, "attacks", 0, 10);
    method = number(0, "method", 0, 255);
    for (i = 0; i < P_NUM_SKILLS; i++) P_SKILL(i) = P_BASIC;
    seed = number(0, "seed", 0, 2147483647);
    skip = number(0, "position", 0, 4096);
    streams[0] = &rnglist[CORE].rng_state;
    streams[1] = &rnglist[DISP].rng_state;
    init_isaac64(seed, rn2); init_isaac64(seed, rn2_on_display_rng);
    for (i = 0; i < (int) skip; i++) (void) rn2(1);
    positions[0] = positions[1] = 0;
    rng_logfile = tmpfile();
    if (!rng_logfile) reject_input("cannot create RNG log");
    rng_call_count = 0;
    switch (target) {
    case 0: result = weight(object); break;
    case 1: result = inv_weight(); break;
    case 2: result = calc_capacity(number(0, "extra", -10000, 10000)); break;
    case 3: result = near_capacity(); break;
    case 4: result = dmgval(object, &monster); break;
    default: result = find_roll_to_hit(&monster, method, uwep, &attacks, &armor_penalty); break;
    }
    printf("{\"result\":%d,\"armorPenalty\":%d,\"state\":{\"object\":", result, armor_penalty);
    print_object_chain(object, TRUE);
    printf(",\"inventory\":"); print_objects(gi.invent);
    printf(",\"hero\":{\"str\":%d,\"dex\":%d,\"con\":%d,\"level\":%d,"
           "\"luck\":%d,\"moreluck\":%d,\"hitinc\":%d,\"trapped\":%d,\"form\":%d,"
           "\"levitating\":%d,\"flying\":%d,\"legs\":%d,\"role\":%d,"
           "\"leftRing\":%d,\"rightRing\":%d}",
           ABASE(A_STR), ABASE(A_DEX), ABASE(A_CON), u.ulevel, u.uluck, u.moreluck,
           u.uhitinc, u.utrap, Upolyd ? u.umonnum : NON_PM,
           !!Levitation, !!Flying,
           (EWounded_legs & LEFT_SIDE ? 1 : 0) | (EWounded_legs & RIGHT_SIDE ? 2 : 0),
           Role_if(PM_MONK), uleft ? uleft->spe : -21, uright ? uright->spe : -21);
    printf(",\"alignment\":%d,\"monster\":{\"mnum\":%d,\"mcanmove\":%d,"
           "\"msleeping\":%d,\"mstun\":%d,\"mflee\":%d}},"
           "\"rng\":{\"core\":%u,\"display\":%u,\"log\":[",
           u.ualign.record, monster.mnum, monster.mcanmove, monster.msleeping,
           monster.mstun, monster.mflee, positions[0], positions[1]);
    rewind(rng_logfile);
    i = 0;
    while (fgets(line, sizeof line, rng_logfile)) {
        char *start = strchr(line, ' '), *end;
        int j = 0;
        if (!start) abort();
        for (start++; *start && *start != '@' && *start != '\n'; start++)
            if (*start != ' ') operation[j++] = *start;
        operation[j] = '\0';
        end = operation;
        if (!*end) abort();
        printf("%s\"%s\"", i++ ? "," : "", operation);
    }
    printf("]}}\n");
    fclose(rng_logfile); rng_logfile = 0;
    if (!armed) free_objects(object);
    free_objects(gi.invent);
}

#include "creation.h"
#include "naming.h"

int main(void)
{
    char *line = NULL;
    size_t size = 0;
    while (getline(&line, &size, stdin) >= 0) {
        input = line; cursor = ntokens = 0;
        parse_value(); whitespace();
        if (input[cursor]) reject_input("trailing input");
        if (number(0, "target", 0, 17) >= 12) {
            /* A fresh process gives private C caches and name tables the
               same lifetime as a fresh JS game, with no reset model. */
            int status;
            pid_t child = fork();
            if (child < 0) reject_input("fork failed");
            if (!child) {
                run_naming_case();
                fflush(stdout);
                _exit(0);
            }
            if (waitpid(child, &status, 0) != child || !WIFEXITED(status)
                || WEXITSTATUS(status) != 0) exit(2);
        } else if (number(0, "target", 0, 11) >= 6) {
            /* A fresh process gives private C caches, timers and heap owners
               the same lifetime as a fresh JS game, with no reset model. */
            int status;
            pid_t child = fork();
            if (child < 0) reject_input("fork failed");
            if (!child) {
                run_creation_case();
                fflush(stdout);
                _exit(0);
            }
            if (waitpid(child, &status, 0) != child || !WIFEXITED(status)
                || WEXITSTATUS(status) != 0) exit(2);
        } else run_case();
        fflush(stdout);
    }
    free(line);
    return 0;
}
