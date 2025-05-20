const events = [];

function calculatePercentages(bets) {
  const total = bets.reduce((a, b) => a + b, 0);
  return bets.map(b => total > 0 ? (b / total) * 100 : 0);
}

function renderLeaderboard() {
  const list = document.getElementById("leaderboard-list");
  const users = getUsers();
  const sorted = Object.entries(users).sort((a, b) => b[1].points - a[1].points);
  const currentUser = getCurrentUser()?.username;

  list.innerHTML = sorted.map(([username, data], index) => {
    const cls = username === currentUser ? "current-user" : "";
    return `<li class="${cls}">#${index + 1} ${username}: ${data.points} bodů</li>`;
  }).join("");
}

function renderEvents() {
  const eventList = document.getElementById("event-list");
  eventList.innerHTML = "";

  events.forEach((event, eventIndex) => {
    const div = document.createElement("div");
    div.className = "event";
    const percentages = calculatePercentages(event.bets);

    let content = `<h2>${event.streamer}</h2><p>${event.description}</p>`;

    event.options.forEach((option, i) => {
      content += `<div class="option-row">
        <button onclick="placeBet(${eventIndex}, ${i})" ${event.resolved ? "disabled" : ""}>${option}</button>
        <span>${percentages[i].toFixed(1)} %</span>
        <span style="color: gray;">(vsazeno: ${event.bets[i]} bodů)</span>
      </div>`;
    });

    const user = getCurrentUser();
    if (user && event.userBets[user.username] && !event.resolved) {
      Object.entries(event.userBets[user.username]).forEach(([optIdx, amount]) => {
        const resale = Math.round(amount * (percentages[optIdx] / 100));
        content += `<button onclick="sellBet(${eventIndex}, ${optIdx})">Prodat sázku ${event.options[optIdx]} za ${resale} bodů</button>`;
      });
    }

    if (user?.isAdmin && !event.resolved) {
      content += `<div style="margin-top:10px;">
        <label>Vyber vítěznou možnost:
          <select id="resolve-${eventIndex}">
            ${event.options.map((o, i) => `<option value="${i}">${o}</option>`).join("")}
          </select>
        </label>
        <button onclick="resolveEvent(${eventIndex})">Uzavřít událost</button>
      </div>`;
    } else if (event.resolved) {
      content += `<p style="color: green;">Událost uzavřena. Vítěz: ${event.options[event.winnerIndex]}</p>`;
    }

    content += `<canvas id="chart-${event.id}" height="200"></canvas>`;
    div.innerHTML = content;
    eventList.appendChild(div);

    setTimeout(() => drawChart(event, `chart-${event.id}`), 0);
  });
}

function placeBet(eventIndex, optionIndex) {
  const user = getCurrentUser();
  if (!user) return;

  const input = prompt("Kolik bodů chceš vsadit?");
  const amount = parseInt(input);

  if (!isNaN(amount) && amount > 0) {
    if (user.points < amount) {
      alert("Nemáš dostatek bodů.");
      return;
    }

    const event = events[eventIndex];
    event.bets[optionIndex] += amount;
    if (!event.userBets[user.username]) {
      event.userBets[user.username] = {};
    }
    if (!event.userBets[user.username][optionIndex]) {
      event.userBets[user.username][optionIndex] = 0;
    }
    event.userBets[user.username][optionIndex] += amount;

    // aktualizace historie pro graf
    const now = Date.now();
    const percentages = calculatePercentages(event.bets);
    event.history.push({ time: now, percentages });

    const newPoints = user.points - amount;
    updateCurrentUserPoints(newPoints);
    document.getElementById("user-points").textContent = newPoints;
    renderEvents();
    renderLeaderboard();
  } else {
    alert("Neplatná sázka.");
  }
}

function drawChart(event, canvasId) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const labels = event.history.map(h => new Date(h.time).toLocaleTimeString());

  const datasets = event.options.map((opt, i) => ({
    label: opt,
    data: event.history.map(h => h.percentages[i]),
    borderColor: `hsl(${(i * 100) % 360}, 80%, 50%)`,
    fill: false,
    tension: 0.2
  }));

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          title: {
            display: true,
            text: "Pravděpodobnost (%)"
          }
        }
      }
    }
  });
}

function sellBet(eventIndex, optionIndex) {
  const user = getCurrentUser();
  const event = events[eventIndex];
  const amount = event.userBets[user.username][optionIndex];
  const percentages = calculatePercentages(event.bets);
  const refund = Math.round(amount * (percentages[optionIndex] / 100));

  event.bets[optionIndex] -= amount;
  delete event.userBets[user.username][optionIndex];
  if (Object.keys(event.userBets[user.username]).length === 0) {
    delete event.userBets[user.username];
  }

  const newPoints = user.points + refund;
  updateCurrentUserPoints(newPoints);
  document.getElementById("user-points").textContent = newPoints;
  alert(`Sázka prodána za ${refund} bodů.`);
  renderEvents();
  renderLeaderboard();
}

function resolveEvent(eventIndex) {
  const event = events[eventIndex];
  const winner = parseInt(document.getElementById(`resolve-${eventIndex}`).value);
  const totalBank = event.bets.reduce((a, b) => a + b, 0);
  const totalOnWinner = event.bets[winner];

  for (const username in event.userBets) {
    const bets = event.userBets[username];
    const amount = bets[winner] || 0;
    if (amount > 0 && totalOnWinner > 0) {
      const payout = (amount / totalOnWinner) * totalBank;
      const users = getUsers();
      users[username].points += Math.round(payout);
      saveUsers(users);
    }
  }

  event.resolved = true;
  event.winnerIndex = winner;
  renderEvents();
  renderLeaderboard();
  document.getElementById("user-points").textContent = getCurrentUser().points;
}

function addOptionField() {
  const container = document.getElementById("option-fields");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "option-input";
  input.placeholder = `Možnost ${container.children.length + 1}`;
  container.appendChild(input);
}

function createCustomEvent() {
  const streamer = document.getElementById("new-streamer").value.trim();
  const description = document.getElementById("new-description").value.trim();
  const optionInputs = document.querySelectorAll(".option-input");
  const options = Array.from(optionInputs).map(i => i.value.trim()).filter(v => v);

  if (!streamer || !description || options.length < 2) {
    alert("Vyplň všechny informace a minimálně 2 možnosti.");
    return;
  }

  const now = Date.now();
  const emptyBets = Array(options.length).fill(0);
  const percentages = emptyBets.map(() => 0);

  events.push({
    id: events.length + 1,
    streamer,
    description,
    options,
    bets: emptyBets,
    userBets: {},
    resolved: false,
    winnerIndex: null,
    history: [{ time: now, percentages }]
  });

  renderEvents();
  document.getElementById("new-streamer").value = "";
  document.getElementById("new-description").value = "";
  document.getElementById("option-fields").innerHTML = '<input type="text" class="option-input" placeholder="Možnost 1" />';
}

async function handleRegister() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  if (await register(username, password)) showGame();
}

async function handleLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  if (await login(username, password)) showGame();
}

function showGame() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById("auth-section").style.display = "none";
  document.getElementById("game-section").style.display = "block";
  document.getElementById("current-user").textContent = user.username;
  document.getElementById("user-points").textContent = user.points;
  if (user.isAdmin) {
    document.getElementById("create-event").style.display = "block";
  }
  renderEvents();
  renderLeaderboard();
}

window.onload = () => {
  if (getCurrentUser()) showGame();
};