# ENS Identity Extension

This optional extension enables x402 participants to attach ENS identity metadata to a payment without changing settlement semantics. Any party that advertises an ENS identity MUST provide its ENS name and MAY enumerate the relevant ENS record keys. Clients that receive an ENS extension MUST echo the server-supplied fields verbatim when constructing a `PaymentPayload`, and MAY append their own payer metadata without altering the payee entry.

ENS already acts as a multichain identity layer across Ethereum tooling. Many applications and wallets rely on ENS names, text records, and per-network `addr` records to represent merchants, customers, and agents, so the `ens` extension simply reuses that surface. Implementations MAY ignore the extension entirely when ENS metadata is not needed.

## Server `PaymentRequired` example

Servers SHOULD populate `info.payee` whenever they advertise the ENS extension in `PaymentRequired`. The snippet below illustrates a `PaymentRequired` response (HTTP 402) to an unauthenticated request, including the server’s ENS identity (`info.payee.ens`, optional message, and record references). The client may attach `info.payer` later when constructing the `PaymentPayload`.

```json
{
  "extensions": {
    "ens": {
      "info": {
        "payee": {
          "ens": "merchant.eth",
          "message": "merchant identity with supporting KYC/KYB records",
          "records": {
            "text": ["agent-context", "email", "description", "url"],
            "data": ["location-credential", "gov-id-credential"]
          }
        }
      },
      "schema": {
        /* see JSON Schema below */
      }
    }
  }
}
```

## Client `PaymentPayload` example

Clients MUST echo `info.payee` exactly as received and MAY append their own `info.payer` entry when submitting the payment.

```json
{
  "extensions": {
    "ens": {
      "info": {
        "payee": {
          "ens": "merchant.eth",
          "message": "merchant identity with supporting KYC/KYB records",
          "records": {
            "text": ["agent-context", "email", "description", "url"],
            "data": ["location-credential", "gov-id-credential"]
          }
        },
        "payer": {
          "ens": "customer.eth",
          "message": "customer agent identity with verification records referenced below",
          "records": {
            "text": ["agent-context", "email", "description", "url"],
            "data": ["parent-account", "delegate-certificate"]
          }
        }
      },
      "schema": {
        /* see JSON Schema below */
      }
    }
  }
}
```

## ENS JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "payee": {
      "type": "object",
      "properties": {
        "ens": { "type": "string" },
        "message": { "type": "string" },
        "records": {
          "type": "object",
          "properties": {
            "text": { "type": "array", "items": { "type": "string" } },
            "data": { "type": "array", "items": { "type": "string" } }
          }
        }
      },
      "required": ["ens"]
    },
    "payer": {
      "type": "object",
      "properties": {
        "ens": { "type": "string" },
        "message": { "type": "string" },
        "records": {
          "type": "object",
          "properties": {
            "text": { "type": "array", "items": { "type": "string" } },
            "data": { "type": "array", "items": { "type": "string" } }
          }
        }
      },
      "required": ["ens"]
    }
  },
  "required": ["payee"]
}
```

## Semantics

- The extension is informational. Implementations MAY ignore it when ENS metadata is not required.
- When present, the extension MUST include `info.payee`. `info.payer` MAY be provided by the client when returning the payment payload.
- `records.text` and `records.data` indicate which ENS records for the payee or payer identity may be resolved for additional metadata.
- Clients MUST echo the server-provided `info.payee` verbatim, MUST NOT delete or rewrite those fields, and MAY append `info.payer`.
- ENS names in this extension MUST NOT be used as settlement destinations; `payTo`, the selected scheme, and network semantics continue to govern routing.

## Authorizing and verifying ENS identities

The extension does not assert ownership. Applications that require authorization of a specific ENS identity SHOULD perform independent verification. ENS identities associated with both payee and payer addresses MAY be verified using the [ENSIP-19](https://docs.ens.domains/ensip/19/) primary-name workflow. An ENS entry SHOULD be treated as authoritative only after such independent verification succeeds.

## Runtime helpers

The `declareEnsExtension` helper defined in `core.ts` constructs an extension object from an `EnsInfo` payload and validates it against the bundled JSON Schema. It returns `{ valid, errors, extension }`, allowing transmission to be conditioned on successful validation. This entry point accepts both payee and payer metadata. Payee metadata is supplied in `PaymentRequired`. Payer metadata may be appended in `PaymentPayload`.

### Example

```ts
import { declareEnsExtension, type EnsInfo } from "@x402/extensions/ens";

// Server-side declaration for PaymentRequired.
const payeeInfo: EnsInfo = {
  payee: {
    ens: "merchant.eth",
    message: "merchant identity referencing KYC attestations",
    records: {
      text: ["kyc-provider", "support-email"],
      data: ["kyc-credential", "aml-credential"],
    },
  },
};

const payeeDeclaration = declareEnsExtension(payeeInfo);
if (!payeeDeclaration.valid || !payeeDeclaration.extension) {
  throw new Error("ENS extension validation failed");
}
const payeeExtension = payeeDeclaration.extension;

// Client-side augmentation for PaymentPayload.
const payerInfo: EnsInfo = {
  payee: payeeExtension.info.payee,
  payer: {
    ens: "customer-agent.eth",
    message: "customer agent identity referencing delegated attestations",
    records: {
      text: ["agent-context", "support-email"],
      data: ["delegate-certificate"],
    },
  },
};

const payerDeclaration = declareEnsExtension(payerInfo);
if (!payerDeclaration.valid || !payerDeclaration.extension) {
  throw new Error("ENS extension validation failed");
}
const finalizedEnsExtension = payerDeclaration.extension;

// Attach `payeeExtension` to PaymentRequired and `finalizedEnsExtension`
// to PaymentPayload.extensions before transmission.
```
