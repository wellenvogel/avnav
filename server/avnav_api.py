# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012-2021 Andreas Vogel andreas@wellenvogel.net
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
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
###############################################################################

class AVNApi(object):

  """
  the API for handlers/decoders that will input data, decode NMEA or output data
  """
  def log(self, format, *param):
    """
    log infos
    @param format: the format string
    @type format: str
    @param param: the list of parameters
    @return:
    """
    raise NotImplemented()

  def debug(self, format, *param):
    """
    debug infos
    @param format: the format string
    @type format: str
    @param param: the list of parameters
    @return:
    """
    raise NotImplemented()

  def error(self, format, *param):
    """
    log errors
    @param format: the format string
    @type format: str
    @param param: the list of parameters
    @return:
    """
    raise NotImplemented()

  def getConfigValue(self, key, default=None):
    """
    get a config item from the avnav_server.xml
    it will be a sub element at AVNLoader with the name of the plugin dir and a prefix (builtin,system,user):
    <AVNLoader>
      <user-test count=5 max=10/>
    <AVNLoader
    @param key: the name of the attribute
    @type  key: str
    @param default: the default value if the attribute is not set
    @return:
    """
    raise NotImplemented()

  def fetchFromQueue(self, sequence, number=10,includeSource=False,waitTime=0.5,filter=None):
    """
    fetch NMEA records from the queue
    initially you should start at sequence 0
    the function will return the last sequence
    caution: if no data is available, the function will wait for waitTime seconds and return an empty list
    the normal flow is:
        seq=0
        while True:
          seq,data=api.fetchFromQueue(seq)
          if len(data) > 0:
            for line in data:
              handle(line)
    @param sequence: the sequence from which you would like to read the data
    @param number: the max number of records you would like to get
    @param includeSource: if set to True, the data in the return will be a list of objects each having a data field (the nmea) and a source field
                          otherwise data in the return is a simple list of NMEA records
                          if you are writing a decoder, you should set this to true and hand over the source to addData
    @param filter: a filter string like used in avnav_server.xml - example: "$RMC","$","^!", can also be a list of such strings
                   only NMEA sentences matching this filter will be returned
    @return: (sequence,data) - sequence being the last sequence you have, data being a list of nmea data
    """
    raise NotImplemented()

  def addNMEA(self, nmea, addCheckSum=False,omitDecode=True,source=None):
    """
    add NMEA data to the queue
    caution: you should never add a new NMEA record for each record you received by fetchFromQueue
             as the would quickly fill up the queue
    @param nmea: the completely formatted NMEA record
    @type  nmea: str
    @param addCheckSum: if true, add the checksum to the provided NMEA data
    @param: omitDecode: if true, do not decode the data (only send it out to listeners)
                        this also prevents setting the receive timestamp for such records
    @type  addCheckSum: bool
    @param source: the name of the source to be set, defaults to the plugin name
    @return: None
    """
    raise NotImplemented()

  def addData(self, key, value, source=None,record=None):
    """
    add a data item (potentially from a decoded NMEA record) to the internal data store
    the data added here later on will be fetched from the GUI
    @param key: the key, it must be one of the keys provided as return from the initialize function - see example
    @type  key: str
    @param value: the value to be stored
    @param source: if set, use this as the source for the data value when displayed, otherwise the plugin name is used
    @param record: if set, remember when this record was received
    @return: True on success, will raise an Exception if the key is not allowed
    """
  def getDataByPrefix(self,prefix):
    """
    get a data item from the internal store
    prefix must be a part of the key (without trailing .)
    @param prefix: the prefix
    @type  prefix: str
    @return: a dict with the values found (potentially hierarchical)
    """
    raise NotImplemented()

  def getSingleValue(self,key,includeInfo=False):
    """
    get a single value from the store
    @param key: the key
    @param includeInfo: if set return an object with: value,source,timestamp,priority
    @type  key: str
    @return: the value or the object
    """
    raise NotImplemented()

  def getExpiryPeriod(self):
    """
    get the time in seconds after which a normal entry in the store is
    considered to be expired, just refresh within this time
    @return:
    """
    raise NotImplemented()

  def setStatus(self,value,info):
    """
    set the status for the plugin
    this will be displayed on the status page
    @param value: String, one of 'INACTIVE','STARTED','RUNNING','NMEA','ERROR'
                  any other value will be mapped to ERROR
    @param info: an info text
    @return:
    """
    raise NotImplemented()

  def registerUserApp(self,url,iconFile,title=None):
    """
    register a user app to be displayed
    this should be called only early - i.e. at the beginning of the run method
    @param url: the url to be used to connect, $HOST will be replaced by the current host
    @param iconFile: a file name for the icon file, relative pathes to this plugin dir
    @param title: if set - show a title bar with this title
    @return:
    """
    raise NotImplemented()

  def registerLayout(self,name,layoutFile):
    """
    register a system layout
    @param name: a name for the layout
    @param layoutFile: a file (relative to the plugin dir)
    @return:
    """
    raise NotImplemented()

  def timestampFromDateTime(self,dt=None):
    '''
    convert a datetime object into a timestamp (seconds since epoch)
    @param dt: the datetime, if None use datetime.datetime.utcnow
    @return: timestamp in seconds
    '''
    raise NotImplemented()

  def getDataDir(self):
    '''
    get the AvNav data directory
    @return:
    '''
    raise NotImplemented()

  def registerChartProvider(self,callback):
    '''
    register a function that will be called whenever a chart query is being executed
    it must return a list of entries in the form of
    {
             'name':name,
             'url':url,
             'charturl':url,
             'time': mtime,
             'canDelete': True,
             'canDownload': True,
             'sequence':changeCount
      }
    @param callback: function that will be called with a parameter host containing the IP if the server
    @return:
    '''
    raise NotImplemented()

  def registerRequestHandler(self,callback):
    '''
    register a handler for requests to the plugin URL fro the GUI (js)
    the url is /plugin/name/api
    at the js side you will have a global variable AVNAV_PLUGIN_URL to use this
    there will be exactly one request handler - if you call this method again, the
    old handler will be removed
    @param callback: a function that will receive 3 parameters:
                     url - the request url (after the plugin/.../api part)
                     handler - a HttpRequestHandler object- see https://docs.python.org/2/library/basehttpserver.html#BaseHTTPServer.BaseHTTPRequestHandler
                     args - a dictionary of request parameters
                     You can either return:
                        a dictionary - this will be sent as a json response,
                        True - in this case it is assumed you did send data already with the handler
                        None - will return an error
                     if you provide None it deletes an existing handler
    @return:
    '''
    raise NotImplemented()

  def getBaseUrl(self):
    '''
    return the url for the plugin
    append "/api" to this url for api request
    other requests will look for files with the requested name
    in the plugin directory
    @return:
    '''
    raise NotImplemented()

  def registerUsbHandler(self,usbid,callback):
    '''
    register a handler for an USB device
    the USB Id is the same format like you configure for AVNUsbSerialReader
    When you register for such an id, the UsbSerialReader will ignore this device
    and when it is detected, your callback will be invoked with the device path
    An exception will be raised if someone else already registered for the same device
    @param usbid:
    @param callback:
    @return:
    '''
    raise NotImplemented()

  def getAvNavVersion(self):
    '''
    get the version of AvNav as an int
    @return:
    '''
    raise NotImplemented()