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
  const input = page.getByRole('textbox', { name: 'Escribe el código tal como aparece. Pegar está desactivado.' });
  await input.focus();
  const savedAttempt = page.waitForResponse(response => response.url().includes('/lessons/complete') && response.request().method() === 'POST');
  await page.keyboard.type('print("Hola, mundo")', { delay: 55 });
  const response = await savedAttempt;
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).passed).toBeTruthy();
  await expect(page.getByText('¡Lección completada!')).toBeVisible();
  await expect(page.getByText(/100(?:\.0)?% de precisión/)).toBeVisible();
  await page.getByRole('link', { name: 'Estadísticas' }).click();
  await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible();
  await expect(page.getByText('Velocidad promedio')).toBeVisible();
  await expect(page.locator('canvas[aria-label="Gráfica de progreso de velocidad y precisión"]')).toBeVisible();
  await page.getByRole('button', { name: 'Todo' }).click();
  await expect(page.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true');
});

test('updates profile and preferences, exports data, and deletes its test account', async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/');
  await page.getByLabel('Nombre').fill('Cuenta de ajustes');
  await page.getByLabel('Correo electrónico').fill(`settings-${unique}@example.com`);
  await page.getByLabel('Contraseña').fill('settings-account-42');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Panel de Inicio' })).toBeVisible();
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();

  await page.getByLabel('Nombre', { exact: true }).fill('Cuenta actualizada');
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByText('Perfil actualizado.')).toBeVisible();
  await expect(page.locator('.profile-copy strong')).toHaveText('Cuenta actualizada');

  await page.locator('select[name="interfaceLanguage"]').selectOption('EN');
  await page.locator('select[name="keyboardLayout"]').selectOption('LATAM');
  await page.locator('input[name="dailyGoalMinutes"]').fill('35');
  await page.getByRole('button', { name: 'Guardar ajustes' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('select[name="keyboardLayout"]')).toHaveValue('LATAM');
  await expect(page.locator('input[name="dailyGoalMinutes"]')).toHaveValue('35');
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.locator('nav').getByRole('link', { name: /Exercises/ }).click();
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();
  await page.locator('.lesson-grid > a').first().click();
  await expect(page.getByRole('heading', { name: 'Code practice' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Type the code as shown. Pasting is disabled.' })).toBeVisible();
  await page.getByRole('link', { name: /Exercises/ }).first().click();
  await page.locator('nav').getByRole('link', { name: /Statistics/ }).click();
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  await page.locator('nav').getByRole('link', { name: /Settings/ }).click();

  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  const download = await downloadWait;
  expect(download.suggestedFilename()).toMatch(/^codetype-datos-\d{4}-\d{2}-\d{2}\.json$/);

  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 5_000 });
});
