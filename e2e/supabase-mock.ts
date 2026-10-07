import type { Page } from '@playwright/test';

/**
 * Supabase simulado para os testes: responde Auth (login, cadastro, recuperação) e a API REST
 * no próprio navegador do Playwright, sem tocar no projeto real. A senha "errada" falha;
 * o cadastro de "confirmar@exemplo.com" exige confirmação por e-mail.
 */

export const USER = {
	id: '6f1d2c3b-4a59-4e2f-9b8a-7c6d5e4f3a21',
	email: 'teste@exemplo.com',
	password: 'senha-segura-123'
};

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function session() {
	const exp = Math.floor(Date.now() / 1000) + 3600;
	const user = {
		id: USER.id,
		aud: 'authenticated',
		role: 'authenticated',
		email: USER.email,
		email_confirmed_at: new Date().toISOString(),
		app_metadata: { provider: 'email' },
		user_metadata: {},
		created_at: new Date().toISOString()
	};
	const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp })}.assinatura`;
	return {
		access_token: token,
		token_type: 'bearer',
		expires_in: 3600,
		expires_at: exp,
		refresh_token: 'refresh-token',
		user
	};
}

export async function mockSupabase(page: Page) {
	const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => ({
		status,
		contentType: 'application/json',
		headers: { 'access-control-allow-origin': '*', ...headers },
		body: JSON.stringify(body)
	});

	await page.route(/supabase\.co\/auth\/v1\//, async (route) => {
		const req = route.request();
		const url = new URL(req.url());
		if (req.method() === 'OPTIONS')
			return route.fulfill({
				status: 204,
				headers: {
					'access-control-allow-origin': '*',
					'access-control-allow-headers': '*',
					'access-control-allow-methods': '*'
				}
			});
		const body = req.postDataJSON?.() ?? {};

		if (url.pathname.endsWith('/token')) {
			if (body.password !== USER.password) {
				return route.fulfill(
					json(
						{ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
						400
					)
				);
			}
			return route.fulfill(json(session()));
		}
		if (url.pathname.endsWith('/signup')) {
			if (body.email === 'confirmar@exemplo.com') {
				return route.fulfill(
					json({
						id: crypto.randomUUID(),
						email: body.email,
						aud: 'authenticated',
						role: '',
						identities: [{}],
						created_at: new Date().toISOString()
					})
				);
			}
			return route.fulfill(json(session()));
		}
		if (url.pathname.endsWith('/recover')) return route.fulfill(json({}));
		if (url.pathname.endsWith('/logout'))
			return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
		if (url.pathname.endsWith('/user')) return route.fulfill(json(session().user));
		return route.fulfill(json({}));
	});

	// API REST: a nuvem começa vazia e aceita tudo o que o app sobe.
	await page.route(/supabase\.co\/rest\/v1\//, async (route) => {
		const req = route.request();
		if (req.method() === 'OPTIONS')
			return route.fulfill({
				status: 204,
				headers: {
					'access-control-allow-origin': '*',
					'access-control-allow-headers': '*',
					'access-control-allow-methods': '*'
				}
			});
		if (req.method() === 'GET' || req.method() === 'HEAD') {
			return route.fulfill(json([], 200, { 'content-range': '*/0' }));
		}
		return route.fulfill({
			status: 201,
			headers: { 'access-control-allow-origin': '*' },
			body: ''
		});
	});

	// Realtime: aceita a conexão e não manda nada.
	await page.routeWebSocket(/supabase\.co\/realtime/, () => {});
}

/** Abre o app e entra com o usuário de teste. */
export async function login(page: Page) {
	await mockSupabase(page);
	await page.goto('./');
	await page.getByLabel('E-mail').fill(USER.email);
	await page.getByLabel('Senha', { exact: true }).fill(USER.password);
	await page.getByRole('button', { name: 'Entrar', exact: true }).click();
	await page.getByRole('heading', { name: /Tudo o que é seu/ }).waitFor();
}
