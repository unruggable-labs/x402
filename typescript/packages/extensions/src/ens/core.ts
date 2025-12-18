import Ajv from "ajv/dist/2020";
import type { ErrorObject } from "ajv";
import type { EnsExtension, EnsInfo } from "./types";
import { getEnsSchema } from "./types";

/**
 * Minimal result returned from runtime ENS schema validation.
 */
export interface EnsExtensionValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface EnsExtensionDeclaration extends EnsExtensionValidationResult {
  /**
   * The constructed ENS extension when validation succeeds.
   *
   * For invalid declarations this will be `undefined`.
   */
  extension?: EnsExtension;
}

/**
 * Converts Ajv error objects into readable strings for callers.
 *
 * @param errors - Ajv validation errors to format
 * @returns Array of human-readable error messages
 */
const formatValidationErrors = (errors: ErrorObject[] | null | undefined): string[] => {
  if (!errors || errors.length === 0) {
    return ["Unknown validation error"];
  }

  return errors.map(err => {
    const path = err.instancePath || "(root)";
    return `${path}: ${err.message}`;
  });
};

/**
 * A helper to construct an ENS extension from an `EnsInfo` payload.
 *
 * @param info - ENS extension info details
 * @returns ENS extension object with attached JSON Schema
 */
export const buildEnsExtension = (info: EnsInfo): EnsExtension => ({
  info,
  schema: getEnsSchema(),
});

/**
 * Validates an ENS extension's info against its attached JSON Schema.
 *
 * @param extension - The ENS extension containing `info` and `schema`
 * @returns Validation result indicating whether `info` matches `schema`
 */
export function validateEnsExtension(extension: EnsExtension): EnsExtensionValidationResult {
  try {
    const ajv = new Ajv({ strict: false, allErrors: true });
    const validate = ajv.compile(extension.schema);

    const valid = validate(extension.info);

    if (valid) {
      return { valid: true };
    }

    return { valid: false, errors: formatValidationErrors(validate.errors) };
  } catch (error) {
    return {
      valid: false,
      errors: [
        `ENS schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Primary helper to construct an ENS extension from an `EnsInfo` payload and
 * validate it against the attached JSON Schema.
 *
 * @param info - ENS identity information
 * @returns Validation result including the constructed extension when valid
 */
export function declareEnsExtension(info: EnsInfo): EnsExtensionDeclaration {
  const ensExtension = buildEnsExtension(info);
  const validation = validateEnsExtension(ensExtension);

  if (validation.valid) {
    return { ...validation, extension: ensExtension };
  }

  return {
    ...validation,
    extension: undefined,
  };
}
