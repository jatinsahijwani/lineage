// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAttributionVerifier {
    event TrustedTEESignerSet(address indexed signer, bool trusted);
    event TrustedOperatorSet(address indexed operator, bool trusted);

    function trustedTEESigners(address signer) external view returns (bool);
    function trustedOperators(address operator) external view returns (bool);

    function setTrustedTEESigner(address signer, bool trusted) external;
    function setTrustedOperator(address operator, bool trusted) external;

    /// @notice Verify a dual-attestation receipt envelope.
    /// @param envelopeHash      keccak256(canonical_cbor(lineage_block_without_signature))
    /// @param inputDigest       Input digest as bytes32 (must match first field of teeCanonicalText)
    /// @param outputDigest      Output digest as bytes32 (must match second field of teeCanonicalText)
    /// @param teeCanonicalText  5-field colon-separated canonical text returned by 0G Compute
    /// @param teeSignature      eth_sign(bytes(teeCanonicalText)) by the TEE enclave key
    /// @param claimedTEESigner  Address the TEE signature is expected to recover to
    /// @param agentOperator     Address the operator signature is expected to recover to
    /// @param operatorSignature eth_sign(envelopeHash) by the agent operator
    function verifyReceipt(
        bytes32 envelopeHash,
        bytes32 inputDigest,
        bytes32 outputDigest,
        string calldata teeCanonicalText,
        bytes calldata teeSignature,
        address claimedTEESigner,
        address agentOperator,
        bytes calldata operatorSignature
    ) external view returns (bool);

    // ---- Splitter coupling (kept for v1; RoyaltySplitter relies on these) ----
    function setSplitter(address splitter) external;
    function isReceiptUsed(bytes32 receiptId) external view returns (bool);
    function markReceiptUsed(bytes32 receiptId) external;
}
