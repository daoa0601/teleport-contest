import { defineConfig } from 'vite-plus';

export default defineConfig({
    base: './',
    server: {
        host: '127.0.0.1',
        strictPort: true,
        watch: {
            ignored: ['**/.cache/**', '**/nethack-c/**', '**/sessions/**', '**/frozen/**'],
        },
    },
    preview: {
        host: '127.0.0.1',
        strictPort: true,
    },
    build: {
        target: 'es2022',
        sourcemap: true,
    },
    // Existing behavior tests use node:test, not Vitest. Run npm test.
    test: {
        include: [],
    },
    check: {
        fmt: false,
    },
    lint: {
        options: {
            typeAware: true,
            typeCheck: true,
        },
    },
    fmt: {
        tabWidth: 4,
        singleQuote: true,
    },
});
