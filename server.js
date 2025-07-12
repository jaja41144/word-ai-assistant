require("dotenv").config();
const express = require("express");
const path = require("path");
const { OpenAI } = require("openai");
const { Pinecone } = require("@pinecone-database/pinecone");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

app.post("/ask", async (req, res) => {
  const { query } = req.body;

  try {
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    const results = await index.query({
      topK: 5,
      vector: queryEmbedding.data[0].embedding,
      includeMetadata: true,
    });

    const context = results.matches.map((m) => m.metadata.text).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an academic study supervisor. Use the provided context to help postgraduate students develop their research work. Respond with academic clarity, referencing the relevant material where applicable. Adapt your feedback to the question asked, offering explanations, guidance, or suggestions as appropriate. Maintain a neutral and professional tone. Avoid personal language and do not rewrite the student's work or write work for them. If you want to explain structure then you may use an example but instead of an exact example, try and guide the student by using guided questions and so forth. Do not speculate beyond the context provided. Format all responses that require headings, lists, bold, etc. in valid Markdown. Only use the provided context.",
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${query}`,
        },
      ],
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});