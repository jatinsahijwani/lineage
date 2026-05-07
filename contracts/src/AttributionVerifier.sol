// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IAttributionVerifier} from "./interfaces/IAttributionVerifier.sol";

/// @notice Validates dual-attestation lineage receipts:
///         (a) TEE signature over the canonical 5-field text returned by 0G Compute,
///         (b) Operator signature over the envelope hash of the lineage block,
///         (c) The first two `:`-separated fields of the canonical text match the
///             on-chain inputDigest / outputDigest parameters.
contract AttributionVerifier is IAttributionVerifier {
    address public owner;
    address public royaltySplitter;

    mapping(address => bool) public trustedTEESigners;
    mapping(address => bool) public trustedOperators;
    mapping(bytes32 => bool) private _usedReceipts;

    event ReceiptMarkedUsed(bytes32 indexed receiptId);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlySplitter() {
        require(msg.sender == royaltySplitter, "not splitter");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setTrustedTEESigner(address signer, bool trusted) external onlyOwner {
        trustedTEESigners[signer] = trusted;
        emit TrustedTEESignerSet(signer, trusted);
    }

    function setTrustedOperator(address operatorAddr, bool trusted) external onlyOwner {
        trustedOperators[operatorAddr] = trusted;
        emit TrustedOperatorSet(operatorAddr, trusted);
    }

    function setSplitter(address splitter) external onlyOwner {
        royaltySplitter = splitter;
    }

    // ---------------------------------------------------------------------
    // Verification
    // ---------------------------------------------------------------------

    function verifyReceipt(
        bytes32 envelopeHash,
        bytes32 inputDigest,
        bytes32 outputDigest,
        string calldata teeCanonicalText,
        bytes calldata teeSignature,
        address claimedTEESigner,
        address agentOperator,
        bytes calldata operatorSignature
    ) external view override returns (bool) {
        _checkTeeSig(teeCanonicalText, teeSignature, claimedTEESigner);
        _checkOpSig(envelopeHash, operatorSignature, agentOperator);
        _checkDigestBinding(teeCanonicalText, inputDigest, outputDigest);
        return true;
    }

    function _checkTeeSig(
        string calldata teeCanonicalText,
        bytes calldata teeSignature,
        address claimedTEESigner
    ) internal view {
        bytes32 teeDigest = MessageHashUtils.toEthSignedMessageHash(bytes(teeCanonicalText));
        address recoveredTee = ECDSA.recover(teeDigest, teeSignature);
        require(recoveredTee == claimedTEESigner, "tee sig mismatch");
        require(trustedTEESigners[claimedTEESigner], "tee not trusted");
    }

    function _checkOpSig(
        bytes32 envelopeHash,
        bytes calldata operatorSignature,
        address agentOperator
    ) internal view {
        bytes32 opDigest = MessageHashUtils.toEthSignedMessageHash(envelopeHash);
        address recoveredOp = ECDSA.recover(opDigest, operatorSignature);
        require(recoveredOp == agentOperator, "op sig mismatch");
        require(trustedOperators[agentOperator], "op not trusted");
    }

    function _checkDigestBinding(
        string calldata teeCanonicalText,
        bytes32 inputDigest,
        bytes32 outputDigest
    ) internal pure {
        (string memory firstField, string memory secondField) = _firstTwoFields(teeCanonicalText);
        require(
            keccak256(bytes(firstField)) == keccak256(bytes(_bytes32ToHexNo0x(inputDigest))),
            "input digest mismatch"
        );
        require(
            keccak256(bytes(secondField)) == keccak256(bytes(_bytes32ToHexNo0x(outputDigest))),
            "output digest mismatch"
        );
    }

    // ---------------------------------------------------------------------
    // Splitter coupling (v1)
    // ---------------------------------------------------------------------

    function isReceiptUsed(bytes32 receiptId) external view override returns (bool) {
        return _usedReceipts[receiptId];
    }

    function markReceiptUsed(bytes32 receiptId) external override onlySplitter {
        require(!_usedReceipts[receiptId], "receipt already used");
        _usedReceipts[receiptId] = true;
        emit ReceiptMarkedUsed(receiptId);
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /// @dev Walk the bytes once, returning the substrings before the first
    ///      and second `:` separators. Reverts on malformed input.
    function _firstTwoFields(string memory s)
        internal
        pure
        returns (string memory, string memory)
    {
        bytes memory raw = bytes(s);
        uint256 firstColon = type(uint256).max;
        uint256 secondColon = type(uint256).max;
        for (uint256 i = 0; i < raw.length; ++i) {
            if (raw[i] == ":") {
                if (firstColon == type(uint256).max) {
                    firstColon = i;
                } else {
                    secondColon = i;
                    break;
                }
            }
        }
        require(firstColon != type(uint256).max, "missing first colon");
        require(secondColon != type(uint256).max, "missing second colon");

        bytes memory first = new bytes(firstColon);
        for (uint256 i = 0; i < firstColon; ++i) {
            first[i] = raw[i];
        }

        bytes memory second = new bytes(secondColon - firstColon - 1);
        for (uint256 i = 0; i < second.length; ++i) {
            second[i] = raw[firstColon + 1 + i];
        }

        return (string(first), string(second));
    }

    /// @dev Lowercase hex (no 0x prefix) of a bytes32. Output is 64 chars.
    function _bytes32ToHexNo0x(bytes32 value) internal pure returns (string memory) {
        bytes16 alphabet = 0x30313233343536373839616263646566; // "0123456789abcdef"
        bytes memory out = new bytes(64);
        for (uint256 i = 0; i < 32; ++i) {
            uint8 b = uint8(value[i]);
            out[2 * i]     = alphabet[b >> 4];
            out[2 * i + 1] = alphabet[b & 0x0f];
        }
        return string(out);
    }
}
