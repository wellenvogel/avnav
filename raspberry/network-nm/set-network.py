#!/usr/bin/env python3
import os
import subprocess
CFG='/boot/firmware/avnav.conf'
LAST='/etc/avnav-network-checks'
class ConfigEntry:
    def __init__(self,key,defv):
        self.key=key
        self.defv=defv

PREFIX='AVNAV_'


SETTINGS={
    'SSID':ConfigEntry('ssid','avnav'),
    'PSK':ConfigEntry('psk','avnav-secret'),
    'WIFI_COUNTRY':ConfigEntry('','DE'),
    'WIFI_INTF':ConfigEntry('interface','wlan0'),
    'WIFI_BAND':ConfigEntry('band','bg'),
    'WIFI_CHANNEL':ConfigEntry('channel','7'),
    'WIFI_ADDRESS':ConfigEntry('address1','192.168.30.10/24')
}

def get_settings_defaults():
    rt={}
    for k,v in SETTINGS.items():
        rt[PREFIX+k]=v.defv
    return rt

def read_config(filename:str):
    if not os.path.exists(filename):
        return
    rt=get_settings_defaults()
    result=subprocess.run(f". \"{filename}\"; set",shell=True,capture_output=True,text=True,errors='ignore')
    if result.returncode != 0:
        return
    for line in result.stdout.splitlines():
        parts=line.split("=",1)
        if len(parts) == 2 and parts[0] in rt.keys():
            v=parts[1][1:-1]
            rt[parts[0]]=v
    return rt

current=read_config(CFG)
last=read_config(LAST)
pass


