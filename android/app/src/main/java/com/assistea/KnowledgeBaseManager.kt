package com.assistea

import android.content.Context
import com.google.gson.Gson
import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.reflect.TypeToken
import java.io.InputStream
import java.lang.reflect.Type

data class KnowledgeEntry(
    val question: String,
    val answer: String,
    val keywords: List<String>,
    val embedding: FloatArray? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as KnowledgeEntry

        if (question != other.question) return false
        if (answer != other.answer) return false
        if (keywords != other.keywords) return false
        if (embedding != null) {
            if (other.embedding == null) return false
            if (!embedding.contentEquals(other.embedding)) return false
        } else if (other.embedding != null) return false

        return true
    }

    override fun hashCode(): Int {
        var result = question.hashCode()
        result = 31 * result + answer.hashCode()
        result = 31 * result + keywords.hashCode()
        result = 31 * result + (embedding?.contentHashCode() ?: 0)
        return result
    }
}

class KnowledgeEntryDeserializer : JsonDeserializer<KnowledgeEntry> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): KnowledgeEntry {
        val jsonObject = json?.asJsonObject ?: throw IllegalArgumentException("Invalid JSON")
        
        val question = jsonObject.get("question")?.asString ?: ""
        val answer = jsonObject.get("answer")?.asString ?: ""
        val keywordsArray = jsonObject.get("keywords")?.asJsonArray
        val keywords = keywordsArray?.map { it.asString } ?: emptyList()
        
        // Embedding is optional and will be generated if not present
        val embeddingArray = jsonObject.get("embedding")?.asJsonArray
        val embedding = embeddingArray?.let { array ->
            FloatArray(array.size()) { i -> array[i].asFloat }
        }
        
        return KnowledgeEntry(question, answer, keywords, embedding)
    }
}

data class MatchResult(
    val question: String,
    val answer: String,
    val similarity: Double
)

class KnowledgeBaseManager(private val context: Context) {
    
    private val gson = Gson()
        .newBuilder()
        .registerTypeAdapter(KnowledgeEntry::class.java, KnowledgeEntryDeserializer())
        .create()
    private var knowledgeBase: List<KnowledgeEntry> = emptyList()
    private val offlineNLPEngine: OfflineNLPEngine by lazy { OfflineNLPEngine(context) }
    
    companion object {
        private const val KNOWLEDGE_BASE_FILE = "agronomist_knowledge.json"
        private const val MIN_SIMILARITY_THRESHOLD = 0.3
    }
    
    /**
     * Load knowledge base from assets
     */
    fun loadKnowledgeBase(): List<KnowledgeEntry> {
        if (knowledgeBase.isNotEmpty()) {
            return knowledgeBase
        }
        
        try {
            val inputStream: InputStream = context.assets.open(KNOWLEDGE_BASE_FILE)
            val json = inputStream.bufferedReader().use { it.readText() }
            inputStream.close()
            
            val listType = object : TypeToken<List<KnowledgeEntry>>() {}.type
            knowledgeBase = gson.fromJson(json, listType)
            
            // Generate embeddings for entries that don't have them
            knowledgeBase = knowledgeBase.map { entry ->
                if (entry.embedding == null) {
                    val embedding = offlineNLPEngine.generateEmbedding(entry.question)
                    entry.copy(embedding = embedding)
                } else {
                    entry
                }
            }
            
            return knowledgeBase
        } catch (e: Exception) {
            e.printStackTrace()
            return emptyList()
        }
    }
    
    /**
     * Find the best matching answer for a query embedding
     */
    fun findBestMatch(queryEmbedding: FloatArray, knowledgeBase: List<KnowledgeEntry>): MatchResult? {
        if (knowledgeBase.isEmpty() || queryEmbedding.isEmpty()) {
            return null
        }
        
        var bestMatch: MatchResult? = null
        var bestSimilarity = MIN_SIMILARITY_THRESHOLD
        
        for (entry in knowledgeBase) {
            val entryEmbedding = entry.embedding
            if (entryEmbedding == null) {
                // Generate embedding on the fly if missing
                val generatedEmbedding = offlineNLPEngine.generateEmbedding(entry.question)
                if (generatedEmbedding != null) {
                    val similarity = offlineNLPEngine.cosineSimilarity(queryEmbedding, generatedEmbedding)
                    if (similarity > bestSimilarity) {
                        bestSimilarity = similarity
                        bestMatch = MatchResult(
                            question = entry.question,
                            answer = entry.answer,
                            similarity = similarity.toDouble()
                        )
                    }
                }
            } else {
                val similarity = offlineNLPEngine.cosineSimilarity(queryEmbedding, entryEmbedding)
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity
                    bestMatch = MatchResult(
                        question = entry.question,
                        answer = entry.answer,
                        similarity = similarity.toDouble()
                    )
                }
            }
        }
        
        return bestMatch
    }
    
    /**
     * Search by keywords (fallback method)
     */
    fun searchByKeywords(query: String): List<KnowledgeEntry> {
        val queryLower = query.lowercase()
        val queryWords = queryLower.split(Regex("\\s+"))
        
        return knowledgeBase.filter { entry ->
            val entryText = "${entry.question} ${entry.answer}".lowercase()
            val keywordMatches = entry.keywords.any { keyword ->
                queryWords.any { word -> keyword.lowercase().contains(word) || word.contains(keyword.lowercase()) }
            }
            val textMatches = queryWords.any { word -> entryText.contains(word) }
            keywordMatches || textMatches
        }
    }
}

