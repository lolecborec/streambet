let events = [];

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

  events.forEach((event) => {
    const div = document.createElement("div");
    div.className = "event";
    const percentages = calculatePercentages(event.bets);

    let content = `<h2>${event.streamer}</h2><p>${event.description}</p>`;

    event.options.forEach((option, i) => {
      content += `<div class="option-row">
        <button onclick="placeBet('${event.id}', ${i})" ${event.resolved ? "disabled" : ""}>${option}</button>
        <span>${percentages[i].toFixed(1)} %</span>
        <span style="color: gray;">(vsazeno: ${event.bets[i]} bodů)</span>
      </div>`;
    });

    const user = getCurrentUser();
    if (user && event.userBets && event.userBets[user.username] && !event.resolved) {
      Object.entries(event.userBets[user.username]).forEach(([optIdx, amount]) => {
        const resale = Math.round(amount * (percentages[optIdx] / 100));
        content += `<button onclick="sellBet('${event.id}', ${optIdx})">Prodat sázku ${event.options[optIdx]} za ${resale} bodů</button>`;
      });
    }

    if (user?.isAdmin && !event.resolved) {
      content += `<div style="margin-top:10px;">
        <label>Vyber vítěznou možnost:
          <select id="resolve-${event.id}">
            ${event.options.map((o, i) => `<option value="${i}">${o}</option>`).join("")}
          </select>
        </label>
        <button onclick="resolveEvent('${event.id}')">Uzavřít událost</button>
      </div>`;
    } else if (event.resolved) {
      content += `<p style="color: green;">Uzavřeno: ${event.options[event.winnerIndex]}</p>`;
    }

    content += `<canvas id="chart-${event.id}" height="200"></canvas>`;
    div.innerHTML = content;
    eventList.appendChild(div);

    setTimeout(() => drawChart(event, `chart-${event.id}`), 0);
  });
}

function placeBet(eventId, optionIndex) {
  const user = getCurrentUser();
  if (!user) return;

  const amount = parseInt(prompt("Kolik bodů chceš vsadit?"));
  if (isNaN(amount) || amount <= 0) return alert("Neplatná částka.");
  if (user.points < amount) return alert("Nemáš dostatek bodů.");

  const eventRef = firebase.database().ref(`events/${eventId}`);
  eventRef.once("value").then(snapshot => {
    const event = snapshot.val();
    if (!event) return;

    event.bets[optionIndex] += amount;
    if (!event.userBets) event.userBets = {};
    if (!event.userBets[user.username]) event.userBets[user.username] = {};
    if (!event.userBets[user.username][optionIndex]) event.userBets[user.username][optionIndex] = 0;
    event.userBets[user.username][optionIndex] += amount;

    const now = Date.now();
    const percentages = calculatePercentages(event.bets);
    if (!event.history) event.history = [];
    event.history.push({ time: now, percentages });

    updateCurrentUserPoints(user.points - amount);
    firebase.database().ref(`events/${eventId}`).set(event);
    document.getElementById("user-points").textContent = getCurrentUser().points;
  });
}

function sellBet(eventId, optionIndex) {
  const user = getCurrentUser();
  const eventRef = firebase.database().ref(`events/${eventId}`);
  eventRef.once("value").then(snapshot => {
    const event = snapshot.val();
    if (!event || !event.userBets[user.username]) return;

    const amount = event.userBets[user.username][optionIndex];
    const percentages = calculatePercentages(event.bets);
    const refund = Math.round(amount * (percentages[optionIndex] / 100));

    event.bets[optionIndex] -= amount;
    delete event.userBets[user.username][optionIndex];
    if (Object.keys(event.userBets[user.username]).length === 0) {
      delete event.userBets[user.username];
    }

    updateCurrentUserPoints(user.points + refund);
    firebase.database().ref(`events/${eventId}`).set(event);
    document.getElementById("user-points").textContent = getCurrentUser().points;
    alert(`Sázka prodána za ${refund} bodů.`);
  });
}

function resolveEvent(eventId) {
  const winner = parseInt(document.getElementById(`resolve-${eventId}`).value);
  const eventRef = firebase.database().ref(`events/${eventId}`);
  eventRef.once("value").then(snapshot => {
    const event = snapshot.val();
    if (!event) return;

    const totalBank = event.bets.reduce((a, b) => a + b, 0);
    const totalOnWinner = event.bets[winner];

    for (const username in event.userBets) {
      const amount = event.userBets[username][winner] || 0;
      if (amount > 0 && totalOnWinner > 0) {
        const payout = (amount / totalOnWinner) * totalBank;
        const users = getUsers();
        users[username].points += Math.round(payout);
        saveUsers(users);
      }
    }

    event.resolved = true;
    event.winnerIndex = winner;
    firebase.database().ref(`events/${eventId}`).set(event);
    document.getElementById("user-points").textContent = getCurrentUser().points;
  });
}

function createCustomEvent() {
  const streamer = document.getElementById("new-streamer").value.trim();
  const description = document.getElementById("new-description").value.trim();
  const optionInputs = document.querySelectorAll(".option-input");
  const options = Array.from(optionInputs).map(i => i.value.trim()).filter(Boolean);

  if (!streamer || !description || options.length < 2) {
    alert("Vyplň všechny informace a minimálně 2 možnosti.");
    return;
  }

  const id = firebase.database().ref("events").push().key;
  const now = Date.now();
  const bets = Array(options.length).fill(0);
  const percentages = bets.map(() => 0);

  const newEvent = {
    id,
    streamer,
    description,
    options,
    bets,
    userBets: {},
    resolved: false,
    winnerIndex: null,
    history: [{ time: now, percentages }]
  };

  firebase.database().ref(`events/${id}`).set(newEvent);
  document.getElementById("new-streamer").value = "";
  document.getElementById("new-description").value = "";
  document.getElementById("option-fields").innerHTML = '<input type="text" class="option-input" placeholder="Možnost 1" />';
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
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { min: 0, max: 100, title: { display: true, text: "%" } }
      }
    }
  });
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
  const user = getCurrentUser();
  if (user) showGame();

  firebase.database().ref("events").on("value", snapshot => {
    const data = snapshot.val();
    events = data ? Object.values(data) : [];
    renderEvents();
  });
};
