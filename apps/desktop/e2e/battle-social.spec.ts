import { test, expect } from '@playwright/test';

test('matches two real users, synchronizes typing and saves an abandoned duel', async ({ page, browser }) => {
  const context = await browser.newContext();
  const opponent = await context.newPage();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const register = async (target: typeof page, suffix: string) => {
    await target.goto('/');
    await target.getByLabel('Nombre').fill(`Competidor ${suffix}`);
    await target.getByLabel('Correo electrónico').fill(`battle-${suffix}-${unique}@example.com`);
    await target.getByLabel('Contraseña').fill('cross-server-battle-42');
    await target.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(target.getByRole('heading', { name: 'Panel de Inicio' })).toBeVisible();
    await target.getByRole('link', { name: 'Batalla de Código 1v1' }).click();
    await expect(target.getByRole('heading', { name: 'Batalla de Código 1v1' })).toBeVisible();
  };

  try {
    await Promise.all([register(page, 'A'), register(opponent, 'B')]);
    await page.getByRole('button', { name: 'Buscar oponente' }).click();
    await expect(page.getByText(/Estás en la cola/)).toBeVisible();
    await opponent.getByRole('button', { name: 'Buscar oponente' }).click();
    const battleCode = page.locator('.battle-code pre');
    await expect(battleCode).toBeVisible({ timeout: 15_000 });
    await expect(opponent.locator('.battle-code pre')).toHaveText(await battleCode.innerText());
    const input = page.getByRole('textbox', { name: 'Escribe el fragmento del duelo' });
    await expect(input).toBeEnabled({ timeout: 10_000 });
    await input.focus();
    const firstCharacter = await page.locator('.battle-code span').first().textContent();
    expect(firstCharacter).toBeTruthy();
    await page.keyboard.type(firstCharacter, { delay: 60 });
    const progress = opponent.locator('.battle-player').filter({ hasText: 'Competidor A' }).getByRole('progressbar');
    await expect(progress).toHaveAttribute('aria-valuenow', /^(?!0$)\d+$/, { timeout: 5_000 });
    await page.getByRole('button', { name: '¡Buen ritmo!' }).click();
    await expect(opponent.locator('.battle-chat')).toContainText('¡Buen ritmo!');
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page.getByRole('heading', { name: 'Abandonaste la batalla' })).toBeVisible({ timeout: 5_000 });
    await expect(opponent.getByRole('heading', { name: '¡Ganaste el duelo!' })).toBeVisible({ timeout: 5_000 });
  } finally {
    await context.close();
  }
});
