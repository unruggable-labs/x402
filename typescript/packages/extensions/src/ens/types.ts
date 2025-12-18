/**
 * Type definitions for the ENS Identity Extension
 */

/**
 * Extension identifier constant for the ENS identity extension
 */
export const ENS = "ens";

/**
 * Hints describing which ENS records may be relevant for this payment.
 *
 * These are non-authoritative lookup hints, not proof of anything by themselves.
 */
export interface EnsRecords {
  /**
   * ENS text record keys that may be relevant.
   */
  text?: string[];

  /**
   * ENS binary/data record keys for arbitrary bytes stored on the resolver
   * that may be relevant.
   */
  data?: string[];
}

/**
 * ENS identity description for a single party (payee or payer).
 */
export interface EnsParty {
  /**
   * ENS name that identifies this party (for example, "merchant.eth").
   */
  ens: string;

  /**
   * Short human-readable context for this ENS identity
   * (for example, "Multichain public identity for merchant").
   */
  message?: string;

  /**
   * Optional hints about which ENS records to inspect for additional context.
   */
  records?: EnsRecords;
}

/**
 * ENS info payload carried in the x402 `extensions.ens.info` object.
 *
 * - `payee` describes the party receiving payment for the gated resource.
 * - `payer` (optional) describes the party authorizing or sending the payment.
 */
export interface EnsInfo {
  payee: EnsParty;
  payer?: EnsParty;
}

/**
 * ENS extension shape as carried in `PaymentRequired.extensions.ens` or
 * `PaymentPayload.extensions.ens`.
 *
 * Only the `info` structure has protocol semantics; `schema` exists to allow
 * validation and introspection.
 */
export const ENS_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    payee: {
      type: "object",
      properties: {
        ens: { type: "string" },
        message: { type: "string" },
        records: {
          type: "object",
          properties: {
            text: { type: "array", items: { type: "string" } },
            data: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["ens"],
    },
    payer: {
      type: "object",
      properties: {
        ens: { type: "string" },
        message: { type: "string" },
        records: {
          type: "object",
          properties: {
            text: { type: "array", items: { type: "string" } },
            data: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["ens"],
    },
  },
  required: ["payee"],
} as const;

export type EnsExtension = {
  info: EnsInfo;
  schema: typeof ENS_SCHEMA;
};

export const getEnsSchema = (): EnsExtension["schema"] => JSON.parse(JSON.stringify(ENS_SCHEMA));
