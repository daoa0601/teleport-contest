/* Naming observations: objnam.c and do_name.c formatting functions.
 * The linked recorder sources keep every algorithm; this only loads state. */

static char naming_text_buf[8][128];

/* member() aborts when absent; naming needs an optional lookup. */
static int member0(int parent, const char *name)
{
    int i;
    for (i = parent + 1; i < tokens[parent].next;) {
        int size = tokens[i].end - tokens[i].begin;
        if (size == (int) strlen(name) + 2
            && !strncmp(input + tokens[i].begin + 1, name, strlen(name)))
            return i + 1;
        i = tokens[i + 1].next;
    }
    return -1;
}

/* Extract an unescaped JSON string member; canonical inputs never escape. */
static char *string_member(int parent, const char *name, int slot)
{
    int id = member(parent, name), i;
    char *out = naming_text_buf[slot];
    if (input[tokens[id].begin] != '"') reject_input(name);
    for (i = 0; i < tokens[id].end - tokens[id].begin - 2; i++) {
        char c = input[tokens[id].begin + 1 + i];
        if (c < ' ' || c > '~' || c == '"' || i >= 126) reject_input(name);
        out[i] = c;
    }
    out[i] = '\0';
    return out;
}

static void naming_rng(void)
{
    char line[1024], operation[256];
    int count = 0;
    printf(",\"rng\":{\"core\":%u,\"display\":%u,\"log\":[", positions[0], positions[1]);
    rewind(rng_logfile);
    while (fgets(line, sizeof line, rng_logfile)) {
        char *start = strchr(line, ' ');
        int j = 0;
        if (!start) abort();
        for (start++; *start && *start != '@' && *start != '\n'; start++)
            if (*start != ' ') {
                if (j >= (int) sizeof operation - 1) abort();
                operation[j++] = *start;
            }
        operation[j] = '\0';
        printf("%s\"%s\"", count++ ? "," : "", operation);
    }
    printf("]}}\n");
    fclose(rng_logfile);
    rng_logfile = 0;
}

static void naming_setup(int role_id)
{
    int i;
    decl_globals_init();
    objects_globals_init();
    monst_globals_init();
    memset(&u, 0, sizeof u);
    memset(levl, 0, sizeof levl);
    gu.urole = roles[0];
    if (role_id == 1) {
        for (i = 0; roles[i].name.m; i++)
            if (roles[i].mnum == PM_MONK) gu.urole = roles[i];
    } else if (role_id == 2) {
        for (i = 0; roles[i].name.m; i++)
            if (roles[i].mnum == PM_CLERIC) gu.urole = roles[i];
    } else if (role_id == 3) {
        for (i = 0; roles[i].name.m; i++)
            if (roles[i].mnum == PM_SAMURAI) gu.urole = roles[i];
    }
    gu.urace = races[0];
    u.umonster = u.umonnum = gu.urole.mnum;
    gy.youmonst.data = &mons[u.umonnum];
    /* Distinct branch identities keep ordinary levels out of the quest,
       endgame, Mines and tower predicates (In_endgame for mplayer names). */
    quest_dnum = 1; mines_dnum = 2; sokoban_dnum = 3;
    tower_dnum = 4;
    astral_level.dnum = earth_level.dnum = air_level.dnum = fire_level.dnum = 5;
    water_level.dnum = 5;
    astral_level.dlevel = 1; water_level.dlevel = 2;
    fire_level.dlevel = 3; air_level.dlevel = 4; earth_level.dlevel = 5;
    sanctum_level.dnum = 0; sanctum_level.dlevel = 8;
    rogue_level.dnum = 6; rogue_level.dlevel = 1;
    svn.n_dgns = 7;
    for (i = 0; i < 7; i++) {
        svd.dungeons[i].depth_start = 1;
        svd.dungeons[i].num_dunlevs = 50;
        svd.dungeons[i].entry_lev = 1;
        svd.dungeons[i].ledger_start = i * 50;
    }
    for (i = 0; i < A_MAX; i++) ABASE(i) = AMAX(i) = 12;
    u.ulevel = 8;
    u.ualign.type = A_NEUTRAL;
    u.ualign.record = 10;
    u.ux = u.uy = 10;
    u.uhp = u.uhpmax = 40;
    u.uz.dnum = 0;
    u.uz.dlevel = 1;
    svd.dungeons[0].depth_start = 1;
    vision_init();
    vision_reset();
    /* Description shuffling draws from the default stream, exactly as the
       creation harness seeds it before init_objects()/oinit(). */
    streams[0] = &rnglist[CORE].rng_state;
    streams[1] = &rnglist[DISP].rng_state;
    init_isaac64(999UL, rn2);
    init_isaac64(999UL, rn2_on_display_rng);
    init_objects();
    oinit();
    init_artifacts();
}

/* Apply hero flags that naming reads. Called before the RNG measurement. */
static void naming_hero(int hero_id)
{
    if (number(hero_id, "blind", 0, 1))
        HBlinded = TIMEOUT;
    if (number(hero_id, "detect", 0, 1))
        HDetect_monsters = TIMEOUT;
    if (number(hero_id, "seeInvis", 0, 1))
        HSee_invisible = TIMEOUT;
    flags.implicit_uncursed = number(hero_id, "implicitUncursed", 0, 1);
    iflags.partly_eaten_hack = number(hero_id, "partlyEatenHack", 0, 1);
    set_uasmon(); /* refresh property-derived state after the intrinsic bits */
}

static void naming_rng_start(void)
{
    unsigned long seed = number(0, "seed", 0, 2147483647);
    unsigned skip = number(0, "position", 0, 4096), i;
    /* the string targets skip naming_setup(); every case needs the streams */
    streams[0] = &rnglist[CORE].rng_state;
    streams[1] = &rnglist[DISP].rng_state;
    init_isaac64(seed, rn2);
    init_isaac64(seed, rn2_on_display_rng);
    for (i = 0; i < skip; i++) (void) rn2(1);
    positions[0] = positions[1] = 0;
    rng_call_count = 0;
    rng_logfile = tmpfile();
    if (!rng_logfile) reject_input("cannot create RNG log");
}

static void naming_fruits(void)
{
    int fruits, f, fid = 1;
    struct fruit *tail = 0;
    fruits = member(0, "fruits");
    for (f = fruits + 1; f < tokens[fruits].next; f = tokens[f].next) {
        struct fruit *fruit;
        int begin = tokens[f].begin, end;
        if (input[begin] != '"') reject_input("fruit");
        end = tokens[f].end - 1;
        if (end - begin - 1 > PL_FSIZ - 1) reject_input("fruit");
        fruit = newfruit();
        fruit->fid = fid++;
        (void) strncpy(fruit->fname, input + begin + 1, end - begin - 1);
        fruit->fname[end - begin - 1] = '\0';
        fruit->nextf = 0;
        if (tail) tail->nextf = fruit; else gf.ffruit = fruit;
        tail = fruit;
    }
    if (gf.ffruit) svc.context.current_fruit = gf.ffruit->fid;
}

static struct obj *naming_object(int id, int depth)
{
    struct obj *object = calloc(1, sizeof *object), **tail;
    int children, child;
    const char *oname;
    if (!object || depth > 2) reject_input("naming object allocation");
    object->otyp = number(id, "otyp", 1, NUM_OBJECTS - 1);
    object->oclass = objects[object->otyp].oc_class;
    object->quan = number(id, "quan", 1, 1000);
    object->owt = number(id, "owt", 0, 10000);
    object->corpsenm = number(id, "corpsenm", NON_PM, NUMMONS - 1);
    object->spe = number(id, "spe", -20, 20);
    object->oeaten = number(id, "oeaten", 0, 1000000);
    /* obj.h: orotten/odiluted alias oeroded and opoisoned aliases otrapped;
       the domain keeps each pair exclusive so one shared store suffices. */
    object->oeroded = number(id, "oeroded", 0, 3) | number(id, "odiluted", 0, 1);
    object->oeroded2 = number(id, "oeroded2", 0, 3);
    object->owornmask = number(id, "wornMask", 0, 0x400000L);
    object->blessed = number(id, "blessed", 0, 1);
    object->cursed = number(id, "cursed", 0, 1);
    object->globby = number(id, "globby", 0, 1);
    object->known = number(id, "known", 0, 1);
    object->dknown = number(id, "dknown", 0, 1);
    object->bknown = number(id, "bknown", 0, 1);
    object->rknown = number(id, "rknown", 0, 1);
    object->lknown = number(id, "lknown", 0, 1);
    object->cknown = number(id, "cknown", 0, 1);
    object->tknown = number(id, "tknown", 0, 1);
    object->oerodeproof = number(id, "oerodeproof", 0, 1);
    object->greased = number(id, "greased", 0, 1);
    object->otrapped = number(id, "otrapped", 0, 1)
                     | number(id, "opoisoned", 0, 1);
    object->obroken = number(id, "obroken", 0, 1);
    object->olocked = number(id, "olocked", 0, 1);
    object->lamplit = number(id, "lamplit", 0, 1);
    oname = string_member(id, "oname", 7);
    if (*oname) {
        new_oname(object, (int) strlen(oname) + 1);
        Strcpy(ONAME(object), oname);
    }
    children = member(id, "contents");
    tail = &object->cobj;
    for (child = children + 1; child < tokens[children].next; child = tokens[child].next) {
        *tail = naming_object(child, depth + 1);
        (*tail)->where = OBJ_CONTAINED;
        (*tail)->ocontainer = object;
        tail = &(*tail)->nobj;
    }
    return object;
}

/* Per-type knowledge lives on the class entry, like docall() results.
   The case's discovery applies to the root object's type only; contained
   types keep their table knowledge, exactly like the emitted loader. */
static void naming_discovery(int root, struct obj *object)
{
    int discovery, call;
    if ((discovery = member0(root, "discovery")) >= 0) {
        objects[object->otyp].oc_name_known = number(discovery, "nameKnown", 0, 1);
        if ((call = member0(discovery, "callName")) >= 0) {
            char *name = string_member(discovery, "callName", 6);
            if (*name)
                objects[object->otyp].oc_uname = dupstr(name);
        }
    }
}

static void naming_free_objects(struct obj *object)
{
    while (object) {
        struct obj *next = object->nobj;
        naming_free_objects(object->cobj);
        if (object->oextra) dealloc_oextra(object);
        free(object);
        object = next;
    }
}

static void run_naming_case(void)
{
    int target = number(0, "target", 12, 17), hero;
    char *bp, *text;
    struct obj *object;
    struct monst monster;

    if (target <= 14) {
        /* Pure string functions need no game state beyond gender tables. */
        decl_globals_init();
        monst_globals_init();
        naming_rng_start();
        text = string_member(0, "text", 0);
        if (target == 12)
            bp = makeplural(text);
        else if (target == 13)
            bp = makesingular(text);
        else
            bp = an(text);
        printf("{\"result\":\"%s\"", bp);
        if (target == 14)
            printf(",\"the\":\"%s\"", the(text));
        naming_rng();
        return;
    }

    hero = member(0, "hero");
    naming_setup(number(hero, "role", 0, 3));
    if (target == 17) {
        int monster_id = member(0, "monster"), suppress, article;
        const char *adjective, *given;

        naming_hero(hero);
        memset(&monster, 0, sizeof monster);
        monster.mnum = number(monster_id, "mnum", 0, NUMMONS - 1);
        monster.data = &mons[monster.mnum];
        monster.cham = NON_PM;
        monster.female = number(monster_id, "female", 0, 1);
        monster.minvis = number(monster_id, "minvis", 0, 1);
        monster.mtame = number(monster_id, "mtame", 0, 1);
        monster.mpeaceful = number(monster_id, "mpeaceful", 0, 1);
        monster.m_lev = number(monster_id, "m_lev", 0, 30);
        monster.mx = 11;
        monster.my = 10;
        if (number(monster_id, "saddle", 0, 1))
            monster.misc_worn_check |= W_SADDLE;
        given = string_member(monster_id, "mgivenname", 0);
        if (*given) {
            new_mgivenname(&monster, (int) strlen(given) + 1);
            Strcpy(MGIVENNAME(&monster), given);
        }
        if (number(monster_id, "isshk", 0, 1)) {
            monster.isshk = 1;
            neweshk(&monster);
            Strcpy(ESHK(&monster)->shknam, string_member(monster_id, "shkName", 1));
        }
        if (number(monster_id, "ispriest", 0, 1)) {
            monster.ispriest = 1;
            newepri(&monster);
            EPRI(&monster)->shralign = (aligntyp) number(monster_id, "priestAlign", -128, 1);
        }
        article = number(0, "article", 0, 3);
        adjective = string_member(0, "adjective", 2);
        suppress = number(0, "suppress", 0, 127);
        naming_rng_start();
        bp = x_monnam(&monster, article, *adjective ? adjective : NULL,
                      suppress, number(0, "called", 0, 1));
        printf("{\"result\":\"%s\"", bp);
        naming_rng();
        return;
    }

    naming_fruits();
    object = naming_object(member(0, "object"), 0);
    naming_discovery(0, object);
    naming_hero(hero);
    naming_rng_start();
    if (target == 15) {
        char *base = xname(object);
        printf("{\"result\":\"%s\",\"an\":\"%s\",\"the\":\"%s\"", base,
               an(base), the(base));
        printf(",\"aobjnam\":\"%s\"", aobjnam(object, NULL));
    } else {
        bp = doname(object);
        printf("{\"result\":\"%s\"", bp);
    }
    printf(",\"state\":{\"known\":%d,\"dknown\":%d,\"bknown\":%d,\"corpsenm\":%d}",
           object->known, object->dknown, object->bknown, object->corpsenm);
    naming_rng();
    if (objects[object->otyp].oc_uname) {
        free(objects[object->otyp].oc_uname);
        objects[object->otyp].oc_uname = 0;
    }
    naming_free_objects(object);
}
