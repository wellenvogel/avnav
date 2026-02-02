#!/usr/bin/env python3
import os
import subprocess
import syslog
import sys
import shutil
import re
import getopt
from enum import Enum
M_NORMAL=0
M_INSTALL=1
mode=M_NORMAL
RT_ERR=2
RT_REBOOT=1
RT_OK=0
LOGPRFX='avnav-set-network'
syslog.openlog(ident=LOGPRFX)
CFG='/boot/firmware/avnav.conf'
LAST='/etc/avnav-network-checks'
TEMPLATE_DIR=os.path.dirname(__file__)
CFG_DIR='/etc/NetworkManager/system-connections'
CON_FILE='Hotspot.nmconnection'
COPY_FILES=['Ethernet.nmconnection']

class ChangeType(Enum):
    NWMANAGER=1
    REBOOT=2,
    HOSTNAME=3

class ConfigEntry:
    def __init__(self,key,defv,type:ChangeType=ChangeType.NWMANAGER,check=None,action=None):
        self.key=key
        self.defv=defv
        self.check=check
        self.action=action
        self.type=type

class CurrentConfig:
    def __init__(self,cfg:ConfigEntry,value=None):
        self.cfg=cfg
        self.value=value

PREFIX='AVNAV_'
PLEN=len(PREFIX)

def log(msg,prio=syslog.LOG_INFO,console=False):
    syslog.syslog(prio,msg)
    if mode == M_INSTALL or console:
        if prio != syslog.LOG_ERR:
            print(f"{LOGPRFX}:{msg}")
        else:
            print(f"{LOGPRFX}: ERROR {msg}")


def run_cmd(cmd,shell=False,logErr=True):
    try:
        result=subprocess.run(cmd,shell=shell,)
        if result.returncode != 0:
            if logErr:
                log(f"running {' '.join(cmd)} failed",prio=syslog.LOG_ERR)
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
    return run_cmd(cmd)

def hostname_action(old,new):
    if old == new:
        return RT_OK
    log(f"setting hostname to {new}")
    return run_cmd(['hostnamectl','hostname',new])

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
    'WIFI_COUNTRY':ConfigEntry('','DE',type=ChangeType.REBOOT,action=wifi_country_action),
    'WIFI_INTF':ConfigEntry('interface','wlan0'),
    'WIFI_BAND':ConfigEntry('band','bg',check=check_band),
    'WIFI_CHANNEL':ConfigEntry('channel','7'),
    'WIFI_ADDRESS':ConfigEntry('address1','192.168.30.10/24',check=check_addr),
    'HOSTNAME':ConfigEntry('','avnav',type=ChangeType.HOSTNAME,action=hostname_action)
}

def get_settings_defaults(values:bool=True):
    rt={}
    for k,v in SETTINGS.items():
        rt[PREFIX+k]=CurrentConfig(v,v.defv if values else None)
    return rt

def read_config(filename:str,omitDefault:bool=False):
    if not os.path.exists(filename):
        return
    rt=get_settings_defaults(not omitDefault)
    result=subprocess.run(f". \"{filename}\"; set",shell=True,capture_output=True,text=True,errors='ignore')
    if result.returncode != 0:
        return
    for line in result.stdout.splitlines():
        parts=line.split("=",1)
        if len(parts) == 2 and parts[0] in rt.keys():
            v=parts[1][1:-1]
            rt[parts[0]].value=v
    return rt

log(f"started: {' '.join(sys.argv[1:])}",console=True)
try:
    optlist,args=getopt.getopt(sys.argv[1:],'i')
    for o,a in optlist:
        if o == '-i':
            mode=M_INSTALL
except Exception as e:
    log(str(e),console=True)
    sys.exit(RT_ERR)
try:
    current=read_config(CFG)
    last=read_config(LAST,omitDefault=True)
    changed=False
    actions=[]
    if last is None:
        log(f"{LAST} not found, assuming fresh install")
        changed=True
        last={}
    else:
        if mode == M_INSTALL:
            log("config already installed, do nothing")
            sys.exit(0)
    if current is None:
        log(f"{CFG} not found, using defaults")
        current=get_settings_defaults()
    changes={}
    for k,cv in current.items():
        cfg=cv.cfg
        lv=last.get(k) or CurrentConfig(cfg)
        #for install we only handle config file
        if mode == M_INSTALL and cfg.type != ChangeType.NWMANAGER:
            cv.value=lv.value
        if lv.value != cv.value:
            log(f"changed {k} to {cv.value}")
            changed=True
            if cfg:
                changes[cfg.type]=True
    if not changed:
        log("no changes, exiting")
        sys.exit(0)
    rtc=RT_OK
    if changes.get(ChangeType.NWMANAGER):
        log("copying config from templates")
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
            else:
                os.chmod(target,0o600)
        src=os.path.join(TEMPLATE_DIR,CON_FILE)
        target=os.path.join(CFG_DIR,CON_FILE)
        target_values={}
        for k,cv in current.items():
            cfg=cv.cfg
            v=cv.value
            if not cfg.key:
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
        if run_cmd(['systemctl','--quiet','is-active','NetworkManager'],logErr=False) == 0:
            log("restarting NetworkManager")
            rt=run_cmd(['systemctl','restart','NetworkManager'])
            if rt != 0:
                rtc=RT_ERR
    #special actions            
    for k,cv in current.items():
        cfg=cv.cfg
        if cfg.action is None:
            continue
        lv=last.get(k) or CurrentConfig(cfg)
        if lv.value == cv.value:
            continue
        rt=cfg.action(lv.value,cv.value)
        if rt != RT_OK:
            rtc=RT_ERR            
    #writing last used
    try:
        log(f"writing used values to {LAST}")
        with open(LAST,"w") as wh:
            for k,cv in current.items():
                if cv.value is None:
                    continue
                wh.write(f"{k}={cv.value}\n")
        os.chmod(LAST,0o600)
    except Exception as e:
        log(f"unable to write last values to {LAST}:{e}",prio=syslog.LOG_ERR)
        rtc=RT_ERR
    if rtc == RT_OK and changes.get(ChangeType.REBOOT):
        rtc=RT_REBOOT
    log(f"finishing with rt={rtc}")
    sys.exit(rtc if mode == M_NORMAL else 0)
except Exception as e:
    log(e,prio=syslog.LOG_ERR)
    sys.exit(RT_ERR if mode == M_NORMAL else 0)


