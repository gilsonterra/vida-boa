import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const OFX = fileURLToPath(new URL('./fixtures/extrato-itau.ofx', import.meta.url));

test('cadastra conta, importa OFX e não duplica ao reimportar', async ({ page }) => {
	await page.goto('./');
	await expect(page.getByRole('heading', { name: /Tudo o que é seu/ })).toBeVisible();

	await page.getByRole('button', { name: 'Cadastrar primeira conta' }).click();
	await page.getByLabel('Nome').fill('Itaú');
	await page.getByRole('button', { name: 'Salvar conta' }).click();
	await expect(page.getByText('Patrimônio')).toBeVisible();

	await page.goto('./#/importar');
	await page.locator('input[type=file]').setInputFiles(OFX);
	// A conta é escolhida sozinha (única conta corrente) e a regra de UBER categoriza.
	await expect(page.getByText('extrato-itau.ofx')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Transporte' })).toBeVisible();
	await page.getByRole('button', { name: 'Importar 3 lançamentos' }).click();
	await expect(page.getByRole('heading', { name: '3 lançamentos em Itaú' })).toBeVisible();

	// Reimportar o mesmo arquivo não cria nada novo.
	await page.getByRole('button', { name: 'Importar outro arquivo' }).click();
	await page.locator('input[type=file]').setInputFiles(OFX);
	await expect(page.getByRole('button', { name: 'Nada novo para importar' })).toBeDisabled();

	await page.goto('./#/extrato');
	await expect(page.getByText('Padaria São João')).toBeVisible();
	await expect(page.getByText('Uber *Trip')).toBeVisible();
});

test('lançamento manual entra no extrato e pode ser desfeito', async ({ page }) => {
	await page.goto('./');
	await page.getByRole('button', { name: 'Cadastrar primeira conta' }).click();
	await page.getByLabel('Nome').fill('Conta');
	await page.getByRole('button', { name: 'Salvar conta' }).click();

	await page.getByRole('button', { name: 'Adicionar' }).first().click();
	await page.getByRole('button', { name: /Novo lançamento/ }).click();
	await page.getByRole('textbox', { name: 'Valor' }).fill('250,00');
	await page.getByLabel('Descrição').fill('Floricultura');
	await page.getByRole('button', { name: 'Salvar', exact: true }).click();
	await expect(page.getByText('Despesa registrada')).toBeVisible();

	await page.goto('./#/extrato');
	await page.getByText('Floricultura').click();
	await page.getByRole('button', { name: 'Excluir' }).click();
	await page
		.getByRole('dialog', { name: 'Excluir lançamento?' })
		.getByRole('button', { name: 'Excluir' })
		.click();
	await expect(page.getByText('Lançamento excluído')).toBeVisible();
	await page.getByRole('button', { name: 'Desfazer' }).click();
	await expect(page.getByText('Floricultura')).toBeVisible();
});

test('abre sem internet depois da primeira visita', async ({ page, context }) => {
	await page.goto('./');
	// Espera o service worker assumir a página (clients.claim) antes de cortar a rede.
	await page.waitForFunction(() => !!navigator.serviceWorker.controller);
	await context.setOffline(true);
	await page.reload();
	await page.goto('./#/relatorios');
	await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
	await context.setOffline(false);
});

test('escolhe uma paleta em Ajustes e ela continua após recarregar', async ({ page }) => {
	await page.goto('./#/ajustes');
	await page.getByRole('radio', { name: /Afrodite/ }).click();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'afrodite');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'afrodite');
	await expect(page.getByRole('radio', { name: /Afrodite/ })).toHaveAttribute(
		'aria-checked',
		'true'
	);
});
