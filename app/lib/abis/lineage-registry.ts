// Auto-extracted from contracts/out/LineageRegistry.sol/LineageRegistry.json
// Do not edit by hand. Re-run app/scripts/copy-abis.mjs to regenerate.

export const LINEAGE_REGISTRY_ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_DEPTH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ROYALTY_TIMELOCK",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "authorizeMinter",
    "inputs": [
      {
        "name": "minter",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "authorizedMinters",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "finalizeRoyaltyUpdate",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getINFT",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ILineageRegistry.INFTRecord",
        "components": [
          {
            "name": "tokenId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "storageRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "iType",
            "type": "uint8",
            "internalType": "enum ILineageRegistry.INFTType"
          },
          {
            "name": "royaltyBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "royaltyReceiver",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "createdAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "paused",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getParents",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct ILineageRegistry.LineageEdge[]",
        "components": [
          {
            "name": "child",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "parent",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "weightBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "eType",
            "type": "uint8",
            "internalType": "enum ILineageRegistry.EdgeType"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoyaltyPolicy",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ILineageRegistry.RoyaltyPolicy",
        "components": [
          {
            "name": "totalRoyaltyBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "paymentToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "pauseUntil",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "ownerSplitBps",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isAcyclic",
    "inputs": [
      {
        "name": "candidateChild",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "candidateParents",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
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
    "name": "registerINFT",
    "inputs": [
      {
        "name": "inftOwner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "iType",
        "type": "uint8",
        "internalType": "enum ILineageRegistry.INFTType"
      },
      {
        "name": "storageRoot",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "parents",
        "type": "tuple[]",
        "internalType": "struct ILineageRegistry.LineageEdge[]",
        "components": [
          {
            "name": "child",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "parent",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "weightBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "eType",
            "type": "uint8",
            "internalType": "enum ILineageRegistry.EdgeType"
          }
        ]
      },
      {
        "name": "policy",
        "type": "tuple",
        "internalType": "struct ILineageRegistry.RoyaltyPolicy",
        "components": [
          {
            "name": "totalRoyaltyBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "paymentToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "pauseUntil",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "ownerSplitBps",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeMinter",
    "inputs": [
      {
        "name": "minter",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateRoyaltyPolicy",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "policy",
        "type": "tuple",
        "internalType": "struct ILineageRegistry.RoyaltyPolicy",
        "components": [
          {
            "name": "totalRoyaltyBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "paymentToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "pauseUntil",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "ownerSplitBps",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "EdgeRecorded",
    "inputs": [
      {
        "name": "child",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "parent",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "weightBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "eType",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum ILineageRegistry.EdgeType"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "INFTRegistered",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "iType",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum ILineageRegistry.INFTType"
      },
      {
        "name": "storageRoot",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoyaltyPolicyUpdated",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "policy",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct ILineageRegistry.RoyaltyPolicy",
        "components": [
          {
            "name": "totalRoyaltyBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "paymentToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "pauseUntil",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "ownerSplitBps",
            "type": "uint16",
            "internalType": "uint16"
          }
        ]
      }
    ],
    "anonymous": false
  }
] as const;
