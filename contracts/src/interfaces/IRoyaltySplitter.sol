// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRoyaltySplitter {
    /// @notice Pointer to the canonical CBOR-encoded receipt blob persisted
    ///         off-chain. Same shape regardless of backend:
    ///           - Storage-backed: commitment = rootHash, blobIndex = txSeq
    ///           - DA-backed (when 0G ships a JS DA SDK): commitment = blob
    ///             KZG commitment, blobIndex = DA blob index
    ///         Mirrors `DAPointer` in @lineage/shared.
    struct DAPointer {
        bytes32 commitment;
        uint64  blobIndex;
    }

    struct SettlementBatch {
        uint256   batchId;
        bytes32   merkleRoot;
        uint64    windowStart;
        uint64    windowEnd;
        uint256   receiptCount;
        DAPointer daPointer;
    }

    event BatchPosted(uint256 indexed batchId, bytes32 merkleRoot, uint256 receiptCount);
    event Claimed(address indexed recipient, address token, uint256 amount, uint256 batchId);

    function postBatch(SettlementBatch calldata batch, bytes calldata operatorSig) external;

    function claim(
        uint256 batchId,
        address token,
        uint256 amount,
        bytes32[] calldata proof
    ) external;

    function balanceOf(address recipient, address token) external view returns (uint256);
}
