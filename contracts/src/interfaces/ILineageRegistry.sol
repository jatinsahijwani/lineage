// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILineageRegistry {
    enum INFTType { Data, Model, Skill, Agent }
    enum EdgeType { TrainedOn, FineTunedFrom, Composes, DependsOn }

    struct INFTRecord {
        uint256 tokenId;
        bytes32 storageRoot;
        address owner;
        INFTType iType;
        uint16  royaltyBps;
        address royaltyReceiver;
        uint64  createdAt;
        bool    paused;
    }

    struct LineageEdge {
        uint256 child;
        uint256 parent;
        uint16  weightBps;
        EdgeType eType;
    }

    struct RoyaltyPolicy {
        uint16  totalRoyaltyBps;
        address paymentToken;
        uint64  pauseUntil;
        uint16  ownerSplitBps;
    }

    event INFTRegistered(uint256 indexed tokenId, INFTType iType, bytes32 storageRoot);
    event EdgeRecorded(uint256 indexed child, uint256 indexed parent, uint16 weightBps, EdgeType eType);
    event RoyaltyPolicyUpdated(uint256 indexed tokenId, RoyaltyPolicy policy);

    /// @notice Register a new iNFT. Returns the globally unique tokenId assigned by the registry.
    function registerINFT(
        address owner,
        INFTType iType,
        bytes32 storageRoot,
        LineageEdge[] calldata parents,
        RoyaltyPolicy calldata policy
    ) external returns (uint256 tokenId);

    function getINFT(uint256 tokenId) external view returns (INFTRecord memory);
    function getParents(uint256 tokenId) external view returns (LineageEdge[] memory);
    function getRoyaltyPolicy(uint256 tokenId) external view returns (RoyaltyPolicy memory);
    function isAcyclic(uint256 candidateChild, uint256[] calldata candidateParents) external view returns (bool);
    function updateRoyaltyPolicy(uint256 tokenId, RoyaltyPolicy calldata policy) external;
}
