import time
import threading
import socket
import struct
import re

hasDbus = False
Glib = None
try:
    import dbus.glib
    from dbus import DBusException

    hasDbus = True
    from gi.repository import GLib
except:
    pass

# copied from https://github.com/quantenschaum/nmweb/blob/master/nmweb.py

nm_base = "org.freedesktop.NetworkManager"
nm_path = "/org/freedesktop/NetworkManager"


def int_to_ip(ip_int):
    return socket.inet_ntoa(struct.pack("=I", ip_int))

def ssid_to_str(ssid):
    try:
        rt=""
        for x in ssid:
            rt+=chr(x)
        return rt
    except:
        return str(ssid)
def mac_to_str(mac):
    try:
        rt=""
        for x in mac:
            if rt:
                rt+=":"
            rt+=f"{x:02X}"
        return rt
    except:
        return str(mac)

STATE_FIELDS = [
    "State",
    "NetworkingEnabled",
    "WirelessEnabled",
    "WirelessHardwareEnabled",
    "WwanEnabled",
    "WwanHardwareEnabled",
    "RadioFlags",
    "PrimaryConnection",
    "PrimaryConnectionType",
    "Version",
    "Connectivity",
    "ConnectivityCheckAvailable",
    "ConnectivityCheckEnabled",
    "ConnectivityCheckUri",
    "GlobalDnsConfiguration",
]

DEV_FIELDS = [
    "Interface",
    "State",
    "ActiveConnection",
    "Capabilities",
    "Managed",
    "Autoconnect",
    "DeviceType",
    "Ip4Connectivity",
    "Ip6Connectivity",
    "HwAddress",
    "Ip4Config",
    "Ip6Config",
    "Speed",
    "Carrier",
    "Bitrate",
    "Mode",
    "ActiveAccessPoint",
    "WirelessCapabilities",
]

AP_FIELDS = [
    "Flags",
    "WpaFlags",
    "RsnFlags",
    "Ssid",
    "Frequency",
    "HwAddress",
    "Mode",
    "MaxBitrate",
    "Bandwidth",
    "Strength",
    "LastSeen",
]

ACTIVE_CONNECTION_FIELDS = [
    "Connection",
    "Id",
    "Type",
    "Devices",
    "State",
]

IP_FIELDS = [
    "Addresses",
    "Gateway",
    "Domains",
    "Nameservers",
    "Searches",
    "DnsOptions",
    "DnsPriority",
]

class PropsTranslation:
    @classmethod
    def kout(cls,key: str):
        return key.lower()
    def __init__(self, key,translator=None,enumValues=None):
        self.key=key
        self.translator=translator
        self.enumValues=enumValues
    def translate(self,props,outprops):
        v=props.get(self.key)
        if v is None:
            return
        ok=self.kout(self.key)
        if self.translator:
            ov=self.translator(v)
            if ov is not None:
                outprops[ok] = ov
        elif self.enumValues:
            outprops[ok]=self.enumValues.get(v,str(v))
        else:
            outprops[ok]=v


class Plugin(object):

    @classmethod
    def pluginInfo(cls):
        return {
            'description': 'network manager interface',
        }

    def __init__(self, api):
        self.api = api  # type: AVNApi
        # we register an handler for API requests
        self.api.registerRequestHandler(self.handleApiRequest)
        self.api.registerRestart(self.stop)
        self.loop = None
        self.bus = None

    def build_path(self,path):
        path = path if path.startswith("/") else nm_path + "/" + path if path else nm_path
        if not path.startswith(nm_path):
            raise Exception(f"path {path} does not start with {nm_path}")
        sub=path[len(nm_path):]
        if sub == "":
            return path
        ALLOWED_PATTERN=[
            "^/[a-zA-Z0-9]+/[0-9]+$",
            "^/[a-zA-Z0-9]+$"
        ]
        matched=False
        for p in ALLOWED_PATTERN:
            if re.match(p, sub):
                matched=True
                break
        if not matched:
            raise Exception(f"path {path} contains invalid characters {sub}")
        return path
    def nm(self, path="", interface=None):
        "access NM on dbus"
        if self.bus is None:
            return
        path = self.build_path(path)
        obj = self.bus.get_object(nm_base, path)
        if interface is not None:
            return dbus.Interface(obj, interface)
        else:
            return obj

    def nmBase(self):
        return self.nm(interface=nm_base)

    def stop(self):
        self._stopLoop()

    def run(self):
        """
        the run method
        this will be called after successfully instantiating an instance
        this method will be called in a separate Thread
        """
        if not hasDbus:
            raise Exception("no DBUS installed, cannot run")
        self.api.log("started")
        self.api.setStatus('STARTED', 'starting')
        self.loop = None
        self.loop = GLib.MainLoop()
        loopThread = threading.Thread(target=self._dbusLoop, daemon=True, name="NWM handler DBUS loop")
        # loopThread.start()
        self.bus = dbus.SystemBus(mainloop=self.loop)
        self.api.setStatus('NMEA', 'running')
        while not self.api.shouldStopMainThread():
            time.sleep(1)
        self._stopLoop()

    def _stopLoop(self):
        if self.loop is not None:
            try:
                self.loop.quit()
            except Exception as x:
                self.api.error("unable to stop dbus event loop %s" % str(x))
            self.loop = None

    def _dbusLoop(self):
        if self.loop is None:
            return
        try:
            self.loop.run()
        except Exception as e:
            self.api.error(f"Exception in DBUS loop {e}")
        self.loop = None

    def short_path(self,path):
        if path.startswith(nm_path):
            path=path[len(nm_path):]
            if path.startswith("/"):
                path=path[1:]
        elif path=='/':
            return None
        return path
    def get_arg(self, args, key):
        v = args.get(key)
        if v is None or len(v) < 1:
            return None
        return v[0]
    def get_bool_arg(self, args, key, default=False):
        v = self.get_arg(args, key)
        if v is None:
            return default
        return v.lower() == "true"

    def get_props(self, object, interface, prop=None):
        "get props from dbus obj as dict"
        if prop is None:
            return object.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties")
        else:
            return object.Get(interface, prop, dbus_interface="org.freedesktop.DBus.Properties")


    DeviceType={
        1: "Ethernet",
        2: "Wi-Fi",
        5: "Bluetooth",
        6: "OLPC",
        7: "WiMAX",
        8: "Modem",
        9: "InfiniBand",
        10: "Bond",
        11: "VLAN",
        12: "ADSL",
        13: "Bridge",
        14: "Generic",
        15: "Team",
        16: "TUN",
        17: "IPTunnel",
        18: "MACVLAN",
        19: "VXLAN",
        20: "Veth",
        30: 'Wi-Fi-P2P',
        32: "Local"
    }
    State={
            0: "Unknown",
            10: "Unmanaged",
            20: "Unavailable",
            30: "Disconnected",
            40: "Prepare",
            50: "Config",
            60: "Need Auth",
            70: "IP Config",
            80: "IP Check",
            90: "Secondaries",
            100: "Activated",
            110: "Deactivating",
            120: "Failed",
        }

    def translate_props(self,props:dict,translations,oprops:dict=None):
        if not oprops:
            oprops = {}
        if isinstance(translations,dict):
            for k,tlist in translations.items():
                kprops=props.get(k)
                if kprops is None:
                    continue
                if oprops.get(k) is None:
                    oprops[k]={}
                for t in tlist:
                    t.translate(kprops,oprops[k])
        else:
            for t in translations:
                t.translate(props,oprops)
        return oprops

    def getIpConfig(self,path,isV4=True,full=True):
        intf=nm_base+".IP4Config" if isV4 else nm_base+".IP6Config"
        if not path or path == '/':
            return {}
        try:
            if full:
                proxy=self.nm(path)
                translations=[
                    PropsTranslation('AddressData')
                ]
                rt=self.translate_props(self.get_props(proxy,intf),translations)
            else:
                rt={}
            rt['path']=self.short_path(path)
            return rt
        except Exception as e:
            self.api.error(f"Exception getting {intf} for {path}: {e}")
            return {}
    def getDeviceProps(self,path,includeIpConfig=True,deviceType=None,full=True,includeConnection=False):
        '''
        device props
        :param path:
        :param includeIpConfig: True|False
        :param deviceType: numeric device type
        :return:
        '''
        if full:
            translations = [
                PropsTranslation('Interface'),
                PropsTranslation('Driver'),
                PropsTranslation('Ip4Config', translator=lambda x: self.getIpConfig(x, True,includeIpConfig)),
                PropsTranslation('Ip6Config', translator=lambda x: self.getIpConfig(x, False,includeIpConfig)),
                PropsTranslation('DeviceType', enumValues=self.DeviceType),
                PropsTranslation('State', enumValues=self.State),
                PropsTranslation('HwAddress'),
                PropsTranslation('Managed'),
                PropsTranslation('ActiveConnection',
                                 translator=lambda x: self.short_path(x) if not includeConnection else self.getActiveConnectionInfo(x,False,False,False)),
            ]
            device = self.nm(path=path)
            props = self.get_props(device, nm_base + ".Device")
            if deviceType is not None and props.get('DeviceType') != deviceType:
                return None
            config=self.translate_props(props, translations)
        else:
            config={}
        config['path']=self.short_path(path)
        return config

    def getDevices(self,includeIpConfig=True,deviceType=None,full=True,includeConnection=False):
        '''
        see network manager examples
        '''
        nm=self.nmBase()
        rt=[]
        if deviceType is not None:
            try:
                deviceType=int(deviceType)
            except:
                for k,v in self.DeviceType.items():
                    if v == deviceType:
                        deviceType=k
                        break
        for d in nm.GetDevices():
            converted=self.getDeviceProps(d,includeIpConfig=includeIpConfig,deviceType=deviceType,full=full)
            if converted is not None:
                rt.append(converted)
        return rt

    def mergeSecrets(self,proxy, config, setting_name):
        try:
            # returns a dict of dicts mapping name::setting, where setting is a dict
            # mapping key::value.  Each member of the 'setting' dict is a secret
            secrets = proxy.GetSecrets(setting_name)
            # Copy the secrets into our connection config
            for setting in secrets:
                for key in secrets[setting]:
                    config[setting_name][key] = secrets[setting][key]
        except Exception as e:
            pass

    def getConnectionInfo(self,path,includeSecrets=False,type=None):
        proxy = self.nm(path, nm_base + ".Settings.Connection")
        config = proxy.GetSettings()
        if type is not None:
            con=config.get('connection',{})
            if con.get('type') != type:
                return None
        config['path']=self.short_path(path)
        self.mergeSecrets(proxy, config, "802-11-wireless")
        if includeSecrets:
            self.mergeSecrets(proxy, config, "802-11-wireless-security")
        translations={
            '802-11-wireless': [
                PropsTranslation('ssid',translator=ssid_to_str),
                PropsTranslation('mac-address',translator=mac_to_str)
            ]
        }
        self.translate_props(config, translations,config)
        return config
    def getConnections(self,includeSecrets=False,type=None):
        settings=self.nm("Settings",nm_base+".Settings")
        rt=[]
        for path in settings.ListConnections():
            config=self.getConnectionInfo(path,includeSecrets,type=type)
            if config:
                rt.append(config)
        return rt
    ACSTATE={
        0: "Unknown",
        1: "Activating",
        2: "Activated",
        3: "Deactivating",
        4: "Deactivated",
    }
    def getActiveConnectionInfo(self,path,includeSecrets=False,includeDevices=True,includeIpConfig=False):
        def get_devices(dlist):
            rt = []
            if not dlist:
                return rt
            for d in dlist:
                rt.append(self.getDeviceProps(d, includeIpConfig=includeIpConfig, full=includeDevices))
            return rt
        translations = [
            PropsTranslation('Connection',
                             translator=lambda x: self.getConnectionInfo(x, includeSecrets=includeSecrets)),
            PropsTranslation('Uuid'),
            PropsTranslation('Type'),
            PropsTranslation('State', enumValues=self.ACSTATE),
            PropsTranslation('Id'),
            PropsTranslation('Devices', translator=get_devices),
            PropsTranslation('Ip4Config', translator=lambda x: self.getIpConfig(x, True,includeIpConfig)),
            PropsTranslation('Ip6Config', translator=lambda x: self.getIpConfig(x, False,includeIpConfig)),
        ]
        acproxy = self.nm(path)
        props = self.get_props(acproxy, nm_base + ".Connection.Active")
        connection = self.translate_props(props, translations)
        connection['path'] = self.short_path(path)
        return connection

    def getActiveConnections(self,includeSecrets=False,includeDevices=True,includeIpConfig=False,type=None):
        rt=[]
        nm=self.nmBase()
        activeConnections=self.get_props(nm,nm_base,'ActiveConnections')
        if activeConnections is None:
            return rt
        for ac in activeConnections:
            connection=self.getActiveConnectionInfo(ac,includeSecrets=includeSecrets,includeDevices=includeDevices,includeIpConfig=includeIpConfig)
            rt.append(connection)
        return rt
    AP_FLAGS={
        "NONE":0x00000000,
        "PRIVACY":0x00000001,
        "WPS":0x00000002,
        "WPS_PBC":0x00000004,
        "WPS_PIN":0x00000008
    }
    WPA_FLAGS={
        "PAIR_WEP40": 0x00000001,
        "PAIR_WEP104": 0x00000002,
        "PAIR_TKIP": 0x00000004,
        "PAIR_CCMP": 0x00000008,
        "GROUP_WEP40": 0x00000010,
        "GROUP_WEP104": 0x00000020,
        "GROUP_TKIP": 0x00000040,
        "GROUP_CCMP": 0x00000080,
        "KEY_MGMT_PSK": 0x00000100,
        "KEY_MGMT_802_1X": 0x00000200,
        "KEY_MGMT_SAE": 0x00000400,
        "KEY_MGMT_OWE": 0x00000800,
        "KEY_MGMT_OWE_TM": 0x00001000,
        "KEY_MGMT_EAP_SUITE_B_192": 0x00002000
    }
    def get_flags(self,value,flag_type):
        rt=""
        if not isinstance(flag_type,dict):
            return rt
        for k,v in flag_type.items():
            if value & v:
                if not rt:
                    rt=k
                else:
                    rt+=','+k
        return rt
    def scanDevice(self,path):
        rt=[]
        intf = nm_base + ".Device"
        device = self.nm(path=path)
        props = self.get_props(device, intf)
        if props.get('State', 0) <= 20:  # not available
            return None
        if props.get('DeviceType', 0) != 2:  # no Wifi device
            return None
        intf += ".Wireless"
        wifi = dbus.Interface(device, intf)
        connected = self.get_props(wifi, intf, 'ActiveAccessPoint')
        translations = [
            PropsTranslation('Bandwidth'),
            PropsTranslation('Frequency'),
            PropsTranslation('HwAddress'),
            PropsTranslation('Strength'),
            PropsTranslation('Flags', translator=lambda x: self.get_flags(x, self.AP_FLAGS)),
            PropsTranslation('WpaFlags', translator=lambda x: self.get_flags(x, self.WPA_FLAGS)),
            PropsTranslation('Mode'),
            PropsTranslation('Ssid', translator=ssid_to_str),
        ]
        for a in wifi.GetAccessPoints():
            try:
                aproxy = self.nm(a)
                aprops = self.get_props(aproxy, nm_base + ".AccessPoint")
                config = self.translate_props(aprops, translations)
                config['path'] = self.short_path(a)
                config['device'] = path
                if connected == a:
                    config['connected'] = True
                rt.append(config)
            except Exception as e:
                self.api.log(f"unable to read access point {a}: {e}")
        return rt

    def scan(self,path=None):
        if path is not None:
            return self.scanDevice(path)
        nm=self.nmBase()
        rt=[]
        for dp in nm.GetDevices():
            devinfo=self.scanDevice(dp)
            if devinfo is not None:
                rt+=devinfo
        return rt


    def activateConnection(self,conPath,devPath,apPath=None):
        nm=self.nmBase()
        if apPath is not None:
            apPath=self.build_path(apPath)
        else:
            apPath='/'
        conPath=self.build_path(conPath)
        devPath=self.build_path(devPath)
        rt=nm.ActivateConnection(conPath,devPath,apPath)
        return self.short_path(rt)

    def deactivateConnection(self,path):
        if path is None:
            raise Exception("path cannot be None")
        path=self.build_path(path)
        nm=self.nmBase()
        return nm.DeactivateConnection(path)
    ALLOWED_ZONES=['trusted','block']
    def check_zone(self,zone):
        if zone is None:
            return 'trusted'
        if zone not in self.ALLOWED_ZONES:
            raise Exception(f"invalid zone: {zone}, not in {' '.join(self.ALLOWED_ZONES)}")
        return zone
    def addConnection(self,ssid,psk=None,zone=None,omitCheck=False):
        if ssid is None:
            raise Exception("ssid cannot be empty")
        zone=self.check_zone(zone)
        id=ssid
        con={
            "type":"802-11-wireless",
            "id":id,
            "zone":zone,
        }
        wifi={
            "ssid":dbus.ByteArray(ssid.encode('utf-8')),
            "mode":"infrastructure",
        }
        wsec={
            "key-mgmt": "wpa-psk",
            "psk":psk,
        } if psk is not None else {
            "key-mgmt": "none",
        }
        ip={
            "method":"auto"
        }
        settings=self.nm("Settings",nm_base + ".Settings")
        if not omitCheck:
            for s in settings.ListConnections():
                econ=self.nm(s,nm_base + ".Settings.Connection")
                cprops=econ.GetSettings()
                if cprops.get('connection',{}).get('id') == id:
                    raise Exception(f"connection id {id} already exists as {s}")
        config={
            "connection":con,
            "802-11-wireless":wifi,
            "802-11-wireless-security":wsec,
            "ipv4":ip,
            "ipv6":ip
        }
        rt=settings.AddConnection(config)
        return self.short_path(rt)
    def removeConnection(self,path):
        if path is None:
            raise Exception("path cannot be None")
        cprops=self.getConnectionInfo(path)
        mode=cprops.get('802-11-wireless',{}).get('mode')
        if mode != "infrastructure":
            raise Exception(f"can only delete 802-11-wireless.infrastructure connections, current is {mode}")
        con=self.nm(path,nm_base + ".Settings.Connection")
        con.Delete()


    def get_path_arg(self,args,key='path',mandatory=False):
        rt=self.get_arg(args,key)
        if rt is None:
            if mandatory:
                raise Exception(f"missing parameter {key}")
            return None
        if rt.startswith('/'):
            raise Exception(f"invalid path: {rt} for {key}")
        return rt
    def handleApiRequest(self, url, handler, args):
        try:
            data = None
            includeSecrets = self.get_bool_arg(args, 'includeSecrets', False)
            includeDevices = self.get_bool_arg(args, 'includeDevices', False)
            includeIpConfig = self.get_bool_arg(args, 'includeIpConfig', False)
            path = self.get_path_arg(args)
            type=self.get_arg(args, 'type')
            if url == 'test':
                pass
            elif url == 'devices':
                deviceType=self.get_arg(args, 'deviceType')
                full=self.get_bool_arg(args, 'full', False)
                data = self.getDevices(includeIpConfig=includeIpConfig,deviceType=deviceType,full=full or includeIpConfig)
            elif url == 'connections':
                data=self.getConnections(includeSecrets,type=type)
            elif url == 'activateConnection':
                if path is None:
                    raise Exception(f"missing parameter path")
                data=self.activateConnection(path,
                                             self.get_path_arg(args,'device',True),
                                             self.get_path_arg(args,'ap'))
                self.api.log(f"activated connection {data} ")
            elif url == 'deactivateConnection':
                self.deactivateConnection(path)
                self.api.log(f"deactivated connection {path}")
            elif url == 'addConnection':
                ssid=self.get_arg(args, 'ssid')
                psk=self.get_arg(args, 'psk')
                data=self.addConnection(ssid,psk)
                self.api.log(f"added connection {data} for {ssid}")
            elif url == 'removeConnection':
                data=self.removeConnection(path)
            elif url == 'getItem':
                if path is None:
                    raise Exception(f"path is required")
                parts=path.split('/')
                if len(parts) < 2:
                    raise Exception(f"invalid path: {path}")
                if parts[0]=='Settings':
                    data=self.getConnectionInfo(path,includeSecrets=includeSecrets)
                elif parts[0]=='ActiveConnection':
                    data=self.getActiveConnectionInfo(path,includeSecrets=includeSecrets,includeDevices=includeDevices,includeIpConfig=includeIpConfig)
                elif parts[0]=='IP4Config':
                    data=self.getIpConfig(path,True,True)
                elif parts[0]=='IP6Config':
                    data=self.getIpConfig(path,False,True)
                elif parts[0]=='Devices':
                    data=self.getDeviceProps(path,
                                             includeIpConfig=includeIpConfig,
                                             full=True,
                                             includeConnection=self.get_bool_arg(args,'includeConnection'))
                else:
                    raise Exception(f"invalid path: {path} for getItem")
            elif url == 'activeConnections':
                data=self.getActiveConnections(includeSecrets,includeDevices,includeIpConfig,type=type)
            elif url == 'scan':
                data=self.scan(path=path)
            else:
                return {'status': f"request {url} not implemented"}
            return {'status': 'OK', 'data': data}
        except Exception as x:
            return {'status': 'ERROR', 'error': str(x)}
