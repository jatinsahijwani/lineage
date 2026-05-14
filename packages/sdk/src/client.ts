import { createPublicClient, createWalletClient, http, type WalletClient, type PublicClient, type Account } from "viem";
import type {
  LineageClientConfig,
  MintDataParams,
  MintModelParams,
  MintSkillParams,
  InferenceParams,
  InferenceResult,
  LineageEdge,
  RoyaltyPolicy,
} from "@lineage/shared";
import { encrypt, generateKey, sha256, serializeBlob } from "@lineage/crypto";
import { buildMockReceipt, validateReceipt } from "./receipt.js";

// Minimal ABIs for the contracts we interact with
const REGISTRY_ABI = [
  {
    name: "getINFT",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "storageRoot", type: "bytes32" },
          { name: "owner", type: "address" },
          { name: "iType", type: "uint8" },
          { name: "royaltyBps", type: "uint16" },
          { name: "royaltyReceiver", type: "address" },
          { name: "createdAt", type: "uint64" },
          { name: "paused", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getParents",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "child", type: "uint256" },
          { name: "parent", type: "uint256" },
          { name: "weightBps", type: "uint16" },
          { name: "eType", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "getRoyaltyPolicy",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "totalRoyaltyBps", type: "uint16" },
          { name: "paymentToken", type: "address" },
          { name: "pauseUntil", type: "uint64" },
          { name: "ownerSplitBps", type: "uint16" },
        ],
      },
    ],
  },
] as const;

const INFT_ABI = [
  {
    name: "mintWithLineage",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "storageRoot", type: "bytes32" },
      { name: "encryptedMetaHash", type: "bytes32" },
      {
        name: "parents",
        type: "tuple[]",
        components: [
          { name: "child", type: "uint256" },
          { name: "parent", type: "uint256" },
          { name: "weightBps", type: "uint16" },
          { name: "eType", type: "uint8" },
        ],
      },
      {
        name: "policy",
        type: "tuple",
        components: [
          { name: "totalRoyaltyBps", type: "uint16" },
          { name: "paymentToken", type: "address" },
          { name: "pauseUntil", type: "uint64" },
          { name: "ownerSplitBps", type: "uint16" },
        ],
      },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

const SPLITTER_ABI = [
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export class LineageClient {
  private config: LineageClientConfig;
  private publicClient: PublicClient;

  constructor(config: LineageClientConfig) {
    this.config = config;
    this.publicClient = createPublicClient({
      transport: http(config.rpc),
    });
  }

  async mintData(params: MintDataParams & { wallet: WalletClient; account: Account }) {
    const { blob, encrypt: shouldEncrypt, royaltyBps, ownerSplitBps, paymentToken, wallet, account } = params;

    let storageRoot: `0x${string}`;
    let encryptedMetaHash: `0x${string}`;

    if (shouldEncrypt) {
      const key = await generateKey();
      const encrypted = await encrypt(blob, key);
      storageRoot = encrypted.keyHash;
      const serialized = serializeBlob(encrypted);
      encryptedMetaHash = await sha256(serialized);
    } else {
      storageRoot = await sha256(blob);
      encryptedMetaHash = storageRoot;
    }

    const policy = {
      totalRoyaltyBps: royaltyBps,
      paymentToken: paymentToken ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`),
      pauseUntil: 0n,
      ownerSplitBps,
    };

    const hash = await wallet.writeContract({
      address: this.config.dataINFT,
      abi: INFT_ABI,
      functionName: "mintWithLineage",
      args: [account.address, storageRoot, encryptedMetaHash, [], policy],
      account,
      chain: undefined,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
        pollingInterval: 8000,     // 8 seconds
        retryCount: 50,
        timeout: 480_000,
    });
    const tokenId = this._parseTokenIdFromReceipt(receipt);
    return { tokenId, hash };
  }

  async mintModel(params: MintModelParams & { wallet: WalletClient; account: Account }) {
    const { weights, encrypt: shouldEncrypt, parents, royaltyBps, ownerSplitBps, paymentToken, wallet, account } = params;

    let storageRoot: `0x${string}`;
    let encryptedMetaHash: `0x${string}`;

    if (shouldEncrypt) {
      const key = await generateKey();
      const encrypted = await encrypt(weights, key);
      storageRoot = encrypted.keyHash;
      encryptedMetaHash = await sha256(serializeBlob(encrypted));
    } else {
      storageRoot = await sha256(weights);
      encryptedMetaHash = storageRoot;
    }

    const edgeTypeMap: Record<string, number> = {
      TrainedOn: 0, FineTunedFrom: 1, Composes: 2, DependsOn: 3,
    };

    const parentEdges = parents.map((p) => ({
      child: 0n,
      parent: p.tokenId,
      weightBps: p.weightBps,
      eType: edgeTypeMap[p.edgeType],
    }));

    const policy = {
      totalRoyaltyBps: royaltyBps,
      paymentToken: paymentToken ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`),
      pauseUntil: 0n,
      ownerSplitBps,
    };

    const hash = await wallet.writeContract({
      address: this.config.modelINFT,
      abi: INFT_ABI,
      functionName: "mintWithLineage",
      args: [account.address, storageRoot, encryptedMetaHash, parentEdges, policy],
      account,
      chain: undefined,
    });

    const txReceipt = await this.publicClient.waitForTransactionReceipt({
      hash,
        pollingInterval: 8000,     // 8 seconds
        retryCount: 50,
        timeout: 480_000,
    });
    const tokenId = this._parseTokenIdFromReceipt(txReceipt);
    return { tokenId, hash };
  }

  async mintSkill(params: MintSkillParams & { wallet: WalletClient; account: Account }) {
    const { artifact, encrypt: shouldEncrypt, parents, royaltyBps, ownerSplitBps, paymentToken, wallet, account } = params;

    let storageRoot: `0x${string}`;
    let encryptedMetaHash: `0x${string}`;

    if (shouldEncrypt) {
      const key = await generateKey();
      const encrypted = await encrypt(artifact, key);
      storageRoot = encrypted.keyHash;
      encryptedMetaHash = await sha256(serializeBlob(encrypted));
    } else {
      storageRoot = await sha256(artifact);
      encryptedMetaHash = storageRoot;
    }

    const edgeTypeMap: Record<string, number> = {
      TrainedOn: 0, FineTunedFrom: 1, Composes: 2, DependsOn: 3,
    };

    const parentEdges = parents.map((p) => ({
      child: 0n,
      parent: p.tokenId,
      weightBps: p.weightBps,
      eType: edgeTypeMap[p.edgeType],
    }));

    const policy = {
      totalRoyaltyBps: royaltyBps,
      paymentToken: paymentToken ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`),
      pauseUntil: 0n,
      ownerSplitBps,
    };

    const hash = await wallet.writeContract({
      address: this.config.skillINFT,
      abi: INFT_ABI,
      functionName: "mintWithLineage",
      args: [account.address, storageRoot, encryptedMetaHash, parentEdges, policy],
      account,
      chain: undefined,
    });

    const txReceipt = await this.publicClient.waitForTransactionReceipt({
      hash,
        pollingInterval: 8000,     // 8 seconds
        retryCount: 50,
        timeout: 480_000,
    });
    const tokenId = this._parseTokenIdFromReceipt(txReceipt);
    return { tokenId, hash };
  }

  async runInference(params: InferenceParams & { agentAddress: `0x${string}` }): Promise<InferenceResult> {
    const { modelTokenId, skills = [], input, agentAddress } = params;
    const inferenceId = crypto.randomUUID();

    // Compute input/output digests
    const inputBytes = new TextEncoder().encode(input);
    const inputDigest = await sha256(inputBytes);

    // In mock mode, we simulate the inference
    if (this.config.mockTEE) {
      const mockOutput = `[Mock inference for model ${modelTokenId}]: ${input}`;
      const outputBytes = new TextEncoder().encode(mockOutput);
      const outputDigest = await sha256(outputBytes);

      const receipt = buildMockReceipt({
        modelTokenId: modelTokenId.toString(),
        skills: skills.map((s) => s.toString()),
        inferenceId,
        inputDigest,
        outputDigest,
        agentId: agentAddress,
        agentRunner: agentAddress,
      });

      validateReceipt(receipt);

      // Mock mode: synthesize a DAPointer with the receiptId hash as the
      // commitment. Real mode goes through the runner -> ReceiptSink path.
      const synthCommitment = receipt.receiptId.startsWith("0x")
        ? (receipt.receiptId.slice(0, 66) as `0x${string}`)
        : (("0x" + receipt.receiptId.padEnd(64, "0").slice(0, 64)) as `0x${string}`);
      return {
        output: mockOutput,
        receipt,
        daPointer: { commitment: synthCommitment, blobIndex: 0 },
      };
    }

    throw new Error("Non-mock 0G Compute integration not yet wired — set mockTEE: true for local dev");
  }

  async getLineageGraph(tokenId: bigint) {
    const record = await this.publicClient.readContract({
      address: this.config.registry,
      abi: REGISTRY_ABI,
      functionName: "getINFT",
      args: [tokenId],
    });
    const parents = await this.publicClient.readContract({
      address: this.config.registry,
      abi: REGISTRY_ABI,
      functionName: "getParents",
      args: [tokenId],
    });
    const policy = await this.publicClient.readContract({
      address: this.config.registry,
      abi: REGISTRY_ABI,
      functionName: "getRoyaltyPolicy",
      args: [tokenId],
    });
    return { record, parents, policy };
  }

  async getClaimableBalance(recipient: `0x${string}`, token: `0x${string}`) {
    return this.publicClient.readContract({
      address: this.config.splitter,
      abi: SPLITTER_ABI,
      functionName: "balanceOf",
      args: [recipient, token],
    });
  }

  async claim(params: {
    batchId: bigint;
    token: `0x${string}`;
    amount: bigint;
    proof: `0x${string}`[];
    wallet: WalletClient;
    account: Account;
  }) {
    const { batchId, token, amount, proof, wallet, account } = params;
    return wallet.writeContract({
      address: this.config.splitter,
      abi: SPLITTER_ABI,
      functionName: "claim",
      args: [batchId, token, amount, proof],
      account,
      chain: undefined,
    });
  }

  private _parseTokenIdFromReceipt(receipt: { logs: readonly { topics: readonly string[] }[] }): bigint {
    // Token ID is in Transfer event: topic[3] is the tokenId
    for (const log of receipt.logs) {
      if (log.topics.length >= 4) {
        return BigInt(log.topics[3]!);
      }
    }
    throw new Error("Could not parse tokenId from mint receipt");
  }
}

export { LineageClientConfig };
