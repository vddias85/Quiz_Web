// Tema claro/escuro (S6), sons desligados por padrão (S11) e acessibilidade automática (axe).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { newNickname, startGame } from "./helpers";

test("tema escuro: alterna e continua escolhido depois de recarregar", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Usar tema escuro" }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test("sem escolha, o tema segue o sistema", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("sons começam desligados e a escolha fica salva", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Sons" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Sons" })).toHaveAttribute("aria-pressed", "true");
});

async function expectNoA11yViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`acessibilidade (WCAG AA) — tema ${scheme === "light" ? "claro" : "escuro"}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });

    await page.goto("/");
    await expectNoA11yViolations(page, "início");

    await page.goto("/ranking");
    await expectNoA11yViolations(page, "ranking");

    await startGame(page, newNickname());
    await expect(page.getByText("1/20", { exact: true })).toBeVisible();
    await expectNoA11yViolations(page, "pergunta");

    await page.keyboard.press("1");
    await expect(page.getByRole("button", { name: "Próxima pergunta" })).toBeVisible();
    await expectNoA11yViolations(page, "feedback");
  });
}
