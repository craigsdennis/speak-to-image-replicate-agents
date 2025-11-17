# Truth Window: ui-updates

## Entry 1
### User said
```
Start a new truth-window session called ui-updates.md
```
### Summary
- Created this `truth-window/ui-updates.md` log to capture upcoming UI change requests verbatim along with summaries of the work completed.

## Entry 2
### User said
```
Can we have it so when an edit is happening to an image that the UI shows it please? Maybe a text overlay over the image of the in progress edit? Use the agent state.
```
### Summary
- Added an `activeEdit` flag to the agent state and now overlay a processing badge atop the image whenever an edit is running, so the UI mirrors the backend state.
