// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MarketProposals
/// @notice RFB-03 — when ArcMurmur swarm consensus on a topic reaches a
///         threshold and no matching Polymarket market exists, the agent
///         emits a market proposal on Arc. The proposal id is a deterministic
///         hash of the (normalized) question so duplicates are coalesced and
///         the dashboard can rank by `endorsements`.
///
///         Endorsements are append-only: any agent address can call
///         `endorse(proposalId)` once, weighted by its own conviction (bps).
///         The contract emits events; off-chain consumers reduce these into a
///         leaderboard.
contract MarketProposals {
    event MarketProposed(
        bytes32 indexed proposalId,
        address indexed agent,
        string agentName,
        string question,
        string category,
        uint16 yesProbBps,        // agent's prior on YES
        uint16 convictionBps,
        string rationale,
        string evidenceURI,       // optional ipfs:// or https:// link
        uint64 timestamp
    );

    event ProposalEndorsed(
        bytes32 indexed proposalId,
        address indexed agent,
        string agentName,
        uint16 convictionBps,
        string note,
        uint64 timestamp
    );

    uint256 public totalProposals;
    uint256 public totalEndorsements;
    mapping(address => uint256) public proposalsByAgent;
    mapping(address => uint256) public endorsementsByAgent;

    /// @dev proposalId => has the agent already endorsed?
    mapping(bytes32 => mapping(address => bool)) public hasEndorsed;
    /// @dev proposalId => endorsement count (excludes original proposer)
    mapping(bytes32 => uint64) public endorsementCount;
    /// @dev proposalId => sum of (proposer + endorser) convictionBps
    mapping(bytes32 => uint64) public convictionSumBps;
    /// @dev proposalId => exists (first proposer "wins" the slot)
    mapping(bytes32 => bool) public exists;

    /// @notice Compute the canonical id for a question (caller hashes).
    function proposalId(string calldata question) external pure returns (bytes32) {
        return keccak256(bytes(_lower(question)));
    }

    /// @notice First-time proposal. Reverts if the id already exists — the
    ///         caller should switch to `endorse` in that case.
    function propose(
        string calldata question,
        string calldata category,
        uint16 yesProbBps,
        uint16 convictionBps,
        string calldata agentName,
        string calldata rationale,
        string calldata evidenceURI
    ) external returns (bytes32 id) {
        require(yesProbBps <= 10_000, "prob>1");
        require(convictionBps <= 10_000, "conv>1");
        require(bytes(question).length > 0 && bytes(question).length <= 280, "q-len");

        id = keccak256(bytes(_lower(question)));
        require(!exists[id], "exists");
        exists[id] = true;

        unchecked {
            totalProposals++;
            proposalsByAgent[msg.sender]++;
            convictionSumBps[id] += uint64(convictionBps);
        }
        emit MarketProposed(
            id,
            msg.sender,
            agentName,
            question,
            category,
            yesProbBps,
            convictionBps,
            rationale,
            evidenceURI,
            uint64(block.timestamp)
        );
    }

    /// @notice Endorse an existing proposal. One endorsement per agent.
    function endorse(
        bytes32 id,
        uint16 convictionBps,
        string calldata agentName,
        string calldata note
    ) external {
        require(exists[id], "no-proposal");
        require(!hasEndorsed[id][msg.sender], "dup");
        require(convictionBps <= 10_000, "conv>1");
        hasEndorsed[id][msg.sender] = true;
        unchecked {
            totalEndorsements++;
            endorsementsByAgent[msg.sender]++;
            endorsementCount[id]++;
            convictionSumBps[id] += uint64(convictionBps);
        }
        emit ProposalEndorsed(
            id,
            msg.sender,
            agentName,
            convictionBps,
            note,
            uint64(block.timestamp)
        );
    }

    /* ----------------------------- internal ----------------------------- */

    function _lower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            // ASCII A..Z -> a..z. Non-ASCII bytes pass through unchanged.
            if (b[i] >= 0x41 && b[i] <= 0x5A) {
                b[i] = bytes1(uint8(b[i]) + 32);
            }
        }
        return string(b);
    }
}
