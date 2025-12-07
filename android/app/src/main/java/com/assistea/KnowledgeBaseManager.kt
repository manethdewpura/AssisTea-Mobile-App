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
        private const val MIN_SIMILARITY_THRESHOLD = 0.15  // Lowered threshold for better matching
        private const val KEYWORD_MATCH_THRESHOLD = 0.2  // Use keyword matching if similarity is low
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
     * Uses semantic similarity first, then falls back to keyword matching
     */
    fun findBestMatch(queryEmbedding: FloatArray, knowledgeBase: List<KnowledgeEntry>, queryText: String? = null): MatchResult? {
        if (knowledgeBase.isEmpty() || queryEmbedding.isEmpty()) {
            // Fallback to keyword search if embeddings are not available
            if (queryText != null) {
                return findBestMatchByKeywords(queryText, knowledgeBase)
            }
            return null
        }
        
        var bestMatch: MatchResult? = null
        var bestSimilarity = MIN_SIMILARITY_THRESHOLD
        
        // First, try semantic similarity matching
        for (entry in knowledgeBase) {
            val entryEmbedding = entry.embedding
            if (entryEmbedding == null) {
                // Generate embedding on the fly if missing
                val generatedEmbedding = offlineNLPEngine.generateEmbedding(entry.question)
                if (generatedEmbedding != null) {
                    val similarity = offlineNLPEngine.cosineSimilarity(queryEmbedding, generatedEmbedding)
                    if (similarity > bestSimilarity) {
                        bestSimilarity = similarity.toDouble()
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
                    bestSimilarity = similarity.toDouble()
                    bestMatch = MatchResult(
                        question = entry.question,
                        answer = entry.answer,
                        similarity = similarity.toDouble()
                    )
                }
            }
        }
        
        // If semantic similarity didn't find a good match, try keyword matching
        if (queryText != null) {
            val keywordMatch = findBestMatchByKeywords(queryText, knowledgeBase)
            if (keywordMatch != null) {
                // Use keyword match if:
                // 1. No semantic match was found, OR
                // 2. Keyword match is significantly better (0.1 difference), OR
                // 3. Semantic match is below threshold
                if (bestMatch == null) {
                    return keywordMatch
                } else if (keywordMatch.similarity > bestSimilarity + 0.1) {
                    return keywordMatch
                } else if (bestSimilarity < KEYWORD_MATCH_THRESHOLD && keywordMatch.similarity > 0.2) {
                    return keywordMatch
                }
            }
        }
        
        return bestMatch
    }
    
    /**
     * Find best match using keyword matching (fallback method)
     */
    private fun findBestMatchByKeywords(query: String, knowledgeBase: List<KnowledgeEntry>): MatchResult? {
        val queryLower = query.lowercase().trim()
        // Extract meaningful words (length > 2, filter common stop words)
        val stopWords = setOf("the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "how", "what", "when", "where", "why", "do", "does", "is", "are", "was", "were")
        val queryWords = queryLower.split(Regex("\\s+"))
            .filter { it.length > 2 && it !in stopWords }
            .map { it.trim().removeSuffix("s").removeSuffix("ing").removeSuffix("ed") }  // Basic stemming
        
        if (queryWords.isEmpty()) {
            return null
        }
        
        var bestMatch: MatchResult? = null
        var bestScore = 0.0
        
        for (entry in knowledgeBase) {
            var score = 0.0
            
            // Normalize entry keywords and question
            val entryKeywordsLower = entry.keywords.map { it.lowercase().trim() }
            val questionLower = entry.question.lowercase()
            val questionWords = questionLower.split(Regex("\\s+"))
                .filter { it.length > 2 && it !in stopWords }
                .map { it.trim().removeSuffix("s").removeSuffix("ing").removeSuffix("ed") }
            
            // Check keyword matches (weighted higher)
            val keywordMatches = entryKeywordsLower.count { keyword ->
                val keywordStemmed = keyword.removeSuffix("s").removeSuffix("ing").removeSuffix("ed")
                queryWords.any { word -> 
                    // Direct match
                    keywordStemmed == word || word == keywordStemmed ||
                    // Contains match
                    keywordStemmed.contains(word) || word.contains(keywordStemmed) ||
                    // Multi-word keyword match
                    keywordStemmed.split(Regex("\\s+")).any { kw -> 
                        kw == word || word == kw || kw.contains(word) || word.contains(kw)
                    }
                }
            }
            
            // Check question text matches
            val questionWordMatches = queryWords.count { word ->
                questionWords.any { qw -> 
                    qw == word || qw.contains(word) || word.contains(qw) || 
                    qw.startsWith(word) || word.startsWith(qw)
                }
            }
            
            // Calculate score: keywords are weighted much higher
            score = (keywordMatches * 3.0) + questionWordMatches
            
            // Bonus for exact phrase matches or high word overlap
            val wordOverlapRatio = questionWordMatches.toDouble() / queryWords.size
            if (wordOverlapRatio > 0.5) {
                score += 3.0 * wordOverlapRatio
            }
            
            // Bonus if query contains key phrases from question
            val keyPhrases = listOf("pest", "control", "disease", "fertilizer", "harvest", "pruning", "soil", "water", "tea")
            val phraseMatches = keyPhrases.count { phrase ->
                queryLower.contains(phrase) && (questionLower.contains(phrase) || entryKeywordsLower.any { it.contains(phrase) })
            }
            score += phraseMatches * 2.0
            
            // Normalize score to 0-1 range
            val maxPossibleScore = (entry.keywords.size * 3.0) + questionWords.size + 5.0
            val normalizedScore = (score / maxPossibleScore).coerceIn(0.0, 1.0)
            
            if (normalizedScore > bestScore && normalizedScore > 0.15) {  // Minimum threshold
                bestScore = normalizedScore
                bestMatch = MatchResult(
                    question = entry.question,
                    answer = entry.answer,
                    similarity = normalizedScore
                )
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

