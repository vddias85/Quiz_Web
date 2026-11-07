// Responsividade no celular (Pixel 7): nenhuma página rola para os lados e o quiz funciona por toque.
import { expect, test, type Page } from "@playwright/test";
import { newNickname, startGame } from "./helpers";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("início, ranking e quiz cabem na largura do celular", async ({ page }) => {
  await page.goto("/");
  await expectNoHorizontalScroll(page);

  await page.goto("/ranking?categoria=geografia");
  await expectNoHorizontalScroll(page);

  await startGame(page, newNickname());
  await expect(page.getByText("1/20", { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Responde tocando na primeira alternativa.
  await page.getByRole("list", { name: "Alternativas" }).getByRole("button").first().tap();
  await expect(page.getByRole("button", { name: "Próxima pergunta" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
