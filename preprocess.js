require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { https } = require("follow-redirects");
const { OpenAI } = require("openai");
const { Pinecone } = require("@pinecone-database/pinecone");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

const fileIds = [
  "1gVSijN61kcX3JJwnQewKZljrZuweN71Y",
  "1T9VogNrgRws9S5G-otX0x8NvLnUVJhlV", // Add more as needed
];

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

(async () => {
  try {
    for (const fileId of fileIds) {
      const url = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
      const tempPath = path.join(__dirname, `temp_${fileId}.txt`);

      await downloadTextFile(url, tempPath);
      const text = fs.readFileSync(tempPath, "utf-8");
      const chunks = chunkText(text);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunk,
        });

        const vectorId = `${fileId}_chunk_${i}`;

        await index.upsert([
          {
            id: vectorId,
            values: embedding.data[0].embedding,
            metadata: { text: chunk },
          },
        ]);
      }

      console.log(`✅ Processed file: ${fileId}`);
    }

    console.log("✅ Preprocessing complete.");
  } catch (err) {
    console.error("❌ Error during preprocessing:", err);
  }
})();
