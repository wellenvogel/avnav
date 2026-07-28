#! /usr/bin/env python3
'''
create chapters from bookmarks of smplayer that can be written to an MP4 file using
MP4Box -chap xxx.txt file.mp4
MP4Box comes with the package gpac

To be able to find the info from smplayer you must set file_settings_method=normal in smplayer.ini
~/.config/smplayer/smplayer.ini
'''

import os
import configparser
import datetime

import sys

INI="smplayer.ini"
FILES="smplayer_files.ini"
SMODE="file_settings_method"

def get_config_dir():
    return os.path.join(os.environ['HOME'], '.config', 'smplayer')

def read_config(filename):
    dir=get_config_dir()
    if not os.path.isdir(dir):
        raise Exception(f"config dir {dir} does not exist")
    config = configparser.ConfigParser()
    complete_name=os.path.join(dir, filename)
    if not os.path.exists(complete_name):
        raise Exception(f"config file {complete_name} does not exist")
    config.read(complete_name)
    return config

def err(txt:str):
    print(f"ERROR: {txt}", file=sys.stderr)
    sys.exit(1)
def log(txt:str):
    print(f"# {txt}", file=sys.stderr)
def usage():
    print(f"Usage: {sys.argv[0]} filename",file=sys.stderr)
    sys.exit(1)

def file_to_section(fname):
    '''
    see file src/filesettings.cpp#filenameToGroupname of smplayer src
    :param fname:
    :return:
    '''
    table=str.maketrans("/\\:. ","_____")
    name=fname.translate(table)
    sz=os.stat(fname).st_size
    name+="_"+str(sz)
    return name

if __name__ == "__main__":
    if len(sys.argv) < 2:
        usage()
    filename = sys.argv[1]
    if not os.path.exists(filename):
        err(f"file {filename} does not exist")
    filename=os.path.abspath(filename)
    try:
        config = read_config(INI)
        mode=config['%General'][SMODE]
        if mode != "normal":
            err(f"{SMODE} in {get_config_dir()}/{INI} is {mode}, you must change this to normal")
        fileconfig=read_config(FILES)
        section=file_to_section(filename)
        log(f"looking up {section} for {filename}")
        if not section in fileconfig.sections():
            err(f"section {section} for {filename} does not exist in {get_config_dir()}/{FILES}")
        data=fileconfig[section]
        keys=data.keys()
        for num in range(0,99):
            kn=f"bookmarks\\{num}\\name"
            ks=f"bookmarks\\{num}\\time"
            if kn in keys and ks in keys:
                prfx="CHAPTER{num:02n}".format(num=num)
                ts=datetime.timedelta(seconds=int(data[ks]))
                hours,reminder=divmod(ts.seconds, 3600)
                minutes,seconds=divmod(reminder, 60)
                strts="{hrs:02n}:{min:02n}:{sec:02n}.{ms:03n}".format(hrs=hours,min=minutes,sec=seconds,ms=0)
                print(f"{prfx}={strts}")
                print(f"{prfx}NAME={data[kn]}")
    except Exception as e:
        err(str(e))



