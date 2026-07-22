# Doc generation on windows

## Symlinks
Add right to create symlinks:
* run with admin rights `gpedit.msc`
* goto Local Computer Policy -> Computer Configuration -> Windows Settings -> Security Settings -> Local Policies -> User Rights Assignment
  
  german: Computerkonfiguration -> Windows-Einstellungen -> Sicherheitseinstellungen -> Zuweisen von Benutzerrechten -> Erstellen symbolischer Verknüpfungen

  add your account to the allowed users

* in the cloned AvNav directory:
  `git config core.symlinks true`
* log out and log in again
* in the cloned AvNav directory
  `git checkout -- newDoc\docs\images`

  newDoc\docs\images should now be a symbolic link
  

## Installation

* Install [Miniconda](https://www.anaconda.com/download)
* Open Anaconda Prompt
* Commands: 
```
conda create --name avnav-doc python=3.12
conda activate avnav-doc
cd <path to avnav repo>\newDoc
pip install -r docker\requirements.txt
```

## Usage
Open AnacondaPrompt
```
conda activate avnav-doc
cd <path to avnav repo>\newDoc
mkdocs serve
```


