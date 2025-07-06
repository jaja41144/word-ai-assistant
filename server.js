require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { https } = require("follow-redirects");
const { OpenAI } = require("openai");
const { Pinecone } = require("@pinecone-database/pinecone");

const app = express();
app.use(express.json());

// Serve static frontend files (Word Add-in UI)
app.use(express.static(path.join(__dirname, "public"))); // public/taskpane.html, taskpane.js, etc.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

// === Utility functions ===

function downloadTextFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`Failed to download: ${res.statusCode}`));
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}

function chunkText(text, maxWords = 150) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

// === RAG Endpoint ===

app.post("/ask", async (req, res) => {
  const { query } = req.body;

  const fileId = "1gVSijN61kcX3JJwnQewKZljrZuweN71Y"; // your Google Doc file ID
  const url = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
  const tempPath = path.join(__dirname, "temp.txt");

  try {
    // Step 1: Download and chunk
    await downloadTextFile(url, tempPath);
    const text = fs.readFileSync(tempPath, "utf-8");
    const chunks = chunkText(text);
    console.log("Using OpenAI key starting with:", process.env.OPENAI_API_KEY.slice(0, 10));


    // Step 2: Embed and upsert to Pinecone
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunks[i],
      });

      await index.upsert([
        {
          id: String(i + 1),
          values: embedding.data[0].embedding,
          metadata: { text: chunks[i] },
        },
      ]);
    }

    // Step 3: Embed query and retrieve context
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    const results = await index.query({
      topK: 5,
      vector: queryEmbedding.data[0].embedding,
      includeMetadata: true,
    });

    const context = results.matches.map(m => m.metadata.text).join("\n");

    // Step 4: Get answer from GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful academic assistant. Format all responses in valid Markdown (e.g., use headings, lists, bold, etc.). Only use the provided context." },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${query}` },
      ],
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// === Start Server ===

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
