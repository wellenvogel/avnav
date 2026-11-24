# Editor save regression

With viewer dependencies installed, build `npx webpack --config test/webpack.editor-save.js` from `viewer`, serve `build/editor-save` over HTTP, and run `window.runRegressionTests()` in the browser console.

The real React editor and CodeFlask component are rendered. Save promises are controlled to reproduce typing while a save is pending. The original disables Save when the earlier request completes, hiding the newer unsaved edits. Checks cover retaining those edits, preventing overlapping save requests, a normal successful save and retrying after a rejected save. No actual server is used.
