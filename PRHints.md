# Hints for AvNav PRs

Basically those hints are intended to be followed by AI created PRs - but human users should also consider them as far as they apply.

## Basics

Keep the PR as small as possible and focus on fixing one issue in one PR. This makes it much easier to merge the PR within a short time frame.
If the PR does not simply correct a small bug or adds a local functionality please get in contact with me first to have a small architectural discussion. This could prevent a lot of work that needs to be redone later.

## Tests
Until there is no prepared testsuite that you can integrate with, place tests in a separate subdirectory of the test directory (look at android/server/viewer). The name of the subdirectory below "test" should be `pr_<someuniquename>`. If you address issues that the PR corrects just add those issues as comments to files in the test directory so that later searches can find them.

When creating tests try to avoid (as far as possible) directly accessing libraries normally being embedded in AvNav and not being visible at the plugin api as this can change.

## Feature parity Python-Android
If you are adding features to the server parts try to provide implementations both for android (Java) and python.

If you cannot provide one ofe the implementations just note this (including a short reason).

## Documentation
If the user documentation is concerned either directly provide some changes to files below newDoc or add some documentation to the PR itself. When providing changes in newDoc you only need to provide the german part (english is generated). 

## Explanations
Keep the explanations short and focus on readability for humans. If some sepcial algorithms are used provide some links that explain them.