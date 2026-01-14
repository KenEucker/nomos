import { writable } from "svelte/store";

export type PageBreadcrumb = {
  label: string;
  href?: string;
};

export type PageAction = {
  label: string;
  href: string;
  variant?: string;
};

export type ShellState = {
  title?: string;
  subtitle?: string;
  breadcrumbs?: PageBreadcrumb[];
  actions?: PageAction[];
};

export const shell = writable<ShellState>({});
