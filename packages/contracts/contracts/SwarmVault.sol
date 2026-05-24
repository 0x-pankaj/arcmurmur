// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title SwarmVault
/// @notice User-facing vault for ArcMurmur. Users on Arc Testnet:
///         - deposit USDC (the ERC-20 interface of Arc's native USDC, 6 decimals)
///         - opt into "copy the swarm" mode, so agent decisions allocate from
///           their share pro-rata,
///         - contribute sentiment signals on markets (becomes a stigmergy
///           pheromone the agents read),
///         - settle PnL on Arc and withdraw.
///
///         Polymarket execution still happens on Polygon via CCTP, but every
///         user-visible action is an Arc event judges can verify on Arcscan.
contract SwarmVault {
    IERC20 public immutable usdc;
    address public immutable agentRegistry; // optional StigmergySignal addr

    uint256 public totalDeposits;            // sum of all user deposits (gross)
    uint256 public totalShares;              // shares outstanding (1:1 with USDC at genesis)
    int256  public realizedPnlMicroUsdc;     // realized PnL across the swarm
    int256  public unrealizedPnlMicroUsdc;   // mark-to-market PnL (set by agents)
    uint64  public userCount;
    uint64  public signalCount;
    uint64  public positionCount;

    struct UserPos {
        uint128 deposited;     // total ever deposited (gross), micro-USDC
        uint128 withdrawn;     // total ever withdrawn (gross), micro-USDC
        uint128 shares;        // current share balance
        bool    copyEnabled;
        bool    seen;
    }

    mapping(address => UserPos) public users;

    /// @dev one slot per (agent, marketId) so settle can find a position again.
    struct Position {
        address agent;
        bytes32 marketId;
        uint8   action;        // 1 BUY_YES, 2 BUY_NO
        uint64  sizeUsdc;      // micro-USDC notional
        uint64  entryProbBps;  // 0..10000
        uint64  openedAt;
        int64   pnlMicroUsdc;  // 0 while open, set on settle
        bool    settled;
    }

    Position[] public positions;
    mapping(bytes32 => uint256) public positionByKey; // keccak256(agent,marketId) -> id+1

    event Deposit(address indexed user, uint256 amount, uint128 newShares, uint64 totalUsers);
    event Withdraw(address indexed user, uint256 amount, uint128 sharesBurned);
    event CopyToggled(address indexed user, bool enabled);
    event UserSignal(
        address indexed user,
        bytes32 indexed marketId,
        string marketSlug,
        int8 lean,          // -100..100 (bearish..bullish)
        string note,
        uint64 timestamp
    );
    event PositionOpened(
        uint256 indexed id,
        address indexed agent,
        bytes32 indexed marketId,
        string marketSlug,
        uint8 action,
        uint64 sizeUsdc,
        uint64 entryProbBps,
        string rationale,
        bytes32 polygonTxHash,
        uint64 timestamp
    );
    event PositionMarked(uint256 indexed id, int64 unrealizedDeltaMicroUsdc, uint64 markProbBps);
    event PositionSettled(uint256 indexed id, int64 pnlMicroUsdc, bytes32 polygonTxHash);

    constructor(address usdc_, address agentRegistry_) {
        usdc = IERC20(usdc_);
        agentRegistry = agentRegistry_;
    }

    /* ------------------------- USER ENTRYPOINTS ------------------------- */

    function deposit(uint256 amount) external {
        require(amount > 0, "amount=0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "xferFrom");
        UserPos storage u = users[msg.sender];
        if (!u.seen) {
            u.seen = true;
            u.copyEnabled = true; // default: copy the swarm
            unchecked { userCount++; }
        }
        // Shares are 1:1 with USDC for the hackathon — keeps math obvious.
        u.deposited += uint128(amount);
        u.shares += uint128(amount);
        totalDeposits += amount;
        totalShares += amount;
        emit Deposit(msg.sender, amount, u.shares, userCount);
    }

    function withdraw(uint256 amount) external {
        UserPos storage u = users[msg.sender];
        require(amount > 0 && uint256(u.shares) >= amount, "shares");
        u.shares -= uint128(amount);
        u.withdrawn += uint128(amount);
        totalShares -= amount;
        require(usdc.transfer(msg.sender, amount), "xfer");
        emit Withdraw(msg.sender, amount, uint128(amount));
    }

    function setCopyEnabled(bool enabled) external {
        UserPos storage u = users[msg.sender];
        require(u.seen, "deposit first");
        u.copyEnabled = enabled;
        emit CopyToggled(msg.sender, enabled);
    }

    /// @notice Users contribute a sentiment signal which agents read next tick.
    /// @param lean -100..100 bps-style integer where negative = bearish.
    function sendSignal(
        bytes32 marketId,
        string calldata marketSlug,
        int8 lean,
        string calldata note
    ) external {
        require(lean >= -100 && lean <= 100, "lean");
        unchecked { signalCount++; }
        emit UserSignal(msg.sender, marketId, marketSlug, lean, note, uint64(block.timestamp));
    }

    /* ------------------------- AGENT ENTRYPOINTS ------------------------ */

    function openPosition(
        bytes32 marketId,
        string calldata marketSlug,
        uint8 action,
        uint64 sizeUsdc,
        uint64 entryProbBps,
        string calldata rationale,
        bytes32 polygonTxHash
    ) external returns (uint256 id) {
        require(action == 1 || action == 2, "action");
        require(entryProbBps <= 10_000, "prob>1");
        id = positions.length;
        positions.push(Position({
            agent: msg.sender,
            marketId: marketId,
            action: action,
            sizeUsdc: sizeUsdc,
            entryProbBps: entryProbBps,
            openedAt: uint64(block.timestamp),
            pnlMicroUsdc: 0,
            settled: false
        }));
        positionByKey[keccak256(abi.encode(msg.sender, marketId))] = id + 1;
        unchecked { positionCount++; }
        emit PositionOpened(
            id, msg.sender, marketId, marketSlug,
            action, sizeUsdc, entryProbBps, rationale,
            polygonTxHash, uint64(block.timestamp)
        );
    }

    /// @notice Periodic mark-to-market from agents.
    function markPosition(uint256 id, uint64 markProbBps) external {
        Position storage p = positions[id];
        require(!p.settled, "settled");
        require(markProbBps <= 10_000, "prob>1");
        int256 entry = int256(uint256(p.entryProbBps));
        int256 mark  = int256(uint256(markProbBps));
        // pnl = size * (mark - entry) if BUY_YES, else size * (entry - mark)
        int256 delta = p.action == 1 ? (mark - entry) : (entry - mark);
        int64 unrealized = int64(delta * int256(uint256(p.sizeUsdc)) / 10_000);
        unrealizedPnlMicroUsdc += int256(unrealized);
        emit PositionMarked(id, unrealized, markProbBps);
    }

    function settlePosition(uint256 id, int64 pnlMicroUsdc, bytes32 polygonTxHash) external {
        Position storage p = positions[id];
        require(!p.settled, "settled");
        p.settled = true;
        p.pnlMicroUsdc = pnlMicroUsdc;
        realizedPnlMicroUsdc += int256(pnlMicroUsdc);
        emit PositionSettled(id, pnlMicroUsdc, polygonTxHash);
    }

    /* ------------------------- VIEWS ------------------------- */

    function userInfo(address u) external view returns (
        uint128 deposited,
        uint128 withdrawn,
        uint128 shares,
        bool copyEnabled,
        int256 estimatedPnlMicroUsdc
    ) {
        UserPos storage p = users[u];
        deposited = p.deposited;
        withdrawn = p.withdrawn;
        shares = p.shares;
        copyEnabled = p.copyEnabled;
        if (totalShares == 0) {
            estimatedPnlMicroUsdc = 0;
        } else {
            estimatedPnlMicroUsdc =
                (realizedPnlMicroUsdc + unrealizedPnlMicroUsdc) * int256(uint256(p.shares)) / int256(totalShares);
        }
    }

    function stats() external view returns (
        uint256 _totalDeposits,
        uint256 _totalShares,
        uint64 _userCount,
        uint64 _signalCount,
        uint64 _positionCount,
        int256 _realized,
        int256 _unrealized
    ) {
        return (
            totalDeposits, totalShares, userCount, signalCount, positionCount,
            realizedPnlMicroUsdc, unrealizedPnlMicroUsdc
        );
    }
}
