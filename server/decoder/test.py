import time
#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it
from avnav_api import AVNApi


class TestDecoder:
  PATH="gps.test"
  def __init__(self):
    self.api = None # type: AVNApi

  def initialize(self,api):
    """
    initialize a decoder
    @param api: the api to communicate with avnav
    @type  api: AVNApi
    @return: a dict with the content described below
             mandatory parts:
               * description
               * name
               * list of keys to be stored
                 * path - the key - see AVNApi.addData
                 * description
                 * unit to be displayed
                 * maxvalue - a value being the max number /string to size GUI elements
    """
    self.api=api
    return {
      'description': 'a test decoder',
      'name': self.__class__.__name__,
      'data': [
        {
          'path':self.PATH,
          'description':'output of testdecoder',
          'unit':'',
          'maxvalue':'0000'
        }
      ]
    }

  def run(self):
    """
    the run method
    this will be called after successfully instantiating an instance
    this method will be called in a separate Thread
    @return:
    """
    seq=0
    count=0
    self.api.log("started")
    while True:
      seq,data=self.api.fetchFromQueue(seq,10)
      if len(data) > 0:
        for line in data:
          #do something
          count+=1
          if count%10 == 0:
            self.api.log("store new value %d",count)
            self.api.addData(self.PATH,count)
            self.api.addData("wrong.path",count)
          pass
      else:
        time.sleep(0.1)

