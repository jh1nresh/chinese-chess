/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/xiangqi_match.json`.
 */
export type XiangqiMatch = {
  "address": "E7oLP2LUd16wRVDp6hZfC8xxbG7TfMmjtEeaWyYWqt2",
  "metadata": {
    "name": "xiangqiMatch",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "MagicBlock Ephemeral Rollup match state for 3D Xiangqi"
  },
  "instructions": [
    {
      "name": "acceptDraw",
      "discriminator": [
        5,
        12,
        23,
        213,
        201,
        27,
        117,
        193
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "cancelWaitingMatch",
      "discriminator": [
        163,
        84,
        224,
        160,
        9,
        211,
        90,
        221
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "red",
          "writable": true,
          "signer": true,
          "relations": [
            "game"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "claimPayout",
      "discriminator": [
        127,
        240,
        132,
        62,
        227,
        198,
        146,
        133
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "red",
          "writable": true
        },
        {
          "name": "black",
          "writable": true
        },
        {
          "name": "payer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimTimeout",
      "discriminator": [
        130,
        234,
        45,
        53,
        120,
        90,
        86,
        178
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimVictory",
      "discriminator": [
        119,
        177,
        84,
        236,
        128,
        134,
        183,
        199
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "commitAndUndelegate",
      "discriminator": [
        9,
        108,
        132,
        87,
        184,
        76,
        98,
        84
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "commitMatch",
      "discriminator": [
        175,
        146,
        74,
        234,
        39,
        25,
        248,
        114
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateMatch",
      "discriminator": [
        30,
        116,
        9,
        69,
        147,
        61,
        133,
        238
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                3,
                92,
                60,
                238,
                198,
                95,
                36,
                44,
                214,
                155,
                228,
                35,
                184,
                39,
                97,
                172,
                250,
                46,
                165,
                225,
                118,
                188,
                205,
                162,
                12,
                37,
                221,
                128,
                103,
                33,
                75,
                135
              ]
            }
          }
        },
        {
          "name": "delegationRecordPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "pda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "E7oLP2LUd16wRVDp6hZfC8xxbG7TfMmjtEeaWyYWqt2"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeMatch",
      "discriminator": [
        156,
        133,
        52,
        179,
        176,
        29,
        64,
        124
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "red"
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "red",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "u64"
        },
        {
          "name": "stakeLamports",
          "type": "u64"
        },
        {
          "name": "joinDeadline",
          "type": "i64"
        },
        {
          "name": "turnTimeoutSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "joinMatch",
      "discriminator": [
        244,
        8,
        47,
        130,
        192,
        59,
        179,
        44
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "black",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "offerDraw",
      "discriminator": [
        87,
        16,
        73,
        235,
        76,
        137,
        216,
        229
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "playMove",
      "discriminator": [
        238,
        70,
        57,
        142,
        51,
        180,
        219,
        31
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "from",
          "type": "u8"
        },
        {
          "name": "to",
          "type": "u8"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "resign",
      "discriminator": [
        177,
        177,
        153,
        96,
        88,
        149,
        206,
        225
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  120,
                  105,
                  97,
                  110,
                  103,
                  113,
                  105
                ]
              },
              {
                "kind": "account",
                "path": "game.red",
                "account": "xiangqiMatch"
              },
              {
                "kind": "account",
                "path": "game.match_id",
                "account": "xiangqiMatch"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "xiangqiMatch",
      "discriminator": [
        163,
        228,
        180,
        213,
        149,
        223,
        143,
        150
      ]
    }
  ],
  "events": [
    {
      "name": "drawOffered",
      "discriminator": [
        191,
        249,
        70,
        90,
        30,
        226,
        137,
        126
      ]
    },
    {
      "name": "matchCancelled",
      "discriminator": [
        99,
        86,
        22,
        122,
        82,
        247,
        60,
        113
      ]
    },
    {
      "name": "matchFinished",
      "discriminator": [
        64,
        23,
        27,
        37,
        145,
        154,
        100,
        255
      ]
    },
    {
      "name": "matchSettled",
      "discriminator": [
        243,
        201,
        134,
        151,
        193,
        131,
        223,
        150
      ]
    },
    {
      "name": "movePlayed",
      "discriminator": [
        61,
        60,
        170,
        174,
        207,
        166,
        163,
        146
      ]
    },
    {
      "name": "stakeDeposited",
      "discriminator": [
        69,
        152,
        144,
        109,
        232,
        34,
        225,
        19
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "matchAlreadyStarted",
      "msg": "The match has already started"
    },
    {
      "code": 6001,
      "name": "samePlayer",
      "msg": "Red and Black must use different wallets"
    },
    {
      "code": 6002,
      "name": "matchNotActive",
      "msg": "The match is not active"
    },
    {
      "code": 6003,
      "name": "wrongPlayer",
      "msg": "This wallet cannot move for the current side"
    },
    {
      "code": 6004,
      "name": "illegalMove",
      "msg": "The move violates Xiangqi rules or leaves the general in check"
    },
    {
      "code": 6005,
      "name": "moveOverflow",
      "msg": "The move counter overflowed"
    },
    {
      "code": 6006,
      "name": "matchHasLegalMoves",
      "msg": "The defending side still has a legal move"
    },
    {
      "code": 6007,
      "name": "invalidStake",
      "msg": "The stake must be greater than zero"
    },
    {
      "code": 6008,
      "name": "stakeTooLarge",
      "msg": "The stake exceeds the program safety cap"
    },
    {
      "code": 6009,
      "name": "invalidJoinDeadline",
      "msg": "The join deadline must be within the next 24 hours"
    },
    {
      "code": 6010,
      "name": "joinDeadlinePassed",
      "msg": "The join deadline has passed"
    },
    {
      "code": 6011,
      "name": "invalidTurnTimeout",
      "msg": "The turn timeout must be between 60 seconds and 24 hours"
    },
    {
      "code": 6012,
      "name": "noDrawOffer",
      "msg": "No draw offer is active"
    },
    {
      "code": 6013,
      "name": "cannotAcceptOwnDraw",
      "msg": "A player cannot accept their own draw offer"
    },
    {
      "code": 6014,
      "name": "turnNotTimedOut",
      "msg": "The active turn has not timed out"
    },
    {
      "code": 6015,
      "name": "alreadySettled",
      "msg": "This match has already paid out"
    },
    {
      "code": 6016,
      "name": "matchNotFinished",
      "msg": "The match is not ready for payout"
    },
    {
      "code": 6017,
      "name": "payoutOverflow",
      "msg": "The payout amount overflowed"
    },
    {
      "code": 6018,
      "name": "escrowUnderfunded",
      "msg": "The escrow account does not have enough spendable lamports"
    }
  ],
  "types": [
    {
      "name": "drawOffered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "matchCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "refund",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "matchFinished",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "matchSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "red",
            "type": "pubkey"
          },
          {
            "name": "black",
            "type": "pubkey"
          },
          {
            "name": "pot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "movePlayed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "ply",
            "type": "u16"
          },
          {
            "name": "from",
            "type": "u8"
          },
          {
            "name": "to",
            "type": "u8"
          },
          {
            "name": "captured",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stakeDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalPot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "xiangqiMatch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "u64"
          },
          {
            "name": "red",
            "type": "pubkey"
          },
          {
            "name": "black",
            "type": "pubkey"
          },
          {
            "name": "board",
            "type": {
              "array": [
                "u8",
                90
              ]
            }
          },
          {
            "name": "turn",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "ply",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "stakeLamports",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "joinDeadline",
            "type": "i64"
          },
          {
            "name": "lastActionAt",
            "type": "i64"
          },
          {
            "name": "turnTimeoutSeconds",
            "type": "i64"
          },
          {
            "name": "drawOffer",
            "type": "u8"
          },
          {
            "name": "settled",
            "type": "bool"
          },
          {
            "name": "lastFrom",
            "type": "u8"
          },
          {
            "name": "lastTo",
            "type": "u8"
          },
          {
            "name": "lastPlayer",
            "type": "pubkey"
          },
          {
            "name": "endReason",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
