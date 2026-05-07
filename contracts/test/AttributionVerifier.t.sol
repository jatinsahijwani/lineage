// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttributionVerifier} from "../src/AttributionVerifier.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AttributionVerifierTest is Test {
    AttributionVerifier verifier;

    // Test signer keypairs
    uint256 constant TEE_PK = 0xA11CE;
    uint256 constant OP_PK  = 0xB0B;
    address teeSigner;
    address operatorAddr;

    // Deterministic constants
    bytes32 constant INPUT_DIGEST  = bytes32(uint256(0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef));
    bytes32 constant OUTPUT_DIGEST = bytes32(uint256(0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321));
    bytes32 constant ENVELOPE_HASH = keccak256("envelope-block-v1");

    string constant PROVIDER_TYPE     = "centralized";
    string constant PROVIDER_IDENTITY = "aliyun";
    string constant TLS_FP            = "deadbeef";

    function setUp() public {
        verifier = new AttributionVerifier();
        teeSigner    = vm.addr(TEE_PK);
        operatorAddr = vm.addr(OP_PK);
        verifier.setTrustedTEESigner(teeSigner, true);
        verifier.setTrustedOperator(operatorAddr, true);
    }

    // -- helpers ---------------------------------------------------------

    function _bytes32ToHexNo0x(bytes32 value) internal pure returns (string memory) {
        bytes16 alphabet = 0x30313233343536373839616263646566;
        bytes memory out = new bytes(64);
        for (uint256 i = 0; i < 32; ++i) {
            uint8 b = uint8(value[i]);
            out[2 * i]     = alphabet[b >> 4];
            out[2 * i + 1] = alphabet[b & 0x0f];
        }
        return string(out);
    }

    function _makeText(bytes32 inHash, bytes32 outHash) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                _bytes32ToHexNo0x(inHash),
                ":",
                _bytes32ToHexNo0x(outHash),
                ":",
                PROVIDER_TYPE,
                ":",
                PROVIDER_IDENTITY,
                ":",
                TLS_FP
            )
        );
    }

    function _signEth(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return bytes.concat(r, s, bytes1(v));
    }

    function _signText(uint256 pk, string memory text) internal pure returns (bytes memory) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(bytes(text));
        return _signEth(pk, digest);
    }

    function _signEnvelope(uint256 pk, bytes32 envHash) internal pure returns (bytes memory) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(envHash);
        return _signEth(pk, digest);
    }

    // -- Happy path ------------------------------------------------------

    function test_verifyReceipt_happy() public view {
        string memory text = _makeText(INPUT_DIGEST, OUTPUT_DIGEST);
        bytes memory teeSig = _signText(TEE_PK, text);
        bytes memory opSig  = _signEnvelope(OP_PK, ENVELOPE_HASH);

        bool ok = verifier.verifyReceipt(
            ENVELOPE_HASH,
            INPUT_DIGEST,
            OUTPUT_DIGEST,
            text,
            teeSig,
            teeSigner,
            operatorAddr,
            opSig
        );
        assertTrue(ok);
    }

    // -- Failure 1: TEE not trusted -------------------------------------

    function test_verifyReceipt_revert_teeNotTrusted() public {
        // Use a different valid TEE keypair that is NOT registered as trusted
        uint256 untrustedPk = 0xDEAD;
        address untrustedTee = vm.addr(untrustedPk);

        string memory text = _makeText(INPUT_DIGEST, OUTPUT_DIGEST);
        bytes memory teeSig = _signText(untrustedPk, text);
        bytes memory opSig  = _signEnvelope(OP_PK, ENVELOPE_HASH);

        vm.expectRevert(bytes("tee not trusted"));
        verifier.verifyReceipt(
            ENVELOPE_HASH,
            INPUT_DIGEST,
            OUTPUT_DIGEST,
            text,
            teeSig,
            untrustedTee,
            operatorAddr,
            opSig
        );
    }

    // -- Failure 2: TEE sig mismatch (signed wrong text) ----------------

    function test_verifyReceipt_revert_teeSigMismatch() public {
        string memory rightText = _makeText(INPUT_DIGEST, OUTPUT_DIGEST);
        // Sign a DIFFERENT canonical text — the verifier checks against rightText
        string memory wrongText = _makeText(keccak256("other-input"), OUTPUT_DIGEST);
        bytes memory teeSig = _signText(TEE_PK, wrongText);
        bytes memory opSig  = _signEnvelope(OP_PK, ENVELOPE_HASH);

        vm.expectRevert(bytes("tee sig mismatch"));
        verifier.verifyReceipt(
            ENVELOPE_HASH,
            INPUT_DIGEST,
            OUTPUT_DIGEST,
            rightText,
            teeSig,
            teeSigner,
            operatorAddr,
            opSig
        );
    }

    // -- Failure 3: operator not trusted --------------------------------

    function test_verifyReceipt_revert_opNotTrusted() public {
        uint256 untrustedPk = 0xCAFE;
        address untrustedOp = vm.addr(untrustedPk);

        string memory text = _makeText(INPUT_DIGEST, OUTPUT_DIGEST);
        bytes memory teeSig = _signText(TEE_PK, text);
        bytes memory opSig  = _signEnvelope(untrustedPk, ENVELOPE_HASH);

        vm.expectRevert(bytes("op not trusted"));
        verifier.verifyReceipt(
            ENVELOPE_HASH,
            INPUT_DIGEST,
            OUTPUT_DIGEST,
            text,
            teeSig,
            teeSigner,
            untrustedOp,
            opSig
        );
    }

    // -- Failure 4: operator signed wrong envelope ----------------------

    function test_verifyReceipt_revert_opSigMismatch() public {
        string memory text = _makeText(INPUT_DIGEST, OUTPUT_DIGEST);
        bytes memory teeSig = _signText(TEE_PK, text);
        // Sign over a DIFFERENT envelope hash than the one passed in
        bytes32 wrongEnv = keccak256("not-the-real-envelope");
        bytes memory opSig = _signEnvelope(OP_PK, wrongEnv);

        vm.expectRevert(bytes("op sig mismatch"));
        verifier.verifyReceipt(
            ENVELOPE_HASH,
            INPUT_DIGEST,
            OUTPUT_DIGEST,
            text,
            teeSig,
            teeSigner,
            operatorAddr,
            opSig
        );
    }

    // -- Failure 5: input digest doesn't match field 1 ------------------

    function test_verifyReceipt_revert_inputDigestMismatch() public {
        // canonical text has INPUT_DIGEST as first field, but caller passes a different
        // inputDigest parameter. TEE/operator sigs are valid against the text + envelope.
        string memory text = _makeText(INPUT_DIGEST, OUTPUT_DIGEST);
        bytes memory teeSig = _signText(TEE_PK, text);
        bytes memory opSig  = _signEnvelope(OP_PK, ENVELOPE_HASH);

        bytes32 wrongInput = bytes32(uint256(0xAAAA));

        vm.expectRevert(bytes("input digest mismatch"));
        verifier.verifyReceipt(
            ENVELOPE_HASH,
            wrongInput,
            OUTPUT_DIGEST,
            text,
            teeSig,
            teeSigner,
            operatorAddr,
            opSig
        );
    }

    // -- Failure 6: output digest doesn't match field 2 -----------------

    function test_verifyReceipt_revert_outputDigestMismatch() public {
        string memory text = _makeText(INPUT_DIGEST, OUTPUT_DIGEST);
        bytes memory teeSig = _signText(TEE_PK, text);
        bytes memory opSig  = _signEnvelope(OP_PK, ENVELOPE_HASH);

        bytes32 wrongOutput = bytes32(uint256(0xBBBB));

        vm.expectRevert(bytes("output digest mismatch"));
        verifier.verifyReceipt(
            ENVELOPE_HASH,
            INPUT_DIGEST,
            wrongOutput,
            text,
            teeSig,
            teeSigner,
            operatorAddr,
            opSig
        );
    }
}
