/**
 * Template System
 *
 * This module provides the template layer of the three-layer admin UI model:
 * 1. Resource Definitions (shorthand input)
 * 2. Page Modules (rendering contract)
 * 3. Templates (Svelte renderers) - THIS LAYER
 *
 * Templates are pure renderers that receive page modules as input.
 * They can be overridden by plugins and platform modules.
 */

export {
  resolveTemplate,
  hasTemplate,
  getTemplateKeys,
  getTemplateSources,
  TemplateError,
  type ResolvedTemplate,
  type TemplateResolutionResult,
} from "./resolveTemplate";
