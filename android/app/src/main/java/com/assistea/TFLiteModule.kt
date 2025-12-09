package com.assistea

import android.content.Context
import android.content.res.AssetManager
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.json.JSONObject

class TFLiteModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private var interpreter: Interpreter? = null
    private var scalerMean: FloatArray? = null
    private var scalerScale: FloatArray? = null
    private var genderMapping: Map<String, Int>? = null
    private var fieldMapping: Map<String, Int>? = null
    private var qualityMapping: Map<String, Int>? = null

    override fun getName(): String {
        return "TFLiteModule"
    }

    /**
     * Initialize the TFLite model and load preprocessing parameters
     */
    @ReactMethod
    fun initialize(promise: Promise) {
        try {
            // Load the TFLite model
            val modelBuffer = loadModelFile(reactApplicationContext.assets, "labour_assignment_ml_model/tea_assignment_model.tflite")
            interpreter = Interpreter(modelBuffer)
            
            // Load scaler parameters
            val scalerJson = loadJSONFromAsset(reactApplicationContext, "labour_assignment_ml_model/scaler_params.json")
            val scalerObj = JSONObject(scalerJson)
            val meanArray = scalerObj.getJSONArray("mean")
            val scaleArray = scalerObj.getJSONArray("scale")
            
            scalerMean = FloatArray(meanArray.length()) { i -> meanArray.getDouble(i).toFloat() }
            scalerScale = FloatArray(scaleArray.length()) { i -> scaleArray.getDouble(i).toFloat() }
            
            // Load label mappings
            val mappingJson = loadJSONFromAsset(reactApplicationContext, "labour_assignment_ml_model/label_mappings.json")
            val mappingObj = JSONObject(mappingJson)
            
            genderMapping = jsonToMap(mappingObj.getJSONObject("gender_mapping"))
            fieldMapping = jsonToMap(mappingObj.getJSONObject("field_mapping"))
            qualityMapping = jsonToMap(mappingObj.getJSONObject("quality_mapping"))
            
            promise.resolve("ML Model initialized successfully")
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", "Failed to initialize model: ${e.message}", e)
        }
    }

    /**
     * Predict efficiency for a worker-field combination
     */
    @ReactMethod
    fun predictEfficiency(
        age: Double,
        gender: String,
        yearsOfExperience: Double,
        fieldSlope: Double,
        quality: String,
        field: String,
        promise: Promise
    ) {
        try {
            if (interpreter == null || scalerMean == null || scalerScale == null) {
                promise.reject("NOT_INITIALIZED", "Model not initialized. Call initialize() first.")
                return
            }

            // Encode categorical variables
            val genderEncoded = (genderMapping?.get(gender) ?: 0).toFloat()
            val fieldEncoded = (fieldMapping?.get(field) ?: 0).toFloat()
            val qualityEncoded = (qualityMapping?.get(quality) ?: 0).toFloat()

            // Create feature array
            val features = floatArrayOf(
                age.toFloat(),
                genderEncoded,
                yearsOfExperience.toFloat(),
                fieldSlope.toFloat(),
                qualityEncoded,
                fieldEncoded
            )

            // Normalize features
            val normalizedFeatures = FloatArray(features.size) { i ->
                (features[i] - scalerMean!![i]) / scalerScale!![i]
            }

            // Prepare input tensor
            val inputBuffer = ByteBuffer.allocateDirect(6 * 4)  // 6 features * 4 bytes (float)
            inputBuffer.order(ByteOrder.nativeOrder())
            normalizedFeatures.forEach { inputBuffer.putFloat(it) }

            // Prepare output tensor
            val outputBuffer = ByteBuffer.allocateDirect(1 * 4)  // 1 output * 4 bytes
            outputBuffer.order(ByteOrder.nativeOrder())

            // Run inference
            interpreter?.run(inputBuffer, outputBuffer)

            // Get result
           outputBuffer.rewind()
            val efficiency = outputBuffer.float

            promise.resolve(efficiency.toDouble())
        } catch (e: Exception) {
            promise.reject("PREDICTION_ERROR", "Prediction failed: ${e.message}", e)
        }
    }

    /**
     * Load TFLite model file from assets
     */
    private fun loadModelFile(assets: AssetManager, modelPath: String): MappedByteBuffer {
        val fileDescriptor = assets.openFd(modelPath)
        val inputStream = FileInputStream(fileDescriptor.fileDescriptor)
        val fileChannel = inputStream.channel
        val startOffset = fileDescriptor.startOffset
        val declaredLength = fileDescriptor.declaredLength
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
    }

    /**
     * Load JSON file from assets
     */
    private fun loadJSONFromAsset(context: Context, fileName: String): String {
        return context.assets.open(fileName).bufferedReader().use { it.readText() }
    }

    /**
     * Convert JSONObject to Map
     */
    private fun jsonToMap(json: JSONObject): Map<String, Int> {
        val map = mutableMapOf<String, Int>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            map[key] = json.getInt(key)
        }
        return map
    }
}
