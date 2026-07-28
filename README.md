Testing out the newer version!
**[Click here to see the demo!](https://helloiamsuchi.github.io/Harmony-2.0/)**

# Harmony

Harmony is a holistic wellness platform that brings together menstrual health tracking, AI-guided support, legal awareness, learning, and community into a single experience. It is a fully client-side single-page application built with HTML, CSS, and JavaScript — no backend or authentication required.

## Overview

The app flows through six connected sections: Landing, Menstrual Tracker, Astha AI Chatbot, Legal Knowledge Hub, Learning Hub, and Community. Navigation and theme preference persist across the whole experience, and all user data is stored locally in the browser.

## Landing Page

Introduces the platform with a hero section and a "Get Started" call to action, followed by a feature overview linking directly into each core section of the app.

## Menstrual Tracker & Mood Logger

- Interactive calendar for logging period days, with month-to-month navigation.
- Automatic calculation of current cycle phase and estimated days until the next period.
- Mood and symptom logging, with space for personal notes, saved as a running history.
- A diet suggestion panel that adapts to the logged mood, symptoms, and cycle phase.
- Irregularity detection that flags unusual cycle patterns and recommends a gynaecologist consultation when relevant.
- A cycle history view showing average cycle length over time.

## Astha AI Chatbot

A rule-based conversational assistant focused on menstrual health, hygiene, and general wellbeing. It responds to questions on topics such as cycle length, period pain, PCOD/PCOS, irregular periods, diet, endometriosis, cervical cancer, confidence, and emotional wellbeing. Includes a scrollable row of preset prompts, persistent chat history, and an option to clear the conversation.

## Legal Knowledge Hub

An expandable accordion of plain-language explanations covering rights and protections relevant to health, safety, and dignity — including workplace protections, privacy, school policies, domestic violence protections, maternity rights, and broader international human rights frameworks. Each entry pairs a clear definition with the relevant law or convention.

## Learning Hub

A course catalog covering nutrition, yoga, mental health, and life skills. Each course includes a description, a resources section with key term definitions and links to further reading, and a short interactive quiz that updates the learner's progress.

## Community

Two modes accessible from a single toggle:

- **Learner Mode** — browse hobbies and skills across categories such as cooking, art, writing, web development, and financial literacy, with links to relevant online classes, alongside a community feed for sharing and discussion.
- **Business Mode** — the same categories reframed as course and workshop listings from businesses, including pricing and duration, alongside its own community feed.

## Theme

A light/dark mode toggle is available at all times from the navigation bar, with the preference remembered on return visits.

## Project Structure

```
index.html   Markup for all sections
styles.css   All styling, organized by section
app.js       All application logic, organized by section
```
