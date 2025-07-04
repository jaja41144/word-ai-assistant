Office.onReady(info => {
  if (info.host === Office.HostType.Word) {
    console.log("Word Add-in ready.");
  }
});

// 🔍 Submit the question from textarea
async function sendPrompt() {
  const prompt = document.getElementById("prompt").value;
  if (!prompt.trim()) return;

  updateResponse("⏳ Thinking...");

  try {
    const res = await fetch("https://word-rag-backend.onrender.com/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: prompt })
    });

    const data = await res.json();
    updateResponse(data.answer);
  } catch (error) {
    console.error(error);
    updateResponse("❌ Error: Could not reach server.");
  }
}

// 📄 Ask about the selected text in Word
async function sendPromptWithSelection() {
  await Word.run(async context => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();

    const question = document.getElementById("prompt").value;
    const combined = `${question}\n\nBased on this selected text:\n"${selection.text}"`;

    updateResponse("⏳ Thinking...");

    try {
      const res = await fetch("https://word-rag-backend.onrender.com/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: combined })
      });

      const data = await res.json();
      updateResponse(data.answer);
    } catch (error) {
      console.error(error);
      updateResponse("❌ Error: Could not reach server.");
    }
  });
}

// 🪄 Update the response box
function updateResponse(message) {
  document.getElementById("response").innerText = message;
}

