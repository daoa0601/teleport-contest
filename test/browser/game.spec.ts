import { expect, test } from '@playwright/test';

test('the browser game starts and accepts a turn', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
        contentType: 'text/css',
        body: '',
    }));
    await page.addInitScript(() => {
        localStorage.setItem('teleport:nethackrc', [
            'OPTIONS=name:ViteTester,role:Valkyrie,race:human,gender:female,align:neutral',
            'OPTIONS=!legacy,!tutorial,pettype:none,time',
        ].join('\n'));
    });

    await page.goto('/');
    const terminal = page.locator('#game-container pre');
    await expect(terminal).toContainText('Click here and press any key.');
    await page.keyboard.press('Space');
    await expect(terminal).toContainText('ViteTester');
    await expect(terminal).toContainText('T:1');
    // Force a rest even when the fresh level starts beside a hostile monster.
    await page.keyboard.type('m.');
    await expect(terminal).toContainText('T:2');
    expect(errors).toEqual([]);
});
