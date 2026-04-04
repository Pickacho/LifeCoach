---
name: Hebrew NLP & Voice Analysis
description: Specialized instructions for handling the nuances of Hebrew text processing and speech recognition.
---

# Hebrew NLP & Voice Rules

## Text Processing (NLP)
1. **Morphological Complexity**: Hebrew is highly agglutinative (prefixes like 'ב', 'ה', 'ו', 'כ' attach directly to nouns). Use specialized tokenizers and lemmatizers (e.g., `hebrew-nlp`, `spaCy-he`, `Trankit`, or `Dicta` APIs) before running core logic.
2. **RTL Directionality**: Ensure all text normalization handles Bidirectional (BiDi) characters correctly, removing Zero-Width Non-Joiners (ZWNJ) or layout markers if scraping.
3. **LLM Prompting**: When querying LLMs, specifically direct them to generate output in "Modern Native Hebrew without archaic structures, matching spoken Israeli phrasing."

## Voice Analysis & Speech-to-Text (STT)
1. **Transcription Tools**: Prefer OpenAI's Whisper model (or localized enterprise tools) which handles Hebrew speech contexts far better than legacy STT.
2. **Audio Preprocessing**: Filter out background noise using VAD (Voice Activity Detection), as Hebrew speech cadence can be dense and highly intonated.
3. **Sentiment via Prosody**: If performing sentiment analysis on voice, account for pitch and energy metrics, as Hebrew intonation for questions vs. statements can drastically change meaning.
