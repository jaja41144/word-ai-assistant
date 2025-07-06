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

    const data = await response.json();
    replaceLastLog("AI", data.answer || "No answer returned.");
  });
}

function appendToLog(role, message) {
  const log = document.getElementById("responseLog");

  const entry = document.createElement("div");
  entry.style.marginBottom = "12px";
  entry.className = "log-entry";

  entry.innerHTML = `
    <div><strong>${role}:</strong></div>
    <div>${escapeHtml(message)}</div>
  `;

  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function replaceLastLog(role, message) {
  const log = document.getElementById("responseLog");
  const lastEntry = log.querySelector(".log-entry:last-child");
  if (lastEntry) {
    lastEntry.innerHTML = `
      <div><strong>${role}:</strong></div>
      <div>${escapeHtml(message)}</div>
    `;
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
