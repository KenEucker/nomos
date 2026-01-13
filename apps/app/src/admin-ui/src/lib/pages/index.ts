/**
 * Page Module System
 *
 * This module provides the page module layer of the three-layer admin UI model:
 * 1. Resource Definitions (shorthand input)
 * 2. Page Modules (rendering contract) - THIS LAYER
 * 3. Templates (Svelte renderers)
 *
 * Page modules are the interface between data and UI, exposing:
 * - Query functions for data fetching
 * - Action functions for mutations
 * - Layout and configuration
 */

// Types
export type {
  ViewType,
  FormMode,
  ListQueryParams,
  ListQueryResult,
  ListQuery,
  GetQuery,
  CreateAction,
  UpdateAction,
  DeleteAction,
  CustomAction,
  PageContext,
  FormContext,
  ListContext,
  ValidationError,
  ErrorContext,
  SuccessContext,
  BasePageModule,
  ListPageModule,
  FormPageModule,
  ShowPageModule,
  PageModule,
  TemplateProps,
  ListTemplateProps,
  FormTemplateProps,
  ShowTemplateProps,
} from "./types";

// Type guards
export { isListModule, isFormModule, isShowModule } from "./types";

// Compiler
export {
  compileListModule,
  compileFormModule,
  compileShowModule,
  compileAllModules,
  type CompiledModules,
} from "./compileFromResource";

// Resolver
export {
  resolvePageModule,
  resolveListModule,
  resolveFormModule,
  resolveShowModule,
  hasHandwrittenModule,
  getHandwrittenModuleKeys,
  PageModuleError,
  type ResolveOptions,
} from "./resolvePageModule";
