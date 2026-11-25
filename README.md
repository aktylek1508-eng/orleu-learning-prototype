# Orleu Learning Prototype

A bilingual (Kazakh/Russian) teacher and learner prototype. The teacher can draft assignments manually or generate Kazakh quiz questions from a photo or supported document, review and edit the result, then save it to the classroom demo.

## Vercel deployment

- Static interface: `outputs/`
- Serverless generator: `api/generate-task.js`
- Required Vercel Production environment variable: `OPENAI_API_KEY`

Uploaded materials are sent to the configured OpenAI model for question generation. Review questions and answers before assigning them to learners. The prototype stores assignment and quiz demo data in the browser.
