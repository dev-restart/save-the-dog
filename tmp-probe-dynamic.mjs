import { chromium } from '@playwright/test';

const paths = {
  roof: [
    { x: 125, y: 585 },
    { x: 155, y: 515 },
    { x: 195, y: 470 },
    { x: 235, y: 515 },
    { x: 265, y: 585 }
  ],
  shortFloor: [
    { x: 165, y: 585 },
    { x: 225, y: 585 }
  ],
  highBar: [
    { x: 115, y: 430 },
    { x: 275, y: 430 }
  ],
  sideOnly: [
    { x: 125, y: 650 },
    { x: 125, y: 560 },
    { x: 150, y: 500 }
  ]
};

async function runPath(name, path) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { localStorage.clear(); Math.random = () => 0.5; });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  console.log(name, 'before', (await page.locator('body').innerText()).slice(0, 120));
  await page.getByRole('button', { name: /처음부터 시작|Stage 1 계속하기/ }).click();
  console.log(name, 'after', (await page.locator('body').innerText()).slice(0, 120));
  const canvasBox = await page.locator('canvas').boundingBox();
  if (!canvasBox) throw new Error('no canvas');
  await page.mouse.move(canvasBox.x + path[0].x, canvasBox.y + path[0].y);
  await page.mouse.down();
  for (const point of path.slice(1)) await page.mouse.move(canvasBox.x + point.x, canvasBox.y + point.y, { steps: 12 });
  await page.mouse.up();
  const result = await Promise.race([
    page.getByText('Failed').waitFor({ timeout: 9000 }).then(() => 'failed').catch(() => null),
    page.getByText('Clear!').waitFor({ timeout: 9000 }).then(() => 'clear').catch(() => null)
  ]);
  const text = await page.locator('body').innerText();
  console.log(name, result, text.match(/Stage 1[\s\S]{0,80}/)?.[0]?.replace(/\s+/g, ' '));
  await browser.close();
}

for (const [name, path] of Object.entries(paths)) await runPath(name, path);
