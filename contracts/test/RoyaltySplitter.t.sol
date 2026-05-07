// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RoyaltySplitter} from "../src/RoyaltySplitter.sol";
import {AttributionVerifier} from "../src/AttributionVerifier.sol";
import {IRoyaltySplitter} from "../src/interfaces/IRoyaltySplitter.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract RoyaltySplitterTest is Test {
    RoyaltySplitter splitter;
    AttributionVerifier verifier;
    address operator = makeAddr("operator");
    address alice    = makeAddr("alice");
    address bob      = makeAddr("bob");

    function setUp() public {
        verifier = new AttributionVerifier();
        splitter = new RoyaltySplitter(operator, address(verifier));
        verifier.setSplitter(address(splitter));
        vm.deal(address(splitter), 10 ether);
    }

    function _makeLeaf(uint256 batchId, address recipient, address token, uint256 amount)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked(batchId, recipient, token, amount));
    }

    function test_postBatch_and_claim_native() public {
        // Build a two-leaf Merkle tree: alice=0.1 ETH, bob=0.05 ETH
        bytes32 leafAlice = _makeLeaf(1, alice, address(0), 0.1 ether);
        bytes32 leafBob   = _makeLeaf(1, bob,   address(0), 0.05 ether);

        // Sort leaves for a stable tree
        bytes32 root;
        bytes32[] memory proofAlice = new bytes32[](1);
        bytes32[] memory proofBob   = new bytes32[](1);
        if (leafAlice < leafBob) {
            root = keccak256(abi.encodePacked(leafAlice, leafBob));
            proofAlice[0] = leafBob;
            proofBob[0]   = leafAlice;
        } else {
            root = keccak256(abi.encodePacked(leafBob, leafAlice));
            proofAlice[0] = leafBob;
            proofBob[0]   = leafAlice;
        }

        IRoyaltySplitter.SettlementBatch memory batch = IRoyaltySplitter.SettlementBatch({
            batchId: 1,
            merkleRoot: root,
            windowStart: 0,
            windowEnd: 1000,
            receiptCount: 2,
            daPointer: IRoyaltySplitter.DAPointer({ commitment: bytes32("daCommit"), blobIndex: 42 })
        });

        vm.prank(operator);
        splitter.postBatch(batch, "");

        // Alice claims
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        splitter.claim(1, address(0), 0.1 ether, proofAlice);
        assertEq(alice.balance - aliceBefore, 0.1 ether);

        // Bob claims
        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        splitter.claim(1, address(0), 0.05 ether, proofBob);
        assertEq(bob.balance - bobBefore, 0.05 ether);
    }

    function test_doubleClaim_reverts() public {
        bytes32 leafAlice = _makeLeaf(1, alice, address(0), 0.1 ether);
        bytes32 root = leafAlice; // single-leaf tree

        IRoyaltySplitter.SettlementBatch memory batch = IRoyaltySplitter.SettlementBatch({
            batchId: 1, merkleRoot: root, windowStart: 0, windowEnd: 1000, receiptCount: 1,
            daPointer: IRoyaltySplitter.DAPointer({ commitment: bytes32(0), blobIndex: 0 })
        });
        vm.prank(operator);
        splitter.postBatch(batch, "");

        vm.prank(alice);
        splitter.claim(1, address(0), 0.1 ether, new bytes32[](0));

        vm.prank(alice);
        vm.expectRevert("already claimed");
        splitter.claim(1, address(0), 0.1 ether, new bytes32[](0));
    }

    function test_invalidProof_reverts() public {
        bytes32 leafAlice = _makeLeaf(1, alice, address(0), 0.1 ether);
        bytes32 root = leafAlice;

        IRoyaltySplitter.SettlementBatch memory batch = IRoyaltySplitter.SettlementBatch({
            batchId: 1, merkleRoot: root, windowStart: 0, windowEnd: 1000, receiptCount: 1,
            daPointer: IRoyaltySplitter.DAPointer({ commitment: bytes32(0), blobIndex: 0 })
        });
        vm.prank(operator);
        splitter.postBatch(batch, "");

        vm.prank(alice);
        vm.expectRevert("invalid proof");
        splitter.claim(1, address(0), 0.2 ether, new bytes32[](0)); // wrong amount
    }

    function test_batchIdMustIncrease() public {
        IRoyaltySplitter.SettlementBatch memory batch = IRoyaltySplitter.SettlementBatch({
            batchId: 5, merkleRoot: bytes32("root"), windowStart: 0, windowEnd: 100, receiptCount: 1,
            daPointer: IRoyaltySplitter.DAPointer({ commitment: bytes32(0), blobIndex: 0 })
        });
        vm.prank(operator);
        splitter.postBatch(batch, "");

        batch.batchId = 3;
        vm.prank(operator);
        vm.expectRevert("batch id must increase");
        splitter.postBatch(batch, "");
    }
}
