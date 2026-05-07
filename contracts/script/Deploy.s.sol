// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LineageRegistry} from "../src/LineageRegistry.sol";
import {DataINFT} from "../src/DataINFT.sol";
import {ModelINFT} from "../src/ModelINFT.sol";
import {SkillINFT} from "../src/SkillINFT.sol";
import {RoyaltySplitter} from "../src/RoyaltySplitter.sol";
import {AttributionVerifier} from "../src/AttributionVerifier.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);

        // 1. Registry
        LineageRegistry registry = new LineageRegistry();
        console.log("LineageRegistry:", address(registry));

        // 2. iNFT contracts
        DataINFT  dataINFT  = new DataINFT(address(registry));
        ModelINFT modelINFT = new ModelINFT(address(registry));
        SkillINFT skillINFT = new SkillINFT(address(registry));
        console.log("DataINFT:",  address(dataINFT));
        console.log("ModelINFT:", address(modelINFT));
        console.log("SkillINFT:", address(skillINFT));

        // 3. Authorize iNFT contracts as registry minters
        registry.authorizeMinter(address(dataINFT));
        registry.authorizeMinter(address(modelINFT));
        registry.authorizeMinter(address(skillINFT));

        // 4. Verifier
        AttributionVerifier verifier = new AttributionVerifier();
        console.log("AttributionVerifier:", address(verifier));

        // 5. Splitter (operator = deployer for v1)
        RoyaltySplitter splitter = new RoyaltySplitter(deployer, address(verifier));
        console.log("RoyaltySplitter:", address(splitter));

        // 6. Wire verifier → splitter
        verifier.setSplitter(address(splitter));

        // 7. Seed the trusted TEE signer for the 0G chatbot service
        //    (mirrors ZG_CHATBOT_SERVICE.teeSignerAddress in
        //    packages/shared/src/0g-testnet.ts). Operator addresses are
        //    project-specific and seeded by the e2e demo script.
        address teeSigner = 0x83df4B8EbA7c0B3B740019b8c9a77ffF77D508cF;
        verifier.setTrustedTEESigner(teeSigner, true);
        console.log("Seeded trusted TEE signer:", teeSigner);

        vm.stopBroadcast();

        console.log("---");
        console.log("Deployer / operator:", deployer);
    }
}
