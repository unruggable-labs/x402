import { config } from "dotenv";
import http from "http";
import express from "express";
import { x402ResourceServer, HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware } from "@x402/express";
import { ENS, declareEnsExtension, type EnsInfo } from "@x402/extensions";

config();

export interface EnsDemoServerHandle {
  server: http.Server;
  stop: () => Promise<void>;
}

export interface EnsDemoServerOptions {
  port?: number;
  facilitatorUrl?: string;
  evmAddress?: `0x${string}`;
}

const ensPayee = "merchant.eth";

const declareEnsExtensions = (info: EnsInfo) => {
  const declaration = declareEnsExtension(info);
  if (!declaration.valid || !declaration.extension) {
    const message = declaration.errors?.join(", ") || "Unknown ENS declaration error";
    throw new Error(`Invalid ENS extension for server configuration: ${message}`);
  }

  return { [ENS]: declaration.extension };
};

export async function startEnsDemoServer(
  options: EnsDemoServerOptions = {},
): Promise<EnsDemoServerHandle> {
  const evmAddress = options.evmAddress ?? (process.env.EVM_ADDRESS as `0x${string}` | undefined);
  if (!evmAddress) {
    throw new Error("EVM_ADDRESS environment variable is required");
  }

  const facilitatorUrl =
    options.facilitatorUrl ?? "https://x402.org/facilitator";
  const port = options.port ?? Number( 4022);

  // Initialize core x402 resource server and HTTP adapter
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    "eip155:84532",
    new ExactEvmScheme(),
  );

  const routes: RoutesConfig = {
    "GET /kyc": {
      accepts: {
        scheme: "exact",
        price: "$0.001",
        network: "eip155:84532",
        payTo: evmAddress,
      },
      description: "KYC-protected account summary",
      mimeType: "application/json",
      extensions: {
        ...declareEnsExtensions({
          payee: {
            ens: ensPayee,
            message: "Merchant identity with supporting KYC/KYB records",
            records: {
              text: ["kyc-provider", "kyc-scope", "support-email"],
              data: ["kyc-credential", "aml-credential"],
            },
          },
        }),
      },
    },
  };

  // Minimal Express app scoped to this example's payment endpoint.
  const app = express();
  // @ts-ignore
  app.use(paymentMiddleware(routes, resourceServer));

  // Protected resource handler; x402 middleware gate keeps before this executes.
  app.get("/kyc", (_req, res) => {
    const accountSummary = {
      account: {
        id: "cust_123",
        kycStatus: "verified",
        limits: {
          daily: "1000 USD",
          monthly: "10000 USD",
        },
      },
    };

    res.json(accountSummary);
  });

  const server = await new Promise<http.Server>((resolve, reject) => {
    const instance = app.listen(port, () => {
      resolve(instance);
    });
    instance.once("error", reject);
  });

  return {
    server,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
}
