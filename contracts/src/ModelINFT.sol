// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC7857Lineage} from "./ERC7857Lineage.sol";
import {ILineageRegistry} from "./interfaces/ILineageRegistry.sol";

/// @notice iNFT wrapping model weights in 0G Storage.
///         Parents must be DataINFT or ModelINFT.
contract ModelINFT is ERC7857Lineage {
    ILineageRegistry private _reg;

    constructor(address registry_)
        ERC7857Lineage("Lineage ModelINFT", "MODELNFT", registry_, ILineageRegistry.INFTType.Model)
    {
        _reg = ILineageRegistry(registry_);
    }

    function _validateParentTypes(ILineageRegistry.LineageEdge[] calldata parents) internal view override {
        for (uint256 i; i < parents.length; ++i) {
            ILineageRegistry.INFTRecord memory rec = _reg.getINFT(parents[i].parent);
            require(
                rec.iType == ILineageRegistry.INFTType.Data ||
                rec.iType == ILineageRegistry.INFTType.Model,
                "ModelINFT: parents must be Data or Model"
            );
        }
    }
}
