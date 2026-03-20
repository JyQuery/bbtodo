import { expect, test } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();

test.describe("API docs", () => {
  test.skip(
    !externalBaseUrl,
    "Swagger UI is only available when Playwright targets the integrated app."
  );

  test("loads Swagger UI without resolver errors", async ({ page }) => {
    await page.goto("/docs/");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveTitle(/Swagger UI/i);
    await expect(page.locator(".info .title")).toContainText("bbtodo API");
    await expect(page.locator(".opblock-tag-section .opblock-tag")).toContainText(["system", "auth", "api-tokens", "tags", "projects", "lanes", "tasks"]);
    await expect(page.locator(".errors-wrapper")).toHaveCount(0);
    await expect(page.locator("#swagger-ui")).not.toContainText("Resolver error");
  });
});
