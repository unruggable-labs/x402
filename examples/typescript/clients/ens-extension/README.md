# ENS Identity Extension Example

This example demonstrates how to construct and utilize the x402 `ens` extension using the shared `@x402/extensions` package. A local resource server acts as the merchant (payee) by advertising its ENS identity in `PaymentRequired`, and the client acts as the payer (echoing that ENS data and adding its own identity before sending a `PaymentPayload`). 

Settlement semantics remain unchanged; the example focuses on how ENS identity metadata propagates through the protocol. Consistent with the extension rules, the client echoes the server-provided payee fields verbatim and only appends payer metadata.

End-to-end sequence:

1. The script launches a bundled resource server, which exposes `/kyc` and advertises the merchant ENS profile.
2. An unauthenticated request is issued and `PaymentRequired` is returned with the server’s ENS metadata.
3. The payer ENS profile is attached to the extension, the payment payload is submitted, and the server observes the echoed data.
4. Validate that the ENS extension still matches the schema and shut down the demo server.

## Setup

From the x402 repo root:

```bash
cd examples/typescript
pnpm install
pnpm build        # builds the workspace packages (including @x402/extensions)
cd clients/ens-extension
cp .env.example .env
```

Edit `.env` and set the required values:

| Variable                  | Purpose                                                                             | Required |
| ------------------------- | ----------------------------------------------------------------------------------- | -------- |
| `EVM_PRIVATE_KEY`         | Client private key used by the x402 SDK                                             | Yes      |
| `EVM_ADDRESS`             | Required for the bundled demo server (always used in this example)                  | Yes      |
| `RESOURCE_SERVER_URL`     | Override to point at your own resource server (defaults to the bundled demo server) | Optional |

## Running the example

By default the script launches the bundled demo server on `http://localhost:4022`, exercises the ENS extension, and shuts the server down after the validation step. Execution requires `EVM_PRIVATE_KEY` and `EVM_ADDRESS`. The example can then be started with:

```bash
pnpm dev
```

To target an external resource server instead of the bundled instance, set `RESOURCE_SERVER_URL` before running the same command. The client then bypasses the embedded server and connects to the configured URL. `pnpm dev:e2e` rebuilds `@x402/extensions` and then executes `pnpm dev` using the current environment.

## Verifying ENS identities

The example demonstrates data exchange only; client implementations MAY perform verification. ENS identities for both merchant and payer addresses can be verified using the [ENSIP-19](https://docs.ens.domains/ensip/19/) primary-name workflow. Only treat an ENS entry as authoritative once independent checks succeed.
