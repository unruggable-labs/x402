import { Address, Chain, LocalAccount, Transport } from "viem";
import { isSignerWallet, SignerWallet } from "../../../types/shared/evm";
import { PaymentPayload, PaymentRequirements, UnsignedPaymentPayload } from "../../../types/verify";
import { EvmNetworkToChainId, Network, NonEvmCoinTypes } from "../../../types/shared/network";
import { isEnsName } from "../../../types/shared/ens";
import { createNonce, signAuthorization } from "./sign";
import { encodePayment } from "./utils/paymentUtils";

/**
 * Prepares an unsigned payment header with the given sender address and payment requirements.
 *
 * @param from - The sender's address from which the payment will be made
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns An unsigned payment payload containing authorization details
 */
export function preparePaymentHeader(
  from: Address,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): UnsignedPaymentPayload {
  const nonce = createNonce();

  const validAfter = BigInt(
    Math.floor(Date.now() / 1000) - 600, // 10 minutes before
  ).toString();
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000 + paymentRequirements.maxTimeoutSeconds),
  ).toString();

  return {
    x402Version,
    scheme: paymentRequirements.scheme,
    network: paymentRequirements.network,
    payload: {
      signature: undefined,
      authorization: {
        from,
        to: paymentRequirements.payTo as Address,
        value: paymentRequirements.maxAmountRequired,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };
}

// EVM coin types live in the dedicated >= 0x80000000 range (ENSIP-11).
const EVM_COIN_TYPE_MSB = BigInt(0x80000000);

/**
 * Converts an EVM chain id to its ENSIP-11 coin type.
 * coinType = (0x80000000 OR chainId)
 *
 * @param chainId - The EVM chain id to convert.
 * @returns Coin type as bigint.
 */
function toEvmCoinType(chainId: number | bigint): bigint {
  return EVM_COIN_TYPE_MSB | BigInt(chainId);
}

/**
 * Derives the coin type for ENS resolution.
 *
 * @param network - x402 payment network used to pick the primary coin type.
 * @returns Coin type to pass to the ENS resolver.
 */
function resolveCoinType(network: Network): bigint {
  const evmChainId = EvmNetworkToChainId.get(network);

  if (evmChainId !== undefined) {
    return toEvmCoinType(evmChainId);
  }

  const nonEvmCoinType = NonEvmCoinTypes[network];
  if (nonEvmCoinType !== undefined) {
    return nonEvmCoinType;
  }

  throw new Error(
    `Unsupported network "${network}" for ENS resolution. Provide a known network-to-chain mapping.`,
  );
}

/**
 * Given PaymentRequirements that may contain an ENS name in `payTo`
 * If `payTo` is already an address, return as-is.
 * If `payTo` is an ENS name, resolve it using the payment network’s coin type.
 *
 * @param paymentRequirements - PaymentRequirements with possible ENS name,
 * @param client - The signer wallet used to resolve ENS names.
 * @returns a clone where `payTo` is always a concrete address.
 */
export async function normalizePayTo<
  TChain extends Chain = Chain,
  TTransport extends Transport = Transport,
>(
  paymentRequirements: PaymentRequirements,
  client: SignerWallet<TChain, TTransport> | LocalAccount,
): Promise<PaymentRequirements> {
  const payTo = paymentRequirements.payTo as string;

  if (!isEnsName(payTo)) {
    return paymentRequirements;
  }

  if (!isSignerWallet(client)) {
    throw new Error("ENS name resolution requires a signer wallet client");
  }

  // Resolve ENS name against the network-derived coinType (ENSIP-11)
  const coinType = resolveCoinType(paymentRequirements.network);

  const resolved = (await client.getEnsAddress({
    name: payTo,
    coinType,
  })) as Address | null;

  if (!resolved) {
    throw new Error(
      `Could not resolve ENS name "${payTo}" for network "${paymentRequirements.network}"`,
    );
  }

  return {
    ...paymentRequirements,
    payTo: resolved as Address,
  };
}

/**
 * Signs a payment header using the provided client and payment requirements.
 *
 * @param client - The signer wallet instance used to sign the payment header
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @param unsignedPaymentHeader - The unsigned payment payload to be signed
 * @returns A promise that resolves to the signed payment payload
 */
export async function signPaymentHeader<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport> | LocalAccount,
  paymentRequirements: PaymentRequirements,
  unsignedPaymentHeader: UnsignedPaymentPayload,
): Promise<PaymentPayload> {
  const { signature } = await signAuthorization(
    client,
    unsignedPaymentHeader.payload.authorization,
    paymentRequirements,
  );

  return {
    ...unsignedPaymentHeader,
    payload: {
      ...unsignedPaymentHeader.payload,
      signature,
    },
  };
}

/**
 * Creates a complete payment payload by preparing and signing a payment header.
 *
 * @param client - The signer wallet instance used to create and sign the payment
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns A promise that resolves to the complete signed payment payload
 */
export async function createPayment<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport> | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<PaymentPayload> {
  const from = isSignerWallet(client) ? client.account!.address : client.address;

  const normalizedRequirements = await normalizePayTo(paymentRequirements, client);

  const unsignedPaymentHeader = preparePaymentHeader(from, x402Version, normalizedRequirements);
  return signPaymentHeader(client, normalizedRequirements, unsignedPaymentHeader);
}

/**
 * Creates and encodes a payment header for the given client and payment requirements.
 *
 * @param client - The signer wallet instance used to create the payment header
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns A promise that resolves to the encoded payment header string
 */
export async function createPaymentHeader(
  client: SignerWallet | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<string> {
  const payment = await createPayment(client, x402Version, paymentRequirements);
  return encodePayment(payment);
}
