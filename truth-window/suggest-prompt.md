# Truth Window: suggest-prompt

## Entry 1
### User said
```
Okay I would like a new truth-window session called suggest-prompt
```
### Summary
- Created this session log to track upcoming work related to prompt suggestions.

## Entry 2
### User said
```
I want to have a button on the CreateImage page that you can press and it populates a prompt. "Generate random prompt" it posts to "/api/prompts" and gets back JSON that is {prompt: "your prompt here"} Put the prompt in the field, overriding whatever was there.
```
### Summary
- Will add a "Generate random prompt" button that calls `/api/prompts`, reads the returned prompt, and sets the form field.
