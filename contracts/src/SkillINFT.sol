// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC7857Lineage} from "./ERC7857Lineage.sol";
import {ILineageRegistry} from "./interfaces/ILineageRegistry.sol";

/// @notice iNFT wrapping a tool, sub-agent, or composed pipeline in 0G Storage.
///         Parents can be any iNFT type.
contract SkillINFT is ERC7857Lineage {
    constructor(address registry_)
        ERC7857Lineage("Lineage SkillINFT", "SKILLINFT", registry_, ILineageRegistry.INFTType.Skill)
    {}

    function _validateParentTypes(ILineageRegistry.LineageEdge[] calldata /*parents*/) internal pure override {
        // SkillINFT accepts any parent type — no restriction
    }
}
