import {
	Baby,
	Bike,
	Briefcase,
	Building2,
	Car,
	Circle,
	Coins,
	Fuel,
	Gift,
	GraduationCap,
	HeartPulse,
	House,
	KeyRound,
	Landmark,
	PawPrint,
	PenLine,
	Pill,
	Plane,
	Receipt,
	Repeat,
	Shield,
	Shirt,
	ShoppingBag,
	ShoppingBasket,
	Sparkles,
	Ticket,
	TrendingUp,
	Undo2,
	Utensils,
	Wrench,
	Wallet,
	CreditCard,
	PiggyBank,
	Banknote,
	ChartLine,
	HandCoins
} from '@lucide/svelte';
import type { Component } from 'svelte';
import type { AccountKind } from '../domain/types';

/** Catálogo de ícones disponíveis para categorias (o nome fica gravado no banco). */
export const CATEGORY_ICONS: Record<string, Component> = {
	home: House,
	wrench: Wrench,
	basket: ShoppingBasket,
	utensils: Utensils,
	bike: Bike,
	car: Car,
	fuel: Fuel,
	plane: Plane,
	'heart-pulse': HeartPulse,
	pill: Pill,
	sparkles: Sparkles,
	graduation: GraduationCap,
	baby: Baby,
	paw: PawPrint,
	ticket: Ticket,
	bag: ShoppingBag,
	shirt: Shirt,
	repeat: Repeat,
	gift: Gift,
	shield: Shield,
	landmark: Landmark,
	receipt: Receipt,
	circle: Circle,
	briefcase: Briefcase,
	building: Building2,
	'trending-up': TrendingUp,
	coins: Coins,
	key: KeyRound,
	pen: PenLine,
	undo: Undo2,
	'hand-coins': HandCoins
};

export function categoryIcon(name: string | undefined): Component {
	return (name && CATEGORY_ICONS[name]) || Circle;
}

export const ACCOUNT_KIND_ICON: Record<AccountKind, Component> = {
	checking: Landmark,
	savings: PiggyBank,
	credit_card: CreditCard,
	investment: ChartLine,
	cash: Banknote,
	other: Wallet
};
