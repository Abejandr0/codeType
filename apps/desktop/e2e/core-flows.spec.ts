import { test, expect } from '@playwright/test';

test('registers, loads seeded exercises, and saves a completed typing attempt', async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/');
  await page.getByLabel('Nombre').fill('Practicante CodeType');
  await page.getByLabel('Correo electrónico').fill(`e2e-${unique}@example.com`);
  await page.getByLabel('Contraseña').fill('correct-horse-42');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Panel de Inicio' })).toBeVisible();
  await page.getByRole('link', { name: 'Ejercicios' }).click();
  await expect(page.getByRole('heading', { name: 'Ejercicios' })).toBeVisible();
  await expect(page.getByText('Mostrar un mensaje')).toBeVisible();
  await page.getByRole('link', { name: /Mostrar un mensaje/ }).click();
  const input = page.getByRole('textbox', { name: 'Escribe el código mostrado' });
  await input.focus();
  const savedAttempt = page.waitForResponse(response => response.url().includes('/lessons/complete') && response.request().method() === 'POST');
  await page.keyboard.type('print("Hola, mundo")', { delay: 55 });
  const response = await savedAttempt;
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).passed).toBeTruthy();
  await expect(page.getByText('¡Lección completada!')).toBeVisible();
  await expect(page.getByText(/100(?:\.0)?% de precisión/)).toBeVisible();
});
