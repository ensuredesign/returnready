import { test, expect } from '@playwright/test';

test.describe('ReturnReady E2E Demo Journey (P0 & A19)', () => {
  test('renders entry screen with simulation notice and handles full household return flow', async ({
    page,
  }) => {
    await page.goto('/');

    // Screen A: Entry screen checks
    await expect(page.getByRole('heading', { name: 'Get your returns ready.' })).toBeVisible();
    await expect(page.getByTestId('simulation-notice')).toContainText(
      'Alexa+ experience simulation · Sample data · No retailer connection'
    );

    const enterBtn = page.getByTestId('try-sample-household-btn');
    await expect(enterBtn).toBeVisible();
    await enterBtn.click();

    // Wait for either the workspace screen (if migration applied) or actionable setup guide
    const workspaceOrError = await Promise.race([
      page
        .getByTestId('workspace-screen')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'workspace' as const),
      page
        .getByTestId('entry-error-box')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'error_box' as const),
    ]);

    expect(
      workspaceOrError,
      'Database migration 20261023000001_returnready_schema.sql must be applied on Supabase for E2E journey to pass'
    ).toBe('workspace');

    // Screen B: Verify 5 seeded purchases are visible in under 30 seconds
    await expect(page.getByTestId('return-card-wireless-headphones')).toBeVisible();
    await expect(page.getByTestId('return-card-running-shoes')).toBeVisible();
    await expect(page.getByTestId('return-card-desk-lamp')).toBeVisible();
    await expect(page.getByTestId('return-card-travel-backpack')).toBeVisible();
    await expect(page.getByTestId('return-card-coffee-grinder')).toBeVisible();

    // Step 1: Ask "What needs returning this week?"
    const chatInput = page.getByTestId('assistant-input');
    await chatInput.fill('What needs returning this week?');
    await page.getByTestId('assistant-send-btn').click();
    await expect(page.getByTestId('filter-btn-due_soon')).toHaveClass(/is-active/);

    // Step 2: Ask "Prepare the headphones"
    await chatInput.fill('Prepare the headphones');
    await page.getByTestId('assistant-send-btn').click();
    await expect(page.getByTestId('return-detail-panel')).toBeVisible();

    // Step 3: Ask "What is missing?"
    await chatInput.fill('What is missing?');
    await page.getByTestId('assistant-send-btn').click();
    await expect(page.getByTestId('assistant-panel')).toContainText('Charging cable');

    // Step 4: Check the remaining unchecked steps on Wireless Headphones -> Ready state
    const cableCheck = page.getByTestId('checklist-item-charging-cable');
    if ((await cableCheck.getAttribute('aria-checked')) === 'false') {
      await cableCheck.click();
      await expect(cableCheck).toHaveAttribute('aria-checked', 'true');
    }
    const packagingCheck = page.getByTestId('checklist-item-protective-packaging');
    if ((await packagingCheck.getAttribute('aria-checked')) === 'false') {
      await packagingCheck.click();
      await expect(packagingCheck).toHaveAttribute('aria-checked', 'true');
    }

    await expect(page.getByTestId('return-detail-panel')).toContainText('Ready to drop off');

    // Step 5: Ask "Assign this to Priya" -> Confirm
    await chatInput.fill('Assign this to Priya');
    await page.getByTestId('assistant-send-btn').click();
    await expect(page.getByTestId('assistant-pending-card')).toBeVisible();
    await page.getByTestId('assistant-confirm-btn').click();

    await expect(page.getByTestId('detail-assignee-value')).toHaveText('Priya');

    // Step 6: Refresh page and verify persistence in same browser session
    await page.reload();
    await expect(page.getByTestId('workspace-screen')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('return-card-wireless-headphones').click();
    await expect(page.getByTestId('detail-assignee-value')).toHaveText('Priya');
    await expect(page.getByTestId('return-detail-panel')).toContainText('Ready to drop off');
  });
});
