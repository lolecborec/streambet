async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getUsers() {
  return JSON.parse(localStorage.getItem("users") || "{}");
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

async function register(username, password) {
  const users = getUsers();
  if (users[username]) {
    alert("Uživatelské jméno již existuje.");
    return false;
  }

  if (username === "admin" && password !== "tajneAdminHeslo123") {
    alert("Neplatné heslo pro admina.");
    return false;
  }

  const passwordHash = await hashPassword(password);
  users[username] = { password: passwordHash, points: 100 };
  saveUsers(users);
  localStorage.setItem("currentUser", username);
  return true;
}

async function login(username, password) {
  const users = getUsers();
  if (!users[username]) {
    alert("Uživatel neexistuje.");
    return false;
  }

  const passwordHash = await hashPassword(password);
  if (users[username].password !== passwordHash) {
    alert("Nesprávné heslo.");
    return false;
  }

  localStorage.setItem("currentUser", username);
  return true;
}

function logout() {
  localStorage.removeItem("currentUser");
  location.reload();
}

function getCurrentUser() {
  const username = localStorage.getItem("currentUser");
  const users = getUsers();
  if (username && users[username]) {
    const isAdmin = username === "admin";
    return { username, isAdmin, ...users[username] };
  }
  return null;
}

function updateCurrentUserPoints(newPoints) {
  const username = localStorage.getItem("currentUser");
  const users = getUsers();
  if (username && users[username]) {
    users[username].points = newPoints;
    saveUsers(users);
  }
}