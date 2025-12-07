package com.assistea

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class AgronomistAIModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val offlineNLPEngine: OfflineNLPEngine by lazy { OfflineNLPEngine(reactContext) }
    private val knowledgeBaseManager: KnowledgeBaseManager by lazy { KnowledgeBaseManager(reactContext) }
    // TODO: Uncomment when LLMService is ready
    // private val llmService: LLMService by lazy { LLMService(reactContext) }
    
    override fun getName(): String {
        return "AgronomistAI"
    }
    
    /**
     * Query the offline knowledge base using semantic similarity
     * @param query The user's question
     * @param language Language preference (en/si)
     * @param promise Promise to resolve with the response
     */
    @ReactMethod
    fun queryOffline(query: String, language: String, promise: Promise) {
        try {
            if (query.isBlank()) {
                promise.reject("INVALID_QUERY", "Query cannot be empty")
                return
            }
            
            // Load knowledge base if not already loaded
            val knowledgeBase = knowledgeBaseManager.loadKnowledgeBase()
            if (knowledgeBase.isEmpty()) {
                promise.reject("NO_KNOWLEDGE_BASE", "Knowledge base is empty or could not be loaded")
                return
            }
            
            // Generate embedding for the query
            val queryEmbedding = offlineNLPEngine.generateEmbedding(query)
            
            // Find best matching answer (with keyword fallback if embedding fails)
            val bestMatch = if (queryEmbedding != null) {
                knowledgeBaseManager.findBestMatch(queryEmbedding, knowledgeBase, query)
            } else {
                // If embedding generation fails, use keyword matching
                knowledgeBaseManager.findBestMatch(FloatArray(0), knowledgeBase, query)
            }
            
            if (bestMatch != null) {
                val result = Arguments.createMap()
                result.putString("answer", bestMatch.answer)
                result.putString("source", "offline")
                result.putDouble("confidence", bestMatch.similarity)
                result.putString("question", bestMatch.question)
                result.putString("language", language)
                promise.resolve(result)
            } else {
                promise.reject("NO_MATCH", "No matching answer found in knowledge base")
            }
        } catch (e: Exception) {
            promise.reject("OFFLINE_QUERY_ERROR", "Error querying offline: ${e.message}", e)
        }
    }
    
    /**
     * Query OpenAI GPT-4.1 API for online responses
     * TODO: Implement when LLMService is ready
     * @param query The user's question
     * @param language Language preference (en/si)
     * @param promise Promise to resolve with the response
     */
    @ReactMethod
    fun queryOnline(query: String, language: String, promise: Promise) {
        // TODO: Uncomment when LLMService is ready
        promise.reject("NOT_IMPLEMENTED", "Online query not yet implemented")
        
        // Uncomment when ready:
        // try {
        //     if (query.isBlank()) {
        //         promise.reject("INVALID_QUERY", "Query cannot be empty")
        //         return
        //     }
        //     
        //     llmService.queryGPT(query, language) { response, error ->
        //         if (error != null) {
        //             promise.reject("ONLINE_QUERY_ERROR", error)
        //         } else if (response != null) {
        //             val result = Arguments.createMap()
        //             result.putString("answer", response)
        //             result.putString("source", "online")
        //             result.putDouble("confidence", 1.0)
        //             result.putString("language", language)
        //             promise.resolve(result)
        //         } else {
        //             promise.reject("NO_RESPONSE", "No response from online service")
        //         }
        //     }
        // } catch (e: Exception) {
        //     promise.reject("ONLINE_QUERY_ERROR", "Error querying online: ${e.message}", e)
        // }
    }
    
    /**
     * Check if the ML model is loaded and ready
     * @param promise Promise to resolve with the model status
     */
    @ReactMethod
    fun checkModelLoaded(promise: Promise) {
        try {
            val isLoaded = offlineNLPEngine.isModelLoaded()
            val result = Arguments.createMap()
            result.putBoolean("loaded", isLoaded)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("MODEL_CHECK_ERROR", "Error checking model status: ${e.message}", e)
        }
    }
    
    /**
     * Initialize the offline model (lazy loading)
     * @param promise Promise to resolve when initialization is complete
     */
    @ReactMethod
    fun initializeModel(promise: Promise) {
        try {
            offlineNLPEngine.initializeModel { success, error ->
                if (success) {
                    val result = Arguments.createMap()
                    result.putBoolean("success", true)
                    promise.resolve(result)
                } else {
                    promise.reject("MODEL_INIT_ERROR", error ?: "Failed to initialize model")
                }
            }
        } catch (e: Exception) {
            promise.reject("MODEL_INIT_ERROR", "Error initializing model: ${e.message}", e)
        }
    }
}

