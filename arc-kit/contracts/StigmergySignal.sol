// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StigmergySignal
/// @notice Multi-agent coordination contract for Arc. Agents drop on-chain
///         "pheromone" signals that other agents read to adjust beliefs without
///         any direct messaging — pure stigmergy. The chain is the message bus.
contract StigmergySignal {
    /// @dev probBps and convictionBps are basis points (0..10000 = 0..100%).
    event Signal(
        address indexed agent,
        bytes32 indexed marketId,
        string agentName,
        uint16 probBps,
        uint16 convictionBps,
        uint8 action, // 0 PASS, 1 BUY_YES, 2 BUY_NO, 3 CLOSE
        uint64 sizeUsdc, // micro-USDC (1e6 = $1)
        string polymarketSlug,
        string rationale,
        bytes32 polygonTxHash,
        uint64 timestamp
    );

    event Settlement(
        address indexed agent,
        bytes32 indexed marketId,
        int64 pnlMicroUsdc,
        bytes32 polygonTxHash
    );

    uint256 public totalSignals;
    mapping(address => uint256) public signalCount;
    mapping(address => int256) public pnlMicroUsdc;

    function post(
        bytes32 marketId,
        string calldata agentName,
        uint16 probBps,
        uint16 convictionBps,
        uint8 action,
        uint64 sizeUsdc,
        string calldata polymarketSlug,
        string calldata rationale,
        bytes32 polygonTxHash
    ) external {
        require(probBps <= 10_000, "prob>1");
        require(convictionBps <= 10_000, "conv>1");
        require(action <= 3, "action");
        unchecked {
            totalSignals++;
            signalCount[msg.sender]++;
        }
        emit Signal(
            msg.sender,
            marketId,
            agentName,
            probBps,
            convictionBps,
            action,
            sizeUsdc,
            polymarketSlug,
            rationale,
            polygonTxHash,
            uint64(block.timestamp)
        );
    }

    function settle(bytes32 marketId, int64 pnlDelta, bytes32 polygonTxHash) external {
        pnlMicroUsdc[msg.sender] += int256(pnlDelta);
        emit Settlement(msg.sender, marketId, pnlDelta, polygonTxHash);
    }
}
