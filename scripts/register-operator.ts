/**
 * Registers the runner/settler operator EOA as a trusted operator on
 * AttributionVerifier. Idempotent: if the operator is already trusted, the
 * script logs and exits 0 without sending a tx.
 *
 * Required env (in .env at repo root):
 *   DEPLOYER_PRIVATE_KEY  — the EOA that deployed the contracts (= verifier owner)
 *   OPERATOR_PRIVATE_KEY  — the EOA the runner/settler signs with
 *
 * The verifier's `trustedOperators(address) returns (bool)` getter is the
 * source of truth (auto-generated from the `public mapping` in
 * contracts/src/AttributionVerifier.sol). The setter is
 * `setTrustedOperator(address, bool)` and is `onlyOwner`, which is why this
 * has to run from the deployer key.
 */

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployments from "../deployments.json" with { type: "json" };

const RPC_URL =
  process.env["ZERO_G_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";

const VERIFIER_ABI = [
  {
    name: "trustedOperators",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "operator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "setTrustedOperator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operatorAddr", type: "address" },
      { name: "trusted", type: "bool" },
    ],
    outputs: [],
  },
] as const;

function requireEnv(name: string): Hex {
  const raw = process.env[name];
  if (!raw || !raw.startsWith("0x")) {
    throw new Error(`${name} is unset or not 0x-prefixed in .env`);
  }
  return raw as Hex;
}

async function main(): Promise<void> {
  const deployerKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  const operatorKey = requireEnv("OPERATOR_PRIVATE_KEY");

  const deployer = privateKeyToAccount(deployerKey);
  const operator = privateKeyToAccount(operatorKey);

  const verifier = deployments.testnet.contracts.AttributionVerifier as Hex;
  if (!verifier || !verifier.startsWith("0x")) {
    throw new Error(
      "AttributionVerifier address missing from deployments.json testnet.contracts",
    );
  }

  console.log(`[register-operator] RPC: ${RPC_URL}`);
  console.log(`[register-operator] verifier: ${verifier}`);
  console.log(`[register-operator] deployer: ${deployer.address}`);
  console.log(`[register-operator] operator: ${operator.address}`);

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const wallet = createWalletClient({
    account: deployer,
    transport: http(RPC_URL),
  });

  const alreadyTrusted = await publicClient.readContract({
    address: verifier,
    abi: VERIFIER_ABI,
    functionName: "trustedOperators",
    args: [operator.address],
  });

  if (alreadyTrusted) {
    console.log("operator already trusted");
    return;
  }

  console.log("[register-operator] operator not yet trusted; sending tx...");
  const hash = await wallet.writeContract({
    address: verifier,
    abi: VERIFIER_ABI,
    functionName: "setTrustedOperator",
    args: [operator.address, true],
    account: deployer,
    chain: undefined,
  });
  console.log(`[register-operator] txHash: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 2_000,
    retryCount: 60,
    timeout: 120_000,
  });
  if (receipt.status !== "success") {
    throw new Error(
      `setTrustedOperator tx ${hash} reverted (status=${receipt.status})`,
    );
  }
  console.log(
    `[register-operator] operator ${operator.address} registered in block ${receipt.blockNumber}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
