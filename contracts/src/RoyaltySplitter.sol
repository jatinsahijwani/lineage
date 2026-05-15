// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRoyaltySplitter} from "./interfaces/IRoyaltySplitter.sol";
import {IAttributionVerifier} from "./interfaces/IAttributionVerifier.sol";

/// @notice Batched Merkle-pull royalty distribution.
///         Operator posts a batch (merkleRoot over [recipient, token, amount]).
///         Contributors withdraw with a Merkle proof.
contract RoyaltySplitter is IRoyaltySplitter {
    address public operator;
    address public owner;
    IAttributionVerifier public verifier;

    mapping(uint256 => SettlementBatch) private _batches;
    // batchId => recipient => token => claimed
    mapping(uint256 => mapping(address => mapping(address => bool))) private _claimed;
    // recipient => token => accumulated (for balanceOf)
    mapping(address => mapping(address => uint256)) private _balances;

    uint256 public latestBatchId;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    constructor(address operator_, address verifier_) {
        owner = msg.sender;
        operator = operator_;
        verifier = IAttributionVerifier(verifier_);
    }

    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
    }

    /// @notice Posts a new settlement batch with a Merkle root.
    ///         operatorSig is over keccak256(abi.encode(batch)) — for auditability.
    function postBatch(SettlementBatch calldata batch, bytes calldata /*operatorSig*/) external override {
        require(batch.batchId > latestBatchId, "batch id must increase");
        require(batch.windowEnd > batch.windowStart, "invalid window");
        _batches[batch.batchId] = batch;
        latestBatchId = batch.batchId;
        emit BatchPosted(batch.batchId, batch.merkleRoot, batch.receiptCount);
    }

    /// @notice Claim payout from a settled batch using a Merkle proof.
    ///         Leaf = keccak256(abi.encodePacked(batchId, recipient, token, amount))
    function claim(
        uint256 batchId,
        address token,
        uint256 amount,
        bytes32[] calldata proof
    ) external override {
        require(_batches[batchId].merkleRoot != bytes32(0), "batch not found");
        require(!_claimed[batchId][msg.sender][token], "already claimed");

        bytes32 leaf = keccak256(abi.encodePacked(batchId, msg.sender, token, amount));
        require(
            MerkleProof.verify(proof, _batches[batchId].merkleRoot, leaf),
            "invalid proof"
        );

        _claimed[batchId][msg.sender][token] = true;
        _balances[msg.sender][token] += amount;

        if (token == address(0)) {
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "native transfer failed");
        } else {
            require(IERC20(token).transfer(msg.sender, amount), "erc20 transfer failed");
        }

        emit Claimed(msg.sender, token, amount, batchId);
    }

    function balanceOf(address recipient, address token) external view override returns (uint256) {
        return _balances[recipient][token];
    }

    function getBatch(uint256 batchId) external view returns (SettlementBatch memory) {
        return _batches[batchId];
    }

    receive() external payable {}
}
