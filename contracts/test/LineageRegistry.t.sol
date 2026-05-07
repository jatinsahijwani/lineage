// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {LineageRegistry} from "../src/LineageRegistry.sol";
import {DataINFT} from "../src/DataINFT.sol";
import {ModelINFT} from "../src/ModelINFT.sol";
import {SkillINFT} from "../src/SkillINFT.sol";
import {ILineageRegistry} from "../src/interfaces/ILineageRegistry.sol";

contract LineageRegistryTest is Test {
    LineageRegistry registry;
    DataINFT  dataINFT;
    ModelINFT modelINFT;
    SkillINFT skillINFT;

    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    ILineageRegistry.RoyaltyPolicy defaultPolicy = ILineageRegistry.RoyaltyPolicy({
        totalRoyaltyBps: 500,
        paymentToken: address(0),
        pauseUntil: 0,
        ownerSplitBps: 5000
    });

    ILineageRegistry.LineageEdge[] noParents;

    function setUp() public {
        registry  = new LineageRegistry();
        dataINFT  = new DataINFT(address(registry));
        modelINFT = new ModelINFT(address(registry));
        skillINFT = new SkillINFT(address(registry));

        registry.authorizeMinter(address(dataINFT));
        registry.authorizeMinter(address(modelINFT));
        registry.authorizeMinter(address(skillINFT));
    }

    // ─── DataINFT ───────────────────────────────────────────────────────────

    function test_mintData_noParents() public {
        vm.prank(alice);
        uint256 id = dataINFT.mintWithLineage(
            alice, bytes32("storageRoot1"), bytes32("encHash1"), noParents, defaultPolicy
        );
        assertEq(id, 1);
        ILineageRegistry.INFTRecord memory rec = registry.getINFT(id);
        assertEq(uint8(rec.iType), uint8(ILineageRegistry.INFTType.Data));
        assertEq(rec.owner, alice);
    }

    function test_mintData_withParents_reverts() public {
        vm.prank(alice);
        uint256 d1 = dataINFT.mintWithLineage(alice, bytes32("root1"), bytes32("enc1"), noParents, defaultPolicy);

        ILineageRegistry.LineageEdge[] memory parents = new ILineageRegistry.LineageEdge[](1);
        parents[0] = ILineageRegistry.LineageEdge({
            child: 0, parent: d1, weightBps: 10000, eType: ILineageRegistry.EdgeType.TrainedOn
        });

        vm.prank(bob);
        vm.expectRevert("DataINFT: no parents allowed");
        dataINFT.mintWithLineage(bob, bytes32("root2"), bytes32("enc2"), parents, defaultPolicy);
    }

    // ─── ModelINFT ──────────────────────────────────────────────────────────

    function test_mintModel_withDataParent() public {
        vm.prank(alice);
        uint256 dId = dataINFT.mintWithLineage(alice, bytes32("dRoot"), bytes32("dEnc"), noParents, defaultPolicy);
        assertEq(dId, 1);

        ILineageRegistry.LineageEdge[] memory parents = new ILineageRegistry.LineageEdge[](1);
        parents[0] = ILineageRegistry.LineageEdge({
            child: 0, parent: dId, weightBps: 10000, eType: ILineageRegistry.EdgeType.TrainedOn
        });

        vm.prank(bob);
        uint256 mId = modelINFT.mintWithLineage(bob, bytes32("mRoot"), bytes32("mEnc"), parents, defaultPolicy);
        assertEq(mId, 2); // globally unique: second registration = id 2

        ILineageRegistry.LineageEdge[] memory edges = registry.getParents(mId);
        assertEq(edges.length, 1);
        assertEq(edges[0].parent, dId);
        assertEq(registry.getINFT(mId).owner, bob);
    }

    function test_mintModel_withSkillParent_reverts() public {
        vm.prank(alice);
        uint256 sId = skillINFT.mintWithLineage(alice, bytes32("sRoot"), bytes32("sEnc"), noParents, defaultPolicy);

        ILineageRegistry.LineageEdge[] memory parents = new ILineageRegistry.LineageEdge[](1);
        parents[0] = ILineageRegistry.LineageEdge({
            child: 0, parent: sId, weightBps: 10000, eType: ILineageRegistry.EdgeType.Composes
        });

        vm.prank(bob);
        vm.expectRevert("ModelINFT: parents must be Data or Model");
        modelINFT.mintWithLineage(bob, bytes32("mRoot"), bytes32("mEnc"), parents, defaultPolicy);
    }

    // ─── Acyclic enforcement ─────────────────────────────────────────────────

    function test_cycleDetection() public {
        vm.prank(alice);
        uint256 dId = dataINFT.mintWithLineage(alice, bytes32("dRoot"), bytes32("dEnc"), noParents, defaultPolicy);

        ILineageRegistry.LineageEdge[] memory p1 = new ILineageRegistry.LineageEdge[](1);
        p1[0] = ILineageRegistry.LineageEdge({child: 0, parent: dId, weightBps: 10000, eType: ILineageRegistry.EdgeType.TrainedOn});

        vm.prank(bob);
        uint256 mId = modelINFT.mintWithLineage(bob, bytes32("mRoot"), bytes32("mEnc"), p1, defaultPolicy);

        ILineageRegistry.LineageEdge[] memory p2 = new ILineageRegistry.LineageEdge[](1);
        p2[0] = ILineageRegistry.LineageEdge({child: 0, parent: mId, weightBps: 10000, eType: ILineageRegistry.EdgeType.Composes});

        vm.prank(alice);
        skillINFT.mintWithLineage(alice, bytes32("sRoot"), bytes32("sEnc"), p2, defaultPolicy);

        // mId's ancestor chain: dId. So isAcyclic(dId, [mId]) should be false (dId ← mId would cycle)
        uint256[] memory badParents = new uint256[](1);
        badParents[0] = mId;
        assertFalse(registry.isAcyclic(dId, badParents));
    }

    // ─── Weight validation ───────────────────────────────────────────────────

    function test_weightsNotSumTo10000_reverts() public {
        vm.prank(alice);
        uint256 d1 = dataINFT.mintWithLineage(alice, bytes32("r1"), bytes32("e1"), noParents, defaultPolicy);
        vm.prank(alice);
        uint256 d2 = dataINFT.mintWithLineage(alice, bytes32("r2"), bytes32("e2"), noParents, defaultPolicy);

        ILineageRegistry.LineageEdge[] memory parents = new ILineageRegistry.LineageEdge[](2);
        parents[0] = ILineageRegistry.LineageEdge({child: 0, parent: d1, weightBps: 3000, eType: ILineageRegistry.EdgeType.TrainedOn});
        parents[1] = ILineageRegistry.LineageEdge({child: 0, parent: d2, weightBps: 3000, eType: ILineageRegistry.EdgeType.TrainedOn});

        vm.prank(bob);
        vm.expectRevert("weights must sum to 10000");
        modelINFT.mintWithLineage(bob, bytes32("mRoot"), bytes32("mEnc"), parents, defaultPolicy);
    }

    // ─── Royalty policy timelock ─────────────────────────────────────────────

    function test_royaltyUpdate_timelocked() public {
        vm.prank(alice);
        uint256 dId = dataINFT.mintWithLineage(alice, bytes32("r1"), bytes32("e1"), noParents, defaultPolicy);

        ILineageRegistry.RoyaltyPolicy memory newPolicy = ILineageRegistry.RoyaltyPolicy({
            totalRoyaltyBps: 800,
            paymentToken: address(0),
            pauseUntil: 0,
            ownerSplitBps: 7000
        });

        // Only owner (alice) can update
        vm.prank(alice);
        registry.updateRoyaltyPolicy(dId, newPolicy);

        // Policy not yet applied
        ILineageRegistry.RoyaltyPolicy memory current = registry.getRoyaltyPolicy(dId);
        assertEq(current.totalRoyaltyBps, 500);

        // Warp past timelock
        vm.warp(block.timestamp + 25 hours);
        registry.finalizeRoyaltyUpdate(dId);

        current = registry.getRoyaltyPolicy(dId);
        assertEq(current.totalRoyaltyBps, 800);
    }

    // ─── Multiple parents, balanced weights ──────────────────────────────────

    function test_mintModel_twoDataParents() public {
        vm.prank(alice);
        uint256 d1 = dataINFT.mintWithLineage(alice, bytes32("r1"), bytes32("e1"), noParents, defaultPolicy);
        vm.prank(alice);
        uint256 d2 = dataINFT.mintWithLineage(alice, bytes32("r2"), bytes32("e2"), noParents, defaultPolicy);

        ILineageRegistry.LineageEdge[] memory parents = new ILineageRegistry.LineageEdge[](2);
        parents[0] = ILineageRegistry.LineageEdge({child: 0, parent: d1, weightBps: 6000, eType: ILineageRegistry.EdgeType.TrainedOn});
        parents[1] = ILineageRegistry.LineageEdge({child: 0, parent: d2, weightBps: 4000, eType: ILineageRegistry.EdgeType.TrainedOn});

        vm.prank(bob);
        uint256 mId = modelINFT.mintWithLineage(bob, bytes32("mRoot"), bytes32("mEnc"), parents, defaultPolicy);

        ILineageRegistry.LineageEdge[] memory edges = registry.getParents(mId);
        assertEq(edges.length, 2);
        assertEq(edges[0].weightBps + edges[1].weightBps, 10000);
    }
}
