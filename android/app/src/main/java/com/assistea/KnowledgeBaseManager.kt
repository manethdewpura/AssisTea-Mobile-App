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
        private const val KNOWLEDGE_BASE_FILE_PREFIX = "agronomist_knowledge_"
        private const val KNOWLEDGE_BASE_FILE_SUFFIX = ".json"
        private const val MIN_SIMILARITY_THRESHOLD = 0.15
        private const val KEYWORD_MATCH_THRESHOLD = 0.2
        // Lower threshold for keyword fallback since it cannot handle synonyms like an embedding model.
        private const val KEYWORD_FALLBACK_THRESHOLD = 0.25

        /**
         * Domain-specific phrases that earn a bonus when present in both query and entry.
         * English terms work for EN queries; Si/Ta product codes (T65, T200…) are Latin
         * script and therefore also matched in Si/Ta queries.
         */
        private val KEY_PHRASES = listOf(
            // Core tea topics
            "tea", "bush", "plant", "nursery", "seedling", "cutting", "clone",
            // Agronomy operations
            "fertilizer", "fertilise", "fertilize", "pruning", "prune",
            "harvest", "pick", "pluck", "plucking",
            // Soil management
            "soil", "pH", "dolomite", "compost", "mulch", "organic",
            // Pest / disease
            "pest", "disease", "fungus", "nematode", "insect", "caterpillar", "blight",
            // Specific fertilizer codes (also appear in Si/Ta KBs as Latin text)
            "T65", "T200", "T750", "U330", "U625", "VP/LC",
            // Chemicals / operations
            "spray", "apply", "control", "water", "irrigate",
            "herbicide", "pesticide", "fungicide",
            // Measurements
            "kg", "kilogram", "gram", "dosage", "rate", "litre", "hectare", "ppm",
            // Regulatory
            "MRL", "PHI", "advisory"
        )

        /**
         * Synonym map for tea agronomy terms.  Expands user query words so that
         * "pluck" can match a KB entry about "harvesting", etc.  Keys and values
         * use the same simple stemmed form produced by removeSuffix("s"/"ing"/"ed").
         */
        private val SYNONYMS: Map<String, Set<String>> = mapOf(
            "harvest" to setOf("pluck", "pick", "collect", "gather"),
            "pluck" to setOf("harvest", "pick", "collect"),
            "pick" to setOf("harvest", "pluck", "collect"),
            "prun" to setOf("cut", "trim", "skiff"),
            "cut" to setOf("prun", "trim"),
            "trim" to setOf("prun", "cut"),
            "disease" to setOf("blight", "rot", "rust", "infect", "fungal", "fungus", "pathogen"),
            "blight" to setOf("disease", "fungal", "fungus"),
            "rot" to setOf("disease", "decay"),
            "rust" to setOf("disease", "fungal"),
            "pest" to setOf("insect", "bug", "mite", "caterpillar", "thrip"),
            "insect" to setOf("pest", "bug"),
            "bug" to setOf("pest", "insect"),
            "water" to setOf("irrigat", "irrigate", "moisture", "rain"),
            "irrigat" to setOf("water", "sprinkler", "moisture"),
            "irrigate" to setOf("water", "sprinkler", "moisture"),
            "drought" to setOf("dry", "water", "moisture"),
            "weed" to setOf("herbicide"),
            "herbicid" to setOf("weed"),
            "yellow" to setOf("chlorosis", "discolor"),
            "clone" to setOf("cultivar", "variety"),
            "cultivar" to setOf("clone", "variety"),
            "variety" to setOf("clone", "cultivar"),
            "nursery" to setOf("seedling", "propagat"),
            "mulch" to setOf("compost", "organic"),
            "compost" to setOf("mulch", "organic"),
            "spray" to setOf("apply", "treatment"),
            "apply" to setOf("spray"),
            "soil" to setOf("earth", "ground"),
            "grow" to setOf("growth", "cultivat"),
            "growth" to setOf("grow", "cultivat"),
            "manure" to setOf("fertiliz", "compost", "organic"),
            "shade" to setOf("canopy"),
            "canopy" to setOf("shade"),
            "leaf" to setOf("leaves", "foliage"),
            "leaves" to setOf("leaf", "foliage"),
            "root" to setOf("roots"),
            "roots" to setOf("root"),
        )

        /**
         * Strip thousands-separator commas from numbers so that "10,000" and "10000"
         * compare equal during keyword matching.
         */
        fun normalizeForMatching(text: String): String =
            text.replace(Regex("(?<=\\d),(?=\\d{3}\\b)"), "")
    }
    
    private var currentLanguage: String = "en"
    private val knowledgeBaseCache = mutableMapOf<String, List<KnowledgeEntry>>()
    
    /**
     * Load knowledge base from assets based on language
     * @param language Language code (en, si, ta)
     */
    fun loadKnowledgeBase(language: String = "en"): List<KnowledgeEntry> {
        // Update current language
        currentLanguage = language
        
        // Return cached knowledge base if already loaded for this language
        if (knowledgeBaseCache.containsKey(language)) {
            knowledgeBase = knowledgeBaseCache[language] ?: emptyList()
            return knowledgeBase
        }
        
        try {
            val fileName = "$KNOWLEDGE_BASE_FILE_PREFIX$language$KNOWLEDGE_BASE_FILE_SUFFIX"
            val inputStream: InputStream = context.assets.open(fileName)
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
            
            // Cache the knowledge base for this language
            knowledgeBaseCache[language] = knowledgeBase
            
            return knowledgeBase
        } catch (e: Exception) {
            e.printStackTrace()
            // Fallback to English if the language-specific file is not found
            if (language != "en") {
                return loadKnowledgeBase("en")
            }
            return emptyList()
        }
    }
    
    /**
     * Find the best matching answer using a unified scoring approach.
     * Every entry is scored with both semantic similarity and keyword relevance;
     * the stronger signal wins, with a small bonus when both signals agree.
     */
    fun findBestMatch(queryEmbedding: FloatArray, knowledgeBase: List<KnowledgeEntry>, queryText: String? = null): MatchResult? {
        if (knowledgeBase.isEmpty()) return null
        if (queryEmbedding.isEmpty() && queryText.isNullOrBlank()) return null

        val queryLower = queryText?.let { normalizeForMatching(it.lowercase().trim()) } ?: ""
        val queryWords = if (!queryText.isNullOrBlank()) {
            queryLower.split(Regex("\\s+"))
                .filter { it.length > 2 && it !in STOP_WORDS }
                .map { it.trim().removeSuffix("s").removeSuffix("ing").removeSuffix("ed") }
        } else emptyList()

        val hasEmbedding = queryEmbedding.isNotEmpty()
        val hasKeywords = queryWords.isNotEmpty()

        var bestMatch: MatchResult? = null
        var bestScore = MIN_SIMILARITY_THRESHOLD

        for (entry in knowledgeBase) {
            val semanticScore = if (hasEmbedding) {
                val entryEmb = entry.embedding ?: offlineNLPEngine.generateEmbedding(entry.question)
                if (entryEmb != null) {
                    offlineNLPEngine.cosineSimilarity(queryEmbedding, entryEmb)
                        .toDouble().coerceAtLeast(0.0)
                } else 0.0
            } else 0.0

            val keywordScore = if (hasKeywords) {
                scoreEntry(queryWords, queryLower, entry)
            } else 0.0

            // Take the stronger signal; small bonus when both signals agree
            val combined = maxOf(semanticScore, keywordScore) +
                if (semanticScore > MIN_SIMILARITY_THRESHOLD && keywordScore > MIN_SIMILARITY_THRESHOLD)
                    minOf(semanticScore, keywordScore) * 0.1
                else 0.0

            if (combined > bestScore) {
                bestScore = combined
                bestMatch = MatchResult(
                    question = entry.question,
                    answer = entry.answer,
                    similarity = combined
                )
            }
        }

        return bestMatch
    }
    
    private val STOP_WORDS = setOf(
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "how", "what", "when", "where", "why", "do", "does",
        "is", "are", "was", "were", "can", "you", "tell", "me", "i", "my",
        "we", "our", "it", "its", "this", "that", "be", "by", "from", "as",
        "about", "should", "would", "could", "much", "many", "some", "any",
        "which", "there", "than", "not", "also", "been", "have", "has", "had",
        "will", "may", "might", "shall", "need", "get", "got", "let", "best",
        "good", "way", "most", "very", "just", "more", "all", "own", "them"
    )

    /**
     * Fuzzy word matcher: exact, substring (min 4 chars), or shared prefix of 5+ chars.
     * The min-4 rule prevents false positives like "rot" matching "control" or
     * "rosellinia".  Three-letter words only match by exact equality.
     */
    private fun wordsMatch(a: String, b: String): Boolean {
        if (a == b) return true
        if (a.length < 3 || b.length < 3) return a == b
        val shorter = minOf(a.length, b.length)
        if (shorter >= 4 && (a.contains(b) || b.contains(a))) return true
        if (a.length >= 5 && b.length >= 5) {
            val prefixLen = a.zip(b).takeWhile { (c1, c2) -> c1 == c2 }.size
            if (prefixLen >= 5) return true
        }
        return false
    }

    private fun expandWithSynonyms(words: List<String>): Set<String> {
        val expanded = words.toMutableSet()
        for (word in words) {
            SYNONYMS[word]?.let { expanded.addAll(it) }
        }
        return expanded
    }

    /**
     * Compute a normalised relevance score [0.0, 1.0] for [entry] using
     * ratio-based components so that generic entries with many loosely-matching
     * keywords cannot outscore a specific entry whose question is an exact match.
     *
     * Every component is already a [0,1] ratio, so no artificial denominator is
     * needed.  Weights are tuned so that question-text similarity dominates,
     * followed by how well the query's content words cover the entry's keywords
     * and vice-versa.
     */
    private fun scoreEntry(
        queryWords: List<String>,
        queryLower: String,
        entry: KnowledgeEntry
    ): Double {
        if (queryWords.isEmpty()) return 0.0

        val entryKeywordsLower = entry.keywords.map { normalizeForMatching(it.lowercase().trim()) }
        val questionLower = normalizeForMatching(entry.question.lowercase())
        val questionWords = questionLower.split(Regex("\\s+"))
            .filter { it.length > 2 && it !in STOP_WORDS }
            .map { it.trim().removeSuffix("s").removeSuffix("ing").removeSuffix("ed") }

        val answerLower = normalizeForMatching(entry.answer.lowercase())
        val answerWords = answerLower.split(Regex("\\s+"))
            .filter { it.length > 2 && it !in STOP_WORDS }
            .map { it.trim().removeSuffix("s").removeSuffix("ing").removeSuffix("ed") }

        val expandedQuery = expandWithSynonyms(queryWords)

        // --- Keyword entry coverage [0,1]: fraction of the entry's keywords matched ---
        // Prevents generic entries with many broad keywords from dominating.
        val keywordMatchCount = entryKeywordsLower.count { keyword ->
            val ksParts = keyword.removeSuffix("s").removeSuffix("ing").removeSuffix("ed")
                .split(Regex("\\s+"))
            expandedQuery.any { word -> ksParts.any { kw -> wordsMatch(word, kw) } }
        }
        val keywordRatio = keywordMatchCount.toDouble() / entryKeywordsLower.size.coerceAtLeast(1)

        // --- Query keyword coverage [0,1]: fraction of query words that hit ≥1 keyword ---
        val queryWordsHittingKeywords = queryWords.count { word ->
            val candidates = setOf(word) + (SYNONYMS[word] ?: emptySet())
            entryKeywordsLower.any { keyword ->
                val ksParts = keyword.removeSuffix("s").removeSuffix("ing").removeSuffix("ed")
                    .split(Regex("\\s+"))
                candidates.any { c -> ksParts.any { kw -> wordsMatch(c, kw) } }
            }
        }
        val queryKeywordCoverage = queryWordsHittingKeywords.toDouble() / queryWords.size

        // --- Question coverage [0,1]: fraction of query words found in the question ---
        val questionWordMatches = queryWords.count { word ->
            val candidates = setOf(word) + (SYNONYMS[word] ?: emptySet())
            questionWords.any { qw -> candidates.any { c -> wordsMatch(c, qw) } }
        }
        val questionCoverage = questionWordMatches.toDouble() / queryWords.size

        // --- Answer coverage [0,1]: fraction of query words found in the answer ---
        val answerWordMatches = queryWords.count { word ->
            val candidates = setOf(word) + (SYNONYMS[word] ?: emptySet())
            answerWords.any { aw -> candidates.any { c -> wordsMatch(c, aw) } }
        }
        val answerCoverage = answerWordMatches.toDouble() / queryWords.size

        // --- Domain-phrase co-occurrence [0,1] ---
        val queryPhraseCount = KEY_PHRASES.count { queryLower.contains(it.lowercase()) }
        val phraseMatches = KEY_PHRASES.count { phrase ->
            val p = phrase.lowercase()
            queryLower.contains(p) &&
            (questionLower.contains(p) ||
             entryKeywordsLower.any { it.contains(p) } ||
             answerLower.contains(p))
        }
        val phraseScore = if (queryPhraseCount > 0)
            phraseMatches.toDouble() / queryPhraseCount
        else 0.0

        // Weighted composite — all components already in [0,1].
        var score = (keywordRatio       * 0.15) +
                    (queryKeywordCoverage * 0.25) +
                    (questionCoverage    * 0.30) +
                    (answerCoverage      * 0.10) +
                    (phraseScore         * 0.10)

        // Strong bonus when the question is a near-exact match
        if (questionCoverage > 0.6) score += 0.10 * questionCoverage

        return score.coerceIn(0.0, 1.0)
    }

    /**
     * Find best match using keyword matching (offline fallback method).
     */
    private fun findBestMatchByKeywords(query: String, knowledgeBase: List<KnowledgeEntry>): MatchResult? {
        val queryLower = normalizeForMatching(query.lowercase().trim())
        val queryWords = queryLower.split(Regex("\\s+"))
            .filter { it.length > 2 && it !in STOP_WORDS }
            .map { it.trim().removeSuffix("s").removeSuffix("ing").removeSuffix("ed") }

        if (queryWords.isEmpty()) return null

        var bestMatch: MatchResult? = null
        var bestScore = 0.0

        for (entry in knowledgeBase) {
            val normalizedScore = scoreEntry(queryWords, queryLower, entry)
            if (normalizedScore > bestScore && normalizedScore > MIN_SIMILARITY_THRESHOLD) {
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
     * Find top K matching entries for online LLM context (similarity >= minSimilarity).
     * Always runs keyword matching and merges it with semantic similarity results so
     * that paraphrased queries (different wording, synonyms, number formats) are still
     * caught even when the embedding model produces a poor signal.
     */
    fun findTopMatches(
        queryEmbedding: FloatArray,
        knowledgeBase: List<KnowledgeEntry>,
        queryText: String? = null,
        topK: Int = 5,
        minSimilarity: Double = 0.5
    ): List<MatchResult> {
        if (knowledgeBase.isEmpty()) return emptyList()

        // Keyword-only path when no embedding is available
        if (queryEmbedding.isEmpty() && queryText != null) {
            return findTopMatchesByKeywords(queryText, knowledgeBase, topK, KEYWORD_FALLBACK_THRESHOLD)
        }

        // Semantic similarity pass
        val semanticCandidates = mutableListOf<MatchResult>()
        for (entry in knowledgeBase) {
            val entryEmbedding = entry.embedding ?: continue
            val similarity = offlineNLPEngine.cosineSimilarity(queryEmbedding, entryEmbedding).toDouble()
            if (similarity >= minSimilarity) {
                semanticCandidates.add(
                    MatchResult(
                        question = entry.question,
                        answer = entry.answer,
                        similarity = similarity
                    )
                )
            }
        }
        val semanticResults = semanticCandidates.sortedByDescending { it.similarity }.take(topK)

        // Keyword pass — always executed so paraphrased / differently-worded queries
        // are not silently missed when the embedding model gives a poor signal.
        val keywordResults = if (queryText != null) {
            findTopMatchesByKeywords(queryText, knowledgeBase, topK, KEYWORD_FALLBACK_THRESHOLD)
        } else emptyList()

        if (semanticResults.isEmpty() && keywordResults.isEmpty()) return emptyList()

        // Merge both sets: keep the highest similarity score per unique question,
        // then return the top K overall.
        val merged = (semanticResults + keywordResults)
            .groupBy { it.question }
            .map { (_, results) -> results.maxByOrNull { it.similarity }!! }
            .sortedByDescending { it.similarity }
            .take(topK)

        return merged
    }

    /**
     * Find top K matches using keyword matching (used by findTopMatches for online retrieval).
     */
    private fun findTopMatchesByKeywords(
        query: String,
        knowledgeBase: List<KnowledgeEntry>,
        topK: Int,
        minSimilarity: Double
    ): List<MatchResult> {
        val queryLower = normalizeForMatching(query.lowercase().trim())
        val queryWords = queryLower.split(Regex("\\s+"))
            .filter { it.length > 2 && it !in STOP_WORDS }
            .map { it.trim().removeSuffix("s").removeSuffix("ing").removeSuffix("ed") }

        if (queryWords.isEmpty()) return emptyList()

        val scoredEntries = mutableListOf<MatchResult>()
        for (entry in knowledgeBase) {
            val normalizedScore = scoreEntry(queryWords, queryLower, entry)
            if (normalizedScore >= minSimilarity) {
                scoredEntries.add(
                    MatchResult(
                        question = entry.question,
                        answer = entry.answer,
                        similarity = normalizedScore
                    )
                )
            }
        }
        return scoredEntries.sortedByDescending { it.similarity }.take(topK)
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

