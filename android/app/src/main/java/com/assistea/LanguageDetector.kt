package com.assistea

object LanguageDetector {
    /**
     * Detect the language of a given text
     * @param text The text to analyze
     * @return Language code (en, si, ta) or null if uncertain
     */
    fun detectLanguage(text: String): String? {
        if (text.isBlank()) {
            return null
        }
        
        val trimmedText = text.trim()
        
        // For very short queries (less than 3 characters), skip detection
        if (trimmedText.length < 3) {
            return null
        }
        
        var englishCount = 0
        var sinhalaCount = 0
        var tamilCount = 0
        var totalChars = 0
        
        for (char in trimmedText) {
            when {
                // English: Latin script (a-z, A-Z, 0-9, common punctuation)
                char.code in 0x0020..0x007F -> {
                    if (char.isLetter()) {
                        englishCount++
                        totalChars++
                    }
                }
                // Sinhala: Unicode range 0D80-0DFF
                char.code in 0x0D80..0x0DFF -> {
                    sinhalaCount++
                    totalChars++
                }
                // Tamil: Unicode range 0B80-0BFF
                char.code in 0x0B80..0x0BFF -> {
                    tamilCount++
                    totalChars++
                }
            }
        }
        
        // If no meaningful characters found, return null
        if (totalChars == 0) {
            return null
        }
        
        // For very short text, require at least 2 characters in the script
        val minCharsRequired = if (totalChars < 5) 2 else (totalChars * 0.3).toInt()
        
        // Calculate percentages
        val englishPercent = (englishCount.toDouble() / totalChars) * 100
        val sinhalaPercent = (sinhalaCount.toDouble() / totalChars) * 100
        val tamilPercent = (tamilCount.toDouble() / totalChars) * 100
        
        // Determine language based on highest percentage and minimum character requirement
        return when {
            sinhalaCount >= minCharsRequired && sinhalaPercent > englishPercent && sinhalaPercent > tamilPercent -> "si"
            tamilCount >= minCharsRequired && tamilPercent > englishPercent && tamilPercent > sinhalaPercent -> "ta"
            englishCount >= minCharsRequired && englishPercent > sinhalaPercent && englishPercent > tamilPercent -> "en"
            // If mixed or uncertain, check which has the highest count (but still require minimum)
            sinhalaCount >= minCharsRequired && sinhalaCount > tamilCount && sinhalaCount > englishCount -> "si"
            tamilCount >= minCharsRequired && tamilCount > sinhalaCount && tamilCount > englishCount -> "ta"
            englishCount >= minCharsRequired && englishCount > sinhalaCount && englishCount > tamilCount -> "en"
            else -> null // Return null if uncertain
        }
    }
    
    /**
     * Get language-specific error message
     */
    fun getLanguageMismatchMessage(detectedLang: String, selectedLang: String): String {
        val languageNames = mapOf(
            "en" to "English",
            "si" to "Sinhala",
            "ta" to "Tamil"
        )
        
        val detectedName = languageNames[detectedLang] ?: detectedLang
        val selectedName = languageNames[selectedLang] ?: selectedLang
        
        return when (selectedLang) {
            "en" -> "Your query appears to be in $detectedName. Please change the language selector to $detectedName to get the best results."
            "si" -> "ඔබගේ ප්‍රශ්නය $detectedName භාෂාවෙන් පෙනේ. හොඳම ප්‍රතිඵල ලබා ගැනීම සඳහා භාෂාව $detectedName වෙත වෙනස් කරන්න."
            "ta" -> "உங்கள் வினா $detectedName மொழியில் தோன்றுகிறது. சிறந்த முடிவுகளைப் பெற மொழி தேர்வியை $detectedName க்கு மாற்றவும்."
            else -> "Your query appears to be in $detectedName. Please change the language selector to $detectedName."
        }
    }
}

