import { DIMENSION, knowledgeChunks, loadIndex } from '../server/rag.ts';

const url = (process.env.QDRANT_URL ?? '').replace(/\/$/, '');
const key = process.env.QDRANT_API_KEY ?? '';
const collection = process.env.QDRANT_COLLECTION ?? 'nasa_knowledge';
if (!url) throw new Error('QDRANT_URL is missing');
if (!key && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) {
  throw new Error('QDRANT_API_KEY is missing');
}

const headers = { 'Content-Type': 'application/json', ...(key ? { 'api-key': key } : {}) };
const endpoint = (path) => `${url}${path}`;
const request = (path, init = {}) => fetch(endpoint(path), {
  ...init,
  headers: { ...headers, ...init.headers },
  signal: AbortSignal.timeout(60000),
});

const encoded = encodeURIComponent(collection);
let response = await request(`/collections/${encoded}`);
if (response.status === 404) {
  response = await request(`/collections/${encoded}`, {
    method: 'PUT',
    body: JSON.stringify({ vectors: { size: DIMENSION, distance: 'Cosine' } }),
  });
  if (!response.ok) throw new Error(`Could not create Qdrant collection (${response.status}): ${await response.text()}`);
  console.log(`Created collection ${collection} (${DIMENSION} dimensions, Cosine)`);
} else {
  if (!response.ok) throw new Error(`Could not inspect Qdrant collection (${response.status}): ${await response.text()}`);
  const details = await response.json();
  const vectors = details?.result?.config?.params?.vectors;
  if (!vectors || vectors.size !== DIMENSION || vectors.distance !== 'Cosine') {
    throw new Error(`Collection ${collection} exists but is not ${DIMENSION}-dimensional Cosine. Use a different collection name.`);
  }
}

const index = await loadIndex();
const batchSize = 100;
for (let offset = 0; offset < knowledgeChunks.length; offset += batchSize) {
  const points = knowledgeChunks.slice(offset, offset + batchSize).map((chunk, localIndex) => {
    const pointIndex = offset + localIndex;
    return {
      id: pointIndex,
      vector: index.vectors[pointIndex],
      payload: {
        chunk_index: pointIndex,
        chunk_id: chunk.chunkId,
        document_id: chunk.id,
        title: chunk.title,
        aliases: chunk.aliases,
        text: chunk.text,
        sources: chunk.sources,
      },
    };
  });
  const upsert = await request(`/collections/${encoded}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({ points }),
  });
  if (!upsert.ok) throw new Error(`Qdrant upload failed at ${offset} (${upsert.status}): ${await upsert.text()}`);
  console.log(`Uploaded ${Math.min(offset + batchSize, knowledgeChunks.length)}/${knowledgeChunks.length}`);
}
console.log(`Qdrant collection ${collection} is ready.`);
