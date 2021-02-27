# avnav directories
1.12.2019

## Installation
 - /usr/lib/avnav
    -  server: the server part
    -  chartconvert: the tools used for the importer to convert charts
    -  viewer: the java script part
       - layout _(new)_: containing layouts and keyboard mappings
    -  sounds: sound files
    -  plugins _(new)_: base dir for external plugins
       for each plugin a unique name should be used.
        - somePlugin
            - plugin.py (must contain a class Plugin)
            - plugin.js
            - plugin.css
## User dir
By default the user dir is $HOME/avnav.
 -  $HOME/avnav
    **avnav_server.xml**: the server config file
    - tracks: the directory with tracks
    - routes: the directory with routes
    - charts: the directory with charts (if the basedir is set via the commandline)
    - import: the directory where the importer will look for charts
    - layout: additional layouts
    - plugins _(new)_: base dir for plugins - see above, same structure
    - user _(new)_: base dir for extending and adapting avnav
        - icons: additional icons
        - viewer: directory for adapting the gui
          - **user.css**: CSS file that will be loaded after the build in
          - **user.js**: JS file for extending avnav see [extendig](extending.md)

If no parameter -b or -c is given to avnav, the chartdir will be set to $HOME/AvNavCharts/out

## Commandline
The following commandline parameters for the avnav script control the directories:
  - -b: set the user directory (the charts dir will be at the charts subdir)
  - -c: set a separate chart directory

## Internal parameters
In the server code the following base parameters are used:
  - *BASEDIR* : the server directory bewlow the installation dir
  - *DATADIR* : the data directory

Those parameters are part of every config for a handler.




