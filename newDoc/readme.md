# Documentation Tolling
## Windows

### Symlinks
Add right to create symlinks:
* run with admin rights `gpedit.msc`
* goto Local Computer Policy -> Computer Configuration -> Windows Settings -> Security Settings -> Local Policies -> User Rights Assignment
  
  german: Computerkonfiguration -> Windows-Einstellungen -> Sicherheitseinstellungen -> Lokale Richtlinien -> Zuweisen von Benutzerrechten -> Erstellen symbolischer Verknüpfungen

  add your account to the allowed users

* in the cloned AvNav directory:
  `git config core.symlinks true`
* __log out and log in again__
* in the cloned AvNav directory
  `git checkout -- newDoc\docs\images`

  newDoc\docs\images should now be a symbolic link
  

### Installation

* Install [Miniconda](https://www.anaconda.com/download)
* Open Anaconda Prompt
* Commands: 
```
conda create --name avnav-doc python=3.12
conda activate avnav-doc
cd <path to avnav repo>\newDoc
pip install -r docker\requirements.txt
```

### Usage
Open AnacondaPrompt
```
conda activate avnav-doc
cd <path to avnav repo>\newDoc
mkdocs serve
```

## Linux
### python venv 
__python 3.12__

Preparation:
```
python3 -m venv ../.venv
. ../.venv/bin/activate
pip install -r docker/requirements.txt
```
Writing:
```
. ../.venv/bin/activate
./build.sh -b serve
```
### docker
```
./build.sh -d [-b] serve
```

### build.sh
The build script is able to create the button usage (-b flag) and run the mkdocs command - either locally or using a docker container. The current container is available at dockerhub:
`wellenvogel/avnav-doc-build:m.n`


# Hints for writing the documentation

## Languages
Main language is german. Translation using gemini with the script translate/main.py. Needs a gemini token that can be obtained from google for free. Languages are sorted by directory (de/en).

## Old doc
As an intermediate work the old documentation was copied and converted to converted.


## Screen shots
Screenshots should have 800 px width (or slightly more - they are scaled to 800px if there is room).
All images should go to the img folder.

## Buttons
To link to a button use the name from the [buttonlist](docs/buttons/buttons.md) and write a macro in the code:
```
{{BT("Cancel")}}
```
This will render a small button symbol with the short text and the icon depending on the selected set. For DialogButtons use DB instead of BT. For buttons of the main menu you can use the long text:
```
{{BT("Cancel",True)}}
```

## Main Menu Entries
The buttons in the main menu are named like the pages they open with a prefix "MM".
For a Main Menu button write:
```
{{MB("MMchartspage")}}
```
To add the call to the Main Menu there is a shortcut:
```
{{MM("MMchartspage")}}
```
The name for the actions is `MM:actions`.
To have the complete chain for open Main Menu, click Actions and an action you can write:
```
{{MMA("StatusShutdown")}}
```
See the [examples](docs/de/special/index.md).


## Icons
For standalone icons (without button) you must use the Icon name [see source](https://github.com/wellenvogel/avnav/blob/master/viewer/style/icons.less).
```
{{ICON("MNCollapsed")}}
```


## VIDEOS
To be flexible for the hosting of videos all videos should be configured in [videos.yml](docs/videos.yml).
Each video will have a name and can have multiple urls and a list of chapters.
```
navigation:
  youtube: "as62-dDtmQ4"
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

The YT url should just be the ID. This way we can easily create links to YT or embed links.

Currently YT links will hide subtitles when the current language is german and will enable english subtitles if the current language is english.

### Embedding Videos
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

### Linking Videos
To link a video use 
```
[Navpage]({{VLINK("navigation")}}){.videolink}
```
The added class `videolink` will allow to control if this link should be opened in a new Window (for now: default on).

To link to a video chapter use 
```
[Chapter 1]({{VCLINK("navigation",0)}}){.videolink}
```
The chapter index starts at 0.

Example: [navpage.md](docs/de/base/navpage.md).
