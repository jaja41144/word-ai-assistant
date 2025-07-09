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

  // 🔐 Hardcoded list of Google Doc file IDs
  const fileIds = [
    "1gVSijN61kcX3JJwnQewKZljrZuweN71Y", // Doc 1
    "1T9VogNrgRws9S5G-otX0x8NvLnUVJhlV"        // Doc 2 (replace with actual ID)
  ];

  try {
    let allChunks = [];

    // Step 1: Download, chunk, embed, and upsert each document
    for (const fileId of fileIds) {
      const url = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
      const tempPath = path.join(__dirname, `${fileId}.txt`);

      await downloadTextFile(url, tempPath);
      const text = fs.readFileSync(tempPath, "utf-8");
      const chunks = chunkText(text);

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunks[i],
        });

        await index.upsert([
          {
            id: `${fileId}-${i + 1}`,
            values: embedding.data[0].embedding,
            metadata: {
              text: chunks[i],
              docId: fileId
            },
          },
        ]);
      }

      // Store chunks for later context use
      allChunks.push(...chunks);
    }

    // Step 2: Embed query and search across all documents
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    const results = await index.query({
      topK: 5,
      vector: queryEmbedding.data[0].embedding,
      includeMetadata: true,
      filter: {
        docId: { "$in": fileIds } // restrict search to your hardcoded docs
      }
    });

    const context = results.matches.map(m => m.metadata.text).join("\n");

    // Step 3: Generate GPT-4 answer
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an academic study supervisor. Use the provided context to help postgraduate students develop their research work. Respond with academic clarity, referencing the relevant material where applicable. Adapt your feedback to the question asked — offering explanations, guidance, or suggestions as appropriate. Maintain a neutral and professional tone. Avoid personal language and do not rewrite the student's work. Do not speculate beyond the context provided. Format all responses that require headings, lists, bold, etc. in valid Markdown. Only use the provided context."
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${query}`
        },
      ],
    });

    res.json({ answer: completion.choices[0].message.content });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

