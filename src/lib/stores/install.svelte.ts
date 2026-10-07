/** Instalação do PWA: guarda o evento do navegador para oferecer "Instalar" no momento certo. */

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

export const install = $state({
	available: false,
	installed: false,
	/** iOS não dispara o evento; lá a instalação é pelo menu Compartilhar. */
	ios: false
});

export function initInstall() {
	install.installed =
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	install.ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
	addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferred = e as BeforeInstallPromptEvent;
		install.available = true;
	});
	addEventListener('appinstalled', () => {
		install.installed = true;
		install.available = false;
	});
}

export async function promptInstall() {
	if (!deferred) return;
	await deferred.prompt();
	await deferred.userChoice;
	deferred = null;
	install.available = false;
}
