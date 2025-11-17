package com.assistea

import android.content.Context
import ai.onnxruntime.*
import java.util.concurrent.atomic.AtomicBoolean

class OfflineNLPEngine(private val context: Context) {
    
    private var ortEnv: OrtEnvironment? = null
    private var ortSession: OrtSession? = null
    private val isModelLoaded = AtomicBoolean(false)
    private val isInitializing = AtomicBoolean(false)
    
    companion object {
        private const val MODEL_NAME = "all-MiniLM-L6-v2.onnx"
        private const val MODEL_INPUT_NAME = "input_ids"
        private const val MAX_SEQUENCE_LENGTH = 256
        private const val EMBEDDING_DIMENSION = 384
    }
    
    /**
     * Initialize the ONNX model
     */
    fun initializeModel(callback: (Boolean, String?) -> Unit) {
        if (isModelLoaded.get()) {
            callback(true, null)
            return
        }
        
        if (isInitializing.get()) {
            callback(false, "Model initialization already in progress")
            return
        }
        
        isInitializing.set(true)
        
        try {
            ortEnv = OrtEnvironment.getEnvironment()
            
            // Try to load model from assets
            val modelPath = "models/$MODEL_NAME"
            val modelInputStream = try {
                context.assets.open(modelPath)
            } catch (e: Exception) {
                isInitializing.set(false)
                callback(false, "Model file not found at $modelPath. Please download the ONNX model and place it in assets/models/")
                return
            }
            
            val modelBytes = modelInputStream.readBytes()
            modelInputStream.close()
            
            val sessionOptions = OrtSession.SessionOptions()
            ortSession = ortEnv!!.createSession(modelBytes, sessionOptions)
            
            isModelLoaded.set(true)
            isInitializing.set(false)
            callback(true, null)
        } catch (e: Exception) {
            isInitializing.set(false)
            callback(false, "Failed to load model: ${e.message}")
        }
    }
    
    /**
     * Check if model is loaded
     */
    fun isModelLoaded(): Boolean {
        return isModelLoaded.get()
    }
    
    /**
     * Generate embedding for a text input
     * Note: This is a simplified version. In production, you would need to:
     * 1. Tokenize the input text using the model's tokenizer
     * 2. Convert tokens to input_ids
     * 3. Run inference
     * 4. Extract and normalize embeddings
     * 
     * For now, we'll use a placeholder that returns a dummy embedding
     * In a real implementation, you'd need to integrate a tokenizer library
     * or use a pre-tokenized approach
     */
    fun generateEmbedding(text: String): FloatArray? {
        if (!isModelLoaded.get()) {
            // Try to initialize synchronously (not recommended for production)
            initializeModel { success, _ ->
                if (!success) return null
            }
        }
        
        if (!isModelLoaded.get()) {
            return null
        }
        
        try {
            // Simplified tokenization - in production, use proper tokenizer
            val tokens = simpleTokenize(text)
            val inputIds = tokens.take(MAX_SEQUENCE_LENGTH)
                .map { it.toLong() }
                .toLongArray()
            
            // Pad or truncate to MAX_SEQUENCE_LENGTH
            val paddedInputIds = LongArray(MAX_SEQUENCE_LENGTH) { index ->
                if (index < inputIds.size) inputIds[index] else 0L
            }
            
            // Create input tensor
            val inputShape = longArrayOf(1, MAX_SEQUENCE_LENGTH.toLong())
            val inputTensor = OnnxTensor.createTensor(ortEnv!!, paddedInputIds, inputShape)
            
            // Run inference
            val inputs = mapOf(MODEL_INPUT_NAME to inputTensor)
            val outputs = ortSession!!.run(inputs)
            
            // Extract embeddings (assuming output is named "last_hidden_state" or similar)
            val outputTensor = outputs.first().value as? OnnxTensor
            val embedding = outputTensor?.floatBuffer?.array()?.take(EMBEDDING_DIMENSION)?.toFloatArray()
            
            // Clean up
            inputTensor.close()
            outputs.close()
            
            // Normalize embedding
            return embedding?.let { normalizeEmbedding(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            // Fallback: return a simple hash-based embedding for development
            return generateFallbackEmbedding(text)
        }
    }
    
    /**
     * Simple tokenization (placeholder - use proper tokenizer in production)
     */
    private fun simpleTokenize(text: String): List<Int> {
        // This is a very basic tokenization
        // In production, you should use the model's actual tokenizer
        return text.lowercase()
            .split(Regex("\\s+"))
            .map { it.hashCode() % 10000 }
    }
    
    /**
     * Generate a fallback embedding using text hashing
     * This is used when the ONNX model is not available
     */
    private fun generateFallbackEmbedding(text: String): FloatArray {
        val embedding = FloatArray(EMBEDDING_DIMENSION)
        val words = text.lowercase().split(Regex("\\s+"))
        
        for (i in embedding.indices) {
            var hash = 0
            for (word in words) {
                hash += word.hashCode() * (i + 1)
            }
            embedding[i] = (hash % 1000) / 1000f
        }
        
        return normalizeEmbedding(embedding)
    }
    
    /**
     * Normalize embedding vector to unit length
     */
    private fun normalizeEmbedding(embedding: FloatArray): FloatArray {
        val magnitude = kotlin.math.sqrt(embedding.sumOf { it.toDouble() * it.toDouble() }.toFloat())
        if (magnitude == 0f) return embedding
        
        return embedding.map { it / magnitude }.toFloatArray()
    }
    
    /**
     * Calculate cosine similarity between two embeddings
     */
    fun cosineSimilarity(embedding1: FloatArray, embedding2: FloatArray): Float {
        if (embedding1.size != embedding2.size) {
            return 0f
        }
        
        var dotProduct = 0f
        var magnitude1 = 0f
        var magnitude2 = 0f
        
        for (i in embedding1.indices) {
            dotProduct += embedding1[i] * embedding2[i]
            magnitude1 += embedding1[i] * embedding1[i]
            magnitude2 += embedding2[i] * embedding2[i]
        }
        
        val denominator = kotlin.math.sqrt(magnitude1) * kotlin.math.sqrt(magnitude2)
        return if (denominator == 0f) 0f else dotProduct / denominator
    }
    
    /**
     * Clean up resources
     */
    fun close() {
        ortSession?.close()
        ortEnv?.close()
        isModelLoaded.set(false)
    }
}

