import { encode as cborEncode, decode as cborDecode } from "cbor-x";
export function encodeReceipt(receipt) {
    const canonical = {
        version: receipt.version,
        receiptId: receipt.receiptId,
        agentId: receipt.agentId,
        agentRunner: receipt.agentRunner,
        inferenceId: receipt.inferenceId,
        timestamp: receipt.timestamp,
        model: receipt.model,
        skills: receipt.skills,
        memory: receipt.memory,
        data: receipt.data,
        inputDigest: receipt.inputDigest,
        outputDigest: receipt.outputDigest,
        computeNodeId: receipt.computeNodeId,
        teeSignature: receipt.teeSignature,
    };
    return cborEncode(canonical);
}
export function decodeReceipt(encoded) {
    return cborDecode(encoded);
}
export function validateReceipt(receipt) {
    const allWeightedItems = [
        receipt.model,
        ...receipt.skills,
        ...receipt.memory,
        ...receipt.data,
    ];
    const totalWeight = allWeightedItems.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 1e-6) {
        throw new Error(`Receipt weights must sum to 1.0, got ${totalWeight}`);
    }
}
export function buildMockReceipt(params) {
    const { modelTokenId, skills, inferenceId, inputDigest, outputDigest, agentId, agentRunner } = params;
    const skillWeight = skills.length > 0 ? 0.3 / skills.length : 0;
    const modelWeight = skills.length > 0 ? 0.7 : 1.0;
    return {
        version: "lineage/v1",
        receiptId: `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`,
        agentId,
        agentRunner,
        inferenceId,
        timestamp: Math.floor(Date.now() / 1000),
        model: { tokenId: modelTokenId, weight: modelWeight },
        skills: skills.map((s) => ({ tokenId: s, weight: skillWeight })),
        memory: [],
        data: [],
        inputDigest,
        outputDigest,
        computeNodeId: "mock-tee-local",
        teeSignature: "0x" + "00".repeat(65),
    };
}
//# sourceMappingURL=receipt.js.map