
let events = [];

function calculatePercentages(bets) {
  const total = bets.reduce((a, b) => a + b, 0);
  return bets.map(b => total > 0 ? (b / total) * 100 : 0);
}

// (zkráceno kvůli délce)
