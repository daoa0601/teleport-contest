/* Concrete check of the real recorder implementation, not a second PRNG. */
#include "config.h"
#include "isaac64.h"
#include <stdio.h>
#include <stdlib.h>

static int decode(const char *hex, unsigned char *bytes)
{
    int length = 0;
    while (*hex) {
        unsigned value;
        if (!hex[1] || length == 4096 || sscanf(hex, "%2x", &value) != 1)
            exit(2);
        bytes[length++] = value;
        hex += 2;
    }
    return length;
}

int main(int argc, char **argv)
{
    isaac64_ctx ctx;
    unsigned char seed[4096], extra[4096];
    int length, extra_length = 0;
    if (argc < 2 || argc > 3)
        return 2;
    length = decode(argv[1], seed);
    if (argc == 3)
        extra_length = decode(argv[2], extra);
    isaac64_init(&ctx, seed, length);
    for (int i = 0; i < 1000; i++) {
        if (i == 333 && argc == 3)
            isaac64_reseed(&ctx, extra, extra_length);
        printf("%016llx\n", isaac64_next_uint64(&ctx));
    }
    return 0;
}
