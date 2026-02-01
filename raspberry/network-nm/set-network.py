#!/usr/bin/env python3
import os
import subprocess
import syslog
import sys
import shutil
import re
RT_ERR=2
RT_REBOOT=1
RT_OK=0
syslog.openlog(ident='avnav-set-network')
CFG='/boot/firmware/avnav.conf'
LAST='/etc/avnav-network-checks'
TEMPLATE_DIR=os.path.dirname(__file__)
CFG_DIR='/etc/NetworkManager/system-connections'
CON_FILE='Hotspot.nmconnection'
COPY_FILES=['Ethernet.nmconnection']
class ConfigEntry:
    def __init__(self,key,defv,check=None,action=None):
        self.key=key
        self.defv=defv
        self.check=check
        self.action=action

PREFIX='AVNAV_'
PLEN=len(PREFIX)

def run_cmd(cmd,shell=False):
    try:
        result=subprocess.run(cmd,shell=shell,)
        if result.returncode != 0:
            log(f"setting wifi country with {' '.join(cmd)} failed",prio=syslog.LOG_ERR)
            return result.returncode
        return 0
    except Exception as e:
        log(f"unable to execute {' '.join(cmd)}: {e}")
        return -1
def wifi_country_action(old,new):
    if old == new:
        return RT_OK
    log(f"change wifi country to {new}")
    cmd=['raspi-config','nonint','do_wifi_country',new]
    rt=run_cmd(cmd)
    if rt == 0:
        return RT_REBOOT
    return RT_ERR

def check_addr(v):
    ET="must look like 192.168.30.10/24"
    if not v:
        return "must not be empty"
    matches=re.match(r'(^[0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)\/([0-9]+)',v)
    if not matches:
        return ET
    l=len(matches.groups())
    if (l != 5):
        return ET
    try:
        for idx in range(0,l):
            ig=int(matches.groups()[idx])
            if idx < 4:
                if ig < 0 or ig > 255:
                    return f"tuple {ig} out of range 0...255"
            else:
                if ig < 1 or ig > 31:
                    return f"mask {ig} out of range 1...31"
    except Exception as e:
        return f"error parsing {v}: {e}"

def check_band(v):
    ALLOWED=['bg','a']
    if not v in ALLOWED:
        return f"is not one of {' '.join(ALLOWED)}"

def check_ssid(v):
    if not v:
        return "must not be empty"
    if len(v) > 32:
        return "must be max. 31 characters"

def check_psk(v):
    if not v:
        return "must not be empty"
    if len(v) < 8 or len(v) > 64:
        return "invalid len (8...63 or 64 hex)"
    if len(v) == 64:
        #must be hex
        if not re.match('^[0-9A-Fa-f]*$',v):
            return "invalid hex"
    else:
        if not re.match('^[\u0020-\u007e]*$',v):
            return "invalid character"     

SETTINGS={
    'SSID':ConfigEntry('ssid','avnav',check=check_ssid),
    'PSK':ConfigEntry('psk','avnav-secret',check=check_psk),
    'WIFI_COUNTRY':ConfigEntry('','DE',action=wifi_country_action),
    'WIFI_INTF':ConfigEntry('interface','wlan0'),
    'WIFI_BAND':ConfigEntry('band','bg',check=check_band),
    'WIFI_CHANNEL':ConfigEntry('channel','7'),
    'WIFI_ADDRESS':ConfigEntry('address1','192.168.30.10/24',check=check_addr)
}

def log(msg,prio=syslog.LOG_INFO):
    syslog.syslog(prio,msg)
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

log("started")
current=read_config(CFG)
last=read_config(LAST)
changed=False
actions=[]
if last is None:
    log(f"{LAST} not found, assuming fresh install")
    changed=True
    last={}
if current is None:
    log(f"{CFG} not found, using defaults")
    current=get_settings_defaults()
for k,v in current.items():
    lv=last.get(k)
    if lv != v:
        changed=True
if not changed:
    log("no changes, exiting")
    sys.exit(0)
log("copying config from templates")
rtc=RT_OK
for cf in COPY_FILES:
    src=os.path.join(TEMPLATE_DIR,cf)
    target=os.path.join(CFG_DIR,cf)
    if not os.path.exists(src):
        continue
    if os.path.exists(target):
        os.unlink(target)
    log(f"copying {src} to {target}")
    if not shutil.copyfile(src,target):
        log(f"error copying {src} to {target}",prio=syslog.LOG_ERR)
        rtc=RT_ERR
src=os.path.join(TEMPLATE_DIR,CON_FILE)
target=os.path.join(CFG_DIR,CON_FILE)
target_values={}
for k,v in current.items():
    cfg=SETTINGS.get(k[PLEN:])
    if cfg is None or not cfg.key:
        continue
    if cfg.check:
        err=cfg.check(v)
        if err is not None:
            log(f"invalid value {v} for {k}: {err}, falling back to default {cfg.defv}")
            v=cfg.defv
    target_values[cfg.key]=v
if not os.path.exists(src):
    log(f"{src} not found",prio=syslog.LOG_ERR)
else:
    try:
        if os.path.exists(target):
            log(f"removing existing {target}")
            os.unlink(target)
        log(f"writing config from {src} to {target}")
        with open(src,"r") as rh:
            with open(target,"w") as wh:
                for line in rh:
                    parts=line.split("=",1)
                    if len(parts) == 2 and parts[0] in target_values.keys():
                        v=target_values[parts[0]]
                        log(f"setting {parts[0]} to {v}")
                        wh.write(f"{parts[0]}={v}\n")
                    else:
                        wh.write(line)
                wh.close()
        os.chmod(target,0o600)        
        
    except Exception as e:
        log(f"unable to write config to {target}: {e}",prio=syslog.LOG_ERR)           
        rtc=RT_ERR
if run_cmd(['systemctl','--quiet','is-active','NetworkManager']) == 0:
    log("restarting NetworkManager")
    rt=run_cmd(['systemctl','restart','NetworkManager'])
    if rt != 0:
        rtc=RT_ERR
#special actions
needs_reboot=False
for k,v in current.items():
    cfg=SETTINGS.get(k[PLEN:])
    if not cfg or cfg.action is None:
        continue
    lv=last.get(k)
    if lv == v:
        continue
    rt=cfg.action(lv,v)
    if rt == RT_REBOOT:
        needs_reboot=True
    elif rt != RT_OK:
        rtc=RT_ERR            
#writing last used
try:
    log(f"writing used values to {LAST}")
    with open(LAST,"w") as wh:
        for k,v in current.items():
            wh.write(f"{PREFIX}{k}={v}\n")
except Exception as e:
    log(f"unable to write last values to {LAST}:{e}",prio=syslog.LOG_ERR)
    rtc=RT_ERR
if needs_reboot:
    rtc=RT_REBOOT
log(f"finishing with rt={rtc}")
sys.exit(rtc)
pass


