import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

export interface PayoutLeaf {
  batchId: bigint;
  recipient: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
}

function encodeLeaf(leaf: PayoutLeaf): Buffer {
  // keccak256(abi.encodePacked(batchId, recipient, token, amount))
  const batchIdBuf = Buffer.alloc(32);
  batchIdBuf.writeBigUInt64BE(leaf.batchId, 24); // right-aligned uint256

  const recipientBuf = Buffer.from(leaf.recipient.slice(2), "hex");
  const tokenBuf = Buffer.from(leaf.token.slice(2), "hex");

  const amountBuf = Buffer.alloc(32);
  amountBuf.writeBigUInt64BE(leaf.amount, 24);

  const packed = Buffer.concat([batchIdBuf, recipientBuf, tokenBuf, amountBuf]);
  return keccak256(packed);
}

export function buildMerkleTree(leaves: PayoutLeaf[]): {
  root: `0x${string}`;
  tree: MerkleTree;
  encodedLeaves: Buffer[];
} {
  const encodedLeaves = leaves.map(encodeLeaf);
  const tree = new MerkleTree(encodedLeaves, keccak256, { sortPairs: true });
  const root = `0x${tree.getRoot().toString("hex")}` as `0x${string}`;
  return { root, tree, encodedLeaves };
}

export function getProof(tree: MerkleTree, leaf: Buffer): `0x${string}`[] {
  return tree.getHexProof(leaf) as `0x${string}`[];
}
