import { config } from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { ENS, validateEnsExtension, type EnsExtension } from "@x402/extensions";
import type { EnsDemoServerHandle } from "./server";
import { startEnsDemoServer } from "./server";
import { PaymentRequirements } from "@x402/core/types";

config();

/**
 * ENS demo flow:
 * 1. Start the bundled resource server (provides ENS payee info in PaymentRequired).
 * 2. Request the protected endpoint without payment to obtain requirements + server ENS data.
 * 3. Attach client (payer) ENS identity to the extension and send the payment payload.
 * 4. Validate that the final payload still matches the ENS schema and stop the demo server.
 */
const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const url = process.env.RESOURCE_SERVER_URL || "http://localhost:4022/kyc";

let server: EnsDemoServerHandle | undefined;

async function main(): Promise<void> {
  const payeeEns = "merchant.eth";
  const payerEns = "customer.eth";

  console.log("\nENS Identity Extension Example\n");
  console.log(`Using resource server URL: ${url}`);
  console.log(`Using payee ENS: ${payeeEns}`);
  console.log(`Using payer ENS: ${payerEns}\n`);

  if (!evmPrivateKey) {
    console.error("EVM_PRIVATE_KEY required");
    process.exit(1);
  }

  // Spin up the local resource server that advertises ENS payee info.
  console.log("Starting local ENS demo server...");
  server = await startEnsDemoServer();

  const evmSigner = privateKeyToAccount(evmPrivateKey);

  const client = new x402Client((_version, requirements) => requirements[0]).register(
    "eip155:*",
    new ExactEvmScheme(evmSigner),
  );
  console.log("x402 client ready\n");

  const payerIdentity = {
    ens: payerEns,
    message: "customer agent identity with verification records referenced below",
    records: {
      text: ["agent-context", "email", "description", "url"],
      data: ["parent-account", "delegate-certificate"],
    },
  };

  // Step 1: Make initial request without payment.
  console.log(`\nMaking initial request to: ${url}\n`);
  let response = await fetch(url);
  console.log(`Initial response status: ${response.status}\n`);

  // Step 2: Handle 402 Payment Required
  if (response.status === 402) {
    console.log("Payment required! Processing...\n");

    const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
    if (!paymentRequiredHeader) {
      throw new Error("Missing PAYMENT-REQUIRED header");
    }

    const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);

    const requirements: PaymentRequirements[] = Array.isArray(paymentRequired.accepts)
      ? paymentRequired.accepts
      : [paymentRequired.accepts];

    console.log("Payment requirements:");
    requirements.forEach((req, i) => {
      console.log(`   ${i + 1}. ${req.network} / ${req.scheme} - ${req.amount}`);
    });

    const payeeEnsExtension = paymentRequired.extensions?.[ENS];
    if (payeeEnsExtension && typeof payeeEnsExtension === "object") {
      const { payee } = (payeeEnsExtension as EnsExtension).info;
      console.log("\nServer provided payee ENS extension in PaymentRequired:");
      console.log("  payee:", payee);
    } else {
      console.log("\nNo ENS extension present in PaymentRequired (server may not advertise ENS).");
    }

    // Step 3: Create payment payload via x402 client
    console.log("\nCreating payment payload with x402 client...\n");
    const paymentPayload = await client.createPaymentPayload(paymentRequired);

    const currentEnsExtension = paymentPayload.extensions?.[ENS];
    if (!currentEnsExtension || typeof currentEnsExtension !== "object") {
      throw new Error("Server did not provide an ENS extension; cannot demonstrate ENS echo.");
    }

    const ensPayloadExtension: EnsExtension = {
      ...(currentEnsExtension as EnsExtension),
      info: {
        ...(currentEnsExtension as EnsExtension).info,
        payer: payerIdentity,
      },
    };

    // Attach ENS extension to the PaymentPayload.extensions.
    paymentPayload.extensions = {
      ...paymentPayload.extensions,
      [ENS]: ensPayloadExtension,
    };

    console.log("Final ENS extension info in PaymentPayload:");
    console.log("  payee:", ensPayloadExtension.info.payee);
    console.log("  payer:", ensPayloadExtension.info.payer);

    // Step 4: Validate the ENS extension in the final payload (should still be valid).
    const ensFromPayload = paymentPayload.extensions?.[ENS];
    if (ensFromPayload && typeof ensFromPayload === "object") {
      console.log("\nENS extension validation (from PaymentPayload):");
      console.log(validateEnsExtension(ensFromPayload as EnsExtension));
    }

    console.log("\n✅ ENS identity successfully echoed in PaymentPayload extensions.");
    return;
  }
}

main()
  .catch((error) => {
    console.error("Error running ENS extension example:", error);
    process.exit(1);
  })
  .finally(async () => {
    if (server) {
      console.log("\nStopping demo server...");
      try {
        await server.stop();
      } catch (error) {
        console.error("Error stopping ENS demo server:", error);
      }
    }
  });
