#plugin to register the switch command
import time
class Plugin(object):

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
      'description': 'switch desk command'
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
    self.error=None
    


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
    self.api.log("started")
    if hasattr(self.api,'registerCommand'):
      self.api.registerCommand('desk2','switch_desk.sh',['2'],client='local',icon='rpi.png')
    else:
      self.error="cannot register command (avnav version too old)"  
    if self.error is not None:
        self.api.setStatue('ERROR',self.error)
    else:    
        self.api.setStatus('NMEA','running')
    while not self.api.shouldStopMainThread():
        time.sleep(1)