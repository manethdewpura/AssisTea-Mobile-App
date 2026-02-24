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
            
            // Load scaler parameters (7 features)
            val scalerJson = loadJSONFromAsset(reactApplicationContext, "labour_assignment_ml_model/scaler_params.json")
            val scalerObj = JSONObject(scalerJson)
            val meanArray = scalerObj.getJSONArray("mean")
            val scaleArray = scalerObj.getJSONArray("scale")
            
            scalerMean = FloatArray(meanArray.length()) { i -> meanArray.getDouble(i).toFloat() }
            scalerScale = FloatArray(scaleArray.length()) { i -> scaleArray.getDouble(i).toFloat() }
            
            // Load label mappings (gender only + global average)
            val mappingJson = loadJSONFromAsset(reactApplicationContext, "labour_assignment_ml_model/label_mappings.json")
            val mappingObj = JSONObject(mappingJson)
            
            genderMapping = jsonToMap(mappingObj.getJSONObject("gender_mapping"))

            
            promise.resolve("ML Model initialized successfully")
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", "Failed to initialize model: ${e.message}", e)
        }
    }

    /**
     * Predict efficiency for a worker-field combination using 7 generalizable features.
     * No field ID or quality — only universal physical/demographic properties + historical performance.
     */
    @ReactMethod
    fun predictEfficiency(
        age: Double,
        gender: String,
        yearsOfExperience: Double,
        fieldSlope: Double,
        avgEfficiencyHistorical: Double,
        recentEfficiencyHistorical: Double,
        slopeSpecificEfficiencyHistorical: Double,
        promise: Promise
    ) {
        try {
            if (interpreter == null || scalerMean == null || scalerScale == null) {
                promise.reject("NOT_INITIALIZED", "Model not initialized. Call initialize() first.")
                return
            }

            // Encode gender: Male=0, Female=1
            val genderValue = genderMapping?.get(gender)
            if (genderValue == null) {
                promise.reject("INVALID_INPUT", "Unknown gender value: $gender")
                return
            }
            val genderEncoded = genderValue.toFloat()

            // Build 7-feature input array
            // Order MUST match training script feature order:
            // Age, Gender_encoded, Years_Of_Experience, Field_slope,
            // Avg_Efficiency_Hist, Recent_Efficiency_Hist, Slope_Specific_Efficiency_Hist
            val features = floatArrayOf(
                age.toFloat(),
                genderEncoded,
                yearsOfExperience.toFloat(),
                fieldSlope.toFloat(),
                avgEfficiencyHistorical.toFloat(),
                recentEfficiencyHistorical.toFloat(),
                slopeSpecificEfficiencyHistorical.toFloat()
            )

            // Normalize features using scaler params from training
            val normalizedFeatures = FloatArray(features.size) { i ->
                (features[i] - scalerMean!![i]) / scalerScale!![i]
            }

            // Prepare input tensor (7 features × 4 bytes per float)
            val inputBuffer = ByteBuffer.allocateDirect(7 * 4)
            inputBuffer.order(ByteOrder.nativeOrder())
            normalizedFeatures.forEach { inputBuffer.putFloat(it) }

            // Prepare output tensor (1 output × 4 bytes)
            val outputBuffer = ByteBuffer.allocateDirect(1 * 4)
            outputBuffer.order(ByteOrder.nativeOrder())

            // Run inference
            interpreter?.run(inputBuffer, outputBuffer)

            // Get result
            outputBuffer.rewind()
            val efficiency = outputBuffer.float

            // Clamp to reasonable range (model output should not be negative)
            val clampedEfficiency = efficiency.coerceAtLeast(0.5f)

            promise.resolve(clampedEfficiency.toDouble())
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
     * Convert JSONObject to Map<String, Int>
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
