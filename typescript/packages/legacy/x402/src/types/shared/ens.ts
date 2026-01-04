import { isAddress } from "viem";
import { ens_normalize } from "@adraffy/ens-normalize";

/**
 * Validates ENS names (ENSIP-15), rejecting raw addresses first.
 *
 * @param value - Candidate ENS label/name.
 * @returns True if the value passes ENSIP-15 normalization.
 */
export function isEnsName(value: string): boolean {
  if (!value) {
    return false;
  }

  if (isAddress(value)) {
    return false;
  }

  try {
    ens_normalize(value);
    return true;
  } catch {
    return false;
  }
}
