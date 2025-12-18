/**
 * Tests for ENS Identity Extension
 */

import { describe, it, expect } from "vitest";
import { ENS, buildEnsExtension, declareEnsExtension, validateEnsExtension } from "../src/ens";
import type { EnsExtension, EnsInfo } from "../src/ens";

describe("ENS Identity Extension", () => {
  it("should export the correct extension identifier", () => {
    expect(ENS).toBe("ens");
  });

  it("should create an ENS extension with payee only", () => {
    const info: EnsInfo = {
      payee: {
        ens: "merchant.eth",
        message: "merchant identity with supporting KYC/KYB records",
        records: {
          text: ["email", "description", "url"],
          data: ["location-credential", "gov-id-credential"],
        },
      },
    };

    const extension = buildEnsExtension(info);

    expect(extension.info).toEqual(info);
    expect(extension.schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(extension.schema.type).toBe("object");
    expect(extension.schema.required).toContain("payee");
    expect(extension.schema.properties.payee.required).toContain("ens");
  });

  it("should create an ENS extension with both payee and payer", () => {
    const info: EnsInfo = {
      payee: {
        ens: "merchant.eth",
        message: "merchant identity with supporting KYC/KYB records",
        records: {
          text: ["agent-context", "email", "description", "url"],
          data: ["location-credential", "gov-id-credential"],
        },
      },
      payer: {
        ens: "customer.eth",
        message: "customer agent identity with verification records referenced below",
        records: {
          text: ["agent-context", "email", "description", "url"],
          data: ["parent-account", "delegate-certificate"],
        },
      },
    };

    const extension = buildEnsExtension(info);

    expect(extension.info).toEqual(info);
    expect(extension.schema.properties.payer).toBeDefined();
    expect(extension.schema.properties.payee).toBeDefined();
    expect(extension.schema.properties.payer.required).toContain("ens");
  });

  it("should validate a correct ENS extension", () => {
    const info: EnsInfo = {
      payee: {
        ens: "merchant.eth",
      },
      payer: {
        ens: "customer.eth",
      },
    };

    const extension = buildEnsExtension(info);
    const directValidation = validateEnsExtension(extension);
    const declared = declareEnsExtension(info);

    expect(directValidation.valid).toBe(true);
    expect(directValidation.errors).toBeUndefined();

    expect(declared.valid).toBe(true);
    expect(declared.errors).toBeUndefined();
    expect(declared.extension).toEqual(extension);
  });

  it("should detect an invalid ENS extension", () => {
    const info: EnsInfo = {
      // @ts-expect-error - intentionally invalid type for ens
      payee: { ens: 12345 },
    };

    const extension = buildEnsExtension(info as EnsInfo);
    const directValidation = validateEnsExtension(extension as EnsExtension);
    const declared = declareEnsExtension(info as EnsInfo);

    expect(directValidation.valid).toBe(false);
    expect(directValidation.errors).toBeDefined();

    expect(declared.valid).toBe(false);
    expect(declared.errors).toBeDefined();
    expect(declared.extension).toBeUndefined();
  });
});
