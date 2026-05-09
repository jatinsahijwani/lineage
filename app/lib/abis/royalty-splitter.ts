// Auto-extracted from contracts/out/RoyaltySplitter.sol/RoyaltySplitter.json
// Do not edit by hand. Re-run app/scripts/copy-abis.mjs to regenerate.

export const ROYALTY_SPLITTER_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "operator_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "verifier_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      {
        "name": "batchId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "proof",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getBatch",
    "inputs": [
      {
        "name": "batchId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IRoyaltySplitter.SettlementBatch",
        "components": [
          {
            "name": "batchId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "merkleRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "windowStart",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "windowEnd",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "receiptCount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "daPointer",
            "type": "tuple",
            "internalType": "struct IRoyaltySplitter.DAPointer",
            "components": [
              {
                "name": "commitment",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "blobIndex",
                "type": "uint64",
                "internalType": "uint64"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "latestBatchId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "operator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "postBatch",
    "inputs": [
      {
        "name": "batch",
        "type": "tuple",
        "internalType": "struct IRoyaltySplitter.SettlementBatch",
        "components": [
          {
            "name": "batchId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "merkleRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "windowStart",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "windowEnd",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "receiptCount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "daPointer",
            "type": "tuple",
            "internalType": "struct IRoyaltySplitter.DAPointer",
            "components": [
              {
                "name": "commitment",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "blobIndex",
                "type": "uint64",
                "internalType": "uint64"
              }
            ]
          }
        ]
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setOperator",
    "inputs": [
      {
        "name": "operator_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "verifier",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAttributionVerifier"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "BatchPosted",
    "inputs": [
      {
        "name": "batchId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "merkleRoot",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "receiptCount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Claimed",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "batchId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  }
] as const;
