# Truth Window: cleanup

## Entry 1
### User said
```
Can you do a cleanup of ImageDetailsPage.tsx I got rid of some things.
```
### Summary
- Will review and simplify `ImageDetailsPage.tsx` to remove stale logic or unused state after the recent changes.

## Entry 2
### User said
```
initialPrompt and baseImageFileName are no longer used right?
```
### Summary
- Removed those fields from the detail page and now derive the title/image directly from the latest edit (with fallback text).

## Entry 3
### User said
```
It says that ScriptProcessorNode is deprecated
```
### Summary
- Drop the ScriptProcessorNode fallback and rely on AudioWorkletNode; if unavailable, show an error instead of using the deprecated API.

## Entry 4
### User said
```
It says that ScriptProcessorNode is deprecated
```
### Summary
- Removed the ScriptProcessorNode fallback; we now require AudioWorkletNode support and show an error if unavailable.

## Entry 5
### User said
```
Let's keep the title of the page edits[0]'s prompt
```
### Summary
- Will update the page heading to use the first edit’s prompt (original request) instead of the latest refinement.

## Entry 6
### User said
```
If there isn't a generated prompt or the prompt and generated prompt are the same, don't include it in the UI
```
### Summary
- Hide the “Generated prompt” line unless it exists and differs from the user’s refinement.

## Entry 7
### User said
```
Let's move the title under the photo and make it look more like a caption than a page title
```
### Summary
- Will relocate the prompt title beneath the image and restyle it as a caption.

## Entry 8
### User said
```
Let's move the title under the photo and make it look more like a caption than a page title
```
### Summary
- Header now just labels the section while the prompt text sits beneath the image as a muted caption.
