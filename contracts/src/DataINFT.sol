// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC7857Lineage} from "./ERC7857Lineage.sol";
import {ILineageRegistry} from "./interfaces/ILineageRegistry.sol";

/// @notice iNFT wrapping a dataset blob in 0G Storage.
///         DataINFTs have no parents — they are origin nodes in the lineage DAG.
contract DataINFT is ERC7857Lineage {
    constructor(address registry_)
        ERC7857Lineage("Lineage DataINFT", "DATANFT", registry_, ILineageRegistry.INFTType.Data)
    {}

    function _validateParentTypes(ILineageRegistry.LineageEdge[] calldata parents) internal pure override {
        require(parents.length == 0, "DataINFT: no parents allowed");
    }
}
