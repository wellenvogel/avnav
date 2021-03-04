#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it
from avnav_api import AVNApi


class Plugin(object):
  PATH="gps.test"

  @classmethod
  def pluginInfo(cls):
    """
    the description for the module
    @return: a dict with the content described below
            parts:
               * description (mandatory)
               * data: list of keys to be stored (optional)
                 * path - the key - see AVNApi.addData, all pathes starting with "gps." will be sent to the GUI
                 * description
    """
    return {
      'description': 'a test plugins',
      'data': [
        {
          'path': cls.PATH,
          'description': 'output of testdecoder',
        }
      ]
    }

  def __init__(self,api):
    """
        initialize a plugins
        do any checks here and throw an exception on error
        do not yet start any threads!
        @param api: the api to communicate with avnav
        @type  api: AVNApi
    """
    self.api = api # type: AVNApi
    #we register an handler for API requests
    self.api.registerRequestHandler(self.handleApiRequest)
    self.count=0
    self.api.registerRestart(self.stop)

  def stop(self):
    pass

  def run(self):
    """
    the run method
    this will be called after successfully instantiating an instance
    this method will be called in a separate Thread
    The example simply counts the number of NMEA records that are flowing through avnav
    and writes them to the store every 10 records
    @return:
    """
    seq=0
    self.api.log("started")
    self.api.setStatus('NMEA','running')
    while not self.api.shouldStopMainThread():
      seq,data=self.api.fetchFromQueue(seq,10)
      if len(data) > 0:
        for line in data:
          #do something
          self.count+=1
          if self.count%10 == 0:
            self.api.addData(self.PATH,self.count)
            #self.api.addData("wrong.path",count) #this would be ignored as we did not announce our path - and will write to the log


  def handleApiRequest(self,url,handler,args):
    """
    handler for API requests send from the JS
    @param url: the url after the plugin base
    @param handler: the HTTP request handler
                    https://docs.python.org/2/library/basehttpserver.html#BaseHTTPServer.BaseHTTPRequestHandler
    @param args: dictionary of query arguments
    @return:
    """
    if url == 'test':
      return {'status':'OK'}
    if url == 'reset':
      self.count=0
      self.api.addData(self.PATH, self.count)
      return {'status': 'OK'}
    return {'status','unknown request'}
