# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py 
###############################################################################
import json
import time

import avnav_handlerList
from avnav_manager import AVNHandlerManager
from avnav_util import *
from avnav_worker import *
from wpa_control import WpaControl


class FwInfo(object):
  def __init__(self,ssid,mode,status):
    self.ssid=ssid
    self.mode=mode
    self.status=status

#a handler to set up a wpa claient
class AVNWpaHandler(AVNWorker):
  PRIVATE_NAME = "wlan-internal" #name to be set as id_str for wlans that should allow incoming traffic
  P_FWCOMMAND="firewallCommand"
  COMMAND_REPEAT=10 #10 seconds for repeat on error
  COMMAND_REPEAT_OK=1800 #30 minutes for repeat on ok
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.wpaHandler=None
    self.lastScan=datetime.datetime.utcnow()
    self.scanLock=threading.Lock()
    self.getRequestParam=AVNUtil.getHttpRequestParam
    self.commandHandler = None
    self.lastFwInfo=None
  @classmethod
  def getConfigName(cls):
    return "AVNWpaHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'ownSocket':'/tmp/avnav-wpa-ctrl', #my own socket endpoint
            'wpaSocket':"/var/run/wpa_supplicant/wlan-av1", #the wpa control socket
            'ownSsid':'avnav,avnav1,avnav2',
            #cls.P_FWCOMMAND': '',
            cls.P_FWCOMMAND:'sudo -n $BASEDIR/../raspberry/iptables-ext.sh wlan-av1'
    }
  @classmethod
  def preventMultiInstance(cls):
    return True
  def run(self):
    self.commandHandler = self.findHandlerByName("AVNCommandHandler")
    wpaSocket=self.getStringParam('wpaSocket')
    ownSocket=self.getStringParam('ownSocket')
    watcherThread=threading.Thread(target=self.allowDenyWatcher,name="firewallWatcher")
    watcherThread.start()
    while not self.shouldStop():
      try:
        newWpaSocket=self.getStringParam('wpaSocket')
        if newWpaSocket != wpaSocket:
          if self.wpaHandler is not None:
            self.wpaHandler.close(False)
            self.wpaHandler=None
          wpaSocket=newWpaSocket
        if os.path.exists(wpaSocket):
          AVNLog.debug("wpa socket %s exists, checking handler", wpaSocket)
          if self.wpaHandler is None:
            AVNLog.info("connecting to wpa_supplicant %s",wpaSocket)
            self.wpaHandler=WpaControl(wpaSocket,ownSocket)
            self.wpaHandler.open()
            self.setInfo('main','connected to %s'%(wpaSocket),WorkerStatus.STARTED)
          else:
            try:
              self.wpaHandler.checkOpen()
            except:
              AVNLog.error("wpa handler closed...")
              self.wpaHandler=None
        else:
          AVNLog.debug("wpa socket %s does not exist",wpaSocket)
          if self.wpaHandler is not None:
            self.wpaHandler.close(False)
            self.wpaHandler=None
            AVNLog.info("disconnecting from wpa_supplicant %s",wpaSocket)
            self.setInfo('main','disconnected from %s'%(wpaSocket),WorkerStatus.INACTIVE)
          time.sleep(5)
          continue
        #we should have an active wpa handler here...
        #todo: cache scan results here
      except Exception as e:
        AVNLog.error("exception in WPAHandler: %s",traceback.format_exc())
        pass
      time.sleep(5)
      
  def allowDenyWatcher(self):
    """
    checks for the current active LAN to have id_str="wlan-internal"
    and open the firewall in this case using the allowDenyCommand
    @return:
    """
    statusName="FwHandler"
    cmd=self.getStringParam(self.P_FWCOMMAND)
    if cmd is None or cmd == "":
      self.setInfo(statusName, "no  command", WorkerStatus.INACTIVE)
      return
    cmdparam=cmd.split(" ")
    command=[]
    for par in cmdparam:
      command.append(AVNUtil.replaceParam(par, AVNHandlerManager.filterBaseParam(self.getParam())))
    self.setInfo(statusName,"running",WorkerStatus.NMEA)
    lastNet=None
    lastMode=None
    lastResult=-1
    lastSuccess=AVNUtil.utcnow()
    while True:
      try:
        status=self.getStatus()
        if status.get('wpa_state') is not None and status.get('wpa_state') == 'COMPLETED':
          ssid=status.get('ssid')
          mode="deny"
          if status.get('id_str') is not None and status.get('id_str') == self.PRIVATE_NAME:
            mode="allow"
          waittime=0
          if lastMode == mode and lastNet == ssid:
            if lastResult != 0:
              waittime=self.COMMAND_REPEAT
            else:
              waittime=self.COMMAND_REPEAT_OK
          if (AVNUtil.utcnow() - lastSuccess) >= waittime:
            lastNet=ssid
            lastMode=mode
            AVNLog.info("running command %s %s",command,mode)
            lastResult=AVNUtil.runCommand(command+[mode],statusName+"-command")
            if lastResult != 0:
              if lastResult is None:
                lastResult=-1
              AVNLog.error("%s: unable to run firewall command on %s for mode %s, return %d"%(statusName,ssid,mode,lastResult))
              self.setInfo(statusName,"unable to run firewall command on %s for %s, return %d"%(ssid,mode,lastResult),WorkerStatus.ERROR)
            else:
              self.setInfo(statusName, "firewall command on %s for %s ok" % (ssid,mode), WorkerStatus.NMEA)
              lastSuccess=AVNUtil.utcnow()
            self.lastFwInfo=FwInfo(ssid,mode,lastResult)
      except:
        AVNLog.error("%s: exception %s"%(statusName,traceback.format_exc()))
      time.sleep(5)

  def startScan(self):
    if self.wpaHandler is None:
      return
    self.scanLock.acquire()
    now=datetime.datetime.utcnow()
    if now > (self.lastScan + datetime.timedelta(seconds=30)):
      AVNLog.debug("wpa start scan")
      self.lastScan=now
      self.scanLock.release()
      self.wpaHandler.startScan()
      return
    self.scanLock.release()

  def getList(self):
    AVNLog.debug("wpa getList")
    rt=[]
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      self.startScan()
    except:
      AVNLog.error("exception in WPAHandler:getList: %s",traceback.format_exc())
    try:
      list=wpaHandler.scanResultWithInfo()
      ownSSid=self.getStringParam('ownSsid')
      #remove own ssid
      for net in list:
        netSsid=net.get('ssid')
        if ownSSid is not None and ownSSid != "":
          if netSsid is not None and netSsid in ownSSid.split(","):
            continue
        id_str=net.get('id_str')
        if id_str is not None and id_str == self.PRIVATE_NAME:
          net['allowAccess']=True
        rt.append(net)
      AVNLog.debug("wpa list %s",rt)
      return rt
    except Exception:
      AVNLog.error("exception in WPAHandler:getList: %s",traceback.format_exc())
      return rt
  def removeNetwork(self,id):
    rt={'status':'no WLAN'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      AVNLog.debug("wpa remove network",id)
      wpaHandler.removeNetwork(id)
      wpaHandler.saveConfig()
      return {'status':'OK'}
    except Exception as e:
      AVNLog.error("exception in WPAHandler:removeNetwork: %s",traceback.format_exc())
      return {'status':'commandError','info':str(e)}

  def enableNetwork(self,id,param=None):
    rt={'status':'no WLAN'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      AVNLog.debug("wpa enable network",id)
      if param is not None:
        self.wpaHandler.configureNetwork(id,param)
      wpaHandler.enableNetwork(id)
      wpaHandler.saveConfig()
      return {'status':'OK'}
    except Exception as e:
      AVNLog.error("exception in WPAHandler:enableNetwork: %s",traceback.format_exc())
      return {'status':'commandError','info':str(e)}
  def disableNetwork(self,id):
    rt={'status':'no WLAN'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      AVNLog.debug("wpa disable network",id)
      wpaHandler.disableNetwork(id)
      wpaHandler.saveConfig()
      return {'status':'OK'}
    except Exception as e:
      AVNLog.error("exception in WPAHandler:disableNetwork: %s",traceback.format_exc())
      return {'status':'commandError','info':str(e)}

  def connect(self,param):
    rt={'status':'no WLAN'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      AVNLog.debug("wpa connect",param)
      wpaHandler.connect(param)
      wpaHandler.saveConfig()
      return {'status':'OK'}
    except Exception as e:
      AVNLog.error("exception in WPAHandler:connect: %s",traceback.format_exc())
      return {'status':'commandError','info':str(e)}

  def getStatus(self):
    rt={'wpa_state':'OFFLINE'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      rt=wpaHandler.status()
      if rt.get('id_str') is not None and rt.get('id_str') == self.PRIVATE_NAME:
        rt['allowAccess']=True
      hasFwResult=False
      if self.lastFwInfo is not None:
        if self.lastFwInfo.ssid == rt.get('ssid'):
          rt['fwStatus']=self.lastFwInfo.status
          rt['fwMode']=self.lastFwInfo.mode
          hasFwResult=True
      if not hasFwResult:
        rt['fwStatus']=-1
      AVNLog.debug("wpa status",rt)
      return rt
    except Exception:
      AVNLog.error("exception in WPAHandler:getStatus: %s",traceback.format_exc())
      return {'wpa_state':'COMMANDERROR'}

  def getHandledCommands(self):
    return "wpa"

  def safeInt(self,val):
    try:
      return int(val)
    except:
      return None

  def handleApiRequest(self,type,subtype,requestparam,**kwargs):
    start=datetime.datetime.utcnow()
    command=self.getRequestParam(requestparam, 'command')
    AVNLog.debug("wpa api request %s",command)
    rt=None
    if command is None:
      raise Exception('missing command for wpa request')
    if command == 'list':
      rt=json.dumps(self.getList())
    if command == 'status':
      rt=json.dumps(self.getStatus())
    if command == 'all':
      cmd=self.getStringParam(self.P_FWCOMMAND)
      rt={'status':self.getStatus(),'list':self.getList()}
      if cmd is not None and cmd != "":
        rt['showAccess']=True
      rt=json.dumps(rt)
    if command == 'enable':
      id=self.getRequestParam(requestparam,'id')
      updateParam={}
      psk=self.getRequestParam(requestparam,'psk')
      if psk is not None and psk != "":
        updateParam['psk']=psk
      allowAccess=self.getRequestParam(requestparam,'allowAccess')
      if allowAccess is not None and allowAccess == 'true':
        updateParam['id_str']=self.PRIVATE_NAME
      else:
        updateParam['id_str']=''
      rt=json.dumps(self.enableNetwork(id,updateParam))
    if command == 'disable':
      id=self.getRequestParam(requestparam,'id')
      rt=json.dumps(self.disableNetwork(id))
    if command == 'remove':
      id=self.getRequestParam(requestparam,'id')
      rt=json.dumps(self.removeNetwork(id))
    if command == 'connect':
      param={}
      for k in ['ssid','psk']:
        v=self.getRequestParam(requestparam,k)
        if v is not None and v != "":
          param[k]=v
      key=self.getRequestParam(requestparam,"psk")
      id = self.getRequestParam(requestparam, 'id')
      if ( key is None or key == "" )  and ( id is None or self.safeInt(id) < 0) :
        param['key_mgmt'] = "NONE"
      else:
        param['key_mgmt'] = "WPA-PSK"
      allowAccess=self.getRequestParam(requestparam,'allowAccess')
      if allowAccess is not None and allowAccess == 'true':
        param['id_str']=self.PRIVATE_NAME
      else:
        param['id_str'] = ''
      rt=json.dumps(self.connect(param))
    if rt is None:
      raise Exception("unknown command %s"%(command))
    end=datetime.datetime.utcnow()
    AVNLog.debug("wpa request %s lasted %d millis",command,(end-start).total_seconds()*1000)
    return rt
avnav_handlerList.registerHandler(AVNWpaHandler)
        
