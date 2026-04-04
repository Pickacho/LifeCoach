---
name: Android App Development
description: Best practices for building robust, modern Android applications using Kotlin and Jetpack Compose.
---

# Android Development Standards

## Architecture & Code
1. **Modern Stack**: Prioritize Kotlin and Jetpack Compose for UI development over traditional XML layouts unless modifying legacy code.
2. **Architecture**: Implement strict MVVM (Model-View-ViewModel) architecture. Keep logic out of Activities/Fragments.
3. **Coroutines**: Use Kotlin Coroutines and Flows for all asynchronous operations, database queries (Room), and network requests (Retrofit).

## UI/UX Rules
1. **Material Design**: Adhere to Material Design 3 guidelines for theming, typography, and visual hierarchy.
2. **Responsiveness**: Ensure layouts are adaptive across phones, foldables, and tablets.
3. **Performance**: Avoid deep nesting in Compose. Preload states where possible to ensure fluid 60fps/120fps animations.
