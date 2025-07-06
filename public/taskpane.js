async function sendPrompt() {
  const prompt = document.getElementById("prompt").value.trim();
  if (!prompt) return alert("Please enter a question.");

  appendToLog("You", prompt);
  appendToLog("AI", "Thinking...");

  const response = await fetch("https://word-rag-backend.onrender.com/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: prompt })
  });

  document.getElementById("prompt").value = "";

  const data = await response.json();
  replaceLastLog("AI", data.answer || "No answer returned.");
}

async function sendPromptWithSelection() {
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();

    const selectedText = selection.text.trim();
    const prompt = document.getElementById("prompt").value.trim();

    if (!selectedText) return alert("Please select some text.");
    if (!prompt) return alert("Please enter a question.");

    appendToLog("You", `${prompt}\n\n(Selected Text: ${selectedText})`);
    appendToLog("AI", "Thinking...");

    const response = await fetch("https://word-rag-backend.onrender.com/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: `${prompt}\n\nSelected Text:\n${selectedText}` })
    });

    document.getElementById("prompt").value = "";

    const data = await response.json();
    replaceLastLog("AI", data.answer || "No answer returned.");
  });
}

function appendToLog(role, message) {
  const log = document.getElementById("responseLog");
  const cssRole = role === "You" ? "user" : "ai";
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const entry = document.createElement("div");
  entry.className = "message-entry";

entry.innerHTML = `
  <div class="message-meta">
    <b>${role}</b> <span class="timestamp">${timestamp}</span>
  </div>
  <div class="message ${cssRole}">
    ${escapeHtml(message)}
  </div>
`;

  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function replaceLastLog(role, message) {
  const log = document.getElementById("responseLog");
  const cssRole = role === "You" ? "user" : "ai";
  const bubbles = log.getElementsByClassName(`message ${cssRole}`);
  const lastBubble = bubbles[bubbles.length - 1];

  if (lastBubble) {
    lastBubble.textContent = message;
  }
}

function clearLog() {
  document.getElementById("responseLog").innerHTML = "";
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (match) => {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return escapeMap[match];
  });
}

document.getElementById("prompt").addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // Prevent newline
    sendPrompt(); // Trigger your send function
    document.getElementById("prompt").value = "";
  }
});
