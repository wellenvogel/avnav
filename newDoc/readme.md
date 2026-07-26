# Hints for writing the documentation

## Languages
Main language is german. Translation using gemini with the script translate/main.py. Needs a gemini token that can be obtained from google for free. Languages are sorted by directory (de/en).

## Screen shots
Screenshots should have 800 px width (or slightly more - they are scaled to 800px if there is room).

## Buttons
To link to a button use the name from the [buttonlist](docs/buttons/buttons.md) and write a macro in the code:
```
{{BT("Cancel")}}
```
This will render a small button symbol with the short text and the icon depending on the selected set. For DialogButtons use DB instead of BT.

## VIDEOS
To be flexible for the hosting of videos all videos should be configured in [videos.yml](docs/videos.yml).
Each video will have a name and can have multiple urls and a list of chapters.
```
navigation:
  youtube: "https://www.youtube.com/embed/as62-dDtmQ4"
  chapters:
    - 00:00 Start
    - 00:12 Navigationsansicht
    - 00:27 Widgets
    - 00:48 Buttonleiste
    - 00:58 Main Menu
    - 01:55 Actions
    - 02:20 MOB-Button
```
The capter list can easily be created by copying the text from YT. In the future more URLs could be added for local hosting.
The YT url should be the embed URL.
To embed a video on a page use the macro VIDEO
```
{{VIDEO("navigation")}}
```
This will embed a video on the page.

To embed all chapters as a list with links use
```
{{VCALL("navigation")}}
```
This will create a list using the chapter titles from videos.yml (TODO: languages).

To just create a link to a single chapter use
```
{{VCSINGLE("navigation",1)}}
or
{{VCSINGLE("navigation",1,"chapter 2")}}
```
The chapter index starts at 0. The second form allows to use a different title from the one used in the video.yml file.
Example: [navpage.md](docs/de/base/navpage.md).
