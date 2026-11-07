import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { E2E_PREFIX } from "./db";

export const newNickname = () => `${E2E_PREFIX}${randomBytes(4).toString("hex")}`;

/** Preenche a tela inicial e começa a partida. Sem categoria = Temas Variados. */
export async function startGame(page: Page, nickname: string, category?: string) {
  await page.goto("/");
  await page.getByLabel("Seu apelido").fill(nickname);
  if (category) {
    await page.getByRole("button", { name: /Por Categoria/i }).click();
    await page.getByRole("button", { name: category }).click();
  }
  await page.getByRole("button", { name: "Começar" }).click();
  await page.waitForURL(/\/quiz\//);
}

/** Responde as 20 perguntas com o atalho de teclado (alternativa 1) e vai para o resultado. */
export async function playAllQuestions(page: Page) {
  for (let position = 1; position <= 20; position++) {
    await expect(page.getByText(`${position}/20`, { exact: true })).toBeVisible();
    await page.keyboard.press("1");
    const next = page.getByRole("button", { name: position === 20 ? "Ver resultado" : "Próxima pergunta" });
    await expect(next).toBeVisible();
    await next.click();
  }
  await page.waitForURL(/\/resultado\//);
}
