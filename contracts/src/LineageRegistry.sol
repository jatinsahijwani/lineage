// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILineageRegistry} from "./interfaces/ILineageRegistry.sol";

/*
 * IReceiptSink (off-chain interface, documented for cross-reference)
 * ──────────────────────────────────────────────────────────────────
 * Lineage attribution receipts are persisted off-chain by the runner before
 * settlement. The sink contract is expressed as a TypeScript interface in
 * services/runner/src/receipt-sink.ts:
 *
 *   interface ReceiptSink {
 *     post(receipt: SignedReceipt): Promise<DAPointer>;
 *     read(pointer: DAPointer):    Promise<SignedReceipt>;
 *   }
 *
 *   struct DAPointer {                  // mirrored on-chain in IRoyaltySplitter
 *     bytes32 commitment;               // content-addressed root
 *     uint64  blobIndex;                // sequential index in the underlying log
 *   }
 *
 * v1 backend is StorageReceiptSink (0G Storage):
 *   - commitment = rootHash returned by Indexer.upload (32-byte sha256-style root)
 *   - blobIndex  = txSeq    returned by Indexer.upload (monotonic per-flow counter)
 *
 * The DA-backed sink (DAReceiptSink) is stubbed pending the 0G DA gRPC SDK.
 * On-chain, SettlementBatch.daPointer is opaque to the registry — only the
 * settler/operator interpret it. Recorded here so contract readers know the
 * commitment+blobIndex pair is the (rootHash, txSeq) tuple from 0G Storage,
 * not a DA KZG commitment.
 */

/// @notice Global registry of iNFTs and their lineage graph (DAG).
///         Assigns globally unique token IDs across all iNFT contract types.
///         Acyclic enforcement via depth-bounded DFS (max depth 32).
///         Edges are immutable once recorded.
contract LineageRegistry is ILineageRegistry {
    uint8 public constant MAX_DEPTH = 32;
    uint64 public constant ROYALTY_TIMELOCK = 24 hours;

    uint256 private _globalIdCounter;

    mapping(uint256 => INFTRecord) private _inftRecords;
    mapping(uint256 => LineageEdge[]) private _parents;
    mapping(uint256 => RoyaltyPolicy) private _royaltyPolicies;
    mapping(uint256 => uint64) private _royaltyPendingAt;
    mapping(uint256 => RoyaltyPolicy) private _royaltyPending;

    mapping(address => bool) public authorizedMinters;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyMinter() {
        require(authorizedMinters[msg.sender], "not authorized minter");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
    }

    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
    }

    /// @notice Register a new iNFT. Returns the globally unique tokenId.
    function registerINFT(
        address inftOwner,
        INFTType iType,
        bytes32 storageRoot,
        LineageEdge[] calldata parents,
        RoyaltyPolicy calldata policy
    ) external override onlyMinter returns (uint256 tokenId) {
        require(policy.totalRoyaltyBps <= 10000, "royalty > 100%");
        require(policy.ownerSplitBps <= 10000, "ownerSplit > 100%");

        tokenId = ++_globalIdCounter;

        // Validate parent weights + types
        if (parents.length > 0) {
            uint256 totalWeight;
            uint256[] memory parentIds = new uint256[](parents.length);
            for (uint256 i; i < parents.length; ++i) {
                uint256 parentId = parents[i].parent;
                require(_inftRecords[parentId].createdAt != 0, "parent not registered");
                parentIds[i] = parentId;
                totalWeight += parents[i].weightBps;
            }
            require(totalWeight == 10000, "weights must sum to 10000");
            require(_isAcyclic(tokenId, parentIds), "cycle detected");
        }

        _inftRecords[tokenId] = INFTRecord({
            tokenId: tokenId,
            storageRoot: storageRoot,
            owner: inftOwner,
            iType: iType,
            royaltyBps: policy.totalRoyaltyBps,
            royaltyReceiver: inftOwner,
            createdAt: uint64(block.timestamp),
            paused: false
        });

        for (uint256 i; i < parents.length; ++i) {
            // Fix child reference to the assigned tokenId
            _parents[tokenId].push(LineageEdge({
                child: tokenId,
                parent: parents[i].parent,
                weightBps: parents[i].weightBps,
                eType: parents[i].eType
            }));
            emit EdgeRecorded(tokenId, parents[i].parent, parents[i].weightBps, parents[i].eType);
        }

        _royaltyPolicies[tokenId] = policy;

        emit INFTRegistered(tokenId, iType, storageRoot);
        emit RoyaltyPolicyUpdated(tokenId, policy);
    }

    /// @notice Initiate a royalty policy update (24h timelock).
    function updateRoyaltyPolicy(uint256 tokenId, RoyaltyPolicy calldata policy) external override {
        require(_inftRecords[tokenId].owner == msg.sender, "not inft owner");
        require(policy.totalRoyaltyBps <= 10000, "royalty > 100%");
        require(policy.ownerSplitBps <= 10000, "ownerSplit > 100%");
        _royaltyPending[tokenId] = policy;
        _royaltyPendingAt[tokenId] = uint64(block.timestamp) + ROYALTY_TIMELOCK;
        emit RoyaltyPolicyUpdated(tokenId, policy);
    }

    /// @notice Finalize a pending royalty update after timelock.
    function finalizeRoyaltyUpdate(uint256 tokenId) external {
        uint64 pendingAt = _royaltyPendingAt[tokenId];
        require(pendingAt != 0 && block.timestamp >= pendingAt, "timelock not expired");
        _royaltyPolicies[tokenId] = _royaltyPending[tokenId];
        delete _royaltyPendingAt[tokenId];
    }

    function getINFT(uint256 tokenId) external view override returns (INFTRecord memory) {
        require(_inftRecords[tokenId].createdAt != 0, "not registered");
        return _inftRecords[tokenId];
    }

    function getParents(uint256 tokenId) external view override returns (LineageEdge[] memory) {
        return _parents[tokenId];
    }

    function getRoyaltyPolicy(uint256 tokenId) external view override returns (RoyaltyPolicy memory) {
        return _royaltyPolicies[tokenId];
    }

    function isAcyclic(uint256 candidateChild, uint256[] calldata candidateParents) external view override returns (bool) {
        return _isAcyclic(candidateChild, candidateParents);
    }

    function _isAcyclic(uint256 candidateChild, uint256[] memory candidateParents) internal view returns (bool) {
        for (uint256 i; i < candidateParents.length; ++i) {
            if (!_dfsCheck(candidateChild, candidateParents[i], 0)) return false;
        }
        return true;
    }

    function _dfsCheck(uint256 target, uint256 current, uint8 depth) internal view returns (bool) {
        if (current == target) return false;
        if (depth >= MAX_DEPTH) return true;
        LineageEdge[] storage parentEdges = _parents[current];
        for (uint256 i; i < parentEdges.length; ++i) {
            if (!_dfsCheck(target, parentEdges[i].parent, depth + 1)) return false;
        }
        return true;
    }
}
