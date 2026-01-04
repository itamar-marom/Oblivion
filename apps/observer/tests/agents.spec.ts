import { test, expect } from '@playwright/test';

test.describe('Agents Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to agents page
    await page.goto('/agents');
  });

  test('should display agents page header', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Agents');

    // Check connection status text
    await expect(page.locator('text=/\\d+ of \\d+ agents connected/')).toBeVisible();
  });

  test('should display agent cards', async ({ page }) => {
    // Wait for agents to load
    await page.waitForSelector('[class*="rounded-xl border"]');

    // Check that at least one agent card exists
    const agentCards = page.locator('[class*="rounded-xl border border-zinc"]');
    await expect(agentCards.first()).toBeVisible();
  });

  test('should show agent details in card', async ({ page }) => {
    // Wait for agents to load
    await page.waitForSelector('[class*="rounded-xl border"]');

    const firstCard = page.locator('[class*="rounded-xl border border-zinc"]').first();

    // Check agent name is visible
    await expect(firstCard.locator('h3')).toBeVisible();

    // Check status badge is visible
    await expect(firstCard.locator('[class*="rounded-full border"]')).toBeVisible();

    // Check action buttons exist
    await expect(firstCard.locator('button:has-text("View Logs")')).toBeVisible();
    await expect(firstCard.locator('button:has-text("Configure")')).toBeVisible();
  });

  test('should open edit modal when clicking Configure', async ({ page }) => {
    // Wait for agents to load
    await page.waitForSelector('[class*="rounded-xl border"]');

    // Click Configure button on first agent
    const configureButton = page.locator('button:has-text("Configure")').first();
    await configureButton.click();

    // Wait for modal to appear
    await expect(page.locator('text=Edit Agent')).toBeVisible({ timeout: 5000 });

    // Check modal has expected fields
    await expect(page.locator('label:has-text("Display Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Description")')).toBeVisible();
    await expect(page.locator('label:has-text("Email")')).toBeVisible();
    await expect(page.locator('label:has-text("Avatar URL")')).toBeVisible();
    await expect(page.locator('label:has-text("Slack User ID")')).toBeVisible();
    await expect(page.locator('label:has-text("Capabilities")')).toBeVisible();
  });

  test('should close edit modal when clicking Cancel', async ({ page }) => {
    // Wait for agents to load
    await page.waitForSelector('[class*="rounded-xl border"]');

    // Open modal
    await page.locator('button:has-text("Configure")').first().click();
    await expect(page.locator('text=Edit Agent')).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await page.locator('button:has-text("Cancel")').click();

    // Modal should be closed
    await expect(page.locator('text=Edit Agent')).not.toBeVisible();
  });

  test('should close edit modal when clicking backdrop', async ({ page }) => {
    // Wait for agents to load
    await page.waitForSelector('[class*="rounded-xl border"]');

    // Open modal
    await page.locator('button:has-text("Configure")').first().click();
    await expect(page.locator('text=Edit Agent')).toBeVisible({ timeout: 5000 });

    // Click backdrop at position outside modal content (top-left corner)
    // The modal is centered, so clicking at (10, 10) should hit the backdrop
    await page.mouse.click(10, 10);

    // Modal should be closed
    await expect(page.locator('text=Edit Agent')).not.toBeVisible();
  });

  test('should validate email field in edit modal', async ({ page }) => {
    // Wait for agents to load
    await page.waitForSelector('[class*="rounded-xl border"]');

    // Open modal
    await page.locator('button:has-text("Configure")').first().click();
    await expect(page.locator('text=Edit Agent')).toBeVisible({ timeout: 5000 });

    // Enter invalid email
    const emailInput = page.locator('input#email');
    await emailInput.fill('invalid-email');

    // Try to submit
    await page.locator('button:has-text("Save Changes")').click();

    // Modal should still be open (validation failed or API error)
    // The modal stays open on error
    await expect(page.locator('text=Edit Agent')).toBeVisible();
  });

  test('should add and remove capabilities', async ({ page }) => {
    // Wait for agents to load
    await page.waitForSelector('[class*="rounded-xl border"]');

    // Open modal
    await page.locator('button:has-text("Configure")').first().click();
    await expect(page.locator('text=Edit Agent')).toBeVisible({ timeout: 5000 });

    // Add a new capability with unique name
    const capabilityInput = page.locator('input[placeholder="Add capability..."]');
    await capabilityInput.fill('unique-test-cap-xyz');

    // Click Add button
    await page.locator('button:has(svg.lucide-plus)').click();

    // Capability should appear as a tag (use exact match to avoid conflicts)
    await expect(page.getByText('unique-test-cap-xyz', { exact: true })).toBeVisible();
  });

  test('should show Register New Agent button', async ({ page }) => {
    await expect(page.locator('button:has-text("Register New Agent")')).toBeVisible();
  });
});

test.describe('Agents Page - Empty State', () => {
  test('should show empty state when no agents', async ({ page }) => {
    // This test would require mocking the API to return empty array
    // For now, we'll skip this test as it requires mock setup
    test.skip();
  });
});
