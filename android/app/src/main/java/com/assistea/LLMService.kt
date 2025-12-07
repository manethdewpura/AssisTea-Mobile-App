// package com.assistea

// import android.content.Context
// import android.os.Handler
// import android.os.Looper
// import okhttp3.*
// import okhttp3.MediaType.Companion.toMediaType
// import okhttp3.RequestBody.Companion.toRequestBody
// import com.google.gson.Gson
// import java.util.concurrent.TimeUnit

// data class OpenAIRequest(
//     val model: String,
//     val messages: List<Message>,
//     val temperature: Double = 0.7,
//     val max_tokens: Int = 500
// )

// data class Message(
//     val role: String,
//     val content: String
// )

// data class OpenAIResponse(
//     val choices: List<Choice>
// )

// data class Choice(
//     val message: Message
// )

// class LLMService(private val context: Context) {
    
//     private val client: OkHttpClient = OkHttpClient.Builder()
//         .connectTimeout(30, TimeUnit.SECONDS)
//         .readTimeout(60, TimeUnit.SECONDS)
//         .writeTimeout(60, TimeUnit.SECONDS)
//         .retryOnConnectionFailure(true)
//         .build()
    
//     private val gson = Gson()
//     private val mediaType = "application/json; charset=utf-8".toMediaType()
//     private val handler = Handler(Looper.getMainLooper())
    
//     companion object {
//         private const val OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
//         private const val MODEL_NAME = "gpt-4.1"
//         private const val MAX_RETRIES = 3
//     }
    
//     /**
//      * Query OpenAI GPT-4.1 API
//      * @param query User's question
//      * @param language Language preference (en/si)
//      * @param callback Callback with response or error
//      */
//     fun queryGPT(query: String, language: String, callback: (String?, String?) -> Unit) {
//         // Get API key from BuildConfig or environment
//         val apiKey = getApiKey()
//         if (apiKey.isBlank()) {
//             callback(null, "OpenAI API key not configured")
//             return
//         }
        
//         val systemPrompt = buildSystemPrompt(language)
//         val messages = listOf(
//             Message(role = "system", content = systemPrompt),
//             Message(role = "user", content = query)
//         )
        
//         val requestBody = OpenAIRequest(
//             model = MODEL_NAME,
//             messages = messages,
//             temperature = 0.7,
//             max_tokens = 500
//         )
        
//         val jsonBody = gson.toJson(requestBody)
//         val body = jsonBody.toRequestBody(mediaType)
        
//         val request = Request.Builder()
//             .url(OPENAI_API_URL)
//             .addHeader("Authorization", "Bearer $apiKey")
//             .addHeader("Content-Type", "application/json")
//             .post(body)
//             .build()
        
//         queryWithRetry(request, 0, callback)
//     }
    
//     /**
//      * Query with retry logic
//      */
//     private fun queryWithRetry(request: Request, retryCount: Int, callback: (String?, String?) -> Unit) {
//         client.newCall(request).enqueue(object : Callback {
//             override fun onFailure(call: Call, e: java.io.IOException) {
//                 if (retryCount < MAX_RETRIES) {
//                     // Retry after a short delay using handler
//                     handler.postDelayed({
//                         queryWithRetry(request, retryCount + 1, callback)
//                     }, 1000L * (retryCount + 1))
//                 } else {
//                     callback(null, "Network error: ${e.message}")
//                 }
//             }
            
//             override fun onResponse(call: Call, response: Response) {
//                 if (!response.isSuccessful) {
//                     val errorBody = response.body?.string() ?: "Unknown error"
//                     if (retryCount < MAX_RETRIES && response.code in 500..599) {
//                         // Retry on server errors
//                         handler.postDelayed({
//                             queryWithRetry(request, retryCount + 1, callback)
//                         }, 1000L * (retryCount + 1))
//                     } else {
//                         callback(null, "API error (${response.code}): $errorBody")
//                     }
//                     response.close()
//                     return
//                 }
                
//                 try {
//                     val responseBody = response.body?.string() ?: ""
//                     val openAIResponse = gson.fromJson(responseBody, OpenAIResponse::class.java)
                    
//                     if (openAIResponse.choices.isNotEmpty()) {
//                         val answer = openAIResponse.choices[0].message.content
//                         callback(answer, null)
//                     } else {
//                         callback(null, "No response from API")
//                     }
//                 } catch (e: Exception) {
//                     callback(null, "Failed to parse response: ${e.message}")
//                 } finally {
//                     response.close()
//                 }
//             }
//         })
//     }
    
//     /**
//      * Build system prompt based on language
//      */
//     private fun buildSystemPrompt(language: String): String {
//         val basePrompt = when (language.lowercase()) {
//             "si", "sinhala" -> {
//                 "ඔබ තේ වගාව පිළිබඳ විශේෂඥ AI සහායකයෙකි. තේ වගාව, රෝග, පොහොර, අස්වැන්න, සහ කෘෂිකර්මාන්තය පිළිබඳ ප්රශ්නවලට නිවැරදි, ප්රායෝගික පිළිතුරු ලබා දෙන්න."
//             }
//             else -> {
//                 "You are an expert AI assistant specialized in tea cultivation. Provide accurate and practical answers about tea farming, diseases, fertilizers, harvesting, and agricultural practices."
//             }
//         }
//         return basePrompt
//     }
    
//     /**
//      * Get API key from BuildConfig or environment
//      * In production, this should be securely stored
//      * To configure: Add to android/app/build.gradle:
//      * android {
//      *   defaultConfig {
//      *     buildConfigField "String", "OPENAI_API_KEY", "\"your-api-key-here\""
//      *   }
//      * }
//      */
//     private fun getApiKey(): String {
//         // Try to get from BuildConfig first
//         return try {
//             val field = BuildConfig::class.java.getField("OPENAI_API_KEY")
//             field.get(null) as? String ?: ""
//         } catch (e: Exception) {
//             // Fallback: return empty - should be configured via build.gradle
//             // In production, consider using Android Keystore or secure storage
//             ""
//         }
//     }
// }

