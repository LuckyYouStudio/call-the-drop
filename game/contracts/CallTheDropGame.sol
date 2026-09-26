// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ICasinoGameV2, SessionContext, SessionPhase, StepResult } from "./ICasinoGameV2.sol";

/// @title Call the Drop — guess which item the boss drops.
/// @notice Instant game. The guest shows a boss's loot table (rare and better) with each item's
///         drop weight; the player picks one or more items. One VRF word reveals exactly one item,
///         weighted by the table. If it is among the picks the player is paid
///
///             payout = wager × 0.96 × totalWeight / pickedWeight
///
///         so every bet returns 96% whatever the table and whatever the picks. The table travels in
///         gameData and the roll is drawn from that same table, so a player who forges weights only
///         changes the odds they are offered, never the edge. No dungeon data lives on chain.
///
///         gameData = abi.encode(uint256 weightsLo, uint256 weightsHi, uint256 pickMask)
///           weightsLo: slots 0..15, 16 bits each (slot i at bits 16i..16i+15)
///           weightsHi: slots 16..31, same layout
///           Slots 0..n-1 must be non-zero and every slot from n on zero (2 <= n <= 32).
///           pickMask: bit i picks slot i; only bits < n, at least one, not all.
///         The picked share must be at least 0.096% of the table, which caps a win at 1000×.
contract CallTheDropGame is ICasinoGameV2 {
  uint256 internal constant RTP_BPS = 9600;
  uint256 internal constant BPS = 10_000;
  uint256 internal constant MAX_MULT = 1000;
  uint256 internal constant MAX_SLOTS = 32;
  uint256 internal constant SLOT_BITS = 16;
  uint256 internal constant SLOT_MASK = 0xffff;

  error CallTheDrop__InvalidGameData();
  error CallTheDrop__InvalidTable();
  error CallTheDrop__InvalidPick();
  error CallTheDrop__OddsTooLong();
  error CallTheDrop__ZeroWager();
  error CallTheDrop__NoPlayerAction();

  struct Bet {
    uint256[MAX_SLOTS] weights;
    uint256 count;
    uint256 total;
    uint256 picked;
    uint256 mask;
  }

  // ---------------------------------------------------------------- gameData

  function _decode(bytes calldata gameData) internal pure returns (Bet memory bet) {
    if (gameData.length != 96) revert CallTheDrop__InvalidGameData();
    (uint256 lo, uint256 hi, uint256 mask) = abi.decode(gameData, (uint256, uint256, uint256));

    bool ended;
    for (uint256 i = 0; i < MAX_SLOTS; i++) {
      uint256 word = i < 16 ? lo : hi;
      uint256 w = (word >> ((i % 16) * SLOT_BITS)) & SLOT_MASK;
      if (w == 0) {
        ended = true;
      } else {
        if (ended) revert CallTheDrop__InvalidTable(); // a gap inside the table
        bet.weights[i] = w;
        bet.count = i + 1;
        bet.total += w;
      }
    }
    if (bet.count < 2) revert CallTheDrop__InvalidTable();

    if (mask == 0 || mask >> bet.count != 0) revert CallTheDrop__InvalidPick();
    for (uint256 i = 0; i < bet.count; i++) {
      if ((mask >> i) & 1 == 1) bet.picked += bet.weights[i];
    }
    if (bet.picked == bet.total) revert CallTheDrop__InvalidPick();
    // payout multiple = 0.96 × total / picked must not exceed MAX_MULT.
    if (RTP_BPS * bet.total > BPS * MAX_MULT * bet.picked) revert CallTheDrop__OddsTooLong();
    bet.mask = mask;
  }

  /// @dev The single payout function: caps, risk quote and settlement all route here.
  function _payout(uint256 wager, Bet memory bet) internal pure returns (uint256) {
    return (wager * RTP_BPS * bet.total) / (BPS * bet.picked);
  }

  // ---------------------------------------------------------------- quotes

  /// @dev Quotes tolerate empty gameData (the whitelist guard probes with it) by answering for the
  ///      longest odds the game accepts — the worst case for every risk figure.
  function quoteCaps(
    uint256 wager,
    bytes calldata gameData
  ) external pure returns (uint256 maxEscrowStake, uint256 maxReservedProfit) {
    uint256 maxPayout = gameData.length == 0 ? wager * MAX_MULT : _payout(wager, _decode(gameData));
    maxEscrowStake = wager;
    maxReservedProfit = maxPayout > wager ? maxPayout - wager : 0;
  }

  function quoteRiskParams(
    uint256 wager,
    bytes calldata gameData
  )
    external
    pure
    returns (
      uint256 maxPayout,
      uint256 probabilityWad,
      uint256 expectedPayout,
      uint256 bodyVarianceScaled
    )
  {
    if (gameData.length == 0) {
      maxPayout = wager * MAX_MULT;
      probabilityWad = (RTP_BPS * 1e18) / (BPS * MAX_MULT);
    } else {
      Bet memory bet = _decode(gameData);
      maxPayout = _payout(wager, bet);
      probabilityWad = (bet.picked * 1e18) / bet.total;
    }
    expectedPayout = (wager * RTP_BPS) / BPS;
    bodyVarianceScaled = 0; // a single winning tier: win the quoted payout or nothing
  }

  // ---------------------------------------------------------------- steps

  function onSessionStart(
    SessionContext calldata ctx
  ) external pure returns (StepResult memory stepResult) {
    if (ctx.wagerBase == 0) revert CallTheDrop__ZeroWager();
    Bet memory bet = _decode(ctx.gameData);
    uint256 maxPayout = _payout(ctx.wagerBase, bet);

    stepResult.newGameState = abi.encode(uint256(0), uint256(0), bet.total, uint256(0));
    stepResult.escrowDelta = 0;
    stepResult.reservedProfitDelta = int256(maxPayout > ctx.wagerBase ? maxPayout - ctx.wagerBase : 0);
    stepResult.nextPhase = SessionPhase.WAITING_RANDOMNESS;
    stepResult.requestRandomnessNow = true;
    stepResult.payout = 0;
  }

  function onPlayerAction(
    SessionContext calldata,
    bytes calldata
  ) external pure returns (StepResult memory) {
    revert CallTheDrop__NoPlayerAction();
  }

  function onRandomness(
    SessionContext calldata ctx,
    bytes32 randomness
  ) external pure returns (StepResult memory stepResult) {
    Bet memory bet = _decode(ctx.gameData);
    uint256 roll = _rollFromRandomness(randomness, bet.total);
    uint256 index = _slotOf(bet, roll);
    bool won = (bet.mask >> index) & 1 == 1;

    // gameState = (dropped slot, roll, table total, won) — enough for the guest to present and for
    // anyone to re-derive the drop from the VRF word.
    stepResult.newGameState = abi.encode(index, roll, bet.total, won ? uint256(1) : uint256(0));
    stepResult.escrowDelta = 0;
    stepResult.reservedProfitDelta = 0; // the facet releases the reserve at settlement
    stepResult.nextPhase = SessionPhase.SETTLED;
    stepResult.requestRandomnessNow = false;
    stepResult.payout = won ? _payout(ctx.wagerBase, bet) : 0;
  }

  /// @dev Instant game: nothing is cashable mid-round.
  function quoteForfeitPayout(SessionContext calldata) external pure returns (uint256) {
    return 0;
  }

  // ---------------------------------------------------------------- randomness

  /// @dev Uniform roll in [0, domain) by rejection sampling over the full 256-bit word: words at or
  ///      above the largest multiple of `domain` are rehashed, never reduced.
  function _rollFromRandomness(bytes32 randomness, uint256 domain) internal pure returns (uint256) {
    uint256 excess = ((type(uint256).max % domain) + 1) % domain;
    uint256 lastAccepted = type(uint256).max - excess;
    bytes32 seed = randomness;
    while (true) {
      uint256 word = uint256(seed);
      if (word <= lastAccepted) return word % domain;
      seed = keccak256(abi.encodePacked(seed));
    }
    return 0; // unreachable
  }

  /// @dev Slot whose cumulative weight first exceeds the roll.
  function _slotOf(Bet memory bet, uint256 roll) internal pure returns (uint256) {
    uint256 cumulative;
    for (uint256 i = 0; i < bet.count; i++) {
      cumulative += bet.weights[i];
      if (roll < cumulative) return i;
    }
    return bet.count - 1; // unreachable: roll < total
  }

  // ---------------------------------------------------------------- views for verifiers

  /// @notice Public mirror of the settlement mapping so anyone can check a drop off a VRF word.
  function previewOutcome(
    bytes calldata gameData,
    bytes32 randomness
  ) external pure returns (uint256 index, uint256 roll, bool won, uint256 payoutPerUnit) {
    Bet memory bet = _decode(gameData);
    roll = _rollFromRandomness(randomness, bet.total);
    index = _slotOf(bet, roll);
    won = (bet.mask >> index) & 1 == 1;
    payoutPerUnit = _payout(1e18, bet);
  }
}
