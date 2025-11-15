import { test, expect } from '@playwright/test';

test.describe('Studio layout & sticky left col', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio/multi-track');
    // ensure a predictable width
    await page.evaluate(() => document.documentElement.style.setProperty('--studio-left-column-width', '224px'));
  });

  test('left column remains sticky when scrolling the timeline horizontally', async ({ page }) => {
    // ensure there are multiple tracks to scroll horizontally
    await page.evaluate(() => {
      // Add enough tracks (client local) to generate content
      const addBtn = document.querySelector('button[title="Add track"]');
      for (let i = 0; i < 5; i++) addBtn?.dispatchEvent(new MouseEvent('click'));
    });

    // Scroll the timeline horizontally and confirm left column stays in place
    const left = page.locator('.studio-left-column');
    const timeline = page.locator('.app-components-studio-Timeline, .relative.h-24');
    // Wait for playhead to exist
    await page.waitForSelector('[data-testid="timeline-playhead"]');

    const before = await left.boundingBox();
    // Scroll timeline horizontally by 300px
    await page.evaluate(() => {
      const scroller = document.querySelector('.flex-1.relative.overflow-auto');
      if (scroller) scroller.scrollLeft = 300;
    });
    await page.waitForTimeout(100);
    const after = await left.boundingBox();
    expect(before!.x).toBeCloseTo(after!.x, 1);
  });

  test('playhead remains aligned with ruler after changing left column width', async ({ page }) => {
    const timelinePlayhead = page.locator('[data-testid="timeline-playhead"]');
    const rulerPlayhead = page.locator('[data-testid="ruler-playhead"]');

    // Ensure initial positions are equal
    const p1 = await timelinePlayhead.evaluate((el) => window.getComputedStyle(el).left);
    const r1 = await rulerPlayhead.evaluate((el) => window.getComputedStyle(el).left);
    expect(p1).toBe(r1);

    // Change left column width
    await page.evaluate(() => document.documentElement.style.setProperty('--studio-left-column-width', '300px'));
    await page.waitForTimeout(100);

    const p2 = await timelinePlayhead.evaluate((el) => window.getComputedStyle(el).left);
    const r2 = await rulerPlayhead.evaluate((el) => window.getComputedStyle(el).left);
    expect(p2).toBe(r2);
    expect(p1).not.toBe(p2);
  });
});
