// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ILineageRegistry} from "./interfaces/ILineageRegistry.sol";

/// @notice Abstract base for Lineage iNFTs. Extends ERC-721 with:
///         - encrypted artifact metadata pointer
///         - lineage registration on mint via LineageRegistry
///         Token IDs are assigned globally by the registry (not per-contract).
abstract contract ERC7857Lineage is ERC721 {
    ILineageRegistry public immutable registry;
    ILineageRegistry.INFTType public immutable inftType;

    mapping(uint256 => bytes32) private _encryptedMetaHash;
    mapping(uint256 => bytes32) private _storageRoots;

    event MetadataSet(uint256 indexed tokenId, bytes32 encryptedMetaHash, bytes32 storageRoot);

    constructor(
        string memory name_,
        string memory symbol_,
        address registry_,
        ILineageRegistry.INFTType iType_
    ) ERC721(name_, symbol_) {
        registry = ILineageRegistry(registry_);
        inftType = iType_;
    }

    /// @notice Mint a new iNFT. Token ID is assigned by the registry (globally unique).
    function mintWithLineage(
        address to,
        bytes32 storageRoot,
        bytes32 encryptedMetaHash,
        ILineageRegistry.LineageEdge[] calldata parents,
        ILineageRegistry.RoyaltyPolicy calldata policy
    ) external returns (uint256 tokenId) {
        _validateParentTypes(parents);

        // Registry assigns the globally unique tokenId
        tokenId = registry.registerINFT(to, inftType, storageRoot, parents, policy);

        _safeMint(to, tokenId);
        _storageRoots[tokenId] = storageRoot;
        _encryptedMetaHash[tokenId] = encryptedMetaHash;

        emit MetadataSet(tokenId, encryptedMetaHash, storageRoot);
    }

    function storageRootOf(uint256 tokenId) external view returns (bytes32) {
        return _storageRoots[tokenId];
    }

    function encryptedMetaHashOf(uint256 tokenId) external view returns (bytes32) {
        return _encryptedMetaHash[tokenId];
    }

    function _validateParentTypes(ILineageRegistry.LineageEdge[] calldata parents) internal virtual;
}
