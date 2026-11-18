# GPX template regression

With viewer dependencies installed, build `npx webpack --config test/webpack.gpx-template.js` from `viewer`, serve `build/gpx-template` over HTTP, and call `window.runRegressionTests()` in the browser console.

The test imports the real editor template and checks it with the browser XML parser, both as generated and with either example uncommented. Before the fix even the empty template fails because its XML declaration is preceded by a newline; the route example also has an incomplete closing tag.
