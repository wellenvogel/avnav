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

hasBluetooth=False

try:
  import bluetooth
  hasBluetooth=True
except:
  pass
from socketbase import *
import avnav_handlerList

if hasBluetooth:
  class OurBtSocket(bluetooth.BluetoothSocket):

    def __init__(self, proto=bluetooth.RFCOMM, _sock=None):
      super().__init__(proto, _sock)
      self._closed=False

    def connect(self, addrport):
      rt=super().connect(addrport)
      if self._closed:
        raise Exception("socket closed")
      return rt

    def send(self, data):
      if self._closed:
        raise Exception("socket closed")
      return super().send(data)


    def recv(self, numbytes):
      if self._closed:
        raise Exception("socket closed")
      try:
        return super().recv(numbytes)
      except Exception as e:
        if isinstance(e,bluetooth.btcommon.BluetoothError):
          if re.match("timed* *out",str(e)):
            raise socket.timeout()
          AVNLog.info("bluetooth socket error: ",str(e))
          raise

    def close(self):
      self._closed=True
      return super().close()
else:
  class OurBtSocket:
    pass

#a Worker for reading bluetooth devices
#it uses a feeder to handle the received data
class AVNBlueToothReader(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNBlueToothReader"
  
  @classmethod
  def getConfigParam(cls, child=None):
    rt=[
        WorkerParameter('maxDevices',5,description="maximal number of bluetooth devices",type=WorkerParameter.T_NUMBER),
        WorkerParameter('deviceList','',description=", separated list of devices addresses. If set - only connect to those devices"),
        WorkerParameter('feederName','',editable=False,description="if set, use this feeder"),
        WorkerParameter('filter','',type=WorkerParameter.T_FILTER)
    ]
    return rt


  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDisable(cls):
    return True

  def _closeSockets(self):
    for host,sock in list(self.addrmap.items()):
      try:
        sock.close()
      except Exception as e:
        AVNLog.error("error closing bt socket %s: %s ",host,str(e))

  def updateConfig(self, param, child=None):
    super().updateConfig(param, child)
    self._closeSockets()

  def stop(self):
    super().stop()
    self._closeSockets()

  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.maplock=threading.Lock()
    self.addrmap={}


   
  #return True if added
  def checkAndAddAddr(self,addr,socket):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    if len(self.addrmap) < maxd:
      if not addr in self.addrmap:
        self.addrmap[addr]=socket
        rt=True
    self.maplock.release()
    return rt
  
  def removeAddr(self,addr):
    self.maplock.acquire()
    try:
      self.addrmap.pop(addr)
    except:
      pass
    self.maplock.release()
 
  #a thread to open a bluetooth socket and read from it until
  #disconnected
  def readBT(self,host,port):
    infoName="BTReader-%s"%(host)
    threading.current_thread().setName("%s-reader-%s]"%(self.getName(),host))
    try:
      sock=OurBtSocket( bluetooth.RFCOMM )
      if not self.checkAndAddAddr(host,sock):
        try:
          sock.close()
        except:
          pass
        return
      AVNLog.debug("started bluetooth reader thread for %s:%s",str(host),str(port))
      self.setInfo(infoName, "connecting", WorkerStatus.STARTED)
      sock.connect((host, port))
      AVNLog.info("bluetooth connection to %s established",host)
      client=SocketReader(sock,self.writeData,None,self.setInfo,shouldStop=self.shouldStop)
      client.readSocket(infoName,self.getSourceName(host),self.getParamValue('filter'))
      sock.close()
    except Exception as e:
      AVNLog.debug("exception from bluetooth device: %s",traceback.format_exc())
      try:
        sock.close()
      except:
        pass
    AVNLog.info("disconnected from bluetooth device ")
    self.setInfo(infoName, "disconnected", WorkerStatus.INACTIVE)
    self.removeAddr(host)
    self.deleteInfo(infoName)
              
  
  #this is the main thread - this executes the bluetooth polling
  def run(self):
    if not hasBluetooth:
      self.setInfo('main','no bluetooth installed',WorkerStatus.ERROR)
      while not self.shouldStop():
        self.wait(10)
      return
    self.wait(2) # give a chance to have the socket open...
    #now start an endless loop with BT discovery...
    self.setInfo('main', "discovering", WorkerStatus.RUNNING)
    while not self.shouldStop():
      service_matches=[]
      try:
        AVNLog.debug("starting BT discovery")
        service_matches = bluetooth.find_service(uuid = bluetooth.SERIAL_PORT_CLASS)
      except Exception as e:
        AVNLog.warn("exception when querying BT services %s, retrying after 10s",traceback.format_exc())
      if self.shouldStop():
        return
      if len(service_matches) == 0:
        self.wait(10)
        continue
      AVNLog.ld("found bluetooth devices",service_matches)
      filter=[]
      filterstr=self.getStringParam('devicelist')
      if not filterstr is None and not filterstr=='':
        filter=filterstr.split(',') 
      for match in service_matches:
        port = match["port"]
        name = match["name"]
        host = match["host"]
        found=False
        if len(filter) > 0:
          if host in filter:
            found=True
          else:
            AVNLog.debug("ignoring device %s as it is not in the list #%s#",host,filterstr)
        else:
          found=True
        if found:
          try:
            AVNLog.info("found new bluetooth device %s",host)
            handler=threading.Thread(target=self.readBT,args=(host,port))
            handler.daemon=True
            handler.start()
          except Exception as e:
            AVNLog.warn("unable to start BT handler %s",traceback.format_exc())
            self.removeAddr(host)
      self.wait(10)
avnav_handlerList.registerHandler(AVNBlueToothReader)
      