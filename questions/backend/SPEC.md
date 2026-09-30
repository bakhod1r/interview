# Backend roadmap interview questions — output spec

Write ONE json file: `questions/backend/parts/<part>.json`

Top level = array of topic objects:

```json
[
  {
    "topicId": "<exact id given>",
    "topicTitle": "<exact title given>",
    "questions": [
      {
        "id": "<topicId>-01",
        "question": "…",
        "answer": "2-5 sentences. Concrete. Name real mechanisms, commands, status codes, algorithms.",
        "difficulty": "junior|middle|senior",
        "type": "conceptual|scenario|debugging|design",
        "subtopic": "<one of the listed subtopics, or \"\">",
        "followUps": ["…", "…"],
        "tags": ["…"]
      }
    ]
  }
]
```

Rules:
- 10-14 questions per topic. Mix: ~35% junior, ~40% middle, ~25% senior.
- At least 3 per topic must be `scenario` or `debugging` type (real production situation, not definition).
- Cover the listed subtopics — each subtopic hit by >=1 question where it makes sense.
- Answers must be technically correct and specific. No filler, no "it depends" without the trade-off named.
- English. JSON valid, UTF-8, 2-space indent. No trailing commas.
- Do NOT touch any other file.
