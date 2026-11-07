// Fluxos principais do PLANO (Fase 4): partida completa nos dois modos, tempo esgotado,
// apelido duplicado e palavrão, e a sessão aparecendo no ranking.
import { expect, test } from "@playwright/test";
import { newNickname, playAllQuestions, startGame } from "./helpers";

test("Temas Variados: 20 perguntas, resultado, revisão e ranking", async ({ page }) => {
  const nickname = newNickname();
  await startGame(page, nickname);
  await playAllQuestions(page);

  // Resultado: nota, posição no ranking e os três botões.
  await expect(page.getByRole("heading", { name: "Sua nota" })).toBeVisible();
  await expect(page.getByText(/no ranking Geral/)).toBeVisible();

  // Revisão: as 20 perguntas, com a correta marcada.
  await page.getByRole("link", { name: "Revisar respostas" }).click();
  await expect(page.getByRole("heading", { name: "Revisão das respostas" })).toBeVisible();
  await expect(page.locator("ol > li")).toHaveCount(20);
  await expect(page.getByText("(resposta correta)")).toHaveCount(20);

  // Ranking Geral, hoje: o jogador aparece destacado.
  await page.getByRole("link", { name: "Voltar ao resultado" }).click();
  await page.getByRole("link", { name: "Ver ranking" }).click();
  await page.getByRole("link", { name: "Hoje" }).click();
  await expect(page).toHaveURL(/periodo=hoje/);
  const row = page.getByRole("row").filter({ hasText: nickname });
  await expect(row).toBeVisible();
  await expect(row).toContainText("(você)");
});

test("Por Categoria: a partida entra no ranking da categoria, não no Geral", async ({ page }) => {
  const nickname = newNickname();
  await startGame(page, nickname, "Geografia");
  await expect(page.getByText("Geografia").first()).toBeVisible();
  await playAllQuestions(page);

  await expect(page.getByText(/no ranking de Geografia/)).toBeVisible();
  await page.getByRole("link", { name: "Ver ranking" }).click();
  await expect(page).toHaveURL(/categoria=geografia/);
  await expect(page.getByRole("row").filter({ hasText: nickname })).toBeVisible();

  await page.getByRole("link", { name: "🎲 Geral" }).click();
  await expect(page.getByRole("heading", { name: /Geral \(Temas Variados\)/ })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: nickname })).toHaveCount(0);
});

test("tempo esgotado conta como erro e avança", async ({ page }) => {
  // Relógio controlado do Playwright: os 30 s passam sem esperar de verdade.
  await page.clock.install();
  await startGame(page, newNickname());
  await expect(page.getByText("1/20", { exact: true })).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();

  await page.clock.fastForward(31_000);
  await expect(page.getByText("⏰ Tempo esgotado")).toBeVisible();
  // Sem resposta escolhida: só a correta aparece marcada.
  await expect(page.getByText("(resposta correta)")).toHaveCount(1);
  await expect(page.getByText("(sua resposta, incorreta)")).toHaveCount(0);

  await page.getByRole("button", { name: "Próxima pergunta" }).click();
  await expect(page.getByText("2/20", { exact: true })).toBeVisible();
});

test("apelido de outro navegador é recusado", async ({ page, browser }) => {
  const nickname = newNickname();
  await startGame(page, nickname);

  // Outro navegador (sem o cookie do apelido) tenta usar o mesmo apelido, com outra caixa.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/");
  await otherPage.getByLabel("Seu apelido").fill(nickname.toUpperCase());
  await otherPage.getByRole("button", { name: "Começar" }).click();
  await expect(otherPage.getByText("Esse apelido já está em uso")).toBeVisible();
  await expect(otherPage).toHaveURL("/");
  await other.close();
});

test("apelido com palavrão é recusado", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Seu apelido").fill("e2e_merda");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByText("Esse apelido não é permitido")).toBeVisible();
  await expect(page).toHaveURL("/");
});
