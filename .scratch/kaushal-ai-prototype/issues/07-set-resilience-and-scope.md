Type: grilling
Status: resolved

# Set recommendation, resilience, and scope boundaries

## Question

How should recommendations load, how should AI failures behave, and which adjacent capabilities stay outside the deadline?

## Answer

Recommendations appear immediately through Kaushal AI APIs backed by the imported catalog. Weak catalog evidence produces an explicit unavailable result rather than an unrelated course. Gemini is primary, Groq with Qwen is secondary, and a seeded question bank is the final fallback. Provider and fallback details appear only in server logs. Document-to-MCQ generation and real government integrations are out of scope.
