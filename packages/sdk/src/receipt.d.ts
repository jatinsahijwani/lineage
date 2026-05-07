import type { AttributionReceipt } from "@lineage/shared";
export declare function encodeReceipt(receipt: AttributionReceipt): Uint8Array;
export declare function decodeReceipt(encoded: Uint8Array): AttributionReceipt;
export declare function validateReceipt(receipt: AttributionReceipt): void;
export declare function buildMockReceipt(params: {
    modelTokenId: string;
    skills: string[];
    inferenceId: string;
    inputDigest: string;
    outputDigest: string;
    agentId: string;
    agentRunner: string;
}): AttributionReceipt;
//# sourceMappingURL=receipt.d.ts.map