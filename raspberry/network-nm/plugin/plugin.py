import time
import threading
from typing import Any, Dict
import socket
import struct

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
            outprops[ok]=self.translator(v)
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

    def nm(self, path="", interface=None):
        "access NM on dbus"
        if self.bus is None:
            return
        path = path if path.startswith("/") else nm_path + "/" + path if path else nm_path
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

    def getfield(self, obj, field):
        "get attr from obj or None"
        try:
            return getattr(obj, field)
        except:
            return None

    def getobj(self, path, fields) -> Dict[str, Any]:
        "get fields from dbus obj as dict"
        o = self.nm(path)
        d = {k: self.getfield(o, k) for k in fields}
        d["path"] = path
        return d

    def get_arg(self, args, key,bool=False):
        v = args.get(key)
        if v is None or len(v) < 1:
            return None
        return v[0]
    def get_bool_arg(self, args, key, default=False):
        v = self.get_arg(args, key)
        if v is None:
            return default
        return v[0].lower() == "true"

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

    def translate_props(self,props:dict,translations:list[PropsTranslation],oprops:dict=None):
        if not oprops:
            oprops = {}
        for t in translations:
            t.translate(props,oprops)
        return oprops

    def getIpConfig(self,path,intf):
        if not path or path == '/':
            return {}
        try:
            proxy=self.nm(path)
            translations=[
                PropsTranslation('AddressData')
            ]
            return self.translate_props(self.get_props(proxy,intf),translations)
        except Exception as e:
            self.api.error(f"Exception getting {intf} for {path}: {e}")
            return {}
    def getDeviceProps(self,path,includeIpConfig=True):
        translations = [
            PropsTranslation('Interface'),
            PropsTranslation('Driver'),
            PropsTranslation('Ip4Config', translator=lambda x: self.getIpConfig(x, nm_base + ".IP4Config") if includeIpConfig else None),
            PropsTranslation('Ip6Config', translator=lambda x: self.getIpConfig(x, nm_base + ".IP6Config") if includeIpConfig else None),
            PropsTranslation('DeviceType', enumValues=self.DeviceType),
            PropsTranslation('State', enumValues=self.State),
            PropsTranslation('HwAddress'),
            PropsTranslation('Managed')
        ]
        device = self.nm(path=path)
        props = self.get_props(device, nm_base + ".Device")
        return self.translate_props(props, translations)

    def getDevices(self,includeIpConfig=True):
        '''
        see network manager examples
        '''
        nm=self.nmBase()
        rt=[]
        for d in nm.GetDevices():
            converted=self.getDeviceProps(d,includeIpConfig=includeIpConfig)
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
        if includeSecrets:
            self.mergeSecrets(proxy, config, "802-11-wireless")
            self.mergeSecrets(proxy, config, "802-11-wireless-security")
            self.mergeSecrets(proxy, config, "802-1x")
            self.mergeSecrets(proxy, config, "gsm")
            self.mergeSecrets(proxy, config, "cdma")
            self.mergeSecrets(proxy, config, "ppp")
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
    def getActiveConnections(self,includeSecrets=False,includeDevices=True,includeIPConfig=False,type=None):
        rt=[]
        nm=self.nmBase()
        activeConnections=self.get_props(nm,nm_base,'ActiveConnections')
        if activeConnections is None:
            return rt
        if includeDevices:
            def get_devices(dlist):
                rt=[]
                if not dlist:
                    return rt
                for d in dlist:
                    rt.append(self.getDeviceProps(d,includeIpConfig=includeIPConfig))
                return rt
        else:
            def get_devices(dlist):
                return None
        translations=[
            PropsTranslation('Connection',translator=lambda x: self.getConnectionInfo(x,includeSecrets=includeSecrets)),
            PropsTranslation('Uuid'),
            PropsTranslation('Type'),
            PropsTranslation('State',enumValues=self.ACSTATE),
            PropsTranslation('Id'),
            PropsTranslation('Devices',translator=get_devices),
        ]
        for ac in activeConnections:
            acproxy=self.nm(ac)
            props=self.get_props(acproxy,nm_base+".Connection.Active")
            if type is not None and type != props.get('Type'):
                continue
            connection=self.translate_props(props,translations)
            rt.append(connection)
        return rt

    def handleApiRequest(self, url, handler, args):
        try:
            data = None
            includeSecrets = self.get_bool_arg(args, 'includeSecrets', True)
            includeDevices = self.get_bool_arg(args, 'includeDevices', True)
            includeIpConfig = self.get_bool_arg(args, 'includeIpConfig', True)
            type=self.get_arg(args, 'type')
            if url == 'test':
                pass
            elif url == 'devices':
                data = self.getDevices(includeIpConfig=includeIpConfig)
            elif url == 'connections':
                data=self.getConnections(includeSecrets,type=type)
            elif url == 'activeConnections':
                data=self.getActiveConnections(includeSecrets,includeDevices,includeIpConfig,type=type)
            elif url.startswith('path/'):
                path = url[5:]
                interface = self.get_arg(args, 'interface')
                nmpath = self.get_arg(args, 'path') or path
                pname = self.get_arg(args, 'property')
                if interface is not None:
                    if interface != '':
                        interface = nm_base + "." + interface
                    else:
                        interface = nm_base
                data = self.nm(path=nmpath, interface=interface)
                if data is not None:
                    props = self.get_props(data, interface, prop=pname)
                    return {'status': 'OK', 'data': props}
            else:
                return {'status': f"request {url} not implemented"}
            return {'status': 'OK', 'data': data}
        except Exception as x:
            return {'status': 'ERROR', 'error': str(x)}
