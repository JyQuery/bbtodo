import { expect, test } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();

test.describe("API docs", () => {
  test.skip(
    !externalBaseUrl,
    "Swagger UI is only available when Playwright targets the integrated app."
  );

  test("loads Swagger UI without resolver errors", async ({ page }) => {
    const specResponsePromise = page.waitForResponse((response) => response.url().endsWith("/docs/json"));
    await page.goto("/docs/");
    await page.waitForLoadState("networkidle");
    const specResponse = await specResponsePromise;

    await expect(page).toHaveTitle(/Swagger UI/i);
    expect(specResponse.headers()["cache-control"]).toBe("no-store");
    await expect(page.locator(".info .title")).toContainText("bbtodo API");
    await expect(page.locator(".opblock-tag-section .opblock-tag")).toContainText([
      "system",
      "auth",
      "api-tokens",
      "tags",
      "projects",
      "lanes",
      "tasks"
    ]);
    const authorizeButton = page.getByRole("button", { name: "Authorize" });
    await expect(authorizeButton).toBeVisible();
    await authorizeButton.click();
    await expect(page.locator(".dialog-ux .modal-ux-content")).toContainText("apiToken");
    await expect(page.locator(".dialog-ux .modal-ux-content")).toContainText("sessionCookie");
    await expect(page.locator(".dialog-ux input")).toHaveCount(2);
    await expect(page.locator(".errors-wrapper")).toHaveCount(0);
    await expect(page.locator("#swagger-ui")).not.toContainText("Resolver error");
  });
});
